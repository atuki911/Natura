import type Phaser from 'phaser';
import { COLORS, INK } from '../palette.ts';
import { circle, fillStroke, makeTexture, poly, rgba, tint, type Ctx } from './canvas.ts';

// 強化の画面と地図で使う絵: 葉(通貨)・段の玉・強化の種類を示す小さな札。

export function makeUpgradeTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'leaf_icon', 32, 32, (ctx) => leafCoin(ctx, 16, 16, 13));
  makeTexture(scene, 'pip_on', 16, 16, (ctx) => {
    circle(ctx, 8, 8, 6);
    const g = ctx.createRadialGradient(6, 6, 1, 8, 8, 6);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(1, COLORS.gold);
    fillStroke(ctx, g, 2);
  });
  makeTexture(scene, 'pip_off', 16, 16, (ctx) => {
    circle(ctx, 8, 8, 6);
    fillStroke(ctx, '#3a3f52', 2);
  });
  makeTexture(scene, 'icon_disc', 72, 72, (ctx) => {
    circle(ctx, 36, 36, 32);
    const g = ctx.createRadialGradient(28, 26, 4, 36, 36, 34);
    g.addColorStop(0, '#fdf6e0');
    g.addColorStop(1, '#c9d6c0');
    fillStroke(ctx, g, 3);
  });
  makeTexture(scene, 'badge_heart', 24, 24, (ctx) => badge(ctx, '#e84a4a', () => heart(ctx, 12, 12.5, 6)));
  makeTexture(scene, 'badge_sword', 24, 24, (ctx) => badge(ctx, '#e07a28', () => sword(ctx)));
  makeTexture(scene, 'badge_time', 24, 24, (ctx) => badge(ctx, '#3f7fe0', () => hourglass(ctx)));
  makeTexture(scene, 'badge_plus', 24, 24, (ctx) => badge(ctx, '#4cae3c', () => plus(ctx)));
  makeTexture(scene, 'badge_fruit', 24, 24, (ctx) => badge(ctx, '#d99a12', () => fruitDrop(ctx)));
}

/** 通貨の葉。丸い札の上に緑の葉。 */
function leafCoin(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x - r * 0.85, y + r * 0.85);
  ctx.bezierCurveTo(x - r * 1.05, y - r * 0.3, x - r * 0.1, y - r * 1.05, x + r, y - r);
  ctx.bezierCurveTo(x + r * 0.95, y + r * 0.1, x + r * 0.3, y + r * 0.95, x - r * 0.85, y + r * 0.85);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - r, y + r, x + r, y - r);
  g.addColorStop(0, '#3f9a3a');
  g.addColorStop(0.55, '#7cd65a');
  g.addColorStop(1, '#c8f28a');
  fillStroke(ctx, g, 2.4);
  // 葉脈
  ctx.beginPath();
  ctx.moveTo(x - r * 0.85, y + r * 0.85);
  ctx.quadraticCurveTo(x, y + r * 0.1, x + r * 0.75, y - r * 0.75);
  for (const t of [0.35, 0.6]) {
    const px = x - r * 0.85 + (r * 1.6) * t;
    const py = y + r * 0.85 - (r * 1.6) * t;
    ctx.moveTo(px, py);
    ctx.lineTo(px - r * 0.3, py - r * 0.45);
    ctx.moveTo(px, py);
    ctx.lineTo(px + r * 0.42, py + r * 0.25);
  }
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#2f6a2a';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.15, y - r * 0.35, r * 0.28, r * 0.12, -0.8, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#ffffff', 0.45);
  ctx.fill();
}

function badge(ctx: Ctx, color: string, draw: () => void): void {
  circle(ctx, 12, 12, 10.5);
  const g = ctx.createLinearGradient(0, 2, 0, 22);
  g.addColorStop(0, tint(color, 0.25));
  g.addColorStop(1, tint(color, -0.2));
  fillStroke(ctx, g, 2.2);
  draw();
}

function heart(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.4, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s);
  fillStroke(ctx, '#ffffff', 1.4);
}

function sword(ctx: Ctx): void {
  poly(ctx, [
    [16.5, 5],
    [18.5, 5.5],
    [18.6, 7.5],
    [10, 16],
    [8, 14],
  ]);
  fillStroke(ctx, '#ffffff', 1.3);
  ctx.beginPath();
  ctx.moveTo(6, 13);
  ctx.lineTo(11, 18);
  ctx.moveTo(8.5, 15.5);
  ctx.lineTo(5.5, 18.5);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function hourglass(ctx: Ctx): void {
  poly(ctx, [
    [7, 5.5],
    [17, 5.5],
    [12, 12],
    [17, 18.5],
    [7, 18.5],
    [12, 12],
  ]);
  fillStroke(ctx, '#ffffff', 1.4);
  poly(ctx, [
    [9.5, 17.5],
    [14.5, 17.5],
    [12, 14.5],
  ]);
  ctx.fillStyle = COLORS.gold;
  ctx.fill();
}

function plus(ctx: Ctx): void {
  const c = 12;
  const a = 6.5;
  const b = 2.3;
  poly(ctx, [
    [c - b, c - a],
    [c + b, c - a],
    [c + b, c - b],
    [c + a, c - b],
    [c + a, c + b],
    [c + b, c + b],
    [c + b, c + a],
    [c - b, c + a],
    [c - b, c + b],
    [c - a, c + b],
    [c - a, c - b],
    [c - b, c - b],
  ]);
  fillStroke(ctx, '#ffffff', 1.3);
}

function fruitDrop(ctx: Ctx): void {
  circle(ctx, 12, 13.5, 5.2);
  fillStroke(ctx, '#ffcf3a', 1.4);
  ctx.beginPath();
  ctx.moveTo(12, 8.5);
  ctx.quadraticCurveTo(13, 6, 15.5, 5.5);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#2f6a2a';
  ctx.stroke();
}
