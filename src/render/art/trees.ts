import type Phaser from 'phaser';
import { COLORS, INK } from '../palette.ts';
import { blobPath, circle, fillStroke, glow, makeTexture, poly, rgba, rng, shaded, tint, type Ctx } from './canvas.ts';

// 倒れた兵から生える木。兵の種類ごとに形が違う。足元(下端の中央)が地面。

export const TREE_SIZE = {
  thornBush: { w: 100, h: 66 },
  watchTree: { w: 76, h: 120 },
  manaFlower: { w: 60, h: 84 },
  seedPod: { w: 54, h: 60 },
} as const;

export function makeTreeTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'tree_thornBush', TREE_SIZE.thornBush.w, TREE_SIZE.thornBush.h, drawThornBush);
  makeTexture(scene, 'tree_watchTree', TREE_SIZE.watchTree.w, TREE_SIZE.watchTree.h, drawWatchTree);
  makeTexture(scene, 'tree_manaFlower', TREE_SIZE.manaFlower.w, TREE_SIZE.manaFlower.h, drawManaFlower);
  makeTexture(scene, 'tree_seedPod', TREE_SIZE.seedPod.w, TREE_SIZE.seedPod.h, drawSeedPod);
  makeTexture(scene, 'sprout', 34, 34, drawSprout);
  makeTexture(scene, 'fruit_gold', 16, 16, (ctx) => fruit(ctx, 8, 9, 6, '#ffcf3a'));
  makeTexture(scene, 'fruit_red', 16, 16, (ctx) => fruit(ctx, 8, 9, 6, '#e8463a'));
  makeTexture(scene, 'nectar', 16, 18, (ctx) => {
    glow(ctx, 8, 10, 8, '#5fd3ff', 0.9);
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.quadraticCurveTo(14, 10, 8, 15);
    ctx.quadraticCurveTo(2, 10, 8, 2);
    fillStroke(ctx, '#9fe8ff', 1.4, '#1a5a8a');
  });
  makeTexture(scene, 'purify', 180, 44, drawPurify);
  makeTexture(scene, 'leaf', 14, 10, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(7, 5, 6, 3.4, 0.4, 0, Math.PI * 2);
    fillStroke(ctx, '#7cd65a', 1.2, '#2f6a2a');
  });
  makeTexture(scene, 'thorn', 12, 12, (ctx) => {
    poly(ctx, [
      [1, 11],
      [6, 0],
      [11, 11],
    ]);
    fillStroke(ctx, '#3a5a24', 1.2);
  });
}

function fruit(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  circle(ctx, x, y, r);
  fillStroke(ctx, color, 1.6, INK);
  circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.3);
  ctx.fillStyle = rgba('#ffffff', 0.8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + 1.5, y - r - 3);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#4a6a24';
  ctx.stroke();
}

