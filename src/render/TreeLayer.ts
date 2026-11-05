import Phaser from 'phaser';
import { t } from '../i18n.ts';
import type { SimEvent, Tree, TreeId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { TREE_SIZE } from './art/trees.ts';
import type { Fx } from './fx.ts';
import { ART_SCALE, DEPTH, groundY } from './layout.ts';
import { sfx } from './sfx.ts';

// 倒れた兵から生える木の見た目と、木への操作(なでて摘む・長押しで引き抜く)。

const S = 1 / ART_SCALE;
const HOLD_TO_UPROOT = 0.7;
/** 木の表示の大きさ(兵の大きさに合わせる)。 */
const TREE_SCALE = 1.25;

interface TreeView {
  id: number;
  kind: TreeId;
  root: Phaser.GameObjects.Container;
  sprout: Phaser.GameObjects.Image;
  body: Phaser.GameObjects.Image;
  fruits: Phaser.GameObjects.Image[];
  purify: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  grown: boolean;
  flash: number;
  bounce: number;
  phase: number;
  lastHarvestTry: number;
  /** 最後に叩かれてからの秒数。 */
  sinceHit: number;
}

export interface TreeLayerTargets {
  gold: () => { x: number; y: number };
  mana: () => { x: number; y: number };
  onGold: () => void;
}

export class TreeLayer {
  private scene: Phaser.Scene;
  private world: World;
  private fx: Fx;
  private targets: TreeLayerTargets;
  private views = new Map<number, TreeView>();
  private holdTree: number | null = null;
  private holdTime = 0;
  private ring: Phaser.GameObjects.Graphics;
  private clock = 0;
  /** 操作できるか(タイトル画面の自動プレイでは false)。 */
  interactive = true;

  constructor(scene: Phaser.Scene, world: World, fx: Fx, targets: TreeLayerTargets) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.targets = targets;
    this.ring = scene.add.graphics().setDepth(DEPTH.effects + 10);
  }

  get count(): number {
    return this.views.size;
  }

  /** 木の出来事を処理したら true。 */
  handleEvent(e: SimEvent): boolean {
    switch (e.t) {
      case 'treeSeed': {
        const tree = this.world.getTree(e.id);
        if (tree) this.create(tree);
        return true;
      }
      case 'treeGrow': {
        const v = this.views.get(e.id);
        if (v) this.grow(v);
        return true;
      }
      case 'treeReinforce': {
        const v = this.views.get(e.id);
        if (v) {
          this.fx.healAt(v.root.x, v.root.y - 30, 4);
          v.bounce = 1;
        }
        return true;
      }
      case 'treeHit': {
        const v = this.views.get(e.id);
        if (v) {
          v.flash = 1;
          v.sinceHit = 0;
        }
        return true;
      }
      case 'treeDie':
        this.remove(e.id, e.reason);
        return true;
      case 'thornHit': {
        const enemy = this.world.getFighter(e.id);
        if (enemy) this.fx.hitSpark(enemy.x, groundY(enemy.row) - 20, 2);
        const v = this.views.get(e.treeId);
        if (v) v.bounce = Math.max(v.bounce, 0.4);
        return true;
      }
      case 'treeShot': {
        const v = this.views.get(e.treeId);
        if (v) v.bounce = 1;
        return true;
      }
      case 'podBurst':
        this.fx.explosion(e.x, this.views.get(e.treeId)?.root.y ?? groundY(0.5), e.radius);
        sfx.play('explode');
        return true;
      case 'harvest': {
        const v = this.views.get(e.treeId);
        const x = v?.root.x ?? 400;
        const y = (v?.root.y ?? 500) - 50;
        const gold = Math.round(e.gold);
        const mana = Math.round(e.mana);
        const parts = [gold > 0 ? `+${gold}G` : '', mana > 0 ? `+${mana}${t().manaShort}` : ''].filter(Boolean);
        this.fx.floatText(x, y - 10, parts.join(' '), mana > 0 && gold === 0 ? '#9fe8ff' : '#ffe28a', 17);
        if (gold > 0) {
          const target = this.targets.gold();
          this.fx.coinFly(x, y, target.x, target.y, () => this.targets.onGold());
        }
        if (mana > 0) this.fx.magicBurst(x, y, 8);
        if (v) {
          v.bounce = 1;
          for (const f of v.fruits) f.setVisible(false);
        }
        sfx.play('coin', 0.7);
        return true;
      }
      case 'uproot': {
        const v = this.views.get(e.treeId);
        if (v) this.fx.floatText(v.root.x, v.root.y - 70, `+${Math.round(e.gold)}G`, '#ffe28a', 18);
        sfx.play('squish', 0.6);
        return true;
      }
      default:
        return false;
    }
  }

  private create(tree: Tree): void {
    const y = groundY(tree.row);
    const purify = this.scene.add.image(tree.x, y + 4, 'purify').setScale(S * 0.2, S * 0.6).setDepth(DEPTH.scorch + 2).setAlpha(0);
    const root = this.scene.add.container(tree.x, y).setDepth(DEPTH.actors + y - 24).setScale(TREE_SCALE);
    const sprout = this.scene.add.image(0, 2, 'sprout').setOrigin(0.5, 1).setScale(0);
    const body = this.scene.add.image(0, 2, `tree_${tree.def.id}`).setOrigin(0.5, 1).setScale(S).setVisible(false);
    const fruits: Phaser.GameObjects.Image[] = [];
    const size = TREE_SIZE[tree.def.id];
    const fruitKey = tree.def.id === 'manaFlower' ? 'nectar' : tree.def.id === 'thornBush' ? 'fruit_red' : 'fruit_gold';
    if (tree.def.nectar) {
      const spots: [number, number][] =
        tree.def.id === 'watchTree'
          ? [
              [-14, -84],
              [12, -92],
              [0, -106],
            ]
          : tree.def.id === 'manaFlower'
            ? [
                [-14, -66],
                [14, -66],
                [0, -82],
              ]
            : [
                [-26, -34],
                [24, -36],
                [0, -50],
              ];
      for (const [fx, fy] of spots) {
        const f = this.scene.add.image(fx * (size.w / size.w), fy, fruitKey).setScale(S).setVisible(false);
        fruits.push(f);
      }
    }
    const bar = this.scene.add.graphics();
    root.add([sprout, body, ...fruits, bar]);
    this.scene.tweens.add({ targets: sprout, scale: S, duration: 350, ease: 'Back.Out' });
    this.fx.dustPuff(tree.x, y, 2);
    this.views.set(tree.id, {
      id: tree.id,
      kind: tree.def.id,
      root,
      sprout,
      body,
      fruits,
      purify,
      bar,
      grown: false,
      flash: 0,
      bounce: 0,
      phase: Math.random() * 6,
      lastHarvestTry: -1,
      sinceHit: 99,
    });
  }

  private grow(v: TreeView): void {
    v.grown = true;
    v.sprout.setVisible(false);
    v.body.setVisible(true).setScale(S * 0.3, S * 0.1);
    this.scene.tweens.add({ targets: v.body, scaleX: S, scaleY: S, duration: 520, ease: 'Elastic.Out' });
    this.scene.tweens.add({ targets: v.purify, alpha: 0.85, scaleX: S, scaleY: S, duration: 1600, ease: 'Cubic.Out' });
    this.fx.healAt(v.root.x, v.root.y - 30, 6);
    this.fx.dustPuff(v.root.x, v.root.y, 3);
    sfx.play('heal', 0.35);
  }

  private remove(id: number, reason: string): void {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    if (this.holdTree === id) this.holdTree = null;
    v.bar.clear();
    const scene = this.scene;
    if (reason === 'burst') {
      v.root.destroy();
    } else if (reason === 'uprooted') {
      scene.tweens.add({ targets: v.root, y: v.root.y - 40, alpha: 0, angle: 20, duration: 380, ease: 'Cubic.Out', onComplete: () => v.root.destroy() });
      this.fx.dustPuff(v.root.x, v.root.y, 5);
    } else {
      // 枯れる・壊される
      v.body.setTint(0x8a6a4a);
      scene.tweens.add({ targets: v.root, scaleY: 0.2, alpha: 0, duration: 600, ease: 'Cubic.In', onComplete: () => v.root.destroy() });
      if (reason === 'destroyed') this.fx.hitSpark(v.root.x, v.root.y - 30, 6);
    }
    scene.tweens.add({ targets: v.purify, alpha: 0, duration: 2500, onComplete: () => v.purify.destroy() });
  }

  update(dt: number): void {
    this.clock += dt;
    for (const v of this.views.values()) {
      const tree = this.world.getTree(v.id);
      if (!tree || !tree.alive) continue;
      v.phase += dt;
      v.flash = Math.max(0, v.flash - dt * 6);
      v.sinceHit += dt;
      v.bounce = Math.max(0, v.bounce - dt * 4);
      const sway = Math.sin(v.phase * 1.6) * 0.03;
      v.body.rotation = sway;
      v.body.scaleY = v.grown && !this.scene.tweens.isTweening(v.body) ? S * (1 - v.bounce * 0.08) : v.body.scaleY;
      if (v.flash > 0.35) v.body.setTintFill(0xffffff);
      else if (v.grown) v.body.clearTint();
      // 実と蜜
      const nectar = tree.def.nectar;
      if (nectar && v.grown) {
        const shown = Math.min(v.fruits.length, Math.floor((tree.nectar / nectar.cap) * v.fruits.length + 0.001));
        v.fruits.forEach((f, i) => {
          f.setVisible(i < shown);
          f.y += 0;
          f.scale = S * (1 + Math.sin(this.clock * 4 + i) * (tree.nectar >= nectar.minHarvest ? 0.12 : 0));
        });
      }
      // 種の莢は敵が近いと膨らむ
      if (tree.def.pod && v.grown) {
        const near = this.world.fighters.some((f) => f.alive && f.side === 'enemy' && Math.abs(f.x - tree.x) < tree.def.pod!.trigger * 3);
        v.body.scaleX = S * (1 + (near ? Math.sin(this.clock * 20) * 0.06 : 0));
      }
      // 体力の棒(減っている時だけ)
      v.bar.clear();
      if (v.grown && (v.sinceHit < 2.5 || tree.hp < tree.maxHp * 0.4)) {
        const w = 34;
        const yy = -TREE_SIZE[v.kind].h - 6;
        v.bar.fillStyle(0x1c1726, 0.85);
        v.bar.fillRect(-w / 2 - 1.5, yy - 1.5, w + 3, 6);
        v.bar.fillStyle(0x7cd65a, 1);
        v.bar.fillRect(-w / 2, yy, w * Math.max(0, tree.hp / tree.maxHp), 3);
      }
    }
    // 長押しで引き抜く
    this.ring.clear();
    if (this.holdTree !== null) {
      const v = this.views.get(this.holdTree);
      if (!v) {
        this.holdTree = null;
      } else {
        this.holdTime += dt;
        const k = Math.min(1, this.holdTime / HOLD_TO_UPROOT);
        const y = v.root.y - (TREE_SIZE[v.kind].h * TREE_SCALE) / 2;
        this.ring.lineStyle(5, 0x1c1726, 0.8);
        this.ring.strokeCircle(v.root.x, y, 22);
        this.ring.lineStyle(3.5, 0xffe28a, 1);
        this.ring.beginPath();
        this.ring.arc(v.root.x, y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        this.ring.strokePath();
        if (k >= 1) {
          this.world.command({ type: 'uproot', tree: v.id });
          this.holdTree = null;
        }
      }
    }
  }

  /** 画面の点に重なる木。 */
  hitTest(x: number, y: number): Tree | undefined {
    let best: Tree | undefined;
    let bestDist = Infinity;
    for (const v of this.views.values()) {
      const tree = this.world.getTree(v.id);
      if (!tree || !tree.alive) continue;
      const size = TREE_SIZE[v.kind];
      const half = Math.max(24, size.w * 0.4 * TREE_SCALE);
      const top = v.root.y - size.h * TREE_SCALE - 10;
      if (Math.abs(x - v.root.x) > half || y < top || y > v.root.y + 12) continue;
      const d = Math.abs(x - v.root.x);
      if (d < bestDist) {
        best = tree;
        bestDist = d;
      }
    }
    return best;
  }

  /** ポインタが通った木の実を摘む(なでるだけでよい)。 */
  pointerMove(x: number, y: number): void {
    if (!this.interactive) return;
    const tree = this.hitTest(x, y);
    if (this.holdTree !== null && (!tree || tree.id !== this.holdTree)) this.holdTree = null;
    if (!tree) return;
    this.tryHarvest(tree);
  }

  /** 押した木: 摘めれば摘み、長押しで引き抜きを始める。押した木が無ければ false。 */
  pointerDown(x: number, y: number): boolean {
    if (!this.interactive) return false;
    const tree = this.hitTest(x, y);
    if (!tree) return false;
    this.tryHarvest(tree);
    this.holdTree = tree.id;
    this.holdTime = 0;
    return true;
  }

  pointerUp(): void {
    this.holdTree = null;
  }

  private tryHarvest(tree: Tree): void {
    const v = this.views.get(tree.id);
    if (!v || !tree.def.nectar || tree.growing > 0) return;
    if (tree.nectar < tree.def.nectar.minHarvest) return;
    if (this.clock - v.lastHarvestTry < 0.25) return;
    v.lastHarvestTry = this.clock;
    this.world.command({ type: 'harvest', tree: tree.id });
  }
}
