import { ENEMY, threat } from './enemies.ts';
import { Rng, type V2 } from '../sim/rng.ts';
import type { TowerLine } from './towers.ts';

export interface SpawnGroup { enemy: string; count: number; interval: number; delay: number; path: number }
export interface Wave { groups: SpawnGroup[] }

export interface RegionDef { id: number; name: string; desc: string; music: number }
export const REGIONS: RegionDef[] = [
  { id: 0, name: '若葉の草原', desc: 'のどかな草原と浮島。スライムたちが騒ぎはじめた。', music: 0 },
  { id: 1, name: '迷いの森と沼', desc: '霧に包まれた森と毒の沼。大蛇の噂がある。', music: 1 },
  { id: 2, name: '雪の峰', desc: '凍てつく山脈。巨人が眠る氷の玉座へ。', music: 2 },
  { id: 3, name: '炎の火山と魔城', desc: '溶岩の大地。九尾の魔狐が待つ最後の戦い。', music: 3 },
];

export interface StageDef {
  id: number;
  name: string;
  desc: string;
  region: number;
  paths: V2[][];
  waves: number;
  gold: number;
  spots: number;
  budget: number;
  newEnemies: string[];
  pool: string[];
  boss?: string;
  iron: TowerLine[];
  mapPos: V2; // position on world map (0..100)
}

const P = (...a: number[][]): V2[] => a.map(([x, y]) => ({ x, y }));

