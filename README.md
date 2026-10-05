# 🏭 Natura Game Factory

スマホで遊べる HTML5 ゲームを **量産する工場** です。
「ジャンル × テーマ × パラメータ」を組み合わせて、1 コマンドで何本でもゲームを自動生成します。

```bash
npm run batch -- -n 24     # 24 本まとめて量産
npm run serve              # 同じ Wi-Fi のスマホから遊べる
```

- **依存ゼロ**：Node.js 18 以上だけで動きます（`npm install` 不要）
- **1 ゲーム = 1 ファイル（約 23KB）**：HTML に全部インライン。どこに置いても動く
- **スマホ最適化**：タッチ操作、縦画面、高 DPI、全画面 PWA（ホーム画面に追加可）、オフライン動作、効果音、振動、ベストスコア保存
- **品質検査つき**：全ジャンル × 全テーマをボットに遊ばせる自動テスト

## 工場のしくみ

```
 注文書 (spec)          設計図 (blueprint)            製品 (dist/)
 ─────────────          ──────────────────            ─────────────
 { genre?, theme?,  →   games/<slug>.json      →     dist/<slug>/index.html
   seed?, title? }      シードから全パラメータ確定        manifest.webmanifest
                        （git で管理する）               icon.svg / sw.js
                                                     dist/index.html （ギャラリー）
```

| 部品 | 場所 | 役割 |
| --- | --- | --- |
| エンジン | `factory/engine/runtime.js` | 描画ループ・入力・スコア・タイトル/リザルト画面・効果音・演出。全ゲーム共通 |
| ジャンル | `factory/genres/*.js` | ゲームのルール本体と、パラメータの乱数レンジ |
| テーマ | `factory/themes.js` | キャラ絵文字・配色・効果音の音色・タイトル用の単語 |
| 生産ライン | `factory/spec.js` / `build.js` | 注文書 → 設計図 → HTML 一式 |
| 操作盤 | `factory/cli.js` | コマンドライン |

### ジャンル（6 種）

| id | 名前 | 遊び方 |
| --- | --- | --- |
| `runner` | ランナー | タップでジャンプして障害物をとびこえる（2段ジャンプ版あり） |
| `flappy` | フライ | タップではばたいて柱のすきまをくぐる |
| `catcher` | キャッチ | 指で動かして良いものだけキャッチ |
| `dodger` | よけゲー | 指で動かして降ってくるものを避け続ける |
| `tapper` | タップ | 出てきた仲間をタップ、敵はさわらない（モグラたたき系） |
| `stacker` | スタック | タイミングよくタップしてブロックを積み上げる |

### テーマ（8 種）

`space` 🚀 うちゅう / `ocean` 🐠 うみ / `forest` 🐿️ もり / `candy` 🧁 おかし /
`city` 🛹 まち / `ninja` 🥷 にんじゃ / `dino` 🦖 きょうりゅう / `winter` 🐧 ふゆ

6 ジャンル × 8 テーマ = 48 通りの基本形に、シードごとに重力・速度・難易度カーブ・ルール違い（2段ジャンプ、自由移動など）が変わるので、実質無限に作れます。

## コマンド

```bash
node factory/cli.js batch -n 12                       # 量産（組み合わせがなるべく被らない）
node factory/cli.js batch -n 6 --genres runner,flappy --themes space,ninja
node factory/cli.js batch -n 12 --seed 42             # 同じシード → 同じラインナップ
node factory/cli.js new --genre stacker --theme candy --title "おかしタワー"
node factory/cli.js build specs/example.json          # 注文書から生産
node factory/cli.js rebuild                           # 全設計図から再ビルド（エンジン改良を全ゲームに反映）
node factory/cli.js remove <slug>                     # 廃番
node factory/cli.js list                              # ジャンル・テーマ・生産済み一覧
node factory/cli.js serve --port 8080                 # ローカル配信
```

`npm run batch`, `npm run new`, `npm run rebuild`, `npm run serve` も使えます（引数は `--` の後ろに）。

### 注文書（spec）の書き方

```json
{
  "genre": "catcher",
  "theme": "ocean",
  "seed": 2026,
  "title": "よるのうみキャッチ",
  "slug": "night-ocean-catch",
  "params": { "fall": 150 },
  "themeOverrides": { "bg1": "#1b263b", "bg2": "#0d1b2a", "deco": "🌙" }
}
```

すべて省略可能。省略した項目はシードから自動で決まります。配列にすれば複数本をまとめて注文できます（`specs/example.json` 参照）。

## 公開する

`dist/` は静的ファイルだけなので、どこにでも置けます。

- **GitHub Pages**：Settings → Pages → Source を「GitHub Actions」にして、Actions タブから
  「Deploy games to GitHub Pages」を実行。`games/` の設計図からビルドして公開されます。
- **Netlify / Cloudflare Pages / Vercel**：ビルドコマンド `node factory/cli.js rebuild`、公開ディレクトリ `dist`。

## 工場を拡張する

**テーマを足す**：`factory/themes.js` に同じ形のオブジェクトを 1 つ追加するだけで、全ジャンルで使えます。

**ジャンルを足す**：`factory/genres/` にファイルを作り、`factory/genres/index.js` に 1 行追加。

```js
module.exports = {
  id: 'mygenre',
  label: 'マイジャンル',
  howto: 'タイトル画面に出る遊び方',
  words: [['タイトル用の単語', 'slug-word']],
  params(r) {               // r.range / r.int / r.chance / r.pick（シード固定の乱数）
    return { speed: r.range(100, 200) };
  },
  game: function game(api, P) {   // P = params の結果
    return {
      reset() {},           // 新しいプレイの開始
      update(dt) {},        // api.input.pressed / x / y, api.addScore(n), api.gameOver()
      draw(ctx) {},         // 360x640 の論理座標。api.emoji(ctx, '🚀', x, y, size)
    };
  },
};
```

> `game` 関数は `toString()` で HTML に埋め込まれるため、関数の外の変数は参照できません。
> テスト（`npm test`）がソース文字列から関数を作り直して検査するので、違反するとすぐ分かります。

使える `api`：`W, H, theme, input, rand, range, int, pick, chance, clamp, lerp, time, score, addScore, setScore, text, gameOver, sfx, shake, burst, emoji, overlap, near, circleRect, roundRect`

## テスト

```bash
npm test               # 全ジャンル×全テーマ×複数シードをボットに遊ばせる＋ビルド＋CLI のテスト
npm run test:browser   # 実ブラウザ（Pixel 7 エミュレート）で起動・タップ・ゲームオーバーまで確認
                       # playwright が必要（npm i -D playwright）。スクショは test-results/ へ
```
