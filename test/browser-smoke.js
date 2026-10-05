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
const { buildGame, buildGallery, buildArcade } = require('../factory/build');
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
  buildArcade(bps, tmp);

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

  // 1ファイル版アーケード: 棚 → ゲーム起動 → 遊ぶ → 棚にもどる → 別のゲーム
  {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/arcade.html');
    await page.screenshot({ path: path.join(shots, 'arcade-shelf.png') });
    const carts = page.locator('.cart');
    const n = await carts.count();
    await carts.nth(0).tap();
    await page.waitForFunction(() => window.__natura && window.__natura.state === 'title');
    const box = await page.locator('#game').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.7);
    await page.waitForFunction(() => window.__natura.state === 'play');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(shots, 'arcade-play.png') });
    await page.locator('#home').tap();
    await page.waitForFunction(() => document.getElementById('stage').hidden && !document.getElementById('shelfView').hidden);
    await carts.nth(n - 1).tap();
    await page.waitForFunction(() => document.querySelectorAll('#stage canvas').length === 1 && window.__natura.state === 'title');
    const ok = errors.length === 0 && n === bps.length;
    if (!ok) failed++;
    console.log(`${ok ? '✅' : '❌'} arcade   ${n} 本の棚から起動・帰還・切り替え${errors.length ? '\n   ' + errors.join('\n   ') : ''}`);
    await page.close();
  }

  // ストア用アプリ（ジャンル別工場）: 遊ぶ → つづきから（テスト広告）→ ホーム → ワールド解放 → インタースティシャル
  {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natura-app-smoke-'));
    const { createApp, buildApp } = require('../factory/app');
    createApp(root, 'stacker', { key: 'tw' });
    const { www } = buildApp(root, 'tw');
    const log = console.log;
    console.log = () => {};
    const appServer = serve(www, 0);
    await new Promise((r) => appServer.on('listening', r));
    console.log = log;
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const steps = [];
    try {
      await page.goto(`http://127.0.0.1:${appServer.address().port}/`);
      await page.locator('#play').tap();
      await page.waitForFunction(() => window.__natura && window.__natura.state === 'title');
      const box = await page.locator('#game').boundingBox();
      const tapAt = (fy) => page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * fy);
      await tapAt(0.7);
      await page.waitForFunction(() => window.__natura.state === 'play');
      // 次のブロックが画面外にあるうちに連打 → 確実にゲームオーバーになる
      for (let i = 0; i < 200 && (await page.evaluate(() => window.__natura.state)) === 'play'; i++) await tapAt(0.5);
      await page.waitForFunction(() => window.__natura.state === 'over' && window.__natura.reviveOffered);
      await page.waitForTimeout(700);
      steps.push('over');
      await tapAt(420 / 640);
      await page.waitForSelector('#adClose:not([disabled])', { timeout: 6000 });
      await page.locator('#adClose').tap();
      await page.waitForFunction(() => window.__natura.state === 'play' && window.__natura.revived);
      steps.push('revive');
      await page.locator('#exit').tap();
      await page.evaluate(() => {
        window.__app.S.coins = 999;
      });
      await page.locator('[data-world="1"]').tap();
      await page.locator('#unlock').tap();
      await page.waitForFunction(() => window.__app.S.unlocked[1] === true && window.__app.S.selected === 1);
      steps.push('unlock');
      // インタースティシャル: 猶予回数を過ぎた状態にしてからリトライ
      await page.evaluate(() => {
        Object.assign(window.__app.S, { games: 99, sinceInter: 99, lastInter: 0 });
      });
      await page.locator('#play').tap();
      await page.waitForFunction(() => window.__natura && window.__natura.state === 'title');
      await tapAt(0.7);
      await page.waitForFunction(() => window.__natura.state === 'play');
      // 次のブロックが画面外にあるうちに連打 → 確実にゲームオーバーになる
      for (let i = 0; i < 200 && (await page.evaluate(() => window.__natura.state)) === 'play'; i++) await tapAt(0.5);
      await page.waitForTimeout(700);
      await tapAt(488 / 640); // リトライ
      await page.waitForSelector('#adMock:not([hidden])', { timeout: 3000 });
      steps.push('interstitial');
      await page.screenshot({ path: path.join(shots, 'app-ad.png') });
    } catch (e) {
      const st = await page.evaluate(() => JSON.stringify(window.__natura && { state: window.__natura.state, offer: window.__natura.reviveOffered })).catch(() => '?');
      errors.push(`${e.message.split('\n')[0]}（${steps.length + 1} 段階目, ${st}）`);
    }
    const ok = errors.length === 0 && steps.length === 4;
    if (!ok) failed++;
    console.log(`${ok ? '✅' : '❌'} app      ${steps.join(' → ')}${errors.length ? '\n   ' + errors.join('\n   ') : ''}`);
    await page.close();
    appServer.close();
    fs.rmSync(root, { recursive: true, force: true });
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
