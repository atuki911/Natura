# スタイルバイブル(画風の決まり)

絵柄を揃えるための決まり。コードで描く絵も、生成AIで作る絵も、これに合わせる。

## 全体

- 太めの濃い輪郭線(色 `#1c1726`)。線は丸く閉じる。
- 塗りは「基本色 + 左上の光 + 右下の影」の3段。グラデーションは控えめ。
- 彩度は高め。味方側は緑・青・金、敵側は紫・黒・ピンクの光。
- 画面の左(味方)は明るく晴れ、右(穢れ)は紫に濁る。境目はぎざぎざの根が伸びる。

## 色

| 用途 | 色 |
|---|---|
| 輪郭 | `#1c1726` |
| 空(上→地平) | `#62bdf0` → `#a9e0fa` → `#e6f7ff` |
| 草 | `#86cf5a`(影 `#5aa845`、光 `#b4e77a`) |
| 道 | `#e6c38a`(縁 `#c79c5f`) |
| 味方の印 | `#3f7fe0` / 金 `#ffcc33` |
| 穢れ | `#8a4fc0`(影 `#5a2f86`、光 `#e07bff`) |
| 穢れの石 | `#3d3548` |

## キャラクター

- **味方**: 棒人間。黒い線、丸い頭。青い鉢巻き(爆弾兵だけ赤)。武器と帽子だけ色がある。コードで骨を動かして描く(`src/render/stickman.ts`)。
- **敵**: 丸くてぷよぷよ。大きな目、とがった歯。怖さ 3 割、かわいさ 7 割。すべて左を向く。

## 生成AIに渡す文言の型

基準の画像(ゲームの画面の撮影、`npm run screenshot` で撮れる)を必ず一緒に渡す。

```
2D game asset, cartoon style, thick dark purple-black outlines (#1c1726),
flat cel shading with one highlight and one shadow, saturated colors,
side view facing LEFT, transparent background, centered, no text, no ground shadow.
Subject: <ここに部品の説明>
Palette: <この文書の色>
```

例:

- 背景(遠景): `wide panoramic background layer, rolling green hills with outlined edges, distant pale castle, sky gradient, left side bright and green, right side corrupted purple, 2560x1440, no characters`
- 敵の体: `blob monster body only, purple slime with drips, glossy highlight, wide mouth with small fangs, NO eyes (eyes are separate parts), 132x116`
- 敵の目: `single cartoon eyeball, white with thin outline, no pupil, 40x40`

## 大きさ

テクスチャは表示の **2倍** の解像度で作る(例: 画面で 66x58 の敵の体 → 画像は 132x116)。各テクスチャの key と大きさは `docs/asset-pipeline.md` の表を見る。
