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
    case 'rotMoth':
      return rotMoth(scene);
    case 'burrower':
      return burrower(scene);
    case 'sporeMother':
      return sporeMother(scene);
    case 'blightHeart':
      return blightHeart(scene);
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

/** 攻撃の構え(0〜1)。当たる瞬間まで上がり、その後は 0。 */
function windupOf(attack: number): number {
  return attack >= 0 && attack < ATTACK_STRIKE ? attack / ATTACK_STRIKE : 0;
}

/** 前の update からの経過時間(なめらかに追いかける動きに使う)。 */
function stepper(): (time: number) => number {
  let last = -1;
  return (time) => {
    const dt = last < 0 ? 0 : Math.max(0, Math.min(0.1, time - last));
    last = time;
    return dt;
  };
}

function rotMoth(scene: Phaser.Scene): EnemyView {
  const root = scene.add.container(0, 0);
  const shadow = img(scene, 'shadow', 0, 0).setScale(S * 0.5, S * 0.6).setAlpha(0.7);
  const body = scene.add.container(0, -FLY_HEIGHT);
  // 翅の付け根は胸の上(-5, -8)
  const rootX = -5;
  const rootY = -8;
  const backFore = img(scene, 'rotMoth_wing', rootX + 3, rootY - 2, 5 / 40, 27 / 30).setTint(0x9a8ab8);
  const backHind = img(scene, 'rotMoth_wing_hind', rootX + 6, rootY, 4 / 30, 21 / 24).setTint(0x9a8ab8);
  const sprite = img(scene, 'rotMoth_body', 0, 0);
  const hind = img(scene, 'rotMoth_wing_hind', rootX + 3, rootY + 2, 4 / 30, 21 / 24);
  const fore = img(scene, 'rotMoth_wing', rootX, rootY, 5 / 40, 27 / 30);
  // 後ろ翅は前翅より後ろへ寝かせる
  hind.rotation = backHind.rotation = 0.55;
  body.add([backHind, backFore, sprite, hind, fore]);
  root.add([shadow, body]);
  const sprites = [sprite, hind, fore];
  return {
    root,
    body,
    height: FLY_HEIGHT + 26,
    sprites,
    update(a) {
      const l = lunge(a.attack);
      const w = windupOf(a.attack);
      const ph = a.time * (a.attack >= 0 ? 30 : 24);
      const flap = (k: number) => S * (0.3 + 0.7 * Math.cos(ph - k));
      fore.scaleY = flap(0);
      backFore.scaleY = flap(0.25) * 0.9;
      hind.scaleY = flap(0.6);
      backHind.scaleY = flap(0.85) * 0.9;
      // ふわふわ浮いて、羽ばたきで小さく持ち上がる。攻撃では下・前へ潜ってかじる。
      const hover = Math.sin(a.time * 2.8) * 6 + Math.sin(ph) * 1.5;
      body.y = -FLY_HEIGHT + hover - w * 4 + l * 18;
      body.x = -l * 12 + w * 3;
      body.rotation = Math.sin(a.time * 2.1) * 0.07 + w * 0.15 - l * 0.4;
      shadow.scaleX = S * (0.5 + Math.sin(a.time * 2.8) * 0.04 + l * 0.12);
      shadow.alpha = 0.6 + l * 0.25;
      applyFlash(sprites, a.flash);
    },
  };
}

