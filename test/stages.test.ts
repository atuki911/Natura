import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ENEMIES } from '../src/data/enemies.ts';
import { STAGE_1, STAGE_1_1, STAGES, nextStage } from '../src/data/stages.ts';
import { Bot, BOT_STYLES } from '../src/sim/bot.ts';
import { DT } from '../src/sim/constants.ts';
import type { StageDef } from '../src/sim/types.ts';
import { World } from '../src/sim/world.ts';

const quiet = (stage: StageDef): StageDef => ({ ...stage, firstBreak: 9999, breakTime: 9999, startGold: 10000, startMana: 200 });

const run = (world: World, seconds: number) => {
  for (let i = 0; i < seconds / DT; i++) world.step();
};

describe('ステージ', () => {
  test('9ステージが地域の順に並び、次のステージをたどれる', () => {
    assert.equal(STAGES.length, 9);
    assert.equal(nextStage('1-3')?.id, '2-1');
    assert.equal(nextStage('3-3'), undefined);
    for (const s of STAGES) assert.ok(s.units.length > 0);
  });

  test('ステージで出せない兵は出せない', () => {
    const world = new World(quiet(STAGE_1_1));
    world.command({ type: 'spawn', unit: 'mage' });
    world.step();
    assert.equal(world.allies().length, 0);
    world.command({ type: 'spawn', unit: 'sword' });
    world.step();
    assert.equal(world.allies().length, 1);
  });

  test('敵の強さの倍率が体力と攻撃力にかかる', () => {
    const world = new World({ ...quiet(STAGE_1), enemyHpScale: 2, enemyDamageScale: 3 });
    world.command({ type: 'debugSpawnEnemy', enemy: 'blightling' });
    world.step();
    const e = world.enemies()[0];
    assert.equal(e.maxHp, ENEMIES.blightling.hp * 2);
    assert.equal(e.def.damage, ENEMIES.blightling.damage * 3);
  });

  test('どのステージも、何もしなければ負ける', () => {
    for (const stage of STAGES) {
      const world = new World(stage, 1);
      for (let i = 0; i < 60 * 60 * 20 && !world.ended; i++) world.step();
      assert.equal(world.phase, 'defeat', stage.id);
    }
  });

  test('ふつうの自動プレイは最初のステージに勝てる', () => {
    const world = new World(STAGE_1_1, 2);
    const bot = new Bot(BOT_STYLES.standard);
    for (let i = 0; i < 60 * 60 * 20 && !world.ended; i++) {
      bot.tick(world, DT);
      world.step();
    }
    assert.equal(world.phase, 'victory');
  });
});

describe('新しい敵', () => {
  test('蛾は木を見つけるとかじる', () => {
    const world = new World(quiet(STAGE_1));
    world.command({ type: 'debugPlant', unit: 'mage', x: 900 });
    run(world, 4);
    const tree = world.aliveTrees()[0];
    assert.ok(tree);
    world.command({ type: 'debugGod', on: true });
    world.command({ type: 'debugSpawnEnemy', enemy: 'rotMoth' });
    let hit = false;
    for (let i = 0; i < 60 * 15 && !hit; i++) {
      world.step();
      hit = world.events.some((e) => e.t === 'treeHit' && e.id === tree.id);
    }
    assert.ok(hit);
  });

  test('地虫は茨に止められない', () => {
    const world = new World(quiet(STAGE_1));
    world.command({ type: 'debugPlant', unit: 'sword', x: 700 });
    run(world, 4);
    world.command({ type: 'debugGod', on: true });
    world.command({ type: 'debugSpawnEnemy', enemy: 'burrower' });
    world.step();
    const grub = world.enemies().find((e) => e.def.id === 'burrower')!;
    let minX = grub.x;
    for (let i = 0; i < 60 * 20 && grub.alive; i++) {
      world.step();
      minX = Math.min(minX, grub.x);
    }
    assert.ok(minX < 600, `茨を越えている(x=${Math.round(minX)})`);
    assert.ok(!world.events.some((e) => e.t === 'thornHit' && e.id === grub.id));
  });

  test('胞子の母は周りの木を枯らす', () => {
    const world = new World(quiet(STAGE_1));
    world.command({ type: 'debugPlant', unit: 'archer', x: 1050 });
    run(world, 4);
    const tree = world.aliveTrees()[0];
    const before = tree.hp;
    world.command({ type: 'debugSpawnEnemy', enemy: 'sporeMother' });
    run(world, 2);
    assert.ok(!tree.alive || tree.hp < before - 20);
  });
});
