---
name: triage-leads
description: Natura の新着候補（data/candidates.json）を見直し、有望な候補を選んで事例化する。「/triage-leads」「新着候補を整理して」で使う。必要なら先に npm run collect で候補を集める。
---

# 新着候補の整理（triage-leads）

## 手順

1. **収集**：`data/candidates.json` の `updated` が7日以上前なら `npm run collect` を実行する（無料の公開ソースのみ。ネットワークが使えない環境では失敗するので、その場合は既存の候補で進める）。
2. **一覧**：`status` が `new` の候補を `score` の高い順に最大15件読み、次の基準で分類する。
   - **有望**：海外の個人・少人数による実在のAIプロダクトで、売上や利用者数の具体的な言及がある
   - **保留**：プロダクトは面白いが実績が不明
   - **除外**：資金調達ニュース、まとめ記事のみ、AIでない、日本で再現する意味が薄い、すでに `data/cases/` にある
3. **事例化**：有望なものを最大3件選び、それぞれ `research-case` スキルの手順で事例データを作る。
4. **状態の更新**：`data/candidates.json` の該当候補の `status` を `promoted`（事例化）・`dismissed`（除外）・`starred`（保留）に更新する。JSONの他の項目は変えない。
5. **ビルド**：`npm run validate && npm run build && npm test`。
6. **報告**：事例化したもの・保留・除外の件数と、事例化した事例の日本版の切り口を短く伝える。
