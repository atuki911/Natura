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
  makeTexture(scene, 'rotMoth_body', 48, 36, drawRotMothBody);
  makeTexture(scene, 'rotMoth_wing', 50, 38, drawRotMothWing);
  makeTexture(scene, 'rotMoth_wing_hind', 38, 30, drawRotMothHindWing);
  makeTexture(scene, 'burrower_mound', 70, 28, (ctx) => drawBurrowerMound(ctx, false));
  makeTexture(scene, 'burrower_mound_lip', 70, 28, (ctx) => drawBurrowerMound(ctx, true));
  makeTexture(scene, 'burrower_head', 38, 34, drawBurrowerHead);
  makeTexture(scene, 'burrower_segment', 30, 22, drawBurrowerSegment);
  makeTexture(scene, 'burrower_clod', 10, 9, drawClod);
  makeTexture(scene, 'sporeMother_body', 210, 160, drawSporeMotherBody);
  makeTexture(scene, 'sporeMother_jaw', 104, 42, drawSporeMotherJaw);
  makeTexture(scene, 'sporeMother_cap', 300, 122, drawSporeMotherCap);
  makeTexture(scene, 'sporeMother_sac', 46, 46, drawSporeSac);
  makeTexture(scene, 'sporeMother_leg', 36, 46, drawSporeMotherLeg);
  makeTexture(scene, 'spore_puff', 40, 40, drawSporePuff);
  makeTexture(scene, 'blightHeart_body', 280, 250, drawBlightHeartBody);
  makeTexture(scene, 'blightHeart_veins', 280, 250, drawBlightHeartVeins);
  makeTexture(scene, 'blightHeart_iris', 50, 50, drawBlightHeartIris);
  makeTexture(scene, 'blightHeart_crown', 250, 100, drawBlightHeartCrown);
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

// ---- 腐れ沼の蛾(rotMoth) ----

const MOTH = {
  body: '#46305f',
  light: '#7a5aa6',
  dark: '#24163a',
  wing: '#6a42a0',
  wingLight: '#9a74cf',
  wingDark: '#3a2262',
  glow: '#ff6ad5',
};

