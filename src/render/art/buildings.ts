import type Phaser from 'phaser';
import type { Rng } from '../../sim/rng.ts';
import { COLORS, INK } from '../palette.ts';
import { circle, fillStroke, glow, makeTexture, poly, rgba, rng, roundRect, tint, type Ctx } from './canvas.ts';

// 城・穢れの砦・タワー。

export function makeBuildingTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'castle', 260, 340, drawCastle);
  makeTexture(scene, 'citadel', 250, 420, drawCitadel);
  makeTexture(scene, 'portal_swirl', 110, 130, drawPortalSwirl);
  makeTexture(scene, 'tower_slot', 74, 34, drawSlot);
  makeTexture(scene, 'tower_arrowTower', 70, 130, drawArrowTower);
  makeTexture(scene, 'tower_cannonTower', 84, 96, drawCannonTower);
  makeTexture(scene, 'cannon_barrel', 56, 26, drawCannonBarrel);
}

function bricks(ctx: Ctx, x: number, y: number, w: number, h: number, r: Rng, color = rgba(INK, 0.28)): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  const bh = 14;
  for (let row = 0; row * bh < h; row++) {
    const yy = y + row * bh;
    if (r.chance(0.85)) {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
    }
    const offset = row % 2 === 0 ? 0 : 13;
    for (let xx = x + offset; xx < x + w; xx += 26) {
      if (r.chance(0.7)) {
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, yy + bh);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** 石の壁(左が明るく右が暗い)。 */
function stoneBlock(ctx: Ctx, x: number, y: number, w: number, h: number, r: Rng, base = COLORS.stone): void {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, tint(base, 0.2));
  g.addColorStop(0.6, base);
  g.addColorStop(1, tint(base, -0.25));
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = g;
  ctx.fill();
  bricks(ctx, x, y, w, h, r);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function crenellations(ctx: Ctx, x: number, y: number, w: number, base: string): void {
  const n = Math.max(2, Math.round(w / 18));
  const cw = w / (n * 2 - 1);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.rect(x + i * cw * 2, y - 12, cw, 12);
    fillStroke(ctx, base, 2.5);
  }
  ctx.beginPath();
  ctx.rect(x - 4, y - 2, w + 8, 10);
  fillStroke(ctx, tint(base, 0.1), 2.5);
}

function archWindow(ctx: Ctx, x: number, y: number, w: number, h: number, fill = '#2a2433'): void {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  fillStroke(ctx, fill, 2.5);
}

function banner(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w / 2, y + h - 10);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, COLORS.allyLight);
  g.addColorStop(1, COLORS.ally);
  fillStroke(ctx, g, 2.5);
  // 葉の紋章
  leafEmblem(ctx, x + w / 2, y + h * 0.42, w * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - 3, y);
  ctx.lineTo(x + w + 3, y);
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.woodDark;
  ctx.stroke();
}

