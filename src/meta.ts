import { STAGES } from './data/stages.ts';
import { LEAF_REWARDS, UPGRADES, type UpgradeDef, type UpgradeEffect } from './data/upgrades.ts';
import { defaultSave, loadSave, writeSave, type SaveData } from './save.ts';
import { NO_MODS, type WorldMods } from './sim/types.ts';

// 戦闘をまたぐ成長。葉(通貨)を集めて強化を買い、次の戦闘の World に WorldMods として渡す。
// 計算の本体は SaveData を受け取る純粋な関数。保存の読み書きは SaveStore を通す(テストでは memoryStore)。

export interface SaveStore {
  load(): SaveData;
  write(data: SaveData): void;
}

/** ブラウザの保存(localStorage)。 */
export const browserStore: SaveStore = { load: loadSave, write: writeSave };

/** 保存先のない場所(Node のテストなど)で使う、メモリだけの保存。 */
export function memoryStore(initial: Partial<SaveData> = {}): SaveStore {
  let data: SaveData = { ...defaultSave(), ...structuredClone(initial) };
  return {
    load: () => structuredClone(data),
    write: (d) => {
      data = structuredClone(d);
    },
  };
}

export interface StageReward {
  leaves: number;
  firstClear: boolean;
  /** 新しく葉に換えた星の数。 */
  newStars: number;
}

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export function upgradeDef(id: string): UpgradeDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`強化 ${id} がありません`);
  return def;
}

export function maxLevel(def: UpgradeDef): number {
  return def.costs.length;
}

/** 買ってある段数(データの最大を超えない)。 */
export function levelIn(data: SaveData, id: string): number {
  const def = upgradeDef(id);
  return Math.max(0, Math.min(maxLevel(def), Math.floor(data.upgrades?.[id] ?? 0)));
}

/** 次の段の値段。最大なら null。 */
export function nextCostIn(data: SaveData, id: string): number | null {
  const def = upgradeDef(id);
  const lv = levelIn(data, id);
  return lv >= maxLevel(def) ? null : def.costs[lv];
}

export function canBuyIn(data: SaveData, id: string): boolean {
  const cost = nextCostIn(data, id);
  return cost !== null && (data.leaves ?? 0) >= cost;
}

/** 買えたら data を書き換えて true。 */
export function applyPurchase(data: SaveData, id: string): boolean {
  if (!canBuyIn(data, id)) return false;
  const cost = nextCostIn(data, id)!;
  data.leaves -= cost;
  data.upgrades = { ...data.upgrades, [id]: levelIn(data, id) + 1 };
  return true;
}

/** 段数 level の時の効き目の合計(+0.2 = +20%、+100 = 体力 +100 など)。 */
export function effectAt(effect: UpgradeEffect, level: number): number {
  return effect.perLevel * level;
}

/** 買ってある強化を、戦闘に渡す WorldMods にする。 */
export function modsFromLevels(levels: Record<string, number>): WorldMods {
  const mods: WorldMods = { ...NO_MODS, unitHpMult: {}, unitDamageMult: {} };
  for (const def of UPGRADES) {
    const lv = Math.max(0, Math.min(maxLevel(def), Math.floor(levels[def.id] ?? 0)));
    if (lv === 0) continue;
    const v = effectAt(def.effect, lv);
    const e = def.effect;
    switch (e.kind) {
      case 'unitHp':
        mods.unitHpMult[e.unit] = (mods.unitHpMult[e.unit] ?? 1) + v;
        break;
      case 'unitDamage':
        mods.unitDamageMult[e.unit] = (mods.unitDamageMult[e.unit] ?? 1) + v;
        break;
      case 'treeHp':
        mods.treeHpMult += v;
        break;
      case 'treeDecay':
        mods.treeDecayMult -= v;
        break;
      case 'maxTrees':
        mods.maxTreesBonus += v;
        break;
      case 'harvest':
        mods.harvestMult += v;
        break;
      case 'castleHp':
        mods.castleHpBonus += v;
        break;
      case 'startGold':
        mods.startGoldBonus += v;
        break;
      case 'manaRegen':
        mods.manaRegenMult += v;
        break;
    }
  }
  return mods;
}

function regionMult(stageId: string): number {
  const stage = STAGES.find((s) => s.id === stageId);
  return LEAF_REWARDS.regionMult[stage?.region ?? 1] ?? 1;
}

/** 戦闘の結果でもらえる葉を計算する(data は変えない)。 */
export function computeReward(data: SaveData, stageId: string, stars: number, victory: boolean): StageReward {
  const mult = regionMult(stageId);
  if (!victory) return { leaves: Math.round(LEAF_REWARDS.defeat * mult), firstClear: false, newStars: 0 };
  const got = Math.max(0, Math.min(3, Math.floor(stars)));
  const firstClear = !data.cleared?.[stageId];
  const newStars = Math.max(0, got - (data.rewardedStars?.[stageId] ?? 0));
  const base = LEAF_REWARDS.win + (firstClear ? LEAF_REWARDS.firstClear : 0) + newStars * LEAF_REWARDS.perNewStar;
  return { leaves: Math.round(base * mult), firstClear, newStars };
}

/** 戦闘の結果を data に書き込み、もらえた葉を返す。 */
export function applyReward(data: SaveData, stageId: string, stars: number, victory: boolean): StageReward {
  const reward = computeReward(data, stageId, stars, victory);
  data.leaves = (data.leaves ?? 0) + reward.leaves;
  if (victory) {
    data.cleared = { ...data.cleared, [stageId]: true };
    const before = data.rewardedStars?.[stageId] ?? 0;
    data.rewardedStars = { ...data.rewardedStars, [stageId]: before + reward.newStars };
  }
  return reward;
}

/** 全部の強化を最大まで買うのに要る葉。 */
export function totalUpgradeCost(): number {
  return UPGRADES.reduce((sum, u) => sum + u.costs.reduce((a, b) => a + b, 0), 0);
}

// ---- 保存を読み書きする入口(画面から使う) ----

export function modsFromSave(store: SaveStore = browserStore): WorldMods {
  return modsFromLevels(store.load().upgrades ?? {});
}

export function awardStageResult(stageId: string, stars: number, victory: boolean, store: SaveStore = browserStore): StageReward {
  const data = store.load();
  const reward = applyReward(data, stageId, stars, victory);
  store.write(data);
  return reward;
}

export function buyUpgrade(id: string, store: SaveStore = browserStore): boolean {
  const data = store.load();
  if (!applyPurchase(data, id)) return false;
  store.write(data);
  return true;
}

export function canBuy(id: string, store: SaveStore = browserStore): boolean {
  return canBuyIn(store.load(), id);
}

export function upgradeLevel(id: string, store: SaveStore = browserStore): number {
  return levelIn(store.load(), id);
}

export function leafCount(store: SaveStore = browserStore): number {
  return store.load().leaves ?? 0;
}
