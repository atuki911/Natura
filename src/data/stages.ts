import type { SpawnGroup, StageDef } from '../sim/types.ts';

// ステージ。3つの地域 × 3ステージ。各地域の最後にボス。
// 数字を変えたら `npm run balance -- 40 all` で全ステージの勝率を確かめる。

const g = (enemy: SpawnGroup['enemy'], count: number, interval: number, delay = 0): SpawnGroup => ({
  enemy,
  count,
  interval,
  delay,
});

const ALL_UNITS: StageDef['units'] = ['sword', 'archer', 'mage', 'bomber'];

// ---- 地域1: 緑の境 ----

export const STAGE_1_1: StageDef = {
  id: '1-1',
  region: 1,
  index: 1,
  name: { en: 'First Sprouts', ja: 'はじめの芽吹き' },
  background: 'bg_stage1',
  units: ['sword', 'archer'],
  tutorial: true,
  // 最初のステージでも兵が倒れて木が生えるよう、敵は強め。
  enemyHpScale: 2.5,
  enemyDamageScale: 3.5,
  startGold: 220,
  startMana: 60,
  castleHp: 900,
  firstBreak: 7,
  breakTime: 12,
  waves: [
    { groups: [g('blightling', 6, 1.4), g('gnasher', 3, 0.8, 5)] },
    { groups: [g('blightling', 8, 1.1), g('gnasher', 5, 0.7, 3)] },
    { groups: [g('gnasher', 10, 0.6), g('blightling', 6, 1, 4)] },
    { groups: [g('blightling', 10, 0.8), g('gnasher', 8, 0.5, 4)] },
    { groups: [g('gnasher', 14, 0.45), g('blightling', 10, 0.7, 3)] },
  ],
};

export const STAGE_1_2: StageDef = {
  id: '1-2',
  region: 1,
  index: 2,
  name: { en: 'Whispering Meadow', ja: 'ささやく草原' },
  background: 'bg_stage1',
  units: ['sword', 'archer', 'mage'],
  enemyHpScale: 2.0,
  enemyDamageScale: 2.0,
  startGold: 240,
  startMana: 60,
  castleHp: 900,
  firstBreak: 10,
  breakTime: 12,
  waves: [
    { groups: [g('blightling', 7, 1.6)] },
    { groups: [g('blightling', 6, 1.4), g('wisp', 3, 2, 5)] },
    { groups: [g('gnasher', 8, 0.9), g('wisp', 3, 1.8, 4)] },
    { groups: [g('blightling', 6, 1.4), g('tuskbeast', 2, 4, 3)] },
    { groups: [g('tuskbeast', 3, 3), g('wisp', 5, 1.6, 4), g('blightling', 6, 1.2, 6)] },
    { groups: [g('gnasher', 12, 0.6), g('wisp', 5, 1.4, 4)] },
    { groups: [g('tuskbeast', 5, 2.5), g('blightling', 10, 0.9, 2), g('wisp', 6, 1.4, 5)] },
  ],
};

/** 地域1の最後。泥沼の大口(ボス)。 */
export const STAGE_1_3: StageDef = {
  id: '1-3',
  region: 1,
  index: 3,
  name: { en: 'The Mire Maw', ja: '泥沼の大口' },
  background: 'bg_stage1',
  units: ALL_UNITS,
  enemyHpScale: 1.0,
  enemyDamageScale: 1.0,
  startGold: 250,
  startMana: 60,
  castleHp: 900,
  firstBreak: 10,
  breakTime: 12,
  waves: [
    { groups: [g('blightling', 6, 1.8)] },
    { groups: [g('blightling', 8, 1.5), g('gnasher', 4, 1.2, 6)] },
    { groups: [g('blightling', 10, 1.2), g('gnasher', 6, 0.9, 4)] },
    { groups: [g('blightling', 6, 1.4), g('tuskbeast', 2, 4, 3), g('wisp', 4, 2, 8)] },
    { groups: [g('gnasher', 10, 0.7), g('rollereye', 3, 3, 4), g('blightling', 6, 1.2, 8)] },
    { groups: [g('tuskbeast', 4, 3), g('wisp', 6, 1.6, 4), g('blightling', 8, 1, 2)] },
    { groups: [g('gnasher', 14, 0.6), g('rollereye', 4, 2.5, 3), g('wisp', 6, 1.5, 6)] },
    { groups: [g('tuskbeast', 6, 2.5), g('blightling', 10, 0.9, 2), g('wisp', 6, 1.4, 5), g('rollereye', 3, 3, 9)] },
    { groups: [g('tuskbeast', 8, 2.2), g('wisp', 8, 1.2, 3), g('gnasher', 14, 0.5, 6), g('rollereye', 4, 2, 10)] },
    { groups: [g('mireMaw', 1, 1, 2), g('blightling', 10, 1.5), g('wisp', 6, 2.5, 6)] },
  ],
};

