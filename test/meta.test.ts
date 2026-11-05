import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { STAGES } from '../src/data/stages.ts';
import { BRANCHES, LEAF_REWARDS, UPGRADES } from '../src/data/upgrades.ts';
import { awardStageResult, buyUpgrade, canBuy, computeReward, memoryStore, modsFromLevels, modsFromSave, totalUpgradeCost, upgradeLevel } from '../src/meta.ts';
import { defaultSave } from '../src/save.ts';
import { NO_MODS } from '../src/sim/types.ts';
import { World } from '../src/sim/world.ts';

describe('強化のデータ', () => {
  test('id は重ならず、どの系統にもあり、段数は 2〜5、値段は段ごとに上がる', () => {
    assert.equal(new Set(UPGRADES.map((u) => u.id)).size, UPGRADES.length);
    assert.ok(UPGRADES.length >= 12 && UPGRADES.length <= 15);
    for (const b of BRANCHES) assert.ok(UPGRADES.some((u) => u.branch === b), b);
    for (const u of UPGRADES) {
      assert.ok(u.costs.length >= 2 && u.costs.length <= 5, u.id);
      for (let i = 1; i < u.costs.length; i++) assert.ok(u.costs[i] > u.costs[i - 1], u.id);
    }
  });

  test('全部買う値段は、全ステージ星3つの葉より多く、遊び直しを足せば届く', () => {
    const data = defaultSave();
    const store = memoryStore(data);
    for (const s of STAGES) awardStageResult(s.id, 3, true, store);
    const allThreeStars = store.load().leaves;
    const total = totalUpgradeCost();
    assert.ok(total > allThreeStars, `${total} > ${allThreeStars}`);
    assert.ok(total < allThreeStars * 1.25, `${total} < ${allThreeStars} * 1.25`);
  });
});

describe('葉をもらう', () => {
  test('初めて勝つと初回の葉と星の分、2回目は勝った分だけ', () => {
    const store = memoryStore();
    const first = awardStageResult('1-1', 2, true, store);
    assert.deepEqual(first, { leaves: LEAF_REWARDS.win + LEAF_REWARDS.firstClear + 2 * LEAF_REWARDS.perNewStar, firstClear: true, newStars: 2 });
    const again = awardStageResult('1-1', 2, true, store);
    assert.deepEqual(again, { leaves: LEAF_REWARDS.win, firstClear: false, newStars: 0 });
    const better = awardStageResult('1-1', 3, true, store);
    assert.equal(better.newStars, 1);
    assert.equal(store.load().leaves, first.leaves + again.leaves + better.leaves);
  });

  test('負けても少しもらえ、勝った扱いにはならない', () => {
    const store = memoryStore();
    const r = awardStageResult('1-2', 0, false, store);
    assert.equal(r.leaves, LEAF_REWARDS.defeat);
    assert.equal(r.firstClear, false);
    assert.equal(computeReward(store.load(), '1-2', 1, true).firstClear, true);
  });

  test('先の地域ほど多い', () => {
    const d = defaultSave();
    assert.ok(computeReward(d, '3-1', 3, true).leaves > computeReward(d, '2-1', 3, true).leaves);
    assert.ok(computeReward(d, '2-1', 3, true).leaves > computeReward(d, '1-1', 3, true).leaves);
  });
});

describe('強化を買う', () => {
  test('葉が足りなければ買えず、最大の段の先は買えない', () => {
    const store = memoryStore({ leaves: 5 });
    assert.equal(canBuy('maxTrees', store), false);
    assert.equal(buyUpgrade('maxTrees', store), false);
    store.write({ ...store.load(), leaves: 1000 });
    assert.equal(buyUpgrade('maxTrees', store), true);
    assert.equal(buyUpgrade('maxTrees', store), true);
    assert.equal(upgradeLevel('maxTrees', store), 2);
    assert.equal(canBuy('maxTrees', store), false);
    assert.equal(buyUpgrade('maxTrees', store), false);
    assert.equal(store.load().leaves, 1000 - 30 - 60);
  });

  test('買った強化が WorldMods になり、World に効く', () => {
    assert.deepEqual(modsFromLevels({}), NO_MODS);
    const store = memoryStore({ leaves: 10000 });
    for (const u of UPGRADES) while (buyUpgrade(u.id, store));
    const mods = modsFromSave(store);
    assert.ok(Math.abs((mods.unitHpMult.sword ?? 1) - 1.4) < 1e-9);
    assert.ok(Math.abs((mods.unitDamageMult.mage ?? 1) - 1.4) < 1e-9);
    assert.equal(mods.maxTreesBonus, 2);
    assert.ok(mods.treeDecayMult < 1 && mods.treeDecayMult > 0);
    assert.equal(mods.castleHpBonus, 400);
    assert.equal(mods.startGoldBonus, 100);
    const stage = STAGES[0];
    const world = new World(stage, 1, mods);
    assert.equal(world.gold, stage.startGold + 100);
    assert.equal(world.castle.maxHp, stage.castleHp + 400);
  });

  test('壊れた保存(段数が多すぎる)でも最大を超えない', () => {
    const store = memoryStore({ upgrades: { castleHp: 99 } });
    assert.equal(upgradeLevel('castleHp', store), 4);
    assert.equal(modsFromSave(store).castleHpBonus, 400);
  });
});
