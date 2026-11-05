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

/** 旗を立てられる一番手前(城の近く)。 */
export const RALLY_MIN = 330;

/** タワーを建てられる場所の x。 */
export const TOWER_SLOTS = [380, 590, 790];

export const ECONOMY = {
  /**
   * 時間で入るゴールド。旗(前線)が前にあるほど多い(取り戻した土地が実りを生む)。
   * 旗が一番手前なら goldPerSecondMin、門の前なら goldPerSecond。
   */
  goldPerSecond: 6,
  goldPerSecondMin: 4,
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
