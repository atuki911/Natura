import type { SpawnGroup, StageDef } from '../sim/types.ts';

const g = (enemy: SpawnGroup['enemy'], count: number, interval: number, delay = 0): SpawnGroup => ({
  enemy,
  count,
  interval,
  delay,
});

/** ステージ1「緑の境(さかい)」。10ウェーブ目にボス。 */
export const STAGE_1: StageDef = {
  id: 'stage1',
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

export const STAGES: StageDef[] = [STAGE_1];
