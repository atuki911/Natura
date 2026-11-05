# Natura — Claude Code 向けの作り方

ブラウザで遊ぶ横スクロールの城防衛ゲーム。左の緑の王国の城から棒人間の兵を出し、右の穢れの砦から湧く怪物の波(ウェーブ)を防ぐ。**倒れた兵はその場所で木になり、戦い続ける**のがこのゲームの核。提出先は CrazyGames などの Web ゲームサイト。

- 企画: `docs/GDD.md`
- 画風の決まり: `docs/style-bible.md`
- 生成画像への差し替え: `docs/asset-pipeline.md`
- これからの進め方: `docs/roadmap.md`
- 独自性の探索の記録: `exploration/round-1/`

## 作りの大原則

1. **戦闘の計算(`src/sim/`)と描画(`src/render/`)を混ぜない。** `src/sim/` から Phaser・DOM・`Math.random` を参照しない。乱数は `world.rng`。こうしておくと、画面なしで戦闘を何千回も回してバランスを測れる。
2. **数字はデータに置く。** ユニット・敵・タワー・能力・ウェーブは `src/data/*.ts`。コードに数字を直書きしない。
3. **描画は戦闘の出来事(`world.events`)を読んでエフェクトを出す。** 描画側から戦闘の状態を書き換えない(命令は `world.command()` だけ)。
4. **絵はテクスチャの key 単位で差し替えられるようにする。** コードで描く絵は `makeTexture()` を通す(同じ key の画像が読み込まれていればそちらが使われる)。
5. 座標は論理座標 1280x720。キャンバスは 1920x1080 で、カメラを 1.5 倍にして描く(`src/render/layout.ts`)。テクスチャは 2 倍の解像度で描いて 0.5 倍で表示する。

## コマンド

| やること | コマンド |
|---|---|
| 開発サーバー | `npm run dev` |
| 型チェック + テスト | `npm run check` |
| バランス検証(自動プレイを回して勝率を出す) | `npm run balance -- 30 all`(全ステージ) / `npm run balance -- 60 1-3` |
| 作戦ごとの勝率差・待ち時間 | `node tools/metrics.ts 30` |
| ステージの難しさを自動で合わせる | `node tools/tune.ts <ステージ> <目標の勝率>` |
| 画面を撮る(見た目の確認) | `npm run screenshot` → `screenshots/*.png` を開いて見る |
| 本番ビルド | `npm run build` |

URL のパラメータ(検証用): `?debug`(デバッグパネル。木も植えられる)、`?autoplay`(自動プレイ)、`?stage=2-3`、`?seed=3`、`?speed=4`、`?wave=10`(そのウェーブから)、`?map`(地図から)、`?play`(手引きつきで1-1)。

## 変更したら必ずやること

- `npm run check` が通る。
- 数字(`src/data/`)を変えたら `npm run balance -- 30 all` を回し、結果を報告する。目安: `standard` の勝率は地域1で 90% 以上、最後のステージで 60〜85%。`idle` はどのステージでも必ず負ける。
- 見た目を変えたら `npm run screenshot` で撮り、画像を開いて崩れていないか確かめる。ブラウザのエラーが出たら直す。

## よくある作業

- ユニットを足す → `/add-unit`(`.claude/skills/add-unit/SKILL.md`)
- 敵を足す → `/add-enemy`
- ウェーブ・数字を調整する → `/balance`
- 見た目を確かめる → `/screenshot-check`

## 書き方

- TypeScript。`erasableSyntaxOnly`(enum・引数プロパティを使わない)。Node でそのまま `.ts` を動かすため、import には `.ts` を付ける。
- コメントと画面の文言は日本語で書いてよい。画面の文言は `src/i18n.ts`(英語と日本語の両方)に置く。
- 既存の名前・企画にない有名作のキャラクターや見た目に寄せない。独自の世界観で作る。
