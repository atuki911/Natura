// 戦場の寸法と時間の刻み。描画側も同じ値を使って位置を合わせる。

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const FIELD = {
  width: 1280,
  /** 味方の城の正面。敵はここまで来ると城を攻撃する。 */
  castleX: 200,
  /** 敵が湧き出す門。 */
  portalX: 1150,
  /** 味方が待機する最前線。 */
  rallyX: 940,
  /** 遠距離ユニットは最前線より少し手前で止まる。 */
  rangedRallyOffset: 70,
};

/** タワーを建てられる場所の x。 */
export const TOWER_SLOTS = [380, 590, 790];

export const ECONOMY = {
  goldPerSecond: 5,
  manaPerSecond: 3,
  maxMana: 200,
  /** 休憩を早めに切り上げた時、残り1秒ごとにもらえるゴールド。 */
  earlyBonusPerSecond: 3,
  maxAllies: 40,
};

/** 城に住む弓兵。 */
export const CASTLE_ARCHER = {
  damage: 14,
  interval: 1.1,
  range: 330,
};
