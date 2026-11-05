import type { UnitId } from '../sim/types.ts';

// 戦闘をまたいで残る強化。戦闘で集めた「葉」で買う。
// 3つの系統: 兵(兵そのもの)・森(倒れた兵が生る木)・城。
// 1つ1つの強化は WorldMods のどれか1つの値を動かす(src/meta.ts の modsFromSave)。
// 全部買うのに要る葉の合計は、全ステージを星3つにした分 + 少しの遊び直し(test/meta.test.ts で確かめる)。

export type UpgradeBranch = 'soldiers' | 'grove' | 'castle';

/** 強化が WorldMods のどこに効くか。perLevel は1段ごとに足す量。 */
export type UpgradeEffect =
  | { kind: 'unitHp'; unit: UnitId; perLevel: number }
  | { kind: 'unitDamage'; unit: UnitId; perLevel: number }
  | { kind: 'treeHp'; perLevel: number }
  /** 枯れる速さを perLevel ずつ減らす(倍率 1 - perLevel×段)。 */
  | { kind: 'treeDecay'; perLevel: number }
  | { kind: 'maxTrees'; perLevel: number }
  | { kind: 'harvest'; perLevel: number }
  | { kind: 'castleHp'; perLevel: number }
  | { kind: 'startGold'; perLevel: number }
  | { kind: 'manaRegen'; perLevel: number };

export interface UpgradeDef {
  id: string;
  branch: UpgradeBranch;
  effect: UpgradeEffect;
  /** 段ごとの値段(葉)。長さが最大の段数。 */
  costs: readonly number[];
}

export const BRANCHES: readonly UpgradeBranch[] = ['soldiers', 'grove', 'castle'];

export const UPGRADES: readonly UpgradeDef[] = [
  // ---- 兵 ----
  { id: 'swordHp', branch: 'soldiers', effect: { kind: 'unitHp', unit: 'sword', perLevel: 0.1 }, costs: [6, 12, 20, 30] },
  { id: 'swordDamage', branch: 'soldiers', effect: { kind: 'unitDamage', unit: 'sword', perLevel: 0.1 }, costs: [6, 12, 20, 30] },
  { id: 'archerDamage', branch: 'soldiers', effect: { kind: 'unitDamage', unit: 'archer', perLevel: 0.1 }, costs: [6, 12, 20, 30] },
  { id: 'mageDamage', branch: 'soldiers', effect: { kind: 'unitDamage', unit: 'mage', perLevel: 0.1 }, costs: [8, 15, 25, 36] },
  { id: 'bomberHp', branch: 'soldiers', effect: { kind: 'unitHp', unit: 'bomber', perLevel: 0.15 }, costs: [8, 16, 28] },
  // ---- 森 ----
  { id: 'treeHp', branch: 'grove', effect: { kind: 'treeHp', perLevel: 0.12 }, costs: [8, 15, 25, 36] },
  { id: 'treeDecay', branch: 'grove', effect: { kind: 'treeDecay', perLevel: 0.12 }, costs: [8, 15, 25, 36] },
  { id: 'maxTrees', branch: 'grove', effect: { kind: 'maxTrees', perLevel: 1 }, costs: [30, 60] },
  { id: 'harvest', branch: 'grove', effect: { kind: 'harvest', perLevel: 0.15 }, costs: [10, 20, 32] },
  // ---- 城 ----
  { id: 'castleHp', branch: 'castle', effect: { kind: 'castleHp', perLevel: 100 }, costs: [6, 12, 20, 30] },
  { id: 'startGold', branch: 'castle', effect: { kind: 'startGold', perLevel: 25 }, costs: [8, 15, 25, 36] },
  { id: 'manaRegen', branch: 'castle', effect: { kind: 'manaRegen', perLevel: 0.1 }, costs: [10, 20, 32] },
];

/** 戦闘の結果でもらえる葉。地域が進むほど regionMult 倍。 */
export const LEAF_REWARDS = {
  /** 勝てば毎回。 */
  win: 8,
  /** そのステージを初めて勝った時に足す。 */
  firstClear: 20,
  /** これまでより多く取れた星1つごと。 */
  perNewStar: 10,
  /** 負けても少しもらえる(育てて再挑戦できるように)。 */
  defeat: 3,
  regionMult: { 1: 1, 2: 1.5, 3: 2 } as Record<number, number>,
};
