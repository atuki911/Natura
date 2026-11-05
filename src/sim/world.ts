import { ENEMIES } from '../data/enemies.ts';
import {
  ABILITIES,
  HEAL_CASTLE_RATIO,
  HEAL_UNIT_RATIO,
  METEOR_DAMAGE,
  METEOR_DELAY,
  METEOR_RADIUS,
  TOWERS,
} from '../data/towers.ts';
import { TREE_OF_UNIT, TREE_RULES, TREES } from '../data/trees.ts';
import { UNITS } from '../data/units.ts';
import { CASTLE_ARCHER, DT, ECONOMY, FIELD, TOWER_SLOTS } from './constants.ts';
import { Rng } from './rng.ts';
import {
  CASTLE_TARGET,
  type AbilityId,
  type AttackKind,
  type Command,
  type Cost,
  type EnemyDef,
  type EnemyId,
  type Fighter,
  type FighterDef,
  type PendingMeteor,
  type Projectile,
  type Side,
  type SimEvent,
  type StageDef,
  type Stats,
  type Tower,
  type Tree,
  type UnitId,
  type WorldPhase,
} from './types.ts';

const PROJECTILE_SPEED: Partial<Record<AttackKind, number>> = {
  arrow: 560,
  bolt: 400,
  spit: 300,
  cannon: 380,
};

const isRanged = (kind: AttackKind) => kind === 'arrow' || kind === 'bolt' || kind === 'spit' || kind === 'cannon';

const isEnemyDef = (def: FighterDef): def is EnemyDef => 'bounty' in def;

interface QueuedSpawn {
  time: number;
  enemy: EnemyId;
}

/**
 * 戦闘の世界。1回の step() で 1/60 秒進む。
 * 同じ種と同じ命令の並びなら、何度回しても同じ結果になる。
 */
export class World {
  readonly stage: StageDef;
  readonly rng: Rng;

  time = 0;
  phase: WorldPhase = 'break';
  /** 休憩中の残り秒数。 */
  breakTimer: number;
  /** 始まったウェーブの数(1始まりの今のウェーブ番号でもある)。 */
  wavesStarted = 0;
  waveTime = 0;
  private spawnQueue: QueuedSpawn[] = [];

  gold: number;
  mana: number;
  castle: { hp: number; maxHp: number; cooldown: number };

  fighters: Fighter[] = [];
  private byId = new Map<number, Fighter>();
  projectiles: Projectile[] = [];
  towers: (Tower | null)[] = TOWER_SLOTS.map(() => null);
  meteors: PendingMeteor[] = [];
  /** 倒れた兵から生えた木。 */
  trees: Tree[] = [];
  private treeById = new Map<number, Tree>();

  unitCooldowns: Record<UnitId, number> = { sword: 0, archer: 0, mage: 0, bomber: 0 };
  abilityCooldowns: Record<AbilityId, number> = { heal: 0, meteor: 0 };

  /** この step で起きたこと。描画側が読んでエフェクトを出す。 */
  events: SimEvent[] = [];
  private commands: Command[] = [];
  stats: Stats = { kills: 0, unitsDeployed: 0, goldEarned: 0, towersBuilt: 0, treesGrown: 0, harvests: 0 };
  god = false;
  private nextId = 1;

  constructor(stage: StageDef, seed = 1) {
    this.stage = stage;
    this.rng = new Rng(seed);
    this.gold = stage.startGold;
    this.mana = stage.startMana;
    this.castle = { hp: stage.castleHp, maxHp: stage.castleHp, cooldown: 0 };
    this.breakTimer = stage.firstBreak;
  }

  get totalWaves(): number {
    return this.stage.waves.length;
  }

  get ended(): boolean {
    return this.phase === 'victory' || this.phase === 'defeat';
  }

  /** 命令は次の step の最初にまとめて適用する(結果を再現できるように)。 */
  command(cmd: Command): void {
    this.commands.push(cmd);
  }

  getFighter(id: number): Fighter | undefined {
    return this.byId.get(id);
  }

  allies(): Fighter[] {
    return this.fighters.filter((f) => f.alive && f.side === 'ally');
  }

