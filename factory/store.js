'use strict';

/*
 * ストア提出キット生成。
 *
 *   apps/<key>/store/                 ← Google Play Console にアップロードするもの
 *     icon-512.png                    アプリアイコン（512x512）
 *     feature-1024x500.png            フィーチャーグラフィック
 *     screenshots/phone-*.png         スマホのスクリーンショット（1080x1920）
 *     listing-ja.md                   タイトル・説明文
 *     privacy-policy.html             プライバシーポリシー（公開 URL に置く）
 *     data-safety.md                  データセーフティ欄の答え方
 *   apps/<key>/android/.../res/       ランチャーアイコンとスプラッシュ画面（Capacitor の初期画像を置き換え）
 *
 * 画像はヘッドレス Chromium（playwright）で描くので、playwright が必要。
 */
const fs = require('fs');
const path = require('path');
const { GENRES } = require('./genres');
const { loadApp, buildApp } = require('./app');
const { runtimeConfig } = require('./spec');
const { serve } = require('./serve');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const TAGLINES = {
  stacker: { short: 'タップでブロックをつみあげて、どこまで高くできるかな？', hook: 'タイミングよくタップ！' },
  runner: { short: 'タップでジャンプ！障害物をよけて走りつづけよう', hook: 'タップでジャンプ！' },
  flappy: { short: 'タップではばたいて、すきまをくぐりぬけよう', hook: 'タップではばたけ！' },
  catcher: { short: '指でうごかして、いいものだけをキャッチ！', hook: '指でキャッチ！' },
  dodger: { short: '降ってくるものを指でよけつづけるサバイバル', hook: 'よけてよけて生きのこれ！' },
  tapper: { short: 'でてきた仲間をすばやくタップ！敵はさわっちゃダメ', hook: 'すばやくタップ！' },
};

// ブラウザの中で canvas に描く関数（文字列化して渡すので外側の変数は使わない）
function painter() {
  window.paint = function (spec) {
    const c = document.createElement('canvas');
    c.width = spec.w;
    c.height = spec.h;
    const g = c.getContext('2d');
    const E = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
    const F = '"Noto Sans CJK JP","Noto Sans JP","Hiragino Sans",sans-serif';
    const grad = (a, b) => {
      const gr = g.createLinearGradient(0, 0, 0, spec.h);
      gr.addColorStop(0, a);
      gr.addColorStop(1, b);
      return gr;
    };
    const emoji = (ch, x, y, size) => {
      g.font = size + 'px ' + E;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#000';
      g.fillText(ch, x, y + size * 0.06);
    };
    const blocks = (cx, top, w, n, unit) => {
      for (let i = 0; i < n; i++) {
        const bw = w * (1 - i * 0.12);
        const y = top + (n - 1 - i) * unit;
        g.fillStyle = spec.palette[i % spec.palette.length];
        g.beginPath();
        g.roundRect(cx - bw / 2 + (i % 2 ? unit * 0.15 : -unit * 0.1), y, bw, unit * 0.9, unit * 0.18);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(cx - bw / 2 + unit * 0.1, y + unit * 0.1, bw - unit * 0.4, unit * 0.12);
      }
    };
    // 主役の絵: スタック系はブロックの上にキャラ、それ以外はキャラだけ
    const hero = (cx, cy, s) => {
      if (spec.genre === 'stacker') {
        // 全体の高さ ≒ 0.94s を (cx, cy) の中央に収める: キャラ 0.42s ＋ ブロック 3 段 × 0.17s
        blocks(cx, cy - s * 0.05, s * 0.9, 3, s * 0.17);
        emoji(spec.player, cx, cy - s * 0.27, s * 0.42);
      } else {
        emoji(spec.player, cx, cy, s * 0.7);
      }
    };

    if (spec.kind === 'background') {
      g.fillStyle = grad(spec.bg1, spec.bg2);
      g.fillRect(0, 0, spec.w, spec.h);
    } else if (spec.kind === 'icon' || spec.kind === 'round') {
      const s = spec.w;
      if (spec.kind === 'round') {
        g.beginPath();
        g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
        g.clip();
      }
      g.fillStyle = grad(spec.bg1, spec.bg2);
      g.fillRect(0, 0, s, s);
      hero(s / 2, s * 0.52, s * 0.82);
    } else if (spec.kind === 'foreground') {
      // アダプティブアイコンの前景: 中央 66/108 が安全域
      const s = spec.w;
      hero(s / 2, s * 0.52, s * 0.56);
    } else if (spec.kind === 'splash') {
      g.fillStyle = grad(spec.bg1, spec.bg2);
      g.fillRect(0, 0, spec.w, spec.h);
      const s = Math.min(spec.w, spec.h) * 0.42;
      hero(spec.w / 2, spec.h / 2, s);
    } else if (spec.kind === 'feature') {
      g.fillStyle = grad(spec.bg1, spec.bg2);
      g.fillRect(0, 0, spec.w, spec.h);
      for (let i = 0; i < 14; i++) {
        g.globalAlpha = 0.18;
        emoji(spec.deco, (i * 173) % spec.w, (i * 97) % spec.h, 40 + (i % 3) * 14);
      }
      g.globalAlpha = 1;
      hero(spec.w * 0.76, spec.h * 0.5, spec.h * 0.8);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      let size = 92;
      do {
        g.font = '900 ' + size + 'px ' + F;
        size -= 4;
      } while (g.measureText(spec.name).width > spec.w * 0.52 && size > 40);
      g.lineWidth = 14;
      g.strokeStyle = 'rgba(18,15,36,0.55)';
      g.strokeText(spec.name, 56, spec.h * 0.42);
      g.fillStyle = '#fff';
      g.fillText(spec.name, 56, spec.h * 0.42);
      g.font = '700 38px ' + F;
      g.lineWidth = 8;
      g.strokeText(spec.hook, 60, spec.h * 0.66);
      g.fillStyle = '#ffcf3f';
      g.fillText(spec.hook, 60, spec.h * 0.66);
    }
    return c.toDataURL('image/png');
  };
}

