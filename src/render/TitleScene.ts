import Phaser from 'phaser';
import { getLang, setLang, t } from '../i18n.ts';
import { loadSave, updateSave } from '../save.ts';
import { ART_SCALE, DEPTH, VIEW, setupCamera } from './layout.ts';
import { music } from './music.ts';
import { sfx } from './sfx.ts';
import { button, label } from './widgets.ts';

// タイトル画面。後ろでは自動プレイの戦いが流れている。

const S = 1 / ART_SCALE;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    setupCamera(this);
    if (!this.scene.isActive('battle')) this.scene.launch('battle', { mode: 'attract' });
    this.scene.bringToTop();
    music.play('title');
    this.draw();
  }

  private draw(): void {
    this.children.removeAll(true);
    const L = t();
    const shade = this.add.graphics().setDepth(DEPTH.overlay - 1);
    shade.fillGradientStyle(0x0a0812, 0x0a0812, 0x0a0812, 0x0a0812, 0.6, 0.6, 0.05, 0.05);
    shade.fillRect(0, 0, VIEW.width, 330);
    shade.fillStyle(0x0a0812, 0.35);
    shade.fillRect(0, 600, VIEW.width, 120);

    const logo = this.add.image(VIEW.width / 2, 120, 'logo').setScale(S).setDepth(DEPTH.overlay);
    this.tweens.add({ targets: logo, y: 128, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    label(this, VIEW.width / 2, 210, L.subtitle, { size: 26, color: '#e8ffd0' }).setDepth(DEPTH.overlay);

    const play = button(this, VIEW.width / 2, 300, 'btn_green', L.play, () => this.start(), { width: 260, height: 66, size: 32 });
    play.root.setDepth(DEPTH.overlay);
    this.tweens.add({ targets: play.root, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const total = Object.values(loadSave().bestStars).reduce((a, b) => a + b, 0);
    label(this, VIEW.width / 2, 362, `★ ${total} / 27`, { size: 18, color: '#ffe28a' }).setDepth(DEPTH.overlay);

    const lang = button(this, 60, 670, 'btn_stone', getLang() === 'ja' ? 'English' : '日本語', () => {
      setLang(getLang() === 'ja' ? 'en' : 'ja');
      updateSave((d) => {
        d.lang = getLang();
      });
      this.draw();
    }, { width: 100, height: 44, size: 16 });
    lang.root.setDepth(DEPTH.overlay);
    const muted = loadSave().muted;
    const sound = button(this, 1220, 670, 'btn_stone', muted ? '♪ OFF' : '♪ ON', () => {
      const data = updateSave((d) => {
        d.muted = !d.muted;
      });
      sfx.setMuted(data.muted);
      this.draw();
    }, { width: 100, height: 44, size: 16 });
    sound.root.setDepth(DEPTH.overlay);

    this.input.keyboard?.once('keydown-ENTER', () => this.start());
  }

  private start(): void {
    sfx.unlock();
    this.scene.stop('battle');
    this.scene.start('map');
  }
}
