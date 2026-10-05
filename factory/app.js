'use strict';

/*
 * ジャンル別アプリ工場。
 *
 * 1 ジャンル = 1 アプリ。テーマ 8 種を「ワールド」として順番に解放していく、
 * ストアに出せる深さのあるアプリ（コイン・ワールド解放・デイリー・広告・課金）を組み立てる。
 *
 *   apps/<key>/app.json        アプリの設定（アプリID・名前・広告ID・課金ID・価格表）← 人が編集する
 *   apps/<key>/worlds.json     ワールドの設計図（シードから生成。固定して git 管理）
 *   apps/<key>/www/            ビルド結果（Capacitor がアプリに詰める中身）
 *   apps/<key>/android/        Android プロジェクト（npx cap add android で生成）
 */
const fs = require('fs');
const path = require('path');
const { GENRES } = require('./genres');
const { THEMES } = require('./themes');
const { resolveSpec, runtimeConfig, rng } = require('./spec');
const { gameSource } = require('./build');
const { appShellHtml } = require('./templates/app-shell');

const RUNTIME = fs.readFileSync(path.join(__dirname, 'engine', 'runtime.js'), 'utf8');

// やさしい世界 → むずかしい世界 の並び
const WORLD_ORDER = ['candy', 'forest', 'ocean', 'winter', 'city', 'dino', 'ninja', 'space'];

// Google 公式のテスト用広告 ID（本番前に必ず自分の ID に差し替える）
const TEST_ADS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
};

const APP_NAMES = {
  runner: 'ダッシュ・ワールド',
  flappy: 'パタパタ・スカイ',
  catcher: 'キャッチ・パラダイス',
  dodger: 'よけよけサバイバル',
  tapper: 'タップ・パニック',
  stacker: 'つみつみタワー',
};

function defaultAppConfig(genre, key, opts = {}) {
  return {
    appId: opts.appId || `io.github.natura.${key.replace(/[^a-z0-9]/g, '')}`,
    name: opts.name || APP_NAMES[genre] || GENRES[genre].label,
    genre,
    version: '1.0.0',
    versionCode: 1,
    seed: opts.seed ?? 2026,
    privacyPolicyUrl: '',
    contactEmail: '',
    ads: {
      testing: true,
      ...TEST_ADS,
      maxAdContentRating: 'General',
      interstitialEvery: 3,
      interstitialMinSeconds: 90,
      graceGames: 5,
    },
    iap: { removeAds: 'remove_ads' },
    economy: {
      unlockCost: [0, 60, 120, 180, 260, 340, 440, 560],
      bonusCoins: 30,
      bonusCooldownMinutes: 30,
      dailyMultiplier: 2,
    },
  };
}

// ワールド k（0 始まり）ほど難しくなるようにパラメータを調整する。ジャンルが tune を持っていれば使う
function planWorlds(app) {
  const genre = GENRES[app.genre];
  const r = rng(app.seed >>> 0);
  return WORLD_ORDER.filter((t) => THEMES[t]).map((theme, k, all) => {
    const bp = resolveSpec({ genre: app.genre, theme, seed: (r.rand() * 4294967296) >>> 0 });
    if (genre.tune) bp.params = genre.tune(bp.params, k / Math.max(1, all.length - 1));
    bp.slug = `${app.key}-w${k + 1}-${theme}`;
    return bp;
  });
}

function appDir(root, key) {
  return path.join(root, 'apps', key);
}

function capacitorConfig(app) {
  return {
    appId: app.appId,
    appName: app.name,
    webDir: 'www',
    backgroundColor: '#0f0d1f',
    android: { webContentsDebuggingEnabled: false },
    plugins: {
      AdMob: { appId: app.ads.appId },
    },
  };
}