function burrower(scene: Phaser.Scene): EnemyView {
  const { root, body } = base(scene, 1.05);
  const mound = img(scene, 'burrower_mound', 0, 1, 0.5, 1);
  const segs = [0, 1, 2].map(() => img(scene, 'burrower_segment', 0, -16));
  const head = img(scene, 'burrower_head', 0, -18, 23 / 38, 18 / 34);
  const lip = img(scene, 'burrower_mound_lip', 0, 1, 0.5, 1);
  const clods = [0, 1, 2, 3].map(() => img(scene, 'burrower_clod', 0, 0));
  body.add([mound, ...segs.slice().reverse(), head, lip, ...clods]);
  const sprites = [head, ...segs];
  // 穴の中心(盛り土の中の位置から)
  const holeY = 1 - 28 + 11;
  const step = stepper();
  let rear = 0;
  return {
    root,
    body,
    height: 52,
    sprites,
    update(a) {
      const dt = step(a.time);
      const t = a.time;
      const l = lunge(a.attack);
      // 攻撃の間は地面から伸び上がり、終わるとゆっくり潜る
      rear += ((a.attack >= 0 ? 1 : 0) - rear) * (1 - Math.exp(-dt * (a.attack >= 0 ? 14 : 5)));
      // 進む間は頭が穴から出たり入ったりする
      const bob = a.moving ? Math.max(0, Math.sin(t * 6)) : 0.55 + Math.sin(t * 1.7) * 0.15;
      const peek = holeY - 2 - bob * 12;
      const hx = -l * 16 - rear * 6;
      const hy = peek * (1 - rear) + (holeY - 48 + l * 16) * rear;
      head.x = hx;
      head.y = hy;
      head.rotation = a.moving ? Math.sin(t * 6) * 0.12 : Math.sin(t * 1.3) * 0.08 - rear * 0.15 - l * 0.35;
      // 胴の節は穴と頭の間に並ぶ(反り返るように少し右へふくらむ)
      for (let i = 0; i < segs.length; i++) {
        const f = (i + 1) / (segs.length + 1);
        const s = segs[i];
        s.x = hx * f + Math.sin(f * Math.PI) * 7 * rear + 2;
        s.y = holeY + 4 + (hy + 8 - (holeY + 4)) * f;
        s.rotation = (1 - f) * 0.1 * rear;
        s.visible = rear > 0.05;
      }
      // 土くれが後ろへ飛ぶ
      for (let i = 0; i < clods.length; i++) {
        const c = clods[i];
        const p = (t * 1.9 + i / clods.length) % 1;
        c.visible = a.moving || rear > 0.3;
        c.x = 6 + p * (22 + i * 5);
        c.y = holeY - 2 - 62 * p + 66 * p * p;
        c.rotation = p * 7 + i;
        c.alpha = p < 0.85 ? 1 : (1 - p) / 0.15;
        c.setScale(S * (0.7 + (i % 2) * 0.35));
      }
      const wob = a.moving ? Math.sin(t * 12) * 0.04 : 0;
      mound.scaleX = lip.scaleX = S * (1 + wob + rear * 0.08);
      mound.scaleY = lip.scaleY = S * (1 - wob);
      applyFlash(sprites, a.flash);
    },
  };
}

