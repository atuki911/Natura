import type Phaser from 'phaser';
import type { Rng } from '../../sim/rng.ts';
import { COLORS, INK } from '../palette.ts';
import { blobPath, circle, fillStroke, glow, makeTexture, poly, rgba, rng, shaded, tint, type Ctx } from './canvas.ts';

// ステージの背景。
// - bg_stage1「緑の境」: 左は緑の王国、右へ行くほど穢れに侵されていく。
// - bg_region2「腐れ沼」: 夕暮れの沼地。穢れは画面の半ばまで来ている。
// - bg_region3「穢れの心臓」: 夜の嵐。地はほとんど穢れ、地平に巨大な心臓の影。
// どの背景も、道(y 458〜588)・城(x 0〜220)・砦(x 1030〜)・タワーの土台(x 380/590/790)の位置は同じ。
// 城と砦の後ろ、タワーの土台の前後の道の縁には大きな物を置かない。

const W = 1280;
const H = 720;
/** ステージ1で穢れが始まる x。 */
const BLIGHT_X = 870;
/** 地域2・3で穢れが始まる x。 */
const MIRE_X = 520;
const HEART_X = 300;

export function makeBackgroundTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'bg_stage1', W, H, drawStage1);
  makeTexture(scene, 'bg_region2', W, H, drawRegion2);
  makeTexture(scene, 'bg_region3', W, H, drawRegion3);
  makeTexture(scene, 'cloud_0', 190, 80, (ctx) => drawCloud(ctx, 190, 80, rng(11), CLOUD_DAY));
  makeTexture(scene, 'cloud_1', 140, 64, (ctx) => drawCloud(ctx, 140, 64, rng(12), CLOUD_DAY));
  makeTexture(scene, 'cloud_2', 230, 90, (ctx) => drawCloud(ctx, 230, 90, rng(13), CLOUD_DAY));
  makeTexture(scene, 'cloud_blight', 210, 84, (ctx) => drawCloud(ctx, 210, 84, rng(14), CLOUD_BLIGHT));
  makeTexture(scene, 'cloud_dusk', 210, 84, (ctx) => drawCloud(ctx, 210, 84, rng(15), CLOUD_DUSK));
  makeTexture(scene, 'cloud_storm', 230, 90, (ctx) => drawCloud(ctx, 230, 90, rng(16), CLOUD_STORM));
}

// ================================================================
// ステージ1「緑の境」
// ================================================================

function drawStage1(ctx: Ctx): void {
  const r = rng(2024);
  drawSky(ctx);
  drawSun(ctx, 330, 92);
  drawFarMountains(ctx, r);
  drawDistantCastles(ctx);
  drawHills(ctx, r);
  drawRiver(ctx);
  drawMeadow(ctx, r);
  drawTrees(ctx, r);
  drawPath(ctx, r, PATH_SAND);
  drawBlight(ctx, r);
  drawForeground(ctx, r);
}

function drawSky(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, 0, 340);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.6, COLORS.skyMid);
  g.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 右の空は穢れで紫に濁る。
  const b = ctx.createLinearGradient(BLIGHT_X - 260, 0, W, 0);
  b.addColorStop(0, 'rgba(120,70,160,0)');
  b.addColorStop(0.55, 'rgba(120,70,160,0.45)');
  b.addColorStop(1, 'rgba(70,30,100,0.8)');
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, W, 360);
  const low = ctx.createLinearGradient(0, 200, 0, 340);
  low.addColorStop(0, 'rgba(160,220,120,0)');
  low.addColorStop(1, 'rgba(170,230,140,0.25)');
  ctx.fillStyle = low;
  ctx.fillRect(BLIGHT_X, 200, W - BLIGHT_X, 140);
}

function drawSun(ctx: Ctx, x: number, y: number): void {
  glow(ctx, x, y, 120, '#fff6c8', 0.7);
  circle(ctx, x, y, 34);
  const g = ctx.createRadialGradient(x - 8, y - 8, 4, x, y, 34);
  g.addColorStop(0, '#fffbe0');
  g.addColorStop(1, '#ffe17a');
  fillStroke(ctx, g, 2.5, '#e3b23c');
}

function drawFarMountains(ctx: Ctx, r: Rng): void {
  // いちばん遠い青い山並み
  ridge(ctx, r, 300, -20, W + 20, [
    [90, 230],
    [230, 270],
    [380, 205],
    [520, 262],
    [700, 215],
    [880, 258],
    [1040, 210],
    [1200, 250],
  ]);
  fillStroke(ctx, COLORS.mountainFar, 2, tint(COLORS.mountainFar, -0.35));

  // 手前の緑の山(左側の大きな山)
  const peaks: [number, number, number][] = [
    [70, 150, 120],
    [235, 175, 110],
    [400, 215, 90],
  ];
  for (const [x, y, w] of peaks) {
    ctx.beginPath();
    ctx.moveTo(x - w * 1.3, 320);
    ctx.bezierCurveTo(x - w * 0.6, 260, x - w * 0.35, y + 8, x, y);
    ctx.bezierCurveTo(x + w * 0.35, y + 8, x + w * 0.6, 260, x + w * 1.3, 320);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - w, y, x + w, 320);
    g.addColorStop(0, '#9fdc7c');
    g.addColorStop(0.55, COLORS.mountain);
    g.addColorStop(1, '#5ea852');
    fillStroke(ctx, g, 2.5);
    // 山肌の筋
    ctx.strokeStyle = rgba('#3d7a3a', 0.45);
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const sx = x + r.range(-w * 0.3, w * 0.3);
      ctx.beginPath();
      ctx.moveTo(sx, y + 30 + i * 12);
      ctx.quadraticCurveTo(sx + r.range(-14, 14), y + 70, sx + r.range(-20, 20), 300);
      ctx.stroke();
    }
    // 雪のかわりに明るい頂
    ctx.beginPath();
    ctx.moveTo(x - w * 0.18, y + 22);
    ctx.quadraticCurveTo(x, y - 2, x + w * 0.18, y + 22);
    ctx.quadraticCurveTo(x + w * 0.05, y + 30, x - w * 0.02, y + 24);
    ctx.quadraticCurveTo(x - w * 0.1, y + 32, x - w * 0.18, y + 22);
    ctx.fillStyle = '#d5f5b8';
    ctx.fill();
  }

  // 右の遠い山は穢れの色
  ridge(ctx, r, 312, BLIGHT_X - 40, W + 20, [
    [960, 228],
    [1080, 268],
    [1180, 206],
    [1260, 250],
  ]);
  fillStroke(ctx, '#7d6597', 2.5);
}

function drawDistantCastles(ctx: Ctx): void {
  // 遠くの味方の城
  const c = '#9fb2dc';
  spire(ctx, 560, 268, 46, 16, c);
  spire(ctx, 590, 268, 70, 20, c);
  spire(ctx, 622, 268, 38, 14, c);
  ctx.fillStyle = c;
  ctx.fillRect(552, 236, 78, 34);
  ctx.strokeStyle = tint(c, -0.3);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(552, 236, 78, 34);
  ctx.fillStyle = '#6f80b0';
  ctx.fillRect(586, 210, 6, 10);
  // 遠くの穢れの塔
  const d = '#9a78b8';
  spire(ctx, 1000, 262, 64, 18, d);
  spire(ctx, 1028, 262, 40, 14, d);
  glow(ctx, 1000, 210, 20, COLORS.blightGlow, 0.5);
}

function drawHills(ctx: Ctx, r: Rng): void {
  // 中景のなだらかな丘
  rollingHills(ctx, [
    { y: 300, fill: '#8fd469', amp: 22, seed: 1 },
    { y: 330, fill: '#7ac85a', amp: 18, seed: 2 },
  ]);
  // 丘の上の小さな木
  for (let i = 0; i < 16; i++) {
    const x = r.range(20, BLIGHT_X - 60);
    const y = 300 + Math.sin(x * 0.01) * 12 + r.range(0, 30);
    smallTree(ctx, x, y, r.range(0.45, 0.7), r);
  }
}