  enemies(): Fighter[] {
    return this.fighters.filter((f) => f.alive && f.side === 'enemy');
  }

  boss(): Fighter | undefined {
    return this.fighters.find((f) => f.alive && isEnemyDef(f.def) && f.def.boss);
  }

  canAfford(cost: Cost): boolean {
    return this.gold >= cost.gold && this.mana >= cost.mana;
  }

  /** 今そのユニットを出せるか。 */
  canSpawn(unit: UnitId): boolean {
    return (
      !this.ended &&
      this.stage.units.includes(unit) &&
      this.unitCooldowns[unit] <= 0 &&
      this.canAfford(UNITS[unit].cost) &&
      this.allies().length < ECONOMY.maxAllies
    );
  }

  canUseAbility(ability: AbilityId): boolean {
    return !this.ended && this.abilityCooldowns[ability] <= 0 && this.mana >= ABILITIES[ability].mana;
  }

  getTree(id: number): Tree | undefined {
    return this.treeById.get(id);
  }

  aliveTrees(): Tree[] {
    return this.trees.filter((t) => t.alive);
  }

  /** 今摘める木(実や蜜がたまった木)。 */
  harvestable(): Tree[] {
    return this.trees.filter((t) => t.alive && t.growing <= 0 && t.def.nectar && t.nectar >= t.def.nectar.minHarvest);
  }

  /** 1/60 秒進める。 */
  step(): void {
    this.events = [];
    const commands = this.commands;
    this.commands = [];
    for (const cmd of commands) this.apply(cmd);
    if (this.ended) return;

    this.time += DT;
    this.gold += ECONOMY.goldPerSecond * DT;
    this.mana = Math.min(ECONOMY.maxMana, this.mana + ECONOMY.manaPerSecond * DT);
    for (const key of Object.keys(this.unitCooldowns) as UnitId[]) this.unitCooldowns[key] -= DT;
    for (const key of Object.keys(this.abilityCooldowns) as AbilityId[]) this.abilityCooldowns[key] -= DT;

    this.updatePhase();
    for (const f of this.fighters) if (f.alive) this.updateFighter(f);
    this.updateTowers();
    this.updateCastle();
    this.updateTrees();
    this.updateProjectiles();
    this.updateMeteors();

    this.fighters = this.fighters.filter((f) => {
      if (!f.alive) this.byId.delete(f.id);
      return f.alive;
    });
    this.trees = this.trees.filter((t) => {
      if (!t.alive) this.treeById.delete(t.id);
      return t.alive;
    });
  }

  // ---- 命令 ----