function savePng(file, dataUrl) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

function listingText(app, worlds) {
  const t = TAGLINES[app.genre] || { short: GENRES[app.genre].howto, hook: GENRES[app.genre].howto };
  const worldLines = worlds.map((w, i) => `・ワールド${i + 1} ${w.theme.player} ${w.theme.label}`).join('\n');
  return `# ${app.name} — ストア掲載文（Google Play Console にコピペ）

## アプリ名（30文字以内）
${app.name}

## 簡単な説明（80文字以内）
${t.short}

## 詳しい説明（4000文字以内）
${t.hook} ひとつの指で遊べる、かんたんだけど奥が深いゲームです。

■ あそびかた
${GENRES[app.genre].howto}

■ 8 つのワールド
遊んでコインを集めると、新しいワールドが解放されます。先のワールドほど手ごわくなります。
${worldLines}

■ 毎日のおたのしみ
・今日のチャレンジ：日替わりのワールドでコインが ${app.economy.dailyMultiplier} 倍
・ボーナスコイン：時間がたつとまたもらえる

■ こんな人に
・すきま時間にサクッと遊びたい
・ハイスコアを更新するのが好き
・かわいいキャラクターが好き

※ 本アプリは広告を表示します。アプリ内購入で広告を消すことができます。
※ データはすべて端末の中に保存されます。アカウント登録は不要です。

## カテゴリ
ゲーム ＞ カジュアル

## タグの候補
カジュアル, シングルプレイヤー, オフライン

## コンテンツのレーティング（IARC アンケートの答え方の目安）
暴力・性的表現・ギャンブル・ユーザー同士の交流：すべて「いいえ」
→ 「全年齢（3+）」相当になる見込み

## ターゲット年齢層
13歳以上（13-15, 16-17, 18+）を選択。子ども向け（ファミリー）プログラムには参加しない。
広告は「全年齢向けのコンテンツのみ（maxAdContentRating: ${app.ads.maxAdContentRating}）」に制限済み。
`;
}