function drawRiver(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-10, 352);
  ctx.bezierCurveTo(200, 330, 340, 380, 560, 352);
  ctx.bezierCurveTo(700, 336, 820, 360, 940, 350);
  ctx.quadraticCurveTo(990, 352, 1010, 362);
  ctx.quadraticCurveTo(980, 370, 940, 372);
  ctx.bezierCurveTo(820, 386, 700, 362, 560, 378);
  ctx.bezierCurveTo(340, 404, 200, 356, -10, 384);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 980, 0);
  g.addColorStop(0, COLORS.water);
  g.addColorStop(0.8, COLORS.water);
  g.addColorStop(1, '#7a5aa0');
  fillStroke(ctx, g, 2.5);
  ctx.strokeStyle = rgba(COLORS.waterLight, 0.9);
  ctx.lineWidth = 2.5;
  for (const [x, y, w] of [
    [60, 368, 50],
    [230, 362, 36],
    [420, 376, 60],
    [640, 360, 40],
    [780, 362, 30],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 4, x + w, y);
    ctx.stroke();
  }
}

function drawMeadow(ctx: Ctx, r: Rng): void {
  const g = ctx.createLinearGradient(0, 390, 0, 600);
  g.addColorStop(0, COLORS.grass);
  g.addColorStop(1, '#6fbe4c');
  groundFill(ctx, g);
  grassTufts(ctx, r, 260, 0, W, rgba(COLORS.grassDark, 0.55), rgba(COLORS.grassLight, 0.8));
  // 花
  for (let i = 0; i < 40; i++) {
    const x = r.range(0, BLIGHT_X - 40);
    const y = r.range(405, 450);
    circle(ctx, x, y, 2.2);
    ctx.fillStyle = r.chance(0.5) ? '#fff6a0' : '#ffd0e8';
    ctx.fill();
  }
}

function drawTrees(ctx: Ctx, r: Rng): void {
  bigTree(ctx, 318, 432, 0.95, r);
  bigTree(ctx, 690, 418, 0.7, r);
  smallTree(ctx, 480, 420, 0.9, r);
  smallTree(ctx, 520, 412, 0.75, r);
  smallTree(ctx, 800, 410, 0.8, r);
  // 茂み
  for (const [x, y, s] of [
    [240, 446, 1],
    [560, 444, 0.8],
    [770, 446, 0.9],
  ]) {
    blobPath(ctx, x, y, 26 * s, 13 * s, r, 9, 0.18);
    fillStroke(ctx, '#57a845', 2);
  }
}

function drawBlight(ctx: Ctx, r: Rng): void {
  // 地面を紫に染める。境目はぎざぎざの触手のように。
  const edge = blightEdge(r, BLIGHT_X);
  blightGround(ctx, edge, BLIGHT_X, ['#b496cc', '#8e6aaa', '#6c4c88']);
  blightRoots(ctx, r, BLIGHT_X, 9);

  // 紫の水たまり
  for (const [x, y, w] of [
    [960, 520, 46],
    [1080, 556, 60],
    [1030, 470, 30],
    [1200, 500, 40],
  ]) {
    blightPool(ctx, x, y, w);
  }

  // 枯れ木
  for (const [x, y, s] of [
    [930, 430, 0.9],
    [1110, 410, 1.1],
    [1240, 440, 0.8],
  ]) {
    deadTree(ctx, x, y, s, r);
  }

  // 光るきのこ
  for (const [x, y, s] of [
    [900, 452, 0.8],
    [985, 448, 1],
    [1060, 600, 1.2],
    [1160, 452, 0.9],
    [1215, 596, 1],
  ]) {
    mushroom(ctx, x, y, s);
  }

  // とげ
  for (const [x, y] of [
    [1020, 450],
    [1140, 458],
    [1260, 452],
  ]) {
    thorn(ctx, x, y, 26, 6);
  }
}

function drawForeground(ctx: Ctx, r: Rng): void {
  // 手前の茂みと岩(下の方は HUD に隠れる)
  for (const [x, y, w, c] of [
    [40, 604, 80, '#4c9a3e'],
    [180, 610, 70, '#57a845'],
    [520, 612, 60, '#4c9a3e'],
    [760, 606, 70, '#57a845'],
  ] as [number, number, number, string][]) {
    blobPath(ctx, x, y, w, 26, r, 11, 0.2);
    fillStroke(ctx, c, 2.5);
  }
  for (const [x, y, w, c] of [
    [1000, 606, 70, '#4a2f5c'],
    [1180, 612, 80, '#3f2850'],
  ] as [number, number, number, string][]) {
    blobPath(ctx, x, y, w, 24, r, 11, 0.25);
    fillStroke(ctx, c, 2.5);
  }
  // 岩
  ctx.beginPath();
  ctx.moveTo(320, 600);
  ctx.quadraticCurveTo(330, 578, 360, 580);
  ctx.quadraticCurveTo(384, 584, 390, 600);
  ctx.closePath();
  fillStroke(ctx, '#9a948e', 2.5);
}

// ================================================================
// 地域2「腐れ沼」: 夕暮れ。穢れは x≈520 から。紫の沼、垂れた枯れ柳、光るきのこ、蛍。
// ================================================================

