'use strict';

/*
 * 実ブラウザ（スマホ表示をエミュレート）で全ジャンルを起動し、
 * JS エラーが出ないこと・タップで遊べること・ゲームオーバーまで進むことを確認する。
 * スクリーンショットは test-results/ に保存される。
 *
 *   npm i -D playwright   （未インストールならこのテストはスキップ）
 *   npm run test:browser
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { GENRES } = require('../factory/genres');
const { resolveSpec } = require('../factory/spec');
const { buildGame, buildGallery } = require('../factory/build');
const { serve } = require('../factory/serve');

let playwright;
try {
  playwright = require('playwright');
} catch {
  console.log('⏭️  playwright が見つからないためスキップします（npm i -D playwright）');
  process.exit(0);
}

const THEMES_FOR = { runner: 'dino', flappy: 'space', catcher: 'ocean', dodger: 'ninja', tapper: 'forest', stacker: 'candy' };

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'natura-smoke-'));
  const shots = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(shots, { recursive: true });
  const bps = Object.keys(GENRES).map((genre) => resolveSpec({ genre, theme: THEMES_FOR[genre] || 'space', seed: 2026 }));
  for (const bp of bps) buildGame(bp, tmp);
  buildGallery(bps, tmp);

  const log = console.log;
  console.log = () => {};
  const server = serve(tmp, 0);
  await new Promise((r) => server.on('listening', r));
  console.log = log;
  const base = `http://127.0.0.1:${server.address().port}`;

  const launch = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await playwright.chromium.launch(launch);
  const context = await browser.newContext({ ...playwright.devices['Pixel 7'], serviceWorkers: 'block' });
  let failed = 0;

  const gallery = await context.newPage();
  await gallery.goto(base + '/');
  await gallery.screenshot({ path: path.join(shots, 'gallery.png') });
  await gallery.close();

  for (const bp of bps) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${base}/${bp.slug}/`);
    await page.waitForFunction(() => window.__natura && window.__natura.state === 'title');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, `${bp.genre}-1-title.png`) });

    const box = await page.locator('#game').boundingBox();
    const tap = (fx, fy) => page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
    await tap(0.5, 0.7);
    await page.waitForFunction(() => window.__natura.state === 'play');
    for (let i = 0; i < 6; i++) {
      await tap(0.2 + 0.6 * Math.random(), 0.35 + 0.5 * Math.random());
      await page.waitForTimeout(250);
    }
    await page.screenshot({ path: path.join(shots, `${bp.genre}-2-play.png`) });

    // ゲームオーバーまで放置 or 連打（最大 60 秒）
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline && (await page.evaluate(() => window.__natura.state)) === 'play') {
      await tap(Math.random(), 0.3 + 0.6 * Math.random());
      await page.waitForTimeout(120);
    }
    const state = await page.evaluate(() => ({ s: window.__natura.state, score: window.__natura.score, best: window.__natura.best }));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(shots, `${bp.genre}-3-over.png`) });

    const ok = errors.length === 0 && state.s === 'over';
    if (!ok) failed++;
    console.log(`${ok ? '✅' : '❌'} ${bp.genre.padEnd(8)} ${bp.title}  state=${state.s} score=${state.score} best=${state.best}${errors.length ? '\n   ' + errors.join('\n   ') : ''}`);
    await page.close();
  }

  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n📸 スクリーンショット: ${path.relative(process.cwd(), shots)}/`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
