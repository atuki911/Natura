import Phaser from 'phaser';
import { nextStage, STAGES } from '../data/stages.ts';
import { UNIT_ORDER } from '../data/units.ts';
import { METEOR_DELAY, METEOR_RADIUS, TOWERS, TOWER_ORDER } from '../data/towers.ts';
import { UNITS } from '../data/units.ts';
import { t } from '../i18n.ts';
import { platform } from '../platform.ts';
import { loadSave, updateSave } from '../save.ts';
import { Bot, BOT_STYLES } from '../sim/bot.ts';
import { DT, FIELD, RALLY_MIN, TOWER_SLOTS } from '../sim/constants.ts';
import { CASTLE_TARGET, type AbilityId, type EnemyId, type Fighter, type SimEvent, type TowerId, type UnitId } from '../sim/types.ts';
import { World } from '../sim/world.ts';
import { createEnemyView, type EnemyView } from './enemyView.ts';
import { Fx } from './fx.ts';
import { Hud } from './Hud.ts';
import { ART_SCALE, DEPTH, FLY_HEIGHT, HUD_TOP, LANE, TOWER_BASE_Y, VIEW, groundY, setupCamera } from './layout.ts';
import { INK_HEX } from './palette.ts';
import { sfx } from './sfx.ts';
import { ATTACK_STRIKE, drawRagdoll, drawStickman, type StickKind } from './stickman.ts';
import { button, label } from './widgets.ts';
import { attachDebugPanel } from './debugPanel.ts';
import { TreeLayer } from './TreeLayer.ts';
import { Tutorial } from './Tutorial.ts';

const S = 1 / ART_SCALE;

export interface BattleConfig {
  stageId?: string;
  /** play: 人が遊ぶ / attract: タイトル画面の後ろで自動で戦う */
  mode?: 'play' | 'attract';
  seed?: number;
  /** 自動プレイ(検証・紹介動画用)。 */
  autoplay?: boolean;
  speed?: number;
  /** このウェーブから始める(検証用)。 */
  startWave?: number;
  debug?: boolean;
}

interface FighterView {
  id: number;
  fighter: Fighter;
  root: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics | null;
  enemy: EnemyView | null;
  hpBar: Phaser.GameObjects.Graphics;
  kind: StickKind | EnemyId;
  walk: number;
  attackAt: number;
  attackLength: number;
  flash: number;
  time: number;
  lastX: number;
  hpShown: number;
  stepTimer: number;
}

interface ProjectileView {
  sprite: Phaser.GameObjects.Image;
  kind: string;
  side: 'ally' | 'enemy';
  lastX: number;
  lastY: number;
}

interface TowerView {
  slot: number;
  base: Phaser.GameObjects.Image;
  tower: Phaser.GameObjects.Image | null;
  archer: Phaser.GameObjects.Graphics | null;
  barrel: Phaser.GameObjects.Image | null;
  attackAt: number;
}

const ENEMY_HIT_HEIGHT = 30;
/** 「守る」で旗を立てる位置(城の近く)。 */
const DEFEND_X = 430;
/** 旗の竿の先の高さ。 */
const FLAG_TOP = 400;
/** 棒人間と敵の表示の大きさ。 */
const ALLY_SCALE = 1.3;
const ENEMY_SCALE = 1.15;
/** 空を飛ぶ敵の、画面上の浮く高さ。 */
const FLY_Y = FLY_HEIGHT * ENEMY_SCALE;

export class BattleScene extends Phaser.Scene {
  private config!: BattleConfig;
  world!: World;
  private bot: Bot | null = null;
  private fx!: Fx;
  private trees!: TreeLayer;
  private rallyFlag!: Phaser.GameObjects.Graphics;
  private castleImg!: Phaser.GameObjects.Image;
  private castleCracks!: Phaser.GameObjects.Graphics;
  private castleStage = 0;
  private smokeTimer = 0;
  private bannerFreeAt = 0;
  private draggingFlag = false;
  private flagPreviewX = 0;
  private tutorial: Tutorial | null = null;
  private hud: Hud | null = null;
  private accumulator = 0;
  private speed = 1;
  private paused = false;
  private clock = 0;
  private views = new Map<number, FighterView>();
  private projectileViews = new Map<number, ProjectileView>();
  private towerViews: TowerView[] = [];
  private castleArchers: { gfx: Phaser.GameObjects.Graphics; x: number; y: number; attackAt: number }[] = [];
  private flag!: Phaser.GameObjects.Graphics;
  private portal!: Phaser.GameObjects.Image;
  private portalGlow!: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private targeting: AbilityId | null = null;
  private reticle!: Phaser.GameObjects.Graphics;
  private hint: Phaser.GameObjects.Text | null = null;
  private buildMenu: Phaser.GameObjects.Container | null = null;
  private overlay: Phaser.GameObjects.Container | null = null;
  private resultShown = false;
  private castleArcherTurn = 0;
  private emberTimer = 0;

  constructor() {
    super('battle');
  }

  init(config: BattleConfig): void {
    this.config = { mode: 'play', ...config };
    this.views = new Map();
    this.projectileViews = new Map();
    this.towerViews = [];
    this.castleArchers = [];
    this.clouds = [];
    this.accumulator = 0;
    this.paused = false;
    this.clock = 0;
    this.targeting = null;
    this.buildMenu = null;
    this.overlay = null;
    this.resultShown = false;
    this.hud = null;
    this.hint = null;
    this.draggingFlag = false;
    this.castleStage = 0;
    this.bannerFreeAt = 0;
    this.tutorial = null;
  }

  get isAttract(): boolean {
    return this.config.mode === 'attract';
  }