function sporeMother(scene: Phaser.Scene): EnemyView {
  const { root, body } = base(scene, 3.8);
  const legs = [-62, -22, 24, 64].map((x) => img(scene, 'sporeMother_leg', x, -40, 0.5, 4 / 46));
  const sprite = img(scene, 'sporeMother_body', 0, -10, 0.5, 1);
  const jaw = img(scene, 'sporeMother_jaw', -34, -60, 0.5, 0);
  const sacSpots: [number, number, number][] = [
    [66, -116, 1.05],
    [92, -70, 0.85],
    [50, -38, 0.7],
    [-90, -126, 0.6],
  ];
  const sacs = sacSpots.map(([x, y, s]) => img(scene, 'sporeMother_sac', x, y).setScale(S * s));
  const eyes = [img(scene, 'eye_big', -58, -120).setScale(S * 0.5), img(scene, 'eye_big', -18, -128).setScale(S * 0.56)];
  const irises = [img(scene, 'iris_big', -62, -119).setScale(S * 0.5), img(scene, 'iris_big', -22, -127).setScale(S * 0.56)];
  const cap = img(scene, 'sporeMother_cap', 6, -142, 0.5, 112 / 122);
  body.add([...legs, sprite, jaw, ...sacs, ...eyes, ...irises, cap]);
  // 胞子の雲(体の伸び縮みに引きずられないよう root に置く)
  const puffs = Array.from({ length: 10 }, () => img(scene, 'spore_puff', 0, 0));
  root.add(puffs);
  const sprites = [sprite, jaw, cap, ...legs, ...sacs];
  return {
    root,
    body,
    height: 262,
    sprites,
    update(a) {
      const t = a.time;
      const l = lunge(a.attack);
      const w = windupOf(a.attack);
      const breath = Math.sin(t * 1.6);
      // 胴: ゆっくり息をする。歩く時は左右に揺れる。
      body.x = -l * 10;
      body.scaleY = 1 + breath * 0.02 + w * 0.05 - l * 0.05;
      body.scaleX = 1 - breath * 0.015 - w * 0.02 + l * 0.03;
      body.rotation = a.moving ? Math.sin(t * 2.6) * 0.025 : 0;
      for (let i = 0; i < legs.length; i++) {
        legs[i].rotation = a.moving ? Math.sin(t * 5.2 + i * Math.PI * 0.5) * 0.22 : 0;
        legs[i].y = -40 - (a.moving ? Math.max(0, Math.sin(t * 5.2 + i * Math.PI * 0.5)) * 4 : 0);
      }
      // 傘: 息に合わせてふくらむ。吐く前は後ろへ反り、吐く瞬間に前へ。
      cap.scaleY = S * (1 + breath * 0.045);
      cap.scaleX = S * (1 - breath * 0.02);
      cap.rotation = w * 0.24 - l * 0.12 + Math.sin(t * 1.1) * 0.02;
      cap.x = 6 + w * 8 - l * 6;
      cap.y = -142 - w * 6 + breath * 1.5;
      // 口(下あご)
      const open = Math.max(w, l) * 24 + (Math.sin(t * 1.6) * 0.5 + 0.5) * 3;
      jaw.y = -60 + open;
      jaw.rotation = -Math.max(w, l) * 0.08;
      // 胞子袋が順に脈打つ
      for (let i = 0; i < sacs.length; i++) {
        const k = Math.pow(Math.max(0, Math.sin(t * 3 - i * 1.3)), 3);
        const s = sacSpots[i][2] * (1 + k * 0.16 + w * 0.12);
        sacs[i].setScale(S * s * (1 + k * 0.05), S * s);
      }
      // 目は左を見て、時々まばたき
      const blink = Math.sin(t * 0.7 + 1) > 0.993;
      for (let i = 0; i < eyes.length; i++) {
        const s = i === 0 ? 0.5 : 0.56;
        eyes[i].scaleY = blink ? S * s * 0.1 : S * s;
        irises[i].visible = !blink;
        irises[i].x = (i === 0 ? -62 : -22) + Math.sin(t * 0.8) * 3 - w * 2;
        irises[i].y = (i === 0 ? -119 : -127) + Math.cos(t * 1.1) * 2 + w * 3;
      }
      // 胞子の雲: 数秒ごとに傘から吹き出して、ゆらゆら昇って消える
      const cyc = t % 4.2;
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        const u = (cyc - i * 0.07) / 2.6;
        p.visible = u > 0 && u < 1;
        if (!p.visible) continue;
        const x0 = -120 + ((i * 67) % 240);
        p.x = x0 + Math.sin(u * 4 + i) * 10 + u * 16 + body.x;
        p.y = -236 - (i % 3) * 14 - u * 80;
        p.alpha = Math.sin(u * Math.PI) * 0.85;
        p.setScale(S * (0.8 + u * 1.3));
      }
      applyFlash(sprites, a.flash);
    },
  };
}

