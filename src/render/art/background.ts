import type Phaser from 'phaser';
import type { Rng } from '../../sim/rng.ts';
import { COLORS, INK } from '../palette.ts';
import { blobPath, circle, fillStroke, glow, makeTexture, poly, rgba, rng, shaded, tint, type Ctx } from './canvas.ts';

// ステージ1「緑の境」の背景。左は緑の王国、右へ行くほど穢れに侵されていく。

const W = 1280;
const H = 720;
/** 穢れが始まる x。 */
const BLIGHT_X = 870;

export function makeBackgroundTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'bg_stage1', W, H, drawBackground);
  makeTexture(scene, 'cloud_0', 190, 80, (ctx) => drawCloud(ctx, 190, 80, rng(11), false));
  makeTexture(scene, 'cloud_1', 140, 64, (ctx) => drawCloud(ctx, 140, 64, rng(12), false));
  makeTexture(scene, 'cloud_2', 230, 90, (ctx) => drawCloud(ctx, 230, 90, rng(13), false));
  makeTexture(scene, 'cloud_blight', 210, 84, (ctx) => drawCloud(ctx, 210, 84, rng(14), true));
}

function drawBackground(ctx: Ctx): void {
  const r = rng(2024);
  drawSky(ctx);
  drawSun(ctx, 330, 92);
  drawFarMountains(ctx, r);
  drawDistantCastles(ctx);
  drawHills(ctx, r);
  drawRiver(ctx);
  drawMeadow(ctx, r);
  drawTrees(ctx, r);
  drawPath(ctx, r);
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
  const layers: { y: number; color: string; amp: number; seed: number }[] = [
    { y: 300, color: '#8fd469', amp: 22, seed: 1 },
    { y: 330, color: '#7ac85a', amp: 18, seed: 2 },
  ];
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
    fillStroke(ctx, layer.color, 2.5);
  }
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
  ctx.beginPath();
  ctx.moveTo(-10, 400);
  ctx.bezierCurveTo(300, 380, 700, 410, W + 10, 392);
  ctx.lineTo(W + 10, H);
  ctx.lineTo(-10, H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 390, 0, 600);
  g.addColorStop(0, COLORS.grass);
  g.addColorStop(1, '#6fbe4c');
  fillStroke(ctx, g, 2.5);
  // 草の筆跡
  for (let i = 0; i < 260; i++) {
    const x = r.range(0, W);
    const y = r.range(400, 600);
    ctx.strokeStyle = r.chance(0.5) ? rgba(COLORS.grassDark, 0.55) : rgba(COLORS.grassLight, 0.8);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y - 6);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 4, y - 7);
    ctx.stroke();
  }
  // 花
  for (let i = 0; i < 40; i++) {
    const x = r.range(0, BLIGHT_X - 40);
    const y = r.range(405, 450);
    circle(ctx, x, y, 2.2);
    ctx.fillStyle = r.chance(0.5) ? '#fff6a0' : '#ffd0e8';
    ctx.fill();
  }
}

function smallTree(ctx: Ctx, x: number, y: number, s: number, r: Rng): void {
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(x - 2 * s, y - 10 * s, 4 * s, 12 * s);
  blobPath(ctx, x, y - 22 * s, 16 * s, 15 * s, r, 8, 0.15);
  fillStroke(ctx, r.chance(0.5) ? '#5eb048' : '#4fa041', 2);
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

function pathEdge(x: number, top: boolean): number {
  return top ? 458 + Math.sin(x * 0.012) * 5 + Math.sin(x * 0.041) * 2 : 588 + Math.sin(x * 0.009 + 1) * 6;
}

function drawPath(ctx: Ctx, r: Rng): void {
  ctx.beginPath();
  ctx.moveTo(-10, pathEdge(-10, true));
  for (let x = 0; x <= W + 10; x += 20) ctx.lineTo(x, pathEdge(x, true));
  for (let x = W + 10; x >= -10; x -= 20) ctx.lineTo(x, pathEdge(x, false));
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 458, 0, 590);
  g.addColorStop(0, COLORS.pathDark);
  g.addColorStop(0.12, COLORS.path);
  g.addColorStop(0.7, COLORS.pathLight);
  g.addColorStop(1, COLORS.path);
  fillStroke(ctx, g, 3);
  // わだち
  ctx.strokeStyle = rgba(COLORS.pathDark, 0.5);
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
    fillStroke(ctx, r.chance(0.5) ? '#c9a87a' : '#b8946a', 1, rgba(INK, 0.6));
  }
  // 道の縁の草
  for (let x = 0; x < W; x += 9) {
    const y = pathEdge(x, true);
    ctx.strokeStyle = COLORS.grassDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + r.range(-3, 3), y - r.range(3, 8));
    ctx.stroke();
  }
}