// ---- 地域2: 腐れ沼 ----

export const STAGE_2_1: StageDef = {
  id: '2-1',
  region: 2,
  index: 1,
  name: { en: 'The Rotting Mire', ja: '腐れ沼' },
  background: 'bg_region2',
  units: ALL_UNITS,
  enemyHpScale: 1.9,
  enemyDamageScale: 1.9,
  startGold: 260,
  startMana: 60,
  castleHp: 900,
  firstBreak: 10,
  breakTime: 12,
  waves: [
    { groups: [g('blightling', 8, 1.4), g('rotMoth', 3, 2, 5)] },
    { groups: [g('gnasher', 8, 0.9), g('rotMoth', 4, 1.6, 3)] },
    { groups: [g('tuskbeast', 3, 3), g('rotMoth', 5, 1.4, 4), g('blightling', 6, 1.2, 2)] },
    { groups: [g('wisp', 5, 1.6), g('rotMoth', 6, 1.2, 3), g('gnasher', 8, 0.7, 6)] },
    { groups: [g('tuskbeast', 5, 2.4), g('rollereye', 3, 3, 4), g('rotMoth', 6, 1.2, 6)] },
    { groups: [g('blightling', 12, 0.8), g('rotMoth', 8, 1, 4), g('wisp', 5, 1.6, 8)] },
    { groups: [g('tuskbeast', 6, 2.2), g('gnasher', 12, 0.6, 3), g('rotMoth', 8, 1, 6)] },
    { groups: [g('tuskbeast', 7, 2), g('wisp', 8, 1.2, 3), g('rotMoth', 10, 0.9, 5), g('rollereye', 4, 2.5, 8)] },
  ],
};

export const STAGE_2_2: StageDef = {
  id: '2-2',
  region: 2,
  index: 2,
  name: { en: 'Tunnels Below', ja: '地の下の道' },
  background: 'bg_region2',
  units: ALL_UNITS,
  enemyHpScale: 1.64,
  enemyDamageScale: 1.64,
  startGold: 260,
  startMana: 60,
  castleHp: 900,
  firstBreak: 10,
  breakTime: 12,
  waves: [
    { groups: [g('blightling', 8, 1.3), g('burrower', 2, 3, 5)] },
    { groups: [g('burrower', 4, 2.2), g('gnasher', 8, 0.8, 3)] },
    { groups: [g('rotMoth', 6, 1.3), g('burrower', 4, 2, 4)] },
    { groups: [g('tuskbeast', 4, 2.6), g('burrower', 5, 1.8, 3), g('wisp', 4, 1.8, 6)] },
    { groups: [g('burrower', 6, 1.6), g('rotMoth', 6, 1.2, 2), g('rollereye', 3, 3, 6)] },
    { groups: [g('gnasher', 14, 0.6), g('burrower', 6, 1.6, 4), g('wisp', 6, 1.4, 6)] },
    { groups: [g('tuskbeast', 6, 2.2), g('burrower', 7, 1.4, 3), g('rotMoth', 8, 1, 6)] },
    { groups: [g('tuskbeast', 7, 2), g('burrower', 8, 1.2, 2), g('rotMoth', 8, 1, 4), g('wisp', 6, 1.4, 8)] },
  ],
};

