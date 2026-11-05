// 遊びの質の指標を、画面なしの自動プレイで測る。独自性探索の「検証」の関門に使う。
// 使い方: node tools/metrics.ts [回数]

import { STAGES } from '../src/data/stages.ts';
import { UNITS } from '../src/data/units.ts';
import { Bot, BOT_STYLES } from '../src/sim/bot.ts';
import { DT } from '../src/sim/constants.ts';
import type { UnitId } from '../src/sim/types.ts';
import { World } from '../src/sim/world.ts';

const runs = Number(process.argv[2] ?? 40);
const stage = STAGES[0];

interface RunStats {
  win: boolean;
  seconds: number;
  /** 何も買えず、能力も使えない時間の割合(戦闘中)。 */
  idle: number;
  /** 1分あたりの操作の回数。 */
  actionsPerMin: number;
  /** 城が半分以下になったか。 */
  wasLow: boolean;
  spawns: Partial<Record<UnitId, number>>;
}

function play(seed: number, style: string): RunStats {
  const world = new World(stage, seed);
  const bot = new Bot(BOT_STYLES[style]);
  let ticks = 0;
  let waveTicks = 0;
  let idleTicks = 0;
  let actions = 0;
  let wasLow = false;
  const spawns: Partial<Record<UnitId, number>> = {};
  const cheapest = Math.min(...Object.values(UNITS).map((u) => u.cost.gold));
  while (!world.ended && ticks < 60 * 60 * 30) {
    bot.tick(world, DT);
    world.step();
    ticks++;
    for (const e of world.events) {
      if (e.t === 'spawn' && e.side === 'ally') {
        actions++;
        const f = world.getFighter(e.id);
        if (f) spawns[f.def.id as UnitId] = (spawns[f.def.id as UnitId] ?? 0) + 1;
      }
      if (e.t === 'towerBuilt' || e.t === 'meteorCast' || e.t === 'heal') actions++;
    }
    if (world.phase === 'wave') {
      waveTicks++;
      const canAct = world.gold >= cheapest || world.canUseAbility('heal') || world.canUseAbility('meteor');
      if (!canAct) idleTicks++;
    }
    if (world.castle.hp < world.castle.maxHp * 0.5) wasLow = true;
  }
  const seconds = ticks * DT;
  return {
    win: world.phase === 'victory',
    seconds,
    idle: waveTicks ? idleTicks / waveTicks : 0,
    actionsPerMin: actions / (seconds / 60),
    wasLow,
    spawns,
  };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const report: Record<string, unknown> = {};
for (const style of ['standard', 'rush', 'ranged', 'magic', 'swordOnly', 'idle']) {
  const rs: RunStats[] = [];
  for (let seed = 1; seed <= runs; seed++) rs.push(play(seed, style));
  const wins = rs.filter((r) => r.win);
  const avg = (f: (r: RunStats) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
  const comeback = wins.length ? wins.filter((r) => r.wasLow).length / wins.length : 0;
  const row = {
    winRate: wins.length / rs.length,
    minutes: avg((r) => r.seconds) / 60,
    idle: avg((r) => r.idle),
    actionsPerMin: avg((r) => r.actionsPerMin),
    comebackShare: comeback,
  };
  report[style] = row;
  console.log(
    `${style.padEnd(10)} 勝率 ${pct(row.winRate).padStart(4)}  長さ ${row.minutes.toFixed(1)}分  待ち ${pct(row.idle).padStart(4)}  操作 ${row.actionsPerMin.toFixed(1)}/分  逆転勝ち ${pct(row.comebackShare)}`,
  );
}
const viable = ['rush', 'ranged', 'magic', 'standard'].map((s) => (report[s] as { winRate: number }).winRate);
console.log(`\n作戦の勝率差(最大-最小): ${Math.round((Math.max(...viable) - Math.min(...viable)) * 100)}ポイント`);
