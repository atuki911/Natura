import { ENEMY, type EnemyDef, type DamageType } from '../data/enemies.ts';
import { TOWER, type TowerDef, type TowerLine } from '../data/towers.ts';
import { HERO, heroLevelFromXp, type HeroDef } from '../data/heroes.ts';
import { generateWaves, type Mode, type StageDef, type Wave } from '../data/stages.ts';
import type { UpgradeState } from '../data/upgrades.ts';
import { Path } from './path.ts';
import { Rng, dist, type V2 } from './rng.ts';

// ───────────────────────── entities ─────────────────────────
export interface Enemy {
  id: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  path: Path;
  pathIdx: number;
  d: number;
  lane: number;
  x: number;
  y: number;
  dir: number; // facing angle
  alive: boolean;
  blocker: Unit | null;
  atkCd: number;
  slowT: number; slowF: number;
  poisonT: number; poisonDps: number;
  burnT: number; burnDps: number;
  stunT: number;
  freezeT: number;
  shredT: number; shred: number;
  mrDownT: number; mrDown: number;
  auraArmor: number;
  abilCd: number;
  abil2Cd: number;
  abil3Cd: number;
  healCd: number;
  rangedCd: number;
  age: number;
  hitFlash: number;
  attackAnim: number;
  armorMul: number;
  lastHit: number;
}

export type UnitKind = 'soldier' | 'hero' | 'reinf';

export interface Unit {
  id: number;
  kind: UnitKind;
  model: string;
  name: string;
  x: number; y: number;
  dir: number;
  hp: number; maxHp: number;
  armor: number;
  dmg: [number, number];
  rate: number;
  cd: number;
  speed: number;
  target: Enemy | null;
  home: V2;
  tower: Tower | null;
  slot: number;
  dead: boolean;
  respawnT: number;
  lifeT: number;
  regen: number;
  stunT: number;
  maxBlock: number;
  blocking: number;
  moveTo: V2 | null;
  attackAnim: number;
  idleT: number;
  // hero
  hero?: HeroDef;
  level: number;
  xp: number;
  skillCd: number[];
  buffT: number;
  invulnT: number;
  healCd: number;
  whirlCd: number;
  axeCd: number;
  ranged?: { range: number; proj: string; type: DamageType; aoe?: number };
}

export interface Tower {
  id: number;
  def: TowerDef;
  spot: number;
  x: number; y: number;
  cd: number;
  abil: Record<string, number>;
  abilCd: Record<string, number>;
  rally: V2;
  soldiers: Unit[];
  spent: number;
  aim: number;
  fireAnim: number;
  frozenT: number;
  builtT: number;
  kills: number;
  shots: number;
}

export interface Projectile {
  id: number;
  kind: string;
  sx: number; sy: number; sz: number;
  tx: number; ty: number; tz: number;
  x: number; y: number; z: number;
  prevX: number; prevY: number; prevZ: number;
  t: number; dur: number;
  arc: number;
  target: Enemy | null;
  unitTarget: Unit | null;
  dmg: number;
  type: DamageType;
  aoe: number;
  tower: Tower | null;
  fromHero: Unit | null;
  slow?: { f: number; t: number };
  stun?: number;
  flying: boolean;
  homing: boolean;
  extra?: string;
  alive: boolean;
}

export interface Zone { id: number; kind: 'fire' | 'mine'; x: number; y: number; r: number; t: number; dps: number; dmg: number }

export interface Spot { id: number; x: number; y: number }

export type GEvent =
  | { type: 'sfx'; name: string; x?: number; y?: number }
  | { type: 'explode'; x: number; y: number; r: number; kind: string }
  | { type: 'death'; e: Enemy }
  | { type: 'gold'; x: number; y: number; amount: number }
  | { type: 'lifeLost'; amount: number; e: Enemy }
  | { type: 'lightning'; pts: { x: number; y: number; z: number }[]; color?: number }
  | { type: 'hit'; x: number; y: number; z: number; kind: string }
  | { type: 'heal'; x: number; y: number }
  | { type: 'freezeArea'; x: number; y: number; r: number }
  | { type: 'ray'; x: number; y: number; tx: number; ty: number }
  | { type: 'teleport'; x: number; y: number }
  | { type: 'towerFrozen'; tower: Tower }
  | { type: 'spawn'; e: Enemy }
  | { type: 'unitDeath'; u: Unit }
  | { type: 'levelUp'; u: Unit }
  | { type: 'skill'; u: Unit; skill: string }
  | { type: 'whirl'; x: number; y: number }
  | { type: 'shockwave'; x: number; y: number; r: number; color: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'newEnemy'; id: string }
  | { type: 'build'; tower: Tower }
  | { type: 'sell'; x: number; y: number }
  | { type: 'meteorCast'; x: number; y: number }
  | { type: 'end'; won: boolean };

export interface GameConfig {
  stage: StageDef;
  mode: Mode;
  difficulty: number; // 0 casual, 1 normal, 2 veteran
  upgrades: UpgradeState;
  hero: { id: string; xp: number } | null;
  seenEnemies?: Set<string>;
}

const DIFF_HP = [0.7, 1.12, 1.4];

interface PendingSpawn { t: number; enemy: string; path: number }

export const SPELLS = {
  meteor: { name: '卵メテオ', desc: '空から燃える卵を降らせ、範囲の地上の敵に大ダメージ。', baseCd: 75 },
  reinforce: { name: '援軍ひよこ', desc: '指定した場所に、ひよこ兵の援軍を呼ぶ。', baseCd: 10 },
};

// ───────────────────────── game ─────────────────────────
export class Game {
  readonly stage: StageDef;
  readonly mode: Mode;
  readonly diff: number;
  readonly up: UpgradeState;
  readonly rng: Rng;
  readonly paths: Path[];
  spots: Spot[] = [];
  gold: number;
  lives: number;
  readonly maxLives: number;
  time = 0;
  waves: Wave[];
  waveIdx = -1;
  waveCountdown = -1; // -1: waiting for player to call the first wave
  waveCountdownMax = 22;
  pending: PendingSpawn[] = [];
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  hero: Unit | null = null;
  events: GEvent[] = [];
  state: 'ready' | 'playing' | 'won' | 'lost' = 'ready';
  meteorCd = 0;
  reinforceCd = 0;
  nextId = 1;
  seen: Set<string>;
  heroXpGained = 0;
  stats = { kills: 0, goldEarned: 0, leaked: 0 };
  private scheduled: { t: number; fn: () => void }[] = [];
  private tmp = { x: 0, y: 0, dx: 0, dy: 0 };

  constructor(cfg: GameConfig) {
    this.stage = cfg.stage;
    this.mode = cfg.mode;
    this.diff = cfg.difficulty;
    this.up = cfg.upgrades;
    this.rng = new Rng(12345 + cfg.stage.id * 999);
    this.paths = cfg.stage.paths.map((p) => new Path(p));
    this.waves = generateWaves(cfg.stage, cfg.mode);
    this.seen = cfg.seenEnemies ?? new Set();
    this.maxLives = cfg.mode === 'campaign' ? 20 : 1;
    this.lives = this.maxLives;
    this.gold = cfg.mode === 'iron' ? Math.round(cfg.stage.gold * 2.2) : cfg.mode === 'heroic' ? Math.round(cfg.stage.gold * 1.5) : cfg.stage.gold;
    this.spots = computeSpots(this.stage, this.paths);
    if (cfg.hero) this.spawnHero(cfg.hero.id, cfg.hero.xp);
  }

  get spellMeteorMax() { return SPELLS.meteor.baseCd - (this.up.meteor >= 1 ? 10 : 0); }
  get spellReinforceMax() { return SPELLS.reinforce.baseCd; }

  allowedLine(line: TowerLine): boolean {
    return this.mode !== 'iron' || this.stage.iron.includes(line);
  }

  // ───────── upgrades helpers ─────────
  towerCost(def: TowerDef): number {
    let c = def.cost;
    if (def.line === 'mage' && this.up.mage >= 3) c *= 0.9;
    if (def.line === 'artillery' && this.up.artillery >= 4) c *= 0.9;
    return Math.round(c);
  }
  abilityCost(t: Tower, abilId: string): number | null {
    const ab = t.def.abilities?.find((a) => a.id === abilId);
    if (!ab) return null;
    const lv = t.abil[abilId] ?? 0;
    if (lv >= ab.costs.length) return null;
    return ab.costs[lv];
  }
  range(t: Tower): number {
    let r = t.def.range;
    const l = t.def.line;
    if (l === 'archer' && this.up.archer >= 1) r *= 1.1;
    if (l === 'mage' && this.up.mage >= 2) r *= 1.1;
    if (l === 'artillery' && this.up.artillery >= 3) r *= 1.1;
    return r;
  }
  private dmgMul(line: TowerLine): number {
    let m = 1;
    if (line === 'archer' && this.up.archer >= 2) m *= 1.1;
    if (line === 'mage') { if (this.up.mage >= 1) m *= 1.1; if (this.up.mage >= 5) m *= 1.15; }
    if (line === 'artillery' && this.up.artillery >= 2) m *= 1.1;
    return m;
  }
  private rateMul(line: TowerLine): number {
    return line === 'archer' && this.up.archer >= 4 ? 1 / 1.12 : 1;
  }
  sellValue(t: Tower): number { return Math.round(t.spent * 0.6); }

