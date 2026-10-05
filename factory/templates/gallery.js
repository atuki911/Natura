'use strict';

const { escapeHtml, inlineJson } = require('./util');

function galleryHtml(entries, genres) {
  const cards = entries
    .map(
      (e) => `<a class="card" href="${e.slug}/" data-genre="${e.genre}">
  <div class="art" style="background:linear-gradient(${e.bg1},${e.bg2})"><span>${e.player}</span></div>
  <div class="meta"><b>${escapeHtml(e.title)}</b><small>${escapeHtml(e.genreLabel)} × ${escapeHtml(e.themeLabel)}</small></div>
</a>`,
    )
    .join('\n');
  const chips = [['all', 'すべて'], ...genres.map((g) => [g.id, g.label])]
    .map(([id, label], i) => `<button class="chip${i ? '' : ' on'}" data-genre="${id}">${escapeHtml(label)}</button>`)
    .join('');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>Natura Game Factory</title>
<meta name="description" content="Natura ゲーム工場で量産されたスマホゲーム一覧">
<style>
:root{--bg:#f6f4fb;--card:#fff;--ink:#22223b;--soft:#6c6f7d;--line:#e4e1ee;--accent:#7b2ff7}
@media (prefers-color-scheme:dark){:root{--bg:#14121c;--card:#1f1c2b;--ink:#f1eff8;--soft:#a5a1b8;--line:#2e2a3d;--accent:#b388ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;-webkit-text-size-adjust:100%}
header{padding:calc(20px + env(safe-area-inset-top)) 16px 8px;max-width:960px;margin:0 auto}
h1{margin:0;font-size:24px}
header p{margin:4px 0 0;color:var(--soft);font-size:14px}
.bar{display:flex;gap:8px;overflow-x:auto;padding:12px 16px;max-width:960px;margin:0 auto;scrollbar-width:none}
.chip,.dice{flex:none;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:8px 14px;font-size:14px;cursor:pointer}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.dice{margin-left:auto}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:4px 16px calc(24px + env(safe-area-inset-bottom));max-width:960px;margin:0 auto}
.card{display:block;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;color:inherit;text-decoration:none;transition:transform .15s}
.card:active{transform:scale(.97)}
.art{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:64px}
.meta{padding:10px 12px 12px}
.meta b{display:block;font-size:15px;line-height:1.3;overflow-wrap:anywhere}
.meta small{color:var(--soft);font-size:12px}
.hidden{display:none}
</style>
</head>
<body>
<header>
<h1>🏭 Natura Game Factory</h1>
<p><span id="count">${entries.length}</span> 本のスマホゲームが稼働中。タップして遊ぼう。</p>
</header>
<nav class="bar">${chips}<button class="dice" id="dice">🎲 ランダム</button></nav>
<main id="grid">
${cards}
</main>
<script>
const GAMES = ${inlineJson(entries.map((e) => ({ slug: e.slug, genre: e.genre })))};
let genre = 'all';
document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
  genre = chip.dataset.genre;
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip));
  let n = 0;
  document.querySelectorAll('.card').forEach((card) => {
    const show = genre === 'all' || card.dataset.genre === genre;
    card.classList.toggle('hidden', !show);
    if (show) n++;
  });
  document.getElementById('count').textContent = n;
}));
document.getElementById('dice').addEventListener('click', () => {
  const pool = GAMES.filter((g) => genre === 'all' || g.genre === genre);
  if (pool.length) location.href = pool[Math.floor(Math.random() * pool.length)].slug + '/';
});
</script>
</body>
</html>
`;
}

module.exports = { galleryHtml };