export function leafEmblem(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x + s, y - s * 0.2, x, y + s);
  ctx.quadraticCurveTo(x - s, y - s * 0.2, x, y - s);
  fillStroke(ctx, COLORS.gold, 1.6);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.7);
  ctx.lineTo(x, y + s);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawCastle(ctx: Ctx): void {
  const r = rng(7);
  const ground = 330;
  // 右の塔の向こうの壁
  stoneBlock(ctx, 46, 162, 168, ground - 162, r);
  crenellations(ctx, 46, 162, 168, COLORS.stone);
  // 右の塔
  stoneBlock(ctx, 178, 142, 70, ground - 142, r);
  crenellations(ctx, 178, 142, 70, COLORS.stone);
  archWindow(ctx, 202, 190, 20, 32);
  // 左の高い塔
  stoneBlock(ctx, 10, 118, 76, ground - 118, r);
  crenellations(ctx, 10, 118, 76, COLORS.stone);
  archWindow(ctx, 36, 160, 22, 34);
  archWindow(ctx, 36, 228, 22, 30);
  // 左の塔の屋根
  poly(ctx, [
    [2, 112],
    [48, 26],
    [94, 112],
  ]);
  const roof = ctx.createLinearGradient(2, 0, 94, 0);
  roof.addColorStop(0, tint(COLORS.roof, 0.15));
  roof.addColorStop(0.55, COLORS.roof);
  roof.addColorStop(1, COLORS.roofDark);
  fillStroke(ctx, roof, 3);
  ctx.strokeStyle = rgba(INK, 0.35);
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i++) {
    const y = 26 + i * 17;
    const half = ((y - 26) / 86) * 46;
    ctx.beginPath();
    ctx.moveTo(48 - half, y);
    ctx.lineTo(48 + half, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(48, 28);
  ctx.lineTo(48, 4);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // 門
  ctx.beginPath();
  ctx.moveTo(104, ground);
  ctx.lineTo(104, 262);
  ctx.arc(136, 262, 32, Math.PI, 0);
  ctx.lineTo(168, ground);
  ctx.closePath();
  fillStroke(ctx, '#3a2c22', 3);
  ctx.beginPath();
  ctx.moveTo(110, ground);
  ctx.lineTo(110, 264);
  ctx.arc(136, 264, 26, Math.PI, 0);
  ctx.lineTo(162, ground);
  ctx.closePath();
  const door = ctx.createLinearGradient(110, 0, 162, 0);
  door.addColorStop(0, '#b07a46');
  door.addColorStop(1, '#7f522c');
  fillStroke(ctx, door, 2.5);
  ctx.strokeStyle = rgba(INK, 0.5);
  ctx.lineWidth = 1.6;
  for (let x = 119; x < 160; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, 246);
    ctx.lineTo(x, ground);
    ctx.stroke();
  }
  for (const y of [272, 304]) {
    ctx.beginPath();
    ctx.rect(110, y, 52, 5);
    fillStroke(ctx, '#4a4048', 1.5);
  }
  // 門の上の石のアーチ
  ctx.beginPath();
  ctx.arc(136, 262, 36, Math.PI, 0);
  ctx.lineWidth = 7;
  ctx.strokeStyle = COLORS.stoneDark;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(136, 262, 39.5, Math.PI, 0);
  ctx.stroke();
  // 旗の幕
  banner(ctx, 96, 176, 26, 48);
  banner(ctx, 150, 176, 26, 48);
  // つた
  ctx.strokeStyle = '#4f9a42';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(86, 200);
  ctx.bezierCurveTo(80, 240, 96, 270, 88, 320);
  ctx.stroke();
  for (const [x, y] of [
    [84, 222],
    [92, 256],
    [88, 290],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 3, 0.6, 0, Math.PI * 2);
    fillStroke(ctx, '#6fbe4c', 1.2);
  }
  // 足元の土台
  ctx.beginPath();
  ctx.rect(4, ground - 12, 252, 12);
  fillStroke(ctx, COLORS.stoneDark, 2.5);
}

function skull(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 9 * s, Math.PI * 0.9, Math.PI * 2.1);
  ctx.lineTo(x + 6 * s, y + 9 * s);
  ctx.lineTo(x - 6 * s, y + 9 * s);
  ctx.closePath();
  fillStroke(ctx, '#e8e0cf', 2);
  circle(ctx, x - 3.5 * s, y + 1 * s, 2.6 * s);
  ctx.fillStyle = INK;
  ctx.fill();
  circle(ctx, x + 3.5 * s, y + 1 * s, 2.6 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + 4 * s);
  ctx.lineTo(x - 1.4 * s, y + 6.5 * s);
  ctx.lineTo(x + 1.4 * s, y + 6.5 * s);
  ctx.closePath();
  ctx.fill();
}

function spike(ctx: Ctx, x: number, y: number, len: number, angle: number): void {
  const w = len * 0.28;
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  poly(ctx, [
    [x - ny * w, y + nx * w],
    [x + nx * len, y + ny * len],
    [x + ny * w, y - nx * w],
  ]);
  fillStroke(ctx, '#cfc6d6', 2);
}

