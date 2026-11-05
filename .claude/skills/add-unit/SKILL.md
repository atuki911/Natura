---
name: add-unit
description: 味方ユニット(棒人間の兵)を1種類足す。数字・見た目・カード・文言・テスト・バランス確認まで一通り行う。
---

# 味方ユニットを足す

依頼から、名前・役割・値段・相性(何に強く何に弱いか)を決める。決まっていなければ `docs/GDD.md` の相性表を見て、既存と役割がかぶらない案を1つ出して確認する。

1. `src/sim/types.ts` の `UnitId` に id を足す。
2. `src/data/units.ts` の `UNITS` と `UNIT_ORDER` に足す。数字は既存のユニットを基準に、値段に見合う強さにする。
3. 新しい攻撃のしかたが要る時だけ `src/sim/world.ts` を直す(描画のコードを入れない)。
4. `src/sim/world.ts` の `unitCooldowns` の初期値に足す。
5. 見た目: `src/render/stickman.ts` の `StickKind`・`armPose`・`drawWeapon`・`drawHeadgear` に足す。武器と帽子で見分けがつくようにする。
6. カード: `src/render/art/ui.ts` にカードの色が要れば足し、`src/render/Hud.ts` の `CARD_TEXTURE` に足す。カードが5枚以上になる時は操作盤の並びも直す。
7. 文言: `src/i18n.ts` の `units` と `unitInfo` に英語と日本語を足す。
8. `docs/GDD.md` の相性表に足す。
9. `test/sim.test.ts` に、そのユニットらしさ(例: 空の敵に届く)を確かめるテストを1つ足す。
10. `npm run check` → `npm run balance -- 60` → `npm run screenshot` で確かめ、結果(勝率の変化と撮った画像)を報告する。
