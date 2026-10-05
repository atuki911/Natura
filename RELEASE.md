# 🚀 Google Play に出すまでの手順

例として、最初のアプリ `apps/tower`（つみつみタワー）で説明します。ほかのジャンルのアプリも同じ手順です。

> **最初に確認**：Google Play の開発者登録と、広告収入（AdMob）・アプリ内課金の売上の受け取りには、
> **18 歳以上の本人**の名前・住所・本人確認書類・銀行口座が必要です。18 歳未満なら保護者の名義で登録してもらいましょう。

## 全体の流れ

| # | やること | どこで | 目安 |
| --- | --- | --- | --- |
| 1 | 開発者アカウントを作る | Google Play Console | 25 ドル（1回だけ）・本人確認に数日 |
| 2 | 広告のアカウントを作る | AdMob | 無料 |
| 3 | `app.json` を自分の情報にする | このリポジトリ | 10 分 |
| 4 | プライバシーポリシーを公開する | Google サイトなど | 10 分 |
| 5 | 署名鍵を作って GitHub に登録 | 自分の PC ＋ GitHub | 10 分 |
| 6 | AAB をビルド | GitHub Actions（自動） | 10 分 |
| 7 | ストア情報を入力してアップロード | Play Console | 1 時間 |
| 8 | クローズドテスト（12 人 × 14 日） | Play Console | 2 週間 |
| 9 | 本番公開を申請 | Play Console | 審査に数日 |

---

## 1. Google Play Console に登録する

1. https://play.google.com/console で登録（25 ドル）。
2. アカウントの種類は「個人」でOK。本人確認を済ませる。

## 2. AdMob で広告の ID をもらう

1. https://admob.google.com でアカウントを作る（支払い情報もここで登録）。
2. 「アプリ」→「アプリを追加」→ Android、アプリ名「つみつみタワー」。
3. 次の 2 つの**広告ユニット**を作る:
   - **リワード広告**（つづきから・ボーナスコイン用）
   - **インタースティシャル広告**（ゲームの合間用）
4. 「アプリ ID」（`ca-app-pub-…~…`）と、2 つの「広告ユニット ID」（`ca-app-pub-…/…`）をメモ。
5. AdMob の「プライバシーとメッセージ」で **GDPR の同意メッセージ**を作って公開する
   （アプリは起動時に自動で表示する作りになっています。日本向けだけでも作っておくのが安全）。

> ⚠️ 自分の本物の広告を自分でタップしないこと（アカウント停止の原因になります）。
> 開発中は `"testing": true` のまま（テスト広告）で確認します。

## 3. `apps/tower/app.json` を書きかえる

```jsonc
{
  "appId": "io.github.atuki911.tsumitsumi", // ← 公開後は二度と変えられない。これでよいか最終確認
  "name": "つみつみタワー",
  "version": "1.0.0",
  "versionCode": 1,                          // ← アップロードのたびに +1
  "privacyPolicyUrl": "https://…",           // ← 手順4のURL
  "contactEmail": "you@example.com",         // ← ストアに表示される連絡先
  "ads": {
    "testing": false,                        // ← 本番公開の直前に false
    "appId": "ca-app-pub-XXXX~YYYY",         // ← AdMob のアプリ ID
    "rewarded": "ca-app-pub-XXXX/1111",
    "interstitial": "ca-app-pub-XXXX/2222",
    ...
  }
}
```

書きかえたら確認:

```bash
node factory/cli.js app check tower   # 直すことが残っていれば一覧が出る
node factory/cli.js app build tower   # www と Android の設定に反映
```

## 4. プライバシーポリシーを公開する

`apps/tower/store/privacy-policy.html` ができています（連絡先を入れてから `node factory/cli.js app store tower --docs-only` で作り直せます）。
**誰でも見られる URL** に置く必要があります。いちばん簡単なのは:

- **Google サイト**（https://sites.google.com）で新しいサイトを作り、文章を貼って公開 → その URL を `privacyPolicyUrl` に。

> このリポジトリは非公開のままでOK。ポリシーのページだけを公開します。

## 5. 署名鍵を作る（最初の 1 回だけ）

自分の PC（Java が入っていれば `keytool` が使えます）で:

