// 強化を全部買った時に、どれだけ勝ちやすくなるかを測る(強化なしと比べる)。
// 使い方: node tools/meta-balance.ts [回数] [stageId|all]

import { STAGES } from '../src/data/stages.ts';
import { UPGRADES } from '../src/data/upgrades.ts';
import { modsFromLevels } from '../src/meta.ts';
import { Bot, BOT_STYLES } from '../src/sim/bot.ts';
import { DT } from '../src/sim/constants.ts';
import { NO_MODS, type StageDef, type WorldMods } from '../src/sim/types.ts';
import { World } from '../src/sim/world.ts';

const runs = Number(process.argv[2] ?? 20);
const stageArg = process.argv[3] ?? 'all';
const targets = stageArg === 'all' ? STAGES : STAGES.filter((s) => s.id === stageArg);
const MAX_SECONDS = 60 * 30;
const FULL = modsFromLevels(Object.fromEntries(UPGRADES.map((u) => [u.id, u.costs.length])));

function winRate(stage: StageDef, style: string, mods: WorldMods): number {
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const world = new World(stage, seed, mods);
    const bot = new Bot(BOT_STYLES[style]);
    for (let i = 0; !world.ended && i * DT < MAX_SECONDS; i++) {
      bot.tick(world, DT);
      world.step();
    }
    if (world.phase === 'victory') wins++;
  }
  return Math.round((wins / runs) * 100);
}

console.log('stage | style | 強化なし | 全部強化');
for (const stage of targets) {
  for (const style of ['standard', 'casual', 'idle']) {
    if (!BOT_STYLES[style]) continue;
    console.log(`${stage.id} | ${style} | ${winRate(stage, style, NO_MODS)}% | ${winRate(stage, style, FULL)}%`);
  }
}
