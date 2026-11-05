import type Phaser from 'phaser';
import { t } from '../i18n.ts';
import { updateSave } from '../save.ts';
import type { SimEvent } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { DEPTH, groundY } from './layout.ts';
import { INK_HEX } from './palette.ts';
import { label } from './widgets.ts';

// 最初のステージだけに出す手引き。文字は短く、指す先を矢印で見せる。
// 出来事(兵を出した・木が生えた・実った・休憩になった)に合わせて1つずつ出す。

type Step = 'spawn' | 'fight' | 'tree' | 'harvest' | 'nextWave' | 'done';

export class Tutorial {
  private scene: Phaser.Scene;
  private world: World;
  private step: Step = 'spawn';
  private bubble: Phaser.GameObjects.Container | null = null;
  private timer = 0;
  private seenTree = false;
  private seenBreak = false;
  private flagShown = false;

  constructor(scene: Phaser.Scene, world: World, cardPos: { x: number; y: number }) {
    this.scene = scene;
    this.world = world;
    this.show(t().tut.spawn, cardPos.x, cardPos.y - 30, 'down');
  }

  onEvent(e: SimEvent): void {
    if (this.step === 'done') return;
    if (e.t === 'spawn' && e.side === 'ally' && this.step === 'spawn') {
      this.next('fight');
      this.show(t().tut.fight, 640, 150, null);
      this.timer = 5;
    }
    if (e.t === 'treeGrow' && !this.seenTree && (this.step === 'fight' || this.step === 'tree')) {
      this.seenTree = true;
      const tree = this.world.getTree(e.id);
      this.next('tree');
      this.show(t().tut.tree, e.x, (tree ? groundY(tree.row) : 520) - 120, 'down');
      this.timer = 6;
    }
    if (e.t === 'harvest' && this.step === 'harvest') {
      this.next('nextWave');
      this.hide();
    }
    if (e.t === 'waveClear' && !this.seenBreak && this.step !== 'spawn') {
      this.seenBreak = true;
      if (this.step === 'fight' || this.step === 'nextWave') {
        this.show(t().tut.nextWave, 776, 560, 'down');
        this.timer = 6;
      }
    }
    if (e.t === 'victory' || e.t === 'defeat') this.finish();
  }

  update(dt: number): void {
    if (this.step === 'done') return;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.hide();
        // 戦い方を伝えた後は、旗で兵の位置を決められることを教える
        if (this.step === 'fight' && !this.flagShown) {
          this.flagShown = true;
          this.show(t().flagHint, this.world.rallyX, 350, 'down');
          this.timer = 6;
          return;
        }
      }
    }
    // 木が実ったら、摘み方を教える
    if ((this.step === 'tree' || this.step === 'fight' || this.step === 'nextWave') && this.timer <= 0 && this.step !== 'nextWave') {
      const ripe = this.world.harvestable()[0];
      if (ripe && this.seenTree) {
        this.next('harvest');
        this.show(t().tut.harvest, ripe.x, groundY(ripe.row) - 130, 'down');
      }
    }
  }

  private next(step: Step): void {
    this.step = step;
  }

  private finish(): void {
    this.step = 'done';
    this.hide();
    updateSave((d) => {
      d.tutorialDone = true;
    });
  }

  private hide(): void {
    if (!this.bubble) return;
    const b = this.bubble;
    this.bubble = null;
    this.scene.tweens.add({ targets: b, alpha: 0, duration: 200, onComplete: () => b.destroy() });
  }

  private show(text: string, x: number, y: number, arrow: 'down' | null): void {
    this.hide();
    const root = this.scene.add.container(x, y).setDepth(DEPTH.banner + 5);
    const txt = label(this.scene, 0, 0, text, { size: 20, color: '#1c1726', stroke: 0 });
    txt.setStroke('#ffffff', 0);
    const w = Math.max(160, txt.width + 40);
    const h = txt.height + 26;
    const g = this.scene.add.graphics();
    g.fillStyle(0xfff6d8, 1);
    g.lineStyle(4, INK_HEX, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    if (arrow === 'down') {
      g.fillStyle(0xfff6d8, 1);
      g.fillTriangle(-12, h / 2 - 2, 12, h / 2 - 2, 0, h / 2 + 16);
      g.lineStyle(4, INK_HEX, 1);
      g.lineBetween(-12, h / 2, 0, h / 2 + 16);
      g.lineBetween(12, h / 2, 0, h / 2 + 16);
    }
    root.add([g, txt]);
    root.setScale(0.6).setAlpha(0);
    // 画面の端からはみ出さないように寄せる
    root.x = Math.max(w / 2 + 10, Math.min(1280 - w / 2 - 10, x));
    this.scene.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: root, y: y - 6, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 220 });
    this.bubble = root;
  }
}
