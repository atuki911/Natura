import type { TreeDef, TreeId, UnitId } from '../sim/types.ts';

// 倒れた兵は木になる。兵の種類ごとに、戦場に残る木が違う。
// 数字を変えたら `node tools/metrics.ts 30` で勝率と待ち時間を確かめる。

export const TREES: Record<TreeId, TreeDef> = {
  /** 剣士の跡。地上の敵の足を止める茨の茂み。近くの敵を刺し、足を遅くする。木の実(ゴールド)が少しなる。 */
  thornBush: {
    id: 'thornBush',
    hp: 450,
    growTime: 2.5,
    decayPerSecond: 1.5,
    radius: 90,
    blocks: true,
    trampleDps: 0,
    thorn: { damage: 18, interval: 0.5, slowMult: 0.5, slowTime: 1.5 },
    shooter: null,
    nectar: { perSecond: 1, cap: 6, minHarvest: 2, manaPer: 0, goldPer: 1 },
    pod: null,
    uprootGold: 15,
  },
  /** 弓兵の跡。届く敵をゆっくり撃つ見張りの木。果実(ゴールド)がなる。 */
  watchTree: {
    id: 'watchTree',
    hp: 160,
    growTime: 3,
    decayPerSecond: 0.8,
    radius: 26,
    blocks: false,
    trampleDps: 6,
    thorn: null,
    shooter: { range: 230, damage: 11, interval: 1.8 },
    nectar: { perSecond: 1, cap: 6, minHarvest: 2, manaPer: 0, goldPer: 1.5 },
    pod: null,
    uprootGold: 25,
  },
  /** 魔法使いの跡。蜜をためる花。摘むとマナとゴールドになる。 */
  manaFlower: {
    id: 'manaFlower',
    hp: 110,
    growTime: 3,
    decayPerSecond: 0.5,
    radius: 22,
    blocks: false,
    trampleDps: 8,
    thorn: null,
    shooter: null,
    nectar: { perSecond: 1, cap: 12, minHarvest: 4, manaPer: 3, goldPer: 2 },
    pod: null,
    uprootGold: 10,
  },
  /** 爆弾兵の跡。敵が近づくとはじける種の莢(さや)。 */
  seedPod: {
    id: 'seedPod',
    hp: 60,
    growTime: 4,
    decayPerSecond: 0.5,
    radius: 20,
    blocks: false,
    trampleDps: 0,
    thorn: null,
    shooter: null,
    nectar: null,
    pod: { trigger: 30, damage: 200, splash: 80, knockback: 30 },
    uprootGold: 20,
  },
};

/** どの兵がどの木になるか。 */
export const TREE_OF_UNIT: Record<UnitId, TreeId> = {
  sword: 'thornBush',
  archer: 'watchTree',
  mage: 'manaFlower',
  bomber: 'seedPod',
};

export const TREE_RULES = {
  /** 戦場に同時に生えられる木の数。超えたら一番古い木が枯れる。 */
  maxTrees: 8,
  /** この距離以内に同じ種類の木があれば、新しく生えずにその木を太らせる。違う種類なら生えない。 */
  minSpacing: 30,
  /** 太らせる時に戻る HP の割合。 */
  reinforceRatio: 0.5,
  /** 倒れた場所に木がある時、城の側へ何か所まで空きを探すか。 */
  spreadSteps: 4,
  /**
   * 木になるのに要る、兵が与えたダメージの合計。
   * 戦わずに倒れた兵(出してすぐ死ぬ兵)では木が生えない。
   */
  minDamageDealt: { sword: 30, archer: 24, mage: 40, bomber: 1 } as Record<UnitId, number>,
  /** 回復の能力が木を治す割合。 */
  healRatio: 0.5,
};