function drawRotMothBody(ctx: Ctx): void {
  const r = rng(51);
  // 羽毛のような触角
  for (const [bx, by, tx, ty] of [
    [9, 13, 1, 4],
    [12, 12, 8, 0.8],
  ]) {
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo((bx + tx) / 2 - 3.5, (by + ty) / 2 + 1, tx, ty);
    ctx.quadraticCurveTo((bx + tx) / 2 + 2, (by + ty) / 2 + 1, bx, by);
    fillStroke(ctx, '#a68ad0', 1.2);
  }
  // 細い脚
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  for (const [x, dx] of [
    [14, -3],
    [18, -1],
    [22, 2],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x + dx, 30);
    ctx.lineTo(x + dx - 2, 33);
    ctx.stroke();
  }
  // 腹(しま模様)
  const abd = () => {
    ctx.beginPath();
    ctx.ellipse(32, 22, 14, 8.5, 0.32, 0, Math.PI * 2);
  };
  shaded(ctx, abd, MOTH.body, { light: MOTH.light, dark: MOTH.dark, lineWidth: 2.2, box: [18, 13, 28, 18] });
  ctx.save();
  abd();
  ctx.clip();
  ctx.strokeStyle = MOTH.dark;
  ctx.lineWidth = 1.6;
  for (const x of [28, 34, 40]) {
    ctx.beginPath();
    ctx.moveTo(x - 1, 10);
    ctx.quadraticCurveTo(x + 3, 22, x - 1, 34);
    ctx.stroke();
  }
  ctx.restore();
  glow(ctx, 44, 27, 6, MOTH.glow, 0.8);
  // 胸(もこもこ)
  shaded(ctx, () => blobPath(ctx, 19, 17, 10, 10, r, 16, 0.14), MOTH.body, {
    light: MOTH.light,
    dark: MOTH.dark,
    lineWidth: 2.2,
    box: [9, 7, 20, 20],
  });
  ctx.strokeStyle = MOTH.light;
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = -2.6 + i * 0.45;
    ctx.beginPath();
    ctx.moveTo(19 + Math.cos(a) * 5, 17 + Math.sin(a) * 5);
    ctx.lineTo(19 + Math.cos(a) * 8, 17 + Math.sin(a) * 8);
    ctx.stroke();
  }
  // 頭
  shaded(ctx, () => circle(ctx, 9.5, 19, 7), MOTH.body, { light: MOTH.light, dark: MOTH.dark, lineWidth: 2.2, box: [2.5, 12, 14, 14] });
  // 小さな大あご
  for (const [y, dir] of [
    [22.5, -1],
    [25.5, 1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(4.5, y);
    ctx.quadraticCurveTo(0.5, y, 1, y + dir * 2.5);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#f2e2c4';
    ctx.stroke();
  }
  // 大きな目
  circle(ctx, 8, 17, 4.3);
  fillStroke(ctx, '#ffffff', 1.4);
  circle(ctx, 6.8, 17.6, 2.6);
  ctx.fillStyle = INK;
  ctx.fill();
  circle(ctx, 6.1, 16.6, 0.9);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function mothWing(ctx: Ctx, path: () => void, spots: [number, number, number][], box: [number, number, number, number], root: [number, number]): void {
  shaded(ctx, path, MOTH.wing, { light: MOTH.wingLight, dark: MOTH.wingDark, lineWidth: 2.2, box, lightOffset: [0.55, 0.2] });
  ctx.save();
  path();
  ctx.clip();
  // 翅脈
  ctx.strokeStyle = rgba(MOTH.dark, 0.7);
  ctx.lineWidth = 1;
  const [x, y, w, h] = box;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(root[0], root[1]);
    ctx.quadraticCurveTo(x + w * (0.3 + i * 0.12), y + h * (0.5 - i * 0.05), x + w * (0.55 + i * 0.15), y + h * (0.05 + i * 0.22));
    ctx.stroke();
  }
  // ふちの欠け(ぼろぼろの翅)
  ctx.fillStyle = rgba(MOTH.wingDark, 0.9);
  for (let i = 0; i < 5; i++) {
    circle(ctx, x + w * (0.45 + i * 0.13), y + h * (0.98 - i * 0.12), 1.6);
    ctx.fill();
  }
  ctx.restore();
  // 前のふちの明るい線(暗い背景でも形が見えるように)
  ctx.save();
  path();
  ctx.clip();
  path();
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba('#c9a8f0', 0.6);
  ctx.stroke();
  ctx.restore();
  path();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // 光る桃色の斑点
  for (const [sx, sy, sr] of spots) {
    glow(ctx, sx, sy, sr * 2.6, MOTH.glow, 0.75);
    circle(ctx, sx, sy, sr);
    fillStroke(ctx, '#ff8fe2', 1.2);
    circle(ctx, sx - sr * 0.3, sy - sr * 0.3, sr * 0.38);
    ctx.fillStyle = '#ffe8f8';
    ctx.fill();
  }
}

function drawRotMothWing(ctx: Ctx): void {
  // 付け根は (5, 27) を 1.25 倍した位置。右上へ流れる前翅。
  ctx.scale(1.25, 1.25);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(5, 27);
    ctx.bezierCurveTo(3, 14, 16, 2, 36, 3);
    ctx.quadraticCurveTo(40, 12, 31, 18);
    ctx.quadraticCurveTo(18, 21, 5, 27);
    ctx.closePath();
  };
  mothWing(
    ctx,
    path,
    [
      [25, 10, 3.6],
      [15, 16, 2],
    ],
    [3, 2, 36, 25],
    [5, 27],
  );
}

function drawRotMothHindWing(ctx: Ctx): void {
  // 付け根は (4, 21) を 1.25 倍した位置。
  ctx.scale(1.25, 1.25);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(4, 21);
    ctx.bezierCurveTo(2, 10, 13, 2, 24, 4);
    ctx.quadraticCurveTo(30, 12, 22, 18);
    ctx.quadraticCurveTo(12, 21, 4, 21);
    ctx.closePath();
  };
  mothWing(ctx, path, [[18, 11, 2.8]], [2, 3, 27, 19], [4, 21]);
}

// ---- 地虫(burrower) ----

const GRUB = { base: '#b5739e', light: '#e3a7cb', dark: '#7a4870' };
const DIRT = { base: '#6c4c45', light: '#93705f', dark: '#432f2c' };
/** 盛り土の穴(テクスチャの中の位置)。 */
const BURROW_HOLE = { x: 35, y: 11, rx: 14, ry: 4.5 };