/** 地域2の最後。胞子の母(ボス)。 */
export const STAGE_2_3: StageDef = {
  id: '2-3',
  region: 2,
  index: 3,
  name: { en: 'The Spore Mother', ja: '胞子の母' },
  background: 'bg_region2',
  units: ALL_UNITS,
  enemyHpScale: 0.92,
  enemyDamageScale: 0.92,
  startGold: 270,
  startMana: 60,
  castleHp: 900,
  firstBreak: 10,
  breakTime: 12,
  waves: [
    { groups: [g('blightling', 10, 1.2), g('rotMoth', 4, 1.6, 4)] },
    { groups: [g('burrower', 4, 2), g('gnasher', 10, 0.7, 3)] },
    { groups: [g('tuskbeast', 4, 2.6), g('rotMoth', 6, 1.2, 3)] },
    { groups: [g('wisp', 6, 1.4), g('burrower', 5, 1.8, 3), g('rollereye', 3, 3, 6)] },
    { groups: [g('tuskbeast', 6, 2.2), g('rotMoth', 8, 1, 3), g('gnasher', 10, 0.6, 6)] },
    { groups: [g('burrower', 8, 1.4), g('wisp', 6, 1.4, 3), g('blightling', 10, 0.8, 6)] },
    { groups: [g('tuskbeast', 7, 2), g('rollereye', 5, 2, 3), g('rotMoth', 10, 0.9, 6)] },
    { groups: [g('tuskbeast', 8, 1.8), g('burrower', 8, 1.2, 3), g('wisp', 8, 1.2, 6)] },
    { groups: [g('gnasher', 18, 0.45), g('rotMoth', 12, 0.8, 3), g('burrower', 8, 1.2, 8)] },
    { groups: [g('sporeMother', 1, 1, 2), g('blightling', 10, 1.4), g('burrower', 6, 2.5, 8)] },
  ],
};

// ---- 地域3: 穢れの心臓 ----

export const STAGE_3_1: StageDef = {
  id: '3-1',
  region: 3,
  index: 1,
  name: { en: 'Ashen Approach', ja: '灰の道' },
  background: 'bg_region3',
  units: ALL_UNITS,
  enemyHpScale: 0.97,
  enemyDamageScale: 0.97,
  startGold: 280,
  startMana: 80,
  castleHp: 900,
  firstBreak: 10,
  breakTime: 12,
  waves: [
    { groups: [g('gnasher', 12, 0.7), g('rotMoth', 4, 1.6, 4)] },
    { groups: [g('tuskbeast', 4, 2.4), g('burrower', 4, 2, 3)] },
    { groups: [g('wisp', 8, 1.2), g('rollereye', 4, 2.4, 3)] },
    { groups: [g('tuskbeast', 6, 2.2), g('rotMoth', 8, 1, 3), g('gnasher', 10, 0.6, 6)] },
    { groups: [g('burrower', 8, 1.4), g('wisp', 8, 1.2, 3), g('blightling', 12, 0.7, 6)] },
    { groups: [g('tuskbeast', 8, 1.8), g('rollereye', 5, 2, 3), g('rotMoth', 10, 0.9, 6)] },
    { groups: [g('tuskbeast', 8, 1.6), g('burrower', 8, 1.2, 3), g('wisp', 10, 1, 6)] },
    { groups: [g('mireMaw', 1, 1, 3), g('gnasher', 16, 0.5), g('rotMoth', 10, 0.9, 6)] },
  ],
};

