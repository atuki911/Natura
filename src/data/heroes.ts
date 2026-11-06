import type { DamageType } from './enemies.ts';

export interface HeroSkill { id: string; name: string; desc: string; cd: number }

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  desc: string;
  unlockStage: number; // index of stage that must be cleared (-1 = from start)
  hp: number; hpLv: number;
  dmg: [number, number]; dmgLv: number;
  rate: number;
  armor: number;
  speed: number;
  regen: number;
  ranged?: { range: number; proj: string; type: DamageType; aoe?: number };
  maxBlock: number;
  skills: HeroSkill[];
  model: string;
  color: string;
}

export const HEROES: HeroDef[] = [
  { id: 'kokka', name: 'コッカ', title: '炎剣の雄鶏', desc: '燃える剣を振るう勇敢な雄鶏。前に出て敵を斬り伏せる。',
    unlockStage: -1, hp: 320, hpLv: 40, dmg: [12, 20], dmgLv: 3, rate: 1, armor: 0.2, speed: 3.2, regen: 12, maxBlock: 1,
    skills: [
      { id: 'flameSlash', name: '火炎斬り', desc: '周囲の敵を炎で斬り、燃やす。', cd: 8 },
      { id: 'rallyCry', name: '鬨の声', desc: '近くの味方を回復し、攻撃力を上げる。', cd: 20 },
    ], model: 'hero_kokka', color: '#e8553a' },
  { id: 'bomba', name: 'ボンバ', title: '爆弾職人', desc: '爆弾を投げる職人の雄鶏。離れた敵をまとめて吹き飛ばす。',
    unlockStage: 2, hp: 240, hpLv: 28, dmg: [10, 22], dmgLv: 3, rate: 1.7, armor: 0.1, speed: 2.8, regen: 10, maxBlock: 1,
    ranged: { range: 7, proj: 'bomb', type: 'explosive', aoe: 1.7 },
    skills: [
      { id: 'megaBomb', name: '特大爆弾', desc: '巨大な爆弾で範囲の敵を気絶させる。', cd: 12 },
      { id: 'mine', name: '地雷まき', desc: '道に地雷を仕掛ける。', cd: 9 },
    ], model: 'hero_bomba', color: '#5a4636' },
  { id: 'miko', name: 'ミコ', title: '星読みの魔法ひよこ', desc: '星の魔法を使うひよこ。仲間の傷を癒し、星を降らせる。',
    unlockStage: 5, hp: 200, hpLv: 24, dmg: [14, 26], dmgLv: 4, rate: 1.1, armor: 0, speed: 3.0, regen: 10, maxBlock: 1,
    ranged: { range: 8, proj: 'starbolt', type: 'magic' },
    skills: [
      { id: 'healLight', name: '癒しの光', desc: '周りの味方の体力を大きく回復する。', cd: 10 },
      { id: 'starfall', name: '星降り', desc: '星を降らせて複数の敵に魔法ダメージ。', cd: 14 },
    ], model: 'hero_miko', color: '#9b6ee8' },
  { id: 'gardon', name: 'ガードン', title: '鉄壁の守護鶏', desc: '巨大な盾を持つ重装の雄鶏。同時に3体の敵を食い止める。',
    unlockStage: 9, hp: 600, hpLv: 70, dmg: [10, 16], dmgLv: 2, rate: 1.2, armor: 0.55, speed: 2.4, regen: 18, maxBlock: 3,
    skills: [
      { id: 'quake', name: '大地割り', desc: '地面を叩いて周りの敵を気絶させる。', cd: 10 },
      { id: 'fortify', name: '不動の構え', desc: '数秒間ほとんどダメージを受けなくなる。', cd: 18 },
    ], model: 'hero_gardon', color: '#4f7cac' },
];

export const HERO: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export const HERO_XP = [0, 300, 750, 1400, 2300, 3500, 5000, 7000, 9500, 12500];
export const HERO_MAX_LV = 10;

export function heroLevelFromXp(xp: number): number {
  let lv = 1;
  for (let i = 1; i < HERO_XP.length; i++) if (xp >= HERO_XP[i]) lv = i + 1;
  return lv;
}