function drawRegion2(ctx: Ctx): void {
  const r = rng(3031);

  // 空: 上は菫色、地平は橙と桃色。右へ行くほど穢れで暗く濁る。
  const sky = ctx.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, '#4b3680');
  sky.addColorStop(0.42, '#9b5aa2');
  sky.addColorStop(0.75, '#ef8c8e');
  sky.addColorStop(1, '#ffc27c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const murk = ctx.createLinearGradient(MIRE_X - 200, 0, W, 0);
  murk.addColorStop(0, 'rgba(70,30,100,0)');
  murk.addColorStop(0.5, 'rgba(70,30,100,0.4)');
  murk.addColorStop(1, 'rgba(45,18,70,0.75)');
  ctx.fillStyle = murk;
  ctx.fillRect(0, 0, W, 380);
  stars(ctx, r, 26, MIRE_X, W, 10, 130, '#ffe9f6');

  // 沈む太陽(下は山に隠れる)
  glow(ctx, 330, 262, 230, '#ffb36b', 0.6);
  circle(ctx, 330, 262, 50);
  const sun = ctx.createRadialGradient(318, 250, 6, 330, 262, 50);
  sun.addColorStop(0, '#fff2b8');
  sun.addColorStop(1, '#ff9d55');
  fillStroke(ctx, sun, 2.5, '#d8673c');
  ctx.strokeStyle = rgba('#d8673c', 0.55);
  ctx.lineWidth = 3;
  for (const y of [272, 286]) {
    ctx.beginPath();
    ctx.moveTo(300, y);
    ctx.lineTo(360, y);
    ctx.stroke();
  }

  // 遠い山並み(夕日で桃色がかった紫)
  ridge(ctx, r, 300, -20, W + 20, [
    [80, 246],
    [210, 270],
    [460, 232],
    [620, 268],
    [790, 226],
    [960, 258],
    [1120, 214],
    [1230, 246],
  ]);
  const far = ctx.createLinearGradient(0, 0, W, 0);
  far.addColorStop(0, '#b884a6');
  far.addColorStop(0.45, '#9a76a8');
  far.addColorStop(1, '#6a5088');
  fillStroke(ctx, far, 2, '#6a4a7a');
  // 遠くの穢れの塔と枯れ木の影
  spire(ctx, 905, 262, 52, 16, '#7e5f9c');
  spire(ctx, 930, 262, 30, 12, '#7e5f9c');
  glow(ctx, 905, 220, 18, COLORS.blightGlow, 0.5);
  ctx.save();
  ctx.globalAlpha = 0.55;
  deadTree(ctx, 700, 262, 0.55, r, '#5a3f70');
  deadTree(ctx, 1010, 258, 0.5, r, '#4a3260');
  ctx.restore();

  // 中景の丘(左は緑が残り、右は紫に沈む)
  const hillFill = (dark: number) => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, tint('#8cbf5a', dark));
    g.addColorStop(0.3, tint('#7fa457', dark));
    g.addColorStop(0.5, tint('#7a7068', dark));
    g.addColorStop(0.7, tint('#6a4e82', dark));
    g.addColorStop(1, tint('#553a70', dark));
    return g;
  };
  rollingHills(ctx, [
    { y: 302, fill: hillFill(0), amp: 20, seed: 4 },
    { y: 332, fill: hillFill(-0.1), amp: 16, seed: 5 },
  ]);
  for (let i = 0; i < 9; i++) {
    const x = r.range(230, MIRE_X - 60);
    const y = 312 + Math.sin(x * 0.01) * 10 + r.range(0, 22);
    smallTree(ctx, x, y, r.range(0.4, 0.6), r, ['#5f9a46', '#4f8a40']);
  }
  for (let i = 0; i < 6; i++) {
    const x = r.range(MIRE_X + 40, 1000);
    deadTree(ctx, x, 330 + r.range(0, 14), r.range(0.3, 0.42), r, '#3f2c52');
  }

  // 沼(川のかわりの広い水面): 左は緑がかり、右は紫に濁る。夕日の照り返し。
  ctx.beginPath();
  ctx.moveTo(-10, 348);
  ctx.bezierCurveTo(220, 334, 420, 366, 640, 346);
  ctx.bezierCurveTo(820, 332, 1000, 356, W + 10, 344);
  ctx.lineTo(W + 10, 392);
  ctx.bezierCurveTo(1000, 404, 820, 380, 640, 396);
  ctx.bezierCurveTo(420, 414, 220, 384, -10, 398);
  ctx.closePath();
  const water = ctx.createLinearGradient(0, 0, W, 0);
  water.addColorStop(0, '#5a9a8a');
  water.addColorStop(0.35, '#5f7f86');
  water.addColorStop(0.55, '#62558a');
  water.addColorStop(1, '#4a2f6e');
  fillStroke(ctx, water, 2.5);
  ctx.lineWidth = 2.5;
  for (const [x, y, w, c] of [
    [40, 372, 60, '#ffc79a'],
    [200, 380, 44, '#ffc79a'],
    [300, 366, 70, '#ffd9a8'],
    [470, 382, 50, '#f4a6b6'],
    [640, 370, 40, '#d79be0'],
    [820, 366, 36, '#c27be8'],
    [990, 378, 46, '#c27be8'],
  ] as [number, number, number, string][]) {
    ctx.strokeStyle = rgba(c, 0.85);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 4, x + w, y);
    ctx.stroke();
  }

  // 地面(苔むした湿地)
  const ground = ctx.createLinearGradient(0, 0, W, 0);
  ground.addColorStop(0, '#80b252');
  ground.addColorStop(0.38, '#78a24e');
  ground.addColorStop(0.5, '#86866a');
  ground.addColorStop(0.62, '#9a7aa6');
  ground.addColorStop(1, '#8a6aa0');
  groundFill(ctx, ground);
  grassTufts(ctx, r, 160, 0, MIRE_X + 60, rgba('#4a8a3c', 0.6), rgba('#a8d878', 0.75));
  grassTufts(ctx, r, 120, MIRE_X, W, rgba('#3a2450', 0.5), rgba('#b490cc', 0.5));

  // 穢れの地面
  const edge = blightEdge(r, MIRE_X);
  blightGround(ctx, edge, MIRE_X, ['#d6c4e2', '#bca4d0', '#a08abc']);
  blightRoots(ctx, r, MIRE_X, 8);

  // 沼の上の靄
  for (const [x, y, w] of [
    [620, 392, 120],
    [820, 398, 150],
    [1000, 390, 110],
  ]) {
    const m = ctx.createRadialGradient(x, y, 0, x, y, w);
    m.addColorStop(0, 'rgba(225,200,240,0.4)');
    m.addColorStop(1, 'rgba(225,200,240,0)');
    ctx.fillStyle = m;
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 葦(水際)
  for (let i = 0; i < 26; i++) {
    const x = r.range(0, 1000);
    if (x < 230) continue;
    reed(ctx, x, 404 + r.range(-4, 6), r.range(0.7, 1.1), x < MIRE_X ? '#4f8a3c' : '#4a3460', x < MIRE_X ? '#8a5a34' : '#2e1f3c');
  }

  // 沼のよどみ(道の奥)
  for (const [x, y, w] of [
    [482, 432, 38],
    [690, 428, 44],
    [905, 436, 48],
    [1000, 420, 26],
  ]) {
    blightPool(ctx, x, y, w, '#5a3a7a', '#c88cff');
  }

  // 勇気ある緑の木(城のそば)
  bigTree(ctx, 296, 438, 0.82, r);
  smallTree(ctx, 248, 434, 0.75, r);
  for (const [x, y, s] of [
    [236, 448, 0.9],
    [340, 450, 0.6],
  ]) {
    blobPath(ctx, x, y, 26 * s, 13 * s, r, 9, 0.18);
    fillStroke(ctx, '#5aa045', 2);
  }

  // 垂れた枯れ柳
  willow(ctx, 470, 430, 0.95, r, WILLOW_MOSS);
  willow(ctx, 700, 424, 1.05, r, WILLOW_DEAD);
  willow(ctx, 925, 430, 0.85, r, WILLOW_DEAD);

  // 道(ぬかるんだ砂)。穢れの側は少し紫を帯びるが明るさは保つ。
  drawPath(ctx, r, PATH_MUD, (x) => (x < MIRE_X - 20 ? '#4f8a3c' : '#4a3460'));
  pathTint(ctx, MIRE_X - 30, ['#efe2f2', '#dccbe8']);
  // 道のぬかるみ
  for (const [x, y, w] of [
    [640, 530, 34],
    [880, 500, 28],
    [1000, 560, 40],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2);
    fillStroke(ctx, rgba('#8a6a7a', 0.45), 1.5, rgba(INK, 0.35));
  }

  // 光るきのこ(紫と青緑)
  for (const [x, y, s, teal] of [
    [540, 454, 0.8, 0],
    [556, 458, 0.6, 1],
    [660, 452, 1, 0],
    [735, 455, 0.75, 1],
    [850, 456, 0.95, 0],
    [868, 459, 0.6, 0],
    [968, 452, 0.85, 1],
    [610, 600, 1.1, 1],
    [930, 598, 1.2, 0],
  ]) {
    if (teal) mushroom(ctx, x, y, s, '#3fd6b0', '#7dffd8', '#d6fff2');
    else mushroom(ctx, x, y, s);
  }

  // とげ
  for (const [x, y] of [
    [1015, 456],
    [700, 462],
  ]) {
    thorn(ctx, x, y, 22, 5);
  }

  // 手前の茂み・葦・沼(下の方は HUD に隠れる)
  for (const [x, y, w, c] of [
    [40, 606, 80, '#4c8f3e'],
    [190, 612, 70, '#57a045'],
    [470, 610, 60, '#4e5a48'],
    [760, 608, 70, '#4a2f5c'],
    [1000, 606, 70, '#4a2f5c'],
    [1180, 612, 80, '#3f2850'],
  ] as [number, number, number, string][]) {
    blobPath(ctx, x, y, w, 26, r, 11, 0.22);
    fillStroke(ctx, c, 2.5);
  }
  blightPool(ctx, 330, 606, 50, '#4a6a6a', '#9fe0d0');
  for (const x of [300, 360, 560, 840]) reed(ctx, x, 604, 1.1, x < MIRE_X ? '#4f8a3c' : '#4a3460', x < MIRE_X ? '#8a5a34' : '#2e1f3c');

  // 蛍
  fireflies(ctx, r, 46, 230, 1010, 250, 455);
}

// ================================================================
// 地域3「穢れの心臓」: 夜の嵐。穢れは x≈300 から。黒いとげの塔、脈打つ血管、地平の心臓。
// ================================================================