export const STAGES: StageDef[] = [
  // ───── 地方1 ─────
  { id: 0, name: 'ひよこ村の入口', desc: '村の外れにスライムが現れた!最初の砦を築いて黄金の卵を守ろう。', region: 0,
    paths: [P([-31, -5], [-22, -5], [-15, -11], [-6, -11], [-1, -3], [3, 6], [12, 9], [19, 3], [25, -1], [30, -1])],
    waves: 7, gold: 260, spots: 9, budget: 140, newEnemies: ['slime', 'sprout', 'spikeball'], pool: [], iron: ['archer', 'barracks'], mapPos: { x: 10, y: 78 } },
  { id: 1, name: '風車の丘', desc: '丘の上の風車小屋へ続く道。空からコウモリもやって来る。', region: 0,
    paths: [P([-31, 12], [-22, 12], [-16, 5], [-21, -4], [-14, -12], [-3, -10], [0, -1], [-4, 8], [4, 13], [13, 8], [14, -2], [20, -10], [27, -8], [30, -2])],
    waves: 8, gold: 300, spots: 10, budget: 170, newEnemies: ['spider', 'bat'], pool: ['slime', 'sprout', 'spikeball'], iron: ['archer', 'mage'], mapPos: { x: 20, y: 68 } },
  { id: 2, name: '二股の小道', desc: '道が二手に分かれている。両方から来る敵に注意!', region: 0,
    paths: [
      P([-31, -12], [-20, -13], [-12, -7], [-5, -1], [4, -1], [12, 4], [20, 5], [30, 4]),
      P([-31, 12], [-21, 13], [-13, 7], [-5, -1], [4, -1], [12, 4], [20, 5], [30, 4]),
    ],
    waves: 9, gold: 400, spots: 11, budget: 200, newEnemies: ['weasel', 'boar'], pool: ['slime', 'sprout', 'spikeball', 'spider', 'bat'], iron: ['barracks', 'artillery'], mapPos: { x: 13, y: 55 } },
  { id: 3, name: 'スライム王の湿原', desc: 'スライムたちの王が姿を現した。巨大な体を止めろ!', region: 0,
    paths: [P([-31, -14], [-20, -14], [-12, -8], [-16, 1], [-10, 9], [0, 10], [6, 3], [3, -6], [10, -12], [19, -10], [22, -1], [17, 8], [24, 13], [30, 11])],
    waves: 10, gold: 500, spots: 12, budget: 215, newEnemies: ['bigslime'], pool: ['slime', 'sprout', 'spikeball', 'spider', 'bat', 'weasel', 'boar'], boss: 'kingslime', iron: ['mage', 'artillery'], mapPos: { x: 26, y: 46 } },
  // ───── 地方2 ─────
  { id: 4, name: '迷いの森', desc: '霧深い森。2つの入口から敵が忍び寄る。', region: 1,
    paths: [
      P([-31, -2], [-22, -2], [-17, -10], [-7, -12], [-2, -4], [6, -4], [12, -10], [22, -9], [30, -6]),
      P([-12, 19], [-11, 11], [-4, 8], [2, 11], [8, 5], [6, -4], [12, -10], [22, -9], [30, -6]),
    ],
    waves: 10, gold: 550, spots: 12, budget: 270, newEnemies: ['snake', 'crow'], pool: ['spikeball', 'spider', 'weasel', 'boar', 'bat', 'bigslime'], iron: ['archer', 'barracks'], mapPos: { x: 38, y: 60 } },
  { id: 5, name: 'カエルの沼', desc: '呪術師ガエルが仲間を癒す。ヤブカの群れにも気をつけて。', region: 1,
    paths: [P([-31, 8], [-20, 8], [-14, 0], [-18, -9], [-8, -14], [2, -9], [0, 0], [6, 8], [16, 10], [22, 2], [18, -6], [24, -12], [30, -12])],
    waves: 11, gold: 600, spots: 12, budget: 295, newEnemies: ['frog', 'mosquito'], pool: ['snake', 'crow', 'spider', 'boar', 'weasel', 'bigslime'], iron: ['mage', 'artillery'], mapPos: { x: 47, y: 70 } },
  { id: 6, name: '大樹の回廊', desc: '並んだ2本の回廊。キノコとトロールが押し寄せる。', region: 1,
    paths: [
      P([-31, -10], [-18, -10], [-10, -14], [0, -12], [8, -6], [18, -6], [24, 0], [30, 0]),
      P([-31, 10], [-18, 10], [-10, 14], [0, 12], [8, 6], [18, 6], [24, 0], [30, 0]),
    ],
    waves: 12, gold: 650, spots: 13, budget: 315, newEnemies: ['mushroom', 'troll'], pool: ['snake', 'crow', 'frog', 'mosquito', 'boar', 'spider'], iron: ['archer', 'artillery'], mapPos: { x: 55, y: 58 } },
  { id: 7, name: '大蛇の沼', desc: '沼の主・大蛇ヨルムが目覚めた。3方向からの猛攻に耐えろ!', region: 1,
    paths: [
      P([-31, -10], [-20, -10], [-12, -3], [-2, -2], [8, 2], [16, 1], [24, -4], [30, -4]),
      P([-31, 10], [-20, 10], [-12, 3], [-2, -2], [8, 2], [16, 1], [24, -4], [30, -4]),
      P([6, 19], [8, 10], [8, 2], [16, 1], [24, -4], [30, -4]),
    ],
    waves: 13, gold: 800, spots: 13, budget: 285, newEnemies: ['treant'], pool: ['snake', 'crow', 'frog', 'mosquito', 'mushroom', 'troll'], boss: 'serpent', iron: ['barracks', 'mage'], mapPos: { x: 46, y: 46 } },
  // ───── 地方3 ─────
  { id: 8, name: '雪の峠道', desc: '長く曲がりくねった雪道。素早い忍者ギツネが走り抜ける。', region: 2,
    paths: [P([-31, -14], [-14, -14], [-8, -8], [-16, -2], [-22, 4], [-16, 11], [-4, 12], [2, 4], [0, -6], [8, -13], [18, -12], [22, -4], [16, 4], [20, 12], [30, 12])],
    waves: 12, gold: 900, spots: 13, budget: 340, newEnemies: ['fox', 'wolf'], pool: ['troll', 'treant', 'crow', 'snake', 'frog', 'mushroom'], iron: ['archer', 'mage'], mapPos: { x: 60, y: 34 } },
  { id: 9, name: '凍った湖', desc: '氷の湖を回り込む二つの道。氷の精霊には魔法が効かない。', region: 2,
    paths: [
      P([-31, -6], [-20, -6], [-12, -12], [0, -12], [8, -6], [14, 2], [22, 4], [30, 4]),
      P([-31, 6], [-20, 6], [-12, 12], [0, 12], [8, 6], [14, 2], [22, 4], [30, 4]),
    ],
    waves: 13, gold: 950, spots: 13, budget: 345, newEnemies: ['icespirit', 'yeti'], pool: ['fox', 'wolf', 'troll', 'treant', 'crow'], iron: ['archer', 'barracks'], mapPos: { x: 70, y: 42 } },
  { id: 10, name: '鷹の断崖', desc: '断崖の三叉路。鷹が空から、盾の軍団が地上から迫る。', region: 2,
    paths: [
      P([-31, 0], [-20, 0], [-12, -4], [-4, 0], [4, 0], [12, -4], [20, -4], [30, -2]),
      P([-14, -19], [-12, -12], [-4, -8], [-4, 0], [4, 0], [12, -4], [20, -4], [30, -2]),
      P([-14, 19], [-12, 12], [-4, 8], [-4, 0], [4, 0], [12, -4], [20, -4], [30, -2]),
    ],
    waves: 14, gold: 1000, spots: 14, budget: 345, newEnemies: ['hawk', 'shield'], pool: ['fox', 'wolf', 'icespirit', 'yeti', 'troll'], iron: ['mage', 'artillery'], mapPos: { x: 76, y: 28 } },
  { id: 11, name: '氷の巨人の玉座', desc: '氷の巨人ブリザがタワーを凍らせてくる。守りを分散させよう。', region: 2,
    paths: [P([-31, -12], [-22, -12], [-18, -4], [-22, 6], [-14, 13], [-4, 10], [-2, 0], [-6, -8], [2, -14], [12, -12], [14, -2], [8, 6], [14, 13], [24, 12], [28, 4], [30, 2])],
    waves: 15, gold: 1150, spots: 14, budget: 280, newEnemies: ['golem'], pool: ['fox', 'wolf', 'icespirit', 'yeti', 'hawk', 'shield'], boss: 'frostgiant', iron: ['barracks', 'artillery'], mapPos: { x: 66, y: 18 } },
  // ───── 地方4 ─────
  { id: 12, name: '灼熱の溶岩道', desc: '溶岩の川に挟まれた2本の道。爆弾小鬼の自爆に注意。', region: 3,
    paths: [
      P([-31, -13], [-20, -13], [-12, -6], [-2, -6], [6, -12], [16, -12], [22, -4], [30, 0]),
      P([-31, 13], [-20, 13], [-12, 6], [-2, 6], [6, 12], [16, 12], [22, 4], [30, 0]),
    ],
    waves: 14, gold: 1150, spots: 14, budget: 385, newEnemies: ['imp', 'hound'], pool: ['golem', 'yeti', 'hawk', 'shield', 'wolf', 'icespirit'], iron: ['archer', 'artillery'], mapPos: { x: 82, y: 50 } },
  { id: 13, name: '魔界の門', desc: '魔界へ通じる門。死霊術キツネが骨の兵を呼び出す。', region: 3,
    paths: [P([-31, 0], [-22, 0], [-16, -8], [-6, -10], [-4, -2], [-12, 4], [-10, 12], [0, 14], [6, 6], [4, -4], [10, -12], [20, -12], [24, -2], [18, 6], [22, 13], [30, 13])],
    waves: 15, gold: 1250, spots: 14, budget: 355, newEnemies: ['lavaslime', 'necro'], pool: ['imp', 'hound', 'golem', 'shield', 'hawk'], iron: ['barracks', 'mage'], mapPos: { x: 90, y: 62 } },
  { id: 14, name: '骸骨の大橋', desc: '魔城へ続く大橋。暗黒騎士とワイバーンの精鋭部隊だ。', region: 3,
    paths: [
      P([-31, -8], [-18, -8], [-8, -12], [2, -8], [10, -2], [20, -2], [30, -2]),
      P([-31, 8], [-18, 8], [-8, 12], [2, 8], [10, -2], [20, -2], [30, -2]),
      P([-6, -19], [-2, -13], [2, -8], [10, -2], [20, -2], [30, -2]),
    ],
    waves: 15, gold: 1350, spots: 15, budget: 335, newEnemies: ['darkknight', 'wyvern'], pool: ['imp', 'hound', 'lavaslime', 'necro', 'golem'], iron: ['archer', 'mage'], mapPos: { x: 88, y: 76 } },
  { id: 15, name: '九尾の魔城', desc: '最後の決戦。九尾の魔狐から黄金の卵を守り抜け!', region: 3,
    paths: [
      P([-31, -14], [-20, -14], [-14, -6], [-20, 2], [-12, 8], [-2, 4], [4, -4], [12, -6], [18, 0], [24, -2], [30, -2]),
      P([-31, 14], [-20, 14], [-10, 15], [-2, 10], [-2, 4], [4, -4], [12, -6], [18, 0], [24, -2], [30, -2]),
      P([10, -19], [11, -12], [12, -6], [18, 0], [24, -2], [30, -2]),
    ],
    waves: 16, gold: 1600, spots: 15, budget: 340, newEnemies: ['shadow'], pool: ['imp', 'hound', 'lavaslime', 'necro', 'darkknight', 'wyvern'], boss: 'demonfox', iron: ['barracks', 'artillery'], mapPos: { x: 78, y: 88 } },
];

