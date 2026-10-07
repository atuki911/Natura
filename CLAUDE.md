# Natura — 開発メモ（Claude Code 向け）

海外の個人AI起業事例を調べ、日本向けの事業プランに落とし込むツール。**外部の有料API・APIキーは使わない**（収集は無料の公開API/RSS、深掘りは Claude Code のスキル）。

## 構成
- `data/cases/*.json` … 事例（1ファイル1事例、出典必須）。スキーマは `scripts/lib/data.mjs` の `validate()` が正
- `data/japan/{categories,regulations,channels}.json` … 日本市場の知識ベース
- `data/candidates.json` … 自動収集した新着候補（`npm run collect` が更新）
- `app/engine.js` … スコアリング・価格換算・プラン生成・シミュレーション（ブラウザとNode両対応のUMD、依存なし）
- `app/index.html`, `app/app.js`, `app/styles.css` … UI（ビルド不要、file:// で動く）
- `app/data.js` … 生成物（`npm run build`）。直接編集しない
- `collector/` … 無料ソース（HN Algolia / Reddit / RSS）からの収集
- `scripts/cli.mjs` … CLI、`scripts/build.mjs` … data.js と dist/*.html を生成

## コマンド
- `npm test` … node:test（依存なし）
- `npm run validate` / `npm run build` … データを変えたら必ず両方
- `npm run report -- <id>` … 日本版プランを reports/ に出力

## 規約
- 依存パッケージを追加しない（Node 18+ の標準機能のみ）
- 事例の数字は出典と確度（high/medium/low）を必ず付ける。推測で埋めない
- UI の文言は日本語。法規制の記述は「法的助言ではない」前提を崩さない
- スキル：`/research-case`（事例追加）、`/localize`（日本向け深掘り）、`/triage-leads`（候補整理）
