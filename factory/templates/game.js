'use strict';

const { escapeHtml, inlineJson } = require('./util');

function gameHtml({ cfg, runtime, gameSource }) {
  const t = cfg.theme;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="${t.bg2}">
<meta name="robots" content="noindex,nofollow">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${escapeHtml(cfg.title)}">
<meta name="description" content="${escapeHtml(cfg.howto)}">
<title>${escapeHtml(cfg.title)}</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon.svg">
<style>
html,body{margin:0;height:100%;overflow:hidden;background:${t.bg2};background-image:linear-gradient(${t.bg1},${t.bg2});touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
body{display:flex;align-items:center;justify-content:center}
canvas{display:block;touch-action:none}
.btn{position:fixed;top:max(10px,env(safe-area-inset-top));width:40px;height:40px;border:0;border-radius:50%;background:rgba(0,0,0,.25);color:#fff;font-size:20px;line-height:40px;text-align:center;text-decoration:none;cursor:pointer;z-index:2}
#mute{right:10px}
#home{right:58px}
</style>
</head>
<body>
<canvas id="game"></canvas>
<a id="home" class="btn" href="../" aria-label="ゲーム一覧へ">🏠</a>
<button id="mute" class="btn" aria-label="サウンド切り替え">🔊</button>
<script>
${runtime}
</script>
<script>
NaturaEngine.start(${inlineJson(cfg)}, ${gameSource});
</script>
</body>
</html>
`;
}

function manifest(cfg) {
  const t = cfg.theme;
  return JSON.stringify(
    {
      name: cfg.title,
      short_name: cfg.title.length > 12 ? cfg.title.slice(0, 12) : cfg.title,
      description: cfg.howto,
      lang: 'ja',
      start_url: './',
      scope: './',
      display: 'fullscreen',
      orientation: 'portrait',
      background_color: t.bg2,
      theme_color: t.bg2,
      icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    null,
    2,
  );
}

function iconSvg(cfg) {
  const t = cfg.theme;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="url(#g)"/>
<text x="256" y="300" font-size="280" text-anchor="middle" dominant-baseline="middle">${t.player}</text>
</svg>
`;
}

function serviceWorker(cacheName) {
  return `const CACHE = ${JSON.stringify(cacheName)};
const PREFIX = CACHE.split(':')[0] + ':';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
`;
}

module.exports = { gameHtml, manifest, iconSvg, serviceWorker };