  create(): void {
    setupCamera(this);
    const stage = STAGES.find((s) => s.id === this.config.stageId) ?? STAGES.find((s) => s.id === '1-3') ?? STAGES[0];
    const seed = this.config.seed ?? Math.floor(Math.random() * 1e9);
    this.world = new World(stage, seed);
    if (this.config.startWave && this.config.startWave > 1) {
      this.world.command({ type: 'debugJumpWave', wave: this.config.startWave });
      this.world.command({ type: 'debugGold', amount: 150 * this.config.startWave });
    }
    this.speed = this.config.speed ?? 1;
    if (this.isAttract || this.config.autoplay) this.bot = new Bot(BOT_STYLES.standard);
    else this.bot = null;

    this.buildScenery();
    this.fx = new Fx(this);
    this.trees = new TreeLayer(this, this.world, this.fx, {
      gold: () => this.hud?.goldIcon ?? { x: 28, y: 628 },
      mana: () => ({ x: 28, y: 662 }),
      onGold: () => this.hud?.pulseGold(),
    });
    this.trees.interactive = !this.isAttract;
    this.reticle = this.add.graphics().setDepth(DEPTH.effects - 5).setVisible(false);

    if (!this.isAttract) {
      this.hud = new Hud(this, this.world, {
        spawn: (unit) => this.trySpawn(unit),
        ability: (id) => this.tryAbility(id),
        nextWave: () => this.world.command({ type: 'nextWave' }),
        pause: () => this.togglePause(),
        speed: () => this.cycleSpeed(),
        mute: () => this.toggleMute(),
        stance: (which) => this.setRally(which === 'defend' ? DEFEND_X : FIELD.rallyX),
      });
      this.hud.speedText.setText(`x${this.speed}`);
      this.hud.muteText.setText(loadSave().muted ? 'OFF' : 'ON');
      this.bindKeys();
      platform.gameplayStart();
      const firstUnit = UNIT_ORDER.find((u) => this.world.stage.units.includes(u)) ?? 'sword';
      if (this.world.stage.tutorial && !this.config.autoplay && !loadSave().tutorialDone) {
        this.tutorial = new Tutorial(this, this.world, this.hud.cardPosition(firstUnit));
      }
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onFieldClick(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.trees.pointerUp();
      if (this.draggingFlag) {
        this.draggingFlag = false;
        this.setRally(p.worldX);
      }
    });
    this.rallyFlag = this.add.graphics().setDepth(DEPTH.actors + LANE.top - 30);
    if (this.config.debug && !this.isAttract) attachDebugPanel(this);
    this.events.once('shutdown', () => document.getElementById('debug-panel')?.remove());
  }

  // ---- 背景・建物 ----

