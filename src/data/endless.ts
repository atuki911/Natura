import type { EnemyId } from '../sim/types.ts';

// 耐久モードの作り方。数字を変えたら tools/balance.ts で何ウェーブ耐えられるかを確かめる。
export const ENDLESS = {
  /** この番号のウェーブから、その敵が混ざり始める。 */
  pools: [
    { from: 1, enemies: ['blightling', 'gnasher'] },
    { from: 3, enemies: ['wisp', 'tuskbeast'] },
    { from: 5, enemies: ['rollereye', 'rotMoth'] },
    { from: 8, enemies: ['burrower'] },
  ] as { from: number; enemies: EnemyId[] }[],
  /** 敵1体の重さ(数を決める時に使う)。 */
  cost: { blightling: 1, gnasher: 0.8, wisp: 1.4, tuskbeast: 3, rollereye: 2, rotMoth: 1.2, burrower: 2.2 } as Partial<Record<EnemyId, number>>,
  baseBudget: 8,
  budgetPerWave: 2.2,
  bossEvery: 6,
  /** 耐久モードのボスの強さの倍率(本編より弱め。何度も来るため)。 */
  bossScale: 0.4,
  bosses: ['mireMaw', 'sporeMother', 'blightHeart'] as EnemyId[],
  /** 1ウェーブごとに敵が強くなる割合。 */
  powerPerWave: 0.07,
};