function drawBurrowerMound(ctx: Ctx, lipOnly: boolean): void {
  const r = rng(61);
  const mound = () => {
    ctx.beginPath();
    ctx.moveTo(1, 27);
    ctx.bezierCurveTo(6, 18, 16, 7, 35, 6);
    ctx.bezierCurveTo(54, 7, 64, 18, 69, 27);
    ctx.quadraticCurveTo(35, 29, 1, 27);
    ctx.closePath();
  };
  ctx.save();
  if (lipOnly) {
    // 穴より手前だけ(頭や胴の下を隠す)
    ctx.beginPath();
    ctx.rect(0, BURROW_HOLE.y, 70, 28);
    ctx.clip();
  }
  shaded(ctx, mound, DIRT.base, { light: DIRT.light, dark: DIRT.dark, lineWidth: 0.01, box: [1, 6, 68, 22], lightOffset: [0.3, 0.3] });
  // 輪郭は上の丸みだけ(地面との境目には引かない)
  ctx.beginPath();
  ctx.moveTo(1, 27);
  ctx.bezierCurveTo(6, 18, 16, 7, 35, 6);
  ctx.bezierCurveTo(54, 7, 64, 18, 69, 27);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // 土くれと小石
  ctx.save();
  mound();
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    const x = r.range(6, 64);
    const y = r.range(14, 26);
    ctx.beginPath();
    ctx.ellipse(x, y, r.range(1.5, 3), r.range(1, 2), r.range(0, 3), 0, Math.PI * 2);
    ctx.fillStyle = i % 3 === 0 ? '#8e7f8c' : DIRT.dark;
    ctx.fill();
  }
  ctx.restore();
  const hole = () => {
    ctx.beginPath();
    ctx.ellipse(BURROW_HOLE.x, BURROW_HOLE.y, BURROW_HOLE.rx, BURROW_HOLE.ry, 0, 0, Math.PI * 2);
  };
  if (lipOnly) {
    ctx.globalCompositeOperation = 'destination-out';
    hole();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.ellipse(BURROW_HOLE.x, BURROW_HOLE.y, BURROW_HOLE.rx, BURROW_HOLE.ry, 0, 0, Math.PI);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else {
    hole();
    fillStroke(ctx, '#1e1218', 2.2);
  }
  ctx.restore();
}

