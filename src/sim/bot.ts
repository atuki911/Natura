import { ABILITIES, METEOR_RADIUS, TOWERS } from '../data/towers.ts';
import { UNITS } from '../data/units.ts';
import type { World } from './world.ts';
import type { TowerId, UnitId } from './types.ts';

/**
 * 自動で遊ぶ相手。バランス検証(tools/balance.ts)と、
 * ブラウザの自動プレイ(?autoplay)の両方で使う。
 */
export interface BotStyle {
  name: string;
  /** 何秒ごとに考えるか。人の操作の速さに近づける。 */
  thinkEvery: number;
  /** 出すユニットの比率。 */
  mix: Partial<Record<UnitId, number>>;
  /** タワーを建てるか。 */
  buildTowers: boolean;
  /** 能力を使うか。 */
  useAbilities: boolean;
  /** 休憩を切り上げて次のウェーブを呼ぶか。 */
  callEarly: boolean;
}

export const BOT_STYLES: Record<string, BotStyle> = {
  /** ふつうの上手さの人。目安の勝率はここで測る。 */
  standard: {
    name: 'standard',
    thinkEvery: 0.6,
    mix: { sword: 4, archer: 3, mage: 1.5, bomber: 1 },
    buildTowers: true,
    useAbilities: true,
    callEarly: false,
  },
  /** 近接で押す作戦。剣士と爆弾兵が中心。 */
  rush: {
    name: 'rush',
    thinkEvery: 0.6,
    mix: { sword: 5, bomber: 2, archer: 1 },
    buildTowers: false,
    useAbilities: true,
    callEarly: false,
  },
  /** 遠距離とタワーで守る作戦。 */
  ranged: {
    name: 'ranged',
    thinkEvery: 0.6,
    mix: { archer: 4, sword: 2 },
    buildTowers: true,
    useAbilities: true,
    callEarly: false,
  },
  /** 魔法と能力に頼る作戦。 */
  magic: {
    name: 'magic',
    thinkEvery: 0.6,
    mix: { mage: 3, sword: 2 },
    buildTowers: false,
    useAbilities: true,
    callEarly: false,
  },
  /** 剣士だけを出す、考えない人。勝てないくらいがよい。 */
  swordOnly: {
    name: 'swordOnly',
    thinkEvery: 0.6,
    mix: { sword: 1 },
    buildTowers: false,
    useAbilities: false,
    callEarly: false,
  },
  /** 何もしない。城の弓兵だけで勝ててはいけない。 */
  idle: {
    name: 'idle',
    thinkEvery: 1,
    mix: {},
    buildTowers: false,
    useAbilities: false,
    callEarly: false,
  },
};

export class Bot {
  private timer = 0;
  private counts: Partial<Record<UnitId, number>> = {};
  private readonly style: BotStyle;

  constructor(style: BotStyle) {
    this.style = style;
  }

  /** world.step() の前に毎回呼ぶ。 */
  tick(world: World, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0 || world.ended) return;
    this.timer = this.style.thinkEvery;
    const style = this.style;

    if (style.useAbilities) this.useAbilities(world);

    if (style.buildTowers && world.wavesStarted >= 2) {
      const slot = world.towers.findIndex((t) => t === null);
      if (slot >= 0) {
        const tower: TowerId = slot === 1 ? 'cannonTower' : 'arrowTower';
        // ユニットを出すお金を残してから建てる。
        if (world.gold >= TOWERS[tower].cost.gold + 150) {
          world.command({ type: 'build', slot, tower });
          return;
        }
      }
    }

    const unit = this.pickUnit(world);
    if (unit && world.canSpawn(unit)) {
      world.command({ type: 'spawn', unit });
      this.counts[unit] = (this.counts[unit] ?? 0) + 1;
    }

    if (style.callEarly && world.phase === 'break' && world.allies().length >= 8) {
      world.command({ type: 'nextWave' });
    }
  }

  /** 比率に対して一番足りないユニットを選ぶ。 */
  private pickUnit(world: World): UnitId | null {
    const mix = { ...this.style.mix };
    const enemies = world.enemies();
    // 硬い敵やボスがいれば魔法使いを、固まっていれば爆弾兵を増やす。
    if (enemies.some((e) => e.def.armor >= 0.3) && mix.mage) mix.mage *= 2;
    if (enemies.length >= 8 && mix.bomber) mix.bomber *= 2;
    let best: UnitId | null = null;
    let bestScore = Infinity;
    for (const [unit, weight] of Object.entries(mix) as [UnitId, number][]) {
      if (!weight) continue;
      if (UNITS[unit].cost.mana > world.mana - (this.style.useAbilities ? 30 : 0)) continue;
      const score = (this.counts[unit] ?? 0) / weight;
      if (score < bestScore) {
        best = unit;
        bestScore = score;
      }
    }
    return best;
  }

  private useAbilities(world: World): void {
    const enemies = world.enemies();
    if (world.canUseAbility('meteor') && enemies.length > 0) {
      // 一番多く巻き込める場所に落とす。
      let bestX = 0;
      let bestCount = 0;
      for (const e of enemies) {
        const count = enemies.filter((o) => Math.abs(o.x - e.x) <= METEOR_RADIUS).length;
        const weighted = count + (world.boss() && Math.abs(world.boss()!.x - e.x) <= METEOR_RADIUS ? 4 : 0);
        if (weighted > bestCount) {
          bestCount = weighted;
          bestX = e.x;
        }
      }
      if (bestCount >= 5) {
        world.command({ type: 'ability', ability: 'meteor', x: bestX });
        return;
      }
    }
    if (world.canUseAbility('heal')) {
      const allies = world.allies();
      const hurt = allies.filter((a) => a.hp < a.maxHp * 0.5).length;
      const castleLow = world.castle.hp < world.castle.maxHp * 0.6;
      if (hurt >= 4 || (castleLow && world.mana >= ABILITIES.heal.mana + 20)) {
        world.command({ type: 'ability', ability: 'heal' });
      }
    }
  }
}