  // ───────── player actions ─────────
  build(spotId: number, towerId: string): boolean {
    const def = TOWER[towerId];
    if (!def || def.tier !== 1 || !this.allowedLine(def.line)) return false;
    if (this.towers.some((t) => t.spot === spotId)) return false;
    const cost = this.towerCost(def);
    if (this.gold < cost) return false;
    const sp = this.spots[spotId];
    this.gold -= cost;
    const t: Tower = {
      id: this.nextId++, def, spot: spotId, x: sp.x, y: sp.y, cd: 0.5, abil: {}, abilCd: {},
      rally: this.defaultRally(sp), soldiers: [], spent: cost, aim: 0, fireAnim: 0, frozenT: 0, builtT: 0, kills: 0, shots: 0,
    };
    this.towers.push(t);
    if (def.soldiers) this.syncSoldiers(t, true);
    this.events.push({ type: 'build', tower: t });
    this.events.push({ type: 'sfx', name: 'build' });
    return true;
  }

  upgrade(t: Tower, toId: string): boolean {
    if (!t.def.next.includes(toId)) return false;
    const def = TOWER[toId];
    const cost = this.towerCost(def);
    if (this.gold < cost) return false;
    this.gold -= cost;
    t.spent += cost;
    t.def = def;
    t.builtT = 0;
    if (def.soldiers) this.syncSoldiers(t, false);
    this.events.push({ type: 'build', tower: t });
    this.events.push({ type: 'sfx', name: 'upgrade' });
    return true;
  }

  buyAbility(t: Tower, abilId: string): boolean {
    const c = this.abilityCost(t, abilId);
    if (c == null || this.gold < c) return false;
    this.gold -= c;
    t.spent += c;
    t.abil[abilId] = (t.abil[abilId] ?? 0) + 1;
    if (t.abilCd[abilId] == null) t.abilCd[abilId] = 2;
    this.events.push({ type: 'sfx', name: 'upgrade' });
    return true;
  }

  sell(t: Tower) {
    this.gold += this.sellValue(t);
    for (const s of t.soldiers) this.removeUnit(s);
    this.towers = this.towers.filter((x) => x !== t);
    this.events.push({ type: 'sell', x: t.x, y: t.y });
    this.events.push({ type: 'sfx', name: 'sell' });
  }

  setRally(t: Tower, p: V2): boolean {
    if (!t.def.soldiers) return false;
    const r = this.range(t) + (this.up.barracks >= 0 ? 0 : 0);
    if (dist(p, t) > r) return false;
    t.rally = { x: p.x, y: p.y };
    for (const s of t.soldiers) {
      s.home = this.formation(t.rally, s.slot, t.soldiers.length);
      if (s.target) { this.releaseBlock(s); s.target = null; }
    }
    this.events.push({ type: 'sfx', name: 'rally' });
    return true;
  }

  moveHero(p: V2) {
    const h = this.hero;
    if (!h || h.dead) return;
    if (h.target) { this.releaseBlock(h); h.target = null; }
    h.moveTo = { x: p.x, y: p.y };
    h.home = { x: p.x, y: p.y };
    this.events.push({ type: 'sfx', name: 'cluck' });
  }

