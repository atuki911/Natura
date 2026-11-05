// ステージの難しさを自動で合わせる。敵の強さの倍率 p(体力と攻撃力の両方)を二分探索し、
// ふつうの腕前の自動プレイ(standard)の勝率が目標に一番近くなる p を探す。
// 使い方: node tools/tune.ts <stageId> <目標の勝率 0〜1> [回数] [自動プレイの遊び方(既定 standard)]
// 見つけた p を src/data/stages.ts の enemyHpScale / enemyDamageScale に書く。

import { STAGES } from '../src/data/stages.ts';
import { Bot, BOT_STYLES } from '../src/sim/bot.ts';
import { DT } from '../src/sim/constants.ts';
import { World } from '../src/sim/world.ts';

const [id, targetArg, runsArg, styleArg] = process.argv.slice(2);
const style = BOT_STYLES[styleArg ?? 'standard'];
const base = STAGES.find((s) => s.id === id);
if (!base) throw new Error(`ステージ ${id} がありません`);
const target = Number(targetArg ?? 0.8);
const runs = Number(runsArg ?? 20);

function winRate(p: number): number {
  const stage = { ...base!, enemyHpScale: p, enemyDamageScale: p };
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const w = new World(stage, seed);
    const bot = new Bot(style);
    let t = 0;
    while (!w.ended && t < 60 * 60 * 25) {
      bot.tick(w, DT);
      w.step();
      t++;
    }
    if (w.phase === 'victory') wins++;
  }
  return wins / runs;
}

let lo = Math.log(0.3);
let hi = Math.log(4);
let best = { p: 1, rate: winRate(1) };
for (let i = 0; i < 7; i++) {
  const mid = (lo + hi) / 2;
  const p = Math.exp(mid);
  const rate = winRate(p);
  if (Math.abs(rate - target) < Math.abs(best.rate - target)) best = { p, rate };
  if (rate > target) lo = mid;
  else hi = mid;
}
console.log(`${id}: p=${best.p.toFixed(2)} 勝率 ${Math.round(best.rate * 100)}% (目標 ${Math.round(target * 100)}%)`);
