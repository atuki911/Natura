'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCore } = require('../factory/engine/runtime');
const { GENRES } = require('../factory/genres');
const { THEMES } = require('../factory/themes');
const { resolveSpec, runtimeConfig, planBatch } = require('../factory/spec');
const { buildGame, buildGallery, buildArcade, arcadeSource, saveBlueprint, loadBlueprints, gameSource } = require('../factory/build');
const { main } = require('../factory/cli');

// どんな描画命令も受け付けるダミーの CanvasRenderingContext2D
function stubCtx() {
  const base = {
    measureText: (s) => ({ width: String(s).length * 14 }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
}

// HTML に埋め込まれるのと同じく、ソース文字列から関数を作り直す（外側スコープ参照があればここで落ちる）
function compile(genreId) {
  return new Function(`return (${gameSource(genreId)});`)();
}

// オートパイロットで遊ばせる。ゲームの状態遷移・例外・スコアの健全性を確認する
function simulate(bp, { seconds = 90, seed = 1, tapRate = 2.5 } = {}) {
  const cfg = runtimeConfig(bp);
  const core = createCore(cfg, compile(bp.genre), { seed, storage: null });
  const ctx = stubCtx();
  const dt = 1 / 60;
  let rnd = seed;
  const next = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
  const scores = [];
  core.input.pressed = true; // タイトル画面でタップ
  for (let f = 0; f < seconds * 60; f++) {
    if (next() < tapRate * dt) {
      core.input.pressed = true;
      core.input.x = next() * 360;
      core.input.y = 160 + next() * 440;
    } else {
      core.input.x += (next() - 0.5) * 30;
    }
    const before = core.state;
    core.update(dt);
    if (before === 'play' && core.state === 'over') scores.push(core.score);
    core.draw(ctx);
    assert.ok(Number.isFinite(core.score), `score が数値でない: ${core.score}`);
  }
  return { core, scores };
}

test('全ジャンル×全テーマが設計図から解決できる', () => {
  for (const genre of Object.keys(GENRES)) {
    for (const theme of Object.keys(THEMES)) {
      const bp = resolveSpec({ genre, theme, seed: 123 });
      assert.equal(bp.genre, genre);
      assert.equal(bp.theme, theme);
      assert.match(bp.slug, /^[a-z0-9-]+$/);
      assert.ok(bp.title.length > 0);
      for (const [k, v] of Object.entries(bp.params)) assert.ok(typeof v === 'boolean' || Number.isFinite(v), `${genre}.${k}=${v}`);
    }
  }
});

test('同じシードからは同じゲームができる', () => {
  assert.deepEqual(resolveSpec({ seed: 99 }), resolveSpec({ seed: 99 }));
  assert.notDeepEqual(resolveSpec({ seed: 99 }), resolveSpec({ seed: 100 }));
});

test('注文書の指定が優先される', () => {
  const bp = resolveSpec({ genre: 'stacker', theme: 'candy', seed: 5, title: 'テスト', slug: 'my-game', params: { perfect: 10 } });
  assert.equal(bp.title, 'テスト');
  assert.equal(bp.slug, 'my-game');
  assert.equal(bp.params.perfect, 10);
  assert.throws(() => resolveSpec({ genre: 'nope' }), /不明なジャンル/);
  assert.throws(() => resolveSpec({ slug: 'Bad Slug!' }), /slug/);
});

test('量産計画はジャンル×テーマの組み合わせをなるべく重複させない', () => {
  const nCombos = Object.keys(GENRES).length * Object.keys(THEMES).length;
  const specs = planBatch(nCombos, { seed: 7 });
  const combos = new Set(specs.map((s) => `${s.genre}/${s.theme}`));
  assert.equal(combos.size, nCombos);
  assert.deepEqual(planBatch(5, { seed: 7 }), planBatch(5, { seed: 7 }));
  const only = planBatch(10, { seed: 1, genres: ['runner'], themes: ['space', 'ocean'] });
  assert.ok(only.every((s) => s.genre === 'runner' && ['space', 'ocean'].includes(s.theme)));
});

for (const genre of Object.keys(GENRES)) {
  test(`シミュレーション: ${genre} は全テーマで例外なく遊べてリトライできる`, () => {
    for (const theme of Object.keys(THEMES)) {
      for (const seed of [1, 2, 3]) {
        const bp = resolveSpec({ genre, theme, seed });
        const { core, scores } = simulate(bp, { seconds: 60, seed });
        assert.ok(core.plays >= 1, `${bp.slug}: ゲームが始まらない`);
        assert.ok(scores.every((s) => s >= 0), `${bp.slug}: スコアが負`);
        if (scores.length) assert.ok(core.best >= Math.max(...scores), `${bp.slug}: ベストスコアが更新されない`);
      }
    }
  });
}

test('収益化フック: 全ジャンルで「つづきから」が動き、コインは二重に数えない', () => {
  for (const genre of Object.keys(GENRES)) {
    const bp = resolveSpec({ genre, theme: 'city', seed: 21 });
    const rate = GENRES[genre].coinRate;
    assert.ok(rate > 0, `${genre}.coinRate`);
    let credited = 0;
    let revives = 0;
    let restarts = 0;
    const core = createCore(runtimeConfig(bp), compile(genre), {
      seed: 3,
      rewardFor: (score) => score * rate,
      canRevive: () => true,
      onRevive: (done) => {
        revives++;
        done(true);
      },
      beforeRestart: (done) => {
        restarts++;
        done();
      },
      onGameOver: (score, coins) => {
        credited += coins;
      },
    });
    const ctx = stubCtx();
    const tap = (y) => {
      core.input.pressed = true;
      core.input.x = 180;
      core.input.y = y;
    };
    tap(400);
    let phase = 'first';
    for (let f = 0; f < 60 * 400 && phase !== 'done'; f++) {
      if (core.state === 'play' && f % 23 === 0) tap(160 + (f % 400));
      if (core.state === 'over' && core.stateTime > 0.7) {
        if (phase === 'first') {
          assert.ok(core.reviveOffered, `${genre}: つづきからが出ない`);
          tap(420); // つづきからボタン
          phase = 'revived';
        } else {
          assert.ok(!core.reviveOffered, `${genre}: 2回目のつづきからが出てしまう`);
          assert.equal(credited, Math.floor(core.score * rate), `${genre}: コインの合計がずれている`);
          tap(300); // ボタン以外 → リトライ（つづきから無しなので画面のどこでも）
          phase = 'retry';
        }
      }
      core.update(1 / 60);
      core.draw(ctx);
      if (phase === 'retry' && core.state === 'play') phase = 'done';
    }
    assert.equal(phase, 'done', `${genre}: 復活→ゲームオーバー→リトライまで進まない`);
    assert.equal(revives, 1);
    assert.equal(restarts, 1);
  }
});

test('ランダムタップだけでもゲームオーバーになりうる（無限に終わらないゲームがない）', () => {
  for (const genre of Object.keys(GENRES)) {
    const bp = resolveSpec({ genre, theme: 'space', seed: 11 });
    const { scores } = simulate(bp, { seconds: 240, seed: 4, tapRate: 3 });
    assert.ok(scores.length >= 1, `${genre}: 4分間ランダムに操作してもゲームオーバーにならない`);
  }
});

test('ビルド: HTML/マニフェスト/アイコン/SW とギャラリーが出力される', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'natura-'));
  const games = path.join(tmp, 'games');
  const out = path.join(tmp, 'dist');
  const bps = planBatch(6, { seed: 3 }).map(resolveSpec);
  for (const bp of bps) {
    saveBlueprint(bp, games);
    buildGame(bp, out);
    const dir = path.join(out, bp.slug);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('NaturaEngine.start('));
    assert.ok(html.includes('<meta name="viewport"'));
    assert.ok(!/<\/script>[\s\S]*<\/script>[\s\S]*<\/script>/.test(html), 'script タグが壊れている');
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.display, 'fullscreen');
    assert.ok(fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8').startsWith('<svg'));
    assert.ok(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8').includes(`natura-${bp.slug}:`));
  }
  const loaded = loadBlueprints(games);
  assert.deepEqual(loaded.map((b) => b.slug).sort(), bps.map((b) => b.slug).sort());
  const entries = buildGallery(loaded, out);
  assert.equal(entries.length, 6);
  const gallery = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  for (const bp of bps) assert.ok(gallery.includes(`href="${bp.slug}/"`));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('ビルド済み HTML の中身をそのまま実行できる', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'natura-'));
  for (const genre of Object.keys(GENRES)) {
    const bp = resolveSpec({ genre, theme: 'ninja', seed: 8, title: '</script><b>"危険"な名前' });
    buildGame(bp, tmp);
    const html = fs.readFileSync(path.join(tmp, bp.slug, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(scripts.length, 2);
    let started = null;
    const fakeWindow = { NaturaEngine: null };
    new Function('window', 'globalThis', 'module', scripts[0])(fakeWindow, fakeWindow, undefined);
    fakeWindow.NaturaEngine.start = (cfg, GAME) => (started = { cfg, GAME });
    new Function('NaturaEngine', scripts[1])(fakeWindow.NaturaEngine);
    assert.equal(started.cfg.title, '</script><b>"危険"な名前');
    const core = fakeWindow.NaturaEngine.createCore(started.cfg, started.GAME, { seed: 1 });
    core.input.pressed = true;
    for (let i = 0; i < 120; i++) {
      core.update(1 / 60);
      core.draw(stubCtx());
    }
    assert.equal(core.plays, 1);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('1ファイル版アーケード: 全ゲーム入り・スクリプトが正しく、エンジンは1回だけ埋め込まれる', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'natura-'));
  const bps = planBatch(12, { seed: 5 }).map(resolveSpec);
  bps.push(resolveSpec({ genre: 'runner', theme: 'city', seed: 1, title: '</script><img src=x onerror=alert(1)>' }));
  const { file } = buildArcade(bps, tmp);
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('noindex'));
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 2, 'タイトルに </script> があっても script タグが壊れない');
  for (const src of scripts) new Function(src); // 構文チェック
  assert.equal(html.split('var NaturaEngine =').length - 1, 1);
  for (const bp of bps) assert.ok(html.includes(JSON.stringify(bp.slug)), bp.slug);
  const fragment = arcadeSource(bps, { fragment: true });
  assert.ok(!/<html|<body|<!doctype/i.test(fragment));
  assert.ok(fragment.trimStart().startsWith('<title>'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('CLI: batch → rebuild → remove が動く', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'natura-'));
  const opts = ['--games', path.join(tmp, 'games'), '--out', path.join(tmp, 'dist')];
  const log = console.log;
  console.log = () => {};
  try {
    assert.equal(main(['batch', '-n', '4', '--seed', '1', ...opts]), 0);
    const slugs = loadBlueprints(path.join(tmp, 'games')).map((b) => b.slug);
    assert.equal(slugs.length, 4);
    assert.equal(main(['rebuild', ...opts]), 0);
    assert.equal(main(['remove', slugs[0], ...opts]), 0);
    assert.equal(loadBlueprints(path.join(tmp, 'games')).length, 3);
    assert.ok(!fs.existsSync(path.join(tmp, 'dist', slugs[0])));
    assert.equal(main(['new', '--genre', 'flappy', '--theme', 'winter', '--seed', '3', ...opts]), 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'dist', 'catalog.json'), 'utf8')).length, 4);
    assert.ok(fs.existsSync(path.join(tmp, 'dist', 'arcade.html')));
    const err = console.error;
    console.error = () => {};
    try {
      assert.equal(main(['new', '--genre', 'nope', ...opts]), 1);
    } finally {
      console.error = err;
    }
  } finally {
    console.log = log;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