function packageJson(app) {
  return {
    name: `natura-app-${app.key}`,
    version: app.version,
    private: true,
    description: `${app.name}（Natura ジャンル別工場で生産）`,
    scripts: {
      build: `node ../../factory/cli.js app build ${app.key}`,
      sync: 'npm run build && npx cap sync android',
      open: 'npx cap open android',
    },
    dependencies: {
      '@capacitor-community/admob': '^8.0.0',
      '@capacitor/android': '^8.0.0',
      '@capacitor/app': '^8.0.0',
      '@capacitor/core': '^8.0.0',
      'cordova-plugin-purchase': '^13.18.0',
    },
    devDependencies: {
      '@capacitor/cli': '^8.0.0',
    },
  };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function createApp(root, genre, opts = {}) {
  if (!GENRES[genre]) throw new Error(`不明なジャンル: ${genre}（使えるもの: ${Object.keys(GENRES).join(', ')}）`);
  const key = opts.key || genre;
  if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new Error(`アプリのキーは英小文字・数字・ハイフンのみ: ${key}`);
  const dir = appDir(root, key);
  if (fs.existsSync(path.join(dir, 'app.json')) && !opts.force) throw new Error(`apps/${key} はもうあります（作り直すなら --force）`);
  const app = { key, ...defaultAppConfig(genre, key, opts) };
  writeJson(path.join(dir, 'app.json'), app);
  writeJson(path.join(dir, 'worlds.json'), planWorlds(app));
  writeJson(path.join(dir, 'package.json'), packageJson(app));
  writeJson(path.join(dir, 'capacitor.config.json'), capacitorConfig(app));
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\nwww/\n');
  return { dir, app };
}

function loadApp(root, key) {
  const dir = appDir(root, key);
  const file = path.join(dir, 'app.json');
  if (!fs.existsSync(file)) throw new Error(`apps/${key}/app.json がありません（先に: node factory/cli.js app new <ジャンル>）`);
  const app = readJson(file);
  const worlds = readJson(path.join(dir, 'worlds.json'));
  return { dir, app, worlds };
}

function appSource(app, worlds) {
  const genre = GENRES[app.genre];
  return appShellHtml({
    runtime: RUNTIME,
    gameSource: gameSource(app.genre),
    app: {
      key: app.key,
      id: app.appId,
      name: app.name,
      version: app.version,
      genre: app.genre,
      genreLabel: genre.label,
      coinRate: genre.coinRate || 1,
      privacyPolicyUrl: app.privacyPolicyUrl,
      contactEmail: app.contactEmail,
      ads: app.ads,
      iap: app.iap,
      economy: app.economy,
    },
    worlds: worlds.map(runtimeConfig),
  });
}

// Android プロジェクト（npx cap add android で生成済みのもの）を app.json に合わせる。何度実行しても同じ結果になる
function syncAndroid(dir, app) {
  const android = path.join(dir, 'android', 'app');
  if (!fs.existsSync(android)) return false;
  const edit = (rel, fn) => {
    const file = path.join(android, rel);
    const before = fs.readFileSync(file, 'utf8');
    const after = fn(before);
    if (after !== before) fs.writeFileSync(file, after);
  };
  const xml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // AdMob のアプリ ID（無いと起動時に落ちる）
  edit('src/main/res/values/strings.xml', (t) => {
    const line = `<string name="admob_app_id">${xml(app.ads.appId)}</string>`;
    return /<string name="admob_app_id">/.test(t)
      ? t.replace(/<string name="admob_app_id">[^<]*<\/string>/, line)
      : t.replace('</resources>', `    ${line}\n</resources>`);
  });
  edit('src/main/AndroidManifest.xml', (t) => {
    if (!t.includes('com.google.android.gms.ads.APPLICATION_ID')) {
      t = t.replace(
        '        <activity',
        '        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="@string/admob_app_id" />\n\n        <activity',
      );
    }
    // ゲームは縦画面専用
    if (!t.includes('android:screenOrientation')) t = t.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
    return t;
  });
  edit('build.gradle', (t) => {
    t = t.replace(/versionCode \d+/, `versionCode ${app.versionCode}`).replace(/versionName "[^"]*"/, `versionName "${app.version}"`);
    if (!t.includes('NATURA_KEYSTORE')) {
      // 署名鍵は環境変数（CI のシークレット）から読む。鍵ファイルやパスワードはリポジトリに入れない
      t = t.replace(
        '    buildTypes {',
        [
          '    signingConfigs {',
          '        release {',
          '            if (System.getenv("NATURA_KEYSTORE")) {',
          '                storeFile file(System.getenv("NATURA_KEYSTORE"))',
          '                storePassword System.getenv("NATURA_KEYSTORE_PASSWORD")',
          '                keyAlias System.getenv("NATURA_KEY_ALIAS")',
          '                keyPassword System.getenv("NATURA_KEY_PASSWORD")',
          '            }',
          '        }',
          '    }',
          '    buildTypes {',
        ].join('\n'),
      );
      t = t.replace(
        '        release {\n            minifyEnabled false',
        '        release {\n            if (System.getenv("NATURA_KEYSTORE")) signingConfig signingConfigs.release\n            minifyEnabled false',
      );
    }
    return t;
  });
  return true;
}

// apps/<key>/www/ を作り、Capacitor の設定もアプリ設定に合わせて更新する
function buildApp(root, key) {
  const { dir, app, worlds } = loadApp(root, key);
  if (!GENRES[app.genre]) throw new Error(`不明なジャンル: ${app.genre}`);
  const www = path.join(dir, 'www');
  fs.mkdirSync(www, { recursive: true });
  const html = appSource(app, worlds);
  fs.writeFileSync(path.join(www, 'index.html'), html);
  writeJson(path.join(dir, 'capacitor.config.json'), capacitorConfig(app));
  const android = syncAndroid(dir, app);
  return { dir, www, app, worlds, android, bytes: Buffer.byteLength(html) };
}

function listApps(root) {
  const base = path.join(root, 'apps');
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((k) => fs.existsSync(path.join(base, k, 'app.json')))
    .map((k) => readJson(path.join(base, k, 'app.json')));
}

// 本番前チェック。ストアに出す前に直すべきことを並べる
function preflight(app) {
  const issues = [];
  if (app.ads.testing) issues.push('ads.testing が true（テスト広告のまま）');
  if (app.ads.appId === TEST_ADS.appId) issues.push('ads.appId がテスト用 ID のまま');
  if (app.ads.rewarded === TEST_ADS.rewarded) issues.push('ads.rewarded がテスト用 ID のまま');
  if (app.ads.interstitial === TEST_ADS.interstitial) issues.push('ads.interstitial がテスト用 ID のまま');
  if (!/^https:\/\//.test(app.privacyPolicyUrl || '')) issues.push('privacyPolicyUrl が未設定（ストア審査で必須）');
  if (!app.contactEmail) issues.push('contactEmail が未設定（ストア掲載で必須）');
  if (/^io\.github\.natura\./.test(app.appId)) issues.push(`appId が仮のまま（${app.appId}）。公開後は二度と変えられないので自分のものに`);
  return issues;
}

module.exports = { createApp, loadApp, buildApp, syncAndroid, appSource, listApps, preflight, planWorlds, TEST_ADS, WORLD_ORDER };