function blightHeart(scene: Phaser.Scene): EnemyView {
  const { root, body } = base(scene, 4.6);
  const vessels = scene.add.graphics();
  const sprite = img(scene, 'blightHeart_body', 0, -8, 0.5, 1);
  const veins = img(scene, 'blightHeart_veins', 0, -8, 0.5, 1);
  // 目のくぼみの中心: 体のテクスチャの (136, 132) → (-4, -8 - 250 + 132)
  const eyeX = -4;
  const eyeY = -126;
  const eye = img(scene, 'eye_big', eyeX, eyeY).setScale(S * 1.5);
  const iris = img(scene, 'blightHeart_iris', eyeX - 12, eyeY);
  const crown = img(scene, 'blightHeart_crown', -6, -216, 0.5, 0.92);
  body.add([vessels, sprite, veins, eye, iris, crown]);
  const sprites = [sprite, eye, crown];
  const arms = [
    { x: -104, y: -200, len: 100, dir: -2.5, w: 1 },
    { x: -122, y: -110, len: 96, dir: -2.95, w: 1 },
    { x: 104, y: -206, len: 92, dir: -0.55, w: 1 },
    { x: 124, y: -120, len: 100, dir: -0.15, w: 1 },
    // 地面に広がる根の血管(足の代わり)
    { x: -86, y: -40, len: 64, dir: 2.75, w: 0.25 },
    { x: 90, y: -40, len: 60, dir: 0.4, w: 0.25 },
  ];
  return {
    root,
    body,
    height: 300,
    sprites,
    update(a) {
      const t = a.time;
      const l = lunge(a.attack);
      const w = windupOf(a.attack);
      // 鼓動: 1.2 秒ごとに「どくん、どくん」と二度ふくらむ
      const p = t % 1.2;
      const beat = Math.exp(-(((p - 0.06) / 0.06) ** 2)) + 0.7 * Math.exp(-(((p - 0.3) / 0.07) ** 2));
      // 叩きつけ: 伸び上がって後ろへ反り、一気に押しつぶす
      body.x = -l * 22;
      body.y = -w * 24;
      body.rotation = w * 0.08 - l * 0.07;
      body.scaleX = 1 + beat * 0.055 - w * 0.04 + l * 0.1;
      body.scaleY = 1 + beat * 0.06 + w * 0.08 - l * 0.14;
      veins.alpha = 0.3 + Math.min(1, beat) * 0.7;
      // 大きな目は左(兵の来る方)をにらみ、ゆっくり見回す
      const lookX = -12 + Math.sin(t * 0.7) * 10 - w * 4;
      const lookY = Math.cos(t * 1.1) * 8 + w * 6 + l * 6;
      iris.x = eyeX + lookX;
      iris.y = eyeY + lookY;
      iris.scaleX = S * (1 - w * 0.35 + beat * 0.05);
      iris.scaleY = S * (1 + beat * 0.05);
      const blink = Math.sin(t * 0.6 + 2) > 0.994;
      eye.scaleY = blink ? S * 0.15 : S * 1.5;
      iris.visible = !blink;
      crown.rotation = Math.sin(t * 0.9) * 0.02 + w * 0.05;
      // 血管の触手がしなる
      vessels.clear();
      for (let i = 0; i < arms.length; i++) {
        const arm = arms[i];
        const pts: Phaser.Math.Vector2[] = [];
        const raise = (w * 0.9 - l * 0.8) * arm.w;
        for (let k = 0; k <= 12; k++) {
          const s = k / 12;
          const wave = Math.sin(t * 4.2 + i * 1.7 + s * 5) * 0.55 * s * arm.w + Math.sin(t * 1.3 + i) * 0.08 * (1 - arm.w);
          const ang = arm.dir - raise * (arm.x < 0 ? 1 : -1) + wave;
          const len = arm.len * (1 + beat * 0.04);
          pts.push(new Phaser.Math.Vector2(arm.x + Math.cos(ang) * len * s, arm.y + Math.sin(ang) * len * s));
        }
        const thick = arm.w < 1 ? 0.8 : 1;
        vessels.lineStyle(24 * thick, INK_HEX, 1);
        vessels.strokePoints(pts, false);
        vessels.lineStyle(17 * thick, 0x7c2050, 1);
        vessels.strokePoints(pts, false);
        vessels.lineStyle(4 * thick, 0xe07bff, 0.35 + Math.min(1, beat) * 0.6);
        vessels.strokePoints(pts.slice(1), false);
        const end = pts[pts.length - 1];
        vessels.fillStyle(INK_HEX, 1);
        vessels.fillCircle(end.x, end.y, 12 * thick);
        vessels.fillStyle(0xa03a6c, 1);
        vessels.fillCircle(end.x, end.y, 9 * thick);
        vessels.fillStyle(0x24061a, 1);
        vessels.fillCircle(end.x, end.y, 4.5 * thick);
      }
      applyFlash(sprites, a.flash);
    },
  };
}