function drawBlight(ctx: Ctx, r: Rng): void {
  // 地面を紫に染める。境目はぎざぎざの触手のように。
  const edge: [number, number][] = [];
  for (let y = 300; y <= H; y += 16) {
    const inset = y < 400 ? (400 - y) * 0.9 : 0;
    edge.push([BLIGHT_X + inset + Math.sin(y * 0.09) * 26 + (y > 450 && y < 600 ? -30 : 0) + r.range(-10, 10), y]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W + 10, 300);
  for (const [x, y] of edge) ctx.lineTo(x, y);
  ctx.lineTo(W + 10, H);
  ctx.closePath();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(BLIGHT_X - 40, 0, W, 0);
  g.addColorStop(0, '#b496cc');
  g.addColorStop(0.35, '#8e6aaa');
  g.addColorStop(1, '#6c4c88');
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

  // 境目から伸びる黒い根
  ctx.strokeStyle = rgba('#2a1838', 0.75);
  for (let i = 0; i < 9; i++) {
    const y = r.range(400, 590);
    let x = BLIGHT_X + r.range(-10, 30);
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

  // 紫の水たまり
  for (const [x, y, w] of [
    [960, 520, 46],
    [1080, 556, 60],
    [1030, 470, 30],
    [1200, 500, 40],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.28, 0, 0, Math.PI * 2);
    fillStroke(ctx, '#6b2f8a', 2);
    ctx.beginPath();
    ctx.ellipse(x - w * 0.25, y - w * 0.06, w * 0.35, w * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(COLORS.blightGlow, 0.6);
    ctx.fill();
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
    poly(ctx, [
      [x - 6, y],
      [x - 1, y - 26],
      [x + 6, y],
    ]);
    fillStroke(ctx, '#3a2a48', 2);
  }
}

function deadTree(ctx: Ctx, x: number, y: number, s: number, r: Rng): void {
  ctx.strokeStyle = '#231a2e';
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

function mushroom(ctx: Ctx, x: number, y: number, s: number): void {
  glow(ctx, x, y - 14 * s, 26 * s, COLORS.blightGlow, 0.55);
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
  fillStroke(ctx, '#d65cff', 1.8);
  circle(ctx, x - 3 * s, y - 18 * s, 1.8 * s);
  ctx.fillStyle = '#ffd6ff';
  ctx.fill();
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

function drawCloud(ctx: Ctx, w: number, h: number, r: Rng, blight: boolean): void {
  const puffs: [number, number, number][] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const rad = h * (0.26 + Math.sin(t * Math.PI) * 0.18) * r.range(0.9, 1.1);
    puffs.push([w * 0.12 + t * w * 0.76, h * 0.62 - Math.sin(t * Math.PI) * h * 0.14, rad]);
  }
  const base = blight ? '#b9a2cc' : '#ffffff';
  const shade = blight ? '#8f76a6' : '#cfe6f5';
  const line = blight ? '#6a5280' : '#7fa8c8';
  // 輪郭
  ctx.lineWidth = 3;
  ctx.strokeStyle = line;
  for (const [x, y, rad] of puffs) {
    circle(ctx, x, y, rad);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.72, w * 0.4, h * 0.16, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 塗り
  ctx.fillStyle = base;
  for (const [x, y, rad] of puffs) {
    circle(ctx, x, y, rad);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.72, w * 0.4, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // 下の影
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.78, w * 0.36, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
}