function darkTower(ctx: Ctx, x: number, top: number, w: number, ground: number, r: Rng): void {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, COLORS.darkStoneLight);
  g.addColorStop(0.5, COLORS.darkStone);
  g.addColorStop(1, COLORS.darkStoneDark);
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.lineTo(x + 3, top);
  ctx.lineTo(x + w - 3, top);
  ctx.lineTo(x + w, ground);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  bricks(ctx, x, top, w, ground - top, r, rgba('#000000', 0.35));
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.lineTo(x + 3, top);
  ctx.lineTo(x + w - 3, top);
  ctx.lineTo(x + w, ground);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // とがった屋根と角
  poly(ctx, [
    [x - 6, top + 4],
    [x + w / 2, top - w * 0.9],
    [x + w + 6, top + 4],
  ]);
  fillStroke(ctx, '#2a2238', 3);
  spike(ctx, x - 4, top + 2, 22, Math.PI * 1.15);
  spike(ctx, x + w + 4, top + 2, 22, Math.PI * 1.85);
}

function glowWindow(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  glow(ctx, x + w / 2, y + h / 2, w * 1.8, COLORS.blightGlow, 0.55);
  archWindow(ctx, x, y, w, h, '#c85cf0');
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.65, w * 0.25, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd6ff';
  ctx.fill();
}

function drawCitadel(ctx: Ctx): void {
  const r = rng(13);
  const ground = 410;
  // 奥の壁
  const wall = ctx.createLinearGradient(30, 0, 250, 0);
  wall.addColorStop(0, COLORS.darkStoneLight);
  wall.addColorStop(1, COLORS.darkStoneDark);
  ctx.beginPath();
  ctx.rect(30, 200, 220, ground - 200);
  ctx.fillStyle = wall;
  ctx.fill();
  bricks(ctx, 30, 200, 220, ground - 200, r, rgba('#000000', 0.35));
  ctx.beginPath();
  ctx.rect(30, 200, 220, ground - 200);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  crenellations(ctx, 30, 200, 220, COLORS.darkStone);
  // 塔
  darkTower(ctx, 4, 150, 62, ground, r);
  darkTower(ctx, 168, 90, 74, ground, r);
  darkTower(ctx, 96, 40, 60, 205, r);
  // 窓
  glowWindow(ctx, 24, 200, 20, 30);
  glowWindow(ctx, 194, 140, 22, 34);
  glowWindow(ctx, 194, 230, 20, 30);
  glowWindow(ctx, 116, 110, 20, 32);
  // どくろ
  skull(ctx, 36, 172, 1.1);
  skull(ctx, 205, 112, 1.2);
  skull(ctx, 126, 82, 1);
  skull(ctx, 140, 226, 1.4);
  // 門(内側は渦の絵を重ねる)
  ctx.beginPath();
  ctx.moveTo(66, ground);
  ctx.lineTo(66, 316);
  ctx.quadraticCurveTo(66, 262, 128, 256);
  ctx.quadraticCurveTo(190, 262, 190, 316);
  ctx.lineTo(190, ground);
  ctx.closePath();
  const portal = ctx.createRadialGradient(128, 340, 6, 128, 340, 90);
  portal.addColorStop(0, '#ffb8ff');
  portal.addColorStop(0.3, '#b04de0');
  portal.addColorStop(1, '#2c0f40');
  fillStroke(ctx, portal, 3);
  // 門の縁の石ととげ
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#2a2238';
  ctx.beginPath();
  ctx.moveTo(62, ground);
  ctx.lineTo(62, 316);
  ctx.quadraticCurveTo(62, 256, 128, 250);
  ctx.quadraticCurveTo(194, 256, 194, 316);
  ctx.lineTo(194, ground);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const a = Math.PI * (1.05 + t * 0.9);
    spike(ctx, 128 + Math.cos(a) * 70, 318 + Math.sin(a) * 66, 16, a);
  }
  // 足元の紫の霧
  glow(ctx, 128, ground - 4, 110, '#a040d0', 0.45);
}

