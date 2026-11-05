import type Phaser from 'phaser';
import { COLORS, INK } from '../palette.ts';
import { blobPath, circle, fillStroke, glow, makeTexture, poly, rgba, rng, shaded, smoothClosed, tint, type Ctx } from './canvas.ts';

// 敵の部品。体・目・口などを別々のテクスチャにして、コードで組み立てて動かす。
// 生成AIの絵に差し替える時も、この単位(key)で差し替える。docs/asset-pipeline.md を参照。

export function makeCreatureTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'eye_white', 20, 20, (ctx) => eyeWhite(ctx, 10, 10, 8));
  makeTexture(scene, 'eye_big', 64, 64, (ctx) => eyeWhite(ctx, 32, 32, 29, true));
  makeTexture(scene, 'pupil', 10, 10, (ctx) => pupil(ctx, 5, 5, 3.6));
  makeTexture(scene, 'iris_big', 34, 34, (ctx) => iris(ctx, 17, 17, 15, '#8f5bd6'));
  makeTexture(scene, 'iris_orange', 40, 40, (ctx) => iris(ctx, 20, 20, 18, '#f08a24'));

  makeTexture(scene, 'blightling_body', 66, 58, drawBlightling);
  makeTexture(scene, 'gnasher_body', 56, 50, drawGnasher);
  makeTexture(scene, 'tuskbeast_body', 124, 96, drawTuskbeast);
  makeTexture(scene, 'tuskbeast_rider', 40, 56, drawRider);
  makeTexture(scene, 'wisp_body', 74, 96, drawWisp);
  makeTexture(scene, 'rollereye_body', 74, 74, drawRollerEye);
  makeTexture(scene, 'mireMaw_body', 300, 260, drawMireMawBody);
  makeTexture(scene, 'mireMaw_jaw', 150, 60, drawMireMawJaw);
  makeTexture(scene, 'shadow', 64, 20, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(32, 10, 30, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,20,40,0.28)';
    ctx.fill();
  });
}

function eyeWhite(ctx: Ctx, x: number, y: number, r: number, veins = false): void {
  circle(ctx, x, y, r);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.8, '#f2ece6');
  g.addColorStop(1, '#d9cfd8');
  fillStroke(ctx, g, Math.max(1.6, r * 0.1));
  if (veins) {
    const rr = rng(5);
    ctx.strokeStyle = rgba('#d23a3a', 0.75);
    for (let i = 0; i < 9; i++) {
      const a = rr.range(0, Math.PI * 2);
      ctx.lineWidth = rr.range(1, 2);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
      ctx.quadraticCurveTo(
        x + Math.cos(a + 0.2) * r * 0.7,
        y + Math.sin(a + 0.2) * r * 0.7,
        x + Math.cos(a - 0.1) * r * 0.5,
        y + Math.sin(a - 0.1) * r * 0.5,
      );
      ctx.stroke();
    }
  }
}

function pupil(ctx: Ctx, x: number, y: number, r: number): void {
  circle(ctx, x, y, r);
  ctx.fillStyle = INK;
  ctx.fill();
  circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function iris(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  circle(ctx, x, y, r);
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, tint(color, 0.35));
  g.addColorStop(1, tint(color, -0.25));
  fillStroke(ctx, g, 2);
  circle(ctx, x, y, r * 0.45);
  ctx.fillStyle = INK;
  ctx.fill();
  circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function fangs(ctx: Ctx, x: number, y: number, w: number, n: number, len: number, up = false): void {
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const tx = x + i * step;
    poly(ctx, [
      [tx, y],
      [tx + step / 2, y + (up ? -len : len)],
      [tx + step, y],
    ]);
    fillStroke(ctx, '#fff7e0', 1.4);
  }
}

