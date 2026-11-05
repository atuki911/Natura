// 実際のブラウザでゲームを動かし、決まった場面の画面を撮る。
// 使い方:
//   npm run screenshot                     … 決まった場面をまとめて screenshots/ に撮る
//   npm run screenshot -- --url "?autoplay&wave=10&speed=3" --wait 8000 --name boss
// 撮った画像は Claude Code が開いて、見た目の崩れを確かめる。
// ブラウザのエラーが出たら最後に一覧にして、失敗として終わる。

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// playwright はプロジェクトに入っていればそれを、無ければ全体に入っているものを使う。
const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const outDir = resolve(opt('out', 'screenshots'));
mkdirSync(outDir, { recursive: true });

const scenes = opt('url', null)
  ? [{ name: opt('name', 'shot'), url: opt('url'), wait: Number(opt('wait', 5000)) }]
  : [
      { name: '01-title', url: '?', wait: 6000 },
      { name: '02-early', url: '?autoplay&seed=2&speed=2', wait: 9000 },
      { name: '03-midgame', url: '?autoplay&seed=3&wave=6&speed=2', wait: 14000 },
      { name: '04-boss', url: '?autoplay&seed=4&wave=10&speed=2', wait: 16000 },
    ];

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(opt('scale', 1)) });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

for (const scene of scenes) {
  await page.goto(`${base}${scene.url}`);
  await page.waitForTimeout(scene.wait);
  const file = resolve(outDir, `${scene.name}.png`);
  await page.screenshot({ path: file });
  console.log(`撮影: ${file}`);
}

await browser.close();
await server.close();

if (errors.length) {
  console.error('\nブラウザのエラー:');
  for (const e of [...new Set(errors)]) console.error(`  ${e}`);
  process.exit(1);
}
