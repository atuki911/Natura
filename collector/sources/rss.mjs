// 任意のRSS/Atomフィード（Google News検索、Product Hunt など）
import { getText, sleep } from '../lib/http.mjs';
import { parseFeed } from '../lib/xml.mjs';

export const name = 'rss';

export async function collect(cfg, ctx) {
  const out = [];
  for (const feed of cfg.feeds || []) {
    try {
      const xml = await getText(feed.url, ctx.http);
      for (const it of parseFeed(xml)) {
        out.push({
          source: 'rss',
          sourceName: feed.name,
          title: it.title,
          url: it.url,
          discussionUrl: null,
          text: it.summary,
          author: it.author,
          points: 0,
          comments: 0,
          publishedAt: it.publishedAt
        });
      }
    } catch (e) {
      ctx.log(`  ! フィード「${feed.name}」の取得に失敗: ${e.message}`);
    }
    await sleep(ctx.delayMs);
  }
  return out;
}
