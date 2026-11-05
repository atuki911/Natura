---
name: add-enemy
description: 敵を1種類足す。数字・部品の絵・動き・ウェーブへの登場・バランス確認まで一通り行う。
---

# 敵を足す

依頼から、名前・見た目・特徴(どの味方が効くか)を決める。決まっていなければ `docs/GDD.md` の相性表で空いている役割を探して案を出す。見た目は `docs/style-bible.md` に合わせる(丸くてぷよぷよ、大きな目、左向き)。

1. `src/sim/types.ts` の `EnemyId` に id を足す。特別な動きは `EnemySpecial` に足し、`src/sim/world.ts` で処理する。
2. `src/data/enemies.ts` に数字を足す。
3. 部品の絵: `src/render/art/creatures.ts` に `<id>_body` などのテクスチャを足す(2倍の解像度で描かれる。動かしたい部分は別の部品にする)。
4. 動き: `src/render/enemyView.ts` に組み立てと `update`(歩き・攻撃の踏み込み・被弾の光)を足す。
5. `src/render/debugPanel.ts` の `ENEMY_IDS` に足す。
6. `src/data/stages.ts` のウェーブに登場させる。
7. `docs/GDD.md` の相性表と `docs/asset-pipeline.md` の部品表に足す。
8. `npm run check` → `npm run balance -- 60` → `npm run screenshot -- --url "?debug&wave=<登場ウェーブ>&autoplay&speed=2" --wait 10000 --name <id>` で確かめ、結果を報告する。
