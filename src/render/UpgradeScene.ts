import Phaser from 'phaser';
import { BRANCHES, UPGRADES, type UpgradeBranch, type UpgradeDef, type UpgradeEffect } from '../data/upgrades.ts';
import { t } from '../i18n.ts';
import { buyUpgrade, canBuyIn, effectAt, levelIn, maxLevel, nextCostIn } from '../meta.ts';
import { loadSave } from '../save.ts';
import type { UnitId } from '../sim/types.ts';
import { makeUpgradeTextures } from './art/upgradeIcons.ts';
import { ART_SCALE, VIEW, setupCamera } from './layout.ts';
import { INK_HEX } from './palette.ts';
import { sfx } from './sfx.ts';
import { drawStickman } from './stickman.ts';
import { button, label, type Button } from './widgets.ts';

// 強化の画面。兵・森・城の3列に強化を並べ、葉で1段ずつ買う。

const S = 1 / ART_SCALE;

const COL = { width: 400, gap: 20, top: 88, headerH: 54 };
const CARD = { w: 384, h: 84, gap: 8 };
const BUY = { w: 96, h: 56, x: CARD.w / 2 - 54 };
const COL_BOTTOM = 640;
const CARD_TOP = COL.top + COL.headerH + 12;
const PIP_SCALE = S * 1.35;
const LEAF_POS = { x: 1100, y: 44 };

const BRANCH_STYLE: Record<UpgradeBranch, { color: number; light: number; card: number }> = {
  soldiers: { color: 0x3f7fe0, light: 0x7fb2ff, card: 0x27304a },
  grove: { color: 0x4cae3c, light: 0x9ee07a, card: 0x26362e },
  castle: { color: 0x8a7a66, light: 0xcdc8c0, card: 0x34303a },
};

/** 強化ごとの絵: 主役の絵(棒人間か既存のテクスチャ)と、効き目を示す小さな札。 */
const ICONS: Record<string, { unit?: UnitId; texture?: string; badge: string }> = {
  swordHp: { unit: 'sword', badge: 'badge_heart' },
  swordDamage: { unit: 'sword', badge: 'badge_sword' },
  archerDamage: { unit: 'archer', badge: 'badge_sword' },
  mageDamage: { unit: 'mage', badge: 'badge_sword' },
  bomberHp: { unit: 'bomber', badge: 'badge_heart' },
  treeHp: { texture: 'tree_thornBush', badge: 'badge_heart' },
  treeDecay: { texture: 'tree_watchTree', badge: 'badge_time' },
  maxTrees: { texture: 'sprout', badge: 'badge_plus' },
  harvest: { texture: 'tree_manaFlower', badge: 'badge_fruit' },
  castleHp: { texture: 'castle_icon', badge: 'badge_heart' },
  startGold: { texture: 'coin', badge: 'badge_plus' },
  manaRegen: { texture: 'crystal', badge: 'badge_time' },
};

const PERCENT_KINDS: UpgradeEffect['kind'][] = ['unitHp', 'unitDamage', 'treeHp', 'treeDecay', 'harvest', 'manaRegen'];

export function formatEffect(effect: UpgradeEffect, level: number): string {
  const v = effectAt(effect, level);
  const sign = effect.kind === 'treeDecay' ? '−' : '+';
  return PERCENT_KINDS.includes(effect.kind) ? `${sign}${Math.round(v * 100)}%` : `${sign}${Math.round(v)}`;
}

interface Card {
  def: UpgradeDef;
  root: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Container;
  pips: Phaser.GameObjects.Image[];
  effect: Phaser.GameObjects.Text;
  next: Phaser.GameObjects.Text;
  buy: Button;
  cost: Phaser.GameObjects.Text;
  maxBadge: Phaser.GameObjects.Container;
  flash: Phaser.GameObjects.Graphics;
}

export class UpgradeScene extends Phaser.Scene {
  private cards: Card[] = [];
  private leavesText!: Phaser.GameObjects.Text;
  private branchText = new Map<UpgradeBranch, Phaser.GameObjects.Text>();
  private shownLeaves = 0;