function privacyPolicyHtml(app, date) {
  const mail = app.contactEmail || '（ここに連絡先メールアドレス）';
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${app.name} プライバシーポリシー</title>
<style>body{max-width:720px;margin:0 auto;padding:24px 16px;font-family:system-ui,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.8;color:#222;background:#fff}h1{font-size:24px}h2{font-size:18px;margin-top:28px}</style>
</head>
<body>
<h1>${app.name} プライバシーポリシー</h1>
<p>制定日：${date}</p>
<p>本ポリシーは、スマートフォン向けゲーム「${app.name}」（以下「本アプリ」）における利用者の情報の取り扱いについて定めるものです。</p>

<h2>1. 開発者が集める情報</h2>
<p>開発者は、氏名・メールアドレスなど、利用者を特定できる情報を集めません。アカウント登録もありません。
ゲームの進み具合（コイン、解放したワールド、ハイスコア、設定）は利用者の端末の中だけに保存され、開発者に送られることはありません。</p>

<h2>2. 広告（Google AdMob）</h2>
<p>本アプリは、Google LLC が提供する広告配信サービス「Google AdMob」を利用しています。
AdMob は、広告の表示・効果測定・不正防止のために、広告 ID などの端末の識別子、IP アドレス（おおよその位置）、広告とのやりとり、診断情報などを収集・利用することがあります。
EEA・英国などの地域では、起動時に同意を確認し、設定画面からいつでも変更できます。
Google によるデータの取り扱いは <a href="https://policies.google.com/technologies/partner-sites?hl=ja">Google のパートナーのサイトやアプリを使用する際の Google によるデータ使用</a> をご覧ください。
広告のカスタマイズは、端末の設定（Google ＞ 広告）から無効にできます。</p>

<h2>3. アプリ内購入</h2>
<p>広告を消すアプリ内購入の決済は Google Play が行います。開発者が支払い情報（カード番号など）を受け取ることはありません。</p>

<h2>4. 子どもの利用</h2>
<p>本アプリは 13 歳未満の子どもを対象としていません。表示される広告は全年齢向けの内容に制限しています。</p>

<h2>5. 情報の削除</h2>
<p>本アプリを削除すると、端末に保存されたゲームのデータもすべて削除されます。</p>

<h2>6. ポリシーの変更</h2>
<p>本ポリシーを変更する場合は、このページで告知します。</p>

<h2>7. お問い合わせ</h2>
<p>${mail}</p>
</body>
</html>
`;
}

function dataSafetyText(app) {
  return `# ${app.name} — Google Play「データ セーフティ」の答え方

Play Console ＞ アプリのコンテンツ ＞ データ セーフティ で、次のように答えます。
（AdMob の最新の開示内容は https://developers.google.com/admob/android/privacy/play-data-disclosure で必ず確認してください）

## データの収集とセキュリティ
- ユーザーデータを収集または共有しますか？ → **はい**（AdMob の SDK が収集するため）
- 送信時に暗号化されますか？ → **はい**
- データ削除をリクエストする方法がありますか？ → アカウントが無いため「いいえ」でも可（アプリ削除で端末内データは消える）

## 収集されるデータの種類（AdMob による）
| データの種類 | 収集 | 共有 | 目的 |
| --- | --- | --- | --- |
| 位置情報 ＞ おおよその位置（IP アドレスから） | はい | はい | 広告またはマーケティング、分析、不正防止・セキュリティ |
| アプリのアクティビティ ＞ アプリ内のインタラクション | はい | はい | 広告またはマーケティング、分析 |
| アプリの情報とパフォーマンス ＞ クラッシュログ・診断 | はい | はい | 分析、不正防止 |
| デバイスまたはその他の ID ＞ 広告 ID | はい | はい | 広告またはマーケティング、分析、不正防止 |

- いずれも「一時的に処理」ではなく、「ユーザーは収集を拒否できない（必須）」を選択（広告付きアプリのため）

## そのほかの申告
- 広告：**含む**
- アプリ内購入：**あり**（広告削除 \`${app.iap.removeAds}\`）
- 広告 ID の使用：**はい**（目的：広告）。AdMob が \`AD_ID\` 権限を自動で追加します
- ターゲット年齢層：13歳以上
- プライバシーポリシー URL：${app.privacyPolicyUrl || '（未設定。privacy-policy.html を公開して app.json に書く）'}
`;
}

async function makeStoreKit(root, key) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    throw new Error('playwright が必要です（npm i -D playwright）。画像以外の文書だけなら --docs-only');
  }
  const { dir, app, worlds } = buildApp(root, key);
  const out = path.join(dir, 'store');
  const t0 = runtimeConfig(worlds[0]).theme;
  const base = { genre: app.genre, player: t0.player, palette: t0.palette, bg1: t0.bg1, bg2: t0.bg2, deco: t0.deco };
  const written = [];

  const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ content: `(${painter.toString()})();` });
    await page.evaluate(() => document.fonts.ready);
    const paint = (spec) => page.evaluate((s) => window.paint(s), { ...base, ...spec });

    const put = async (file, spec) => {
      savePng(file, await paint(spec));
      written.push(path.relative(root, file));
    };

    await put(path.join(out, 'icon-512.png'), { kind: 'icon', w: 512, h: 512 });
    await put(path.join(out, 'feature-1024x500.png'), {
      kind: 'feature',
      w: 1024,
      h: 500,
      name: app.name,
      hook: (TAGLINES[app.genre] || {}).hook || GENRES[app.genre].howto,
    });

    // Android のランチャーアイコン・スプラッシュ（Capacitor の初期画像を置き換える）
    const res = path.join(dir, 'android', 'app', 'src', 'main', 'res');
    if (fs.existsSync(res)) {
      for (const [d, k] of Object.entries(DENSITIES)) {
        const s = Math.round(48 * k);
        const f = Math.round(108 * k);
        await put(path.join(res, `mipmap-${d}`, 'ic_launcher.png'), { kind: 'icon', w: s, h: s });
        await put(path.join(res, `mipmap-${d}`, 'ic_launcher_round.png'), { kind: 'round', w: s, h: s });
        await put(path.join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'), { kind: 'foreground', w: f, h: f });
        await put(path.join(res, `mipmap-${d}`, 'ic_launcher_background.png'), { kind: 'background', w: f, h: f });
      }
      fs.writeFileSync(
        path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
        '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n',
      );
      const round = path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml');
      if (fs.existsSync(round)) fs.copyFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), round);
      for (const sub of fs.readdirSync(res).filter((n) => n.startsWith('drawable'))) {
        const file = path.join(res, sub, 'splash.png');
        if (!fs.existsSync(file)) continue;
        const b = fs.readFileSync(file);
        await put(file, { kind: 'splash', w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
      }
    }

    // スクリーンショット（実際のアプリを 360x640 の 3 倍 = 1080x1920 で撮る）
    const log = console.log;
    console.log = () => {};
    const server = serve(path.join(dir, 'www'), 0);
    await new Promise((r) => server.on('listening', r));
    console.log = log;
    try {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      const url = `http://127.0.0.1:${server.address().port}/`;
      // 遊び込んだ状態の見本データ（コインとワールド解放）でホーム画面を撮る
      await p.addInitScript(
        ({ k, ids }) => {
          try {
            localStorage.setItem('natura:app:' + k, JSON.stringify({ coins: 245, unlocked: [true, true, true, true], selected: 2 }));
            ids.slice(0, 4).forEach((id, i) => localStorage.setItem('natura:' + id + ':best', String([42, 35, 31, 18][i])));
          } catch (e) {
            /* ignore */
          }
        },
        { k: app.key, ids: worlds.map((w) => w.slug) },
      );
      await p.goto(url);
      await p.waitForTimeout(600);
      const shots = path.join(out, 'screenshots');
      fs.mkdirSync(shots, { recursive: true });
      await p.screenshot({ path: path.join(shots, 'phone-1-home.png') });
      written.push(path.relative(root, path.join(shots, 'phone-1-home.png')));

      // プレイ中: 本物のゲームを自動でタップして積み上げる（スタックは誤差を広げて安定して高く積む）
      await p.evaluate(() => {
        for (const w of window.WORLDS) if (w.params.perfect != null) w.params.perfect = 1000;
      });
      await p.locator('#play').tap();
      await p.waitForFunction(() => window.__natura && window.__natura.state === 'title');
      const box = await p.locator('#game').boundingBox();
      const tap = () => p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.7);
      await tap();
      for (let i = 0; i < 14 && (await p.evaluate(() => window.__natura.state)) === 'play'; i++) {
        await p.waitForTimeout(app.genre === 'stacker' ? 420 : 250);
        await tap();
      }
      await p.waitForTimeout(250);
      await p.screenshot({ path: path.join(shots, 'phone-2-play.png') });
      written.push(path.relative(root, path.join(shots, 'phone-2-play.png')));

      // ワールド一覧
      await p.evaluate(() => window.__app.closeGame());
      await p.locator('#rail').scrollIntoViewIfNeeded();
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(shots, 'phone-3-worlds.png') });
      written.push(path.relative(root, path.join(shots, 'phone-3-worlds.png')));

      // 別ワールドのタイトル画面
      await p.evaluate(() => window.__app.launch(Math.min(5, window.WORLDS.length - 1), false));
      await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(shots, 'phone-4-world.png') });
      written.push(path.relative(root, path.join(shots, 'phone-4-world.png')));
      await ctx.close();
    } finally {
      server.close();
    }
  } finally {
    await browser.close();
  }
  written.push(...writeStoreDocs(root, key));
  return written;
}

function writeStoreDocs(root, key) {
  const { dir, app, worlds } = loadApp(root, key);
  const out = path.join(dir, 'store');
  fs.mkdirSync(out, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const files = {
    'listing-ja.md': listingText(app, worlds.map(runtimeConfig)),
    'privacy-policy.html': privacyPolicyHtml(app, date),
    'data-safety.md': dataSafetyText(app),
  };
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(out, name), body);
  return Object.keys(files).map((n) => path.relative(root, path.join(out, n)));
}

module.exports = { makeStoreKit, writeStoreDocs, listingText, privacyPolicyHtml };
