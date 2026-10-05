'use strict';

/*
 * 1ファイル版アーケード。全ゲームを 1 枚の HTML に詰め込む。
 * サーバーも公開 URL もいらないので、自分のスマホに入れて非公開で遊べる。
 * エンジンは 1 回、ジャンルのルールも 1 回ずつだけ埋め込み、各ゲームは設定だけを持つ。
 */
const { inlineJson } = require('./util');

const FONTS = 'https://fonts.googleapis.com/css2?family=DotGothic16&family=M+PLUS+Rounded+1c:wght@400;700&display=swap';

function arcadeHead() {
  return `<title>Natura アーケード</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
/* 筐体のマーキー（看板）＋カートリッジ棚。タップしたカートリッジが全画面で起動する */
:root {
  --cabinet: #0f0d1f;
  --shelf: #1a1734;
  --groove: #2e2a55;
  --text: #f4f1ff;
  --muted: #a7a1cf;
  --coin: #ffcf3f;
  --display: "DotGothic16", "Hiragino Maru Gothic ProN", monospace;
  --body: "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box }
[hidden] { display: none !important }
html, body { background: var(--cabinet); color: var(--text) }
body { margin: 0; font-family: var(--body); font-size: 15px; line-height: 1.5; -webkit-text-size-adjust: 100% }
body.playing { overflow: hidden }
.wrap { max-width: 980px; margin: 0 auto; padding-inline: 16px; padding-block: 20px 40px }
.marquee { display: grid; gap: 6px; padding-block: 8px 18px; border-bottom: 2px dashed var(--groove) }
.marquee h1 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(30px, 8vw, 46px); line-height: 1.1; letter-spacing: .04em; text-wrap: balance; color: var(--coin); text-shadow: 0 0 18px rgba(255, 207, 63, .35) }
.marquee p { margin: 0; color: var(--muted) }
.private { display: inline-flex; gap: 6px; align-items: center; justify-self: start; font-size: 12px; letter-spacing: .08em; padding: 3px 10px; border: 1px solid var(--groove); border-radius: 999px; color: var(--muted) }
.bar { display: flex; flex-wrap: wrap; gap: 8px; padding-block: 16px }
.chip, .dice { font: inherit; font-size: 14px; border: 1px solid var(--groove); background: var(--shelf); color: var(--text); border-radius: 999px; padding: 7px 14px; cursor: pointer }
.chip[aria-pressed="true"] { background: var(--coin); border-color: var(--coin); color: var(--cabinet); font-weight: 700 }
.dice { margin-left: auto; font-family: var(--display); letter-spacing: .06em }
.chip:focus-visible, .dice:focus-visible, .cart:focus-visible { outline: 3px solid var(--coin); outline-offset: 2px }
.shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 14px }
.cart { display: grid; grid-template-rows: auto 1fr; min-width: 0; background: var(--shelf); border: 1px solid var(--groove); border-radius: 14px 14px 6px 6px; overflow: hidden; color: inherit; text-decoration: none; transition: transform .12s ease }
.cart:active { transform: translateY(2px) }
.label { position: relative; aspect-ratio: 4 / 3; max-width: 100%; display: grid; place-items: center; font-size: 56px }
.label::after { content: ""; position: absolute; inset: auto 0 0; height: 6px; background: repeating-linear-gradient(90deg, rgba(0,0,0,.25) 0 6px, transparent 6px 12px) }
.info { display: grid; gap: 2px; padding: 10px 12px 12px; min-width: 0 }
.info b { font-size: 15px; line-height: 1.3; overflow-wrap: anywhere }
.info small { color: var(--muted); font-size: 12px }
.hi { font-family: var(--display); font-size: 13px; color: var(--coin); font-variant-numeric: tabular-nums; letter-spacing: .04em }
.foot { margin-top: 28px; color: var(--muted); font-size: 12px }
#stage { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent }
#stage canvas { display: block; touch-action: none }
#stage .btn { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 10px); width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(0,0,0,.3); color: #fff; font-size: 20px; line-height: 40px; text-align: center; text-decoration: none; cursor: pointer }
#stage #mute { right: 10px }
#stage #home { right: 58px }
@media (prefers-reduced-motion: reduce) { .cart { transition: none } }
</style>`;
}