  castMeteor(p: V2): boolean {
    if (this.meteorCd > 0 || this.state === 'won' || this.state === 'lost') return false;
    this.meteorCd = this.spellMeteorMax;
    const n = 3 + (this.up.meteor >= 2 ? 2 : 0) + (this.up.meteor >= 4 ? 2 : 0);
    const dmgMul = this.up.meteor >= 3 ? 1.25 : 1;
    this.events.push({ type: 'meteorCast', x: p.x, y: p.y });
    this.events.push({ type: 'sfx', name: 'meteor' });
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2), r = i === 0 ? 0 : this.rng.range(0.6, 2.6);
      const tx = p.x + Math.cos(a) * r, ty = p.y + Math.sin(a) * r;
      this.schedule(0.15 + i * 0.18, () => {
        this.spawnProj({ kind: 'meteor', sx: tx - 6, sy: ty - 10, sz: 26, tx, ty, tz: 0, dur: 0.9, arc: 0,
          dmg: this.rng.range(40, 80) * dmgMul, type: 'explosive', aoe: 2.1, flying: false, homing: false });
      });
    }
    return true;
  }

  castReinforce(p: V2): boolean {
    if (this.reinforceCd > 0 || this.state === 'won' || this.state === 'lost') return false;
    this.reinforceCd = this.spellReinforceMax;
    const n = this.up.reinforce >= 4 ? 3 : 2;
    const hp = 45 * (this.up.reinforce >= 1 ? 1.4 : 1);
    const dm = this.up.reinforce >= 2 ? 1.4 : 1;
    for (let i = 0; i < n; i++) {
      const home = this.formation(p, i, n);
      const u = this.makeUnit('reinf', 'chick_reinf', '援軍ひよこ', home, hp, [Math.round(2 * dm), Math.round(5 * dm)], 1,
        this.up.reinforce >= 3 ? 0.25 : 0, 2.6);
      u.x = home.x; u.y = home.y;
      u.lifeT = 20 + (this.up.reinforce >= 5 ? 10 : 0);
      this.units.push(u);
    }
    this.events.push({ type: 'shockwave', x: p.x, y: p.y, r: 1.8, color: 0xfff1a8 });
    this.events.push({ type: 'sfx', name: 'reinforce' });
    return true;
  }

  /** call next wave; returns bonus gold */
  callWave(): number {
    if (this.state === 'won' || this.state === 'lost') return 0;
    if (this.waveIdx >= this.waves.length - 1) return 0;
    let bonus = 0;
    if (this.waveIdx >= 0 && this.waveCountdown > 0) {
      bonus = Math.round(this.waveCountdown * 1.6);
      this.gold += bonus;
      this.meteorCd = Math.max(0, this.meteorCd - this.waveCountdown * 0.5);
      this.reinforceCd = Math.max(0, this.reinforceCd - this.waveCountdown * 0.5);
    }
    this.startWave();
    return bonus;
  }

  nextWaveReady(): boolean {
    return this.state !== 'won' && this.state !== 'lost' && this.waveIdx < this.waves.length - 1 &&
      (this.waveIdx === -1 || this.pendingForWave() === 0);
  }
  private pendingForWave() { return this.pending.length; }

  nextWavePreview(): { enemy: string; count: number; path: number }[] {
    const w = this.waves[this.waveIdx + 1];
    if (!w) return [];
    const m = new Map<string, { enemy: string; count: number; path: number }>();
    for (const g of w.groups) {
      const k = g.enemy + ':' + g.path;
      const cur = m.get(k);
      if (cur) cur.count += g.count; else m.set(k, { enemy: g.enemy, count: g.count, path: g.path });
    }
    return [...m.values()];
  }

  private startWave() {
    this.waveIdx++;
    this.state = 'playing';
    this.waveCountdown = -2; // spawning
    const w = this.waves[this.waveIdx];
    for (const g of w.groups) {
      for (let i = 0; i < g.count; i++) this.pending.push({ t: this.time + g.delay + i * g.interval, enemy: g.enemy, path: g.path });
      if (!this.seen.has(g.enemy)) {
        this.seen.add(g.enemy);
        this.events.push({ type: 'newEnemy', id: g.enemy });
      }
    }
    this.pending.sort((a, b) => a.t - b.t);
    this.events.push({ type: 'waveStart', wave: this.waveIdx });
    this.events.push({ type: 'sfx', name: 'horn' });
  }

  // ───────── main update ─────────
  update(dt: number) {
    if (this.state === 'won' || this.state === 'lost') {
      this.updateProjectiles(dt);
      return;
    }
    if (this.state === 'ready') {
      // still allow hero/soldiers to settle
      this.updateUnits(dt);
      return;
    }
    this.time += dt;
    this.meteorCd = Math.max(0, this.meteorCd - dt);
    this.reinforceCd = Math.max(0, this.reinforceCd - dt);

    // scheduled
    if (this.scheduled.length) {
      const due = this.scheduled.filter((s) => s.t <= this.time);
      if (due.length) {
        this.scheduled = this.scheduled.filter((s) => s.t > this.time);
        for (const s of due) s.fn();
      }
    }

    // spawning
    while (this.pending.length && this.pending[0].t <= this.time) {
      const s = this.pending.shift()!;
      this.spawnEnemy(s.enemy, s.path, 0);
    }
    if (this.waveCountdown === -2 && this.pending.length === 0) {
      if (this.waveIdx < this.waves.length - 1) this.waveCountdown = this.waveCountdownMax;
      else this.waveCountdown = -3; // all waves spawned
    }
    if (this.waveCountdown > 0) {
      this.waveCountdown -= dt;
      if (this.waveCountdown <= 0) { this.waveCountdown = 0; this.startWave(); }
    }

    this.computeAuras();
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateUnits(dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);

    if (this.lives <= 0 && this.state === 'playing') {
      this.lives = 0;
      this.state = 'lost';
      this.events.push({ type: 'end', won: false });
      this.events.push({ type: 'sfx', name: 'defeat' });
    } else if (this.waveCountdown === -3 && this.enemies.length === 0 && this.pending.length === 0 && this.state === 'playing') {
      this.state = 'won';
      this.events.push({ type: 'end', won: true });
      this.events.push({ type: 'sfx', name: 'victory' });
    }
  }

  stars(): number {
    if (this.state !== 'won') return 0;
    if (this.mode !== 'campaign') return 1;
    if (this.lives >= 18) return 3;
    if (this.lives >= 6) return 2;
    return 1;
  }

  private schedule(delay: number, fn: () => void) { this.scheduled.push({ t: this.time + delay, fn }); }

  // ───────── enemies ─────────
  spawnEnemy(id: string, pathIdx: number, d: number, lane?: number): Enemy {
    const def = ENEMY[id];
    const path = this.paths[Math.min(pathIdx, this.paths.length - 1)];
    const hpMul = DIFF_HP[this.diff] * (this.mode === 'heroic' ? 1.2 : 1);
    const e: Enemy = {
      id: this.nextId++, def, hp: def.hp * hpMul, maxHp: def.hp * hpMul, path, pathIdx, d,
      lane: lane ?? (def.boss ? 0 : this.rng.range(-0.75, 0.75)), x: 0, y: 0, dir: 0, alive: true, blocker: null, atkCd: 0.5,
      slowT: 0, slowF: 1, poisonT: 0, poisonDps: 0, burnT: 0, burnDps: 0, stunT: 0, freezeT: 0, shredT: 0, shred: 0,
      mrDownT: 0, mrDown: 0, auraArmor: 0, abilCd: def.summon?.cd ?? 5, abil2Cd: def.towerFreeze?.cd ?? 8, abil3Cd: def.stunUnits?.cd ?? 6,
      healCd: def.heal?.cd ?? 3, rangedCd: 1, age: 0, hitFlash: 0, attackAnim: 0, armorMul: this.diff === 2 ? 1.08 : 1, lastHit: -9,
    };
    const p = path.at(d, this.tmp);
    e.x = p.x - p.dy * e.lane; e.y = p.y + p.dx * e.lane;
    e.dir = Math.atan2(p.dy, p.dx);
    this.enemies.push(e);
    this.events.push({ type: 'spawn', e });
    return e;
  }

  private computeAuras() {
    for (const e of this.enemies) e.auraArmor = 0;
    for (const s of this.enemies) {
      const a = s.def.armorAura;
      if (!a) continue;
      for (const e of this.enemies) if (e !== s && dist(e, s) <= a.radius) e.auraArmor = Math.max(e.auraArmor, a.amount);
    }
  }

  private updateEnemies(dt: number) {
    const tmp = this.tmp;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.age += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.attackAnim = Math.max(0, e.attackAnim - dt);
      // statuses
      if (e.poisonT > 0) { e.poisonT -= dt; this.damage(e, e.poisonDps * dt, 'true', null, null, true); }
      if (e.burnT > 0) { e.burnT -= dt; this.damage(e, e.burnDps * dt, 'true', null, null, true); }
      if (!e.alive) continue;
      if (e.def.regen && e.hp < e.maxHp && this.time - e.lastHit > 1.5) e.hp = Math.min(e.maxHp, e.hp + e.def.regen * DIFF_HP[this.diff] * dt);
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
      if (e.shredT > 0) { e.shredT -= dt; if (e.shredT <= 0) e.shred = 0; }
      if (e.mrDownT > 0) { e.mrDownT -= dt; if (e.mrDownT <= 0) e.mrDown = 0; }
      if (e.freezeT > 0) { e.freezeT -= dt; continue; }
      if (e.stunT > 0) { e.stunT -= dt; continue; }

      this.enemyAbilities(e, dt);

      // blocked?
      const b = e.blocker;
      if (b && (b.dead || b.target !== e || dist(b, e) > 1.6 + e.def.size)) {
        e.blocker = null;
      }
      if (e.blocker) {
        e.atkCd -= dt;
        const dx = e.blocker.x - e.x, dy = e.blocker.y - e.y;
        e.dir = Math.atan2(dy, dx);
        if (e.atkCd <= 0) {
          e.atkCd = e.def.rate;
          e.attackAnim = 0.3;
          const dmg = this.rng.range(e.def.dmg[0], e.def.dmg[1]);
          this.damageUnit(e.blocker, dmg, 'physical');
        }
        continue;
      }
      // ranged enemy stops to shoot at nearby units
      if (e.def.ranged && !e.def.flying) {
        e.rangedCd -= dt;
        const tgt = this.nearestUnit(e, e.def.ranged.range);
        if (tgt) {
          if (e.rangedCd <= 0) {
            e.rangedCd = e.def.ranged.rate;
            e.attackAnim = 0.35;
            const r = e.def.ranged;
            this.spawnProj({ kind: r.proj, sx: e.x, sy: e.y, sz: 1, tx: tgt.x, ty: tgt.y, tz: 0.6, dur: 0.5, arc: 0.6,
              dmg: this.rng.range(r.dmg[0], r.dmg[1]), type: r.type, aoe: 0, flying: false, homing: true, unitTarget: tgt });
          }
        }
      }
      // move
      const sp = e.def.speed * e.slowF * (e.slowT > 0 ? 1 : 1);
      e.d += sp * dt;
      if (e.d >= e.path.length) {
        e.alive = false;
        this.lives -= e.def.lives;
        this.stats.leaked++;
        this.events.push({ type: 'lifeLost', amount: e.def.lives, e });
        this.events.push({ type: 'sfx', name: 'leak' });
        continue;
      }
      const p = e.path.at(e.d, tmp);
      const nx = p.x - p.dy * e.lane, ny = p.y + p.dx * e.lane;
      const mdx = nx - e.x, mdy = ny - e.y;
      if (mdx * mdx + mdy * mdy > 1e-6) {
        const target = Math.atan2(mdy, mdx);
        let da = target - e.dir;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        e.dir += da * Math.min(1, dt * 8);
      }
      e.x = nx; e.y = ny;
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private enemyAbilities(e: Enemy, dt: number) {
    const d = e.def;
    if (d.summon) {
      e.abilCd -= dt;
      if (e.abilCd <= 0) {
        e.abilCd = d.summon.cd;
        e.attackAnim = 0.5;
        for (let i = 0; i < d.summon.count; i++) {
          const n = this.spawnEnemy(d.summon.id, e.pathIdx, Math.max(0, e.d - 0.8 - i * 0.6));
          n.lane = this.rng.range(-0.8, 0.8);
        }
        this.events.push({ type: 'shockwave', x: e.x, y: e.y, r: 2, color: 0xb070ff });
        this.events.push({ type: 'sfx', name: 'summon' });
      }
    }
    if (d.towerFreeze) {
      e.abil2Cd -= dt;
      if (e.abil2Cd <= 0) {
        let best: Tower | null = null, bd = d.towerFreeze.radius;
        for (const t of this.towers) {
          if (t.frozenT > 0) continue;
          const dd = dist(t, e);
          if (dd < bd) { bd = dd; best = t; }
        }
        if (best) {
          e.abil2Cd = d.towerFreeze.cd;
          best.frozenT = d.towerFreeze.dur;
          e.attackAnim = 0.6;
          this.events.push({ type: 'towerFrozen', tower: best });
          this.events.push({ type: 'sfx', name: 'freeze' });
        } else e.abil2Cd = 1;
      }
    }
    if (d.stunUnits) {
      e.abil3Cd -= dt;
      if (e.abil3Cd <= 0) {
        const near = this.units.filter((u) => !u.dead && dist(u, e) <= d.stunUnits!.radius);
        if (near.length) {
          e.abil3Cd = d.stunUnits.cd;
          e.attackAnim = 0.6;
          for (const u of near) { u.stunT = d.stunUnits.dur; this.damageUnit(u, d.dmg[0] * 0.5, 'physical'); }
          this.events.push({ type: 'shockwave', x: e.x, y: e.y, r: d.stunUnits.radius, color: 0xc8a070 });
          this.events.push({ type: 'sfx', name: 'slam' });
        } else e.abil3Cd = 1;
      }
    }
    if (d.heal) {
      e.healCd -= dt;
      if (e.healCd <= 0) {
        e.healCd = d.heal.cd;
        let any = false;
        for (const o of this.enemies) {
          if (o.alive && o !== e && o.hp < o.maxHp && dist(o, e) <= d.heal.radius) {
            o.hp = Math.min(o.maxHp, o.hp + d.heal.amount * DIFF_HP[this.diff]);
            any = true;
            this.events.push({ type: 'heal', x: o.x, y: o.y });
          }
        }
        if (any) { e.attackAnim = 0.4; this.events.push({ type: 'shockwave', x: e.x, y: e.y, r: d.heal.radius, color: 0x7dff9a }); }
      }
    }
  }

  /** applies damage; returns actual damage dealt */
  damage(e: Enemy, amount: number, type: DamageType, tower: Tower | null, hero: Unit | null, silent = false, canDodge = false): number {
    if (!e.alive) return 0;
    if (canDodge && e.def.dodge && type === 'physical' && this.rng.chance(e.def.dodge)) {
      if (!silent) this.events.push({ type: 'hit', x: e.x, y: e.y, z: 1, kind: 'miss' });
      return 0;
    }
    let armor = Math.min(0.95, (e.def.armor + e.auraArmor) * e.armorMul - e.shred);
    if (tower && tower.def.line === 'archer' && this.up.archer >= 3) armor -= 0.15;
    armor = Math.max(0, armor);
    const mr = Math.max(0, Math.min(0.95, e.def.mr - e.mrDown));
    let amt = amount;
    if (type === 'physical') amt *= 1 - armor;
    else if (type === 'explosive') amt *= 1 - armor * 0.5;
    else if (type === 'magic') amt *= 1 - mr;
    const dealt = Math.min(e.hp, amt);
    e.hp -= amt;
    if (!silent) e.hitFlash = 0.12;
    if (amt > 0) e.lastHit = this.time;
    if (hero) this.giveXp(hero, dealt * 0.2);
    if (e.hp <= 0) this.kill(e, tower, hero);
    return dealt;
  }

  private kill(e: Enemy, tower: Tower | null, hero: Unit | null) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    if (e.blocker) e.blocker = null;
    const gold = e.def.gold;
    this.gold += gold;
    this.stats.goldEarned += gold;
    this.stats.kills++;
    if (tower) tower.kills++;
    if (this.hero && !this.hero.dead) this.giveXp(this.hero, e.def.gold * 0.8 + (e.def.boss ? 400 : 0) + (hero ? 3 : 0));
    this.events.push({ type: 'death', e });
    if (gold > 0) this.events.push({ type: 'gold', x: e.x, y: e.y, amount: gold });
    if (e.def.spawnOnDeath) {
      const s = e.def.spawnOnDeath;
      for (let i = 0; i < s.count; i++) {
        const n = this.spawnEnemy(s.id, e.pathIdx, Math.max(0, e.d - 0.4 + i * 0.5), this.rng.range(-0.8, 0.8));
        n.x = e.x + this.rng.range(-0.4, 0.4); n.y = e.y + this.rng.range(-0.4, 0.4);
      }
    }
    if (e.def.explodeOnDeath) {
      const x = e.def.explodeOnDeath;
      for (const u of this.units) if (!u.dead && dist(u, e) <= x.radius) this.damageUnit(u, x.dmg, 'explosive');
      this.events.push({ type: 'explode', x: e.x, y: e.y, r: x.radius, kind: 'fire' });
      this.events.push({ type: 'sfx', name: 'boom' });
    }
  }

  // ───────── towers ─────────
  private pickTarget(t: Tower, range: number, flying: boolean, exclude?: Set<Enemy>): Enemy | null {
    let best: Enemy | null = null, bestRem = Infinity;
    const r2 = range * range;
    for (const e of this.enemies) {
      if (!e.alive || (e.def.flying && !flying)) continue;
      if (exclude && exclude.has(e)) continue;
      const dd = (e.x - t.x) ** 2 + (e.y - t.y) ** 2;
      if (dd > r2) continue;
      const rem = e.path.length - e.d;
      if (rem < bestRem) { bestRem = rem; best = e; }
    }
    return best;
  }

  private enemiesIn(x: number, y: number, r: number, flying: boolean): Enemy[] {
    const out: Enemy[] = [];
    const r2 = r * r;
    for (const e of this.enemies) {
      if (!e.alive || (e.def.flying && !flying)) continue;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r2) out.push(e);
    }
    return out;
  }

  private rollDmg(t: Tower): number {
    let d = this.rng.range(t.def.dmg[0], t.def.dmg[1]) * this.dmgMul(t.def.line);
    if (t.def.line === 'archer' && this.up.archer >= 5 && this.rng.chance(0.1)) d *= 2;
    return d;
  }

  private updateTowers(dt: number) {
    for (const t of this.towers) {
      t.builtT += dt;
      t.fireAnim = Math.max(0, t.fireAnim - dt);
      if (t.frozenT > 0) { t.frozenT -= dt; continue; }
      if (t.def.soldiers) { this.updateBarracks(t, dt); continue; }
      const range = this.range(t);
      for (const k in t.abilCd) t.abilCd[k] -= dt;
      this.towerAbilities(t, range);
      t.cd -= dt;
      if (t.cd > 0) continue;
      const target = this.pickTarget(t, range, t.def.hitsFlying);
      if (!target) { t.cd = 0.1; continue; }
      t.cd = t.def.rate * this.rateMul(t.def.line);
      t.aim = Math.atan2(target.y - t.y, target.x - t.x);
      t.fireAnim = 0.25;
      t.shots++;
      this.fire(t, target, range);
    }
  }

  private towerTop(t: Tower): number {
    switch (t.def.line) {
      case 'archer': return 3.0 + t.def.tier * 0.3;
      case 'mage': return 3.6 + t.def.tier * 0.3;
      case 'artillery': return 1.6;
      default: return 2;
    }
  }

  private fire(t: Tower, target: Enemy, range: number) {
    const def = t.def;
    const z = this.towerTop(t);
    const dmg = this.rollDmg(t);
    switch (def.proj) {
      case 'arrow': case 'bullet': {
        const dd = dist(t, target);
        const speed = def.proj === 'bullet' ? 30 : 22;
        this.spawnProj({ kind: def.proj, sx: t.x, sy: t.y, sz: z, tx: target.x, ty: target.y, tz: target.def.flying ? 2.2 : 0.6,
          dur: Math.max(0.12, dd / speed), arc: def.proj === 'arrow' ? dd * 0.12 : 0, dmg, type: 'physical', aoe: 0,
          flying: true, homing: true, target, tower: t });
        this.events.push({ type: 'sfx', name: def.proj === 'arrow' ? 'arrow' : 'gun', x: t.x, y: t.y });
        break;
      }
      case 'bolt': case 'arcane': case 'ice': {
        const dd = dist(t, target);
        this.spawnProj({ kind: def.proj, sx: t.x, sy: t.y, sz: z, tx: target.x, ty: target.y, tz: target.def.flying ? 2.2 : 0.7,
          dur: Math.max(0.2, dd / 15), arc: 0.4, dmg, type: 'magic', aoe: 0, flying: true, homing: true, target, tower: t,
          slow: def.slow });
        this.events.push({ type: 'sfx', name: def.proj === 'ice' ? 'ice' : 'magic', x: t.x, y: t.y });
        break;
      }
      case 'egg': case 'bigegg': {
        const dd = dist(t, target);
        const dur = 0.8 + dd * 0.05;
        const pred = this.predict(target, dur);
        this.spawnProj({ kind: def.proj, sx: t.x, sy: t.y, sz: z, tx: pred.x, ty: pred.y, tz: 0, dur, arc: 2.5 + dd * 0.35,
          dmg, type: 'explosive', aoe: (def.aoe ?? 2) * (this.up.artillery >= 1 ? 1.15 : 1), flying: false, homing: false, tower: t });
        this.events.push({ type: 'sfx', name: 'cannon', x: t.x, y: t.y });
        break;
      }
      case 'lightning': {
        const extra = t.abil.conductor ?? 0;
        const ch = def.chain!;
        const bounces = ch.bounces + extra;
        const falloff = extra > 0 ? Math.min(1, ch.falloff + 0.07 * extra) : ch.falloff;
        const hit = new Set<Enemy>();
        const pts = [{ x: t.x, y: t.y, z: 4.2 }];
        let cur: Enemy | null = target;
        let d = dmg;
        for (let i = 0; i <= bounces && cur; i++) {
          hit.add(cur);
          pts.push({ x: cur.x, y: cur.y, z: cur.def.flying ? 2.2 : 0.7 });
          this.damage(cur, d, 'magic', t, null);
          d *= falloff;
          let nb: Enemy | null = null, nd = ch.range;
          for (const e of this.enemies) {
            if (!e.alive || hit.has(e)) continue;
            const dd = dist(e, cur);
            if (dd < nd) { nd = dd; nb = e; }
          }
          cur = nb;
        }
        this.events.push({ type: 'lightning', pts });
        this.events.push({ type: 'sfx', name: 'zap', x: t.x, y: t.y });
        const oc = t.abil.overcharge ?? 0;
        if (oc > 0) {
          const v = def.abilities!.find((a) => a.id === 'overcharge')!.values[oc - 1];
          for (const e of this.enemiesIn(t.x, t.y, 3.2, false)) this.damage(e, v, 'magic', t, null);
          this.events.push({ type: 'shockwave', x: t.x, y: t.y, r: 3.2, color: 0x9fd8ff });
        }
        break;
      }
    }
    void range;
  }

  private predict(e: Enemy, time: number): V2 {
    if (e.blocker || e.stunT > 0 || e.freezeT > 0) return { x: e.x, y: e.y };
    const d = Math.min(e.path.length, e.d + e.def.speed * e.slowF * time);
    const p = e.path.at(d);
    return { x: p.x - p.dy * e.lane, y: p.y + p.dx * e.lane };
  }

  private abilVal(t: Tower, id: string): number {
    const lv = t.abil[id] ?? 0;
    if (!lv) return 0;
    return t.def.abilities!.find((a) => a.id === id)!.values[lv - 1];
  }

  private towerAbilities(t: Tower, range: number) {
    const id = t.def.id;
    if (id === 'gatling' && t.abil.barrage && t.abilCd.barrage <= 0) {
      const es = this.enemiesIn(t.x, t.y, range, true);
      if (es.length >= 2) {
        t.abilCd.barrage = 11;
        const n = this.abilVal(t, 'barrage');
        for (let i = 0; i < n; i++) {
          const e = es[i % es.length];
          this.schedule(i * 0.05, () => {
            if (!e.alive) return;
            this.spawnProj({ kind: 'bullet', sx: t.x, sy: t.y, sz: 3.2, tx: e.x, ty: e.y, tz: 0.6, dur: 0.15, arc: 0,
              dmg: this.rollDmg(t), type: 'physical', aoe: 0, flying: true, homing: true, target: e, tower: t });
          });
        }
        t.fireAnim = 0.8;
        this.events.push({ type: 'sfx', name: 'barrage', x: t.x, y: t.y });
      }
    }
    if (id === 'arcane') {
      if (t.abil.ray && t.abilCd.ray <= 0) {
        let best: Enemy | null = null;
        for (const e of this.enemiesIn(t.x, t.y, range, true)) if (!best || e.hp > best.hp) best = e;
        if (best && best.hp > 150) {
          t.abilCd.ray = this.abilVal(t, 'ray');
          this.events.push({ type: 'ray', x: t.x, y: t.y, tx: best.x, ty: best.y });
          this.events.push({ type: 'sfx', name: 'ray', x: t.x, y: t.y });
          if (best.def.boss) this.damage(best, 400 + 300 * (t.abil.ray ?? 1), 'true', t, null);
          else this.damage(best, best.hp + 1, 'true', t, null);
        }
      }
      if (t.abil.teleport && t.abilCd.teleport <= 0) {
        const tg = this.pickTarget(t, range, false);
        if (tg) {
          t.abilCd.teleport = 14;
          const n = this.abilVal(t, 'teleport');
          const near = this.enemiesIn(tg.x, tg.y, 2.5, false).filter((e) => !e.def.boss).slice(0, n);
          for (const e of near) {
            this.events.push({ type: 'teleport', x: e.x, y: e.y });
            if (e.blocker) { e.blocker.target = null; e.blocker = null; }
            e.d = Math.max(0, e.d - 9);
            const p = e.path.at(e.d);
            e.x = p.x - p.dy * e.lane; e.y = p.y + p.dx * e.lane;
            this.events.push({ type: 'teleport', x: e.x, y: e.y });
          }
          if (near.length) this.events.push({ type: 'sfx', name: 'teleport', x: t.x, y: t.y });
        }
      }
    }
    if (id === 'frost') {
      if (t.abil.freeze && t.abilCd.freeze <= 0) {
        const tg = this.pickTarget(t, range, false);
        if (tg) {
          t.abilCd.freeze = 14;
          const dur = this.abilVal(t, 'freeze');
          for (const e of this.enemiesIn(tg.x, tg.y, 2.6, false)) if (!e.def.boss) e.freezeT = dur; else e.slowT = dur, e.slowF = 0.4;
          this.events.push({ type: 'freezeArea', x: tg.x, y: tg.y, r: 2.6 });
          this.events.push({ type: 'sfx', name: 'freeze', x: t.x, y: t.y });
        }
      }
      if (t.abil.icicle && t.abilCd.icicle <= 0) {
        const es = this.enemiesIn(t.x, t.y, range, true);
        if (es.length) {
          t.abilCd.icicle = 8;
          const n = this.abilVal(t, 'icicle');
          for (let i = 0; i < n; i++) {
            const e = es[i % es.length];
            this.schedule(i * 0.12, () => {
              if (!e.alive) return;
              this.spawnProj({ kind: 'icicle', sx: e.x, sy: e.y, sz: 9, tx: e.x, ty: e.y, tz: 0.6, dur: 0.4, arc: 0,
                dmg: 45 * this.dmgMul('mage'), type: 'magic', aoe: 0, flying: true, homing: true, target: e, tower: t, slow: { f: 0.5, t: 2 } });
            });
          }
        }
      }
    }
    if (id === 'bigegg') {
      if (t.abil.missile && t.abilCd.missile <= 0) {
        let best: Enemy | null = null;
        for (const e of this.enemiesIn(t.x, t.y, range * 1.2, true)) if (!best || e.hp > best.hp) best = e;
        if (best) {
          t.abilCd.missile = 9;
          this.spawnProj({ kind: 'missile', sx: t.x, sy: t.y, sz: 3, tx: best.x, ty: best.y, tz: best.def.flying ? 2.2 : 0.6,
            dur: 1.2, arc: 5, dmg: this.abilVal(t, 'missile') * this.dmgMul('artillery'), type: 'explosive', aoe: 1.5, flying: true, homing: true, target: best, tower: t });
          this.events.push({ type: 'sfx', name: 'missile', x: t.x, y: t.y });
        }
      }
    }
  }

  // ───────── barracks / units ─────────
  private defaultRally(sp: V2): V2 {
    let best: V2 = { x: sp.x, y: sp.y }, bd = Infinity;
    for (const p of this.paths) {
      const n = p.nearest(sp);
      if (n.dist < bd) { bd = n.dist; const q = p.at(n.d); best = { x: q.x, y: q.y }; }
    }
    return best;
  }

  formation(c: V2, i: number, n: number): V2 {
    if (n === 1) return { x: c.x, y: c.y };
    const a = (i / n) * Math.PI * 2 + 0.5;
    const r = n <= 3 ? 0.75 : 0.9;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  }

  private soldierStats(t: Tower) {
    const s = t.def.soldiers!;
    let hp = s.hp, armor = s.armor;
    let dmg: [number, number] = [s.dmg[0], s.dmg[1]];
    if (this.up.barracks >= 1) hp *= 1.15;
    if (this.up.barracks >= 3) armor += 0.1;
    if (this.up.barracks >= 4) dmg = [dmg[0] * 1.2, dmg[1] * 1.2];
    return { hp: Math.round(hp), armor, dmg, respawn: s.respawn * (this.up.barracks >= 2 ? 0.7 : 1) };
  }

  private syncSoldiers(t: Tower, fresh: boolean) {
    const s = t.def.soldiers!;
    const st = this.soldierStats(t);
    if (fresh) {
      for (let i = 0; i < s.count; i++) {
        const home = this.formation(t.rally, i, s.count);
        const u = this.makeUnit('soldier', s.model, s.name, home, st.hp, st.dmg, s.rate, st.armor, 2.4);
        u.x = t.x; u.y = t.y + 0.5;
        u.tower = t; u.slot = i;
        t.soldiers.push(u);
        this.units.push(u);
      }
    } else {
      for (const u of t.soldiers) {
        const ratio = u.hp / u.maxHp;
        u.model = s.model; u.name = s.name;
        u.maxHp = st.hp; u.hp = u.dead ? 0 : Math.max(1, st.hp * Math.max(ratio, 0.5));
        u.armor = st.armor; u.dmg = st.dmg; u.rate = s.rate;
        if (u.dead) u.respawnT = Math.min(u.respawnT, 1);
      }
    }
  }

  private updateBarracks(t: Tower, dt: number) {
    const st = this.soldierStats(t);
    for (const u of t.soldiers) {
      if (u.dead && u.respawnT <= 0) {
        u.dead = false; u.hp = u.maxHp = st.hp;
        u.x = t.x; u.y = t.y + 0.6; u.target = null; u.stunT = 0;
        u.home = this.formation(t.rally, u.slot, t.soldiers.length);
      } else if (u.dead) u.respawnT -= dt;
    }
    void dt;
  }

  private makeUnit(kind: UnitKind, model: string, name: string, home: V2, hp: number, dmg: [number, number], rate: number, armor: number, speed: number): Unit {
    return {
      id: this.nextId++, kind, model, name, x: home.x, y: home.y, dir: Math.PI / 2, hp, maxHp: hp, armor, dmg, rate, cd: 0, speed,
      target: null, home, tower: null, slot: 0, dead: false, respawnT: 0, lifeT: -1, regen: kind === 'hero' ? 0 : 0, stunT: 0,
      maxBlock: 1, blocking: 0, moveTo: null, attackAnim: 0, idleT: 0, level: 1, xp: 0, skillCd: [], buffT: 0, invulnT: 0,
      healCd: 0, whirlCd: 3, axeCd: 1,
    };
  }

  private spawnHero(id: string, xp: number) {
    const h = HERO[id];
    const lv = heroLevelFromXp(xp);
    const end = this.paths[0].at(this.paths[0].length * 0.72);
    const home = { x: end.x + end.dy * 1.2, y: end.y - end.dx * 1.2 };
    const u = this.makeUnit('hero', h.model, h.name, home, h.hp + h.hpLv * (lv - 1),
      [h.dmg[0] + h.dmgLv * (lv - 1), h.dmg[1] + h.dmgLv * (lv - 1)], h.rate, h.armor, h.speed);
    u.hero = h; u.level = lv; u.xp = xp; u.regen = h.regen; u.maxBlock = h.maxBlock; u.ranged = h.ranged;
    u.skillCd = h.skills.map((s) => s.cd * 0.5);
    this.hero = u;
    this.units.push(u);
  }

  private giveXp(h: Unit, amount: number) {
    if (h.kind !== 'hero' || !h.hero) return;
    h.xp += amount;
    this.heroXpGained += amount;
    const lv = heroLevelFromXp(h.xp);
    if (lv > h.level) {
      const d = h.hero;
      h.level = lv;
      h.maxHp = d.hp + d.hpLv * (lv - 1);
      h.hp = h.maxHp;
      h.dmg = [d.dmg[0] + d.dmgLv * (lv - 1), d.dmg[1] + d.dmgLv * (lv - 1)];
      this.events.push({ type: 'levelUp', u: h });
      this.events.push({ type: 'sfx', name: 'levelup' });
    }
  }

  private removeUnit(u: Unit) {
    this.releaseBlock(u);
    u.dead = true;
    this.units = this.units.filter((x) => x !== u);
  }

  private releaseBlock(u: Unit) {
    for (const e of this.enemies) if (e.blocker === u) e.blocker = null;
    u.blocking = 0;
  }

  private nearestUnit(e: Enemy, r: number): Unit | null {
    let best: Unit | null = null, bd = r;
    for (const u of this.units) {
      if (u.dead) continue;
      const d = dist(u, e);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  damageUnit(u: Unit, amount: number, type: DamageType) {
    if (u.dead) return;
    if (u.invulnT > 0) amount *= 0.1;
    if (type === 'physical') amount *= 1 - u.armor;
    else if (type === 'explosive') amount *= 1 - u.armor * 0.5;
    u.hp -= amount;
    u.idleT = 0;
    // paladin self-heal
    if (u.tower && u.tower.def.id === 'paladin' && u.tower.abil.heal && u.hp < u.maxHp * 0.3 && u.healCd <= 0 && u.hp > 0) {
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * this.abilVal(u.tower, 'heal'));
      u.healCd = 10;
      this.events.push({ type: 'heal', x: u.x, y: u.y });
    }
    if (u.hp <= 0) {
      u.hp = 0;
      this.releaseBlock(u);
      u.target = null;
      this.events.push({ type: 'unitDeath', u });
      if (u.kind === 'soldier') {
        u.dead = true;
        u.respawnT = this.soldierStats(u.tower!).respawn;
      } else if (u.kind === 'hero') {
        u.dead = true;
        u.respawnT = 15;
        this.events.push({ type: 'sfx', name: 'heroDown' });
      } else {
        this.removeUnit(u);
      }
    }
  }

  private updateUnits(dt: number) {
    const engageR = 2.8;
    for (const u of [...this.units]) {
      u.attackAnim = Math.max(0, u.attackAnim - dt);
      u.healCd -= dt; u.whirlCd -= dt; u.axeCd -= dt;
      if (u.buffT > 0) u.buffT -= dt;
      if (u.invulnT > 0) u.invulnT -= dt;
      if (u.dead) {
        if (u.kind === 'hero') {
          u.respawnT -= dt;
          if (u.respawnT <= 0) {
            u.dead = false; u.hp = u.maxHp; u.stunT = 0; u.target = null;
            this.events.push({ type: 'shockwave', x: u.x, y: u.y, r: 1.5, color: 0xffe080 });
          }
        }
        continue;
      }
      if (u.lifeT > 0) {
        u.lifeT -= dt;
        if (u.lifeT <= 0) { this.events.push({ type: 'teleport', x: u.x, y: u.y }); this.removeUnit(u); continue; }
      }
      if (u.stunT > 0) { u.stunT -= dt; continue; }
      u.cd -= dt;
      u.idleT += dt;
      // regen when out of combat
      const regen = u.kind === 'hero' ? u.regen : (this.up.barracks >= 5 ? u.maxHp * 0.08 : u.maxHp * 0.02);
      if (!u.target && u.idleT > 2 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + regen * dt);

      if (u.kind === 'hero') this.heroSkills(u, dt);

      // hero move order overrides combat
      if (u.moveTo) {
        if (this.walk(u, u.moveTo, dt * 1.2)) u.moveTo = null;
        continue;
      }

      // validate target
      if (u.target && (!u.target.alive || dist(u.target, u.home) > engageR + 2.2 || u.target.def.flying)) {
        if (u.target.blocker === u) u.target.blocker = null;
        u.target = null;
      }
      if (!u.target) u.target = this.acquire(u, u.kind === 'hero' ? (u.ranged ? u.ranged.range : 3.5) : engageR);

      const tg = u.target;
      if (tg) {
        const d = dist(u, tg);
        const reach = 0.55 + tg.def.size;
        // ranged hero: shoot when not engaged in melee
        if (u.ranged && (tg.blocker !== u || d > reach + 0.3)) {
          if (d <= u.ranged.range) {
            u.dir = Math.atan2(tg.y - u.y, tg.x - u.x);
            if (u.cd <= 0) { this.unitShoot(u, tg); u.cd = u.rate; }
            // melee-adjacent enemies get blocked by the ranged hero too
            if (d <= reach + 0.2 && !tg.blocker) tg.blocker = u;
            continue;
          }
        }
        if (d > reach) {
          // approach: stand beside the enemy
          const side = (u.slot % 2 === 0 ? 1 : -1) * 0.25;
          const goal = { x: tg.x - Math.cos(tg.dir) * -0.1 + Math.sin(tg.dir) * side, y: tg.y + Math.cos(tg.dir) * side };
          const ux = u.x - tg.x, uy = u.y - tg.y;
          const l = Math.hypot(ux, uy) || 1;
          goal.x = tg.x + (ux / l) * reach * 0.9; goal.y = tg.y + (uy / l) * reach * 0.9;
          this.walk(u, goal, dt);
        } else {
          if (!tg.blocker && !tg.def.flying) tg.blocker = u;
          u.dir = Math.atan2(tg.y - u.y, tg.x - u.x);
          if (u.cd <= 0) {
            u.cd = u.rate;
            u.attackAnim = 0.3;
            u.idleT = 0;
            let dmg = this.rng.range(u.dmg[0], u.dmg[1]);
            if (u.buffT > 0) dmg *= 1.5;
            this.damage(tg, dmg, 'physical', u.tower, u.kind === 'hero' ? u : null, false, true);
            this.events.push({ type: 'sfx', name: 'sword', x: u.x, y: u.y });
            this.soldierAbilities(u, tg);
          }
        }
      } else {
        this.walk(u, u.home, dt);
        // berserker axe at flying / far targets
        if (u.tower?.def.id === 'berserker' && u.tower.abil.axe && u.axeCd <= 0) {
          let best: Enemy | null = null, bd = 5.5;
          for (const e of this.enemies) { if (!e.alive) continue; const dd = dist(e, u); if (dd < bd) { bd = dd; best = e; } }
          if (best) {
            u.axeCd = 2.5;
            u.attackAnim = 0.3;
            this.spawnProj({ kind: 'axe', sx: u.x, sy: u.y, sz: 1, tx: best.x, ty: best.y, tz: best.def.flying ? 2.2 : 0.6, dur: 0.45, arc: 1.2,
              dmg: this.abilVal(u.tower, 'axe'), type: 'physical', aoe: 0, flying: true, homing: true, target: best, tower: u.tower });
          }
        }
      }
    }
  }

  private soldierAbilities(u: Unit, tg: Enemy) {
    const t = u.tower;
    if (!t) return;
    if (t.def.id === 'paladin' && t.abil.holy && this.rng.chance(0.18)) {
      const v = this.abilVal(t, 'holy');
      for (const e of this.enemiesIn(tg.x, tg.y, 1.9, false)) this.damage(e, v, 'true', t, null);
      this.events.push({ type: 'shockwave', x: tg.x, y: tg.y, r: 1.9, color: 0xfff2a0 });
      this.events.push({ type: 'sfx', name: 'holy', x: u.x, y: u.y });
    }
    if (t.def.id === 'berserker' && t.abil.whirl && u.whirlCd <= 0) {
      u.whirlCd = 6;
      const v = this.abilVal(t, 'whirl');
      for (const e of this.enemiesIn(u.x, u.y, 1.8, false)) this.damage(e, v, 'physical', t, null);
      this.events.push({ type: 'whirl', x: u.x, y: u.y });
      this.events.push({ type: 'sfx', name: 'whirl', x: u.x, y: u.y });
    }
  }

  private acquire(u: Unit, r: number): Enemy | null {
    const center = u.kind === 'hero' ? { x: u.x, y: u.y } : u.home;
    let best: Enemy | null = null, bs = Infinity;
    let blocks = 0;
    if (u.maxBlock > 1) for (const e of this.enemies) if (e.blocker === u) blocks++;
    for (const e of this.enemies) {
      if (!e.alive || e.def.flying) continue;
      const d = dist(e, center);
      if (d > r) continue;
      // prefer unblocked enemies, then enemies furthest along
      let score = d - (e.d / e.path.length) * 2;
      if (e.blocker && e.blocker !== u) score += 6;
      if (score < bs) { bs = score; best = e; }
    }
    // multi-block heroes grab extra enemies as blockers
    if (best && u.maxBlock > 1 && blocks < u.maxBlock) {
      for (const e of this.enemies) {
        if (blocks >= u.maxBlock - 1) break;
        if (e === best || !e.alive || e.def.flying || e.blocker) continue;
        if (dist(e, u) < 1.8) { e.blocker = u; blocks++; }
      }
    }
    return best;
  }

  private walk(u: Unit, goal: V2, dt: number): boolean {
    const dx = goal.x - u.x, dy = goal.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) return true;
    const step = u.speed * dt;
    u.dir = Math.atan2(dy, dx);
    if (step >= d) { u.x = goal.x; u.y = goal.y; return true; }
    u.x += (dx / d) * step; u.y += (dy / d) * step;
    return false;
  }

  private unitShoot(u: Unit, tg: Enemy) {
    const r = u.ranged!;
    const dd = dist(u, tg);
    let dmg = this.rng.range(u.dmg[0], u.dmg[1]);
    if (u.buffT > 0) dmg *= 1.5;
    u.attackAnim = 0.35;
    if (r.proj === 'bomb') {
      const dur = 0.6 + dd * 0.05;
      const p = this.predict(tg, dur);
      this.spawnProj({ kind: 'bomb', sx: u.x, sy: u.y, sz: 1.2, tx: p.x, ty: p.y, tz: 0, dur, arc: 1.5 + dd * 0.2, dmg, type: 'explosive',
        aoe: r.aoe ?? 1.5, flying: false, homing: false, fromHero: u });
    } else {
      this.spawnProj({ kind: r.proj, sx: u.x, sy: u.y, sz: 1.2, tx: tg.x, ty: tg.y, tz: 0.7, dur: Math.max(0.2, dd / 14), arc: 0.3, dmg,
        type: r.type, aoe: 0, flying: true, homing: true, target: tg, fromHero: u });
    }
    this.events.push({ type: 'sfx', name: r.proj === 'bomb' ? 'throw' : 'magic', x: u.x, y: u.y });
  }

  private heroSkills(u: Unit, dt: number) {
    const h = u.hero!;
    for (let i = 0; i < u.skillCd.length; i++) u.skillCd[i] -= dt;
    const lv = u.level;
    const near = (r: number) => this.enemiesIn(u.x, u.y, r, false);
    const ready = (i: number) => u.skillCd[i] <= 0;
    const use = (i: number) => { u.skillCd[i] = h.skills[i].cd; u.attackAnim = 0.5; this.events.push({ type: 'skill', u, skill: h.skills[i].id }); };
    if (u.moveTo) return;
    switch (h.id) {
      case 'kokka': {
        if (ready(0)) {
          const es = near(2.4);
          if (es.length >= 1 && u.target) {
            use(0);
            for (const e of es) { this.damage(e, 22 + lv * 8, 'physical', null, u); e.burnT = 3; e.burnDps = 4 + lv; }
            this.events.push({ type: 'explode', x: u.x, y: u.y, r: 2.4, kind: 'flame' });
            this.events.push({ type: 'sfx', name: 'flame' });
          }
        }
        if (ready(1)) {
          const allies = this.units.filter((o) => !o.dead && dist(o, u) < 4.5);
          if (u.target && allies.some((a) => a.hp < a.maxHp * 0.7)) {
            use(1);
            for (const a of allies) { a.hp = Math.min(a.maxHp, a.hp + a.maxHp * (0.2 + lv * 0.02)); a.buffT = 5; this.events.push({ type: 'heal', x: a.x, y: a.y }); }
            this.events.push({ type: 'shockwave', x: u.x, y: u.y, r: 4.5, color: 0xffb040 });
            this.events.push({ type: 'sfx', name: 'cluck' });
          }
        }
        break;
      }
      case 'bomba': {
        if (ready(0)) {
          let best: Enemy | null = null, bc = 0;
          for (const e of this.enemiesIn(u.x, u.y, 7.5, false)) {
            const c = this.enemiesIn(e.x, e.y, 2.6, false).length;
            if (c > bc) { bc = c; best = e; }
          }
          if (best && bc >= 2) {
            use(0);
            const p = this.predict(best, 0.9);
            this.spawnProj({ kind: 'megabomb', sx: u.x, sy: u.y, sz: 1.2, tx: p.x, ty: p.y, tz: 0, dur: 0.9, arc: 4, dmg: 40 + lv * 12,
              type: 'explosive', aoe: 2.8, flying: false, homing: false, fromHero: u, stun: 1.5 + lv * 0.1 });
          }
        }
        if (ready(1)) {
          const es = this.enemiesIn(u.x, u.y, 7, false);
          if (es.length) {
            use(1);
            const e = es[0];
            const p = this.predict(e, 2.5);
            this.zones.push({ id: this.nextId++, kind: 'mine', x: p.x, y: p.y, r: 1.0, t: 20, dps: 0, dmg: 50 + lv * 14 });
            this.events.push({ type: 'sfx', name: 'throw' });
          }
        }
        break;
      }
      case 'miko': {
        if (ready(0)) {
          const allies = this.units.filter((o) => !o.dead && dist(o, u) < 5);
          const hurt = allies.reduce((a, o) => a + (o.maxHp - o.hp), 0);
          if (hurt > 80) {
            use(0);
            for (const a of allies) { a.hp = Math.min(a.maxHp, a.hp + 60 + lv * 14); this.events.push({ type: 'heal', x: a.x, y: a.y }); }
            this.events.push({ type: 'shockwave', x: u.x, y: u.y, r: 5, color: 0x9dffb0 });
            this.events.push({ type: 'sfx', name: 'heal' });
          }
        }
        if (ready(1)) {
          const es = this.enemiesIn(u.x, u.y, 8.5, true);
          if (es.length >= 2) {
            use(1);
            const n = 4 + Math.floor(lv / 3);
            for (let i = 0; i < n; i++) {
              const e = es[i % es.length];
              this.schedule(i * 0.15, () => {
                if (!e.alive) return;
                this.spawnProj({ kind: 'star', sx: e.x - 2, sy: e.y - 3, sz: 10, tx: e.x, ty: e.y, tz: e.def.flying ? 2.2 : 0.6, dur: 0.5, arc: 0,
                  dmg: 30 + lv * 9, type: 'magic', aoe: 0.9, flying: true, homing: true, target: e, fromHero: u });
              });
            }
            this.events.push({ type: 'sfx', name: 'starfall' });
          }
        }
        break;
      }
      case 'gardon': {
        if (ready(0)) {
          const es = near(2.8);
          if (es.length >= 2) {
            use(0);
            for (const e of es) { this.damage(e, 15 + lv * 6, 'physical', null, u); if (!e.def.boss) e.stunT = 1.5 + lv * 0.08; }
            this.events.push({ type: 'shockwave', x: u.x, y: u.y, r: 2.8, color: 0xd0a060 });
            this.events.push({ type: 'explode', x: u.x, y: u.y, r: 2.4, kind: 'dust' });
            this.events.push({ type: 'sfx', name: 'slam' });
          }
        }
        if (ready(1) && u.hp < u.maxHp * 0.5 && u.target) {
          use(1);
          u.invulnT = 4 + lv * 0.2;
          this.events.push({ type: 'shockwave', x: u.x, y: u.y, r: 1.6, color: 0x80c0ff });
          this.events.push({ type: 'sfx', name: 'holy' });
        }
        break;
      }
    }
  }

  // ───────── projectiles ─────────
  spawnProj(p: Partial<Projectile> & { kind: string; sx: number; sy: number; sz: number; tx: number; ty: number; tz: number; dur: number; arc: number; dmg: number; type: DamageType; aoe: number; flying: boolean; homing: boolean }) {
    const pr: Projectile = {
      id: this.nextId++, x: p.sx, y: p.sy, z: p.sz, prevX: p.sx, prevY: p.sy, prevZ: p.sz, t: 0, target: null, unitTarget: null, tower: null,
      fromHero: null, alive: true, ...p,
    } as Projectile;
    this.projectiles.push(pr);
    return pr;
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.homing) {
        if (p.target && p.target.alive) { p.tx = p.target.x; p.ty = p.target.y; }
        else if (p.unitTarget && !p.unitTarget.dead) { p.tx = p.unitTarget.x; p.ty = p.unitTarget.y; }
      }
      const u = Math.min(1, p.t / p.dur);
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      p.x = p.sx + (p.tx - p.sx) * u;
      p.y = p.sy + (p.ty - p.sy) * u;
      p.z = p.sz + (p.tz - p.sz) * u + p.arc * 4 * u * (1 - u);
      if (u >= 1) { p.alive = false; this.impact(p); }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private impact(p: Projectile) {
    if (p.unitTarget) {
      if (!p.unitTarget.dead) this.damageUnit(p.unitTarget, p.dmg, p.type);
      this.events.push({ type: 'hit', x: p.tx, y: p.ty, z: p.tz, kind: p.kind });
      return;
    }
    if (p.aoe > 0) {
      const es = this.enemiesIn(p.tx, p.ty, p.aoe, p.flying);
      for (const e of es) {
        const fall = 1 - 0.4 * Math.min(1, dist(e, { x: p.tx, y: p.ty }) / p.aoe);
        this.damage(e, p.dmg * fall, p.type, p.tower, p.fromHero);
        if (p.stun && !e.def.boss) e.stunT = Math.max(e.stunT, p.stun);
        if (p.tower && p.tower.def.line === 'artillery' && this.up.artillery >= 5) { e.slowT = 1.5; e.slowF = Math.min(e.slowF, 0.7); }
      }
      // direct-hit homing with aoe (missile/star) also hits the target itself
      if (p.homing && p.target && p.target.alive && !es.includes(p.target)) this.damage(p.target, p.dmg, p.type, p.tower, p.fromHero);
      const kind = p.kind === 'meteor' ? 'meteor' : p.kind === 'star' ? 'star' : p.kind === 'bigegg' ? 'big' : 'egg';
      this.events.push({ type: 'explode', x: p.tx, y: p.ty, r: p.aoe, kind });
      if (p.kind !== 'star') this.events.push({ type: 'sfx', name: p.kind === 'meteor' || p.kind === 'bigegg' ? 'bigboom' : 'boom', x: p.tx, y: p.ty });
      if (p.kind === 'meteor' && this.up.meteor >= 5) this.zones.push({ id: this.nextId++, kind: 'fire', x: p.tx, y: p.ty, r: 1.6, t: 5, dps: 15, dmg: 0 });
      if (p.kind === 'bigegg' && p.tower?.abil.cluster) {
        const n = this.abilVal(p.tower, 'cluster');
        for (let i = 0; i < n; i++) {
          const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(1.2, 3);
          this.spawnProj({ kind: 'minibomb', sx: p.tx, sy: p.ty, sz: 0.5, tx: p.tx + Math.cos(a) * r, ty: p.ty + Math.sin(a) * r, tz: 0,
            dur: 0.5 + i * 0.05, arc: 1.5, dmg: this.rng.range(14, 26), type: 'explosive', aoe: 1.2, flying: false, homing: false, tower: p.tower });
        }
      }
      return;
    }
    const e = p.target;
    if (!e || !e.alive) return;
    const t = p.tower;
    if (t && t.def.id === 'hawkeye' && t.abil.headshot && this.rng.chance(this.abilVal(t, 'headshot'))) {
      this.events.push({ type: 'hit', x: e.x, y: e.y, z: 1.2, kind: 'headshot' });
      this.events.push({ type: 'sfx', name: 'headshot' });
      if (e.def.boss) this.damage(e, p.dmg * 3, 'physical', t, null);
      else this.damage(e, e.hp + 1, 'true', t, null);
      return;
    }
    this.damage(e, p.dmg, p.type, t, p.fromHero, false, p.type === 'physical');
    this.events.push({ type: 'hit', x: e.x, y: e.y, z: p.tz, kind: p.kind });
    if (!e.alive) return;
    if (p.slow) { e.slowT = Math.max(e.slowT, p.slow.t); e.slowF = Math.min(e.slowF, p.slow.f); }
    if (t) {
      if (t.def.id === 'hawkeye' && t.abil.poison) { e.poisonT = 3; e.poisonDps = this.abilVal(t, 'poison'); }
      if (t.def.id === 'gatling' && t.abil.shred) { e.shredT = 3; e.shred = Math.max(e.shred, this.abilVal(t, 'shred')); }
      if (t.def.line === 'mage' && this.up.mage >= 4) { e.mrDownT = 3; e.mrDown = 0.1; }
    }
  }

  private updateZones(dt: number) {
    for (const z of this.zones) {
      z.t -= dt;
      if (z.kind === 'fire') {
        for (const e of this.enemiesIn(z.x, z.y, z.r, false)) this.damage(e, z.dps * dt, 'true', null, null, true);
      } else if (z.kind === 'mine') {
        const es = this.enemiesIn(z.x, z.y, z.r, false);
        if (es.length) {
          z.t = 0;
          for (const e of this.enemiesIn(z.x, z.y, 2, false)) this.damage(e, z.dmg, 'explosive', null, this.hero);
          this.events.push({ type: 'explode', x: z.x, y: z.y, r: 2, kind: 'egg' });
          this.events.push({ type: 'sfx', name: 'boom' });
        }
      }
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }
}

