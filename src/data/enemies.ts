export type DamageType = 'physical' | 'magic' | 'explosive' | 'true';

export interface EnemyDef {
  id: string;
  name: string;
  desc: string;
  region: number;
  hp: number;
  speed: number;
  armor: number;
  mr: number;
  gold: number;
  lives: number;
  size: number;
  flying?: boolean;
  dmg: [number, number];
  rate: number;
  ranged?: { range: number; dmg: [number, number]; rate: number; type: DamageType; proj: string };
  regen?: number;
  dodge?: number;
  heal?: { radius: number; amount: number; cd: number };
  armorAura?: { radius: number; amount: number };
  spawnOnDeath?: { id: string; count: number };
  summon?: { id: string; count: number; cd: number };
  towerFreeze?: { cd: number; dur: number; radius: number };
  stunUnits?: { cd: number; dur: number; radius: number };
  explodeOnDeath?: { radius: number; dmg: number };
  boss?: boolean;
  model: string;
  scale: number;
  tags: string[];
}

const GOLD_MUL = [1, 1.35, 1.75, 2.1];
const D = (d: Omit<EnemyDef, 'tags'> & { tags?: string[] }): EnemyDef => ({ tags: [], ...d, gold: Math.round(d.gold * GOLD_MUL[d.region]) });

