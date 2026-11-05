import Phaser from 'phaser';
import { ABILITIES, ABILITY_ORDER } from '../data/towers.ts';
import { TREE_RULES } from '../data/trees.ts';
import { UNITS, UNIT_ORDER } from '../data/units.ts';
import { t } from '../i18n.ts';
import { ECONOMY } from '../sim/constants.ts';
import type { AbilityId, UnitId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { ABILITY_BTN, CARD } from './art/ui.ts';
import { ART_SCALE, DEPTH, HUD_TOP } from './layout.ts';
import { COLORS, hex } from './palette.ts';
import { drawStickman } from './stickman.ts';
import { button, label, type Button } from './widgets.ts';

// 下の操作盤と、上の城・ボスの体力。

const S = 1 / ART_SCALE;

const CARD_TEXTURE: Record<UnitId, string> = {
  sword: 'card_blue',
  archer: 'card_green',
  mage: 'card_purple',
  bomber: 'card_gold',
};

export interface HudActions {
  spawn(unit: UnitId): void;
  ability(id: AbilityId): void;
  nextWave(): void;
  pause(): void;
  speed(): void;
  mute(): void;
  stance(which: 'defend' | 'advance'): void;
}

interface Card {
  unit: UnitId;
  root: Phaser.GameObjects.Container;
  shade: Phaser.GameObjects.Image;
  cooldown: Phaser.GameObjects.Graphics;
  cost: Phaser.GameObjects.Text;
}

interface AbilityButton {
  id: AbilityId;
  root: Phaser.GameObjects.Container;
  shade: Phaser.GameObjects.Image;
  cooldown: Phaser.GameObjects.Graphics;
  timer: Phaser.GameObjects.Text;
  active: boolean;
}

export class Hud {
  private scene: Phaser.Scene;
  private world: World;
  private goldText: Phaser.GameObjects.Text;
  private manaText: Phaser.GameObjects.Text;
  private manaBar: Phaser.GameObjects.Graphics;
  private defendBtn: Button;
  private advanceBtn: Button;
  private waveTitle: Phaser.GameObjects.Text;
  private waveBar: Phaser.GameObjects.Graphics;
  private nextButton: Button;
  private nextSub: Phaser.GameObjects.Text;
  private cards: Card[] = [];
  private abilities: AbilityButton[] = [];
  private castleBar: Phaser.GameObjects.Graphics;
  private castleText: Phaser.GameObjects.Text;
  private groveText: Phaser.GameObjects.Text;
  private bossRoot: Phaser.GameObjects.Container;
  private bossBar: Phaser.GameObjects.Graphics;
  private bossName: Phaser.GameObjects.Text;
  private bossTrail = 1;
  private castleTrail = 1;
  private shownGold = 0;
  private tooltip: Phaser.GameObjects.Container;
  private tooltipTitle: Phaser.GameObjects.Text;
  private tooltipBody: Phaser.GameObjects.Text;
  speedText: Phaser.GameObjects.Text;
  muteText: Phaser.GameObjects.Text;
  readonly goldIcon = { x: 28, y: 628 };

  constructor(scene: Phaser.Scene, world: World, actions: HudActions) {
    this.scene = scene;
    this.world = world;
    const L = t();
    const root = scene.add.container(0, 0).setDepth(DEPTH.hud);
    root.add(scene.add.image(0, HUD_TOP - 4, 'hud_panel').setOrigin(0, 0).setScale(S));

    // 資源
    root.add(scene.add.image(this.goldIcon.x, 628, 'coin').setScale(S * 1.1));
    root.add(label(scene, 46, 628, L.gold, { size: 17, align: 'left', color: '#ffe28a' }));
    this.goldText = label(scene, 222, 628, '0', { size: 20, align: 'right', color: '#ffe28a' });
    root.add(scene.add.image(28, 662, 'crystal').setScale(S * 1.05));
    root.add(label(scene, 46, 660, L.mana, { size: 17, align: 'left', color: '#9fe8ff' }));
    this.manaText = label(scene, 222, 660, '0', { size: 18, align: 'right', color: '#9fe8ff' });
    this.manaBar = scene.add.graphics();
    root.add([this.goldText, this.manaText, this.manaBar]);

    // 旗の命令: 守る(城の近くで踏みとどまる)・進め(門の前まで押し込む)
    this.defendBtn = button(scene, 72, 699, 'btn_stone', `◀ ${L.defend}`, () => actions.stance('defend'), { width: 112, height: 38, size: 16 });
    this.advanceBtn = button(scene, 180, 699, 'btn_stone', `${L.advance} ▶`, () => actions.stance('advance'), { width: 104, height: 38, size: 16 });
    root.add([this.defendBtn.root, this.advanceBtn.root]);

    // ユニットのカード
    UNIT_ORDER.filter((u) => world.stage.units.includes(u)).forEach((unit, i) => {
      const card = this.makeCard(unit, 291 + i * 92, 662, i + 1, () => actions.spawn(unit));
      root.add(card.root);
      this.cards.push(card);
    });

    // ウェーブ
    this.waveTitle = label(scene, 776, 622, '', { size: 18, color: '#ffffff' });
    this.waveBar = scene.add.graphics();
    this.nextButton = button(scene, 776, 680, 'btn_green', L.nextWave, () => actions.nextWave(), { width: 222, height: 54, size: 21 });
    this.nextSub = label(scene, 776, 699, '', { size: 12, color: '#e8ffd8', stroke: 3 });
    this.nextButton.text?.setY(-6);
    root.add([this.waveTitle, this.waveBar, this.nextButton.root, this.nextSub]);

    // 特殊能力
    root.add(label(scene, 996, 614, L.abilities, { size: 14, color: '#c8d4ea' }));
    ABILITY_ORDER.forEach((id, i) => {
      const button = this.makeAbility(id, 951 + i * 90, 668, i === 0 ? 'Q' : 'W', () => actions.ability(id));
      root.add(button.root);
      this.abilities.push(button);
    });

    // 一時停止・速さ・音
    const small = [
      { x: 1128, icon: 'pause', text: 'II', action: actions.pause },
      { x: 1186, icon: 'speed', text: '▶', action: actions.speed },
      { x: 1244, icon: 'mute', text: '♪', action: actions.mute },
    ];
    const smallButtons = small.map((b) => {
      const btn = button(scene, b.x, 652, b.icon === 'pause' ? 'btn_gold_sq' : 'btn_stone_sq', b.text, b.action, { size: 22 });
      root.add(btn.root);
      return btn;
    });
    this.speedText = label(scene, 1186, 698, 'x1', { size: 15 });
    this.muteText = label(scene, 1244, 698, 'ON', { size: 15 });
    root.add([label(scene, 1128, 698, 'P', { size: 13, color: '#c8d4ea' }), this.speedText, this.muteText]);
    void smallButtons;

    // 上: 城の体力
    const top = scene.add.container(0, 0).setDepth(DEPTH.hud);
    top.add(scene.add.image(26, 26, 'castle_icon').setScale(S * 1.2));
    this.castleBar = scene.add.graphics();
    this.castleText = label(scene, 156, 26, '', { size: 14 });
    top.add(scene.add.image(26, 58, 'leaf').setScale(S * 1.6));
    this.groveText = label(scene, 44, 58, '', { size: 15, align: 'left', color: '#c8f5a8' });
    top.add([this.castleBar, this.castleText, this.groveText]);

    // 上: ボスの体力
    this.bossRoot = scene.add.container(0, 0).setDepth(DEPTH.hud).setVisible(false);
    this.bossBar = scene.add.graphics();
    this.bossName = label(scene, 640, 20, '', { size: 20, color: '#ffd0f0' });
    this.bossRoot.add([this.bossBar, this.bossName]);

    // 説明の吹き出し
    this.tooltip = scene.add.container(0, 0).setDepth(DEPTH.hud + 10).setVisible(false);
    this.tooltipTitle = label(scene, 0, -24, '', { size: 17 });
    this.tooltipBody = label(scene, 0, 2, '', { size: 13, color: '#d8e4ff', stroke: 3 });
    this.tooltip.add([scene.add.image(0, -10, 'tooltip').setScale(S).setDisplaySize(250, 70), this.tooltipTitle, this.tooltipBody]);

    this.shownGold = world.gold;
  }

  private makeCard(unit: UnitId, x: number, y: number, hotkey: number, onClick: () => void): Card {
    const scene = this.scene;
    const def = UNITS[unit];
    const root = scene.add.container(x, y);
    const bg = scene.add.image(0, 0, CARD_TEXTURE[unit]).setScale(S);
    const icon = scene.add.graphics();
    icon.setScale(1.05);
    icon.setPosition(0, 26);
    drawStickman(icon, { kind: unit, walk: 0, moving: false, attack: unit === 'sword' ? 0.4 : -1, flash: 0, time: 0.3, facing: 1 });
    const costBg = scene.add.graphics();
    costBg.fillStyle(0x1c1726, 0.55);
    costBg.fillRoundedRect(-36, 28, 72, 18, 8);
    const isMana = def.cost.mana > 0;
    const parts: Phaser.GameObjects.GameObject[] = [bg, icon, costBg];
    let cost: Phaser.GameObjects.Text;
    if (isMana) {
      parts.push(scene.add.image(-27, 37, 'coin').setScale(S * 0.6));
      cost = label(scene, -11, 37, `${def.cost.gold}`, { size: 14, color: '#ffe28a', stroke: 3 });
      parts.push(cost, scene.add.image(9, 37, 'crystal').setScale(S * 0.55));
      parts.push(label(scene, 24, 37, `${def.cost.mana}`, { size: 14, color: '#9fe8ff', stroke: 3 }));
    } else {
      parts.push(scene.add.image(-18, 37, 'coin').setScale(S * 0.7));
      cost = label(scene, 6, 37, `${def.cost.gold}`, { size: 15, color: '#ffe28a', stroke: 3 });
      parts.push(cost);
    }
    const key = label(scene, -32, -38, `${hotkey}`, { size: 14, color: '#ffffff', stroke: 3 });
    const shade = scene.add.image(0, 0, 'card_shade').setScale(S).setVisible(false);
    const cooldown = scene.add.graphics();
    root.add([...parts, shade, cooldown, key]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.();
      scene.tweens.add({ targets: root, scaleX: 0.9, scaleY: 0.9, duration: 50, yoyo: true });
      onClick();
      // タッチでは「乗せる」が無いので、押した時にも少しだけ説明を出す
      this.showTooltip(x, y - 78, t().units[unit], t().unitInfo[unit]);
      scene.time.delayedCall(1400, () => this.tooltip.setVisible(false));
    });
    bg.on('pointerover', () => {
      scene.tweens.add({ targets: root, y: y - 4, duration: 90 });
      this.showTooltip(x, y - 78, t().units[unit], t().unitInfo[unit]);
    });
    bg.on('pointerout', () => {
      scene.tweens.add({ targets: root, y, duration: 90 });
      this.tooltip.setVisible(false);
    });
    return { unit, root, shade, cooldown, cost };
  }

  private makeAbility(id: AbilityId, x: number, y: number, hotkey: string, onClick: () => void): AbilityButton {
    const scene = this.scene;
    const root = scene.add.container(x, y);
    const bg = scene.add.image(0, 0, `ability_${id}`).setScale(S * 0.95);
    const name = label(scene, 0, 22, t().abilityNames[id], { size: 14 });
    const cost = label(scene, 6, -28, `${ABILITIES[id].mana}`, { size: 13, color: '#9fe8ff', stroke: 3 });
    const costIcon = scene.add.image(-14, -28, 'crystal').setScale(S * 0.55);
    const key = label(scene, 28, -28, hotkey, { size: 12, stroke: 3 });
    const shade = scene.add.image(0, 0, 'ability_shade').setScale(S * 0.95).setVisible(false);
    const cooldown = scene.add.graphics();
    const timer = label(scene, 0, -2, '', { size: 22 });
    root.add([bg, name, shade, cooldown, costIcon, cost, key, timer]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.();
      scene.tweens.add({ targets: root, scaleX: 0.9, scaleY: 0.9, duration: 50, yoyo: true });
      onClick();
    });
    return { id, root, shade, cooldown, timer, active: false };
  }

  private showTooltip(x: number, y: number, title: string, body: string): void {
    this.tooltipTitle.setText(title);
    this.tooltipBody.setText(body);
    this.tooltip.setPosition(x, y).setVisible(true);
  }

  /** 隕石の狙い中など、能力ボタンを光らせる。 */
  setAbilityActive(id: AbilityId, on: boolean): void {
    const b = this.abilities.find((a) => a.id === id);
    if (!b) return;
    b.active = on;
    if (on) this.scene.tweens.add({ targets: b.root, scale: 1.08, duration: 200, yoyo: true, repeat: -1 });
    else {
      this.scene.tweens.killTweensOf(b.root);
      b.root.setScale(1);
    }
  }

  /** 足りない時にカードを揺らす。 */
  shakeCard(unit: UnitId): void {
    const card = this.cards.find((c) => c.unit === unit);
    if (!card) return;
    const x = card.root.x;
    this.scene.tweens.add({ targets: card.root, x: x + 5, duration: 40, yoyo: true, repeat: 3, onComplete: () => card.root.setX(x) });
  }

  cardPosition(unit: UnitId): { x: number; y: number } {
    const card = this.cards.find((c) => c.unit === unit)!;
    return { x: card.root.x, y: card.root.y - 60 };
  }

  pulseGold(): void {
    this.scene.tweens.add({ targets: this.goldText, scale: 1.25, duration: 70, yoyo: true });
  }

  update(dt: number): void {
    const w = this.world;
    const L = t();
    // ゴールドは数字が少しずつ追いつく
    this.shownGold += (w.gold - this.shownGold) * Math.min(1, dt * 10);
    if (Math.abs(w.gold - this.shownGold) < 1) this.shownGold = w.gold;
    this.goldText.setText(`${Math.floor(this.shownGold).toLocaleString()} G`);
    this.manaText.setText(`${Math.floor(w.mana)}/${ECONOMY.maxMana}`);
    this.manaBar.clear();
    this.manaBar.fillStyle(0x0e1420, 1);
    this.manaBar.fillRoundedRect(46, 673, 176, 5, 2);
    this.manaBar.fillStyle(hex(COLORS.mana), 1);
    this.manaBar.fillRoundedRect(46, 673, 176 * (w.mana / ECONOMY.maxMana), 5, 2);
    const defending = w.rallyX < 600;
    this.defendBtn.bg.setTexture(defending ? 'btn_gold' : 'btn_stone');
    this.advanceBtn.bg.setTexture(defending ? 'btn_stone' : 'btn_gold');

    for (const card of this.cards) {
      const def = UNITS[card.unit];
      const affordable = w.canAfford(def.cost);
      const cd = Math.max(0, w.unitCooldowns[card.unit]) / def.spawnCooldown;
      card.shade.setVisible(!affordable);
      card.cooldown.clear();
      if (cd > 0) {
        card.cooldown.fillStyle(0x0c0a14, 0.55);
        card.cooldown.fillRoundedRect(-CARD.w / 2 + 3, -CARD.h / 2 + 3, CARD.w - 6, (CARD.h - 6) * cd, 10);
      }
      card.cost.setColor(affordable ? '#ffe28a' : '#ff8a7a');
    }

    for (const b of this.abilities) {
      const def = ABILITIES[b.id];
      const remaining = Math.max(0, w.abilityCooldowns[b.id]);
      const affordable = w.mana >= def.mana;
      b.shade.setVisible(!affordable || remaining > 0);
      b.cooldown.clear();
      if (remaining > 0) {
        const frac = remaining / def.cooldown;
        b.cooldown.fillStyle(0x0c0a14, 0.5);
        b.cooldown.slice(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
        b.cooldown.fillPath();
        b.timer.setText(`${Math.ceil(remaining)}`);
      } else {
        b.timer.setText('');
      }
      void ABILITY_BTN;
    }

    // ウェーブ
    this.waveTitle.setText(`${L.waveBanner} ${Math.max(1, w.wavesStarted)} / ${w.totalWaves}`);
    this.waveBar.clear();
    this.waveBar.fillStyle(0x0e1420, 1);
    this.waveBar.fillRoundedRect(668, 636, 216, 10, 4);
    const progress = Math.min(1, (w.wavesStarted - (w.phase === 'wave' ? 0.5 : 0)) / w.totalWaves);
    this.waveBar.fillStyle(0x5fa8ff, 1);
    this.waveBar.fillRoundedRect(668, 636, Math.max(8, 216 * progress), 10, 4);
    this.waveBar.lineStyle(2, 0x1c1726, 1);
    this.waveBar.strokeRoundedRect(668, 636, 216, 10, 4);
    if (w.phase === 'break') {
      this.nextButton.setEnabled(true);
      const bonus = Math.floor(w.breakTimer) * ECONOMY.earlyBonusPerSecond;
      this.nextSub.setText(`${Math.ceil(w.breakTimer)}s  ·  +${bonus} G`);
    } else {
      this.nextButton.setEnabled(false);
      this.nextSub.setText(w.ended ? '' : L.inProgress);
    }

    // 城の体力
    const castleRatio = w.castle.hp / w.castle.maxHp;
    this.castleTrail = Math.max(castleRatio, this.castleTrail - dt * 0.4);
    this.drawBar(this.castleBar, 46, 17, 220, 18, castleRatio, this.castleTrail, castleRatio > 0.35 ? 0x57d65a : 0xe84a4a);
    this.castleText.setText(`${L.castle}  ${Math.ceil(w.castle.hp)}/${w.castle.maxHp}`);
    this.groveText.setText(`${L.grove} ${w.aliveTrees().length}/${TREE_RULES.maxTrees}`);

    // ボスの体力
    const boss = w.boss();
    if (boss) {
      if (!this.bossRoot.visible) {
        const names = L.enemies as Record<string, string>;
        this.bossName.setText(names[boss.def.id] ?? '');
        this.bossRoot.setVisible(true).setAlpha(0);
        this.scene.tweens.add({ targets: this.bossRoot, alpha: 1, duration: 400 });
        this.bossTrail = 1;
      }
      const ratio = boss.hp / boss.maxHp;
      this.bossTrail = Math.max(ratio, this.bossTrail - dt * 0.35);
      this.drawBar(this.bossBar, 420, 36, 440, 20, ratio, this.bossTrail, 0xd8324a);
    } else if (this.bossRoot.visible) {
      this.bossRoot.setVisible(false);
    }
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, trail: number, color: number): void {
    g.clear();
    g.fillStyle(0x1c1726, 1);
    g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 6);
    g.fillStyle(0x3a3448, 1);
    g.fillRoundedRect(x, y, w, h, 4);
    if (trail > ratio) {
      g.fillStyle(0xffffff, 0.85);
      g.fillRoundedRect(x, y, w * trail, h, 4);
    }
    if (ratio > 0) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x, y, Math.max(6, w * ratio), h, 4);
      g.fillStyle(0xffffff, 0.25);
      g.fillRoundedRect(x + 3, y + 2, Math.max(0, w * ratio - 6), h * 0.3, 2);
    }
  }
}