function drawRegion3(ctx: Ctx): void {
  const r = rng(4047);

  // 空: 深い紫の夜。地平は赤紫に光る。
  const sky = ctx.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, '#170c28');
  sky.addColorStop(0.5, '#2f1850');
  sky.addColorStop(0.85, '#5c2c74');
  sky.addColorStop(1, '#8a3f88');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // 左の空だけわずかに青い(王国の名残)
  const left = ctx.createLinearGradient(0, 0, 420, 0);
  left.addColorStop(0, 'rgba(70,110,170,0.35)');
  left.addColorStop(1, 'rgba(70,110,170,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 420, 360);
  stars(ctx, r, 70, 0, W, 6, 240, '#f2e6ff');
  aurora(ctx, r);

  // 遠い稲光
  glow(ctx, 470, 120, 160, '#b58cff', 0.35);
  lightning(ctx, r, 455, 24, 268);
  glow(ctx, 1180, 60, 110, '#b58cff', 0.25);

  // 地平の巨大な心臓
  glow(ctx, 790, 270, 300, '#d04fd0', 0.45);
  heart(ctx, r, 790, 252, 236, 210);
  // 遠さを出す靄
  const haze = ctx.createLinearGradient(0, 120, 0, 320);
  haze.addColorStop(0, 'rgba(92,44,116,0)');
  haze.addColorStop(1, 'rgba(92,44,116,0.5)');
  ctx.fillStyle = haze;
  ctx.fillRect(600, 120, 380, 200);

  // 遠い山並み(ぎざぎざ)
  ridge(ctx, r, 312, -20, W + 20, [
    [70, 258],
    [180, 286],
    [330, 244],
    [470, 290],
    [600, 268],
    [700, 296],
    [880, 290],
    [990, 252],
    [1110, 280],
    [1230, 238],
  ]);
  const far = ctx.createLinearGradient(0, 0, W, 0);
  far.addColorStop(0, '#4a5878');
  far.addColorStop(0.25, '#4a3a68');
  far.addColorStop(1, '#3a2452');
  fillStroke(ctx, far, 2.5, '#1c1430');

  // 中景の丘(左のわずかな緑だけが残る)
  const hillFill = (dark: number) => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, tint('#6f9a52', dark));
    g.addColorStop(0.17, tint('#6c7a5a', dark));
    g.addColorStop(0.3, tint('#5a4670', dark));
    g.addColorStop(1, tint('#47305f', dark));
    return g;
  };
  rollingHills(ctx, [
    { y: 306, fill: hillFill(0), amp: 18, seed: 7 },
    { y: 336, fill: hillFill(-0.12), amp: 14, seed: 8 },
  ]);

  // 黒いとげの塔
  for (const [x, y, h, w, lean] of [
    [470, 352, 150, 26, 14],
    [512, 350, 92, 18, -10],
    [660, 348, 120, 22, -12],
    [870, 352, 196, 30, 18],
    [925, 348, 110, 20, -8],
    [985, 350, 72, 16, 6],
  ]) {
    thornSpire(ctx, r, x, y, h, w, lean);
  }

  // 王国の見張り台の廃墟(左の丘の上)
  outpostRuin(ctx, r, 286, 350);

  // 穢れた川: どろりとした紫。光る筋が流れる。
  ctx.beginPath();
  ctx.moveTo(-10, 354);
  ctx.bezierCurveTo(240, 340, 420, 372, 660, 352);
  ctx.bezierCurveTo(860, 338, 1040, 362, W + 10, 350);
  ctx.lineTo(W + 10, 388);
  ctx.bezierCurveTo(1040, 400, 860, 382, 660, 392);
  ctx.bezierCurveTo(420, 408, 240, 384, -10, 394);
  ctx.closePath();
  const water = ctx.createLinearGradient(0, 0, W, 0);
  water.addColorStop(0, '#4e6a90');
  water.addColorStop(0.22, '#4a3c78');
  water.addColorStop(1, '#3a1f58');
  fillStroke(ctx, water, 2.5);
  ctx.lineWidth = 2.5;
  for (const [x, y, w] of [
    [60, 372, 50],
    [260, 378, 40],
    [420, 382, 64],
    [620, 370, 44],
    [800, 368, 56],
    [1000, 374, 40],
    [1150, 368, 50],
  ]) {
    ctx.strokeStyle = rgba(x < HEART_X ? '#9fc4ff' : '#e07bff', 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 4, x + w, y);
    ctx.stroke();
  }

  // 地面: 左の端だけ色あせた緑、あとは穢れの紫。
  const ground = ctx.createLinearGradient(0, 0, W, 0);
  ground.addColorStop(0, '#7a9e52');
  ground.addColorStop(0.16, '#7a8656');
  ground.addColorStop(0.26, '#76608a');
  ground.addColorStop(1, '#684a84');
  groundFill(ctx, ground);
  const shade = ctx.createLinearGradient(0, 390, 0, 600);
  shade.addColorStop(0, 'rgba(30,10,50,0)');
  shade.addColorStop(1, 'rgba(30,10,50,0.25)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 390, W, 330);
  grassTufts(ctx, r, 70, 0, HEART_X + 20, rgba('#4a7a3a', 0.6), rgba('#a8cc78', 0.6));
  grassTufts(ctx, r, 200, HEART_X - 20, W, rgba('#2a1838', 0.55), rgba('#9a72b8', 0.45));
  const edge = blightEdge(r, HEART_X);
  blightGround(ctx, edge, HEART_X, ['#c6b2d4', '#a58cbc', '#9a80b0']);
  blightRoots(ctx, r, HEART_X, 7);

  // 脈打つ血管(道の奥と手前)
  for (const [x0, y0, x1, y1, w] of [
    [1040, 420, 640, 440, 5],
    [880, 444, 330, 430, 4],
    [620, 412, 380, 418, 3],
    [1040, 600, 420, 606, 5],
    [760, 596, 300, 598, 3.5],
  ]) {
    vein(ctx, r, x0, y0, x1, y1, w);
  }

  // 黒い水たまり
  for (const [x, y, w] of [
    [482, 438, 34],
    [690, 432, 40],
    [960, 440, 44],
  ]) {
    blightPool(ctx, x, y, w, '#3a1c50', '#ff6ad8');
  }

  // 枯れ木
  deadTree(ctx, 560, 420, 0.7, r);
  deadTree(ctx, 728, 414, 0.8, r);
  deadTree(ctx, 1000, 418, 0.7, r);

  // 道(灰色がかった骨色の砂)。暗い兵がよく見えるように明るく保つ。
  drawPath(ctx, r, PATH_ASH, (x) => (x < HEART_X - 30 ? '#5a7a40' : '#3a2a48'));
  pathTint(ctx, HEART_X - 40, ['#f2e8f4', '#e2d2ec']);
  // 道を横切るかすかな血管
  ctx.save();
  ctx.globalAlpha = 0.5;
  vein(ctx, r, 520, 462, 470, 586, 2.2);
  vein(ctx, r, 900, 462, 960, 588, 2.2);
  ctx.restore();

  // とげと光るきのこ(タワーの土台を避ける)
  for (const [x, y, h] of [
    [460, 458, 22],
    [520, 457, 30],
    [680, 460, 26],
    [712, 459, 18],
    [870, 459, 28],
    [985, 455, 32],
    [1012, 457, 20],
  ]) {
    thorn(ctx, x, y, h, h * 0.24, '#241a30');
  }
  for (const [x, y, s] of [
    [500, 456, 0.75],
    [655, 455, 0.9],
    [905, 454, 0.8],
    [700, 600, 1.1],
    [1000, 598, 1.2],
  ]) {
    mushroom(ctx, x, y, s);
  }

  // 手前の黒いとげの茂み(下の方は HUD に隠れる)
  for (const [x, y, w, c] of [
    [40, 606, 80, '#56723e'],
    [190, 612, 70, '#4a5a44'],
    [470, 610, 60, '#3a2650'],
    [800, 606, 70, '#33214a'],
    [1000, 606, 70, '#3a2650'],
    [1180, 612, 80, '#2e1d40'],
  ] as [number, number, number, string][]) {
    blobPath(ctx, x, y, w, 24, r, 11, 0.25);
    fillStroke(ctx, c, 2.5);
  }
  for (const [x, y] of [
    [430, 600],
    [560, 604],
    [840, 600],
    [1080, 602],
  ]) {
    thorn(ctx, x, y, 24, 6, '#241a30');
  }

  // 漂う穢れの光の粒
  fireflies(ctx, r, 30, 300, 1020, 230, 450, '#ff8af0', '#ffe0fb');
}