function drawPortalSwirl(ctx: Ctx): void {
  const cx = 55;
  const cy = 65;
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = arm * ((Math.PI * 2) / 3) + t * Math.PI * 2.4;
      const rad = 4 + t * 50;
      const x = cx + Math.cos(a) * rad * 0.9;
      const y = cy + Math.sin(a) * rad * 1.1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 7;
    ctx.strokeStyle = rgba('#f0a0ff', 0.65);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = rgba('#ffffff', 0.7);
    ctx.stroke();
  }
  glow(ctx, cx, cy, 30, '#ffffff', 0.8);
}

function drawSlot(ctx: Ctx): void {
  ctx.beginPath();
  ctx.ellipse(37, 18, 33, 13, 0, 0, Math.PI * 2);
  fillStroke(ctx, COLORS.stoneDark, 2.5);
  ctx.beginPath();
  ctx.ellipse(37, 15, 29, 10, 0, 0, Math.PI * 2);
  fillStroke(ctx, COLORS.stoneLight, 2);
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.ellipse(37, 15, 20, 6, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(INK, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawArrowTower(ctx: Ctx): void {
  const r = rng(21);
  const ground = 126;
  // 石の土台(下ほど広い)
  ctx.beginPath();
  ctx.moveTo(8, ground);
  ctx.lineTo(16, 52);
  ctx.lineTo(54, 52);
  ctx.lineTo(62, ground);
  ctx.closePath();
  const g = ctx.createLinearGradient(8, 0, 62, 0);
  g.addColorStop(0, tint('#b98a5a', 0.15));
  g.addColorStop(1, '#8a5f38');
  ctx.fillStyle = g;
  ctx.fill();
  bricks(ctx, 8, 52, 54, ground - 52, r);
  ctx.beginPath();
  ctx.moveTo(8, ground);
  ctx.lineTo(16, 52);
  ctx.lineTo(54, 52);
  ctx.lineTo(62, ground);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  archWindow(ctx, 29, 76, 12, 20);
  // 見張り台
  ctx.beginPath();
  ctx.rect(4, 40, 62, 14);
  fillStroke(ctx, COLORS.wood, 2.5);
  for (let x = 8; x <= 62; x += 9) {
    ctx.beginPath();
    ctx.rect(x, 26, 4, 14);
    fillStroke(ctx, COLORS.woodDark, 1.5);
  }
  ctx.beginPath();
  ctx.rect(2, 22, 66, 6);
  fillStroke(ctx, COLORS.wood, 2);
}

function drawCannonTower(ctx: Ctx): void {
  const r = rng(22);
  const ground = 92;
  stoneBlock(ctx, 8, 34, 68, ground - 34, r, '#9c968f');
  crenellations(ctx, 8, 34, 68, '#9c968f');
  archWindow(ctx, 34, 56, 16, 24);
  ctx.beginPath();
  ctx.rect(4, ground - 10, 76, 10);
  fillStroke(ctx, COLORS.stoneDark, 2.5);
}

function drawCannonBarrel(ctx: Ctx): void {
  // 右向き。回転の中心は左寄り(x=14)。
  roundRect(ctx, 8, 5, 44, 16, 6);
  const g = ctx.createLinearGradient(0, 5, 0, 21);
  g.addColorStop(0, '#6c6f78');
  g.addColorStop(0.4, '#3a3d45');
  g.addColorStop(1, '#22242a');
  fillStroke(ctx, g, 2.5);
  ctx.beginPath();
  ctx.rect(44, 3, 9, 20);
  fillStroke(ctx, '#2c2e35', 2.5);
  circle(ctx, 14, 13, 9);
  fillStroke(ctx, '#7a5230', 2.5);
}