  private buildScenery(): void {
    const bg = this.textures.exists(this.world.stage.background) ? this.world.stage.background : 'bg_stage1';
    this.add.image(0, 0, bg).setOrigin(0, 0).setScale(S).setDepth(DEPTH.sky);
    // 雲(地域ごとに色を変える)
    const region = this.world.stage.region;
    const regionCloud = region === 2 ? 'cloud_dusk' : region === 3 ? 'cloud_storm' : null;
    const cloudKeys =
      regionCloud && this.textures.exists(regionCloud)
        ? [regionCloud, regionCloud, regionCloud, regionCloud, regionCloud]
        : ['cloud_0', 'cloud_1', 'cloud_2', 'cloud_0', 'cloud_blight'];
    const cloudPos: [number, number][] = [
      [120, 60],
      [520, 120],
      [760, 50],
      [330, 180],
      [1040, 90],
    ];
    cloudKeys.forEach((key, i) => {
      const c = this.add.image(cloudPos[i][0], cloudPos[i][1], key).setScale(S * (0.9 + (i % 3) * 0.15)).setDepth(DEPTH.background);
      c.setData('speed', 4 + (i % 3) * 3);
      this.clouds.push(c);
    });

    // 穢れの砦と門
    this.add.image(1030, 588, 'citadel').setOrigin(0, 410 / 420).setScale(S).setDepth(DEPTH.buildings);
    this.portalGlow = this.add.image(1158, 520, 'flash').setScale(S * 2.4, S * 2.8).setDepth(DEPTH.buildings + 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xd060ff).setAlpha(0.5);
    this.portal = this.add.image(1158, 522, 'portal_swirl').setScale(S * 1.1).setDepth(DEPTH.buildings + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85);

    // 味方の城と弓兵
    for (const [x, y] of [
      [96, 416],
      [192, 398],
    ]) {
      const gfx = this.add.graphics().setDepth(DEPTH.buildings - 1).setScale(1.15);
      gfx.setPosition(x, y);
      this.castleArchers.push({ gfx, x, y, attackAt: -10 });
    }
    this.castleImg = this.add.image(-30, 576, 'castle').setOrigin(0, 330 / 340).setScale(S).setDepth(DEPTH.buildings);
    this.castleCracks = this.add.graphics().setDepth(DEPTH.buildings + 1);
    this.flag = this.add.graphics().setDepth(DEPTH.buildings + 1);

    // タワーの土台
    TOWER_SLOTS.forEach((x, slot) => {
      const base = this.add.image(x, TOWER_BASE_Y + 8, 'tower_slot').setScale(S).setDepth(DEPTH.actors + TOWER_BASE_Y - 20);
      if (!this.isAttract) {
        base.setInteractive({ useHandCursor: true });
        base.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          if (this.targeting) return;
          e?.stopPropagation?.();
          this.openBuildMenu(slot);
        });
        base.on('pointerover', () => !this.world.towers[slot] && base.setTint(0xfff2a0));
        base.on('pointerout', () => base.clearTint());
      }
      this.towerViews.push({ slot, base, tower: null, archer: null, barrel: null, attackAt: -10 });
    });
  }

  // ---- 操作 ----

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    const units: UnitId[] = UNIT_ORDER.filter((u) => this.world.stage.units.includes(u));
    units.forEach((unit, i) => kb.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR'][i]}`, () => this.trySpawn(unit)));
    kb.on('keydown-Q', () => this.tryAbility('heal'));
    kb.on('keydown-W', () => this.tryAbility('meteor'));
    kb.on('keydown-SPACE', () => this.world.command({ type: 'nextWave' }));
    kb.on('keydown-A', () => this.setRally(DEFEND_X));
    kb.on('keydown-D', () => this.setRally(FIELD.rallyX));
    // Esc は提出先(CrazyGames)の決まりで使わない。取り消しは右クリック、一時停止は P。
    kb.on('keydown-P', () => {
      if (this.targeting) this.cancelTargeting();
      else if (this.buildMenu) this.closeBuildMenu();
      else this.togglePause();
    });
    kb.on('keydown-F', () => this.cycleSpeed());
  }

  private trySpawn(unit: UnitId): void {
    sfx.unlock();
    if (this.paused || this.world.ended) return;
    const w = this.world;
    const def = UNITS[unit];
    if (w.canSpawn(unit)) {
      w.command({ type: 'spawn', unit });
      return;
    }
    if (w.unitCooldowns[unit] > 0) return;
    const L = t();
    const pos = this.hud?.cardPosition(unit) ?? { x: 400, y: 560 };
    const msg = w.gold < def.cost.gold ? L.needGold : w.mana < def.cost.mana ? L.needMana : L.tooMany;
    this.fx.floatText(pos.x, pos.y, msg, '#ff9a8a', 15);
    this.hud?.shakeCard(unit);
    sfx.play('error');
  }

  private tryAbility(id: AbilityId): void {
    sfx.unlock();
    if (this.paused || this.world.ended) return;
    if (this.targeting === id) {
      this.cancelTargeting();
      return;
    }
    if (!this.world.canUseAbility(id)) {
      if (this.world.abilityCooldowns[id] <= 0) {
        this.fx.floatText(id === 'heal' ? 951 : 1041, 590, t().needMana, '#ff9a8a', 15);
        sfx.play('error');
      }
      return;
    }
    if (id === 'heal') {
      this.world.command({ type: 'ability', ability: 'heal' });
      return;
    }
    this.targeting = id;
    this.hud?.setAbilityActive(id, true);
    this.reticle.setVisible(true);
    this.hint = label(this, 640, 90, t().pickTarget, { size: 22, color: '#ffe0b0' }).setDepth(DEPTH.banner);
    this.drawReticle(this.input.activePointer.worldX || FIELD.rallyX);
  }

  private cancelTargeting(): void {
    if (this.targeting) this.hud?.setAbilityActive(this.targeting, false);
    this.targeting = null;
    this.reticle.setVisible(false);
    this.hint?.destroy();
    this.hint = null;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.draggingFlag) {
      this.flagPreviewX = Phaser.Math.Clamp(p.worldX, RALLY_MIN, FIELD.rallyX);
      return;
    }
    if (this.targeting) this.drawReticle(p.worldX);
    else if (!this.paused && p.worldY < HUD_TOP) this.trees.pointerMove(p.worldX, p.worldY);
  }

  private drawReticle(x: number): void {
    const g = this.reticle;
    const cx = Phaser.Math.Clamp(x, FIELD.castleX, FIELD.portalX);
    const cy = groundY(0.5);
    g.clear();
    g.fillStyle(0xff4020, 0.16);
    g.fillEllipse(cx, cy, METEOR_RADIUS * 2, METEOR_RADIUS * 0.7);
    g.lineStyle(3, 0xff6a30, 0.9);
    g.strokeEllipse(cx, cy, METEOR_RADIUS * 2, METEOR_RADIUS * 0.7);
    const pulse = 0.4 + Math.sin(this.clock * 8) * 0.15;
    g.lineStyle(2, 0xffd0a0, 0.8);
    g.strokeEllipse(cx, cy, METEOR_RADIUS * 2 * pulse, METEOR_RADIUS * 0.7 * pulse);
    g.lineBetween(cx - 12, cy, cx + 12, cy);
    g.lineBetween(cx, cy - 6, cx, cy + 6);
  }

  private onFieldClick(p: Phaser.Input.Pointer): void {
    sfx.unlock();
    if (this.isAttract || this.paused) return;
    if (p.rightButtonDown() && this.targeting) {
      this.cancelTargeting();
      return;
    }
    if (this.targeting && p.worldY < HUD_TOP) {
      this.world.command({ type: 'ability', ability: this.targeting, x: p.worldX });
      this.cancelTargeting();
      return;
    }
    if (this.buildMenu) {
      this.closeBuildMenu();
      return;
    }
    if (p.worldY < HUD_TOP && this.hitFlag(p.worldX, p.worldY)) {
      this.draggingFlag = true;
      this.flagPreviewX = this.world.rallyX;
      return;
    }
    if (p.worldY < HUD_TOP) this.trees.pointerDown(p.worldX, p.worldY);
  }

  // ---- 旗(兵が進んで止まる位置) ----

  private hitFlag(x: number, y: number): boolean {
    return Math.abs(x - this.world.rallyX) < 34 && y > FLAG_TOP - 10 && y < LANE.top + 10;
  }

  private setRally(x: number): void {
    if (this.world.ended || this.isAttract) return;
    this.world.command({ type: 'rally', x });
    sfx.play('click');
  }

  private drawRallyFlag(): void {
    const g = this.rallyFlag;
    g.clear();
    if (this.isAttract) return;
    const x = this.draggingFlag ? this.flagPreviewX : this.world.rallyX;
    const base = LANE.top - 6;
    if (this.draggingFlag) {
      g.lineStyle(3, 0xffffff, 0.5);
      for (let y = LANE.top; y < LANE.bottom; y += 14) g.lineBetween(x, y, x, y + 7);
    }
    // 竿
    g.lineStyle(5, INK_HEX, 1);
    g.lineBetween(x, base, x, FLAG_TOP);
    g.lineStyle(3, 0xc89a5a, 1);
    g.lineBetween(x, base, x, FLAG_TOP);
    // はためく旗
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      pts.push({ x: x + 2 + k * 34, y: FLAG_TOP + 2 + Math.sin(this.clock * 7 - k * 4) * 2.5 * k });
    }
    const bottom = pts.map((p) => ({ x: p.x, y: p.y + 22 - (p.x - x) * 0.1 })).reverse();
    g.fillStyle(0x3f7fe0, 1);
    g.lineStyle(2.5, INK_HEX, 1);
    g.fillPoints([...pts, ...bottom], true);
    g.strokePoints([...pts, ...bottom], true);
    g.fillStyle(0xffcc33, 1);
    g.fillCircle(pts[3].x, pts[3].y + 10, 4);
    g.fillStyle(0xffcc33, 1);
    g.fillCircle(x, FLAG_TOP - 3, 4);
    // 掴める印
    const pulse = 0.5 + Math.sin(this.clock * 4) * 0.25;
    g.lineStyle(2, 0xffffff, this.draggingFlag ? 0.9 : pulse * 0.6);
    g.strokeEllipse(x, base + 4, 40, 12);
  }

  private openBuildMenu(slot: number): void {
    if (this.world.towers[slot] || this.world.ended) return;
    this.closeBuildMenu();
    sfx.play('click');
    const x = TOWER_SLOTS[slot];
    const menu = this.add.container(x, TOWER_BASE_Y - 70).setDepth(DEPTH.hud + 20);
    const bg = this.add.graphics();
    bg.fillStyle(0x232a3c, 0.95);
    bg.lineStyle(3, INK_HEX, 1);
    bg.fillRoundedRect(-118, -62, 236, 112, 14);
    bg.strokeRoundedRect(-118, -62, 236, 112, 14);
    bg.fillStyle(0x232a3c, 0.95);
    bg.fillTriangle(-10, 49, 10, 49, 0, 62);
    menu.add(bg);
    TOWER_ORDER.forEach((id, i) => {
      const def = TOWERS[id];
      const ox = i === 0 ? -58 : 58;
      const icon = this.add.image(ox, -22, `tower_${id}`).setScale(S * 0.45);
      const name = label(this, ox, 14, t().towers[id], { size: 14 });
      const cost = label(this, ox + 8, 34, `${def.cost.gold}`, { size: 15, color: '#ffe28a', stroke: 3 });
      const coin = this.add.image(ox - 22, 34, 'coin').setScale(S * 0.7);
      const hit = this.add.rectangle(ox, -6, 108, 100, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => hit.setFillStyle(0xffffff, 0.08));
      hit.on('pointerout', () => hit.setFillStyle(0xffffff, 0.001));
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e?.stopPropagation?.();
        this.tryBuild(slot, id);
      });
      const affordable = this.world.gold >= def.cost.gold;
      cost.setColor(affordable ? '#ffe28a' : '#ff8a7a');
      menu.add([hit, icon, name, cost, coin]);
    });
    menu.setScale(0.6);
    this.tweens.add({ targets: menu, scale: 1, duration: 140, ease: 'Back.Out' });
    this.buildMenu = menu;
  }

  private closeBuildMenu(): void {
    this.buildMenu?.destroy();
    this.buildMenu = null;
  }

  private tryBuild(slot: number, tower: TowerId): void {
    if (this.world.gold < TOWERS[tower].cost.gold) {
      sfx.play('error');
      this.fx.floatText(TOWER_SLOTS[slot], TOWER_BASE_Y - 140, t().needGold, '#ff9a8a', 15);
      return;
    }
    this.world.command({ type: 'build', slot, tower });
    this.closeBuildMenu();
  }

  togglePause(): void {
    if (this.world.ended || this.isAttract) return;
    this.paused = !this.paused;
    if (this.paused) {
      platform.gameplayStop();
      this.closeBuildMenu();
      this.cancelTargeting();
      this.showPauseOverlay();
    } else {
      platform.gameplayStart();
      this.overlay?.destroy();
      this.overlay = null;
    }
  }

  private cycleSpeed(): void {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1;
    this.hud?.speedText.setText(`x${this.speed}`);
  }

  private toggleMute(): void {
    const data = updateSave((d) => {
      d.muted = !d.muted;
    });
    sfx.setMuted(data.muted);
    this.hud?.muteText.setText(data.muted ? 'OFF' : 'ON');
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.hud?.speedText.setText(`x${speed}`);
  }

  // ---- 毎フレーム ----

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.clock += dt;
    this.fx.update(dt);
    if (!this.paused) {
      if (this.fx.hitstop > 0) {
        // 一瞬止める
      } else if (!this.world.ended) {
        this.accumulator += dt * this.speed;
        let steps = 0;
        while (this.accumulator >= DT && steps < 40) {
          this.bot?.tick(this.world, DT);
          this.world.step();
          this.handleEvents(this.world.events);
          this.accumulator -= DT;
          steps++;
        }
      }
    }
    const animDt = this.paused ? 0 : dt * (this.fx.hitstop > 0 ? 0.05 : Math.min(this.speed, 2));
    this.syncFighters(animDt);
    this.trees.update(animDt);
    this.tutorial?.update(dt);
    this.syncProjectiles();
    this.animateScenery(dt, animDt);
    this.hud?.update(dt);
    if (this.targeting) this.drawReticle(this.input.activePointer.worldX);
  }

  private handleEvents(events: SimEvent[]): void {
    const L = t();
    for (const e of events) {
      this.tutorial?.onEvent(e);
      if (this.trees.handleEvent(e)) continue;
      switch (e.t) {
        case 'spawn': {
          const f = this.world.getFighter(e.id);
          if (f) {
            this.createView(f);
            if (e.side === 'ally') {
              this.fx.dustPuff(f.x, groundY(f.row), 3);
              sfx.play('spawn', 0.6);
            } else {
              this.tweens.add({ targets: this.portalGlow, alpha: 0.9, duration: 80, yoyo: true });
            }
          }
          break;
        }
        case 'attackStart': {
          const v = this.views.get(e.id);
          if (v) {
            v.attackAt = this.clock;
            v.attackLength = Math.max(0.18, v.fighter.def.windup / ATTACK_STRIKE);
          }
          break;
        }
        case 'hit': {
          const v = this.views.get(e.id);
          const f = v?.fighter;
          const y = f ? groundY(f.row) - (f.def.flying ? FLY_Y : ENEMY_HIT_HEIGHT) : 500;
          if (v) v.flash = 1;
          const top = v ? (v.enemy ? Math.min(v.enemy.height * ENEMY_SCALE, 120) : 62 * ALLY_SCALE) : 40;
          this.fx.damageNumber(e.x, (f ? groundY(f.row) : 520) - top - 8, e.amount, e.crit, e.magic);
          this.fx.hitSpark(e.x + (f?.side === 'enemy' ? -6 : 6), y, e.crit ? 8 : 3);
          if (e.crit) {
            this.fx.hitstop = Math.max(this.fx.hitstop, 0.05);
            this.fx.shake(3);
          }
          if (f?.side === 'enemy' && (e.kind === 'melee' || e.kind === 'arrow')) this.fx.gooSplash(e.x, y, 3);
          if (e.kind === 'bolt') this.fx.magicBurst(e.x, y, 6);
          if (e.kind === 'melee' || e.kind === 'slam') sfx.play(f?.side === 'enemy' ? 'slash' : 'hit', 0.8);
          else sfx.play('hit', 0.5);
          break;
        }
        case 'death':
          this.onDeath(e.id, e.side, e.x, e.bounty);
          break;
        case 'shoot': {
          const p = this.world.projectiles.find((pp) => pp.id === e.projectileId);
          if (p) sfx.play(p.kind === 'bolt' ? 'bolt' : p.kind === 'cannon' ? 'explode' : 'arrow', p.kind === 'cannon' ? 0.4 : 0.5);
          break;
        }
        case 'explode': {
          const y = groundY(Math.max(0, Math.min(1, e.row)));
          if (e.kind === 'charge') {
            this.fx.hitSpark(e.x, y - 30, 10);
            this.fx.dustPuff(e.x, y, 5);
            this.fx.shake(4);
            sfx.play('hit');
            break;
          }
          if (e.kind === 'slam') {
            this.fx.dustPuff(e.x, y, 10);
            this.fx.shake(9);
            this.fx.hitstop = 0.08;
            sfx.play('explode', 0.8);
            break;
          }
          const big = e.kind === 'meteor';
          this.fx.explosion(e.x, e.kind === 'meteor' ? groundY(0.5) : y, e.radius, big);
          if (big) this.fx.hitstop = 0.09;
          sfx.play(big ? 'bigExplode' : 'explode');
          break;
        }
        case 'castleHit':
          this.fx.hitSpark(FIELD.castleX - 10, 470 + Math.random() * 40, 5);
          this.fx.shake(2.5);
          sfx.play('castleHit', 0.6);
          this.updateCastleDamage();
          break;
        case 'castleShot': {
          const archer = this.castleArchers[this.castleArcherTurn++ % this.castleArchers.length];
          archer.attackAt = this.clock;
          break;
        }
        case 'towerShot': {
          const tv = this.towerViews[e.slot];
          tv.attackAt = this.clock;
          if (tv.barrel) {
            this.fx.hitSpark(tv.barrel.x + Math.cos(tv.barrel.rotation) * 24, tv.barrel.y + Math.sin(tv.barrel.rotation) * 24, 6);
            this.fx.dustPuff(tv.barrel.x + Math.cos(tv.barrel.rotation) * 26, tv.barrel.y + Math.sin(tv.barrel.rotation) * 26, 2);
            this.fx.shake(1.5);
          }
          break;
        }
        case 'towerBuilt':
          this.buildTowerView(e.slot);
          sfx.play('build');
          break;
        case 'heal':
          for (const v of this.views.values()) {
            if (v.fighter.side === 'ally' && v.fighter.alive) this.fx.healAt(v.fighter.x, groundY(v.fighter.row) - 30, 3);
          }
          this.fx.healAt(110, 470, 10);
          if (e.castleAmount > 0) this.fx.floatText(150, 400, `+${e.castleAmount}`, '#7cff70', 22);
          sfx.play('heal');
          break;
        case 'meteorCast':
          this.dropMeteor(e.x);
          sfx.play('meteor');
          break;
        case 'summon': {
          const v = this.views.get(e.id);
          if (v) {
            this.fx.gooSplash(v.fighter.x - 50, groundY(v.fighter.row) - 60, 18);
            sfx.play('squish', 1);
          }
          break;
        }
        case 'knockback': {
          const f = this.world.getFighter(e.id);
          if (f) this.fx.dustPuff(f.x, groundY(f.row), 2);
          break;
        }
        case 'waveStart':
          this.banner(e.boss ? L.bossBanner : `${L.waveBanner} ${e.wave}`, e.boss ? '#ff5a6a' : '#ffffff', e.boss);
          sfx.play(e.boss ? 'boss' : 'horn');
          if (e.boss) this.fx.shake(6);
          break;
        case 'waveClear':
          if (e.wave < this.world.totalWaves) this.banner(L.waveClear, '#9fffa0', false, true);
          break;
        case 'earlyBonus':
          this.fx.floatText(776, 590, `${L.bonus} +${e.gold} G`, '#ffe28a', 16);
          sfx.play('coin');
          break;
        case 'victory':
        case 'defeat':
          this.time.delayedCall(this.isAttract ? 2500 : 1400, () => this.onEnd(e.t === 'victory'));
          if (e.t === 'victory') {
            sfx.play('victory');
            platform.happyTime();
          } else {
            sfx.play('defeat');
            this.fx.shake(10);
            this.collapseCastle();
          }
          break;
      }
    }
  }

  private createView(f: Fighter): void {
    const root = this.add.container(f.x, groundY(f.row));
    const hpBar = this.add.graphics();
    let gfx: Phaser.GameObjects.Graphics | null = null;
    let enemy: EnemyView | null = null;
    if (f.side === 'ally') {
      const shadow = this.add.image(0, 0, 'shadow').setScale(S * 0.7, S * 0.9);
      gfx = this.add.graphics().setScale(ALLY_SCALE);
      root.add([shadow, gfx]);
    } else {
      enemy = createEnemyView(this, f.def.id as EnemyId);
      root.add(enemy.root);
      if ('boss' in f.def && f.def.boss) {
        root.setScale(0.1);
        this.tweens.add({ targets: root, scale: 0.85, duration: 900, ease: 'Back.Out' });
      } else {
        root.setScale(0.3);
        this.tweens.add({ targets: root, scale: ENEMY_SCALE, duration: 260, ease: 'Back.Out' });
      }
    }
    root.add(hpBar);
    this.views.set(f.id, {
      id: f.id,
      fighter: f,
      root,
      gfx,
      enemy,
      hpBar,
      kind: f.def.id as StickKind | EnemyId,
      walk: Math.random() * Math.PI * 2,
      attackAt: -10,
      attackLength: 0.3,
      flash: 0,
      time: Math.random() * 10,
      lastX: f.x,
      hpShown: 1,
      stepTimer: 0,
    });
  }

  private onDeath(id: number, side: 'ally' | 'enemy', x: number, bounty: number): void {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    const y = groundY(v.fighter.row);
    v.hpBar.clear();
    if (side === 'ally') {
      if (v.kind === 'bomber') {
        v.root.destroy();
        return;
      }
      // 吹き飛んで消える
      const g = v.gfx!;
      const dir = -1;
      const state = { t: 0 };
      this.tweens.add({
        targets: state,
        t: 1,
        duration: 850,
        onUpdate: () => {
          g.clear();
          drawRagdoll(g, v.kind as StickKind, state.t);
          const k = state.t;
          v.root.x = x + dir * 70 * k;
          v.root.y = y - Math.sin(k * Math.PI) * 50;
          v.root.rotation = dir * k * 5.5;
          v.root.alpha = 1 - Math.max(0, k - 0.6) / 0.4;
        },
        onComplete: () => v.root.destroy(),
      });
      this.fx.hitSpark(x, y - 30, 6);
      this.fx.dustPuff(x, y, 2);
      return;
    }
    // 敵: つぶれて弾ける
    const boss = 'boss' in v.fighter.def && v.fighter.def.boss;
    if (boss) {
      for (let i = 0; i < 6; i++) {
        this.time.delayedCall(i * 220, () => {
          this.fx.explosion(x + Phaser.Math.Between(-90, 90), y - Phaser.Math.Between(0, 160), 70, i === 5);
          sfx.play(i === 5 ? 'bigExplode' : 'explode');
        });
      }
      this.tweens.add({ targets: v.root, scaleY: 0.05, scaleX: 1.3, alpha: 0, delay: 900, duration: 600, onComplete: () => v.root.destroy() });
      this.fx.hitstop = 0.15;
    } else {
      const flying = v.fighter.def.flying;
      this.fx.gooSplash(x, y - (flying ? FLY_Y : 24), flying ? 6 : 12);
      this.fx.dustPuff(x, y, 3);
      this.tweens.add({
        targets: v.root,
        scaleY: flying ? 1.4 : 0.15,
        scaleX: flying ? 0.2 : 1.5,
        alpha: 0,
        duration: 260,
        ease: 'Cubic.In',
        onComplete: () => v.root.destroy(),
      });
      sfx.play('squish', 0.8);
    }
    if (bounty > 0 && this.hud) {
      const coins = Math.min(5, Math.ceil(bounty / 8));
      for (let i = 0; i < coins; i++) {
        this.time.delayedCall(i * 60, () =>
          this.fx.coinFly(x, y - 30, this.hud!.goldIcon.x, this.hud!.goldIcon.y, () => {
            sfx.play('coin', 0.5);
            this.hud?.pulseGold();
          }),
        );
      }
      this.fx.floatText(x, y - 70, `+${bounty}`, '#ffe28a', boss ? 30 : 16);
    }
  }

  private syncFighters(dt: number): void {
    for (const v of this.views.values()) {
      const f = v.fighter;
      if (!f.alive) continue;
      v.time += dt;
      const moved = Math.abs(f.x - v.lastX);
      const moving = f.state === 'walk' && moved > 0.01;
      v.lastX = f.x;
      if (moving) v.walk += dt * (f.def.speed / 6.5);
      v.flash = Math.max(0, v.flash - dt * 7);
      const elapsed = this.clock - v.attackAt;
      const attack = elapsed >= 0 && elapsed < v.attackLength ? elapsed / v.attackLength : -1;
      v.root.x = f.x;
      v.root.y = groundY(f.row);
      v.root.setDepth(DEPTH.actors + v.root.y);
      if (v.gfx) {
        v.gfx.clear();
        drawStickman(v.gfx, { kind: v.kind as StickKind, walk: v.walk, moving, attack, flash: v.flash, time: v.time, facing: f.facing });
      } else if (v.enemy) {
        v.enemy.update({ time: v.time, moving, attack, flash: v.flash });
      }
      if (moving) {
        v.stepTimer -= dt;
        if (v.stepTimer <= 0) {
          v.stepTimer = 0.35 + Math.random() * 0.3;
          if (Math.random() < 0.35 && !f.def.flying) this.fx.dustPuff(f.x - 4, v.root.y, 1);
        }
      }
      // 体力の棒(減っている時だけ)
      const ratio = f.hp / f.maxHp;
      v.hpShown += (ratio - v.hpShown) * Math.min(1, dt * 8);
      v.hpBar.clear();
      const isBoss = 'boss' in f.def && f.def.boss;
      if (ratio < 1 && !isBoss) {
        const h = v.enemy ? v.enemy.height : 70 * ALLY_SCALE;
        const w = v.enemy ? Math.min(46, 22 + f.maxHp / 12) : 26;
        const yy = -h - 6;
        v.hpBar.fillStyle(0x1c1726, 0.85);
        v.hpBar.fillRect(-w / 2 - 1.5, yy - 1.5, w + 3, 6);
        v.hpBar.fillStyle(0xffffff, 0.8);
        v.hpBar.fillRect(-w / 2, yy, w * v.hpShown, 3);
        v.hpBar.fillStyle(f.side === 'ally' ? 0x57d65a : 0xe84a4a, 1);
        v.hpBar.fillRect(-w / 2, yy, w * ratio, 3);
      }
    }
  }

  private projectileY(p: World['projectiles'][number]): { y: number; startY: number; endY: number; t: number } {
    let startY: number;
    if (p.source === 'castle') startY = 382;
    else if (p.source === 'tree') startY = groundY(Math.max(0, p.startRow)) - 84;
    else if (p.source === 'tower') startY = TOWER_BASE_Y - (p.kind === 'cannon' ? 52 : 98);
    else {
      const flyingShooter = p.side === 'enemy' && p.kind === 'spit';
      startY = groundY(Math.max(0, p.startRow)) - (flyingShooter ? FLY_Y : 46);
    }
    const endY = p.targetId === CASTLE_TARGET ? 470 : groundY(p.targetRow) - (p.targetFlying ? FLY_Y : 34);
    const total = Math.max(1, Math.abs(p.targetX - p.startX));
    const t = Phaser.Math.Clamp(Math.abs(p.x - p.startX) / total, 0, 1);
    const arc = p.kind === 'cannon' ? Math.min(140, total * 0.35) : p.kind === 'arrow' ? Math.min(70, total * 0.16) : p.kind === 'spit' ? total * 0.12 : 4;
    return { y: startY + (endY - startY) * t - Math.sin(t * Math.PI) * arc, startY, endY, t };
  }

  private syncProjectiles(): void {
    const alive = new Set<number>();
    for (const p of this.world.projectiles) {
      alive.add(p.id);
      let view = this.projectileViews.get(p.id);
      const { y } = this.projectileY(p);
      if (!view) {
        const key = p.kind === 'bolt' ? 'bolt' : p.kind === 'spit' ? 'spit' : p.kind === 'cannon' ? 'cannonball' : 'arrow';
        const sprite = this.add.image(p.x, y, key).setScale(S).setDepth(DEPTH.projectiles);
        if (p.kind === 'bolt' || p.kind === 'spit') sprite.setBlendMode(Phaser.BlendModes.ADD);
        view = { sprite, kind: p.kind, side: p.side, lastX: p.x, lastY: y };
        this.projectileViews.set(p.id, view);
      }
      const dx = p.x - view.lastX;
      const dy = y - view.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 0.01 && p.kind === 'arrow') view.sprite.rotation = Math.atan2(dy, dx);
      if (p.kind === 'cannon') view.sprite.rotation += 0.2;
      view.sprite.setPosition(p.x, y);
      if (p.kind === 'bolt') this.fx.magicTrail(p.x, y);
      view.lastX = p.x;
      view.lastY = y;
    }
    for (const [id, view] of this.projectileViews) {
      if (alive.has(id)) continue;
      if (view.kind === 'spit') this.fx.gooSplash(view.lastX, view.lastY, 4);
      if (view.kind === 'arrow') this.fx.hitSpark(view.lastX, view.lastY, 2);
      view.sprite.destroy();
      this.projectileViews.delete(id);
    }
  }

  private dropMeteor(x: number): void {
    const endY = groundY(0.5);
    const meteor = this.add.image(x + 260, -80, 'meteor').setScale(S * 1.4).setDepth(DEPTH.effects + 3);
    const mark = this.add.graphics().setDepth(DEPTH.scorch + 1);
    mark.lineStyle(3, 0xff5a20, 0.8);
    mark.strokeEllipse(x, endY, METEOR_RADIUS * 2, METEOR_RADIUS * 0.7);
    this.tweens.add({
      targets: meteor,
      x,
      y: endY - 20,
      rotation: 4,
      scale: S * 2,
      duration: METEOR_DELAY * 1000 * 0.95,
      ease: 'Quad.In',
      onUpdate: () => this.fx.fireTrail(meteor.x, meteor.y, 3),
      onComplete: () => {
        meteor.destroy();
        mark.destroy();
      },
    });
  }

  private buildTowerView(slot: number): void {
    const tv = this.towerViews[slot];
    const tower = this.world.towers[slot];
    if (!tower) return;
    const x = TOWER_SLOTS[slot];
    const depth = DEPTH.actors + TOWER_BASE_Y - 10;
    const img = this.add.image(x, TOWER_BASE_Y + 14, `tower_${tower.def.id}`).setOrigin(0.5, 1).setScale(S).setDepth(depth);
    img.setScale(S * 0.2, S * 1.6);
    this.tweens.add({ targets: img, scaleX: S, scaleY: S, duration: 380, ease: 'Elastic.Out' });
    tv.tower = img;
    this.fx.dustPuff(x, TOWER_BASE_Y + 10, 8);
    if (tower.def.id === 'arrowTower') {
      tv.archer = this.add.graphics().setDepth(depth - 1).setPosition(x - 2, TOWER_BASE_Y - 80).setScale(1.1);
    } else {
      tv.barrel = this.add.image(x, TOWER_BASE_Y - 52, 'cannon_barrel').setOrigin(14 / 56, 0.5).setScale(S).setDepth(depth + 1);
    }
  }

  private animateScenery(dt: number, animDt: number): void {
    this.drawRallyFlag();
    this.animateCastleDamage(dt);
    // 雲
    for (const c of this.clouds) {
      c.x += (c.getData('speed') as number) * dt;
      if (c.x > VIEW.width + 140) c.x = -140;
    }
    // 門の渦
    this.portal.rotation -= dt * 1.6;
    this.portalGlow.alpha = Phaser.Math.Clamp(this.portalGlow.alpha + (0.45 + Math.sin(this.clock * 3) * 0.12 - this.portalGlow.alpha) * dt * 4, 0, 1);
    // 砦の火の粉
    this.emberTimer -= dt;
    if (this.emberTimer <= 0) {
      this.emberTimer = 0.08;
      const spots: [number, number][] = [
        [1066, 300],
        [1235, 240],
        [1158, 470],
        [1135, 230],
      ];
      const [ex, ey] = spots[Math.floor(Math.random() * spots.length)];
      this.fx.ember(ex + Math.random() * 20 - 10, ey);
    }
    // 旗
    const g = this.flag;
    g.clear();
    const fx = 18;
    const fy = 250;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      pts.push({ x: fx + k * 38, y: fy + Math.sin(this.clock * 6 - k * 4) * 3 * k });
    }
    const bottom = pts.map((p) => ({ x: p.x, y: p.y + 20 - (p.x - fx) * 0.12 })).reverse();
    g.fillStyle(0x3f7fe0, 1);
    g.lineStyle(2.5, INK_HEX, 1);
    g.fillPoints([...pts, ...bottom], true);
    g.strokePoints([...pts, ...bottom], true);
    g.fillStyle(0xffcc33, 1);
    g.fillCircle(pts[3].x, pts[3].y + 9, 4);
    // 城の弓兵
    for (const a of this.castleArchers) {
      const el = this.clock - a.attackAt;
      a.gfx.clear();
      drawStickman(a.gfx, { kind: 'castleArcher', walk: 0, moving: false, attack: el < 0.45 ? el / 0.45 : -1, flash: 0, time: this.clock, facing: 1 });
    }
    // タワー
    for (const tv of this.towerViews) {
      const tower = this.world.towers[tv.slot];
      if (!tower) continue;
      const el = this.clock - tv.attackAt;
      if (tv.archer) {
        tv.archer.clear();
        drawStickman(tv.archer, { kind: 'castleArcher', walk: 0, moving: false, attack: el < 0.4 ? el / 0.4 : -1, flash: 0, time: this.clock, facing: 1 });
      }
      if (tv.barrel) {
        const target = Math.atan2(groundY(0.5) - 30 - tv.barrel.y, tower.aimX - tv.barrel.x) - 0.35;
        tv.barrel.rotation += (target - tv.barrel.rotation) * Math.min(1, animDt * 6);
        const recoil = el < 0.25 ? (1 - el / 0.25) * 6 : 0;
        tv.barrel.x = TOWER_SLOTS[tv.slot] - Math.cos(tv.barrel.rotation) * recoil;
      }
    }
  }

  // ---- 城の傷 ----

  /** 城の体力に合わせて、ひび・煙・火を出す。 */
  private updateCastleDamage(): void {
    const ratio = this.world.castle.hp / this.world.castle.maxHp;
    const stage = ratio < 0.25 ? 3 : ratio < 0.5 ? 2 : ratio < 0.75 ? 1 : 0;
    if (stage === this.castleStage) return;
    this.castleStage = stage;
    const g = this.castleCracks;
    g.clear();
    const cracks: [number, number][][] = [
      [
        [40, 330],
        [52, 352],
        [44, 372],
        [58, 396],
      ],
      [
        [170, 420],
        [182, 440],
        [176, 458],
        [190, 478],
      ],
      [
        [110, 360],
        [98, 384],
        [112, 402],
      ],
      [
        [20, 430],
        [34, 452],
        [26, 476],
      ],
    ];
    const count = stage === 0 ? 0 : stage === 1 ? 2 : 4;
    for (let i = 0; i < count; i++) {
      g.lineStyle(3.5, INK_HEX, 0.85);
      const pts = cracks[i];
      for (let k = 1; k < pts.length; k++) g.lineBetween(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
    }
    this.castleImg.setTint(stage >= 3 ? 0xc8a8a0 : stage >= 2 ? 0xe0d0c8 : 0xffffff);
  }

  private animateCastleDamage(dt: number): void {
    if (this.castleStage < 2) return;
    this.smokeTimer -= dt;
    if (this.smokeTimer > 0) return;
    this.smokeTimer = this.castleStage >= 3 ? 0.12 : 0.3;
    const spots: [number, number][] = [
      [48, 300],
      [200, 380],
      [120, 400],
    ];
    const [x, y] = spots[Math.floor(Math.random() * spots.length)];
    this.fx.dustPuff(x, y, 1);
    if (this.castleStage >= 3) this.fx.fireTrail(x, y + 10, 1);
  }

  private collapseCastle(): void {
    this.tweens.add({ targets: [this.castleImg, this.castleCracks, this.flag], y: '+=46', angle: -3, duration: 1100, ease: 'Cubic.In' });
    for (let i = 0; i < 8; i++) this.time.delayedCall(i * 120, () => this.fx.dustPuff(30 + Math.random() * 200, 520 + Math.random() * 50, 4));
  }

  // ---- 文字の演出・終わり ----

  private banner(text: string, color: string, boss: boolean, small = false): void {
    // 前の帯が出ている間は、次の帯を少し待たせて重ならないようにする
    const wait = Math.max(0, this.bannerFreeAt - this.clock);
    this.bannerFreeAt = this.clock + wait + (small ? 1.3 : 1.9);
    if (wait > 0) {
      this.time.delayedCall(wait * 1000, () => this.showBanner(text, color, boss, small));
      return;
    }
    this.showBanner(text, color, boss, small);
  }

  private showBanner(text: string, color: string, boss: boolean, small: boolean): void {
    const obj = label(this, VIEW.width / 2, small ? 180 : 230, text, { size: small ? 34 : boss ? 64 : 58, color, stroke: boss ? 12 : 10 }).setDepth(DEPTH.banner);
    obj.setScale(small ? 0.6 : 2.2).setAlpha(0);
    this.tweens.add({ targets: obj, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: obj, alpha: 0, y: obj.y - 30, delay: small ? 900 : 1400, duration: 400, onComplete: () => obj.destroy() });
    if (boss) {
      const vignette = this.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, 0xff0020, 0).setDepth(DEPTH.banner - 1);
      this.tweens.add({ targets: vignette, fillAlpha: 0.18, duration: 220, yoyo: true, repeat: 3, onComplete: () => vignette.destroy() });
    }
  }

  private onEnd(victory: boolean): void {
    if (this.resultShown) return;
    this.resultShown = true;
    if (this.isAttract) {
      this.scene.restart({ ...this.config, seed: undefined });
      return;
    }
    platform.gameplayStop();
    const ratio = this.world.castle.hp / this.world.castle.maxHp;
    const stars = victory ? (ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1) : 0;
    const next = victory ? nextStage(this.world.stage.id) : undefined;
    const finale = victory && !next;
    if (victory) {
      updateSave((d) => {
        d.bestStars[this.world.stage.id] = Math.max(d.bestStars[this.world.stage.id] ?? 0, stars);
      });
    }
    const L = t();
    const root = this.add.container(0, 0).setDepth(DEPTH.overlay);
    const dim = this.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, 0x0a0812, 0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 300 });
    const panel = this.add.image(VIEW.width / 2, 340, 'panel').setScale(S);
    const title = label(this, VIEW.width / 2, 210, finale ? L.finale : victory ? L.victory : L.defeat, {
      size: finale ? 46 : 60,
      color: victory ? '#ffd640' : '#ff6a6a',
      stroke: 12,
    });
    root.add([dim, panel, title]);
    if (victory) {
      for (let i = 0; i < 3; i++) {
        const star = this.add.image(VIEW.width / 2 + (i - 1) * 84, 290 - (i === 1 ? 12 : 0), i < stars ? 'star' : 'star_empty').setScale(0);
        root.add(star);
        this.tweens.add({ targets: star, scale: S * (i === 1 ? 1.25 : 1.05), delay: 300 + i * 220, duration: 300, ease: 'Back.Out', onStart: () => i < stars && sfx.play('coin') });
      }
    }
    const lines = victory
      ? `${L.kills}: ${this.world.stats.kills}\n${L.deployed}: ${this.world.stats.unitsDeployed}`
      : `${L.reached}: ${this.world.wavesStarted} / ${this.world.totalWaves}\n${L.kills}: ${this.world.stats.kills}`;
    root.add(label(this, VIEW.width / 2, victory ? 372 : 316, lines, { size: 20, color: '#d8e4ff' }));
    if (!victory) {
      const tip = L.tips[Math.floor(Math.random() * L.tips.length)];
      const tipText = label(this, VIEW.width / 2, 390, `${L.tipTitle}: ${tip}`, { size: 17, color: '#ffe9a8' });
      tipText.setWordWrapWidth(440, true);
      root.add(tipText);
    }
    const retry = () => this.scene.restart({ ...this.config, seed: undefined });
    const buttons = next
      ? [
          button(this, VIEW.width / 2 - 170, 466, 'btn_stone', L.retry, retry, { width: 150, height: 54, size: 20 }),
          button(this, VIEW.width / 2, 466, 'btn_green', L.nextStage, () => this.scene.restart({ ...this.config, stageId: next.id, seed: undefined }), {
            width: 180,
            height: 54,
            size: 20,
          }),
          button(this, VIEW.width / 2 + 170, 466, 'btn_stone', L.map, () => this.goMap(), { width: 150, height: 54, size: 20 }),
        ]
      : [
          button(this, VIEW.width / 2 - 125, 466, victory ? 'btn_stone' : 'btn_green', L.retry, retry, { width: 220, height: 54 }),
          button(this, VIEW.width / 2 + 125, 466, victory ? 'btn_green' : 'btn_stone', L.map, () => this.goMap(), { width: 220, height: 54 }),
        ];
    root.add(buttons.map((b) => b.root));
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 300 });
    this.overlay = root;
  }

  private showPauseOverlay(): void {
    const L = t();
    const root = this.add.container(0, 0).setDepth(DEPTH.overlay);
    const dim = this.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, 0x0a0812, 0.5).setInteractive();
    const panel = this.add.image(VIEW.width / 2, 330, 'panel').setScale(S * 0.8);
    root.add([dim, panel, label(this, VIEW.width / 2, 230, L.paused, { size: 44 })]);
    const items: [string, string, () => void][] = [
      [L.resume, 'btn_green', () => this.togglePause()],
      [L.restart, 'btn_gold', () => this.scene.restart({ ...this.config, seed: undefined })],
      [L.map, 'btn_stone', () => this.goMap()],
    ];
    items.forEach(([text, key, action], i) => root.add(button(this, VIEW.width / 2, 300 + i * 64, key, text, action, { width: 230, height: 54 }).root));
    this.overlay = root;
  }

  private goMap(): void {
    this.scene.start('map', { focus: this.world.stage.id });
  }
}
