import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractRevenue, detectAI, detectSolo, classify, normalizeUrl, hashId, scoreCandidate, signalsFor } from '../collector/lib/extract.mjs';
import { parseFeed, stripTags } from '../collector/lib/xml.mjs';
import { mapListing } from '../collector/sources/reddit.mjs';
import { runCollect, mergeCandidates, toCandidate } from '../collector/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (f) => readFileSync(join(here, 'fixtures', f), 'utf8');
const categories = JSON.parse(readFileSync(join(here, '..', 'data', 'japan', 'categories.json'), 'utf8')).items;

test('売上表現を抽出する', () => {
  const r = extractRevenue('We hit $12k MRR, then $1.5M ARR, and made $5,000/month from ads. Total $40k in revenue.');
  const byMetric = Object.fromEntries(r.map((x) => [x.metric, x.usd]));
  assert.equal(byMetric.MRR, 12000);
  assert.equal(byMetric.ARR, 1500000);
  assert.equal(byMetric.monthly, 5000);
  assert.equal(byMetric.total, 40000);
});

test('$なしの「15k MRR」や「MRR of $3k」も抽出、価格（$9/mo）は除外', () => {
  assert.deepEqual(extractRevenue('now at 15k MRR').map((x) => x.usd), [15000]);
  assert.deepEqual(extractRevenue('MRR of $3k after launch').map((x) => [x.metric, x.usd]), [['MRR', 3000]]);
  assert.equal(extractRevenue('pricing is $9/mo for the pro plan').length, 0);
});

test('AI・ソロ創業のシグナル', () => {
  assert.ok(detectAI('built with GPT-4 and Claude'));
  assert.ok(detectAI('An AI tool'));
  assert.ok(!detectAI('A tool for painters'));
  assert.ok(detectSolo('I built this as a solo founder'));
  assert.ok(!detectSolo('Our team of 40 engineers'));
});

test('カテゴリ推定（複数形も一致）', () => {
  assert.equal(classify('AI tool that helps teachers write lesson plans', categories), 'education-writing');
  assert.equal(classify('Chat with PDF documents and extract data from invoices', categories), 'document-ai');
  assert.equal(classify('AI receptionist that answers phone calls', categories), 'voice-agent');
  assert.equal(classify('nothing relevant here', categories), null);
});

test('URL正規化とID', () => {
  assert.equal(normalizeUrl('https://www.Example.com/a/?utm_source=x&id=2#top'), 'https://example.com/a?id=2');
  assert.equal(hashId('a'), hashId('a'));
  assert.notEqual(hashId('a'), hashId('b'));
  assert.match(hashId('x'), /^[0-9a-f]{8}$/);
});

test('スコア：AI＋ソロ＋売上は高く、資金調達ニュースは低い', () => {
  const now = new Date('2026-10-07T00:00:00Z');
  const good = { title: 'I built an AI app solo, $20k MRR', publishedAt: '2026-10-06T00:00:00Z', points: 100, comments: 20 };
  const bad = { title: 'AI startup raises $50M Series B', publishedAt: '2026-10-06T00:00:00Z' };
  assert.ok(scoreCandidate(good, signalsFor(good), now) > scoreCandidate(bad, signalsFor(bad), now) + 30);
});

test('RSS と Atom を読める', () => {
  const rss = parseFeed(fx('feed.rss'));
  assert.equal(rss.length, 2);
  assert.equal(rss[0].title, "Solo founder's AI chatbot startup crosses $1.2M ARR without VC");
  assert.equal(rss[0].author, 'Jane Reporter');
  assert.ok(rss[0].summary.includes('$1.2M ARR & profitability'));
  assert.equal(rss[0].publishedAt, '2026-10-05T08:00:00.000Z');
  const atom = parseFeed(fx('feed.atom'));
  assert.equal(atom.length, 1);
  assert.equal(atom[0].url, 'https://www.producthunt.com/posts/interiorgenie');
  assert.equal(stripTags('<p>a &amp; b</p>'), 'a & b');
});

test('Reddit の一覧を正規化する', () => {
  const items = mapListing(JSON.parse(fx('reddit.json')), 'SideProject');
  assert.equal(items.length, 1);
  assert.equal(items[0].discussionUrl, 'https://www.reddit.com/r/SideProject/comments/abc123/my_gpt_powered_resume_tool/');
  assert.equal(items[0].points, 340);
});