```bash
keytool -genkeypair -v -keystore natura-release.jks -alias natura \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 natura-release.jks > natura-release.jks.b64   # Mac は: base64 -i natura-release.jks -o natura-release.jks.b64
```

GitHub のリポジトリ → Settings → Secrets and variables → Actions → **New repository secret** で 4 つ登録:

| 名前 | 中身 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `natura-release.jks.b64` の中身 |
| `ANDROID_KEYSTORE_PASSWORD` | 鍵ストアのパスワード |
| `ANDROID_KEY_ALIAS` | `natura` |
| `ANDROID_KEY_PASSWORD` | 鍵のパスワード |

> ⚠️ `natura-release.jks` とパスワードは **絶対になくさない・リポジトリに入れない**。
> Play Console の「Play アプリ署名」を使うので、なくしても Google に申請すれば作り直せますが、手続きが大変です。

## 6. AAB をビルドする

`main` に push するか、GitHub の Actions →「Android build」→「Run workflow」。
終わったら実行結果の **Artifacts** から:

- `tower-debug-apk` … スマホに直接入れて試せる版
- `tower-release-aab` … Google Play にアップロードする版

## 7. Play Console でアプリを作る

1. 「アプリを作成」→ 名前「つみつみタワー」、言語 日本語、ゲーム、無料。
2. **ストアの掲載情報**: `apps/tower/store/listing-ja.md` をコピペ。画像は `apps/tower/store/` の
   `icon-512.png`、`feature-1024x500.png`、`screenshots/*.png`。
3. **アプリのコンテンツ**（左メニュー）:
   - プライバシーポリシー → 手順4の URL
   - 広告 → 「はい、広告を含みます」
   - アプリのアクセス権 → 「すべての機能を制限なく利用できる」
   - コンテンツのレーティング → `listing-ja.md` の目安どおりに回答
   - ターゲット年齢層 → **13 歳以上**（13〜15, 16〜17, 18 以上）
   - データ セーフティ → `apps/tower/store/data-safety.md` のとおり
   - 広告 ID → 「はい」（目的: 広告）
4. **テスト → クローズドテスト** でトラックを作り、`tower-release-aab` の `.aab` をアップロード。
5. **収益化 → アプリ内アイテム** で、ID `remove_ads`、一回限りの購入、価格（例: 300 円）を作って有効化。
   （課金アイテムは AAB を一度アップロードした後でないと作れません）

## 8. クローズドテスト（12 人 × 14 日）

2023 年 11 月以降に作った個人アカウントは、本番公開の前に
**12 人以上のテスターが 14 日間連続で参加するクローズドテスト**が必要です。
家族・友だちの Google アカウントをテスターに追加し、毎日少し遊んでもらいましょう。

## 9. 本番公開

1. `app.json` の `ads.testing` を `false` にして `versionCode` を +1 → push → 新しい AAB。
2. `node factory/cli.js app check tower` が ✅ になっていることを確認。
3. Play Console の「製品版」に AAB をアップロードして審査に提出。

## アップデートのしかた

1. 直したいところを変える（例: `app.json` の価格表、エンジンの改良、新ワールド）。
2. `app.json` の `versionCode` を +1、`version` も上げる。
3. push → Actions の AAB を Play Console にアップロード。

## 次のジャンルを出すとき

```bash
node factory/cli.js app new runner --key dash --app-id io.github.atuki911.dash --name "ダッシュ・ワールド"
cd apps/dash && npm install && npx cap add android && cd ../..
node factory/cli.js app build dash
NODE_PATH=$(npm root -g) node factory/cli.js app store dash   # 画像（playwright が必要）
```

1 本目の反応（遊ばれ方・広告収入）を見てから、次のジャンルを 1 本ずつ出すのがおすすめです。
同じ見た目のアプリを一度にたくさん出すと、スパム扱いでアカウント停止になることがあります。

## iPhone（App Store）版

次の段階です。Apple Developer Program（年 99 ドル）と、ビルド用の Mac（または GitHub Actions の macOS）が必要です。
`npx cap add ios`、トラッキング許可（ATT）の表示、App Store 用スクリーンショットの追加などを行います。
