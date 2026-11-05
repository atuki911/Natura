import Phaser from 'phaser';
import { ART_SCALE, DEPTH } from './layout.ts';
import { FONT } from './palette.ts';

// 手応えを作るエフェクト。爆発・火花・ダメージ数字・コイン・画面揺れ。

const S = 1 / ART_SCALE;

export class Fx {
  private scene: Phaser.Scene;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private goo: Phaser.GameObjects.Particles.ParticleEmitter;
  private magic: Phaser.GameObjects.Particles.ParticleEmitter;
  private fire: Phaser.GameObjects.Particles.ParticleEmitter;
  private heal: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private numbers: Phaser.GameObjects.Text[] = [];
  /** 画面揺れの残り(論理ピクセル)。 */
  private shakeAmount = 0;
  /** 当たった瞬間に時間を止める残り秒数。 */
  hitstop = 0;

  private baseScroll: [number, number];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.baseScroll = [scene.cameras.main.scrollX, scene.cameras.main.scrollY];
    const add = (key: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = DEPTH.effects) =>
      scene.add.particles(0, 0, key, { emitting: false, ...config }).setDepth(depth);
    this.sparks = add('spark', {
      speed: { min: 80, max: 240 },
      angle: { min: 0, max: 360 },
      scale: { start: S * 1.1, end: 0 },
      lifespan: { min: 180, max: 340 },
      rotate: { min: 0, max: 360 },
    });
    this.dust = add('dust', {
      speed: { min: 20, max: 60 },
      angle: { min: 190, max: 350 },
      scale: { start: S * 0.6, end: S * 1.3 },
      alpha: { start: 0.7, end: 0 },
      lifespan: { min: 350, max: 600 },
      gravityY: -30,
    }, DEPTH.actors - 1);
    this.goo = add('goo', {
      speed: { min: 90, max: 260 },
      angle: { min: 200, max: 340 },
      scale: { start: S * 1.4, end: S * 0.4 },
      lifespan: { min: 400, max: 700 },
      gravityY: 700,
    });
    this.magic = add('dot', {
      speed: { min: 10, max: 60 },
      scale: { start: S * 1.2, end: 0 },
      lifespan: { min: 200, max: 420 },
      tint: [0x9fe8ff, 0x5fd3ff, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.fire = add('dot', {
      speed: { min: 20, max: 90 },
      scale: { start: S * 2.2, end: 0 },
      lifespan: { min: 200, max: 500 },
      tint: [0xffe080, 0xff9a30, 0xff5020],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.heal = add('cross', {
      speedY: { min: -70, max: -30 },
      speedX: { min: -14, max: 14 },
      scale: { start: S * 1.1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 600, max: 1000 },
    });
    this.embers = add('dot', {
      speedY: { min: -60, max: -20 },
      speedX: { min: -12, max: 12 },
      scale: { start: S * 1.5, end: 0 },
      lifespan: { min: 800, max: 1600 },
      tint: [0xe07bff, 0xb04de0, 0xffb8ff],
      blendMode: Phaser.BlendModes.ADD,
    }, DEPTH.buildings + 1);
  }

  update(dt: number): void {
    const cam = this.scene.cameras.main;
    const [bx, by] = this.baseScroll;
    if (this.shakeAmount > 0.05) {
      const a = this.shakeAmount;
      cam.setScroll(bx + (Math.random() * 2 - 1) * a, by + (Math.random() * 2 - 1) * a);
      this.shakeAmount *= Math.pow(0.0015, dt);
    } else if (cam.scrollX !== bx || cam.scrollY !== by) {
      cam.setScroll(bx, by);
      this.shakeAmount = 0;
    }
    if (this.hitstop > 0) this.hitstop -= dt;
  }

  shake(amount: number): void {
    this.shakeAmount = Math.min(14, Math.max(this.shakeAmount, amount));
  }

  hitSpark(x: number, y: number, count = 4): void {
    this.sparks.explode(count, x, y);
  }

  dustPuff(x: number, y: number, count = 2): void {
    this.dust.explode(count, x, y);
  }

  gooSplash(x: number, y: number, count = 8): void {
    this.goo.explode(count, x, y);
  }

  magicBurst(x: number, y: number, count = 10): void {
    this.magic.explode(count, x, y);
  }

  magicTrail(x: number, y: number): void {
    this.magic.emitParticleAt(x, y, 1);
  }

  fireTrail(x: number, y: number, count = 2): void {
    this.fire.emitParticleAt(x, y, count);
  }

  healAt(x: number, y: number, count = 3): void {
    this.heal.explode(count, x, y);
  }

  ember(x: number, y: number): void {
    this.embers.emitParticleAt(x, y, 1);
  }

  /** 漫画のような爆発。radius は効果範囲(論理ピクセル)。 */
  explosion(x: number, y: number, radius: number, big = false): void {
    const scene = this.scene;
    const flash = scene.add.image(x, y - 10, 'flash').setDepth(DEPTH.effects).setBlendMode(Phaser.BlendModes.ADD);
    flash.setScale((radius / 64) * 1.6 * S * 2);
    scene.tweens.add({ targets: flash, alpha: 0, scale: flash.scale * 1.4, duration: 260, onComplete: () => flash.destroy() });
    const burst = scene.add.image(x, y - 14, 'burst').setDepth(DEPTH.effects + 2).setScale(0.1).setRotation(Math.random() * 6);
    scene.tweens.add({
      targets: burst,
      scale: (radius / 48) * S * 2 * 0.9,
      duration: 110,
      ease: 'Back.Out',
      onComplete: () => scene.tweens.add({ targets: burst, alpha: 0, scale: burst.scale * 0.6, duration: 160, onComplete: () => burst.destroy() }),
    });
    const puffs = big ? 14 : 8;
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * Math.PI * 2 + Math.random() * 0.4;
      const d = radius * (0.25 + Math.random() * 0.45);
      const puff = scene.add
        .image(x, y - 10, 'puff')
        .setDepth(DEPTH.effects + 1)
        .setScale(S * 0.4);
      scene.tweens.add({
        targets: puff,
        x: x + Math.cos(a) * d,
        y: y - 10 + Math.sin(a) * d * 0.45 - radius * 0.25,
        scale: S * (big ? 2.4 : 1.5) * (0.7 + Math.random() * 0.6),
        duration: 380 + Math.random() * 200,
        ease: 'Cubic.Out',
      });
      scene.tweens.add({ targets: puff, alpha: 0, delay: 260, duration: 420, onComplete: () => puff.destroy() });
    }
    const ring = scene.add.image(x, y, 'ring').setDepth(DEPTH.effects).setScale(S * 0.2, S * 0.08).setAlpha(0.8);
    scene.tweens.add({
      targets: ring,
      scaleX: (radius / 58) * S * 2,
      scaleY: (radius / 58) * S * 0.7,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
    this.sparks.explode(big ? 22 : 10, x, y - 10);
    const scorch = scene.add.image(x, y + 4, 'scorch').setDepth(DEPTH.scorch).setScale((radius / 80) * S * 2, S * 1.2);
    scene.tweens.add({ targets: scorch, alpha: 0, delay: 2200, duration: 1500, onComplete: () => scorch.destroy() });
    this.shake(big ? 12 : Math.min(8, radius / 14));
  }

  /** ダメージ数字。会心は大きく黄色く、魔法は水色。 */
  damageNumber(x: number, y: number, amount: number, crit: boolean, magic: boolean): void {
    const text = this.takeText();
    const color = crit ? '#ffd23a' : magic ? '#9fe8ff' : '#ffffff';
    text.setText(crit ? `${amount}` : `${amount}`);
    text.setStyle({
      fontFamily: FONT,
      fontSize: crit ? '30px' : '20px',
      color,
      stroke: '#1c1726',
      strokeThickness: crit ? 7 : 5,
    });
    text.setPosition(x + (Math.random() * 16 - 8), y);
    text.setAlpha(1).setScale(crit ? 1.8 : 1.3).setVisible(true).setAngle(crit ? -8 : 0);
    this.scene.tweens.add({ targets: text, scale: 1, duration: 140, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: text,
      y: y - (crit ? 48 : 34),
      duration: 700,
      ease: 'Cubic.Out',
    });
    this.scene.tweens.add({ targets: text, alpha: 0, delay: crit ? 520 : 380, duration: 280, onComplete: () => text.setVisible(false) });
    if (crit) {
      const label = this.takeText();
      label.setText('CRIT!');
      label.setStyle({ fontFamily: FONT, fontSize: '18px', color: '#ff8a20', stroke: '#1c1726', strokeThickness: 5 });
      label.setPosition(x + 18, y - 16).setAlpha(1).setScale(0.5).setVisible(true).setAngle(10);
      this.scene.tweens.add({ targets: label, scale: 1, duration: 160, ease: 'Back.Out' });
      this.scene.tweens.add({ targets: label, y: y - 56, alpha: 0, delay: 350, duration: 450, onComplete: () => label.setVisible(false) });
    }
  }

  /** 画面上の文字(ボーナス・足りない等)。 */
  floatText(x: number, y: number, message: string, color: string, size = 20): void {
    const text = this.takeText();
    text.setText(message);
    text.setStyle({ fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1c1726', strokeThickness: 5 });
    text.setPosition(x, y).setAlpha(1).setScale(0.6).setVisible(true).setAngle(0);
    this.scene.tweens.add({ targets: text, scale: 1, duration: 160, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: text, y: y - 30, alpha: 0, delay: 600, duration: 500, onComplete: () => text.setVisible(false) });
  }

  /** 倒した敵からコインが飛び、ゴールドの表示に吸い込まれる。 */
  coinFly(x: number, y: number, toX: number, toY: number, onArrive: () => void): void {
    const scene = this.scene;
    const coin = scene.add.image(x, y, 'coin').setDepth(DEPTH.hud + 5).setScale(S * 1.1);
    const midX = x + (Math.random() * 60 - 30);
    const midY = y - 60 - Math.random() * 40;
    const path = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x, y),
      new Phaser.Math.Vector2(midX, midY),
      new Phaser.Math.Vector2(toX, toY),
    );
    const state = { t: 0 };
    scene.tweens.add({
      targets: state,
      t: 1,
      duration: 650,
      ease: 'Cubic.In',
      onUpdate: () => {
        const p = path.getPoint(state.t);
        coin.setPosition(p.x, p.y);
        coin.rotation += 0.2;
      },
      onComplete: () => {
        coin.destroy();
        onArrive();
      },
    });
  }

  private takeText(): Phaser.GameObjects.Text {
    const free = this.numbers.find((n) => !n.visible);
    if (free) {
      this.scene.tweens.killTweensOf(free);
      return free;
    }
    const text = this.scene.add.text(0, 0, '', { fontFamily: FONT }).setOrigin(0.5).setDepth(DEPTH.numbers).setResolution(2);
    this.numbers.push(text);
    return text;
  }
}