function drawBurrowerHead(ctx: Ctx): void {
  const r = rng(62);
  // 頭(中心 23,18)
  const head = () => blobPath(ctx, 23, 18, 14, 14, r, 9, 0.04);
  shaded(ctx, head, GRUB.base, { light: GRUB.light, dark: GRUB.dark, lineWidth: 2.6, box: [9, 4, 28, 28] });
  // 首の節
  ctx.beginPath();
  ctx.moveTo(30, 6);
  ctx.quadraticCurveTo(36, 18, 30, 31);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = GRUB.dark;
  ctx.stroke();
  // しみ
  ctx.fillStyle = rgba(GRUB.dark, 0.55);
  for (const [x, y, s] of [
    [26, 24, 2.2],
    [31, 14, 1.6],
    [20, 27, 1.4],
  ]) {
    circle(ctx, x, y, s);
    ctx.fill();
  }
  // ドリルのような歯(左を向く円すい)
  const drill = () => {
    ctx.beginPath();
    ctx.moveTo(14, 7);
    ctx.quadraticCurveTo(6, 11, 1, 19);
    ctx.quadraticCurveTo(6, 26, 14, 30);
    ctx.quadraticCurveTo(10, 18.5, 14, 7);
    ctx.closePath();
  };
  drill();
  ctx.fillStyle = '#f2e4c2';
  ctx.fill();
  ctx.save();
  drill();
  ctx.clip();
  // ねじれた溝(ドリルの刃)
  ctx.fillStyle = '#b08e5e';
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 3.6;
    poly(ctx, [
      [x, 4],
      [x + 1.8, 4],
      [x + 8.8, 34],
      [x + 7, 34],
    ]);
    ctx.fill();
  }
  ctx.fillStyle = rgba('#ffffff', 0.55);
  ctx.beginPath();
  ctx.ellipse(9, 13, 3.5, 1.4, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // ふちの小さな牙
  for (const [x, y, dx, dy] of [
    [14, 8, -3, -3],
    [15, 29, -3, 3],
    [16, 13, -4, 0],
    [16, 24, -4, 1],
  ]) {
    poly(ctx, [
      [x, y - 1.6],
      [x + dx, y + dy],
      [x, y + 1.6],
    ]);
    fillStroke(ctx, '#fff7e0', 1.1);
  }
  // 小さな目
  circle(ctx, 23, 10, 3.6);
  fillStroke(ctx, '#fff6d8', 1.4);
  circle(ctx, 22, 10.4, 2);
  ctx.fillStyle = INK;
  ctx.fill();
  circle(ctx, 21.5, 9.6, 0.7);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18.5, 5.5);
  ctx.lineTo(26, 6.5);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawBurrowerSegment(ctx: Ctx): void {
  const seg = () => {
    ctx.beginPath();
    ctx.ellipse(15, 11, 13, 9, 0, 0, Math.PI * 2);
  };
  shaded(ctx, seg, GRUB.base, { light: GRUB.light, dark: GRUB.dark, lineWidth: 2.4, box: [2, 2, 26, 18] });
  ctx.beginPath();
  ctx.ellipse(15, 12, 10, 4, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = GRUB.dark;
  ctx.stroke();
  // 剛毛
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  for (const [x, dx] of [
    [3, -3],
    [27, 3],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, 11);
    ctx.lineTo(x + dx, 9);
    ctx.stroke();
  }
}

function drawClod(ctx: Ctx): void {
  const r = rng(63);
  shaded(ctx, () => blobPath(ctx, 5, 4.5, 3.6, 3, r, 6, 0.2), DIRT.base, { light: DIRT.light, dark: DIRT.dark, lineWidth: 1.4, box: [1, 1, 8, 7] });
}

// ---- 胞子の母(sporeMother) ----

const FLESH = { base: '#7fb3a6', light: '#b4ddd0', dark: '#4c7c76' };
const CAP = { base: '#7d3fb0', light: '#a96ad6', dark: '#4e2278', spot: '#5fe3c8', gill: '#d8c2ea' };

function drawSporeMotherBody(ctx: Ctx): void {
  const r = rng(71);
  // ふくらんだ胴
  const pts: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const k = 1 + (r.next() - 0.5) * 0.08;
    const top = Math.sin(a) < -0.6 ? 0.82 : 1;
    pts.push([105 + Math.cos(a) * 98 * k * top, 88 + Math.sin(a) * 70 * k]);
  }
  const path = () => smoothClosed(ctx, pts);
  shaded(ctx, path, FLESH.base, { light: FLESH.light, dark: FLESH.dark, lineWidth: 4, box: [7, 18, 196, 140] });
  // いぼ
  ctx.save();
  path();
  ctx.clip();
  for (let i = 0; i < 18; i++) {
    const x = r.range(30, 200);
    const y = r.range(40, 150);
    circle(ctx, x, y, r.range(2, 4.5));
    ctx.fillStyle = rgba(FLESH.dark, 0.55);
    ctx.fill();
  }
  // 傘の下のひだの輪(つば)
  ctx.beginPath();
  ctx.moveTo(10, 30);
  for (let i = 0; i <= 14; i++) {
    const x = 10 + i * 14;
    ctx.quadraticCurveTo(x - 7, 50 + (i % 2) * 4, x, 40);
  }
  ctx.lineTo(210, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  fillStroke(ctx, '#e8e0f0', 2.6);
  ctx.restore();
  path();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // 大きな口(上あご)。下あごは別の部品。
  ctx.beginPath();
  ctx.moveTo(14, 98);
  ctx.quadraticCurveTo(60, 82, 120, 96);
  ctx.quadraticCurveTo(116, 140, 66, 142);
  ctx.quadraticCurveTo(18, 138, 14, 98);
  ctx.closePath();
  const mouth = ctx.createLinearGradient(0, 90, 0, 142);
  mouth.addColorStop(0, '#4a0e3a');
  mouth.addColorStop(1, '#1e0618');
  fillStroke(ctx, mouth, 3.5);
  ctx.beginPath();
  ctx.ellipse(66, 140, 28, 9, 0, Math.PI, 0);
  ctx.fillStyle = '#c95a8a';
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = 22 + t * 92;
    const y = 96 - Math.sin(t * Math.PI) * 9;
    const len = 10 + (i % 2 === 0 ? 5 : 0);
    poly(ctx, [
      [x - 5, y],
      [x, y + len],
      [x + 5, y],
    ]);
    fillStroke(ctx, '#f6e8b0', 1.6);
  }
}

