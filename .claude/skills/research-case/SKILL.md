---
name: research-case
description: 海外の個人・少人数AI起業の事例を Web 検索で事実確認し、Natura の事例データ（data/cases/<id>.json）として追加する。URL・サービス名・創業者名のいずれかを受け取る。「この事例を追加して」「/research-case <URL>」で使う。
---

# 事例リサーチ（research-case）

引数（URL・サービス名・創業者名）で指定された海外のAI起業事例を調べ、`data/cases/<id>.json` を作成する。
外部の有料APIは使わない。調査には Claude Code の WebSearch / WebFetch だけを使う。

## 手順

1. **重複確認**：`data/cases/` に同じサービスがないか `grep -ril "<サービス名>" data/cases` で確認する。あれば新規作成せず、既存ファイルの更新（新しい売上の追記など）に切り替える。
2. **調査**：WebSearch を最低3回（例：「<名前> revenue MRR」「<名前> founder interview」「<名前> pricing」）、必要なら WebFetch で一次情報を読む。優先する情報源：
   - 創業者本人の発信（ブログ、X、Indie Hackers の本人投稿、インタビュー）→ `confidence: "high"`
   - 取材記事・ケーススタディ（Indie Hackers の記事、Starter Story のインタビュー、報道）→ `"medium"`
   - 推計データベース（Latka など）→ `"low"`
3. **事実と推測を分ける**：確認できなかった項目は空にするか「非公開」と書く。創業者の国籍・拠点を推測で埋めない。売上は出典ごとに `revenue[]` に1行ずつ入れ、`sourceId` で出典に紐づける。
4. **カテゴリの選択**：`data/japan/categories.json` の `items[].id` から最も近いものを `category` に入れる。どれにも当てはまらない新領域なら、カテゴリを追加する（scores・notes・regulations・channels・localizationAngles・validation・keywordsEn・keywordsJa をすべて埋める。規制IDは `data/japan/regulations.json`、チャネルIDは `data/japan/channels.json` に存在するものだけを使う）。
5. **ファイル作成**：`npm run new-case -- <id>` でひな形を作り、すべての項目を日本語で埋める（`name`・出典タイトルは原文のままでよい）。
   - `buildComplexity`（1〜5）：1=ノーコードで週末、3=一般的なWebアプリ、5=独自基盤・高度なAI
   - `initialCost`（1〜5）：広告・GPU・ハードなど初期費用の大きさ
   - `aiDependency`：AI API原価が売上に対して大きいなら high
   - `channels`：`data/japan/channels.json` の ID
   - `japan.localAngle`：日本で個人が再現するときの具体的な切り口を1〜2文で
   - `japan.scoreAdjust`：カテゴリの平均と明らかに違う点があるときだけ ±1 で補正し、理由を `japan.notes` に書く
6. **検証とビルド**：`npm run validate` → `npm run build` → `npm test` がすべて通ることを確認する。
7. **報告**：追加した事例の要点（売上と確度、日本版の切り口、日本適合スコア）をユーザーに短く伝える。スコアは `npm run list` で確認できる。

## 注意

- 売上の数字は「自己申告」であることが多い。誇張されやすい数字（「年商換算」「ピーク月」）はそう注記する。
- 失敗・縮小した事例も価値がある。`status` を `declined` / `closed` にして教訓を残す。
- 新着候補（`data/candidates.json`）から本採用した場合は、その候補の `status` を `promoted` に変える。