function arcadeBody({ runtime, genres, games }) {
  const sources = Object.entries(genres)
    .map(([id, src]) => `  ${JSON.stringify(id)}: (${src}),`)
    .join('\n');
  return `<div class="wrap" id="shelfView">
<header class="marquee">
  <span class="private">🔒 自分専用・非公開</span>
  <h1>Natura アーケード</h1>
  <p><span id="count">${games.length}</span> 本のゲームが入っています。カートリッジをタップして遊ぼう。</p>
</header>
<nav class="bar" id="bar" aria-label="ジャンルで絞り込み"></nav>
<main class="shelf" id="shelf"></main>
<p class="foot">ハイスコアはこの端末の中だけに保存されます。</p>
</div>
<div id="stage" hidden></div>
<script>
${runtime}
</script>
<script>
(function () {
var GENRES = {
${sources}
};
var GAMES = ${inlineJson(games)};
var LABELS = ${inlineJson(Object.fromEntries(games.map((g) => [g.genre, g.genreLabel])))};
var shelf = document.getElementById('shelf');
var bar = document.getElementById('bar');
var stage = document.getElementById('stage');
var genre = 'all';
var current = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function best(id) {
  try { return Number(localStorage.getItem('natura:' + id + ':best')) || 0; } catch (e) { return 0; }
}

function renderBar() {
  var ids = ['all'].concat(Object.keys(LABELS));
  bar.innerHTML = ids.map(function (id) {
    return '<button class="chip" id="chip-' + id + '" aria-pressed="' + (id === genre) + '" data-genre="' + id + '">' + (id === 'all' ? 'すべて' : esc(LABELS[id])) + '</button>';
  }).join('') + '<button class="dice" id="dice">🎲 ランダム</button>';
}

function visible() {
  return GAMES.filter(function (g) { return genre === 'all' || g.genre === genre; });
}

function renderShelf() {
  var list = visible();
  document.getElementById('count').textContent = list.length;
  shelf.innerHTML = list.map(function (g) {
    var t = g.theme;
    return '<a class="cart" href="#' + g.id + '">' +
      '<div class="label" style="background:linear-gradient(' + t.bg1 + ',' + t.bg2 + ')"><span>' + t.player + '</span></div>' +
      '<div class="info"><b>' + esc(g.title) + '</b><small>' + esc(g.genreLabel) + ' × ' + esc(t.label) + '</small>' +
      '<span class="hi">HI-SCORE ' + best(g.id) + '</span></div></a>';
  }).join('');
}

bar.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'dice') {
    var list = visible();
    if (list.length) location.hash = list[Math.floor(Math.random() * list.length)].id;
    return;
  }
  genre = b.dataset.genre;
  renderBar();
  renderShelf();
});

function closeGame() {
  if (current) { current.stop(); current = null; }
  stage.hidden = true;
  stage.innerHTML = '';
  document.body.classList.remove('playing');
  document.getElementById('shelfView').hidden = false;
  renderShelf();
}

function launch(cfg) {
  closeGame();
  var t = cfg.theme;
  stage.style.background = 'linear-gradient(' + t.bg1 + ',' + t.bg2 + ')';
  stage.innerHTML = '<canvas id="game"></canvas><a id="home" class="btn" href="#" aria-label="棚にもどる">🏠</a><button id="mute" class="btn" aria-label="サウンド切り替え">🔊</button>';
  stage.hidden = false;
  document.getElementById('shelfView').hidden = true;
  document.body.classList.add('playing');
  current = NaturaEngine.start(cfg, GENRES[cfg.genre], { serviceWorker: false });
}

function route() {
  var id = location.hash.slice(1);
  var cfg = null;
  for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) cfg = GAMES[i];
  if (cfg) launch(cfg); else closeGame();
}

window.addEventListener('hashchange', route);
renderBar();
route();
})();
</script>`;
}

// fragment: true なら <html>/<head>/<body> を付けない（外側の枠が用意される場所に置く用）
function arcadeHtml({ runtime, genres, games, fragment = false }) {
  const head = arcadeHead();
  const body = arcadeBody({ runtime, genres, games });
  if (fragment) return `${head}\n${body}\n`;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0f0d1f">
<meta name="robots" content="noindex,nofollow">
${head}
</head>
<body>
${body}
</body>
</html>
`;
}

module.exports = { arcadeHtml };
