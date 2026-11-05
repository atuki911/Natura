// バランス検証。画面なしで戦闘を何度も回し、勝率と城の残りを表にする。
// 使い方: npm run balance -- [回数] [stageId]

import { STAGES } from '../src/data/stages.ts';
import { Bot, BOT_STYLES } from '../src/sim/bot.ts';
import { DT } from '../src/sim/constants.ts';
import { World } from '../src/sim/world.ts';

const runs = Number(process.argv[2] ?? 40);
const stageArg = process.argv[3] ?? '1-3';
const targets = stageArg === 'all' ? STAGES : STAGES.filter((s) => s.id === stageArg);
if (targets.length === 0) throw new Error(`ステージ ${stageArg} がありません`);
let stage = targets[0];

const MAX_SECONDS = 60 * 30;

interface Result {
  win: boolean;
  wave: number;
  castle: number;
  seconds: number;
  kills: number;
}

function play(seed: number, styleName: string): Result {
  const world = new World(stage!, seed);
  const bot = new Bot(BOT_STYLES[styleName]);
  let ticks = 0;
  while (!world.ended && ticks * DT < MAX_SECONDS) {
    bot.tick(world, DT);
    world.step();
    ticks++;
  }
  return {
    win: world.phase === 'victory',
    wave: world.wavesStarted,
    castle: world.castle.hp / world.castle.maxHp,
    seconds: ticks * DT,
    kills: world.stats.kills,
  };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

const styles = stageArg === 'all' ? ['standard', 'swordOnly', 'idle'] : Object.keys(BOT_STYLES);
for (const target of targets) {
stage = target;
console.log(`\nステージ: ${stage.id} ${stage.name.ja} / 1つの遊び方につき ${runs} 回`);
console.log('遊び方      勝率   城の残り(勝った時)  負けたウェーブ(平均)  1回の長さ');
for (const styleName of styles) {
  const results: Result[] = [];
  for (let seed = 1; seed <= runs; seed++) results.push(play(seed, styleName));
  const wins = results.filter((r) => r.win);
  const losses = results.filter((r) => !r.win);
  const winRate = wins.length / results.length;
  const castle = wins.length ? wins.reduce((s, r) => s + r.castle, 0) / wins.length : 0;
  const lossWave = losses.length ? losses.reduce((s, r) => s + r.wave, 0) / losses.length : 0;
  const seconds = results.reduce((s, r) => s + r.seconds, 0) / results.length;
  console.log(
    `${styleName.padEnd(10)}  ${pct(winRate).padStart(4)}   ${wins.length ? pct(castle).padStart(4) : '   -'}                ${
      losses.length ? lossWave.toFixed(1).padStart(4) : '   -'
    }                  ${Math.round(seconds / 60)}分${Math.round(seconds % 60)}秒`,
  );
}
}
console.log('\n目安: standard は勝率60〜85%、swordOnly は勝ちにくく、idle は必ず負ける。');
