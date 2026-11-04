import type { DamageType } from './enemies.ts';

export type TowerLine = 'archer' | 'barracks' | 'mage' | 'artillery';

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  costs: number[];
  /** per-level value list used by the sim; meaning depends on the ability */
  values: number[];
}

export interface SoldierDef {
  name: string;
  count: number;
  hp: number;
  dmg: [number, number];
  rate: number;
  armor: number;
  respawn: number;
  model: string;
}

export interface TowerDef {
  id: string;
  line: TowerLine;
  tier: number;
  name: string;
  desc: string;
  cost: number;
  range: number;
  rate: number;
  dmg: [number, number];
  dmgType: DamageType;
  proj: string;
  aoe?: number;
  hitsFlying: boolean;
  slow?: { f: number; t: number };
  chain?: { bounces: number; range: number; falloff: number };
  soldiers?: SoldierDef;
  next: string[];
  abilities?: AbilityDef[];
  model: string;
}

export const TOWERS: TowerDef[] = [
  // ───── 弓兵 ─────
  { id: 'archer1', line: 'archer', tier: 1, name: 'ひよこ弓兵小屋', desc: '弓を持ったひよこが矢を放つ。空の敵も狙える。',
    cost: 70, range: 8.2, rate: 0.8, dmg: [4, 6], dmgType: 'physical', proj: 'arrow', hitsFlying: true, next: ['archer2'], model: 'archer' },
  { id: 'archer2', line: 'archer', tier: 2, name: 'コッコ射手の塔', desc: '若鶏の射手が素早く矢を射る。',
    cost: 110, range: 8.8, rate: 0.6, dmg: [7, 11], dmgType: 'physical', proj: 'arrow', hitsFlying: true, next: ['archer3'], model: 'archer' },
  { id: 'archer3', line: 'archer', tier: 3, name: '狙撃手の見張り塔', desc: '熟練の射手がそろった高い見張り塔。',
    cost: 160, range: 9.6, rate: 0.5, dmg: [10, 16], dmgType: 'physical', proj: 'arrow', hitsFlying: true, next: ['hawkeye', 'gatling'], model: 'archer' },
  { id: 'hawkeye', line: 'archer', tier: 4, name: '鷹の目の狙撃塔', desc: '遠くの敵を一撃で射抜く名手の塔。射程がとても長い。',
    cost: 230, range: 11.5, rate: 0.9, dmg: [26, 44], dmgType: 'physical', proj: 'arrow', hitsFlying: true, next: [], model: 'hawkeye',
    abilities: [
      { id: 'headshot', name: '必殺の一矢', desc: '一定確率で敵を一撃で倒す(ボスには3倍ダメージ)。', costs: [250, 200, 200], values: [0.06, 0.1, 0.14] },
      { id: 'poison', name: '毒の矢じり', desc: '矢に毒を塗り、防御無視の継続ダメージを与える(毎秒)。', costs: [150, 150, 150], values: [6, 12, 18] },
    ] },
  { id: 'gatling', line: 'archer', tier: 4, name: '連射コケコ砲台', desc: 'トウモロコシ弾を猛烈な勢いで撃ちまくる。',
    cost: 250, range: 8.8, rate: 0.16, dmg: [5, 9], dmgType: 'physical', proj: 'bullet', hitsFlying: true, next: [], model: 'gatling',
    abilities: [
      { id: 'barrage', name: '乱れ撃ち', desc: '定期的に範囲内の全ての敵に弾をばらまく(発射数)。', costs: [200, 150, 150], values: [14, 22, 30] },
      { id: 'shred', name: '鎧くだき弾', desc: '命中した敵の物理防御を下げる。', costs: [150, 150, 150], values: [0.12, 0.22, 0.32] },
    ] },
  // ───── 兵舎 ─────
  { id: 'barracks1', line: 'barracks', tier: 1, name: 'ひよこ兵の詰所', desc: '3羽のひよこ兵が道をふさいで敵を足止めする。',
    cost: 70, range: 7, rate: 1, dmg: [1, 3], dmgType: 'physical', proj: 'none', hitsFlying: false, next: ['barracks2'], model: 'barracks',
    soldiers: { name: 'ひよこ兵', count: 3, hp: 50, dmg: [1, 3], rate: 1, armor: 0, respawn: 10, model: 'chick_soldier' } },
  { id: 'barracks2', line: 'barracks', tier: 2, name: 'コッコ兵の砦', desc: '鍛えられたコッコ兵。体力と攻撃が上がる。',
    cost: 110, range: 7, rate: 1, dmg: [3, 5], dmgType: 'physical', proj: 'none', hitsFlying: false, next: ['barracks3'], model: 'barracks',
    soldiers: { name: 'コッコ兵', count: 3, hp: 100, dmg: [3, 5], rate: 1, armor: 0.15, respawn: 10, model: 'hen_soldier' } },
  { id: 'barracks3', line: 'barracks', tier: 3, name: '雄鶏騎士の城館', desc: '鎧の雄鶏騎士。頼れる前衛。',
    cost: 150, range: 7, rate: 1, dmg: [6, 10], dmgType: 'physical', proj: 'none', hitsFlying: false, next: ['paladin', 'berserker'], model: 'barracks',
    soldiers: { name: '雄鶏騎士', count: 3, hp: 160, dmg: [6, 10], rate: 1, armor: 0.3, respawn: 10, model: 'rooster_knight' } },
  { id: 'paladin', line: 'barracks', tier: 4, name: '聖騎士団の聖堂', desc: '光の鎧の聖騎士。とても硬く、仲間を癒す。',
    cost: 230, range: 7.5, rate: 1, dmg: [12, 18], dmgType: 'physical', proj: 'none', hitsFlying: false, next: [], model: 'paladin',
    soldiers: { name: '聖騎士', count: 3, hp: 260, dmg: [12, 18], rate: 1, armor: 0.5, respawn: 12, model: 'paladin_soldier' },
    abilities: [
      { id: 'heal', name: '癒しの祈り', desc: '体力が減ると自分を回復する(最大体力の割合)。', costs: [150, 150, 150], values: [0.3, 0.5, 0.7] },
      { id: 'holy', name: '聖なる一撃', desc: '攻撃時に確率で周囲に聖なる光の範囲ダメージ。', costs: [200, 150, 150], values: [25, 45, 65] },
    ] },
  { id: 'berserker', line: 'barracks', tier: 4, name: '狂戦士の闘技場', desc: '斧を振り回す荒くれ雄鶏。攻撃力が非常に高い。',
    cost: 230, range: 7.5, rate: 1, dmg: [20, 30], dmgType: 'physical', proj: 'none', hitsFlying: false, next: [], model: 'berserker',
    soldiers: { name: '狂戦士', count: 3, hp: 220, dmg: [20, 30], rate: 1, armor: 0.1, respawn: 12, model: 'berserker_soldier' },
    abilities: [
      { id: 'whirl', name: '大回転斬り', desc: '定期的に回転して周囲の敵すべてを斬る。', costs: [200, 150, 150], values: [20, 40, 60] },
      { id: 'axe', name: '投げ斧', desc: '離れた敵や飛行中の敵に斧を投げる。', costs: [150, 150, 150], values: [15, 28, 40] },
    ] },
  // ───── 魔法 ─────
  { id: 'mage1', line: 'mage', tier: 1, name: '魔法卵の塔', desc: '魔法のひよこが光弾を撃つ。防御の硬い敵に強い。',
    cost: 100, range: 7.6, rate: 1.5, dmg: [9, 17], dmgType: 'magic', proj: 'bolt', hitsFlying: true, next: ['mage2'], model: 'mage' },
  { id: 'mage2', line: 'mage', tier: 2, name: '魔導鶏の塔', desc: 'より強い魔力の光弾を放つ。',
    cost: 160, range: 8.1, rate: 1.5, dmg: [23, 43], dmgType: 'magic', proj: 'bolt', hitsFlying: true, next: ['mage3'], model: 'mage' },
  { id: 'mage3', line: 'mage', tier: 3, name: '大魔卵の尖塔', desc: '強大な魔力を秘めた虹色の卵の塔。',
    cost: 240, range: 8.6, rate: 1.5, dmg: [40, 74], dmgType: 'magic', proj: 'bolt', hitsFlying: true, next: ['arcane', 'frost'], model: 'mage' },
  { id: 'arcane', line: 'mage', tier: 4, name: '大賢者の天文塔', desc: '星の魔力で強烈な一撃を放つ。',
    cost: 300, range: 9.2, rate: 2.0, dmg: [76, 140], dmgType: 'magic', proj: 'arcane', hitsFlying: true, next: [], model: 'arcane',
    abilities: [
      { id: 'ray', name: '消滅の光', desc: '一番体力の多い敵を消し去る(ボスには大ダメージ)。再使用時間(秒)。', costs: [350, 250, 250], values: [22, 17, 12] },
      { id: 'teleport', name: '時空送り', desc: '近くの敵を道の後ろへ送り返す(人数)。', costs: [200, 150, 150], values: [3, 4, 6] },
    ] },
  { id: 'frost', line: 'mage', tier: 4, name: '氷結卵の塔', desc: '氷の魔法で敵を遅くする。',
    cost: 300, range: 9.2, rate: 1.4, dmg: [42, 64], dmgType: 'magic', proj: 'ice', hitsFlying: true, slow: { f: 0.55, t: 2.5 }, next: [], model: 'frost',
    abilities: [
      { id: 'freeze', name: '氷河の吐息', desc: '範囲の敵を凍らせて完全に止める(秒)。', costs: [250, 200, 200], values: [1.5, 2.5, 3.5] },
      { id: 'icicle', name: '氷柱の雨', desc: '定期的に複数の敵へ氷柱を降らせる(本数)。', costs: [150, 150, 150], values: [3, 5, 7] },
    ] },
  // ───── 砲台 ─────
  { id: 'artillery1', line: 'artillery', tier: 1, name: '卵キャノン', desc: '爆発する卵を撃ち、範囲の敵をまとめて攻撃。空には届かない。',
    cost: 125, range: 8, rate: 3, dmg: [8, 15], dmgType: 'explosive', proj: 'egg', aoe: 2.1, hitsFlying: false, next: ['artillery2'], model: 'artillery' },
  { id: 'artillery2', line: 'artillery', tier: 2, name: '双子卵キャノン', desc: 'より大きな爆裂卵を撃ち出す。',
    cost: 220, range: 8.5, rate: 3, dmg: [20, 40], dmgType: 'explosive', proj: 'egg', aoe: 2.3, hitsFlying: false, next: ['artillery3'], model: 'artillery' },
  { id: 'artillery3', line: 'artillery', tier: 3, name: '金の卵大砲', desc: '黄金の大砲。威力抜群。',
    cost: 320, range: 9, rate: 3, dmg: [32, 60], dmgType: 'explosive', proj: 'egg', aoe: 2.5, hitsFlying: false, next: ['bigegg', 'tesla'], model: 'artillery' },
  { id: 'bigegg', line: 'artillery', tier: 4, name: '超巨大オムレツ砲', desc: '巨大な卵を遠くまで飛ばす攻城砲。爆発範囲が広い。',
    cost: 350, range: 11, rate: 3.6, dmg: [55, 105], dmgType: 'explosive', proj: 'bigegg', aoe: 3.2, hitsFlying: false, next: [], model: 'bigegg',
    abilities: [
      { id: 'missile', name: 'ひな鳥ミサイル', desc: '追尾ミサイルを撃つ。空の敵にも当たる。', costs: [250, 150, 150], values: [100, 180, 260] },
      { id: 'cluster', name: '子卵ばら撒き', desc: '着弾時に小さな卵爆弾を撒き散らす(個数)。', costs: [200, 150, 150], values: [3, 5, 7] },
    ] },
  { id: 'tesla', line: 'artillery', tier: 4, name: '雷鳴コッコ塔', desc: '連鎖する稲妻で敵を焼く。空の敵にも当たる。',
    cost: 375, range: 8.6, rate: 2.0, dmg: [30, 55], dmgType: 'magic', proj: 'lightning', hitsFlying: true,
    chain: { bounces: 3, range: 3.6, falloff: 0.8 }, next: [], model: 'tesla',
    abilities: [
      { id: 'overcharge', name: '過充電', desc: '攻撃のたびに塔の周りへ放電する。', costs: [250, 200, 200], values: [10, 18, 26] },
      { id: 'conductor', name: '超伝導', desc: '稲妻が跳ねる回数が増え、威力が落ちにくくなる。', costs: [200, 150, 150], values: [1, 2, 3] },
    ] },
];

export const TOWER: Record<string, TowerDef> = Object.fromEntries(TOWERS.map((t) => [t.id, t]));

export const LINE_INFO: Record<TowerLine, { name: string; base: string; model: string; color: string; icon: string }> = {
  archer: { name: '弓兵', base: 'archer1', model: 'archer', color: '#6aa84f', icon: '🏹' },
  barracks: { name: '兵舎', base: 'barracks1', model: 'barracks', color: '#d9822b', icon: '🛡️' },
  mage: { name: '魔法', base: 'mage1', model: 'mage', color: '#8e5cd9', icon: '✨' },
  artillery: { name: '砲台', base: 'artillery1', model: 'artillery', color: '#c0392b', icon: '💣' },
};
export const LINES: TowerLine[] = ['archer', 'barracks', 'mage', 'artillery'];