function drawSporeMotherJaw(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(4, 8);
  ctx.quadraticCurveTo(52, 18, 100, 8);
  ctx.quadraticCurveTo(96, 38, 52, 40);
  ctx.quadraticCurveTo(8, 38, 4, 8);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 8, 0, 40);
  g.addColorStop(0, FLESH.base);
  g.addColorStop(1, FLESH.dark);
  fillStroke(ctx, g, 3.5);
  for (let i = 0; i < 5; i++) {
    const x = 16 + i * 18;
    const y = 11 + Math.sin((i / 4) * Math.PI) * 4;
    poly(ctx, [
      [x - 5, y],
      [x, y - 11],
      [x + 5, y],
    ]);
    fillStroke(ctx, '#f6e8b0', 1.6);
  }
}

function drawSporeMotherCap(ctx: Ctx): void {
  const r = rng(72);
  // 裏のひだ
  ctx.beginPath();
  ctx.ellipse(150, 104, 140, 13, 0, 0, Math.PI * 2);
  fillStroke(ctx, CAP.gill, 3);
  ctx.strokeStyle = rgba('#8a6aa8', 0.8);
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(150, 100);
    ctx.lineTo(150 + Math.cos(a) * 134, 104 + Math.sin(a) * 11);
    ctx.stroke();
  }
  // 丸い傘(ふちは波打つ)
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(8, 100);
    ctx.bezierCurveTo(8, 36, 80, 4, 150, 4);
    ctx.bezierCurveTo(220, 4, 292, 36, 292, 100);
    for (let i = 1; i <= 10; i++) {
      const x = 292 - i * 28.4;
      ctx.quadraticCurveTo(x + 14.2, 112, x, 100);
    }
    ctx.closePath();
  };
  shaded(ctx, dome, CAP.base, { light: CAP.light, dark: CAP.dark, lineWidth: 4, box: [8, 4, 284, 104], lightOffset: [0.3, 0.2] });
  // 青緑の斑点
  ctx.save();
  dome();
  ctx.clip();
  for (const [x, y, s] of [
    [58, 52, 13],
    [104, 26, 10],
    [150, 60, 15],
    [196, 30, 9],
    [238, 62, 12],
    [30, 86, 7],
    [112, 88, 8],
    [194, 86, 9],
    [272, 92, 7],
    [146, 16, 5],
  ]) {
    glow(ctx, x, y, s * 1.9, CAP.spot, 0.45);
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.8, r.range(-0.3, 0.3), 0, Math.PI * 2);
    fillStroke(ctx, CAP.spot, 2.2);
    ctx.beginPath();
    ctx.ellipse(x - s * 0.3, y - s * 0.3, s * 0.35, s * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#e8fff8', 0.85);
    ctx.fill();
  }
  ctx.restore();
  // たれる粘液
  for (const [x, len] of [
    [64, 10],
    [176, 14],
    [246, 8],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x - 4, 104);
    ctx.quadraticCurveTo(x, 104 + len * 1.4, x + 4, 104);
    fillStroke(ctx, CAP.dark, 2);
  }
}