  constructor() {
    super('upgrades');
  }

  create(): void {
    setupCamera(this);
    makeUpgradeTextures(this);
    const L = t();
    this.cards = [];
    this.branchText.clear();

    this.add.image(0, 0, 'bg_stage1').setOrigin(0, 0).setScale(S).setAlpha(0.35);
    const shade = this.add.graphics();
    shade.fillStyle(0x14121f, 0.72);
    shade.fillRect(0, 0, VIEW.width, VIEW.height);

    label(this, VIEW.width / 2, 44, L.upgradeTitle, { size: 40, color: '#e8ffd0' });

    // 葉の数
    const pill = this.add.graphics();
    pill.fillStyle(0x1c1726, 0.85);
    pill.lineStyle(3, 0x7cd65a, 1);
    pill.fillRoundedRect(LEAF_POS.x - 30, LEAF_POS.y - 24, 170, 48, 24);
    pill.strokeRoundedRect(LEAF_POS.x - 30, LEAF_POS.y - 24, 170, 48, 24);
    const leafIcon = this.add.image(LEAF_POS.x, LEAF_POS.y, 'leaf_icon').setScale(S * 1.25);
    this.tweens.add({ targets: leafIcon, angle: { from: -8, to: 8 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.shownLeaves = loadSave().leaves;
    this.leavesText = label(this, LEAF_POS.x + 28, LEAF_POS.y - 1, String(this.shownLeaves), { size: 30, align: 'left', color: '#c8f28a' });

    BRANCHES.forEach((branch, bi) => this.makeColumn(branch, 20 + bi * (COL.width + COL.gap)));

    button(this, 110, 676, 'btn_stone', L.back, () => this.scene.start('map'), { width: 160, height: 50, size: 20 });
    label(this, 720, 676, L.upgradeHint, { size: 16, color: '#b8c4dc' });
    this.refresh();
  }

  private makeColumn(branch: UpgradeBranch, left: number): void {
    const L = t();
    const style = BRANCH_STYLE[branch];
    const defs = UPGRADES.filter((u) => u.branch === branch);
    const cx = left + COL.width / 2;
    const bottom = COL_BOTTOM;
    const panel = this.add.graphics();
    panel.fillStyle(0x1e2232, 0.95);
    panel.lineStyle(4, INK_HEX, 1);
    panel.fillRoundedRect(left, COL.top, COL.width, bottom - COL.top, 18);
    panel.strokeRoundedRect(left, COL.top, COL.width, bottom - COL.top, 18);
    // 見出しの帯
    panel.fillStyle(style.color, 1);
    panel.fillRoundedRect(left + 6, COL.top + 6, COL.width - 12, COL.headerH - 6, { tl: 13, tr: 13, bl: 6, br: 6 });
    panel.fillStyle(style.light, 0.35);
    panel.fillRoundedRect(left + 14, COL.top + 10, COL.width - 28, 12, 6);
    panel.lineStyle(3, INK_HEX, 1);
    panel.strokeRoundedRect(left + 6, COL.top + 6, COL.width - 12, COL.headerH - 6, { tl: 13, tr: 13, bl: 6, br: 6 });

    const hy = COL.top + 6 + (COL.headerH - 6) / 2;
    const headIcon = this.add.container(left + 38, hy);
    if (branch === 'soldiers') headIcon.add(this.stick('sword', 0.62, 18));
    else if (branch === 'grove') headIcon.add(this.fitImage('tree_watchTree', 40));
    else headIcon.add(this.fitImage('castle_icon', 36));
    label(this, left + 66, hy - 1, L.branches[branch], { size: 28, align: 'left' });
    this.branchText.set(branch, label(this, left + COL.width - 20, hy, '', { size: 18, align: 'right', color: '#fff6c0' }));

    defs.forEach((def, i) => this.makeCard(def, cx, CARD_TOP + CARD.h / 2 + i * (CARD.h + CARD.gap), style.card));
    this.decorate(branch, cx, CARD_TOP + defs.length * (CARD.h + CARD.gap), bottom - 10);
  }

  /** 強化の少ない列の空いた所に、その系統の絵を薄く置く。 */
  private decorate(branch: UpgradeBranch, cx: number, top: number, bottom: number): void {
    const room = bottom - top;
    if (room < 70) return;
    const ground = this.add.graphics();
    ground.fillStyle(0x86cf5a, 0.12);
    ground.fillEllipse(cx, bottom - 6, 320, 26);
    const put = (key: string, x: number, h: number) => {
      const img = this.add.image(x, bottom - 4, key).setOrigin(0.5, 1).setAlpha(0.3);
      img.setScale(Math.min(h, room - 8) / img.height);
      return img;
    };
    if (branch === 'grove') {
      put('tree_thornBush', cx - 100, 60);
      put('tree_watchTree', cx, 100);
      put('tree_manaFlower', cx + 96, 76);
    } else if (branch === 'castle') {
      put('castle', cx, 190);
    }
  }

  private makeCard(def: UpgradeDef, cx: number, cy: number, fill: number): void {
    const L = t();
    const root = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(fill, 1);
    bg.lineStyle(3, INK_HEX, 1);
    bg.fillRoundedRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 14);
    bg.strokeRoundedRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 14);
    bg.lineStyle(2, 0xffffff, 0.1);
    bg.strokeRoundedRect(-CARD.w / 2 + 5, -CARD.h / 2 + 5, CARD.w - 10, CARD.h - 10, 10);
    root.add(bg);

    const icon = this.add.container(-CARD.w / 2 + 44, 0);
    icon.add(this.add.image(0, 0, 'icon_disc').setScale(S * 0.92));
    const spec = ICONS[def.id];
    if (spec?.unit) icon.add(this.stick(spec.unit, 0.66, 22));
    else if (spec?.texture) icon.add(this.fitImage(spec.texture, spec.texture === 'coin' || spec.texture === 'crystal' ? 34 : 48));
    if (spec) icon.add(this.add.image(22, 20, spec.badge).setScale(S * 1.05));
    root.add(icon);

    const tx = -CARD.w / 2 + 86;
    root.add(label(this, tx, -24, L.upgradeNames[def.id] ?? def.id, { size: 19, align: 'left', color: '#ffe9a8' }));
    const pips: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < maxLevel(def); i++) {
      const pip = this.add.image(tx + 9 + i * 22, 1, 'pip_off').setScale(PIP_SCALE);
      pips.push(pip);
      root.add(pip);
    }
    const effect = label(this, tx, 25, '', { size: 16, align: 'left', color: '#d8e4ff' });
    const next = label(this, tx, 25, '', { size: 16, align: 'left', color: '#8ff06a' });
    root.add([effect, next]);

    const card: Card = { def, root, icon, pips, effect, next, buy: null as unknown as Button, cost: null as unknown as Phaser.GameObjects.Text, maxBadge: null as unknown as Phaser.GameObjects.Container, flash: this.add.graphics() };
    const buy = button(this, BUY.x, 1, 'btn_green', null, () => this.onBuy(card), { width: BUY.w, height: BUY.h });
    buy.root.add(this.add.image(-22, -3, 'leaf_icon').setScale(S * 0.9));
    const cost = label(this, -5, -3, '', { size: 22, align: 'left' });
    buy.root.add(cost);
    root.add(buy.root);

    const maxBadge = this.add.container(BUY.x, 0);
    maxBadge.add(this.add.image(0, -4, 'star').setScale(S * 0.62));
    maxBadge.add(label(this, 0, 22, L.maxed, { size: 18, color: '#ffd640' }));
    root.add(maxBadge);

    card.flash.fillStyle(0xffffff, 1);
    card.flash.fillRoundedRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 14);
    card.flash.setAlpha(0);
    root.add(card.flash);