export const STAGE_3_2: StageDef = {
  id: '3-2',
  region: 3,
  index: 2,
  name: { en: 'Veins of the Blight', ja: '穢れの脈' },
  background: 'bg_region3',
  units: ALL_UNITS,
  enemyHpScale: 0.85,
  enemyDamageScale: 0.85,
  startGold: 280,
  startMana: 80,
  castleHp: 900,
  firstBreak: 10,
  breakTime: 12,
  waves: [
    { groups: [g('tuskbeast', 4, 2.4), g('gnasher', 10, 0.7, 3)] },
    { groups: [g('burrower', 6, 1.6), g('rotMoth', 6, 1.2, 3)] },
    { groups: [g('wisp', 10, 1), g('rollereye', 4, 2.4, 4)] },
    { groups: [g('tuskbeast', 7, 2), g('burrower', 6, 1.4, 3), g('rotMoth', 8, 1, 6)] },
    { groups: [g('sporeMother', 1, 1, 2), g('blightling', 12, 0.8)] },
    { groups: [g('tuskbeast', 8, 1.8), g('wisp', 10, 1, 3), g('gnasher', 14, 0.5, 6)] },
    { groups: [g('burrower', 10, 1.1), g('rollereye', 6, 1.8, 3), g('rotMoth', 12, 0.8, 6)] },
    { groups: [g('tuskbeast', 10, 1.5), g('burrower', 8, 1.2, 3), g('wisp', 10, 1, 6)] },
    { groups: [g('mireMaw', 1, 1, 2), g('rotMoth', 14, 0.7, 4), g('gnasher', 16, 0.45, 8)] },
  ],
};

/** 最後のステージ。穢れの心臓(最後のボス)。 */
export const STAGE_3_3: StageDef = {
  id: '3-3',
  region: 3,
  index: 3,
  name: { en: 'Heart of the Blight', ja: '穢れの心臓' },
  background: 'bg_region3',
  units: ALL_UNITS,
  enemyHpScale: 0.54,
  enemyDamageScale: 0.54,
  startGold: 300,
  startMana: 100,
  castleHp: 1000,
  firstBreak: 10,
  breakTime: 12,
  waves: [
    { groups: [g('gnasher', 14, 0.6), g('rotMoth', 6, 1.2, 4)] },
    { groups: [g('tuskbeast', 6, 2), g('burrower', 6, 1.6, 3)] },
    { groups: [g('wisp', 10, 1), g('rollereye', 5, 2, 4), g('blightling', 10, 0.8, 6)] },
    { groups: [g('tuskbeast', 8, 1.8), g('rotMoth', 10, 0.9, 3), g('burrower', 6, 1.4, 6)] },
    { groups: [g('mireMaw', 1, 1, 2), g('gnasher', 14, 0.5, 4)] },
    { groups: [g('tuskbeast', 10, 1.5), g('wisp', 10, 1, 3), g('rollereye', 6, 1.8, 6)] },
    { groups: [g('sporeMother', 1, 1, 2), g('burrower', 10, 1.1, 4), g('rotMoth', 10, 0.9, 6)] },
    { groups: [g('tuskbeast', 12, 1.3), g('gnasher', 18, 0.45, 3), g('wisp', 12, 0.9, 6)] },
    { groups: [g('burrower', 12, 1), g('rotMoth', 14, 0.7, 3), g('rollereye', 8, 1.4, 6)] },
    { groups: [g('blightHeart', 1, 1, 2), g('blightling', 12, 1.2), g('tuskbeast', 6, 3, 10)] },
  ],
};

export const STAGES: StageDef[] = [STAGE_1_1, STAGE_1_2, STAGE_1_3, STAGE_2_1, STAGE_2_2, STAGE_2_3, STAGE_3_1, STAGE_3_2, STAGE_3_3];

/** テストと計測で使う、全部の兵が出せる10ウェーブのステージ。 */
export const STAGE_1 = STAGE_1_3;

export const REGIONS = [
  { id: 1, name: { en: 'The Green Border', ja: '緑の境' } },
  { id: 2, name: { en: 'The Rotting Mire', ja: '腐れ沼' } },
  { id: 3, name: { en: 'Heart of the Blight', ja: '穢れの心臓' } },
] as const;

export function nextStage(id: string): StageDef | undefined {
  const i = STAGES.findIndex((s) => s.id === id);
  return i >= 0 ? STAGES[i + 1] : undefined;
}