export type Mode = 'campaign' | 'heroic' | 'iron';

function introWaveOf(st: StageDef, k: number): number {
  const n = st.newEnemies.length;
  const span = Math.max(2, Math.floor(st.waves * 0.55));
  return Math.min(st.waves - 2, Math.round(((k + 0.5) * span) / n));
}

function intervalFor(id: string): number {
  const e = ENEMY[id];
  let iv = 1.15 / Math.sqrt(e.speed);
  iv *= 0.6 + e.size * 0.9;
  if (e.hp > 500) iv *= 1.6;
  if (e.hp > 1000) iv *= 1.3;
  return Math.max(0.35, Math.min(3.2, iv));
}

/** Deterministic wave generator. KR-like pacing: intro of new enemies, mixed groups, escalation, boss finale. */
export function generateWaves(st: StageDef, mode: Mode): Wave[] {
  const rng = new Rng(9001 + st.id * 131 + (mode === 'heroic' ? 7 : mode === 'iron' ? 13 : 0));
  const nPaths = st.paths.length;
  const waves: Wave[] = [];
  const N = st.waves;
  const allNew = st.newEnemies;
  const flyCap = (id: string) => (ENEMY[id].flying ? 0.55 : 1);

  const makeWave = (w: number, p: number, budgetMul: number, forceIntro?: string): Wave => {
    const budget = st.budget * 1.12 * (1 + 0.014 * st.id) * (0.5 + 1.5 * p + 1.6 * p * p) * budgetMul;
    const avail: { id: string; wgt: number }[] = [];
    allNew.forEach((id, k) => {
      if (mode !== 'campaign' || introWaveOf(st, k) <= w) avail.push({ id, wgt: 3 });
    });
    for (const id of st.pool) avail.push({ id, wgt: 1.6 });
    if (avail.length === 0) avail.push({ id: allNew[0], wgt: 1 });
    const groups: SpawnGroup[] = [];
    const nGroups = Math.min(4, 1 + (w >= 1 ? 1 : 0) + (p > 0.45 ? 1 : 0) + (p > 0.8 && nPaths > 1 ? 1 : 0));
    const shares: number[] = [];
    for (let g = 0; g < nGroups; g++) shares.push(0.6 + rng.next());
    const sum = shares.reduce((a, b) => a + b, 0);
    let delay = 0;
    let usedFly = false;
    const pathOffset = rng.int(0, nPaths - 1);
    for (let g = 0; g < nGroups; g++) {
      let id: string;
      if (g === 0 && forceIntro) id = forceIntro;
      else {
        const opts = avail.filter((a) => !(usedFly && ENEMY[a.id].flying));
        const tot = opts.reduce((a, b) => a + b.wgt * flyCap(b.id), 0);
        let r = rng.next() * tot;
        id = opts[0].id;
        for (const o of opts) { r -= o.wgt * flyCap(o.id); if (r <= 0) { id = o.id; break; } }
      }
      if (ENEMY[id].flying) usedFly = true;
      const share = (budget * shares[g]) / sum;
      const count = Math.max(1, Math.min(36, Math.round(share / threat(ENEMY[id]))));
      const interval = intervalFor(id);
      const path = (pathOffset + g) % nPaths;
      groups.push({ enemy: id, count, interval, delay, path });
      // next group starts partway through this one (overlap)
      delay += count * interval * (nPaths > 1 ? 0.25 : 0.55) + rng.range(1, 3);
    }
    return { groups };
  };

  if (mode === 'campaign') {
    for (let w = 0; w < N; w++) {
      const p = N === 1 ? 1 : w / (N - 1);
      let intro: string | undefined;
      allNew.forEach((id, k) => { if (introWaveOf(st, k) === w) intro = id; });
      const wave = makeWave(w, p, w === N - 1 ? 1.2 : 1, intro);
      waves.push(wave);
    }
    if (st.boss) {
      const last = waves[N - 1];
      for (const g of last.groups) g.count = Math.max(1, Math.round(g.count * 0.45));
      last.groups.push({ enemy: st.boss, count: 1, interval: 1, delay: 8, path: 0 });
    }
  } else if (mode === 'heroic') {
    for (let w = 0; w < 6; w++) waves.push(makeWave(N, 0.55 + w * 0.09, 1.25));
  } else {
    // iron: one long relentless wave
    const groups: SpawnGroup[] = [];
    let delay = 0;
    for (let k = 0; k < 5; k++) {
      const wv = makeWave(N, 0.6 + k * 0.1, 1.05);
      for (const g of wv.groups) { groups.push({ ...g, delay: g.delay + delay }); }
      delay += 22;
    }
    waves.push({ groups });
  }
  return waves;
}

export function stageEnemies(st: StageDef): string[] {
  const s = new Set<string>();
  for (const w of generateWaves(st, 'campaign')) for (const g of w.groups) s.add(g.enemy);
  return [...s];
}
