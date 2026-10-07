// 新着候補の収集：無料の公開ソースから海外のAI個人起業の話題を集め、data/candidates.json に統合する
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as hackernews from './sources/hackernews.mjs';
import * as reddit from './sources/reddit.mjs';
import * as rss from './sources/rss.mjs';
import { signalsFor, scoreCandidate, classify, hashId, normalizeUrl, normalizeTitle, monthlyEquivalent } from './lib/extract.mjs';

export const SOURCES = { hackernews, reddit, rss };

export function toCandidate(item, categories, now) {
  const signals = signalsFor(item);
  const url = normalizeUrl(item.url);
  const text = `${item.title} ${item.text || ''}`;
  const best = signals.revenue.map((r) => ({ ...r, monthly: monthlyEquivalent(r) })).sort((a, b) => (b.monthly || 0) - (a.monthly || 0))[0];
  return {
    id: hashId(url),
    title: item.title.trim(),
    url,
    discussionUrl: item.discussionUrl || null,
    source: item.source,
    sourceName: item.sourceName,
    author: item.author || '',
    summary: String(item.text || '').slice(0, 600),
    publishedAt: item.publishedAt,
    points: item.points || 0,
    comments: item.comments || 0,
    category: classify(text, categories),
    signals: { ai: signals.ai, solo: signals.solo, funded: signals.funded, revenue: signals.revenue.slice(0, 5) },
    bestMonthlyUsd: best && best.monthly ? Math.round(best.monthly) : null,
    score: scoreCandidate(item, signals, now),
    status: 'new',
    firstSeen: now.toISOString(),
    lastSeen: now.toISOString()
  };
}

export function mergeCandidates(existing, incoming, { now, maxCandidates = 600, retentionDays = 180 } = {}) {
  const byId = new Map(existing.map((c) => [c.id, c]));
  const titles = new Map(existing.map((c) => [normalizeTitle(c.title), c.id]));
  let added = 0, updated = 0;
  for (const c of incoming) {
    const dupId = byId.has(c.id) ? c.id : titles.get(normalizeTitle(c.title));
    if (dupId) {
      const prev = byId.get(dupId);
      byId.set(dupId, {
        ...prev,
        points: Math.max(prev.points || 0, c.points || 0),
        comments: Math.max(prev.comments || 0, c.comments || 0),
        score: Math.max(prev.score || 0, c.score || 0),
        lastSeen: c.lastSeen,
        discussionUrl: prev.discussionUrl || c.discussionUrl
      });
      updated++;
    } else {
      byId.set(c.id, c);
      titles.set(normalizeTitle(c.title), c.id);
      added++;
    }
  }
  const cutoff = now.getTime() - retentionDays * 86400000;
  const keep = [...byId.values()].filter((c) => c.status === 'promoted' || c.status === 'starred' || new Date(c.lastSeen).getTime() >= cutoff);
  keep.sort((a, b) => (b.score - a.score) || String(b.publishedAt).localeCompare(String(a.publishedAt)));
  return { items: keep.slice(0, maxCandidates), added, updated };
}

export async function runCollect({ root, config, fetchImpl, now = new Date(), log = console.log, only } = {}) {
  const cfg = config || JSON.parse(readFileSync(join(root, 'collector', 'config.json'), 'utf8'));
  const categories = JSON.parse(readFileSync(join(root, 'data', 'japan', 'categories.json'), 'utf8')).items;
  const candPath = join(root, 'data', 'candidates.json');
  const existing = existsSync(candPath) ? JSON.parse(readFileSync(candPath, 'utf8')).items || [] : [];
  const ctx = {
    since: new Date(now.getTime() - (cfg.lookbackDays || 30) * 86400000),
    delayMs: cfg.requestDelayMs ?? 800,
    http: { fetchImpl, userAgent: cfg.userAgent },
    log
  };
  const raw = [];
  const perSource = {};
  for (const [key, mod] of Object.entries(SOURCES)) {
    const sc = cfg.sources?.[key];
    if (!sc || !sc.enabled || (only && !only.includes(key))) continue;
    log(`- ${key} を収集中…`);
    const items = await mod.collect(sc, ctx);
    perSource[key] = items.length;
    log(`  ${items.length} 件`);
    raw.push(...items);
  }
  const fresh = raw
    .filter((i) => i.title && i.url)
    .filter((i) => !i.publishedAt || new Date(i.publishedAt) >= ctx.since)
    .map((i) => toCandidate(i, categories, now))
    .filter((c) => c.signals.ai && c.score >= (cfg.minScore ?? 35));
  const merged = mergeCandidates(existing, fresh, { now, maxCandidates: cfg.maxCandidates, retentionDays: cfg.retentionDays });
  writeFileSync(candPath, JSON.stringify({ updated: now.toISOString(), items: merged.items }, null, 2) + '\n');
  return { fetched: raw.length, relevant: fresh.length, added: merged.added, updated: merged.updated, total: merged.items.length, perSource };
}
