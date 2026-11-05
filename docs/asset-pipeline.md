# 素材の差し替え(生成画像の取り込み)

今の絵はすべてコード(Canvas)で描いている。生成AIなどで作った画像を、**同じ key の画像として読み込むと、その部品だけ差し替わる**。コードの変更は要らない。

## 手順

1. 画像を作る(`docs/style-bible.md` の文言の型と基準画像を使う)。背景は透過 PNG にする。
2. 表の大きさの **2倍** の解像度にそろえる(例: 背景は 2560x1440)。
3. `public/assets/` に置く(例: `public/assets/bg/stage1.png`)。
4. `public/assets/manifest.json` に key とパスを書く:

```json
{
  "images": {
    "bg_stage1": "bg/stage1.png",
    "blightling_body": "enemies/blightling_body.png"
  }
}
```

5. `npm run screenshot` で撮って確かめる。位置がずれたら、`src/render/enemyView.ts` などの部品の位置を直す。

## 差し替えられる部品

大きさは画面上の大きさ(論理ピクセル)。画像はこの 2 倍で作る。原点は特に書いていなければ中心。

| key | 大きさ | 中身 |
|---|---|---|
| `bg_stage1` | 1280x720 | ステージ1の背景(空・山・丘・川・道・穢れ)。下 120px は操作盤に隠れる |
| `cloud_0`〜`cloud_2`, `cloud_blight` | 140〜230 x 64〜90 | 雲(ゆっくり流れる) |
| `castle` | 260x340 | 味方の城。地面は上から 330px の位置 |
| `citadel` | 250x420 | 穢れの砦。地面は上から 410px。門の中心は (128, 340) |
| `portal_swirl` | 110x130 | 門の渦(回転させて加算で重ねる) |
| `tower_slot` | 74x34 | タワーの土台 |
| `tower_arrowTower` | 70x130 | 弓の塔(下端が地面)。見張り台の床は上から 40px |
| `tower_cannonTower` | 84x96 | 大砲の塔(下端が地面) |
| `cannon_barrel` | 56x26 | 砲身(右向き。回転の中心は左から 14px) |
| `blightling_body` | 66x58 | 粘体の体(目は別部品) |
| `gnasher_body` | 56x50 | 小鬼の体(脚はコードで描く) |
| `tuskbeast_body` | 124x96 | 牙獣の体(脚はコードで描く) |
| `tuskbeast_rider` | 40x56 | 牙獣の乗り手 |
| `wisp_body` | 74x96 | 影 |
| `rollereye_body` | 74x74 | 目玉の白目(回転する。黒目は `iris_orange`) |
| `mireMaw_body` | 300x260 | ボスの体(上あご・歯まで) |
| `mireMaw_jaw` | 150x60 | ボスの下あご(開け閉めする) |
| `rotMoth_body` | 48x36 | 蛾の体(頭・胸・腹。翅は別部品) |
| `rotMoth_wing` | 50x38 | 蛾の前翅(付け根は左下 (6, 34)。縦に縮めて羽ばたく) |
| `rotMoth_wing_hind` | 38x30 | 蛾の後ろ翅(付け根は左下 (5, 26)) |
| `burrower_mound` | 70x28 | 地虫の盛り土(下端が地面。穴の中心は上から 11px) |
| `burrower_mound_lip` | 70x28 | 盛り土の穴より手前だけ(頭と胴の前に重ねる) |
| `burrower_head` | 38x34 | 地虫の頭(ドリルの歯・目) |
| `burrower_segment` | 30x22 | 地虫の胴の節(伸び上がる時に並べる) |
| `burrower_clod` | 10x9 | 飛び散る土くれ |
| `sporeMother_body` | 210x160 | 胞子の母の胴(上あご・歯まで) |
| `sporeMother_jaw` | 104x42 | 胞子の母の下あご(開け閉めする) |
| `sporeMother_cap` | 300x122 | 胞子の母の傘(下端のひだが付け根) |
| `sporeMother_sac` | 46x46 | 胞子袋(脈打つ) |
| `sporeMother_leg` | 36x46 | 根の脚(上端が付け根) |
| `spore_puff` | 40x40 | 胞子の雲(やわらかい光の玉) |
| `blightHeart_body` | 280x250 | 穢れの心臓の体(目のくぼみの中心は (136, 132)) |
| `blightHeart_veins` | 280x250 | 光る血管(体にぴったり重ね、鼓動で明るさが変わる) |
| `blightHeart_iris` | 50x50 | 穢れの心臓の黒目(縦長のひとみ。白目は `eye_big`) |
| `blightHeart_crown` | 250x100 | 黒い茨の冠 |
| `eye_white`, `pupil`, `eye_big`, `iris_big`, `iris_orange` | — | 目の部品 |
| `hud_panel` | 1280x124 | 下の操作盤 |
| `card_blue` など | 86x100 | ユニットのカード |
| `ability_heal`, `ability_meteor` | 78x78 | 特殊能力のボタン |
| `logo` | 560x170 | タイトルのロゴ |

棒人間(味方)は画像を使わず、コードで描く(`src/render/stickman.ts`)。絵柄が揃い、動きの種類をいくらでも増やせるため。

## 音

今の効果音は `src/render/sfx.ts` でその場で合成している仮の音。本物の音素材に差し替える時は、Phaser の音の読み込みに切り替える(未実装)。BGM はまだ無い。

## 権利

生成AIの画像・音を使う時は、そのサービスの規約で商用利用ができるかと、提出先にAI生成素材の決まりがあるかを、提出前に確認する。
