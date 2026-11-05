import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ENEMIES } from '../src/data/enemies.ts';
import { STAGE_1 } from '../src/data/stages.ts';
import { TOWERS } from '../src/data/towers.ts';
import { TREE_RULES, TREES } from '../src/data/trees.ts';
import { UNITS } from '../src/data/units.ts';
import { Bot, BOT_STYLES } from '../src/sim/bot.ts';
import { DT, FIELD } from '../src/sim/constants.ts';
import type { StageDef } from '../src/sim/types.ts';
import { World } from '../src/sim/world.ts';

/** 敵が自分から来ない、検証用のステージ。 */
const quietStage: StageDef = { ...STAGE_1, firstBreak: 9999, breakTime: 9999, startGold: 10000, startMana: 200 };

const run = (world: World, seconds: number) => {
  for (let i = 0; i < seconds / DT; i++) world.step();
};

const autoplay = (seed: number) => {
  const world = new World(STAGE_1, seed);
  const bot = new Bot(BOT_STYLES.standard);
  for (let i = 0; i < 60 * 60 * 20 && !world.ended; i++) {
    bot.tick(world, DT);
    world.step();
  }
  return world;
};

describe('戦闘の計算', () => {
  test('同じ種なら同じ結果になる', () => {
    const a = autoplay(7);
    const b = autoplay(7);
    assert.equal(a.phase, b.phase);
    assert.equal(a.time, b.time);
    assert.equal(a.castle.hp, b.castle.hp);
    assert.deepEqual(a.stats, b.stats);
  });

  test('ユニットを出すとお金が減り、出すまでの待ち時間がつく', () => {
    const world = new World(quietStage);
    world.command({ type: 'spawn', unit: 'sword' });
    world.step();
    assert.equal(world.allies().length, 1);
    assert.ok(world.gold < 10000 - UNITS.sword.cost.gold + 1);
    world.command({ type: 'spawn', unit: 'sword' });
    world.step();
    assert.equal(world.allies().length, 1, '待ち時間の間は出せない');
  });

  test('お金が足りなければ出せない', () => {
    const world = new World({ ...quietStage, startGold: 10 });
    world.command({ type: 'spawn', unit: 'archer' });
    world.step();
    assert.equal(world.allies().length, 0);
  });

  test('剣士は敵に向かって進み、倒す', () => {
    const world = new World(quietStage);
    world.command({ type: 'spawn', unit: 'sword' });
    world.command({ type: 'debugSpawnEnemy', enemy: 'blightling' });
    run(world, 30);
    assert.equal(world.enemies().length, 0);
    assert.equal(world.stats.kills, 1);
  });

  test('近接攻撃は空を飛ぶ敵に届かない', () => {
    const world = new World(quietStage);
    world.command({ type: 'debugGod', on: true });
    world.command({ type: 'spawn', unit: 'sword' });
    world.command({ type: 'debugSpawnEnemy', enemy: 'wisp' });
    run(world, 6);
    const wisp = world.enemies()[0];
    assert.ok(wisp, '影はまだ生きている');
    assert.equal(wisp.hp, wisp.maxHp);
  });

  test('防具は物理ダメージを減らし、魔法は防具を無視する', () => {
    const world = new World(quietStage);
    world.command({ type: 'debugSpawnEnemy', enemy: 'tuskbeast' });
    world.step();
    const beast = world.enemies()[0];
    const hits: number[] = [];
    world.command({ type: 'spawn', unit: 'sword' });
    for (let i = 0; i < 60 * 30 && hits.length === 0; i++) {
      world.step();
      for (const e of world.events) if (e.t === 'hit' && e.id === beast.id && !e.crit) hits.push(e.amount);
    }
    assert.equal(hits[0], Math.round(UNITS.sword.damage * (1 - ENEMIES.tuskbeast.armor)));
  });

  test('爆弾兵は爆発して自分も消え、周りの敵にダメージを与える', () => {
    const world = new World(quietStage);
    world.command({ type: 'debugSpawnEnemy', enemy: 'blightling' });
    world.command({ type: 'debugSpawnEnemy', enemy: 'blightling' });
    world.command({ type: 'spawn', unit: 'bomber' });
    let exploded = false;
    for (let i = 0; i < 60 * 30 && !exploded; i++) {
      world.step();
      exploded = world.events.some((e) => e.t === 'explode' && e.kind === 'bomb');
    }
    assert.ok(exploded);
    assert.equal(world.allies().length, 0);
    assert.equal(world.enemies().length, 0, '2体とも巻き込む');
  });

  test('タワーは届く敵を撃つ', () => {
    const world = new World(quietStage);
    world.command({ type: 'build', slot: 2, tower: 'arrowTower' });
    world.step();
    assert.ok(world.towers[2]);
    assert.ok(world.gold < 10000 - TOWERS.arrowTower.cost.gold + 1);
    world.command({ type: 'debugSpawnEnemy', enemy: 'wisp' });
    let shot = false;
    for (let i = 0; i < 60 * 20 && !shot; i++) {
      world.step();
      shot = world.events.some((e) => e.t === 'towerShot');
    }
    assert.ok(shot, '空を飛ぶ敵にも撃つ');
  });

  test('隕石は落ちた所の敵をまとめて倒す', () => {
    const world = new World(quietStage);
    world.command({ type: 'debugSpawnEnemy', enemy: 'gnasher' });
    world.command({ type: 'debugSpawnEnemy', enemy: 'gnasher' });
    world.step();
    world.command({ type: 'ability', ability: 'meteor', x: FIELD.portalX - 20 });
    run(world, 1);
    assert.equal(world.enemies().length, 0);
  });

  test('敵が城に着くと城が削られ、0で負ける', () => {
    const world = new World({ ...quietStage, castleHp: 30 });
    world.command({ type: 'debugSpawnEnemy', enemy: 'tuskbeast' });
    run(world, 120);
    assert.equal(world.phase, 'defeat');
    assert.equal(world.castle.hp, 0);
  });

  test('休憩を切り上げると次のウェーブが始まり、ボーナスが入る', () => {
    const world = new World(STAGE_1);
    world.command({ type: 'nextWave' });
    world.step();
    assert.equal(world.phase, 'wave');
    assert.equal(world.wavesStarted, 1);
    assert.ok(world.events.some((e) => e.t === 'earlyBonus'));
  });

  test('ふつうの自動プレイで最後までたどり着ける', () => {
    const world = autoplay(3);
    assert.equal(world.wavesStarted, STAGE_1.waves.length);
  });

  test('何もしなければ負ける', () => {
    const world = new World(STAGE_1, 1);
    for (let i = 0; i < 60 * 60 * 20 && !world.ended; i++) world.step();
    assert.equal(world.phase, 'defeat');
  });
});