    card.buy = buy;
    card.cost = cost;
    card.maxBadge = maxBadge;
    this.cards.push(card);
  }

  /** 保存を読んで、全部のカードの段・値段・押せるかを合わせる。 */
  private refresh(): void {
    const data = loadSave();
    const L = t();
    for (const card of this.cards) {
      const def = card.def;
      const lv = levelIn(data, def.id);
      const max = maxLevel(def);
      card.pips.forEach((p, i) => p.setTexture(i < lv ? 'pip_on' : 'pip_off'));
      const stat = L.upgradeStat[def.effect.kind];
      if (lv === 0) {
        card.effect.setText(stat);
        card.next.setText(formatEffect(def.effect, 1));
      } else if (lv < max) {
        card.effect.setText(`${stat} ${formatEffect(def.effect, lv)}`);
        card.next.setText(`→ ${formatEffect(def.effect, lv + 1)}`);
      } else {
        card.effect.setText(`${stat} ${formatEffect(def.effect, lv)}`);
        card.next.setText('');
      }
      // 長い言葉は買うボタンにかからないよう小さくする
      const room = BUY.x - BUY.w / 2 - 6 - card.effect.x;
      for (const size of [16, 15, 14]) {
        card.effect.setFontSize(size);
        card.next.setFontSize(size);
        if (card.effect.width + card.next.width + 6 <= room) break;
      }
      card.next.setX(card.effect.x + card.effect.width + 6);
      const cost = nextCostIn(data, def.id);
      const maxed = cost === null;
      card.buy.root.setVisible(!maxed);
      card.maxBadge.setVisible(maxed);
      if (!maxed) {
        const ok = canBuyIn(data, def.id);
        card.cost.setText(String(cost));
        card.cost.setColor(ok ? '#ffffff' : '#ffb0a0');
        card.buy.bg.setTexture(ok ? 'btn_green' : 'btn_stone');
        card.buy.bg.setDisplaySize(BUY.w, BUY.h);
        card.buy.setEnabled(ok);
      }
    }
    for (const branch of BRANCHES) {
      const defs = UPGRADES.filter((u) => u.branch === branch);
      const have = defs.reduce((s, d) => s + levelIn(data, d.id), 0);
      const all = defs.reduce((s, d) => s + maxLevel(d), 0);
      this.branchText.get(branch)?.setText(`${have} / ${all}`);
    }
  }

  private onBuy(card: Card): void {
    const before = loadSave().leaves;
    const lvBefore = levelIn(loadSave(), card.def.id);
    if (!buyUpgrade(card.def.id)) return;
    const after = loadSave().leaves;
    sfx.play('build');
    this.refresh();
    // 新しい段の玉は、葉が届くまで空のまま見せておく
    const pip = card.pips[lvBefore];
    pip.setTexture('pip_off');
    if (card.maxBadge.visible) card.maxBadge.setScale(0);
    this.tweenLeaves(before, after);

    // 葉が数から飛んでカードへ
    const target = new Phaser.Math.Vector2(card.root.x + card.buy.root.x, card.root.y + card.buy.root.y);
    const flyTime = 380;
    for (let i = 0; i < 6; i++) {
      const leaf = this.add.image(LEAF_POS.x, LEAF_POS.y, 'leaf_icon').setScale(S * 0.9).setDepth(50);
      const midX = (LEAF_POS.x + target.x) / 2 + Phaser.Math.Between(-80, 80);
      const midY = Math.min(LEAF_POS.y, target.y) - Phaser.Math.Between(10, 60);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(LEAF_POS.x, LEAF_POS.y), new Phaser.Math.Vector2(midX, midY), target);
      const prog = { t: 0 };
      this.tweens.add({
        targets: prog,
        t: 1,
        delay: i * 35,
        duration: flyTime,
        ease: 'Quad.In',
        onUpdate: () => {
          const p = curve.getPoint(prog.t);
          leaf.setPosition(p.x, p.y);
          leaf.setAngle(prog.t * 360);
          leaf.setScale(S * (0.9 - prog.t * 0.4));
        },
        onComplete: () => leaf.destroy(),
      });
    }

    this.time.delayedCall(flyTime + 60, () => {
      sfx.play('coin');
      const maxed = levelIn(loadSave(), card.def.id) >= maxLevel(card.def);
      card.flash.setAlpha(0.55);
      this.tweens.add({ targets: card.flash, alpha: 0, duration: 320, ease: 'Quad.Out' });
      this.tweens.add({ targets: card.icon, scale: { from: 1.3, to: 1 }, duration: 420, ease: 'Back.Out' });
      pip.setTexture('pip_on');
      this.tweens.add({ targets: pip, scale: { from: PIP_SCALE * 2.2, to: PIP_SCALE }, duration: 360, ease: 'Back.Out' });
      if (maxed) this.tweens.add({ targets: card.maxBadge, scale: { from: 0, to: 1 }, duration: 420, ease: 'Back.Out' });

      // 葉と火花が弾ける
      const ix = card.root.x + card.icon.x;
      const iy = card.root.y + card.icon.y;
      for (let i = 0; i < (maxed ? 18 : 10); i++) {
        const a = (i / (maxed ? 18 : 10)) * Math.PI * 2 + Math.random() * 0.4;
        const dist = Phaser.Math.Between(34, maxed ? 80 : 58);
        const p = this.add.image(ix, iy, i % 3 === 0 ? 'spark' : 'leaf').setScale(S * 1.6).setDepth(60).setAngle(Math.random() * 360);
        this.tweens.add({
          targets: p,
          x: ix + Math.cos(a) * dist,
          y: iy + Math.sin(a) * dist + 10,
          angle: p.angle + Phaser.Math.Between(-180, 180),
          alpha: 0,
          duration: Phaser.Math.Between(480, 700),
          ease: 'Quad.Out',
          onComplete: () => p.destroy(),
        });
      }
      const text = label(this, ix, iy - 30, maxed ? t().maxed + '!' : `Lv ${lvBefore + 1}`, { size: 22, color: maxed ? '#ffd640' : '#c8f28a' }).setDepth(70);
      this.tweens.add({ targets: text, y: iy - 66, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Quad.Out', onComplete: () => text.destroy() });
    });
  }

  private tweenLeaves(from: number, to: number): void {
    const counter = { v: from };
    this.tweens.add({
      targets: counter,
      v: to,
      duration: 420,
      ease: 'Quad.Out',
      onUpdate: () => this.leavesText.setText(String(Math.round(counter.v))),
    });
    this.tweens.add({ targets: this.leavesText, scale: { from: 1.25, to: 1 }, duration: 300, ease: 'Back.Out' });
  }

  private stick(unit: UnitId, scale: number, feetY: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.setScale(scale);
    g.setPosition(0, feetY);
    drawStickman(g, { kind: unit, walk: 0, moving: false, attack: unit === 'sword' ? 0.4 : -1, flash: 0, time: 0.3, facing: 1 });
    return g;
  }

  /** テクスチャを box の大きさに収めて置く。 */
  private fitImage(key: string, box: number): Phaser.GameObjects.Image {
    const img = this.add.image(0, 0, key);
    const fit = box / Math.max(img.width, img.height);
    img.setScale(fit);
    return img;
  }
}

/** 地図などに置く「強化」ボタン。葉の数と、買える強化がある時の印つき。 */
export function addUpgradeButton(scene: Phaser.Scene, x: number, y: number): Button {
  makeUpgradeTextures(scene);
  const L = t();
  const data = loadSave();
  const b = button(scene, x, y, 'btn_gold', null, () => scene.scene.start('upgrades'), { width: 300, height: 60 });
  b.root.add(label(scene, -44, -3, L.upgrades, { size: 26 }));
  b.root.add(scene.add.image(58, -3, 'leaf_icon').setScale(S * 1.05));
  b.root.add(label(scene, 78, -3, String(data.leaves), { size: 24, align: 'left', color: '#eaffc0' }));
  if (UPGRADES.some((u) => canBuyIn(data, u.id))) {
    const dot = scene.add.container(140, -26);
    const g = scene.add.graphics();
    g.fillStyle(0xe84a4a, 1);
    g.lineStyle(3, INK_HEX, 1);
    g.fillCircle(0, 0, 13);
    g.strokeCircle(0, 0, 13);
    dot.add([g, label(scene, 0, -1, '!', { size: 20 })]);
    b.root.add(dot);
    scene.tweens.add({ targets: dot, scale: 1.2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
  return b;
}