export const ENEMIES: EnemyDef[] = [
  // ───────────── 地方1: 若葉の草原 ─────────────
  D({ id: 'slime', name: 'ぷるスライム', desc: 'どこにでも湧く緑のスライム。弱いが数で押してくる。', region: 0,
    hp: 22, speed: 1.3, armor: 0, mr: 0, gold: 3, lives: 1, size: 0.45, dmg: [1, 3], rate: 1, model: 'slime', scale: 1 }),
  D({ id: 'sprout', name: '芽ゾンビ', desc: '畑から這い出た歩く芽。足が速い。', region: 0,
    hp: 28, speed: 2.0, armor: 0, mr: 0, gold: 4, lives: 1, size: 0.4, dmg: [1, 4], rate: 1, model: 'sprout', scale: 1, tags: ['高速'] }),
  D({ id: 'spikeball', name: 'トゲボール', desc: '紫のトゲで身を守る丸い魔物。物理攻撃に少し強い。', region: 0,
    hp: 70, speed: 1.15, armor: 0.3, mr: 0, gold: 7, lives: 1, size: 0.55, dmg: [3, 6], rate: 1, model: 'spikeball', scale: 1, tags: ['物理防御・低'] }),
  D({ id: 'spider', name: '牙グモ', desc: '卵が大好物の大きなクモ。', region: 0,
    hp: 90, speed: 1.35, armor: 0.1, mr: 0, gold: 8, lives: 1, size: 0.6, dmg: [4, 8], rate: 1.1, model: 'spider', scale: 1 }),
  D({ id: 'weasel', name: 'イタチ盗賊', desc: '鶏の天敵。すばしっこく、矢をひらりとかわす。', region: 0,
    hp: 55, speed: 2.3, armor: 0, mr: 0, gold: 6, lives: 1, size: 0.45, dmg: [3, 5], rate: 0.8, dodge: 0.25, model: 'weasel', scale: 1, tags: ['高速', '回避'] }),
  D({ id: 'bat', name: '夜コウモリ', desc: '空から来るので兵士では止められない。', region: 0,
    hp: 40, speed: 1.8, armor: 0, mr: 0, gold: 6, lives: 1, size: 0.45, flying: true, dmg: [0, 0], rate: 1, model: 'bat', scale: 1, tags: ['飛行'] }),
  D({ id: 'boar', name: '鉄牙イノシシ', desc: '鎧を着た猪。魔法で攻めよう。', region: 0,
    hp: 260, speed: 1.0, armor: 0.55, mr: 0, gold: 18, lives: 2, size: 0.75, dmg: [8, 14], rate: 1.2, model: 'boar', scale: 1, tags: ['物理防御・中'] }),
  D({ id: 'bigslime', name: 'デカスライム', desc: '倒すと小さなスライム3匹に分裂する。', region: 0,
    hp: 170, speed: 1.0, armor: 0, mr: 0.2, gold: 10, lives: 2, size: 0.8, dmg: [5, 9], rate: 1.2,
    spawnOnDeath: { id: 'slime', count: 3 }, model: 'bigslime', scale: 1, tags: ['分裂'] }),
  // ───────────── 地方2: 迷いの森と沼 ─────────────
  D({ id: 'snake', name: '卵泥棒ヘビ', desc: '素早く地を這うヘビ。卵を丸のみにする。', region: 1,
    hp: 120, speed: 2.0, armor: 0.1, mr: 0, gold: 9, lives: 1, size: 0.5, dmg: [5, 9], rate: 0.9, model: 'snake', scale: 1, tags: ['高速'] }),
  D({ id: 'frog', name: 'カエル呪術師', desc: '周りの仲間を回復する。魔法に強い。最優先で倒そう。', region: 1,
    hp: 160, speed: 1.1, armor: 0, mr: 0.5, gold: 14, lives: 1, size: 0.55, dmg: [4, 8], rate: 1,
    heal: { radius: 3.2, amount: 40, cd: 4 }, ranged: { range: 4, dmg: [6, 12], rate: 1.5, type: 'magic', proj: 'spit' },
    model: 'frog', scale: 1, tags: ['回復', '魔法防御・中'] }),
  D({ id: 'mushroom', name: '胞子キノコ', desc: '倒すと胞子の子キノコを撒き散らす。', region: 1,
    hp: 230, speed: 0.95, armor: 0.2, mr: 0.2, gold: 14, lives: 2, size: 0.65, dmg: [6, 10], rate: 1.2,
    spawnOnDeath: { id: 'spore', count: 4 }, model: 'mushroom', scale: 1, tags: ['分裂'] }),
  D({ id: 'spore', name: 'ちび胞子', desc: '胞子キノコから生まれる小さなキノコ。', region: 1,
    hp: 22, speed: 1.8, armor: 0, mr: 0, gold: 1, lives: 1, size: 0.3, dmg: [1, 2], rate: 1, model: 'spore', scale: 1, tags: ['高速'] }),
  D({ id: 'crow', name: 'カラス盗賊団', desc: 'キラキラした物と卵を狙う空の盗賊。', region: 1,
    hp: 90, speed: 2.2, armor: 0, mr: 0, gold: 9, lives: 1, size: 0.5, flying: true, dmg: [0, 0], rate: 1, model: 'crow', scale: 1, tags: ['飛行', '高速'] }),
  D({ id: 'troll', name: '沼トロール', desc: '攻撃が途切れると傷がみるみる治る大男。休まず攻め続けよう。', region: 1,
    hp: 600, speed: 0.9, armor: 0, mr: 0, gold: 30, lives: 3, size: 0.9, dmg: [15, 25], rate: 1.5, regen: 12,
    model: 'troll', scale: 1, tags: ['再生'] }),
  D({ id: 'mosquito', name: '吸血ヤブカ', desc: '群れで飛んでくる。一匹一匹は弱い。', region: 1,
    hp: 30, speed: 2.0, armor: 0, mr: 0, gold: 3, lives: 1, size: 0.3, flying: true, dmg: [0, 0], rate: 1, model: 'mosquito', scale: 1, tags: ['飛行'] }),
  D({ id: 'treant', name: '呪いの樹', desc: '硬い樹皮に覆われた歩く木。とても遅い。', region: 1,
    hp: 1000, speed: 0.7, armor: 0.7, mr: 0, gold: 45, lives: 3, size: 1.0, dmg: [20, 35], rate: 2,
    model: 'treant', scale: 1, tags: ['物理防御・高'] }),
  // ───────────── 地方3: 雪の峰 ─────────────
  D({ id: 'fox', name: 'キツネ忍者', desc: '影のように素早い。攻撃の多くをかわす。', region: 2,
    hp: 200, speed: 2.2, armor: 0.1, mr: 0.1, gold: 14, lives: 1, size: 0.5, dmg: [8, 14], rate: 0.7, dodge: 0.35,
    model: 'fox', scale: 1, tags: ['高速', '回避'] }),
  D({ id: 'yeti', name: 'イエティ', desc: '雪山の怪力。兵士をまとめて吹き飛ばす。', region: 2,
    hp: 950, speed: 0.95, armor: 0.2, mr: 0.3, gold: 40, lives: 3, size: 0.95, dmg: [25, 40], rate: 1.6,
    stunUnits: { cd: 8, dur: 1.5, radius: 2 }, model: 'yeti', scale: 1, tags: ['気絶攻撃'] }),
  D({ id: 'icespirit', name: '氷の精霊', desc: '冷気でできた体。魔法がほとんど効かない。', region: 2,
    hp: 240, speed: 1.6, armor: 0.2, mr: 0.8, gold: 16, lives: 1, size: 0.5, flying: true, dmg: [0, 0], rate: 1,
    model: 'icespirit', scale: 1, tags: ['飛行', '魔法防御・高'] }),
  D({ id: 'wolf', name: 'オオカミ騎兵', desc: '狼に乗ったゴブリン。速くてしぶとい。', region: 2,
    hp: 330, speed: 2.0, armor: 0.3, mr: 0, gold: 18, lives: 1, size: 0.7, dmg: [10, 18], rate: 1,
    model: 'wolf', scale: 1, tags: ['高速', '物理防御・低'] }),
  D({ id: 'golem', name: '岩ゴーレム', desc: '岩の巨体。物理攻撃はほぼ効かない。', region: 2,
    hp: 1300, speed: 0.75, armor: 0.85, mr: 0, gold: 55, lives: 3, size: 1.05, dmg: [30, 45], rate: 2,
    model: 'golem', scale: 1, tags: ['物理防御・最高'] }),
  D({ id: 'hawk', name: '狩人の鷹', desc: '鶏を狩る猛禽。空から急降下してくる。', region: 2,
    hp: 230, speed: 2.4, armor: 0.2, mr: 0, gold: 15, lives: 1, size: 0.6, flying: true, dmg: [0, 0], rate: 1,
    model: 'hawk', scale: 1, tags: ['飛行', '高速'] }),
  D({ id: 'shield', name: '盾持ちゴブリン', desc: '大盾で周りの仲間の防御を上げる。', region: 2,
    hp: 520, speed: 1.0, armor: 0.6, mr: 0, gold: 25, lives: 2, size: 0.7, dmg: [10, 16], rate: 1.2,
    armorAura: { radius: 3, amount: 0.25 }, model: 'shield', scale: 1, tags: ['防御オーラ', '物理防御・中'] }),
  // ───────────── 地方4: 火山と魔城 ─────────────
  D({ id: 'imp', name: 'ボム小鬼', desc: '爆弾を抱えた小鬼。倒れると周りの兵士を巻き込んで爆発する。', region: 3,
    hp: 170, speed: 1.7, armor: 0, mr: 0.2, gold: 10, lives: 1, size: 0.45, dmg: [6, 10], rate: 1,
    explodeOnDeath: { radius: 2, dmg: 40 }, model: 'imp', scale: 1, tags: ['自爆'] }),
  D({ id: 'lavaslime', name: '溶岩スライム', desc: 'マグマのスライム。倒すと溶岩の子に分裂する。', region: 3,
    hp: 650, speed: 0.9, armor: 0.2, mr: 0.5, gold: 28, lives: 2, size: 0.85, dmg: [15, 25], rate: 1.3,
    spawnOnDeath: { id: 'lavaling', count: 2 }, model: 'lavaslime', scale: 1, tags: ['分裂', '魔法防御・中'] }),
  D({ id: 'lavaling', name: '溶岩の子', desc: '溶岩スライムから生まれた小さな火の玉。', region: 3,
    hp: 140, speed: 1.4, armor: 0.1, mr: 0.4, gold: 5, lives: 1, size: 0.45, dmg: [5, 9], rate: 1, model: 'lavaling', scale: 1 }),
  D({ id: 'hound', name: '魔界の猟犬', desc: '炎をまとった黒い犬。とても速い。', region: 3,
    hp: 380, speed: 2.5, armor: 0.2, mr: 0.2, gold: 20, lives: 1, size: 0.65, dmg: [12, 20], rate: 0.8,
    model: 'hound', scale: 1, tags: ['高速'] }),
  D({ id: 'necro', name: '死霊術キツネ', desc: '倒れた魔物の骨からガイコツ兵を呼び出す。', region: 3,
    hp: 700, speed: 0.95, armor: 0.1, mr: 0.6, gold: 35, lives: 2, size: 0.65, dmg: [10, 15], rate: 1.2,
    summon: { id: 'skeleton', count: 2, cd: 12 }, ranged: { range: 5, dmg: [15, 25], rate: 2, type: 'magic', proj: 'darkbolt' },
    model: 'necro', scale: 1, tags: ['召喚', '魔法防御・中'] }),
  D({ id: 'skeleton', name: 'ガイコツ兵', desc: '呼び出された骨の兵士。', region: 3,
    hp: 120, speed: 1.2, armor: 0.3, mr: 0, gold: 2, lives: 1, size: 0.45, dmg: [5, 9], rate: 1, model: 'skeleton', scale: 1 }),
  D({ id: 'darkknight', name: '暗黒騎士', desc: '黒い甲冑の騎士。物理攻撃をほとんど通さない。', region: 3,
    hp: 1300, speed: 0.85, armor: 0.85, mr: 0.1, gold: 60, lives: 3, size: 0.85, dmg: [35, 50], rate: 1.4,
    model: 'darkknight', scale: 1, tags: ['物理防御・最高'] }),
  D({ id: 'wyvern', name: 'ワイバーン', desc: '火を吐く飛竜。空からの脅威。', region: 3,
    hp: 600, speed: 1.2, armor: 0.3, mr: 0.3, gold: 40, lives: 2, size: 0.95, flying: true, dmg: [0, 0], rate: 1,
    model: 'wyvern', scale: 1, tags: ['飛行'] }),
  D({ id: 'shadow', name: '影の亡霊', desc: '実体のない影。物理攻撃がまったく効かない。', region: 3,
    hp: 500, speed: 1.3, armor: 0.95, mr: 0, gold: 30, lives: 2, size: 0.55, dmg: [12, 18], rate: 1,
    model: 'shadow', scale: 1, tags: ['物理防御・最高'] }),
  // ───────────── ボス ─────────────
  D({ id: 'kingslime', name: 'キングスライム', desc: '草原のスライムを束ねる王。歩きながらスライムを産み落とす。', region: 0,
    hp: 3200, speed: 0.55, armor: 0.2, mr: 0.2, gold: 0, lives: 20, size: 1.8, dmg: [40, 60], rate: 2, boss: true,
    summon: { id: 'slime', count: 3, cd: 6.5 }, spawnOnDeath: { id: 'bigslime', count: 3 },
    model: 'kingslime', scale: 1, tags: ['ボス', '召喚'] }),
  D({ id: 'serpent', name: '沼の大蛇ヨルム', desc: '沼の主。傷を再生し、近くの兵士を毒牙で気絶させる。', region: 1,
    hp: 4500, speed: 0.5, armor: 0.4, mr: 0.3, gold: 0, lives: 20, size: 1.8, dmg: [60, 90], rate: 1.8, boss: true, regen: 25,
    stunUnits: { cd: 9, dur: 2, radius: 3 }, summon: { id: 'snake', count: 2, cd: 8 },
    model: 'serpent', scale: 1, tags: ['ボス', '再生', '召喚'] }),
  D({ id: 'frostgiant', name: '氷の巨人ブリザ', desc: '雪山の巨人。冷気で近くのタワーを凍らせて止める。', region: 2,
    hp: 7200, speed: 0.5, armor: 0.5, mr: 0.4, gold: 0, lives: 20, size: 2.0, dmg: [90, 130], rate: 2.2, boss: true,
    towerFreeze: { cd: 13, dur: 3.5, radius: 7 }, summon: { id: 'wolf', count: 1, cd: 14 },
    model: 'frostgiant', scale: 1, tags: ['ボス', 'タワー凍結'] }),
  D({ id: 'demonfox', name: '九尾の魔狐', desc: '全ての黒幕。黄金の卵を狙う魔王。手下を呼び、タワーを封じる。', region: 3,
    hp: 19000, speed: 0.5, armor: 0.45, mr: 0.55, gold: 0, lives: 20, size: 2.1, dmg: [120, 180], rate: 2, boss: true, regen: 20,
    towerFreeze: { cd: 13, dur: 4, radius: 10 }, summon: { id: 'hound', count: 2, cd: 12 }, stunUnits: { cd: 10, dur: 2, radius: 3 },
    model: 'demonfox', scale: 1, tags: ['ボス', '召喚', 'タワー封印'] }),
];

export const ENEMY: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/** rough difficulty weight used by the wave generator */
export function threat(e: EnemyDef): number {
  let eff = e.hp / Math.max(0.3, 1 - 0.6 * e.armor - 0.4 * e.mr);
  eff *= Math.sqrt(e.speed / 1.2);
  if (e.dodge) eff *= 1 + e.dodge * 0.6;
  if (e.regen) eff *= 1.35;
  if (e.flying) eff *= 1.2;
  if (e.heal) eff *= 1.4;
  if (e.armorAura) eff *= 1.3;
  if (e.spawnOnDeath) eff += threat(ENEMY_LATE(e.spawnOnDeath.id)) * e.spawnOnDeath.count;
  if (e.summon) eff *= 1.5;
  return eff;
}
function ENEMY_LATE(id: string): EnemyDef { return ENEMIES.find((x) => x.id === id)!; }
