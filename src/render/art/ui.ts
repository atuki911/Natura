import type Phaser from 'phaser';
import { COLORS, INK } from '../palette.ts';
import { leafEmblem } from './buildings.ts';
import { circle, fillStroke, glow, makeTexture, poly, rgba, rng, roundRect, shaded, tint, type Ctx } from './canvas.ts';

// エフェクトの粒・飛び道具・HUD の部品。

export const CARD = { w: 86, h: 100 };
export const ABILITY_BTN = { w: 78, h: 78 };

export function makeUiTextures(scene: Phaser.Scene): void {
  // 粒
  makeTexture(scene, 'puff', 48, 48, (ctx) => {
    circle(ctx, 24, 24, 20);
    const g = ctx.createRadialGradient(18, 18, 2, 24, 24, 20);
    g.addColorStop(0, '#fffaf0');
    g.addColorStop(1, '#e8dcc4');
    fillStroke(ctx, g, 3, '#8a7a66');
  });
  makeTexture(scene, 'dust', 40, 40, (ctx) => {
    const g = ctx.createRadialGradient(20, 20, 2, 20, 20, 19);
    g.addColorStop(0, 'rgba(238,222,190,0.95)');
    g.addColorStop(0.6, 'rgba(225,204,165,0.6)');
    g.addColorStop(1, 'rgba(225,204,165,0)');
    ctx.fillStyle = g;
    circle(ctx, 20, 20, 19);
    ctx.fill();
  });
  makeTexture(scene, 'spark', 24, 24, (ctx) => star4(ctx, 12, 12, 11, 3, '#fff6b0'));
  makeTexture(scene, 'dot', 16, 16, (ctx) => glow(ctx, 8, 8, 8, '#ffffff', 1));
  makeTexture(scene, 'goo', 14, 14, (ctx) => {
    circle(ctx, 7, 7, 5.5);
    fillStroke(ctx, COLORS.blight, 1.6);
    circle(ctx, 5.5, 5.5, 1.6);
    ctx.fillStyle = rgba('#ffffff', 0.7);
    ctx.fill();
  });
  makeTexture(scene, 'cross', 20, 20, (ctx) => plus(ctx, 10, 10, 8, '#6ef06a'));
  makeTexture(scene, 'flash', 128, 128, (ctx) => glow(ctx, 64, 64, 64, '#ffffff', 1));
  makeTexture(scene, 'ring', 128, 128, (ctx) => {
    circle(ctx, 64, 64, 58);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
  makeTexture(scene, 'scorch', 160, 44, (ctx) => {
    const g = ctx.createRadialGradient(80, 22, 4, 80, 22, 80);
    g.addColorStop(0, 'rgba(40,24,20,0.6)');
    g.addColorStop(1, 'rgba(40,24,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(80, 22, 80, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  makeTexture(scene, 'burst', 96, 96, (ctx) => {
    const r = rng(3);
    const pts: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rad = i % 2 === 0 ? r.range(40, 47) : r.range(20, 26);
      pts.push([48 + Math.cos(a) * rad, 48 + Math.sin(a) * rad]);
    }
    poly(ctx, pts);
    fillStroke(ctx, '#ffd640', 3, '#c06a10');
    circle(ctx, 48, 48, 18);
    ctx.fillStyle = '#fff8d0';
    ctx.fill();
  });

  // 飛び道具(すべて右向き)
  makeTexture(scene, 'arrow', 36, 10, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(2, 5);
    ctx.lineTo(28, 5);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#5a3a1e';
    ctx.stroke();
    poly(ctx, [
      [26, 1.5],
      [35, 5],
      [26, 8.5],
    ]);
    fillStroke(ctx, '#cfd4dc', 1.4);
    poly(ctx, [
      [1, 1],
      [8, 5],
      [1, 9],
      [4, 5],
    ]);
    fillStroke(ctx, '#e8e2d0', 1.2);
  });
  makeTexture(scene, 'bolt', 30, 30, (ctx) => {
    glow(ctx, 15, 15, 15, '#5fd3ff', 1);
    circle(ctx, 15, 15, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  makeTexture(scene, 'spit', 22, 22, (ctx) => {
    glow(ctx, 11, 11, 11, '#ff3060', 0.9);
    circle(ctx, 11, 11, 5);
    ctx.fillStyle = '#ffd0e0';
    ctx.fill();
  });
  makeTexture(scene, 'cannonball', 16, 16, (ctx) => {
    circle(ctx, 8, 8, 6);
    fillStroke(ctx, '#2c2e35', 2);
    circle(ctx, 6, 6, 1.8);
    ctx.fillStyle = '#8a8e98';
    ctx.fill();
  });
  makeTexture(scene, 'meteor', 70, 70, (ctx) => {
    glow(ctx, 35, 35, 35, '#ff8a20', 0.9);
    const r = rng(9);
    shaded(
      ctx,
      () => {
        const pts: [number, number][] = [];
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          pts.push([35 + Math.cos(a) * r.range(15, 20), 35 + Math.sin(a) * r.range(15, 20)]);
        }
        poly(ctx, pts);
      },
      '#7a4a30',
      { light: '#ffb060', dark: '#4a2818', lineWidth: 2.6, box: [15, 15, 40, 40] },
    );
    for (const [x, y] of [
      [30, 40],
      [42, 32],
    ]) {
      circle(ctx, x, y, 3);
      ctx.fillStyle = '#ffcc40';
      ctx.fill();
    }
  });

  // HUD の部品
  makeTexture(scene, 'coin', 24, 24, (ctx) => coin(ctx, 12, 12, 10));
  makeTexture(scene, 'crystal', 24, 26, (ctx) => crystal(ctx, 12, 13, 11));
  makeTexture(scene, 'flag_icon', 24, 24, (ctx) => flagIcon(ctx));
  makeTexture(scene, 'castle_icon', 30, 30, (ctx) => castleIcon(ctx));
  makeTexture(scene, 'hud_panel', 1280, 124, drawHudPanel);
  for (const [key, color] of [
    ['card_blue', '#4a8ee6'],
    ['card_green', '#5cbf4a'],
    ['card_purple', '#8a5cd6'],
    ['card_gold', '#e0a028'],
  ] as const) {
    makeTexture(scene, key, CARD.w, CARD.h, (ctx) => drawCard(ctx, CARD.w, CARD.h, color));
  }
  makeTexture(scene, 'card_shade', CARD.w, CARD.h, (ctx) => {
    roundRect(ctx, 3, 3, CARD.w - 6, CARD.h - 6, 10);
    ctx.fillStyle = 'rgba(20,18,30,0.62)';
    ctx.fill();
  });
  makeTexture(scene, 'ability_heal', ABILITY_BTN.w, ABILITY_BTN.h, (ctx) => {
    drawCard(ctx, ABILITY_BTN.w, ABILITY_BTN.h, '#44b844');
    plus(ctx, 39, 36, 20, '#7cff70');
  });
  makeTexture(scene, 'ability_meteor', ABILITY_BTN.w, ABILITY_BTN.h, (ctx) => {
    drawCard(ctx, ABILITY_BTN.w, ABILITY_BTN.h, '#d0502c');
    // 炎の尾(右上へ伸びる)
    ctx.beginPath();
    ctx.moveTo(24, 30);
    ctx.quadraticCurveTo(44, 12, 66, 10);
    ctx.quadraticCurveTo(56, 30, 46, 52);
    ctx.closePath();
    fillStroke(ctx, '#ff8a20', 2.2);
    ctx.beginPath();
    ctx.moveTo(30, 34);
    ctx.quadraticCurveTo(46, 22, 58, 18);
    ctx.quadraticCurveTo(52, 32, 44, 46);
    ctx.closePath();
    ctx.fillStyle = '#ffe070';
    ctx.fill();
    circle(ctx, 32, 44, 13);
    fillStroke(ctx, '#7a4a30', 2.5);
    circle(ctx, 28, 40, 3.5);
    ctx.fillStyle = '#ffcc40';
    ctx.fill();
    circle(ctx, 37, 48, 2.5);
    ctx.fill();
  });
  makeTexture(scene, 'ability_shade', ABILITY_BTN.w, ABILITY_BTN.h, (ctx) => {
    roundRect(ctx, 3, 3, ABILITY_BTN.w - 6, ABILITY_BTN.h - 6, 10);
    ctx.fillStyle = 'rgba(20,18,30,0.62)';
    ctx.fill();
  });
  for (const [key, color] of [
    ['btn_green', '#4cae3c'],
    ['btn_stone', '#5c6678'],
    ['btn_red', '#c8462e'],
    ['btn_gold', '#e0a028'],
  ] as const) {
    makeTexture(scene, key, 230, 56, (ctx) => drawButton(ctx, 230, 56, color));
    makeTexture(scene, `${key}_sq`, 52, 52, (ctx) => drawButton(ctx, 52, 52, color));
  }
  makeTexture(scene, 'tooltip', 180, 96, (ctx) => {
    roundRect(ctx, 3, 3, 174, 90, 12);
    fillStroke(ctx, 'rgba(32,36,52,0.94)', 3);
  });
  makeTexture(scene, 'star', 64, 64, (ctx) => star5(ctx, 32, 33, 28, '#ffd640', '#c07a10'));
  makeTexture(scene, 'star_empty', 64, 64, (ctx) => star5(ctx, 32, 33, 28, '#4a4658', '#2a2638'));
  makeTexture(scene, 'logo', 560, 170, drawLogo);
  makeTexture(scene, 'panel', 520, 380, (ctx) => {
    roundRect(ctx, 4, 4, 512, 372, 22);
    const g = ctx.createLinearGradient(0, 0, 0, 380);
    g.addColorStop(0, '#3a4560');
    g.addColorStop(1, '#232a3c');
    fillStroke(ctx, g, 4);
    roundRect(ctx, 14, 14, 492, 352, 16);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba('#ffffff', 0.15);
    ctx.stroke();
  });
}

function star4(ctx: Ctx, x: number, y: number, r: number, inner: number, color: string): void {
  poly(ctx, [
    [x, y - r],
    [x + inner, y - inner],
    [x + r, y],
    [x + inner, y + inner],
    [x, y + r],
    [x - inner, y + inner],
    [x - r, y],
    [x - inner, y - inner],
  ]);
  ctx.fillStyle = color;
  ctx.fill();
}

function star5(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke: string): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.48;
    pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
  }
  poly(ctx, pts);
  fillStroke(ctx, fill, 4, stroke);
}

function plus(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  const t = s * 0.38;
  poly(ctx, [
    [x - t, y - s],
    [x + t, y - s],
    [x + t, y - t],
    [x + s, y - t],
    [x + s, y + t],
    [x + t, y + t],
    [x + t, y + s],
    [x - t, y + s],
    [x - t, y + t],
    [x - s, y + t],
    [x - s, y - t],
    [x - t, y - t],
  ]);
  fillStroke(ctx, color, Math.max(1.6, s * 0.14));
}

function coin(ctx: Ctx, x: number, y: number, r: number): void {
  circle(ctx, x, y, r);
  fillStroke(ctx, COLORS.gold, 2, '#8a5a08');
  circle(ctx, x, y, r * 0.65);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = COLORS.goldDark;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.15, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff6c0';
  ctx.fill();
}

function crystal(ctx: Ctx, x: number, y: number, r: number): void {
  poly(ctx, [
    [x, y - r],
    [x + r * 0.7, y - r * 0.2],
    [x, y + r],
    [x - r * 0.7, y - r * 0.2],
  ]);
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#c8f2ff');
  g.addColorStop(1, '#2a8ad0');
  fillStroke(ctx, g, 2, '#0e3a6a');
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.moveTo(x - r * 0.7, y - r * 0.2);
  ctx.lineTo(x + r * 0.7, y - r * 0.2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba('#ffffff', 0.6);
  ctx.stroke();
}

function flagIcon(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(5, 22);
  ctx.lineTo(5, 3);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#e8e2d0';
  ctx.stroke();
  poly(ctx, [
    [6, 3],
    [21, 7],
    [6, 13],
  ]);
  fillStroke(ctx, COLORS.allyLight, 1.6);
}

function castleIcon(ctx: Ctx): void {
  poly(ctx, [
    [3, 27],
    [3, 9],
    [8, 9],
    [8, 13],
    [12, 13],
    [12, 6],
    [18, 6],
    [18, 13],
    [22, 13],
    [22, 9],
    [27, 9],
    [27, 27],
  ]);
  fillStroke(ctx, COLORS.stoneLight, 2);
  ctx.beginPath();
  ctx.arc(15, 22, 4, Math.PI, 0);
  ctx.lineTo(19, 27);
  ctx.lineTo(11, 27);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
}

function drawHudPanel(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, 0, 124);
  g.addColorStop(0, '#3a4458');
  g.addColorStop(0.12, '#2c3446');
  g.addColorStop(1, '#1a1f2c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 4, 1280, 120);
  ctx.fillStyle = '#5a6680';
  ctx.fillRect(0, 4, 1280, 3);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, 1280, 4);
  // 区切り
  for (const x of [232, 652, 900, 1090]) {
    ctx.fillStyle = '#141824';
    ctx.fillRect(x, 14, 4, 100);
    ctx.fillStyle = '#4a5468';
    ctx.fillRect(x + 4, 14, 2, 100);
  }
  // 鋲
  for (const x of [10, 1270]) {
    for (const y of [20, 108]) {
      circle(ctx, x, y, 3.5);
      fillStroke(ctx, '#8a94a8', 1.4);
    }
  }
}

function drawCard(ctx: Ctx, w: number, h: number, color: string): void {
  roundRect(ctx, 3, 3, w - 6, h - 6, 12);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, tint(color, 0.35));
  g.addColorStop(0.55, color);
  g.addColorStop(1, tint(color, -0.35));
  fillStroke(ctx, g, 3);
  roundRect(ctx, 8, 8, w - 16, h - 16, 8);
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(w * 0.35, h * 0.18, w * 0.25, h * 0.07, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#ffffff', 0.25);
  ctx.fill();
}

function drawButton(ctx: Ctx, w: number, h: number, color: string): void {
  roundRect(ctx, 3, 6, w - 6, h - 9, 12);
  ctx.fillStyle = tint(color, -0.45);
  ctx.fill();
  roundRect(ctx, 3, 3, w - 6, h - 9, 12);
  const g = ctx.createLinearGradient(0, 3, 0, h - 6);
  g.addColorStop(0, tint(color, 0.3));
  g.addColorStop(1, tint(color, -0.15));
  fillStroke(ctx, g, 3);
  roundRect(ctx, 9, 7, w - 18, (h - 9) * 0.38, 7);
  ctx.fillStyle = rgba('#ffffff', 0.22);
  ctx.fill();
}

function drawLogo(ctx: Ctx): void {
  const text = 'NATURA';
  ctx.font = '112px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const x = 280;
  const y = 92;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 22;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y + 6);
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#2f6a2a';
  ctx.strokeText(text, x, y);
  const g = ctx.createLinearGradient(0, y - 50, 0, y + 50);
  g.addColorStop(0, '#e8ff9a');
  g.addColorStop(0.5, '#8fe05a');
  g.addColorStop(1, '#3f9a3a');
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  // 葉の飾り
  for (const [lx, ly, s] of [
    [64, 36, 16],
    [500, 40, 14],
  ]) {
    leafEmblem(ctx, lx, ly, s);
  }
}
