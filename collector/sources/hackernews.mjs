// Hacker News（Algolia 公開API・キー不要）
import { getJson, sleep } from '../lib/http.mjs';
import { stripTags } from '../lib/xml.mjs';

export const name = 'hackernews';

export async function collect(cfg, ctx) {
  const since = Math.floor(ctx.since.getTime() / 1000);
  const out = [];
  for (const q of cfg.queries || []) {
    const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=50&query=${encodeURIComponent(q)}&numericFilters=${encodeURIComponent(`created_at_i>${since}`)}`;
    try {
      const json = await getJson(url, ctx.http);
      for (const h of json.hits || []) {
        const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
        out.push({
          source: 'hackernews',
          sourceName: 'Hacker News',
          title: h.title || h.story_title || '',
          url: h.url || discussion,
          discussionUrl: discussion,
          text: stripTags(h.story_text || ''),
          author: h.author || '',
          points: h.points || 0,
          comments: h.num_comments || 0,
          publishedAt: h.created_at || null,
          query: q
        });
      }
    } catch (e) {
      ctx.log(`  ! HN「${q}」の取得に失敗: ${e.message}`);
    }
    await sleep(ctx.delayMs);
  }
  return out;
}