// ───────────────────────── build spot generation ─────────────────────────
export function computeSpots(stage: StageDef, paths: Path[]): Spot[] {
  const samples: V2[] = [];
  for (const p of paths) for (let i = 0; i < p.pts.length; i += 4) samples.push(p.pts[i]);
  const ends: V2[] = [];
  for (const p of paths) { ends.push(p.pts[0]); ends.push(p.pts[p.pts.length - 1]); }
  const cands: { x: number; y: number; score: number }[] = [];
  for (let x = -29; x <= 27; x += 0.5) {
    for (let y = -17; y <= 17; y += 0.5) {
      let minD = Infinity;
      for (const p of paths) {
        for (let i = 0; i < p.pts.length; i += 2) {
          const q = p.pts[i];
          const d = (q.x - x) ** 2 + (q.y - y) ** 2;
          if (d < minD) minD = d;
        }
      }
      minD = Math.sqrt(minD);
      if (minD < 3.35 || minD > 4.8) continue;
      if (ends.some((e) => Math.hypot(e.x - x, e.y - y) < 5)) continue;
      cands.push({ x, y, score: -minD });
    }
  }
  // max-coverage greedy: each pick discounts the path samples it already covers,
  // so spots spread along the whole route instead of piling up where paths merge
  const weight = samples.map(() => 1);
  const covers = cands.map((c) => {
    const out: number[] = [];
    samples.forEach((s, i) => { if ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 < 64) out.push(i); });
    return out;
  });
  const spots: Spot[] = [];
  const minSpacing = 4.4;
  const taken = new Array(cands.length).fill(false);
  while (spots.length < stage.spots) {
    let best = -1, bs = -Infinity;
    for (let k = 0; k < cands.length; k++) {
      if (taken[k]) continue;
      const c = cands[k];
      if (spots.some((s) => Math.hypot(s.x - c.x, s.y - c.y) < minSpacing)) { taken[k] = true; continue; }
      let sc = c.score * 0.4;
      for (const i of covers[k]) sc += weight[i];
      if (sc > bs) { bs = sc; best = k; }
    }
    if (best < 0) break;
    taken[best] = true;
    const c = cands[best];
    spots.push({ id: spots.length, x: c.x, y: c.y });
    for (const i of covers[best]) weight[i] *= 0.45;
  }
  return spots;
}
