import Phaser from 'phaser';
import type { EnemyId } from '../sim/types.ts';
import { ART_SCALE, FLY_HEIGHT } from './layout.ts';
import { INK_HEX } from './palette.ts';
import { ATTACK_STRIKE } from './stickman.ts';

// 敵の見た目。部品(テクスチャ)を組み立てて、伸び縮み・揺れ・回転で動かす。

export interface EnemyAnim {
  time: number;
  moving: boolean;
  /** -1 なら攻撃していない。0〜1。 */
  attack: number;
  flash: number;
}

export interface EnemyView {
  /** 足元が (0,0)。 */
  root: Phaser.GameObjects.Container;
  /** 体の部品(ここを揺らす)。 */
  body: Phaser.GameObjects.Container;
  /** 頭の上の高さ(体力の棒を出す位置)。 */
  height: number;
  update(anim: EnemyAnim): void;
  /** 被弾で白く光らせる対象。 */
  sprites: Phaser.GameObjects.Image[];
}

const S = 1 / ART_SCALE;

function img(scene: Phaser.Scene, key: string, x: number, y: number, ox = 0.5, oy = 0.5): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setOrigin(ox, oy).setScale(S);
}

/** 攻撃の踏み込み量(0〜1)。当たる瞬間に最大。 */
function lunge(attack: number): number {
  if (attack < 0) return 0;
  if (attack < ATTACK_STRIKE) return -0.25 * (attack / ATTACK_STRIKE);
  const k = (attack - ATTACK_STRIKE) / (1 - ATTACK_STRIKE);
  return k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
}

function applyFlash(sprites: Phaser.GameObjects.Image[], flash: number): void {
  for (const s of sprites) {
    if (flash > 0.35) s.setTintFill(0xffffff);
    else s.clearTint();
  }
}

export function createEnemyView(scene: Phaser.Scene, id: EnemyId): EnemyView {
  switch (id) {
    case 'blightling':
      return blightling(scene);
    case 'gnasher':
      return gnasher(scene);
    case 'tuskbeast':
      return tuskbeast(scene);
    case 'wisp':
      return wisp(scene);
    case 'rollereye':
      return rollereye(scene);
    case 'mireMaw':
      return mireMaw(scene);
    // 仮の見た目(専用の絵ができるまで)
    case 'rotMoth':
      return wisp(scene);
    case 'burrower':
      return gnasher(scene);
    case 'sporeMother':
    case 'blightHeart':
      return mireMaw(scene);
  }
}

function base(scene: Phaser.Scene, shadowScale: number): { root: Phaser.GameObjects.Container; body: Phaser.GameObjects.Container } {
  const root = scene.add.container(0, 0);
  const shadow = img(scene, 'shadow', 0, 0).setScale(S * shadowScale, S);
  const body = scene.add.container(0, 0);
  root.add([shadow, body]);
  return { root, body };
}

function blightling(scene: Phaser.Scene): EnemyView {
  const { root, body } = base(scene, 0.9);
  const sprite = img(scene, 'blightling_body', 0, 2, 0.5, 1);
  const eyes = [img(scene, 'eye_white', -6, -36), img(scene, 'eye_white', 7, -38).setScale(S * 1.15)];
  const pupils = [img(scene, 'pupil', -8, -35), img(scene, 'pupil', 5, -37)];
  body.add([sprite, ...eyes, ...pupils]);
  const sprites = [sprite];
  return {
    root,
    body,
    height: 62,
    sprites,
    update(a) {
      const hop = a.moving ? Math.abs(Math.sin(a.time * 6)) : 0;
      const squash = a.moving ? Math.cos(a.time * 12) * 0.07 : Math.sin(a.time * 3) * 0.03;
      const l = lunge(a.attack);
      body.y = -hop * 8;
      body.x = -l * 12;
      body.scaleY = 1 + squash - (a.attack >= 0 && a.attack < ATTACK_STRIKE ? 0.12 * (a.attack / ATTACK_STRIKE) : 0);
      body.scaleX = 1 - squash * 0.8;
      const blink = Math.sin(a.time * 1.3 + 2) > 0.985;
      for (const e of eyes) e.scaleY = blink ? S * 0.15 : e.scaleX;
      for (const p of pupils) p.visible = !blink;
      applyFlash(sprites, a.flash);
    },
  };
}

