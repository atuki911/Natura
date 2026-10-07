// 依存なしの最小RSS/Atomパーサー
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// エスケープされたHTML（&lt;p&gt;…）にも対応するため、デコード→タグ除去→デコードの順に処理する
export function stripTags(s) {
  const once = decodeEntities(String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
  return decodeEntities(once.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
}

function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
  const pick = links.find((a) => /rel=["']alternate["']/i.test(a)) || links.find((a) => !/rel=/i.test(a)) || links[0];
  const href = pick && pick.match(/href=["']([^"']+)["']/i);
  return href ? decodeEntities(href[1]) : '';
}

export function parseFeed(xml) {
  const text = String(xml || '');
  const isAtom = /<feed\b/i.test(text) && !/<rss\b/i.test(text);
  const blocks = [...text.matchAll(isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  return blocks.map((b) => {
    const title = stripTags(tag(b, 'title'));
    const link = isAtom ? atomLink(b) : stripTags(tag(b, 'link')) || stripTags(tag(b, 'guid'));
    const date = stripTags(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const summary = stripTags(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content') || tag(b, 'content:encoded'));
    const author = stripTags(tag(b, 'dc:creator') || tag(b, 'author'));
    const d = date ? new Date(date) : null;
    return {
      title,
      url: link,
      summary,
      author,
      publishedAt: d && !isNaN(d) ? d.toISOString() : null
    };
  }).filter((x) => x.title && x.url);
}
