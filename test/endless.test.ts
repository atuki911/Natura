import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ENDLESS_STAGE } from '../src/data/stages.ts';
import { Bot, BOT_STYLES } from '../src/sim/bot.ts';
import { DT } from '../src/sim/constants.ts';
import { endlessWave } from '../src/sim/endless.ts';
import { Rng } from '../src/sim/rng.ts';
import { World } from '../src/sim/world.ts';

describe('耐久モード', () => {
  test('ウェーブは同じ種なら同じ並びで、6の倍数にボスが来る', () => {
    const a = endlessWave(6, new Rng(3));
    const b = endlessWave(6, new Rng(3));
    assert.deepEqual(a, b);
    assert.ok(a.groups.some((g) => ['mireMaw', 'sporeMother', 'blightHeart'].includes(g.enemy)));
    assert.ok(!endlessWave(5, new Rng(3)).groups.some((g) => g.enemy === 'mireMaw'));
  });

  test('勝ちにならず、いつかは負ける。ふつうの自動プレイはしばらく耐える', () => {
    const world = new World(ENDLESS_STAGE, 1);
    const bot = new Bot(BOT_STYLES.standard);
    for (let i = 0; i < 60 * 60 * 60 && !world.ended; i++) {
      bot.tick(world, DT);
      world.step();
    }
    assert.equal(world.phase, 'defeat');
    assert.ok(world.wavesStarted >= 6, `耐えたウェーブ ${world.wavesStarted}`);
  });
});