  private apply(cmd: Command): void {
    if (this.ended) return;
    switch (cmd.type) {
      case 'spawn': {
        if (!this.canSpawn(cmd.unit)) return;
        const def = UNITS[cmd.unit];
        this.pay(def.cost);
        this.unitCooldowns[cmd.unit] = def.spawnCooldown;
        this.addFighter('ally', def, FIELD.castleX - 30);
        this.stats.unitsDeployed++;
        return;
      }
      case 'build': {
        const def = TOWERS[cmd.tower];
        if (cmd.slot < 0 || cmd.slot >= this.towers.length || this.towers[cmd.slot]) return;
        if (!this.canAfford(def.cost)) return;
        this.pay(def.cost);
        this.towers[cmd.slot] = { slot: cmd.slot, x: TOWER_SLOTS[cmd.slot], def, cooldown: 0.5, aimX: FIELD.portalX };
        this.stats.towersBuilt++;
        this.events.push({ t: 'towerBuilt', slot: cmd.slot });
        return;
      }
      case 'ability': {
        if (!this.canUseAbility(cmd.ability)) return;
        const def = ABILITIES[cmd.ability];
        this.mana -= def.mana;
        this.abilityCooldowns[cmd.ability] = def.cooldown;
        if (cmd.ability === 'heal') {
          for (const f of this.allies()) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * HEAL_UNIT_RATIO);
          const castleAmount = Math.round(Math.min(this.castle.maxHp - this.castle.hp, this.castle.maxHp * HEAL_CASTLE_RATIO));
          this.castle.hp += castleAmount;
          for (const t of this.aliveTrees()) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * TREE_RULES.healRatio);
          this.events.push({ t: 'heal', castleAmount });
        } else {
          const x = Math.max(FIELD.castleX, Math.min(FIELD.portalX, cmd.x ?? FIELD.rallyX));
          this.meteors.push({ x, timer: METEOR_DELAY });
          this.events.push({ t: 'meteorCast', x });
        }
        return;
      }
      case 'nextWave': {
        if (this.phase !== 'break') return;
        const bonus = Math.floor(this.breakTimer) * ECONOMY.earlyBonusPerSecond;
        if (bonus > 0) {
          this.gold += bonus;
          this.events.push({ t: 'earlyBonus', gold: bonus });
        }
        this.startWave();
        return;
      }
      case 'harvest': {
        const tree = this.treeById.get(cmd.tree);
        const nectar = tree?.def.nectar;
        if (!tree || !tree.alive || !nectar || tree.growing > 0 || tree.nectar < nectar.minHarvest) return;
        const n = Math.floor(tree.nectar);
        tree.nectar -= n;
        const mana = n * nectar.manaPer;
        const gold = n * nectar.goldPer;
        this.mana = Math.min(ECONOMY.maxMana, this.mana + mana);
        this.gold += gold;
        this.stats.harvests++;
        this.events.push({ t: 'harvest', treeId: tree.id, mana, gold });
        return;
      }
      case 'uproot': {
        const tree = this.treeById.get(cmd.tree);
        if (!tree || !tree.alive) return;
        const gold = Math.round(tree.def.uprootGold * (tree.growing > 0 ? 0.5 : tree.hp / tree.maxHp));
        this.gold += gold;
        this.events.push({ t: 'uproot', treeId: tree.id, gold });
        this.removeTree(tree, 'uprooted');
        return;
      }
      case 'debugGold':
        this.gold += cmd.amount;
        return;
      case 'debugMana':
        this.mana = Math.min(ECONOMY.maxMana, this.mana + cmd.amount);
        return;
      case 'debugSpawnEnemy':
        this.addFighter('enemy', ENEMIES[cmd.enemy], FIELD.portalX);
        return;
      case 'debugKillAll':
        for (const f of this.enemies()) this.kill(f);
        return;
      case 'debugPlant': {
        const fake = { x: cmd.x, row: this.rng.next(), dealt: Infinity } as Fighter;
        this.seedTree(cmd.unit, fake);
        return;
      }
      case 'debugGod':
        this.god = cmd.on;
        return;
      case 'debugJumpWave': {
        for (const f of this.enemies()) {
          f.alive = false;
        }
        this.spawnQueue = [];
        this.wavesStarted = Math.max(0, Math.min(this.totalWaves - 1, cmd.wave - 1));
        this.phase = 'break';
        this.breakTimer = 1;
        return;
      }
    }
  }

  private pay(cost: Cost): void {
    this.gold -= cost.gold;
    this.mana -= cost.mana;
  }

  // ---- ウェーブ ----

  private updatePhase(): void {
    if (this.phase === 'break') {
      this.breakTimer -= DT;
      if (this.breakTimer <= 0) this.startWave();
      return;
    }
    if (this.phase !== 'wave') return;
    this.waveTime += DT;
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.waveTime) {
      const next = this.spawnQueue.shift()!;
      this.addFighter('enemy', ENEMIES[next.enemy], FIELD.portalX - this.rng.range(0, 12));
    }
    if (this.spawnQueue.length === 0 && this.enemies().length === 0) {
      this.events.push({ t: 'waveClear', wave: this.wavesStarted });
      if (this.wavesStarted >= this.totalWaves) {
        this.phase = 'victory';
        this.events.push({ t: 'victory' });
      } else {
        this.phase = 'break';
        this.breakTimer = this.stage.breakTime;
      }
    }
  }

  private startWave(): void {
    const wave = this.stage.waves[this.wavesStarted];
    this.wavesStarted++;
    this.waveTime = 0;
    this.phase = 'wave';
    const queue: QueuedSpawn[] = [];
    for (const group of wave.groups) {
      for (let i = 0; i < group.count; i++) queue.push({ time: group.delay + i * group.interval, enemy: group.enemy });
    }
    queue.sort((a, b) => a.time - b.time);
    this.spawnQueue = queue;
    const boss = wave.groups.some((group) => ENEMIES[group.enemy].boss);
    this.events.push({ t: 'waveStart', wave: this.wavesStarted, boss });
  }

  // ---- 兵 ----

  private addFighter(side: Side, def: FighterDef, x: number): Fighter {
    const special = isEnemyDef(def) ? def.special : null;
    const fighter: Fighter = {
      id: this.nextId++,
      side,
      def,
      x,
      row: this.rng.next(),
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
      state: 'walk',
      cooldown: 0,
      windup: -1,
      targetId: null,
      charged: false,
      summonTimer: special?.type === 'summon' ? special.every * 0.6 : 0,
      summonCount: 0,
      age: 0,
      dealt: 0,
      slowTimer: 0,
      slowMult: 1,
    };
    this.fighters.push(fighter);
    this.byId.set(fighter.id, fighter);
    this.events.push({ t: 'spawn', id: fighter.id, side });
    return fighter;
  }

  private updateFighter(f: Fighter): void {
    f.age += DT;
    f.cooldown -= DT;
    if (f.slowTimer > 0) f.slowTimer -= DT;

    const special = isEnemyDef(f.def) ? f.def.special : null;
    if (special?.type === 'summon') {
      f.summonTimer -= DT;
      if (f.summonTimer <= 0) {
        f.summonTimer = special.every;
        for (let i = 0; i < special.count; i++) {
          const kind = special.cycle ? special.cycle[(f.summonCount + i) % special.cycle.length] : special.enemy;
          this.addFighter('enemy', ENEMIES[kind], f.x - 40 - i * 18);
        }
        f.summonCount += special.count;
        this.events.push({ t: 'summon', id: f.id });
      }
    }

    const aura = isEnemyDef(f.def) ? f.def.witherAura : undefined;
    if (aura) {
      for (const t of this.trees) {
        if (t.alive && Math.abs(t.x - f.x) <= aura.radius) this.damageTree(t, aura.dps * DT);
      }
    }

    if (f.windup >= 0) {
      f.windup -= DT;
      if (f.windup <= 0) {
        f.windup = -1;
        this.resolveAttack(f);
      }
      return;
    }

    const target = this.findTarget(f);
    if (target !== null) {
      if (f.cooldown <= 0) {
        f.targetId = target;
        f.state = 'attack';
        f.windup = f.def.windup;
        this.events.push({ t: 'attackStart', id: f.id });
        if (f.windup <= 0) {
          f.windup = -1;
          this.resolveAttack(f);
        }
      } else {
        f.state = 'idle';
      }
      return;
    }

    if (f.side === 'ally') {
      const limit = isRanged(f.def.attack) ? FIELD.rallyX - FIELD.rangedRallyOffset : FIELD.rallyX;
      if (f.x < limit) {
        f.x = Math.min(limit, f.x + f.def.speed * DT);
        f.state = 'walk';
      } else {
        f.state = 'idle';
      }
    } else {
      const charged = special?.type === 'charge' && f.charged ? special.slowAfter : 1;
      const thorned = f.slowTimer > 0 && special?.type !== 'burrow' ? f.slowMult : 1;
      f.x = Math.max(FIELD.castleX, f.x - f.def.speed * charged * thorned * DT);
      f.state = 'walk';
    }
  }

  /** 攻撃が届く一番近い相手の id。城なら CASTLE_TARGET、いなければ null。 */
  private findTarget(f: Fighter): number | null {
    let best: Fighter | null = null;
    let bestDist = Infinity;
    for (const o of this.fighters) {
      if (!o.alive || o.side === f.side) continue;
      if (o.def.flying && !f.def.hitsFlying) continue;
      const ahead = f.side === 'ally' ? o.x - f.x : f.x - o.x;
      if (ahead < -12) continue;
      const dist = Math.abs(o.x - f.x);
      if (dist <= f.def.range && dist < bestDist) {
        best = o;
        bestDist = dist;
      }
    }
    // 地上の敵は、行く手をふさぐ木(茨)で足を止めて攻撃する。
    let bestTree: Tree | null = null;
    const special = isEnemyDef(f.def) ? f.def.special : null;
    const hunter = special?.type === 'treeHunter';
    if (hunter) bestDist = Infinity;
    if (f.side === 'enemy' && (hunter || (!f.def.flying && special?.type !== 'burrow'))) {
      for (const t of this.trees) {
        if (!t.alive || t.growing > 0 || (!t.def.blocks && !hunter)) continue;
        if (f.x - t.x < -12) continue;
        const dist = Math.abs(t.x - f.x);
        if (dist <= f.def.range && dist < bestDist) {
          bestTree = t;
          bestDist = dist;
        }
      }
    }
    if (bestTree) return bestTree.id;
    if (best) return best.id;
    if (f.side === 'enemy' && f.x - FIELD.castleX <= f.def.range) return CASTLE_TARGET;
    return null;
  }

  private resolveAttack(f: Fighter): void {
    const def = f.def;
    f.cooldown = def.attackInterval;
    f.state = 'idle';

    if (def.attack === 'bomb') {
      this.areaDamage(f.side, f.x, def.splash, def.damage, false, false, true, 'bomb', def.knockback, true, f.id);
      this.events.push({ t: 'explode', x: f.x, row: f.row, radius: def.splash, kind: 'bomb' });
      this.kill(f);
      return;
    }

    const crit = def.critChance > 0 && this.rng.chance(def.critChance);
    let damage = def.damage * (crit ? def.critMult : 1);
    let knockback = def.knockback;
    const special = isEnemyDef(def) ? def.special : null;
    if (special?.type === 'charge' && !f.charged) {
      f.charged = true;
      damage *= special.damageMult;
      knockback = special.knockback;
      this.events.push({ t: 'explode', x: f.x - 20, row: f.row, radius: 40, kind: 'charge' });
    }

    if (f.targetId === CASTLE_TARGET) {
      if (isRanged(def.attack)) {
        this.launch(f.side, def.attack, f.x, f.row, CASTLE_TARGET, damage, crit, 0, def.magic, false, true, 'fighter', -1, f.id);
      } else {
        this.damageCastle(damage, f.x);
      }
      return;
    }

    const tree = f.targetId === null ? undefined : this.treeById.get(f.targetId);
    if (tree) {
      if (!tree.alive) return;
      this.damageTree(tree, damage);
      if (def.splash > 0) {
        this.areaDamage(f.side, tree.x, def.splash, damage, def.magic, crit, def.hitsFlying, def.attack, knockback, true, f.id);
        this.events.push({ t: 'explode', x: tree.x, row: tree.row, radius: def.splash, kind: 'slam' });
      }
      return;
    }

    const target = f.targetId === null ? undefined : this.byId.get(f.targetId);
    if (!target || !target.alive) return;

    if (isRanged(def.attack)) {
      this.launch(
        f.side,
        def.attack,
        f.x,
        f.row,
        target.id,
        damage,
        crit,
        def.splash,
        def.magic,
        def.hitsFlying,
        true,
        'fighter',
        -1,
        f.id,
      );
      return;
    }

    if (Math.abs(target.x - f.x) > def.range * 1.6) return;
    if (def.splash > 0) {
      this.areaDamage(f.side, target.x, def.splash, damage, def.magic, crit, def.hitsFlying, def.attack, knockback, true, f.id);
      this.events.push({ t: 'explode', x: target.x, row: target.row, radius: def.splash, kind: 'slam' });
    } else {
      this.applyDamage(target, damage, def.magic, crit, def.attack, knockback, f.id);
    }
  }

  private applyDamage(
    target: Fighter,
    raw: number,
    magic: boolean,
    crit: boolean,
    kind: AttackKind,
    knockback: number,
    ownerId = -1,
  ): void {
    if (!target.alive) return;
    const amount = Math.max(1, Math.round(raw * (magic ? 1 - target.def.ward : 1 - target.def.armor)));
    // 与えたダメージを数える(倒しすぎた分は数えない)。
    if (ownerId >= 0) {
      const owner = this.byId.get(ownerId);
      if (owner) owner.dealt += Math.min(amount, target.hp);
    }
    target.hp -= amount;
    this.events.push({ t: 'hit', id: target.id, x: target.x, amount, crit, kind, magic });
    const immune = isEnemyDef(target.def) && target.def.boss;
    if (knockback > 0 && !immune) {
      if (target.side === 'ally') target.x = Math.max(FIELD.castleX - 40, target.x - knockback);
      else target.x = Math.min(FIELD.portalX, target.x + knockback);
      if (knockback >= 30 && target.windup >= 0) {
        target.windup = -1;
        target.cooldown = Math.max(target.cooldown, 0.3);
      }
      this.events.push({ t: 'knockback', id: target.id });
    }
    if (target.hp <= 0) this.kill(target);
  }

  /** attackerSide の相手側で、x から radius 以内の兵にダメージ。 */
  private areaDamage(
    attackerSide: Side,
    x: number,
    radius: number,
    damage: number,
    magic: boolean,
    crit: boolean,
    hitsFlying: boolean,
    kind: AttackKind,
    knockback: number,
    hitsGround = true,
    ownerId = -1,
  ): void {
    for (const o of this.fighters) {
      if (!o.alive || o.side === attackerSide) continue;
      if (o.def.flying ? !hitsFlying : !hitsGround) continue;
      if (Math.abs(o.x - x) <= radius) this.applyDamage(o, damage, magic, crit, kind, knockback, ownerId);
    }
  }

  private kill(f: Fighter): void {
    if (!f.alive) return;
    f.alive = false;
    f.hp = 0;
    const bounty = f.side === 'enemy' && isEnemyDef(f.def) ? f.def.bounty : 0;
    if (bounty > 0) {
      this.gold += bounty;
      this.stats.goldEarned += bounty;
    }
    if (f.side === 'enemy') this.stats.kills++;
    this.events.push({ t: 'death', id: f.id, side: f.side, x: f.x, bounty });
    if (f.side === 'ally' && !isEnemyDef(f.def)) this.seedTree(f.def.id, f);
  }

  // ---- 木 ----

  /**
   * 倒れた兵の跡に木の芽を出す。戦った兵(与えたダメージが足りた兵)だけが木になる。
   * 近くに同じ種類の木があれば、新しく生やさずにその木を太らせる。
   */
  private seedTree(unit: UnitId, f: Fighter): void {
    if (f.dealt < TREE_RULES.minDamageDealt[unit]) return;
    const def = TREES[TREE_OF_UNIT[unit]];
    const near = this.trees.find((t) => t.alive && Math.abs(t.x - f.x) < TREE_RULES.minSpacing);
    if (near) {
      if (near.def.id !== def.id) return;
      const amount = Math.round(Math.min(near.maxHp - near.hp, near.maxHp * TREE_RULES.reinforceRatio));
      near.hp += amount;
      this.events.push({ t: 'treeReinforce', id: near.id, amount });
      return;
    }
    const alive = this.aliveTrees();
    if (alive.length >= TREE_RULES.maxTrees) {
      const oldest = alive.reduce((a, b) => (a.age >= b.age ? a : b));
      this.removeTree(oldest, 'replaced');
    }
    const tree: Tree = {
      id: this.nextId++,
      def,
      from: unit,
      x: f.x,
      row: f.row,
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
      growing: def.growTime,
      cooldown: 0,
      nectar: 0,
      age: 0,
    };
    this.trees.push(tree);
    this.treeById.set(tree.id, tree);
    this.stats.treesGrown++;
    this.events.push({ t: 'treeSeed', id: tree.id, tree: def.id, x: tree.x });
  }

  private removeTree(tree: Tree, reason: 'destroyed' | 'withered' | 'replaced' | 'uprooted' | 'burst'): void {
    if (!tree.alive) return;
    tree.alive = false;
    tree.hp = 0;
    this.events.push({ t: 'treeDie', id: tree.id, tree: tree.def.id, x: tree.x, reason });
  }

  private damageTree(tree: Tree, raw: number): void {
    if (!tree.alive) return;
    const amount = Math.max(1, Math.round(raw));
    tree.hp -= amount;
    this.events.push({ t: 'treeHit', id: tree.id, amount });
    if (tree.hp <= 0) this.removeTree(tree, 'destroyed');
  }

  private updateTrees(): void {
    for (const tree of this.trees) {
      if (!tree.alive) continue;
      tree.age += DT;
      if (tree.growing > 0) {
        tree.growing -= DT;
        if (tree.growing <= 0) this.events.push({ t: 'treeGrow', id: tree.id, tree: tree.def.id, x: tree.x });
        continue;
      }
      const def = tree.def;
      // 上に立つ地上の敵。穢れに踏まれると枯れていく。
      const onTop = this.fighters.filter(
        (e) => e.alive && e.side === 'enemy' && !e.def.flying && Math.abs(e.x - tree.x) <= def.radius,
      );
      tree.hp -= (def.decayPerSecond + def.trampleDps * onTop.length) * DT;
      if (tree.hp <= 0) {
        this.removeTree(tree, 'withered');
        continue;
      }
      tree.cooldown -= DT;

      if (def.thorn) {
        for (const e of onTop) {
          e.slowTimer = def.thorn.slowTime;
          e.slowMult = def.thorn.slowMult;
        }
        if (tree.cooldown <= 0 && onTop.length > 0) {
          tree.cooldown = def.thorn.interval;
          for (const e of onTop) {
            const before = e.hp;
            this.applyDamage(e, def.thorn.damage, false, false, 'melee', 0);
            this.events.push({ t: 'thornHit', treeId: tree.id, id: e.id, amount: before - Math.max(0, e.hp) });
          }
        }
      }

      if (def.shooter && tree.cooldown <= 0) {
        let target: Fighter | null = null;
        for (const e of this.fighters) {
          if (!e.alive || e.side !== 'enemy') continue;
          if (Math.abs(e.x - tree.x) > def.shooter.range) continue;
          if (!target || e.x < target.x) target = e;
        }
        if (target) {
          tree.cooldown = def.shooter.interval;
          const projectileId = this.launch(
            'ally',
            'arrow',
            tree.x,
            tree.row,
            target.id,
            def.shooter.damage,
            false,
            0,
            false,
            true,
            true,
            'tree',
            tree.id,
          );
          this.events.push({ t: 'treeShot', treeId: tree.id, projectileId });
        }
      }

      if (def.nectar) tree.nectar = Math.min(def.nectar.cap, tree.nectar + def.nectar.perSecond * DT);

      const pod = def.pod;
      if (pod && onTop.some((e) => Math.abs(e.x - tree.x) <= pod.trigger)) {
        this.areaDamage('ally', tree.x, pod.splash, pod.damage, false, false, false, 'bomb', pod.knockback);
        this.events.push({ t: 'explode', x: tree.x, row: tree.row, radius: pod.splash, kind: 'bomb' });
        this.events.push({ t: 'podBurst', treeId: tree.id, x: tree.x, radius: pod.splash });
        this.removeTree(tree, 'burst');
      }
    }
  }

  private damageCastle(amount: number, x: number): void {
    const rounded = Math.round(amount);
    if (!this.god) this.castle.hp -= rounded;
    this.events.push({ t: 'castleHit', amount: rounded, x });
    if (this.castle.hp <= 0) {
      this.castle.hp = 0;
      this.phase = 'defeat';
      this.events.push({ t: 'defeat' });
    }
  }

  // ---- タワー・城・飛び道具 ----

  private updateTowers(): void {
    for (const tower of this.towers) {
      if (!tower) continue;
      tower.cooldown -= DT;
      if (tower.cooldown > 0) continue;
      const def = tower.def;
      let target: Fighter | null = null;
      for (const e of this.fighters) {
        if (!e.alive || e.side !== 'enemy') continue;
        if (e.def.flying ? !def.hitsFlying : !def.hitsGround) continue;
        if (Math.abs(e.x - tower.x) > def.range) continue;
        if (!target || e.x < target.x) target = e;
      }
      if (!target) continue;
      tower.cooldown = def.interval;
      tower.aimX = target.x;
      this.launch('ally', def.attack, tower.x, -0.35, target.id, def.damage, false, def.splash, false, def.hitsFlying, def.hitsGround, 'tower', tower.slot);
      this.events.push({ t: 'towerShot', slot: tower.slot });
    }
  }

  private updateCastle(): void {
    this.castle.cooldown -= DT;
    if (this.castle.cooldown > 0) return;
    let target: Fighter | null = null;
    for (const e of this.fighters) {
      if (!e.alive || e.side !== 'enemy') continue;
      if (e.x - FIELD.castleX > CASTLE_ARCHER.range) continue;
      if (!target || e.x < target.x) target = e;
    }
    if (!target) return;
    this.castle.cooldown = CASTLE_ARCHER.interval;
    this.launch('ally', 'arrow', FIELD.castleX - 50, -0.6, target.id, CASTLE_ARCHER.damage, false, 0, false, true, true, 'castle', -1);
    this.events.push({ t: 'castleShot' });
  }

  private launch(
    side: Side,
    kind: AttackKind,
    x: number,
    row: number,
    targetId: number,
    damage: number,
    crit: boolean,
    splash: number,
    magic: boolean,
    hitsFlying: boolean,
    hitsGround: boolean,
    source: Projectile['source'],
    sourceSlot: number,
    ownerId = -1,
  ): number {
    const target = targetId === CASTLE_TARGET ? undefined : this.byId.get(targetId);
    const projectile: Projectile = {
      id: this.nextId++,
      side,
      kind,
      startX: x,
      x,
      startRow: row,
      targetId,
      targetX: target ? target.x : FIELD.castleX - 40,
      targetRow: target ? target.row : -0.5,
      targetFlying: target ? target.def.flying : false,
      speed: PROJECTILE_SPEED[kind] ?? 400,
      damage,
      crit,
      splash,
      magic,
      hitsFlying,
      hitsGround,
      source,
      sourceSlot,
      ownerId,
    };
    this.projectiles.push(projectile);
    this.events.push({ t: 'shoot', projectileId: projectile.id });
    return projectile.id;
  }

  private updateProjectiles(): void {
    const remaining: Projectile[] = [];
    for (const p of this.projectiles) {
      const target = p.targetId === CASTLE_TARGET ? undefined : this.byId.get(p.targetId);
      if (target && target.alive) {
        p.targetX = target.x;
        p.targetRow = target.row;
      }
      const dist = p.targetX - p.x;
      const step = p.speed * DT;
      if (Math.abs(dist) > step) {
        p.x += Math.sign(dist) * step;
        remaining.push(p);
        continue;
      }
      p.x = p.targetX;
      this.impact(p, target);
    }
    this.projectiles = remaining;
  }

  private impact(p: Projectile, target: Fighter | undefined): void {
    if (p.targetId === CASTLE_TARGET) {
      this.damageCastle(p.damage, p.x);
      return;
    }
    if (p.splash > 0) {
      this.areaDamage(p.side, p.targetX, p.splash, p.damage, p.magic, p.crit, p.hitsFlying, p.kind, 0, p.hitsGround, p.ownerId);
      if (p.kind === 'cannon') this.events.push({ t: 'explode', x: p.targetX, row: p.targetRow, radius: p.splash, kind: 'cannon' });
      return;
    }
    if (target && target.alive) this.applyDamage(target, p.damage, p.magic, p.crit, p.kind, 0, p.ownerId);
  }

  private updateMeteors(): void {
    const remaining: PendingMeteor[] = [];
    for (const m of this.meteors) {
      m.timer -= DT;
      if (m.timer > 0) {
        remaining.push(m);
        continue;
      }
      this.areaDamage('ally', m.x, METEOR_RADIUS, METEOR_DAMAGE, true, false, true, 'bomb', 40);
      this.events.push({ t: 'explode', x: m.x, row: 0.5, radius: METEOR_RADIUS, kind: 'meteor' });
    }
    this.meteors = remaining;
  }
}
