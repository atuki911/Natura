'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp, buildApp, loadApp, preflight, syncAndroid, TEST_ADS } = require('../factory/app');
const { GENRES } = require('../factory/genres');
const { writeStoreDocs } = require('../factory/store');
const { main } = require('../factory/cli');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'natura-app-'));
}

function quiet(fn) {
  const log = console.log;
  const err = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
    console.error = err;
  }
}

test('全ジャンルでアプリを作れて、8 ワールド入りの HTML がビルドできる', () => {
  const root = tmpRoot();
  for (const genre of Object.keys(GENRES)) {
    const { app } = createApp(root, genre);
    assert.equal(app.genre, genre);
    const r = buildApp(root, genre);
    assert.equal(r.worlds.length, 8);
    const html = fs.readFileSync(path.join(r.www, 'index.html'), 'utf8');
    assert.ok(html.startsWith('<!doctype html>'));
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(scripts.length, 2);
    for (const src of scripts) new Function(src); // 構文チェック
    assert.ok(html.includes(`"genre":"${genre}"`));
    const cap = JSON.parse(fs.readFileSync(path.join(r.dir, 'capacitor.config.json'), 'utf8'));
    assert.equal(cap.appId, app.appId);
    assert.equal(cap.plugins.AdMob.appId, TEST_ADS.appId);
  }
  assert.throws(() => createApp(root, 'stacker'), /もうあります/);
  assert.throws(() => createApp(root, 'nope', { key: 'x' }), /不明なジャンル/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('スタックのワールドは後ろほど難しくなる（tune）', () => {
  const tune = GENRES.stacker.tune;
  const p = { h: 34, width: 200, speed: 200, speedUp: 4, maxSpeed: 420, perfect: 6 };
  const easy = tune(p, 0);
  const hard = tune(p, 1);
  assert.deepEqual(easy, p);
  assert.ok(hard.speed > easy.speed && hard.perfect < easy.perfect && hard.width < easy.width);
});

test('本番前チェック: 初期状態は要修正、全部埋めると OK', () => {
  const root = tmpRoot();
  createApp(root, 'runner', { key: 'run' });
  const { app } = loadApp(root, 'run');
  const issues = preflight(app);
  assert.ok(issues.some((i) => i.includes('テスト')));
  assert.ok(issues.some((i) => i.includes('privacyPolicyUrl')));
  assert.ok(issues.some((i) => i.includes('appId')));
  const ready = {
    ...app,
    appId: 'com.example.run',
    privacyPolicyUrl: 'https://example.com/privacy',
    contactEmail: 'me@example.com',
    ads: { ...app.ads, testing: false, appId: 'ca-app-pub-1~2', rewarded: 'ca-app-pub-1/3', interstitial: 'ca-app-pub-1/4' },
  };
  assert.deepEqual(preflight(ready), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Android 同期: AdMob ID・縦画面・バージョン・署名設定を入れ、何度実行しても同じ', () => {
  const root = tmpRoot();
  const { dir, app } = createApp(root, 'stacker', { key: 'tw' });
  const res = path.join(dir, 'android', 'app', 'src', 'main', 'res', 'values');
  fs.mkdirSync(res, { recursive: true });
  fs.writeFileSync(path.join(res, 'strings.xml'), '<?xml version="1.0"?>\n<resources>\n    <string name="app_name">x</string>\n</resources>\n');
  fs.writeFileSync(
    path.join(dir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    '<manifest>\n    <application>\n        <activity\n            android:name=".MainActivity"\n            android:exported="true">\n        </activity>\n    </application>\n</manifest>\n',
  );
  fs.writeFileSync(
    path.join(dir, 'android', 'app', 'build.gradle'),
    'android {\n    defaultConfig {\n        versionCode 1\n        versionName "1.0"\n    }\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n}\n',
  );
  app.versionCode = 7;
  app.version = '1.2.0';
  assert.equal(syncAndroid(dir, app), true);
  const snapshot = () =>
    ['src/main/res/values/strings.xml', 'src/main/AndroidManifest.xml', 'build.gradle'].map((f) => fs.readFileSync(path.join(dir, 'android', 'app', f), 'utf8'));
  const once = snapshot();
  syncAndroid(dir, app);
  assert.deepEqual(snapshot(), once, '2回目で内容が変わってしまう');
  const [strings, manifest, gradle] = once;
  assert.ok(strings.includes(`<string name="admob_app_id">${TEST_ADS.appId}</string>`));
  assert.ok(manifest.includes('com.google.android.gms.ads.APPLICATION_ID'));
  assert.ok(manifest.includes('android:screenOrientation="portrait"'));
  assert.ok(gradle.includes('versionCode 7') && gradle.includes('versionName "1.2.0"'));
  assert.ok(gradle.includes('signingConfig signingConfigs.release'));
  assert.equal(gradle.split('NATURA_KEYSTORE_PASSWORD').length - 1, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('ストア文書: 掲載文・プライバシーポリシー・データセーフティ', () => {
  const root = tmpRoot();
  createApp(root, 'stacker', { key: 'tw', name: 'テストタワー' });
  const files = writeStoreDocs(root, 'tw');
  assert.equal(files.length, 3);
  const listing = fs.readFileSync(path.join(root, 'apps', 'tw', 'store', 'listing-ja.md'), 'utf8');
  const short = listing.split('## 簡単な説明（80文字以内）\n')[1].split('\n')[0];
  assert.ok(short.length <= 80, `簡単な説明が長すぎる: ${short.length}`);
  assert.ok(listing.includes('テストタワー'));
  const policy = fs.readFileSync(path.join(root, 'apps', 'tw', 'store', 'privacy-policy.html'), 'utf8');
  assert.ok(policy.includes('AdMob') && policy.includes('13 歳未満'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('CLI: app new → build → check → list', () => {
  const root = tmpRoot();
  const r = ['--root', root];
  quiet(() => {
    assert.equal(main(['app', 'new', 'flappy', '--key', 'sky', '--app-id', 'com.example.sky', '--name', 'そらとぶ', ...r]), 0);
    assert.equal(main(['app', 'build', 'sky', ...r]), 0);
    assert.equal(main(['app', 'check', 'sky', ...r]), 0);
    assert.equal(main(['app', 'check', 'sky', '--strict', ...r]), 1);
    assert.equal(main(['app', 'list', ...r]), 0);
    assert.equal(main(['app', 'build', 'nothing', ...r]), 1);
  });
  const app = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'sky', 'app.json'), 'utf8'));
  assert.equal(app.appId, 'com.example.sky');
  assert.equal(app.name, 'そらとぶ');
  fs.rmSync(root, { recursive: true, force: true });
});
