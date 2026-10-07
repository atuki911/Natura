// Reddit（公開JSON・キー不要。403/429時はRSSにフォールバック）
import { getJson, getText, sleep } from '../lib/http.mjs';
import { parseFeed } from '../lib/xml.mjs';

export const name = 'reddit';

export function mapListing(json, sub) {
  return (json?.data?.children || []).map((c) => c.data).filter(Boolean).map((d) => ({
    source: 'reddit',
    sourceName: `r/${d.subreddit || sub}`,
    title: d.title || '',
    url: d.url_overridden_by_dest && !/reddit\.com/.test(d.url_overridden_by_dest) ? d.url_overridden_by_dest : `https://www.reddit.com${d.permalink}`,
    discussionUrl: `https://www.reddit.com${d.permalink}`,
    text: d.selftext || '',
    author: d.author || '',
    points: d.score || 0,
    comments: d.num_comments || 0,
    publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null
  }));
}

export async function collect(cfg, ctx) {
  const out = [];
  const q = encodeURIComponent(cfg.query || 'AI MRR');
  for (const sub of cfg.subreddits || []) {
    const base = `https://www.reddit.com/r/${encodeURIComponent(sub)}/search`;
    try {
      const json = await getJson(`${base}.json?q=${q}&restrict_sr=1&sort=new&t=month&limit=50`, ctx.http);
      out.push(...mapListing(json, sub));
    } catch (e) {
      if (e.status === 403 || e.status === 429) {
        try {
          const xml = await getText(`${base}.rss?q=${q}&restrict_sr=1&sort=new&t=month`, ctx.http);
          for (const it of parseFeed(xml)) {
            out.push({ source: 'reddit', sourceName: `r/${sub}`, title: it.title, url: it.url, discussionUrl: it.url, text: it.summary, author: it.author, points: 0, comments: 0, publishedAt: it.publishedAt });
          }
        } catch (e2) {
          ctx.log(`  ! r/${sub} の取得に失敗（JSON: ${e.message} / RSS: ${e2.message}）`);
        }
      } else {
        ctx.log(`  ! r/${sub} の取得に失敗: ${e.message}`);
      }
    }
    await sleep(ctx.delayMs);
  }
  return out;
}
