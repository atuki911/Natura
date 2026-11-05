import { ENDLESS } from '../data/endless.ts';
import type { Rng } from './rng.ts';
import type { EnemyId, SpawnGroup, WaveDef } from './types.ts';

// 耐久モードのウェーブを作る。番号が進むほど、敵の数と種類が増え、5の倍数でボスが来る。
// 同じ種なら同じ並びになる(乱数は world.rng)。

export function endlessWave(n: number, rng: Rng): WaveDef {
  const pool = ENDLESS.pools.filter((p) => n >= p.from).flatMap((p) => p.enemies);
  const budget = ENDLESS.baseBudget + n * ENDLESS.budgetPerWave;
  const groups: SpawnGroup[] = [];
  const kinds = Math.min(4, 1 + Math.floor(n / 3));
  for (let k = 0; k < kinds; k++) {
    const enemy = pool[Math.floor(rng.next() * pool.length)] as EnemyId;
    const cost = ENDLESS.cost[enemy] ?? 1;
    const count = Math.max(1, Math.round(budget / kinds / cost));
    groups.push({ enemy, count, interval: Math.max(0.35, 1.6 - n * 0.04), delay: k * 3 });
  }
  if (n % ENDLESS.bossEvery === 0) {
    const bosses = ENDLESS.bosses;
    groups.push({ enemy: bosses[Math.floor(n / ENDLESS.bossEvery - 1) % bosses.length], count: 1, interval: 1, delay: 2 });
  }
  return { groups };
}

/** 耐久モードの敵の強さの倍率(ウェーブが進むほど強くなる)。 */
export function endlessPower(n: number): number {
  return 1 + (n - 1) * ENDLESS.powerPerWave;
}