function gnasher(scene: Phaser.Scene): EnemyView {
  const { root, body } = base(scene, 0.7);
  const legs = scene.add.graphics();
  const sprite = img(scene, 'gnasher_body', 0, -8, 0.5, 1);
  body.add([legs, sprite]);
  const sprites = [sprite];
  return {
    root,
    body,
    height: 56,
    sprites,
    update(a) {
      const ph = a.time * 16;
      legs.clear();
      legs.lineStyle(4, INK_HEX, 1);
      for (let i = 0; i < 2; i++) {
        const s = a.moving ? Math.sin(ph + i * Math.PI) * 6 : 0;
        const x = (i === 0 ? -6 : 6) + 0;
        legs.lineBetween(x, -12, x + s, 0);
        legs.lineBetween(x + s, 0, x + s - 4, 0);
      }
      const l = lunge(a.attack);
      body.x = -l * 16;
      body.y = a.moving ? -Math.abs(Math.sin(ph)) * 3 : 0;
      sprite.rotation = a.moving ? Math.sin(ph) * 0.06 : -l * 0.3;
      applyFlash(sprites, a.flash);
    },
  };
}

function tuskbeast(scene: Phaser.Scene): EnemyView {
  const { root, body } = base(scene, 1.9);
  const legs = scene.add.graphics();
  const sprite = img(scene, 'tuskbeast_body', 4, -14, 0.5, 1);
  const rider = img(scene, 'tuskbeast_rider', 14, -62, 0.5, 1);
  body.add([legs, sprite, rider]);
  const sprites = [sprite, rider];
  return {
    root,
    body,
    height: 100,
    sprites,
    update(a) {
      const ph = a.time * 7;
      legs.clear();
      for (let i = 0; i < 4; i++) {
        const x = [-30, -14, 16, 32][i];
        const s = a.moving ? Math.sin(ph + (i % 2) * Math.PI) * 7 : 0;
        legs.lineStyle(10, INK_HEX, 1);
        legs.lineBetween(x, -24, x + s, -2);
        legs.lineStyle(6, i < 2 ? 0x6a4c36 : 0x5a3e2c, 1);
        legs.lineBetween(x, -24, x + s, -3);
        legs.fillStyle(0x2a1e18, 1);
        legs.fillEllipse(x + s - 1, -1, 12, 6);
      }
      const l = lunge(a.attack);
      body.x = -l * 14;
      body.y = a.moving ? -Math.abs(Math.sin(ph)) * 3 : 0;
      sprite.rotation = -l * 0.12;
      rider.y = -62 + (a.moving ? Math.sin(ph * 2) * 2 : 0);
      rider.rotation = -l * 0.4;
      applyFlash(sprites, a.flash);
    },
  };
}

function wisp(scene: Phaser.Scene): EnemyView {
  const root = scene.add.container(0, 0);
  const shadow = img(scene, 'shadow', 0, 0).setScale(S * 0.6, S * 0.7).setAlpha(0.7);
  const body = scene.add.container(0, -FLY_HEIGHT);
  const sprite = img(scene, 'wisp_body', 0, 0, 0.5, 0.5);
  body.add(sprite);
  root.add([shadow, body]);
  const sprites = [sprite];
  return {
    root,
    body,
    height: FLY_HEIGHT + 50,
    sprites,
    update(a) {
      const l = lunge(a.attack);
      body.y = -FLY_HEIGHT + Math.sin(a.time * 2.6) * 7;
      body.x = -l * 8;
      sprite.rotation = Math.sin(a.time * 1.9) * 0.08 - l * 0.2;
      sprite.scaleX = S * (1 + Math.sin(a.time * 5) * 0.04);
      sprite.scaleY = S * (1 - Math.sin(a.time * 5) * 0.04);
      shadow.scaleX = S * (0.6 + Math.sin(a.time * 2.6) * 0.05);
      applyFlash(sprites, a.flash);
    },
  };
}