test('重複はタイトルでもまとめ、注目・本採用は保持期間を過ぎても残す', () => {
  const now = new Date('2026-10-07T00:00:00Z');
  const old = { id: 'aaaa', title: 'Old AI thing', url: 'https://a', score: 50, status: 'starred', lastSeen: '2025-01-01T00:00:00Z' };
  const stale = { id: 'bbbb', title: 'Stale', url: 'https://b', score: 50, status: 'new', lastSeen: '2025-01-01T00:00:00Z' };
  const dupe = { id: 'cccc', title: 'Old  AI thing!', url: 'https://c', score: 70, status: 'new', lastSeen: now.toISOString(), points: 9 };
  const res = mergeCandidates([old, stale], [dupe], { now, retentionDays: 30 });
  assert.equal(res.updated, 1);
  assert.equal(res.added, 0);
  assert.deepEqual(res.items.map((x) => x.id), ['aaaa']);
  assert.equal(res.items[0].score, 70);
  assert.equal(res.items[0].status, 'starred');
});

test('runCollect：モックした公開APIから候補を作り candidates.json に書き込む', async () => {
  const root = mkdtempSync(join(tmpdir(), 'natura-'));
  mkdirSync(join(root, 'data', 'japan'), { recursive: true });
  cpSync(join(here, '..', 'data', 'japan', 'categories.json'), join(root, 'data', 'japan', 'categories.json'));
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const body = url.includes('hn.algolia.com') ? fx('hn.json')
      : url.includes('reddit.com') ? fx('reddit.json')
      : url.includes('feed-a') ? fx('feed.rss') : fx('feed.atom');
    return { ok: true, status: 200, text: async () => body };
  };
  const config = {
    lookbackDays: 30, requestDelayMs: 0, minScore: 35,
    sources: {
      hackernews: { enabled: true, queries: ['AI MRR'] },
      reddit: { enabled: true, subreddits: ['SideProject'], query: 'AI MRR' },
      rss: { enabled: true, feeds: [{ name: 'A', url: 'https://x/feed-a' }, { name: 'B', url: 'https://x/feed-b' }] }
    }
  };
  const logs = [];
  const stats = await runCollect({ root, config, fetchImpl, now: new Date('2026-10-07T00:00:00Z'), log: (m) => logs.push(m) });
  assert.equal(calls.length, 4);
  assert.ok(calls[0].includes('numericFilters'));
  assert.equal(stats.fetched, 2 + 1 + 2 + 1);
  const saved = JSON.parse(readFileSync(join(root, 'data', 'candidates.json'), 'utf8'));
  const titles = saved.items.map((x) => x.title);
  assert.ok(titles.some((t) => t.includes('meeting notes')));
  assert.ok(titles.some((t) => t.includes('resume tool')));
  assert.ok(titles.some((t) => t.includes('$1.2M ARR')));
  assert.ok(!titles.some((t) => t.includes('database')), 'AIでない話題は除外');
  const notes = saved.items.find((x) => x.title.includes('meeting notes'));
  assert.equal(notes.url, 'https://example.com/notes-ai');
  assert.equal(notes.category, 'voice-notes');
  assert.equal(notes.bestMonthlyUsd, 4200);
  // 2回目は重複として更新される
  const again = await runCollect({ root, config, fetchImpl, now: new Date('2026-10-08T00:00:00Z'), log: () => {} });
  assert.equal(again.added, 0);
  assert.equal(again.total, saved.items.length);
});

test('runCollect：取得に失敗しても他のソースは続行する', async () => {
  const root = mkdtempSync(join(tmpdir(), 'natura-'));
  mkdirSync(join(root, 'data', 'japan'), { recursive: true });
  cpSync(join(here, '..', 'data', 'japan', 'categories.json'), join(root, 'data', 'japan', 'categories.json'));
  const fetchImpl = async (url) => {
    if (url.includes('reddit.com')) return { ok: false, status: 403, text: async () => '' };
    if (url.includes('hn.algolia.com')) throw new Error('network down');
    return { ok: true, status: 200, text: async () => fx('feed.rss') };
  };
  const logs = [];
  const stats = await runCollect({
    root, fetchImpl, now: new Date('2026-10-07T00:00:00Z'), log: (m) => logs.push(m),
    config: { requestDelayMs: 0, sources: { hackernews: { enabled: true, queries: ['x'] }, reddit: { enabled: true, subreddits: ['s'] }, rss: { enabled: true, feeds: [{ name: 'A', url: 'https://x/a' }] } } }
  });
  assert.equal(stats.perSource.hackernews, 0);
  assert.equal(stats.perSource.reddit, 0);
  assert.equal(stats.perSource.rss, 2);
  assert.ok(logs.some((l) => l.includes('network down')));
  assert.ok(logs.some((l) => l.includes('r/s')));
});

test('toCandidate は本文から最大の売上を bestMonthlyUsd にする', () => {
  const c = toCandidate({ source: 'rss', sourceName: 'x', title: 'Solo AI app makes $3k MRR, ARR $600k soon', url: 'https://e.com/a', text: '' }, categories, new Date());
  assert.equal(c.bestMonthlyUsd, 50000);
});