// ================================================================
// 共通の部品
// ================================================================

function ridge(ctx: Ctx, r: Rng, baseY: number, x0: number, x1: number, peaks: [number, number][]): void {
  ctx.beginPath();
  ctx.moveTo(x0, baseY + 200);
  ctx.lineTo(x0, baseY);
  let prevX = x0;
  let prevY = baseY;
  for (const [px, py] of peaks) {
    const cx = (prevX + px) / 2;
    ctx.bezierCurveTo(cx, prevY, cx, py + r.range(-6, 6), px, py);
    prevX = px;
    prevY = py;
  }
  ctx.bezierCurveTo((prevX + x1) / 2, prevY, (prevX + x1) / 2, baseY, x1, baseY);
  ctx.lineTo(x1, baseY + 200);
  ctx.closePath();
}

function spire(ctx: Ctx, x: number, baseY: number, h: number, w: number, color: string): void {
  poly(ctx, [
    [x - w / 2, baseY],
    [x - w / 2, baseY - h],
    [x - w / 2 - 3, baseY - h],
    [x, baseY - h - w * 1.3],
    [x + w / 2 + 3, baseY - h],
    [x + w / 2, baseY - h],
    [x + w / 2, baseY],
  ]);
  fillStroke(ctx, color, 1.5, tint(color, -0.3));
}

type HillLayer = { y: number; fill: string | CanvasGradient; amp: number; seed: number };

/** 横いっぱいのなだらかな丘を重ねる。 */
function rollingHills(ctx: Ctx, layers: HillLayer[]): void {
  for (const layer of layers) {
    ctx.beginPath();
    ctx.moveTo(-10, H);
    ctx.lineTo(-10, layer.y);
    const segs = 7;
    for (let i = 0; i <= segs; i++) {
      const x = (i / segs) * (W + 20);
      const y = layer.y + Math.sin(i * 1.7 + layer.seed) * layer.amp;
      const px = ((i - 0.5) / segs) * (W + 20);
      ctx.quadraticCurveTo(px, y - layer.amp * 0.8, x, y);
    }
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    fillStroke(ctx, layer.fill, 2.5);
  }
}

/** 道の手前まで続く地面の面。 */
function groundFill(ctx: Ctx, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(-10, 400);
  ctx.bezierCurveTo(300, 380, 700, 410, W + 10, 392);
  ctx.lineTo(W + 10, H);
  ctx.lineTo(-10, H);
  ctx.closePath();
  fillStroke(ctx, fill, 2.5);
}

/** 草の筆跡(y 400〜600 に散らす)。 */
function grassTufts(ctx: Ctx, r: Rng, n: number, x0: number, x1: number, dark: string, light: string): void {
  for (let i = 0; i < n; i++) {
    const x = r.range(x0, x1);
    const y = r.range(400, 600);
    ctx.strokeStyle = r.chance(0.5) ? dark : light;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y - 6);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 4, y - 7);
    ctx.stroke();
  }
}

function smallTree(ctx: Ctx, x: number, y: number, s: number, r: Rng, leaves: [string, string] = ['#5eb048', '#4fa041']): void {
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(x - 2 * s, y - 10 * s, 4 * s, 12 * s);
  blobPath(ctx, x, y - 22 * s, 16 * s, 15 * s, r, 8, 0.15);
  fillStroke(ctx, r.chance(0.5) ? leaves[0] : leaves[1], 2);
}

function bigTree(ctx: Ctx, x: number, y: number, s: number, r: Rng): void {
  // 幹
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y);
  ctx.quadraticCurveTo(x - 6 * s, y - 40 * s, x - 18 * s, y - 70 * s);
  ctx.lineTo(x - 8 * s, y - 74 * s);
  ctx.quadraticCurveTo(x, y - 55 * s, x + 6 * s, y - 80 * s);
  ctx.lineTo(x + 14 * s, y - 76 * s);
  ctx.quadraticCurveTo(x + 8 * s, y - 40 * s, x + 12 * s, y);
  ctx.closePath();
  fillStroke(ctx, COLORS.wood, 2.5);
  ctx.strokeStyle = rgba(COLORS.woodDark, 0.8);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y - 6 * s);
  ctx.quadraticCurveTo(x, y - 30 * s, x - 6 * s, y - 50 * s);
  ctx.stroke();
  // 葉のかたまり
  const clusters: [number, number, number][] = [
    [-34, -88, 30],
    [30, -92, 32],
    [-4, -120, 36],
    [0, -84, 30],
  ];
  for (const [dx, dy, rad] of clusters) {
    const cx = x + dx * s;
    const cy = y + dy * s;
    shaded(ctx, () => blobPath(ctx, cx, cy, rad * s, rad * 0.88 * s, r, 9, 0.14), '#5fb848', {
      light: '#8bd866',
      dark: '#3f8f37',
      lineWidth: 2.5,
      box: [cx - rad * s, cy - rad * s, rad * 2 * s, rad * 2 * s],
    });
  }
}

type WillowColors = { trunk: string; strand: string; strandLight: string };
const WILLOW_DEAD: WillowColors = { trunk: '#4e3d5c', strand: '#7c6a94', strandLight: '#a08cb8' };
const WILLOW_MOSS: WillowColors = { trunk: '#5a4a50', strand: '#7d8458', strandLight: '#a4ac74' };

/** 垂れた枯れ柳。曲がった幹から弧を描く枝が伸び、細い枝が簾のように垂れる。 */
function willow(ctx: Ctx, x: number, y: number, s: number, r: Rng, c: WillowColors): void {
  // 幹
  ctx.beginPath();
  ctx.moveTo(x - 16 * s, y + 2);
  ctx.quadraticCurveTo(x - 4 * s, y - 40 * s, x - 14 * s, y - 84 * s);
  ctx.lineTo(x - 2 * s, y - 92 * s);
  ctx.quadraticCurveTo(x + 10 * s, y - 50 * s, x + 16 * s, y + 2);
  ctx.closePath();
  fillStroke(ctx, c.trunk, 2.5);
  ctx.strokeStyle = rgba(INK, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 4 * s, y - 4 * s);
  ctx.quadraticCurveTo(x + 6 * s, y - 40 * s, x - 2 * s, y - 70 * s);
  ctx.stroke();
  // うろ
  ctx.beginPath();
  ctx.ellipse(x - 3 * s, y - 36 * s, 3.5 * s, 6 * s, 0.1, 0, Math.PI * 2);
  fillStroke(ctx, '#241a2e', 1.5);

  // 弧を描く枝
  const tx = x - 8 * s;
  const ty = y - 90 * s;
  const arms: [number, number, number][] = [
    [-78, -6, -40],
    [-44, -34, -64],
    [12, -40, -70],
    [58, -22, -54],
    [86, 4, -30],
  ];
  const curves: [number, number, number, number, number, number][] = [];
  for (const [dx, dy, cy] of arms) {
    curves.push([tx, ty, tx + dx * 0.45 * s, ty + cy * s, tx + dx * s, ty + dy * s]);
  }
  // 垂れる枝(簾)
  const strands: [number, number, number, number, number, boolean][] = [];
  for (const [x0, y0, cx, cy, x1, y1] of curves) {
    for (let k = 0; k < 9; k++) {
      const t = 0.25 + (k / 8) * 0.75;
      const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      const len = r.range(46, 92) * s * (0.6 + t * 0.4);
      strands.push([px, py, len, r.range(-6, 6) * s, r.range(4, 6) * s, r.chance(0.3)]);
    }
  }
  const strandPath = (px: number, py: number, len: number, sway: number) => {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + sway, py + len * 0.5, px + sway * 0.4, py + len);
  };
  // 先に輪郭をまとめて引き、上から色を塗ると簾がひとかたまりに見える。
  ctx.strokeStyle = INK;
  for (const [x0, y0, cx, cy, x1, y1] of curves) {
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }
  for (const [px, py, len, sway, w] of strands) {
    ctx.lineWidth = w + 3;
    strandPath(px, py, len, sway);
    ctx.stroke();
  }
  for (const [px, py, len, sway, w, light] of strands) {
    ctx.strokeStyle = light ? c.strandLight : c.strand;
    ctx.lineWidth = w;
    strandPath(px, py, len, sway);
    ctx.stroke();
  }
  ctx.strokeStyle = c.trunk;
  for (const [x0, y0, cx, cy, x1, y1] of curves) {
    ctx.lineWidth = 3.5 * s;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }
}

