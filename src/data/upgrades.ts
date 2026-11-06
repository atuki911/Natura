export type UpgradeTrack = 'archer' | 'barracks' | 'mage' | 'artillery' | 'meteor' | 'reinforce';

export interface UpgradeTrackDef {
  id: UpgradeTrack;
  name: string;
  icon: string;
  levels: { name: string; desc: string; cost: number }[];
}

export const UPGRADES: UpgradeTrackDef[] = [
  { id: 'archer', name: '弓兵', icon: '🏹', levels: [
    { name: '鷹の目', desc: '弓兵系タワーの射程+10%', cost: 1 },
    { name: '鋭い矢じり', desc: '弓兵系のダメージ+10%', cost: 1 },
    { name: '鎧通し', desc: '敵の物理防御を15%無視する', cost: 2 },
    { name: '早撃ち訓練', desc: '弓兵系の攻撃速度+12%', cost: 2 },
    { name: '会心の一射', desc: '10%の確率で2倍ダメージ', cost: 3 },
  ] },
  { id: 'barracks', name: '兵舎', icon: '🛡️', levels: [
    { name: '栄養たっぷりの餌', desc: '兵士の体力+15%', cost: 1 },
    { name: '早い招集', desc: '兵士の復活時間-30%', cost: 1 },
    { name: '鉄の羽当て', desc: '兵士の物理防御+10%', cost: 2 },
    { name: '鋭いくちばし', desc: '兵士の攻撃力+20%', cost: 2 },
    { name: '戦いの歌', desc: '戦っていない兵士が素早く回復', cost: 3 },
  ] },
  { id: 'mage', name: '魔法', icon: '✨', levels: [
    { name: '魔力の卵黄', desc: '魔法系のダメージ+10%', cost: 1 },
    { name: '遠見の水晶', desc: '魔法系の射程+10%', cost: 1 },
    { name: '魔法学院', desc: '魔法系タワーの建設・強化費-10%', cost: 2 },
    { name: '魔法の呪い', desc: '魔法の命中で敵の魔法防御を下げる', cost: 2 },
    { name: '大魔力', desc: '魔法系のダメージ+15%', cost: 3 },
  ] },
  { id: 'artillery', name: '砲台', icon: '💣', levels: [
    { name: '火薬増量', desc: '爆発範囲+15%', cost: 1 },
    { name: '固ゆで弾', desc: '砲台系のダメージ+10%', cost: 1 },
    { name: '長い砲身', desc: '砲台系の射程+10%', cost: 2 },
    { name: '量産工房', desc: '砲台系タワーの建設・強化費-10%', cost: 2 },
    { name: '衝撃波', desc: '爆発に巻き込んだ敵を減速させる', cost: 3 },
  ] },
  { id: 'meteor', name: '卵メテオ', icon: '☄️', levels: [
    { name: '早い詠唱', desc: '再使用時間-10秒', cost: 1 },
    { name: '流星群', desc: '落ちる卵+2個', cost: 1 },
    { name: '燃える黄身', desc: 'メテオのダメージ+25%', cost: 2 },
    { name: '大流星群', desc: '落ちる卵+2個', cost: 2 },
    { name: '焦土', desc: '着弾地点がしばらく燃え続ける', cost: 3 },
  ] },
  { id: 'reinforce', name: '援軍', icon: '🐣', levels: [
    { name: '元気なひよこ', desc: '援軍の体力+40%', cost: 1 },
    { name: '鋭い爪', desc: '援軍の攻撃力+40%', cost: 1 },
    { name: '小さな兜', desc: '援軍の物理防御+25%', cost: 2 },
    { name: '三羽の絆', desc: '援軍が3羽になる', cost: 2 },
    { name: '長期滞在', desc: '援軍の滞在時間+10秒', cost: 3 },
  ] },
];

export type UpgradeState = Record<UpgradeTrack, number>;
export const emptyUpgrades = (): UpgradeState => ({ archer: 0, barracks: 0, mage: 0, artillery: 0, meteor: 0, reinforce: 0 });
