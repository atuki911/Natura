/** Consumable battle items bought with gems (earned by playing; no real money). */
export type ItemId = 'bomb' | 'frost' | 'goldsack' | 'heart' | 'thunder';

export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  price: number;
  target: boolean; // needs a place on the map
}

export const ITEMS: ItemDef[] = [
  { id: 'bomb', name: '特大たまご爆弾', desc: '指定した場所で大爆発。範囲の地上の敵に大ダメージ。', price: 30, target: true },
  { id: 'frost', name: 'こおりの羽根', desc: '画面中の敵(ボス以外)を5秒間こおらせる。', price: 50, target: false },
  { id: 'goldsack', name: '金の卵袋', desc: 'すぐに金貨 +250。', price: 40, target: false },
  { id: 'heart', name: 'いのちのハート', desc: 'ライフ +5(最大20)。', price: 60, target: false },
  { id: 'thunder', name: 'かみなりトサカ', desc: '空と地上の敵12体に雷を落とす。', price: 80, target: false },
];
export const ITEM: Record<ItemId, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<ItemId, ItemDef>;

/** gems for finishing a stage */
export function gemReward(won: boolean, mode: string, stars: number, prevStars: number, difficulty: number, wavesReached: number): number {
  if (!won) return Math.min(15, 2 + wavesReached);
  if (mode !== 'campaign') return 50 + difficulty * 10;
  return 10 + stars * 8 + Math.max(0, stars - prevStars) * 12 + difficulty * 6;
}

export interface Tip { id: string; title: string; body: string }
export const TIPS: Tip[] = [
  { id: 'archer', title: '弓兵の塔', body: '空を飛ぶ敵にも矢が届く万能タワー。数を並べると序盤がぐっと楽になる。' },
  { id: 'barracks', title: '兵舎と集合地点', body: '兵士は道をふさいで敵を足止めする。塔をタップして旗のボタンを押すと、兵士の集合場所を道の好きな位置に変えられる。' },
  { id: 'mage', title: '魔法の塔', body: '鎧を着た硬い敵には魔法が効く。物理防御の高い敵が出たら魔法の塔を建てよう。' },
  { id: 'artillery', title: '砲台', body: '爆発で群れをまとめて攻撃する。ただし空の敵には届かない。兵士の足止めと組み合わせると強力。' },
  { id: 'early', title: '早めに呼ぶとボーナス', body: 'ドクロを早くタップするほど、ボーナス金貨がもらえて呪文の待ち時間も短くなる。' },
  { id: 'hero', title: 'ヒーローを動かそう', body: 'ヒーローのボタンを押してから地面をタップすると移動できる。倒れても少し待てば復活する。' },
  { id: 'items', title: '道具を使おう', body: 'ジェムでショップの道具を買うと、戦闘中に右下から使える。ピンチの切り札に。' },
  { id: 'upgrade', title: '★で研究', body: 'ステージで集めた★は研究所(強化)でタワーや呪文を強くするのに使える。いつでも振り直せる。' },
  { id: 'specialize', title: '専門タワー', body: '塔は3段階まで強化すると、2種類の専門タワーから1つを選べる。専門タワーは特殊能力も覚える。' },
  { id: 'flying', title: '空の敵', body: 'コウモリやカラスなど飛ぶ敵は、兵士と砲台では止められない。弓兵・魔法・雷鳴の塔で迎え撃とう。' },
];