/** 葦(がま)。 */
function reed(ctx: Ctx, x: number, y: number, s: number, stem: string, head: string): void {
  ctx.lineCap = 'round';
  for (const [dx, h, lean] of [
    [0, 34, -3],
    [5, 26, 4],
    [-5, 22, -7],
  ]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(x + dx * s, y);
    ctx.quadraticCurveTo(x + dx * s, y - h * 0.6 * s, x + (dx + lean) * s, y - h * s);
    ctx.stroke();
    ctx.strokeStyle = stem;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(x - 3 * s, y - 30 * s, 2.6 * s, 6 * s, -0.1, 0, Math.PI * 2);
  fillStroke(ctx, head, 1.5);
}

type PathStyle = { stops: [string, string, string, string]; rut: string; pebbles: [string, string] };
const PATH_SAND: PathStyle = { stops: [COLORS.pathDark, COLORS.path, COLORS.pathLight, COLORS.path], rut: rgba(COLORS.pathDark, 0.5), pebbles: ['#c9a87a', '#b8946a'] };
const PATH_MUD: PathStyle = { stops: ['#a8865e', '#d8bb8c', '#ead2a4', '#d4b484'], rut: rgba('#9a7650', 0.5), pebbles: ['#b89670', '#9c7c5a'] };
const PATH_ASH: PathStyle = { stops: ['#a8927e', '#d8c8b6', '#ebdfd0', '#d6c4b0'], rut: rgba('#9a8070', 0.5), pebbles: ['#c0aa98', '#a89080'] };

function pathEdge(x: number, top: boolean): number {
  return top ? 458 + Math.sin(x * 0.012) * 5 + Math.sin(x * 0.041) * 2 : 588 + Math.sin(x * 0.009 + 1) * 6;
}

function pathShape(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-10, pathEdge(-10, true));
  for (let x = 0; x <= W + 10; x += 20) ctx.lineTo(x, pathEdge(x, true));
  for (let x = W + 10; x >= -10; x -= 20) ctx.lineTo(x, pathEdge(x, false));
  ctx.closePath();
}

/** 兵が歩く道。edgeGrass は道の縁の草の色(x ごと)。 */
function drawPath(ctx: Ctx, r: Rng, style: PathStyle, edgeGrass: (x: number) => string = () => COLORS.grassDark): void {
  pathShape(ctx);
  const g = ctx.createLinearGradient(0, 458, 0, 590);
  g.addColorStop(0, style.stops[0]);
  g.addColorStop(0.12, style.stops[1]);
  g.addColorStop(0.7, style.stops[2]);
  g.addColorStop(1, style.stops[3]);
  fillStroke(ctx, g, 3);
  // わだち
  ctx.strokeStyle = style.rut;
  ctx.lineWidth = 2;
  for (const y of [498, 548]) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const yy = y + Math.sin(x * 0.01 + y) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // 小石
  for (let i = 0; i < 70; i++) {
    const x = r.range(0, W);
    const y = r.range(468, 584);
    ctx.beginPath();
    ctx.ellipse(x, y, r.range(2, 4.5), r.range(1.5, 3), 0, 0, Math.PI * 2);
    fillStroke(ctx, r.chance(0.5) ? style.pebbles[0] : style.pebbles[1], 1, rgba(INK, 0.6));
  }
  // 道の縁の草
  for (let x = 0; x < W; x += 9) {
    const y = pathEdge(x, true);
    ctx.strokeStyle = edgeGrass(x);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + r.range(-3, 3), y - r.range(3, 8));
    ctx.stroke();
  }
}

/** 道の x0 から右を、明るさを保ったまま薄く紫に染める。 */
function pathTint(ctx: Ctx, x0: number, colors: [string, string]): void {
  ctx.save();
  pathShape(ctx);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(x0, 0, W, 0);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.15, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x0, 440, W - x0, 160);
  ctx.restore();
}

/** 穢れの境目(ぎざぎざ)の点の並び。 */
function blightEdge(r: Rng, bx: number): [number, number][] {
  const edge: [number, number][] = [];
  for (let y = 300; y <= H; y += 16) {
    const inset = y < 400 ? (400 - y) * 0.9 : 0;
    edge.push([bx + inset + Math.sin(y * 0.09) * 26 + (y > 450 && y < 600 ? -30 : 0) + r.range(-10, 10), y]);
  }
  return edge;
}

/** 境目から右の地面を乗算で紫に染め、境目をぼかす。 */
function blightGround(ctx: Ctx, edge: [number, number][], bx: number, stops: [string, string, string]): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W + 10, 300);
  for (const [x, y] of edge) ctx.lineTo(x, y);
  ctx.lineTo(W + 10, H);
  ctx.closePath();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(bx - 40, 0, W, 0);
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.35, stops[1]);
  g.addColorStop(1, stops[2]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // 境目をぼかす(上の方ほど薄く)
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(W + 10, 280);
    for (const [x, y] of edge) ctx.lineTo(x - 24 - i * 22, y);
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    ctx.fillStyle = 'rgba(190,160,215,0.35)';
    ctx.fill();
  }
  ctx.restore();
}