function drawBlightling(ctx: Ctx): void {
  const r = rng(31);
  shaded(ctx, () => blobPath(ctx, 33, 32, 28, 23, r, 11, 0.08), COLORS.blight, {
    light: COLORS.blightLight,
    dark: COLORS.blightDark,
    lineWidth: 3,
    box: [5, 9, 56, 46],
  });
  // たれる雫
  for (const [x, len] of [
    [16, 9],
    [44, 12],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x - 4, 50);
    ctx.quadraticCurveTo(x, 50 + len * 1.3, x + 4, 50);
    fillStroke(ctx, COLORS.blight, 2);
  }
  // 口(左を向く)
  ctx.beginPath();
  ctx.moveTo(12, 36);
  ctx.quadraticCurveTo(24, 48, 36, 38);
  ctx.quadraticCurveTo(24, 42, 12, 36);
  fillStroke(ctx, '#3a1030', 2);
  fangs(ctx, 15, 37.5, 16, 3, 4);
  // 光
  ctx.beginPath();
  ctx.ellipse(40, 18, 7, 3.5, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#ffffff', 0.6);
  ctx.fill();
}

function drawGnasher(ctx: Ctx): void {
  const r = rng(32);
  // 角
  for (const x of [20, 38]) {
    poly(ctx, [
      [x - 4, 12],
      [x + 2, 0],
      [x + 4, 13],
    ]);
    fillStroke(ctx, '#e8dcc0', 2);
  }
  shaded(ctx, () => blobPath(ctx, 28, 26, 22, 18, r, 9, 0.1), '#4e8a3a', {
    light: '#79b85a',
    dark: '#2f5a24',
    lineWidth: 3,
    box: [6, 8, 44, 36],
  });
  // 大きな口
  ctx.beginPath();
  ctx.moveTo(6, 26);
  ctx.quadraticCurveTo(10, 46, 34, 40);
  ctx.quadraticCurveTo(20, 32, 6, 26);
  fillStroke(ctx, '#5a0f1c', 2.2);
  fangs(ctx, 8, 28, 22, 5, 5);
  fangs(ctx, 12, 40, 18, 4, 4, true);
  // 赤い目
  circle(ctx, 24, 18, 5);
  fillStroke(ctx, '#ffe08a', 1.8);
  circle(ctx, 22.5, 18, 2.3);
  ctx.fillStyle = '#d0201a';
  ctx.fill();
}

function drawTuskbeast(ctx: Ctx): void {
  const r = rng(33);
  // 体(左向き)
  shaded(ctx, () => blobPath(ctx, 70, 52, 46, 30, r, 10, 0.07), '#7a5a42', {
    light: '#a07a5a',
    dark: '#4e3828',
    lineWidth: 3,
    box: [24, 22, 92, 60],
  });
  // こぶの毛
  ctx.fillStyle = '#3c2a20';
  for (let i = 0; i < 7; i++) {
    const x = 50 + i * 9;
    poly(ctx, [
      [x - 5, 28],
      [x, 14 + r.range(-3, 3)],
      [x + 5, 28],
    ]);
    fillStroke(ctx, '#3c2a20', 2);
  }
  // 頭
  shaded(ctx, () => blobPath(ctx, 28, 56, 24, 20, r, 9, 0.06), '#866248', {
    light: '#ab8466',
    dark: '#55402e',
    lineWidth: 3,
    box: [4, 36, 48, 40],
  });
  // 鼻
  ctx.beginPath();
  ctx.ellipse(8, 62, 8, 7, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#c08a7a', 2.2);
  circle(ctx, 6, 61, 1.6);
  ctx.fillStyle = INK;
  ctx.fill();
  // 牙
  ctx.beginPath();
  ctx.moveTo(16, 70);
  ctx.quadraticCurveTo(0, 74, -2 + 6, 52);
  ctx.quadraticCurveTo(6, 70, 20, 64);
  ctx.closePath();
  fillStroke(ctx, '#fff3d6', 2);
  // 目
  circle(ctx, 26, 48, 4.5);
  fillStroke(ctx, '#ff4a3a', 1.8);
  circle(ctx, 25, 48, 1.6);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, 42);
  ctx.lineTo(32, 45);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // 鎧の板
  for (const [x, y, w] of [
    [56, 40, 30],
    [84, 44, 26],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 8, x + w, y);
    ctx.lineTo(x + w - 2, y + 22);
    ctx.quadraticCurveTo(x + w / 2, y + 26, x + 2, y + 22);
    ctx.closePath();
    const g = ctx.createLinearGradient(x, y, x, y + 22);
    g.addColorStop(0, '#b8bcc6');
    g.addColorStop(1, '#6c707c');
    fillStroke(ctx, g, 2.2);
    circle(ctx, x + 5, y + 4, 1.5);
    ctx.fillStyle = INK;
    ctx.fill();
    circle(ctx, x + w - 5, y + 4, 1.5);
    ctx.fill();
  }
  // しっぽ
  ctx.beginPath();
  ctx.moveTo(114, 46);
  ctx.quadraticCurveTo(124, 40, 120, 30);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawRider(ctx: Ctx): void {
  // どくろ頭の小鬼。槍を持つ。
  ctx.beginPath();
  ctx.moveTo(4, 40);
  ctx.lineTo(30, 4);
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.woodDark;
  ctx.stroke();
  poly(ctx, [
    [26, 9],
    [34, -2 + 2],
    [33, 11],
  ]);
  fillStroke(ctx, '#d6dae2', 1.8);
  // 体
  ctx.beginPath();
  ctx.moveTo(14, 54);
  ctx.quadraticCurveTo(10, 36, 18, 30);
  ctx.lineTo(28, 32);
  ctx.quadraticCurveTo(32, 44, 28, 54);
  ctx.closePath();
  fillStroke(ctx, '#5a8a3c', 2.2);
  // どくろ
  ctx.beginPath();
  ctx.arc(22, 22, 10, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineTo(28, 32);
  ctx.lineTo(16, 32);
  ctx.closePath();
  fillStroke(ctx, '#ece4d2', 2.2);
  circle(ctx, 18, 22, 3);
  ctx.fillStyle = INK;
  ctx.fill();
  circle(ctx, 25, 22, 3);
  ctx.fill();
  circle(ctx, 18, 22, 1.2);
  ctx.fillStyle = '#ff5040';
  ctx.fill();
  // 腕
  ctx.beginPath();
  ctx.moveTo(18, 38);
  ctx.lineTo(10, 30);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawWisp(ctx: Ctx): void {
  glow(ctx, 37, 40, 40, '#8a40c0', 0.35);
  // 体(下がゆらめく尾)
  ctx.beginPath();
  ctx.moveTo(37, 6);
  ctx.bezierCurveTo(62, 6, 66, 34, 60, 54);
  ctx.bezierCurveTo(56, 70, 66, 80, 52, 92);
  ctx.quadraticCurveTo(48, 78, 40, 82);
  ctx.quadraticCurveTo(30, 90, 26, 76);
  ctx.quadraticCurveTo(16, 82, 12, 66);
  ctx.bezierCurveTo(8, 50, 10, 6, 37, 6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 6, 0, 92);
  g.addColorStop(0, '#2a2236');
  g.addColorStop(1, '#100c18');
  fillStroke(ctx, g, 3, '#0a0610');
  // 爪の腕
  for (const [x, y, dir] of [
    [12, 44, -1],
    [60, 46, 1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * 10, y + 4, x + dir * 12, y + 14);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1a1424';
    ctx.stroke();
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(x + dir * 12, y + 14);
      ctx.lineTo(x + dir * (14 + k * 3), y + 22);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#d8323a';
      ctx.stroke();
    }
  }
  // 光る赤い目と口
  glow(ctx, 26, 28, 12, '#ff2030', 0.8);
  glow(ctx, 44, 28, 12, '#ff2030', 0.8);
  for (const x of [26, 44]) {
    ctx.beginPath();
    ctx.ellipse(x, 28, 5.5, 4, x < 35 ? 0.3 : -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3a3a';
    ctx.fill();
    circle(ctx, x, 28, 1.6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(27, 40);
  ctx.quadraticCurveTo(35, 48, 44, 40);
  ctx.quadraticCurveTo(35, 44, 27, 40);
  ctx.fillStyle = '#ff3a3a';
  ctx.fill();
}

function drawRollerEye(ctx: Ctx): void {
  // 目玉の白目(回転させる部分)。黒目は別の部品。
  eyeWhite(ctx, 37, 37, 33, true);
  ctx.beginPath();
  ctx.ellipse(46, 22, 9, 5, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#ffffff', 0.85);
  ctx.fill();
}

function drawMireMawBody(ctx: Ctx): void {
  const r = rng(41);
  // こぶの並び
  const pts: [number, number][] = [];
  const cx = 150;
  const cy = 140;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const bump = 1 + (r.next() - 0.5) * 0.14;
    const flat = Math.sin(a) > 0.55 ? 0.92 : 1;
    pts.push([cx + Math.cos(a) * 132 * bump, cy + Math.sin(a) * 112 * bump * flat]);
  }
  const path = () => smoothClosed(ctx, pts);
  shaded(ctx, path, '#9a5cc8', { light: '#c493ea', dark: '#5e2f8a', lineWidth: 4, box: [18, 28, 264, 224] });
  // ぶつぶつ
  for (let i = 0; i < 26; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(30, 110);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.8;
    circle(ctx, x, y, r.range(2, 5));
    ctx.fillStyle = rgba('#5e2f8a', 0.6);
    ctx.fill();
  }
  // 小さな目(あちこちに)
  for (const [x, y, s] of [
    [92, 66, 9],
    [196, 58, 11],
    [228, 104, 8],
    [70, 120, 7],
    [240, 160, 9],
    [168, 44, 7],
  ]) {
    eyeWhite(ctx, x, y, s);
    circle(ctx, x - s * 0.25, y + s * 0.1, s * 0.45);
    ctx.fillStyle = INK;
    ctx.fill();
  }
  // 口(上あご)。下あごは別の部品で開け閉めする。
  ctx.beginPath();
  ctx.moveTo(56, 168);
  ctx.quadraticCurveTo(120, 150, 196, 166);
  ctx.quadraticCurveTo(200, 196, 126, 204);
  ctx.quadraticCurveTo(60, 200, 56, 168);
  ctx.closePath();
  const mouth = ctx.createLinearGradient(0, 160, 0, 204);
  mouth.addColorStop(0, '#4a0e2a');
  mouth.addColorStop(1, '#1e0612');
  fillStroke(ctx, mouth, 3.5);
  // 舌
  ctx.beginPath();
  ctx.ellipse(126, 196, 34, 10, 0, Math.PI, 0);
  ctx.fillStyle = '#d9576e';
  ctx.fill();
  // 上の歯
  const teeth = 9;
  for (let i = 0; i < teeth; i++) {
    const t = i / (teeth - 1);
    const x = 64 + t * 126;
    const y = 166 - Math.sin(t * Math.PI) * 12;
    const len = 12 + (i % 3 === 0 ? 8 : 0);
    poly(ctx, [
      [x - 6, y],
      [x, y + len],
      [x + 6, y],
    ]);
    fillStroke(ctx, '#f6e8b0', 1.8);
  }
}

function drawMireMawJaw(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(6, 10);
  ctx.quadraticCurveTo(75, 22, 144, 10);
  ctx.quadraticCurveTo(140, 50, 75, 56);
  ctx.quadraticCurveTo(10, 50, 6, 10);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 10, 0, 56);
  g.addColorStop(0, '#8a4cbc');
  g.addColorStop(1, '#5e2f8a');
  fillStroke(ctx, g, 3.5);
  for (let i = 0; i < 7; i++) {
    const x = 20 + i * 18;
    const y = 14 + Math.sin((i / 6) * Math.PI) * 6;
    poly(ctx, [
      [x - 6, y],
      [x, y - 13],
      [x + 6, y],
    ]);
    fillStroke(ctx, '#f6e8b0', 1.8);
  }
}
