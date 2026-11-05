import type Phaser from 'phaser';
import { COLORS, INK_HEX, hex } from './palette.ts';

// 棒人間をコードで描く。骨(関節の角度)から線を引くので、どんなポーズも作れて、何体出しても絵柄が揃う。
// 角度は「真下=0、前=+π/2、真上=π」。facing=1 で右向き。

export type StickKind = 'sword' | 'archer' | 'mage' | 'bomber' | 'castleArcher' | 'gunner';

export interface StickPose {
  kind: StickKind;
  /** 歩きの位相(ラジアン)。 */
  walk: number;
  moving: boolean;
  /** 攻撃の進み具合。-1 なら攻撃していない。0〜1 で、ATTACK_STRIKE で当たる。 */
  attack: number;
  /** 被弾の白い光(0〜1)。 */
  flash: number;
  /** 経過時間(秒)。息づかいや火花のゆらぎに使う。 */
  time: number;
  facing: 1 | -1;
}

/** 攻撃の進み具合のうち、この位置で武器が当たる・矢が放たれる。 */
export const ATTACK_STRIKE = 0.62;

const LIMB = 4.2;
const THIGH = 12;
const SHIN = 12;
const TORSO = 21;
const UPPER = 10;
const FORE = 10;
const HEAD = 8.2;

interface P {
  x: number;
  y: number;
}