function rollereye(scene: Phaser.Scene): EnemyView {
  const { root, body } = base(scene, 1);
  const ball = img(scene, 'rollereye_body', 0, -36, 0.5, 0.5);
  const iris = img(scene, 'iris_orange', -12, -38, 0.5, 0.5);
  body.add([ball, iris]);
  const sprites = [ball];
  let spin = 0;
  return {
    root,
    body,
    height: 76,
    sprites,
    update(a) {
      if (a.moving) spin -= 0.16;
      ball.rotation = spin;
      const l = lunge(a.attack);
      body.x = -l * 22;
      body.y = a.moving ? -Math.abs(Math.sin(a.time * 9)) * 4 : 0;
      iris.x = -12 + Math.sin(a.time * 1.7) * 2 - l * 4;
      iris.y = -38 + Math.cos(a.time * 2.3) * 2;
      // 突進の前は目を細める
      iris.scaleY = a.attack >= 0 && a.attack < ATTACK_STRIKE ? S * 0.7 : S;
      applyFlash(sprites, a.flash);
    },
  };
}

function mireMaw(scene: Phaser.Scene): EnemyView {
  const { root, body } = base(scene, 4.2);
  const tentacles = scene.add.graphics();
  const sprite = img(scene, 'mireMaw_body', 0, 4, 0.5, 1);
  const jaw = img(scene, 'mireMaw_jaw', -24, -64, 0.5, 0);
  const eye = img(scene, 'eye_big', 0, -196, 0.5, 0.5);
  const iris = img(scene, 'iris_big', -10, -194, 0.5, 0.5);
  body.add([tentacles, jaw, sprite, eye, iris]);
  // 下あごは体の口の下に重ねる(体より前に出す)
  body.bringToTop(jaw);
  const sprites = [sprite, jaw];
  const arms = [
    { x: -110, y: -150, len: 80, dir: -2.4 },
    { x: -120, y: -80, len: 90, dir: -2.0 },
    { x: 110, y: -170, len: 70, dir: -0.6 },
    { x: 126, y: -96, len: 80, dir: -0.3 },
  ];
  return {
    root,
    body,
    height: 270,
    sprites,
    update(a) {
      const t = a.time;
      const l = lunge(a.attack);
      const windup = a.attack >= 0 && a.attack < ATTACK_STRIKE ? a.attack / ATTACK_STRIKE : 0;
      body.x = -l * 18;
      body.scaleY = 1 + Math.sin(t * 2.2) * 0.025 + windup * 0.08 - (l > 0.5 ? 0.1 * l : 0);
      body.scaleX = 1 - Math.sin(t * 2.2) * 0.02 - windup * 0.04;
      // 口の開け閉め(叩きつけの前に大きく開く)
      const open = Math.max(Math.sin(t * 3) * 0.5 + 0.5, windup) * 14 + l * 10;
      jaw.y = -64 + open;
      // 目は左を見て、時々きょろきょろ
      iris.x = -10 + Math.sin(t * 0.9) * 6;
      iris.y = -194 + Math.cos(t * 1.3) * 4;
      const blink = Math.sin(t * 0.8) > 0.992;
      eye.scaleY = blink ? S * 0.1 : S;
      iris.visible = !blink;
      // 触手
      tentacles.clear();
      for (let i = 0; i < arms.length; i++) {
        const arm = arms[i];
        const pts: Phaser.Math.Vector2[] = [];
        const raise = windup * 0.8 - l * 0.6;
        for (let k = 0; k <= 10; k++) {
          const s = k / 10;
          const wave = Math.sin(t * 3 + i * 1.7 + s * 4) * 0.5 * s;
          const ang = arm.dir - raise * (arm.x < 0 ? 1 : -1) + wave;
          pts.push(new Phaser.Math.Vector2(arm.x + Math.cos(ang) * arm.len * s, arm.y + Math.sin(ang) * arm.len * s));
        }
        tentacles.lineStyle(22, INK_HEX, 1);
        tentacles.strokePoints(pts, false);
        tentacles.lineStyle(16, 0x8a4cbc, 1);
        tentacles.strokePoints(pts, false);
        const end = pts[pts.length - 1];
        tentacles.fillStyle(INK_HEX, 1);
        tentacles.fillCircle(end.x, end.y, 11);
        tentacles.fillStyle(0xb07ae0, 1);
        tentacles.fillCircle(end.x, end.y, 8);
      }
      applyFlash(sprites, a.flash);
    },
  };
}