describe('倒れた兵は木になる', () => {
  /** 最初に出した味方を、すぐ倒れるようにして、与えたダメージを決める。 */
  const weakAlly = (world: World, dealt: number) => {
    world.step();
    const ally = world.allies()[0];
    ally.hp = 1;
    ally.dealt = dealt;
    return ally;
  };

  test('戦った剣士は倒れた場所で茨になり、地上の敵の足を止めて刺す', () => {
    const world = new World(quietStage);
    world.command({ type: 'debugGod', on: true });
    world.command({ type: 'spawn', unit: 'sword' });
    weakAlly(world, TREE_RULES.minDamageDealt.sword);
    world.command({ type: 'debugSpawnEnemy', enemy: 'tuskbeast' });
    let deathX = -1;
    let seededX = -1;
    let seededTree = '';
    for (let i = 0; i < 60 * 30 && !seededTree; i++) {
      world.step();
      for (const e of world.events) {
        if (e.t === 'death' && e.side === 'ally') deathX = e.x;
        if (e.t === 'treeSeed') {
          seededX = e.x;
          seededTree = e.tree;
        }
      }
    }
    assert.equal(seededTree, 'thornBush');
    assert.equal(seededX, deathX, '倒れた場所に生える');
    run(world, TREES.thornBush.growTime + 0.1);
    const bush = world.aliveTrees()[0];
    assert.ok(bush && bush.growing <= 0, '育ち切る');

    // 後から来た敵は茨の前で止まり、茨を叩き、棘を受けて倒れる。
    world.command({ type: 'debugSpawnEnemy', enemy: 'blightling' });
    let treeHit = 0;
    let thornHit = 0;
    let minX = Infinity;
    for (let i = 0; i < 60 * 30; i++) {
      world.step();
      for (const e of world.events) {
        if (e.t === 'treeHit' && e.id === bush.id) treeHit++;
        if (e.t === 'thornHit' && e.treeId === bush.id) thornHit++;
      }
      const blightling = world.enemies().find((f) => f.def.id === 'blightling');
      if (!blightling) break;
      minX = Math.min(minX, blightling.x);
    }
    assert.ok(thornHit > 0, '茨が刺す');
    assert.ok(treeHit > 0, '敵は茨を攻撃する');
    assert.ok(minX >= bush.x - 12, '茨を越えて進めない');
    assert.equal(world.enemies().filter((f) => f.def.id === 'blightling').length, 0, '棘で倒れる');
  });

  test('戦わずに倒れた兵は木にならない', () => {
    const world = new World(quietStage);
    world.command({ type: 'debugGod', on: true });
    world.command({ type: 'spawn', unit: 'sword' });
    weakAlly(world, 0);
    world.command({ type: 'debugSpawnEnemy', enemy: 'tuskbeast' });
    let died = false;
    for (let i = 0; i < 60 * 30 && !died; i++) {
      world.step();
      died = world.events.some((e) => e.t === 'death' && e.side === 'ally');
    }
    assert.ok(died);
    run(world, 5);
    assert.equal(world.stats.treesGrown, 0);
    assert.equal(world.aliveTrees().length, 0);
  });

  test('魔法使いの花は蜜をため、摘むとマナとゴールドになり、引き抜くと消える', () => {
    const world = new World(quietStage);
    world.command({ type: 'debugGod', on: true });
    world.command({ type: 'spawn', unit: 'mage' });
    weakAlly(world, TREE_RULES.minDamageDealt.mage);
    world.command({ type: 'debugSpawnEnemy', enemy: 'tuskbeast' });
    for (let i = 0; i < 60 * 30 && world.aliveTrees().length === 0; i++) world.step();
    const flower = world.aliveTrees()[0];
    assert.equal(flower?.def.id, 'manaFlower');
    world.command({ type: 'harvest', tree: flower.id });
    world.step();
    assert.equal(world.stats.harvests, 0, '芽のうちは摘めない');

    const nectar = TREES.manaFlower.nectar!;
    run(world, TREES.manaFlower.growTime + nectar.minHarvest / nectar.perSecond + 0.2);
    assert.ok(world.harvestable().includes(flower));
    // マナを空にしてから摘む(上限で切れないように)。
    world.command({ type: 'debugMana', amount: -world.mana });
    world.step();
    const gold = world.gold;
    const mana = world.mana;
    world.command({ type: 'harvest', tree: flower.id });
    world.step();
    const got = world.events.find((e) => e.t === 'harvest');
    assert.ok(got && got.t === 'harvest');
    assert.ok(got.mana >= nectar.minHarvest * nectar.manaPer);
    assert.ok(world.mana >= mana + got.mana, 'マナが増える');
    assert.ok(world.gold >= gold + got.gold, 'ゴールドが増える');
    assert.ok(flower.nectar < 1, '蜜は空になる');

    world.command({ type: 'uproot', tree: flower.id });
    world.step();
    assert.ok(world.events.some((e) => e.t === 'treeDie' && e.reason === 'uprooted'));
    assert.equal(world.aliveTrees().length, 0);
  });
});