function drawSporeSac(ctx: Ctx): void {
  glow(ctx, 23, 23, 23, '#c8f06a', 0.5);
  circle(ctx, 23, 23, 16);
  const g = ctx.createRadialGradient(18, 17, 2, 23, 23, 16);
  g.addColorStop(0, '#f2ffb0');
  g.addColorStop(0.6, '#c2e65a');
  g.addColorStop(1, '#7aa83a');
  fillStroke(ctx, g, 2.6);
  const r = rng(73);
  ctx.fillStyle = rgba('#4e7a2a', 0.7);
  for (let i = 0; i < 9; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(3, 11);
    circle(ctx, 23 + Math.cos(a) * d, 25 + Math.sin(a) * d, r.range(1, 2));
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(17, 15, 5, 2.6, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#ffffff', 0.8);
  ctx.fill();
}

function drawSporeMotherLeg(ctx: Ctx): void {
  // 上が付け根(18, 4)。下で根が分かれる。
  ctx.beginPath();
  ctx.moveTo(5, 4);
  ctx.quadraticCurveTo(8, 26, 4, 40);
  ctx.lineTo(10, 38);
  ctx.lineTo(12, 44);
  ctx.lineTo(18, 37);
  ctx.lineTo(25, 44);
  ctx.lineTo(26, 38);
  ctx.lineTo(33, 41);
  ctx.quadraticCurveTo(27, 24, 31, 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 36, 0);
  g.addColorStop(0, FLESH.light);
  g.addColorStop(0.5, FLESH.base);
  g.addColorStop(1, FLESH.dark);
  fillStroke(ctx, g, 2.8);
  ctx.strokeStyle = rgba(FLESH.dark, 0.8);
  ctx.lineWidth = 1.4;
  for (const y of [16, 26]) {
    ctx.beginPath();
    ctx.moveTo(9, y);
    ctx.quadraticCurveTo(18, y + 3, 27, y);
    ctx.stroke();
  }
}

function drawSporePuff(ctx: Ctx): void {
  glow(ctx, 20, 20, 20, '#e2ffb4', 1);
  circle(ctx, 20, 20, 9);
  ctx.fillStyle = rgba('#f4ffd8', 0.45);
  ctx.fill();
  const r = rng(74);
  ctx.fillStyle = rgba('#8fc06a', 0.7);
  for (let i = 0; i < 6; i++) {
    circle(ctx, 20 + r.range(-8, 8), 20 + r.range(-8, 8), r.range(0.8, 1.6));
    ctx.fill();
  }
}

// ---- 穢れの心臓(blightHeart) ----

const HEART = { base: '#7c2050', light: '#b04a7c', dark: '#4a0f34', vein: '#e07bff' };
const HEART_PTS: [number, number][] = [
  [140, 50],
  [168, 24],
  [212, 16],
  [250, 40],
  [268, 84],
  [266, 132],
  [250, 178],
  [220, 214],
  [180, 238],
  [140, 246],
  [100, 240],
  [62, 222],
  [30, 186],
  [14, 140],
  [14, 92],
  [28, 50],
  [64, 20],
  [108, 22],
];
/** 目のくぼみの中心(テクスチャの中の位置)。 */
const HEART_EYE = { x: 136, y: 132 };

function drawBlightHeartBody(ctx: Ctx): void {
  const r = rng(81);
  // 背中から出る太い管
  ctx.beginPath();
  ctx.moveTo(214, 54);
  ctx.quadraticCurveTo(236, 20, 262, 12);
  ctx.lineTo(274, 34);
  ctx.quadraticCurveTo(254, 44, 244, 70);
  ctx.closePath();
  fillStroke(ctx, HEART.dark, 3.5);
  ctx.beginPath();
  ctx.ellipse(268, 23, 6, 12, -0.5, 0, Math.PI * 2);
  fillStroke(ctx, '#24061a', 3);
  // 心臓の塊
  const path = () => smoothClosed(ctx, HEART_PTS);
  shaded(ctx, path, HEART.base, { light: HEART.light, dark: HEART.dark, lineWidth: 4.5, box: [14, 16, 254, 230], lightOffset: [0.26, 0.2] });
  // 筋と、ぶつぶつ
  ctx.save();
  path();
  ctx.clip();
  ctx.strokeStyle = rgba(HEART.dark, 0.85);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(140, 52);
  ctx.bezierCurveTo(118, 100, 190, 160, 172, 244);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (const [x, y, x2, y2] of [
    [40, 80, 62, 200],
    [236, 60, 248, 170],
    [90, 30, 80, 70],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + 14, (y + y2) / 2, x2, y2);
    ctx.stroke();
  }
  for (let i = 0; i < 22; i++) {
    const x = r.range(24, 260);
    const y = r.range(40, 236);
    if (Math.hypot(x - HEART_EYE.x, y - HEART_EYE.y) < 62) continue;
    circle(ctx, x, y, r.range(2, 5));
    ctx.fillStyle = rgba(HEART.dark, 0.6);
    ctx.fill();
  }
  ctx.restore();
  // 大きな目のくぼみ(まぶたのふち)
  ctx.beginPath();
  ctx.ellipse(HEART_EYE.x, HEART_EYE.y, 60, 56, 0, 0, Math.PI * 2);
  fillStroke(ctx, HEART.light, 4);
  ctx.beginPath();
  ctx.ellipse(HEART_EYE.x, HEART_EYE.y + 2, 52, 48, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#22061a', 3);
}

function drawBlightHeartVeins(ctx: Ctx): void {
  // 目のくぼみから外へ枝分かれする、光る血管。体と同じ大きさ・位置に重ねる。
  ctx.save();
  smoothClosed(ctx, HEART_PTS);
  ctx.clip();
  const pass = (color: string, width: number, blur: number) => {
    const r = rng(82);
    ctx.strokeStyle = color;
    ctx.shadowColor = HEART.vein;
    ctx.shadowBlur = blur;
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number): void => {
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      const bend = r.range(-8, 8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + x2) / 2 - Math.sin(a) * bend, (y + y2) / 2 + Math.cos(a) * bend, x2, y2);
      ctx.lineWidth = w;
      ctx.stroke();
      if (depth > 0) {
        branch(x2, y2, a + r.range(0.25, 0.6), len * 0.68, w * 0.7, depth - 1);
        branch(x2, y2, a - r.range(0.25, 0.6), len * 0.68, w * 0.7, depth - 1);
      }
    };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      branch(HEART_EYE.x + Math.cos(a) * 60, HEART_EYE.y + Math.sin(a) * 56, a + r.range(-0.3, 0.3), r.range(30, 44), width, 2);
    }
  };
  pass('#c05ae8', 5, 12);
  pass('#f4c8ff', 2, 0);
  ctx.restore();
}