/** 境目から左へ伸びる黒い根。 */
function blightRoots(ctx: Ctx, r: Rng, bx: number, n: number): void {
  ctx.strokeStyle = rgba('#2a1838', 0.75);
  for (let i = 0; i < n; i++) {
    const y = r.range(400, 590);
    let x = bx + r.range(-10, 30);
    ctx.lineWidth = r.range(2, 4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    let yy = y;
    for (let k = 0; k < 4; k++) {
      x -= r.range(14, 30);
      yy += r.range(-10, 10);
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

/** 紫の水たまり。 */
function blightPool(ctx: Ctx, x: number, y: number, w: number, color = '#6b2f8a', shine: string = COLORS.blightGlow): void {
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.28, 0, 0, Math.PI * 2);
  fillStroke(ctx, color, 2);
  ctx.beginPath();
  ctx.ellipse(x - w * 0.25, y - w * 0.06, w * 0.35, w * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba(shine, 0.6);
  ctx.fill();
}

function deadTree(ctx: Ctx, x: number, y: number, s: number, r: Rng, color = '#231a2e'): void {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const branch = (bx: number, by: number, angle: number, len: number, width: number, depth: number) => {
    const ex = bx + Math.cos(angle) * len;
    const ey = by + Math.sin(angle) * len;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo((bx + ex) / 2 + r.range(-6, 6), (by + ey) / 2, ex, ey);
    ctx.stroke();
    if (depth > 0) {
      branch(ex, ey, angle - r.range(0.3, 0.7), len * 0.65, width * 0.65, depth - 1);
      branch(ex, ey, angle + r.range(0.3, 0.7), len * 0.6, width * 0.6, depth - 1);
    }
  };
  branch(x, y, -Math.PI / 2, 46 * s, 9 * s, 3);
}

function mushroom(ctx: Ctx, x: number, y: number, s: number, cap = '#d65cff', light: string = COLORS.blightGlow, dot = '#ffd6ff'): void {
  glow(ctx, x, y - 14 * s, 26 * s, light, 0.55);
  ctx.beginPath();
  ctx.moveTo(x - 3 * s, y);
  ctx.quadraticCurveTo(x - 4 * s, y - 8 * s, x - 2 * s, y - 14 * s);
  ctx.lineTo(x + 2 * s, y - 14 * s);
  ctx.quadraticCurveTo(x + 4 * s, y - 8 * s, x + 3 * s, y);
  ctx.closePath();
  fillStroke(ctx, '#e8d8f0', 1.8);
  ctx.beginPath();
  ctx.ellipse(x, y - 15 * s, 10 * s, 7 * s, 0, Math.PI, 0);
  ctx.closePath();
  fillStroke(ctx, cap, 1.8);
  circle(ctx, x - 3 * s, y - 18 * s, 1.8 * s);
  ctx.fillStyle = dot;
  ctx.fill();
}

/** 地面から生える黒いとげ。 */
function thorn(ctx: Ctx, x: number, y: number, h: number, w: number, color = '#3a2a48'): void {
  poly(ctx, [
    [x - w, y],
    [x - 1, y - h],
    [x + w, y],
  ]);
  fillStroke(ctx, color, 2);
}

/** 黒いとげの塔。曲がった細い芯の左右に小さなとげが出る。 */
function thornSpire(ctx: Ctx, r: Rng, x: number, baseY: number, h: number, w: number, lean: number): void {
  const n = 14;
  const leftSide: [number, number][] = [];
  const rightSide: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x + lean * t * t;
    const cy = baseY - h * t;
    const half = (w / 2) * Math.pow(1 - t, 0.85);
    leftSide.push([cx - half, cy]);
    rightSide.push([cx + half, cy]);
    if (i > 1 && i < n - 1 && r.chance(0.45)) {
      const len = w * r.range(0.5, 0.9) * (1 - t * 0.5);
      if (r.chance(0.5)) leftSide.push([cx - half - len, cy - len * 0.9], [cx - half, cy - h / n / 2]);
      else rightSide.push([cx + half + len, cy - len * 0.9], [cx + half, cy - h / n / 2]);
    }
  }
  const pts: [number, number][] = [...leftSide, ...rightSide.reverse()];
  poly(ctx, pts);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#3e3050');
  g.addColorStop(0.45, '#241a30');
  g.addColorStop(1, '#16101e');
  fillStroke(ctx, g, 2.5);
  // 光の筋
  ctx.strokeStyle = rgba('#b07ad8', 0.45);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= n - 3; i++) {
    const t = i / n;
    const px = x + lean * t * t - (w / 2) * Math.pow(1 - t, 0.85) * 0.45;
    const py = baseY - h * t;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/** 王国の見張り台の廃墟。折れた石の塔と、破れた青い旗。 */
function outpostRuin(ctx: Ctx, r: Rng, x: number, baseY: number): void {
  const stone = '#9c95a4';
  // 崩れた壁
  poly(ctx, [
    [x + 20, baseY],
    [x + 20, baseY - 24],
    [x + 30, baseY - 30],
    [x + 38, baseY - 22],
    [x + 48, baseY - 18],
    [x + 60, baseY - 10],
    [x + 62, baseY],
  ]);
  fillStroke(ctx, tint(stone, -0.12), 2.5);
  // 折れた塔
  const tw = 34;
  const tl = x - tw / 2;
  poly(ctx, [
    [tl, baseY],
    [tl, baseY - 66],
    [tl + 6, baseY - 74],
    [tl + 12, baseY - 64],
    [tl + 20, baseY - 72],
    [tl + 26, baseY - 56],
    [tl + tw, baseY - 50],
    [tl + tw, baseY],
  ]);
  const g = ctx.createLinearGradient(tl, 0, tl + tw, 0);
  g.addColorStop(0, tint(stone, 0.2));
  g.addColorStop(0.6, stone);
  g.addColorStop(1, tint(stone, -0.25));
  fillStroke(ctx, g, 2.5);
  // 石の目地とひび
  ctx.strokeStyle = rgba(INK, 0.3);
  ctx.lineWidth = 1.3;
  for (let yy = baseY - 12; yy > baseY - 56; yy -= 12) {
    ctx.beginPath();
    ctx.moveTo(tl, yy);
    ctx.lineTo(tl + tw, yy);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(tl + 22, baseY - 58);
  ctx.lineTo(tl + 18, baseY - 44);
  ctx.lineTo(tl + 24, baseY - 34);
  ctx.stroke();
  // 窓
  ctx.beginPath();
  ctx.moveTo(tl + 10, baseY - 26);
  ctx.lineTo(tl + 10, baseY - 38);
  ctx.arc(tl + 15, baseY - 38, 5, Math.PI, 0);
  ctx.lineTo(tl + 20, baseY - 26);
  ctx.closePath();
  fillStroke(ctx, '#2a2433', 1.5);
  // 傾いた旗竿と破れた旗
  const px = tl + 6;
  const py = baseY - 72;
  const tx = px - 10;
  const ty = py - 46;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.strokeStyle = COLORS.woodDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  poly(ctx, [
    [tx + 1, ty + 2],
    [tx + 26, ty + 8],
    [tx + 20, ty + 13],
    [tx + 27, ty + 18],
    [tx + 14, ty + 19],
    [tx + 16, ty + 24],
    [tx + 3, ty + 20],
  ]);
  fillStroke(ctx, '#3a6cc0', 2);
  circle(ctx, tx + 10, ty + 12, 2.6);
  ctx.fillStyle = COLORS.gold;
  ctx.fill();
  // がれき
  for (let i = 0; i < 6; i++) {
    const bx = x + r.range(-30, 66);
    ctx.beginPath();
    ctx.ellipse(bx, baseY + r.range(-2, 3), r.range(4, 7), r.range(3, 4.5), r.range(-0.4, 0.4), 0, Math.PI * 2);
    fillStroke(ctx, tint(stone, r.range(-0.2, 0.05)), 1.8);
  }
  // 絡みつく穢れのつる
  ctx.strokeStyle = rgba('#2a1838', 0.85);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(tl + tw + 4, baseY + 2);
  ctx.bezierCurveTo(tl + tw - 4, baseY - 14, tl + tw + 4, baseY - 26, tl + tw - 6, baseY - 40);
  ctx.stroke();
}

/** 脈打つ血管。暗い外皮、光る芯、ところどころに膨らみ。 */
function vein(ctx: Ctx, r: Rng, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const pts: [number, number][] = [];
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 34));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const wob = i === 0 || i === n ? 0 : r.range(-9, 9);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    pts.push([x0 + dx * t + (-dy / len) * wob, y0 + dy * t + (dx / len) * wob]);
  }
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
  };
  // 枝分かれ
  const branches: [number, number, number, number][] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    if (!r.chance(0.4)) continue;
    const [bx, by] = pts[i];
    branches.push([bx, by, bx + r.range(-30, 30), by + r.range(-14, 14)]);
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2a1238';
  ctx.lineWidth = w + 3;
  trace();
  ctx.stroke();
  ctx.lineWidth = w * 0.7 + 2;
  for (const [bx, by, ex, ey] of branches) {
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c94fc8';
  ctx.lineWidth = w * 0.55;
  trace();
  ctx.stroke();
  ctx.lineWidth = w * 0.35;
  for (const [bx, by, ex, ey] of branches) {
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  // 脈の膨らみ
  for (let i = 1; i < pts.length - 1; i += 2) {
    const [bx, by] = pts[i];
    glow(ctx, bx, by, w * 3.2, '#ff6ad8', 0.5);
    ctx.beginPath();
    ctx.ellipse(bx, by, w * 1.1, w * 0.8, 0, 0, Math.PI * 2);
    fillStroke(ctx, '#e070e0', 1.5, '#2a1238');
  }
}

/** 地平に見える巨大な心臓の影。 */
function heart(ctx: Ctx, r: Rng, cx: number, cy: number, w: number, h: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.12);
  const body = '#33183f';
  // 太い管(後ろ)
  const tube = (x0: number, y0: number, c1x: number, c1y: number, x1: number, y1: number, tw: number) => {
    ctx.lineCap = 'butt';
    ctx.strokeStyle = INK;
    ctx.lineWidth = tw + 5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(c1x, c1y, x1, y1);
    ctx.stroke();
    ctx.strokeStyle = '#3e1f4c';
    ctx.lineWidth = tw;
    ctx.stroke();
    ctx.strokeStyle = rgba('#7a4a90', 0.6);
    ctx.lineWidth = tw * 0.25;
    ctx.beginPath();
    ctx.moveTo(x0 - tw * 0.2, y0);
    ctx.quadraticCurveTo(c1x - tw * 0.2, c1y, x1 - tw * 0.2, y1);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(x1, y1, tw / 2, tw * 0.2, 0, 0, Math.PI * 2);
    fillStroke(ctx, '#1e0f28', 2.5);
  };
  tube(-w * 0.08, -h * 0.2, -w * 0.1, -h * 0.55, -w * 0.28, -h * 0.66, 30);
  tube(w * 0.1, -h * 0.22, w * 0.14, -h * 0.6, w * 0.02, -h * 0.74, 34);
  tube(w * 0.22, -h * 0.2, w * 0.34, -h * 0.4, w * 0.42, -h * 0.56, 22);
  // 本体
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.28);
    ctx.bezierCurveTo(-w * 0.1, -h * 0.6, -w * 0.56, -h * 0.58, -w * 0.52, -h * 0.1);
    ctx.bezierCurveTo(-w * 0.48, h * 0.22, -w * 0.16, h * 0.38, w * 0.04, h * 0.52);
    ctx.bezierCurveTo(w * 0.22, h * 0.34, w * 0.54, h * 0.18, w * 0.5, -h * 0.14);
    ctx.bezierCurveTo(w * 0.5, -h * 0.58, w * 0.1, -h * 0.6, 0, -h * 0.28);
    ctx.closePath();
  };
  shaded(ctx, path, body, { light: '#5a2c6c', dark: '#220f2c', lineWidth: 3, lightOffset: [0.3, 0.3], box: [-w / 2, -h / 2, w, h] });
  // 光るひび(脈)
  ctx.save();
  path();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const cracks: [number, number][][] = [];
  for (const [sx, sy] of [
    [-w * 0.05, -h * 0.25],
    [w * 0.12, -h * 0.2],
    [-w * 0.3, -h * 0.25],
  ]) {
    const line: [number, number][] = [[sx, sy]];
    let px = sx;
    let py = sy;
    for (let k = 0; k < 5; k++) {
      px += r.range(-20, 20);
      py += r.range(18, 34);
      line.push([px, py]);
    }
    cracks.push(line);
  }
  for (const [width, color, alpha] of [
    [9, '#c040c0', 0.35],
    [3, '#ff8af0', 0.9],
  ] as [number, string, number][]) {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width;
    for (const line of cracks) {
      ctx.beginPath();
      ctx.moveTo(line[0][0], line[0][1]);
      for (const [px, py] of line.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();
}

/** オーロラ(緑から紫へ)の帯。 */
function aurora(ctx: Ctx, r: Rng): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bands: [number, number, number, number, number][] = [
    [70, 26, 0.006, 70, 0.32],
    [130, 18, 0.009, 50, 0.22],
  ];
  for (const [baseY, amp, freq, len, alpha] of bands) {
    const phase = r.range(0, 6);
    for (let x = 0; x <= W; x += 4) {
      const fade = Math.min(1, x / 200, (W - x) / 160);
      const y = baseY + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
      const l = len * (0.7 + 0.3 * Math.sin(x * 0.05 + phase));
      const g = ctx.createLinearGradient(0, y, 0, y + l);
      g.addColorStop(0, rgba('#6dffb4', 0));
      g.addColorStop(0.2, rgba('#6dffb4', alpha * fade));
      g.addColorStop(0.6, rgba('#9a6aff', alpha * 0.6 * fade));
      g.addColorStop(1, rgba('#9a6aff', 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + l);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 遠くの稲妻(ぎざぎざの光の線)。 */
function lightning(ctx: Ctx, r: Rng, x: number, y0: number, y1: number): void {
  const pts: [number, number][] = [[x, y0]];
  let px = x;
  for (let y = y0 + 22; y < y1; y += r.range(18, 30)) {
    px += r.range(-16, 16);
    pts.push([px, y]);
  }
  pts.push([px + r.range(-8, 8), y1]);
  const trace = (from = 0) => {
    ctx.beginPath();
    ctx.moveTo(pts[from][0], pts[from][1]);
    for (const [qx, qy] of pts.slice(from + 1)) ctx.lineTo(qx, qy);
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = rgba('#b58cff', 0.35);
  ctx.lineWidth = 9;
  trace();
  ctx.stroke();
  ctx.strokeStyle = rgba('#f4ecff', 0.95);
  ctx.lineWidth = 2.5;
  trace();
  ctx.stroke();
  // 枝
  const [bx, by] = pts[Math.floor(pts.length / 2)];
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + 18, by + 16);
  ctx.lineTo(bx + 26, by + 38);
  ctx.stroke();
  ctx.restore();
}

function stars(ctx: Ctx, r: Rng, n: number, x0: number, x1: number, y0: number, y1: number, color: string): void {
  for (let i = 0; i < n; i++) {
    const x = r.range(x0, x1);
    const y = r.range(y0, y1);
    const big = r.chance(0.2);
    circle(ctx, x, y, big ? 1.8 : 1.1);
    ctx.fillStyle = rgba(color, big ? 0.95 : r.range(0.4, 0.8));
    ctx.fill();
    if (big) glow(ctx, x, y, 6, color, 0.4);
  }
}

/** 蛍(光の点)。 */
function fireflies(ctx: Ctx, r: Rng, n: number, x0: number, x1: number, y0: number, y1: number, color = '#e8ff7a', core = '#fffde0'): void {
  for (let i = 0; i < n; i++) {
    const x = r.range(x0, x1);
    const y = r.range(y0, y1);
    const s = r.range(0.7, 1.3);
    glow(ctx, x, y, 9 * s, color, 0.55);
    circle(ctx, x, y, 1.7 * s);
    ctx.fillStyle = core;
    ctx.fill();
  }
}

// ---- 雲 ----

type CloudColors = { base: string; shade: string; line: string; rim?: string };
const CLOUD_DAY: CloudColors = { base: '#ffffff', shade: '#cfe6f5', line: '#7fa8c8' };
const CLOUD_BLIGHT: CloudColors = { base: '#b9a2cc', shade: '#8f76a6', line: '#6a5280' };
/** 夕焼けに照らされた雲(下が橙に光る)。 */
const CLOUD_DUSK: CloudColors = { base: '#f4b4b8', shade: '#c9809e', line: '#8a4f78', rim: '#ffd29a' };
/** 嵐の夜の雲(縁が紫に光る)。 */
const CLOUD_STORM: CloudColors = { base: '#43345e', shade: '#2c2142', line: '#1c1726', rim: '#8a6ac0' };

function drawCloud(ctx: Ctx, w: number, h: number, r: Rng, c: CloudColors): void {
  const puffs: [number, number, number][] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const rad = h * (0.26 + Math.sin(t * Math.PI) * 0.18) * r.range(0.9, 1.1);
    puffs.push([w * 0.12 + t * w * 0.76, h * 0.62 - Math.sin(t * Math.PI) * h * 0.14, rad]);
  }
  // 輪郭
  ctx.lineWidth = 3;
  ctx.strokeStyle = c.line;
  for (const [x, y, rad] of puffs) {
    circle(ctx, x, y, rad);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.72, w * 0.4, h * 0.16, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 塗り
  ctx.fillStyle = c.base;
  for (const [x, y, rad] of puffs) {
    circle(ctx, x, y, rad);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.72, w * 0.4, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // 下の影
  ctx.fillStyle = c.shade;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.78, w * 0.36, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  // 縁の光(夕焼け・嵐の雲だけ)
  if (c.rim) {
    ctx.save();
    ctx.beginPath();
    for (const [x, y, rad] of puffs) {
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.clip();
    ctx.fillStyle = rgba(c.rim, 0.75);
    for (const [x, y, rad] of puffs) {
      ctx.beginPath();
      ctx.ellipse(x - rad * 0.25, y - rad * 0.55, rad * 0.5, rad * 0.22, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