const add = (p: P, angle: number, len: number, f: number): P => ({
  x: p.x + Math.sin(angle) * len * f,
  y: p.y + Math.cos(angle) * len,
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

function mix(color: number, white: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const m = (c: number) => Math.round(c + (255 - c) * white);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

function limb(g: Phaser.GameObjects.Graphics, a: P, b: P, c: P, color: number, width = LIMB): void {
  g.lineStyle(width, color, 1);
  g.lineBetween(a.x, a.y, b.x, b.y);
  g.lineBetween(b.x, b.y, c.x, c.y);
  g.fillStyle(color, 1);
  g.fillCircle(b.x, b.y, width / 2);
  g.fillCircle(c.x, c.y, width / 2);
  g.fillCircle(a.x, a.y, width / 2);
}

/** 足元を (0,0) として描く。 */
export function drawStickman(g: Phaser.GameObjects.Graphics, pose: StickPose): void {
  const f = pose.facing;
  const ink = pose.flash > 0 ? mix(INK_HEX, pose.flash * 0.85) : INK_HEX;
  const moving = pose.moving;
  const ph = pose.walk;
  const attacking = pose.attack >= 0;
  const p = pose.attack;

  // 胴体
  const run = pose.kind === 'bomber' ? 1.4 : 1;
  const bob = moving ? Math.abs(Math.sin(ph)) * 2.2 : Math.sin(pose.time * 2.4) * 0.8;
  let lean = moving ? 0.14 * run : 0.03;
  if (attacking && pose.kind === 'sword') {
    lean = p < ATTACK_STRIKE ? lerp(0.05, -0.12, p / ATTACK_STRIKE) : lerp(0.32, 0.08, (p - ATTACK_STRIKE) / (1 - ATTACK_STRIKE));
  }
  const hip: P = { x: 0, y: -24 - bob };
  const neck: P = { x: hip.x + Math.sin(lean) * TORSO * f, y: hip.y - Math.cos(lean) * TORSO };
  const head: P = { x: neck.x + Math.sin(lean) * (HEAD + 2) * f, y: neck.y - Math.cos(lean) * (HEAD + 2) };
  const shoulder: P = { x: neck.x - Math.sin(lean) * 2 * f, y: neck.y + 2 };

  // 脚
  for (let i = 0; i < 2; i++) {
    const legPh = ph + i * Math.PI;
    let thigh: number;
    let bend: number;
    if (moving) {
      thigh = Math.sin(legPh) * 0.6 * run;
      bend = Math.max(0.08, -Math.cos(legPh) * 0.95);
    } else if (attacking && pose.kind === 'sword') {
      thigh = i === 0 ? 0.55 : -0.35;
      bend = i === 0 ? 0.5 : 0.15;
    } else {
      thigh = i === 0 ? 0.2 : -0.16;
      bend = 0.06;
    }
    const knee = add(hip, thigh, THIGH, f);
    const foot = add(knee, thigh - bend, SHIN, f);
    limb(g, hip, knee, foot, i === 0 ? ink : mix(ink, 0.12));
  }

  // 魔法使いのローブ
  if (pose.kind === 'mage') {
    g.fillStyle(0x3d5fd0, 1);
    g.lineStyle(2.5, ink, 1);
    const sway = moving ? Math.sin(ph * 2) * 2 : 0;
    const pts = [
      { x: neck.x - 3 * f, y: neck.y + 2 },
      { x: neck.x + 3 * f, y: neck.y + 2 },
      { x: hip.x + 11 * f + sway, y: hip.y + 13 },
      { x: hip.x - 9 * f + sway, y: hip.y + 13 },
    ];
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
    g.fillStyle(hex(COLORS.gold), 1);
    g.fillRect(hip.x - 6, hip.y - 1, 12, 2.5);
  }

  // 胴
  g.lineStyle(LIMB + 0.6, ink, 1);
  g.lineBetween(hip.x, hip.y, neck.x, neck.y);

  // 腕
  const arms = armPose(pose, f);
  const backElbow = add(shoulder, arms.back[0], UPPER, f);
  const backHand = arms.backHand ?? add(backElbow, arms.back[0] + arms.back[1], FORE, f);
  limb(g, shoulder, backElbow, backHand, mix(ink, 0.12));

  // 頭
  g.fillStyle(ink, 1);
  g.fillCircle(head.x, head.y, HEAD);
  drawHeadgear(g, pose, head, f, ink);

  const frontElbow = add(shoulder, arms.front[0], UPPER, f);
  const frontHand = add(frontElbow, arms.front[0] + arms.front[1], FORE, f);
  drawWeapon(g, pose, frontHand, arms.front[0] + arms.front[1], backHand, f, ink);
  limb(g, shoulder, frontElbow, frontHand, ink);
}

interface ArmPose {
  /** [上腕の角度, ひじの曲げ]。 */
  front: [number, number];
  back: [number, number];
  /** 後ろの手の位置を直接決める時(弓を引く手)。 */
  backHand?: P;
}

function armPose(pose: StickPose, f: number): ArmPose {
  const ph = pose.walk;
  const swing = pose.moving ? Math.sin(ph) * 0.7 : Math.sin(pose.time * 2.4) * 0.05;
  const p = pose.attack;
  const attacking = p >= 0;
  switch (pose.kind) {
    case 'sword': {
      if (!attacking) return { front: [0.7 - swing * 0.4, 1.0], back: [-swing - 0.2, 0.6] };
      let a: number;
      if (p < ATTACK_STRIKE) a = lerp(0.7, 3.5, p / ATTACK_STRIKE);
      else if (p < ATTACK_STRIKE + 0.14) a = lerp(3.5, 0.5, (p - ATTACK_STRIKE) / 0.14);
      else a = lerp(0.5, 0.7, (p - ATTACK_STRIKE - 0.14) / 0.24);
      return { front: [a, 0.25], back: [-0.5, 0.8] };
    }
    case 'archer':
    case 'castleArcher': {
      if (!attacking && pose.moving) return { front: [0.5 - swing * 0.3, 0.3], back: [-swing - 0.2, 0.6] };
      // 弓を前に構え、後ろの手で弦を引く
      const draw = !attacking ? 0.15 : p < ATTACK_STRIKE ? p / ATTACK_STRIKE : 0;
      const shoulderY = -24 - 21 + 2;
      const backHand: P = { x: (6 - draw * 15) * f, y: shoulderY - 1 };
      return { front: [Math.PI / 2 - 0.05, 0], back: [Math.PI / 2, 0.4], backHand };
    }
    case 'mage': {
      if (!attacking) return { front: [0.55 - swing * 0.3, -0.35], back: [-swing - 0.1, 0.5] };
      const a = p < ATTACK_STRIKE ? lerp(0.6, 2.1, p / ATTACK_STRIKE) : lerp(2.1, 0.6, (p - ATTACK_STRIKE) / (1 - ATTACK_STRIKE));
      return { front: [a, -0.3], back: [a * 0.6, 0.5] };
    }
    case 'bomber': {
      if (attacking) return { front: [2.9, 0.1], back: [2.7, 0.1] };
      return { front: [1.0, 0.9], back: [0.8, 1.1] };
    }
    case 'gunner':
      return { front: [1.2 + (attacking ? 0.4 : 0), 0.4], back: [0.6, 0.6] };
  }
}

function drawHeadgear(g: Phaser.GameObjects.Graphics, pose: StickPose, head: P, f: number, ink: number): void {
  if (pose.kind === 'mage') {
    // とんがり帽子
    const tilt = -0.25 * f;
    const tip = { x: head.x - 9 * f + Math.sin(pose.time * 3) * 1.5, y: head.y - 26 };
    const left = { x: head.x - 11, y: head.y - 5 };
    const right = { x: head.x + 11, y: head.y - 5 };
    g.fillStyle(0x3d5fd0, 1);
    g.lineStyle(2.5, ink, 1);
    g.fillTriangle(left.x, left.y, right.x, right.y, tip.x, tip.y);
    g.strokeTriangle(left.x, left.y, right.x, right.y, tip.x, tip.y);
    g.fillStyle(0x3d5fd0, 1);
    g.fillEllipse(head.x, head.y - 5, 30, 7);
    g.strokeEllipse(head.x, head.y - 5, 30, 7);
    g.fillStyle(hex(COLORS.gold), 1);
    g.fillCircle(head.x - 2 * f + tilt, head.y - 13, 2.2);
    return;
  }
  if (pose.kind === 'gunner') return;
  // 味方の印の鉢巻き(爆弾兵は赤)
  const color = pose.kind === 'bomber' ? 0xe04a3a : hex(COLORS.ally);
  g.lineStyle(3.2, color, 1);
  g.lineBetween(head.x - 8, head.y - 2, head.x + 8, head.y - 2);
  const wave = Math.sin(pose.time * 9 + (pose.moving ? pose.walk : 0)) * 2.5;
  const back = { x: head.x - 8 * f, y: head.y - 2 };
  g.lineStyle(2.4, color, 1);
  g.lineBetween(back.x, back.y, back.x - 8 * f, back.y + 2 + wave);
  g.lineBetween(back.x, back.y, back.x - 7 * f, back.y + 6 - wave * 0.6);
  if (pose.kind === 'sword') {
    // 剣士は兜の飾り
    g.fillStyle(0xb8bec8, 1);
    g.lineStyle(2, ink, 1);
    g.beginPath();
    g.arc(head.x, head.y - 1, HEAD + 1.5, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }
}

function drawWeapon(
  g: Phaser.GameObjects.Graphics,
  pose: StickPose,
  hand: P,
  armAngle: number,
  backHand: P,
  f: number,
  ink: number,
): void {
  const p = pose.attack;
  switch (pose.kind) {
    case 'sword': {
      const angle = armAngle + 0.9;
      const tip = add(hand, angle, 25, f);
      const base = add(hand, angle, 3, f);
      // 振り下ろしの軌跡
      if (p >= ATTACK_STRIKE && p < ATTACK_STRIKE + 0.2) {
        const k = 1 - (p - ATTACK_STRIKE) / 0.2;
        const cx = hand.x - Math.sin(angle) * 6 * f;
        const cy = hand.y - 6;
        g.lineStyle(7 * k + 2, 0xffffff, 0.55 * k);
        g.beginPath();
        const start = f > 0 ? -2.2 : Math.PI + 2.2;
        const end = f > 0 ? 0.6 : Math.PI - 0.6;
        g.arc(cx, cy, 28, start, end, f < 0);
        g.strokePath();
      }
      const nx = Math.cos(angle) * 2.4 * f;
      const ny = -Math.sin(angle) * 2.4;
      const pts = [
        { x: base.x + nx, y: base.y + ny },
        { x: tip.x, y: tip.y },
        { x: base.x - nx, y: base.y - ny },
      ];
      g.fillStyle(0xe8eef6, 1);
      g.lineStyle(1.8, ink, 1);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      g.lineStyle(3.2, 0x8a5a30, 1);
      g.lineBetween(hand.x + nx * 2.4, hand.y + ny * 2.4, hand.x - nx * 2.4, hand.y - ny * 2.4);
      return;
    }
    case 'archer':
    case 'castleArcher': {
      const bowX = hand.x;
      const bowY = hand.y;
      const top = { x: bowX - 4 * f, y: bowY - 15 };
      const bottom = { x: bowX - 4 * f, y: bowY + 15 };
      const drawn = pose.moving && p < 0 ? { x: top.x, y: bowY } : backHand;
      g.lineStyle(1.4, 0xf2ead8, 1);
      g.lineBetween(top.x, top.y, drawn.x, drawn.y);
      g.lineBetween(drawn.x, drawn.y, bottom.x, bottom.y);
      g.lineStyle(3.4, 0x7a4a24, 1);
      g.beginPath();
      if (f > 0) g.arc(bowX - 10, bowY, 17, -1.05, 1.05, false);
      else g.arc(bowX + 10, bowY, 17, Math.PI - 1.05, Math.PI + 1.05, false);
      g.strokePath();
      if (!pose.moving && (p < 0 || p < ATTACK_STRIKE)) {
        g.lineStyle(1.8, 0x5a3a1e, 1);
        g.lineBetween(drawn.x, drawn.y, bowX + 8 * f, bowY);
        g.fillStyle(0xcfd4dc, 1);
        g.fillTriangle(bowX + 8 * f, bowY - 2.5, bowX + 13 * f, bowY, bowX + 8 * f, bowY + 2.5);
      }
      return;
    }
    case 'mage': {
      const topY = hand.y - 24;
      const top = { x: hand.x + 2 * f, y: topY };
      g.lineStyle(3, 0x7a4a24, 1);
      g.lineBetween(hand.x - 1 * f, hand.y + 12, top.x, top.y);
      const charge = p >= 0 && p < ATTACK_STRIKE ? p / ATTACK_STRIKE : 0;
      const pulse = 0.5 + Math.sin(pose.time * 6) * 0.15;
      g.fillStyle(0x5fd3ff, 0.25 + charge * 0.3);
      g.fillCircle(top.x, top.y - 4, 9 + charge * 9 + pulse * 2);
      g.fillStyle(0x9fe8ff, 1);
      g.lineStyle(2, ink, 1);
      g.fillCircle(top.x, top.y - 4, 5);
      g.strokeCircle(top.x, top.y - 4, 5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(top.x - 1.5, top.y - 5.5, 1.6);
      return;
    }
    case 'bomber': {
      const bx = (hand.x + backHand.x) / 2 + 2 * f;
      const by = Math.min(hand.y, backHand.y) - 4;
      g.fillStyle(0x24222c, 1);
      g.lineStyle(2, ink, 1);
      g.fillCircle(bx, by, 8);
      g.strokeCircle(bx, by, 8);
      g.fillStyle(0x6a6a7a, 1);
      g.fillCircle(bx - 2.5, by - 2.5, 2.2);
      g.lineStyle(2, 0x8a6a40, 1);
      g.lineBetween(bx + 4, by - 6, bx + 7, by - 11);
      const flick = Math.sin(pose.time * 40) > 0;
      g.fillStyle(flick ? 0xfff07a : 0xff8a20, 1);
      g.fillCircle(bx + 7.5, by - 12, flick ? 3 : 2.2);
      return;
    }
    case 'gunner':
      return;
  }
}

/** 倒れた時の、手足を投げ出したポーズ。 */
export function drawRagdoll(g: Phaser.GameObjects.Graphics, kind: StickKind, t: number): void {
  const flail = Math.sin(t * 18) * 0.3;
  const hip: P = { x: 0, y: -20 };
  const neck: P = { x: 0, y: -40 };
  const head: P = { x: 0, y: -50 };
  limb(g, hip, add(hip, 0.9 + flail, THIGH, 1), add(add(hip, 0.9 + flail, THIGH, 1), 1.6, SHIN, 1), INK_HEX);
  limb(g, hip, add(hip, -0.7 - flail, THIGH, 1), add(add(hip, -0.7 - flail, THIGH, 1), -1.4, SHIN, 1), INK_HEX);
  g.lineStyle(LIMB + 0.6, INK_HEX, 1);
  g.lineBetween(hip.x, hip.y, neck.x, neck.y);
  limb(g, neck, add(neck, 2.4 - flail, UPPER, 1), add(add(neck, 2.4 - flail, UPPER, 1), 2.9, FORE, 1), INK_HEX);
  limb(g, neck, add(neck, -2.2 + flail, UPPER, 1), add(add(neck, -2.2 + flail, UPPER, 1), -2.8, FORE, 1), INK_HEX);
  g.fillStyle(INK_HEX, 1);
  g.fillCircle(head.x, head.y, HEAD);
  // ×の目
  g.lineStyle(1.6, 0xffffff, 1);
  for (const dx of [-3, 3]) {
    g.lineBetween(head.x + dx - 1.6, head.y - 1.6, head.x + dx + 1.6, head.y + 1.6);
    g.lineBetween(head.x + dx - 1.6, head.y + 1.6, head.x + dx + 1.6, head.y - 1.6);
  }
  if (kind === 'mage') {
    g.fillStyle(0x3d5fd0, 1);
    g.fillTriangle(head.x - 10, head.y - 5, head.x + 10, head.y - 5, head.x + 14, head.y - 22);
  }
}