function drawThornBush(ctx: Ctx): void {
  const r = rng(51);
  const { w, h } = TREE_SIZE.thornBush;
  const ground = h - 2;
  // 後ろのつる
  ctx.strokeStyle = '#2c4a1e';
  ctx.lineWidth = 3.5;
  for (let i = 0; i < 6; i++) {
    const x0 = 14 + i * 14;
    ctx.beginPath();
    ctx.moveTo(x0, ground);
    ctx.bezierCurveTo(x0 + r.range(-20, 20), ground - 30, x0 + r.range(-24, 24), ground - 46, x0 + r.range(-18, 18), ground - r.range(44, 58));
    ctx.stroke();
  }
  // 茂み本体(左と右、真ん中)
  for (const [cx, cy, rx, ry] of [
    [30, ground - 22, 26, 20],
    [70, ground - 22, 26, 20],
    [50, ground - 32, 30, 24],
  ] as [number, number, number, number][]) {
    shaded(ctx, () => blobPath(ctx, cx, cy, rx, ry, r, 11, 0.16), '#4a7a32', {
      light: '#6fa448',
      dark: '#2f5422',
      lineWidth: 2.6,
      box: [cx - rx, cy - ry, rx * 2, ry * 2],
    });
  }
  // とげ
  for (let i = 0; i < 18; i++) {
    const a = Math.PI + (i / 17) * Math.PI;
    const rx = 46;
    const ry = 34;
    const x = w / 2 + Math.cos(a) * rx * r.range(0.85, 1);
    const y = ground - 18 + Math.sin(a) * ry * r.range(0.85, 1);
    const len = r.range(6, 10);
    poly(ctx, [
      [x - 3, y + 1],
      [x + Math.cos(a) * len, y + Math.sin(a) * len],
      [x + 3, y - 1],
    ]);
    fillStroke(ctx, '#d8e8b0', 1.4, INK);
  }
  // つるの巻き
  ctx.strokeStyle = '#2c4a1e';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 4; i++) {
    const x = 22 + i * 18;
    ctx.beginPath();
    ctx.arc(x, ground - 20 - (i % 2) * 10, 6, 0, Math.PI * 1.5);
    ctx.stroke();
  }
}

function drawWatchTree(ctx: Ctx): void {
  const r = rng(52);
  const { w, h } = TREE_SIZE.watchTree;
  const ground = h - 2;
  const cx = w / 2;
  // 幹
  ctx.beginPath();
  ctx.moveTo(cx - 9, ground);
  ctx.quadraticCurveTo(cx - 6, ground - 40, cx - 8, ground - 66);
  ctx.lineTo(cx + 8, ground - 66);
  ctx.quadraticCurveTo(cx + 6, ground - 40, cx + 10, ground);
  ctx.closePath();
  fillStroke(ctx, COLORS.wood, 2.6);
  // 根
  for (const dx of [-14, 14]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * 0.4, ground - 6);
    ctx.quadraticCurveTo(cx + dx * 0.9, ground - 4, cx + dx, ground);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  // 弓のような枝
  ctx.beginPath();
  ctx.arc(cx + 18, ground - 58, 16, -1.2, 1.2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.woodDark;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 18 + Math.cos(-1.2) * 16, ground - 58 + Math.sin(-1.2) * 16);
  ctx.lineTo(cx + 18 + Math.cos(1.2) * 16, ground - 58 + Math.sin(1.2) * 16);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#f2ead8';
  ctx.stroke();
  // 葉
  for (const [dx, dy, rad] of [
    [-14, -78, 20],
    [14, -82, 20],
    [0, -98, 24],
  ] as [number, number, number][]) {
    shaded(ctx, () => blobPath(ctx, cx + dx, ground + dy, rad, rad * 0.88, r, 9, 0.14), '#5fb848', {
      light: '#8bd866',
      dark: '#3f8f37',
      lineWidth: 2.4,
      box: [cx + dx - rad, ground + dy - rad, rad * 2, rad * 2],
    });
  }
  // 見張りの目(幹のこぶ)
  ctx.beginPath();
  ctx.ellipse(cx, ground - 36, 5, 3.6, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#3a2614', 1.6);
  circle(ctx, cx + 1, ground - 36, 1.6);
  ctx.fillStyle = '#ffe08a';
  ctx.fill();
}

function drawManaFlower(ctx: Ctx): void {
  const { w, h } = TREE_SIZE.manaFlower;
  const ground = h - 2;
  const cx = w / 2;
  // 茎と葉
  ctx.beginPath();
  ctx.moveTo(cx, ground);
  ctx.bezierCurveTo(cx - 6, ground - 20, cx + 6, ground - 34, cx, ground - 50);
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#5aa845';
  ctx.stroke();
  for (const [dx, dy, a] of [
    [-12, -16, -0.5],
    [12, -28, 0.5],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx, ground + dy, 12, 5.5, a, 0, Math.PI * 2);
    fillStroke(ctx, '#6fbe4c', 2);
  }
  // 花
  glow(ctx, cx, ground - 60, 30, '#5fd3ff', 0.5);
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * 11, ground - 60 + Math.sin(a) * 11, 10, 6.5, a, 0, Math.PI * 2);
    fillStroke(ctx, i % 2 ? '#7fd4ff' : '#a8e4ff', 2);
  }
  circle(ctx, cx, ground - 60, 7);
  fillStroke(ctx, '#fff6b0', 2);
  circle(ctx, cx - 2, ground - 62, 2.2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawSeedPod(ctx: Ctx): void {
  const r = rng(54);
  const { w, h } = TREE_SIZE.seedPod;
  const ground = h - 2;
  const cx = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, ground);
  ctx.lineTo(cx, ground - 12);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  shaded(ctx, () => blobPath(ctx, cx, ground - 30, 18, 20, r, 9, 0.06), '#d07a2c', {
    light: '#f0a858',
    dark: '#8a4a18',
    lineWidth: 2.6,
    box: [cx - 18, ground - 50, 36, 40],
  });
  // 縫い目と火の粉の点
  ctx.strokeStyle = rgba(INK, 0.6);
  ctx.lineWidth = 1.6;
  for (const dx of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, ground - 46);
    ctx.quadraticCurveTo(cx + dx * 1.6, ground - 30, cx + dx, ground - 13);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    poly(ctx, [
      [cx + Math.cos(a) * 16, ground - 30 + Math.sin(a) * 18],
      [cx + Math.cos(a) * 24, ground - 30 + Math.sin(a) * 25],
      [cx + Math.cos(a + 0.2) * 16, ground - 30 + Math.sin(a + 0.2) * 18],
    ]);
    fillStroke(ctx, tint('#d07a2c', -0.3), 1.4);
  }
  // 葉の冠
  for (const a of [-0.6, 0, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(cx + Math.sin(a) * 8, ground - 52 - Math.cos(a) * 2, 4, 8, a, 0, Math.PI * 2);
    fillStroke(ctx, '#6fbe4c', 1.6);
  }
}