function drawBlightHeartIris(ctx: Ctx): void {
  circle(ctx, 25, 25, 22);
  const g = ctx.createRadialGradient(25, 25, 4, 25, 25, 22);
  g.addColorStop(0, '#ffb0d8');
  g.addColorStop(0.45, '#ff3f8e');
  g.addColorStop(1, '#7a0c3c');
  fillStroke(ctx, g, 2.4);
  ctx.strokeStyle = rgba('#5a0828', 0.6);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(25 + Math.cos(a) * 9, 25 + Math.sin(a) * 9);
    ctx.lineTo(25 + Math.cos(a) * 19, 25 + Math.sin(a) * 19);
    ctx.stroke();
  }
  // 縦長のひとみ
  ctx.beginPath();
  ctx.ellipse(25, 25, 4.6, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  circle(ctx, 18, 17, 3.6);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawBlightHeartCrown(ctx: Ctx): void {
  const r = rng(83);
  // とげ(扇のように広がる)
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const bx = 18 + t * 214;
    const by = 86 - Math.sin(t * Math.PI) * 22;
    const a = -Math.PI / 2 + (t - 0.5) * 1.6 + r.range(-0.12, 0.12);
    const len = (i % 2 === 0 ? 62 : 40) * (0.75 + Math.sin(t * Math.PI) * 0.35) * r.range(0.9, 1.05);
    const tx = bx + Math.cos(a) * len;
    const ty = by + Math.sin(a) * len;
    const nx = Math.cos(a + Math.PI / 2) * 7;
    const ny = Math.sin(a + Math.PI / 2) * 7;
    const bend = (t - 0.5) * 8;
    ctx.beginPath();
    ctx.moveTo(bx - nx, by - ny);
    ctx.quadraticCurveTo((bx + tx) / 2 - nx * 0.4 + bend, (by + ty) / 2 - ny * 0.4, tx, ty);
    ctx.quadraticCurveTo((bx + tx) / 2 + nx * 0.4 + bend, (by + ty) / 2 + ny * 0.4, bx + nx, by + ny);
    ctx.closePath();
    fillStroke(ctx, '#2c2238', 2.6);
    // 光の筋
    ctx.beginPath();
    ctx.moveTo(bx - nx * 0.4, by - ny * 0.4);
    ctx.lineTo(bx + (tx - bx) * 0.7 - nx * 0.15, by + (ty - by) * 0.7 - ny * 0.15);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#5c4a74';
    ctx.stroke();
    if (i % 2 === 0) glow(ctx, tx, ty, 7, '#e07bff', 0.7);
  }
  // ねじれた茨の輪
  ctx.beginPath();
  ctx.moveTo(8, 90);
  ctx.quadraticCurveTo(125, 42, 242, 90);
  ctx.lineWidth = 16;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#2c2238';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#5c4a74';
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const x = 8 + t * 234;
    const y = 90 - 2 * t * (1 - t) * 48;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 4);
    ctx.lineTo(x + 5, y + 3);
    ctx.stroke();
  }
}