function drawSprout(ctx: Ctx): void {
  ctx.beginPath();
  ctx.ellipse(17, 31, 10, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#6e4a2a';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(17, 30);
  ctx.quadraticCurveTo(15, 20, 17, 14);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3f8f37';
  ctx.stroke();
  for (const [dx, a] of [
    [-6, -0.6],
    [6, 0.6],
  ] as [number, number][]) {
    ctx.beginPath();
    ctx.ellipse(17 + dx, 14, 7, 4, a, 0, Math.PI * 2);
    fillStroke(ctx, '#7cd65a', 1.6, '#2f6a2a');
  }
}

function drawPurify(ctx: Ctx): void {
  // 木の周りに戻ってきた緑の地面(穢れの紫の上に重ねる)
  const g = ctx.createRadialGradient(90, 22, 6, 90, 22, 90);
  g.addColorStop(0, 'rgba(134,207,90,0.95)');
  g.addColorStop(0.6, 'rgba(134,207,90,0.6)');
  g.addColorStop(1, 'rgba(134,207,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(90, 22, 90, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  const r = rng(55);
  for (let i = 0; i < 26; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(0, 0.75);
    const x = 90 + Math.cos(a) * 80 * d;
    const y = 22 + Math.sin(a) * 18 * d;
    ctx.strokeStyle = r.chance(0.5) ? '#5aa845' : '#b4e77a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1.5, y - 6);
    ctx.moveTo(x + 2.5, y);
    ctx.lineTo(x + 3.5, y - 6);
    ctx.stroke();
    if (r.chance(0.2)) {
      circle(ctx, x + 1, y - 7, 1.8);
      ctx.fillStyle = r.chance(0.5) ? '#fff6a0' : '#ffd0e8';
      ctx.fill();
    }
  }
}
