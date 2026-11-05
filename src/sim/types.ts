// 戦闘の計算で使う型。描画のコード(Phaser)をここから参照しない。

export type Side = 'ally' | 'enemy';

/** 攻撃の種類。描画側はこれを見てエフェクトを選ぶ。 */
export type AttackKind = 'melee' | 'arrow' | 'bolt' | 'bomb' | 'spit' | 'slam' | 'cannon';

export type UnitId = 'sword' | 'archer' | 'mage' | 'bomber';
export type EnemyId =
  | 'blightling'
  | 'gnasher'
  | 'tuskbeast'
  | 'wisp'
  | 'rollereye'
  | 'mireMaw'
  | 'rotMoth'
  | 'burrower'
  | 'sporeMother'
  | 'blightHeart';
export type TowerId = 'arrowTower' | 'cannonTower';
export type AbilityId = 'heal' | 'meteor';
export type TreeId = 'thornBush' | 'watchTree' | 'manaFlower' | 'seedPod';

export interface Cost {
  gold: number;
  mana: number;
}

/** 味方・敵に共通の戦闘の値。時間は秒、距離はピクセル。 */
export interface CombatStats {
  hp: number;
  damage: number;
  /** この距離以内の相手を攻撃できる。 */
  range: number;
  /** 攻撃してから次の攻撃までの秒数。 */
  attackInterval: number;
  /** 攻撃を始めてから当たるまでの秒数(振りかぶり)。 */
  windup: number;
  /** 1秒に進むピクセル数。 */
  speed: number;
  attack: AttackKind;
  /** 0なら単体、それ以上ならその半径に範囲ダメージ。 */
  splash: number;
  /** 物理ダメージの軽減率(0〜1)。魔法には効かない。 */
  armor: number;
  /** 魔法ダメージの軽減率(0〜1)。物理には効かない。 */
  ward: number;
  /** 魔法攻撃なら防具を無視する。 */
  magic: boolean;
  /** 空を飛ぶ相手に攻撃が届くか。 */
  hitsFlying: boolean;
  /** 自分が空を飛んでいるか。近接攻撃が届かない。 */
  flying: boolean;
  critChance: number;
  critMult: number;
  /** 当てた相手を押し返す距離。 */
  knockback: number;
}

export interface UnitDef extends CombatStats {
  id: UnitId;
  cost: Cost;
  /** 同じユニットを次に出せるまでの秒数。 */
  spawnCooldown: number;
}

export type EnemySpecial =
  | { type: 'charge'; damageMult: number; knockback: number; slowAfter: number }
  | { type: 'summon'; enemy: EnemyId; count: number; every: number; cycle?: EnemyId[] }
  /** 木を見つけるとそちらを優先してかじる。 */
  | { type: 'treeHunter' }
  /** 地中を進み、茨に止められず、茨のとげも受けない。 */
  | { type: 'burrow' };

export interface EnemyDef extends CombatStats {
  id: EnemyId;
  bounty: number;
  boss: boolean;
  special: EnemySpecial | null;
  /** 周りの木を枯らす力(ボス)。 */
  witherAura?: { radius: number; dps: number };
}

export type FighterDef = UnitDef | EnemyDef;

export interface TowerDef {
  id: TowerId;
  cost: Cost;
  range: number;
  damage: number;
  interval: number;
  attack: 'arrow' | 'cannon';
  splash: number;
  hitsFlying: boolean;
  hitsGround: boolean;
}

/** 倒れた兵から生える木。 */
export interface TreeDef {
  id: TreeId;
  hp: number;
  /** 芽が出てから働き始めるまでの秒数。芽の間は何もせず、狙われもしない。 */
  growTime: number;
  /** 1秒ごとに自然に枯れていく HP。 */
  decayPerSecond: number;
  /** 木の幅の半分。この範囲に立つ敵が木を踏む・茨に触れる。 */
  radius: number;
  /** 地上の敵がここで足を止めて木を攻撃するか(空を飛ぶ敵は止まらない)。 */
  blocks: boolean;
  /** 上に立つ地上の敵1体ごとに、1秒で減る HP(穢れに踏まれて枯れる)。 */
  trampleDps: number;
  thorn: { damage: number; interval: number; slowMult: number; slowTime: number } | null;
  shooter: { range: number; damage: number; interval: number } | null;
  /** 蜜。1秒に perSecond たまり、cap まで。minHarvest 以上で摘める。 */
  nectar: { perSecond: number; cap: number; minHarvest: number; manaPer: number; goldPer: number } | null;
  /** 敵が trigger 以内に来るとはじける。 */
  pod: { trigger: number; damage: number; splash: number; knockback: number } | null;
  /** 引き抜いた時にもらえるゴールド(残り HP の割合をかける)。 */
  uprootGold: number;
}

export interface Tree {
  id: number;
  def: TreeDef;
  /** どの兵から生えたか。 */
  from: UnitId;
  x: number;
  row: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** 芽の残り秒数。0以下なら育っている。 */
  growing: number;
  cooldown: number;
  nectar: number;
  age: number;
}

export interface AbilityDef {
  id: AbilityId;
  mana: number;
  cooldown: number;
  /** 場所を選んで使うか。 */
  targeted: boolean;
}

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** 1体ごとの間隔(秒)。 */
  interval: number;
  /** ウェーブ開始からこのグループが出始めるまでの秒数。 */
  delay: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
}

export type RegionId = 1 | 2 | 3;

export interface StageDef {
  id: string;
  region: RegionId;
  /** 地域の中の番号(1始まり)。 */
  index: number;
  name: { en: string; ja: string };
  /** 背景のテクスチャの key。 */
  background: string;
  /** このステージで出せる兵。 */
  units: UnitId[];
  /** 最初の1回だけ遊び方の手引きを出す。 */
  tutorial?: boolean;
  waves: WaveDef[];
  startGold: number;
  startMana: number;
  castleHp: number;
  /** 最初のウェーブまでの秒数。 */
  firstBreak: number;
  /** ウェーブの間の秒数。 */
  breakTime: number;
}

export interface Fighter {
  id: number;
  side: Side;
  def: FighterDef;
  x: number;
  /** 道の奥行き(0=奥、1=手前)。戦闘の計算には使わず、描画の重なり順と高さにだけ使う。 */
  row: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  state: 'walk' | 'idle' | 'attack';
  /** 次に攻撃できるまでの秒数。 */
  cooldown: number;
  /** 振りかぶり中の残り秒数。振りかぶっていなければ -1。 */
  windup: number;
  /** 攻撃中の相手。城なら CASTLE_TARGET。 */
  targetId: number | null;
  /** 突進を使ったか。 */
  charged: boolean;
  summonTimer: number;
  /** これまでに呼び出した数(呼び出す種類を順番に変える時に使う)。 */
  summonCount: number;
  /** 出てからの秒数。 */
  age: number;
  /** 与えたダメージの合計(倒れた時に木になるかを決める)。 */
  dealt: number;
  /** 茨で遅くなっている残り秒数。 */
  slowTimer: number;
  slowMult: number;
}

export const CASTLE_TARGET = -1;

export interface Projectile {
  id: number;
  side: Side;
  kind: AttackKind;
  startX: number;
  x: number;
  /** 発射した高さ(描画用)。 */
  startRow: number;
  targetId: number;
  targetX: number;
  targetRow: number;
  targetFlying: boolean;
  speed: number;
  damage: number;
  crit: boolean;
  splash: number;
  magic: boolean;
  hitsFlying: boolean;
  hitsGround: boolean;
  /** 発射元。タワーなら 'tower'、城なら 'castle'、見張りの木なら 'tree'。 */
  source: 'fighter' | 'tower' | 'castle' | 'tree';
  /** タワーならスロット番号、木なら木の id。 */
  sourceSlot: number;
  /** 撃った兵の id(与えたダメージを数える)。兵でなければ -1。 */
  ownerId: number;
}

export interface Tower {
  slot: number;
  x: number;
  def: TowerDef;
  cooldown: number;
  /** 最後に狙った敵の x(大砲の向き用)。 */
  aimX: number;
}

export interface PendingMeteor {
  x: number;
  timer: number;
}

export type WorldPhase = 'break' | 'wave' | 'victory' | 'defeat';

export type Command =
  | { type: 'spawn'; unit: UnitId }
  | { type: 'build'; slot: number; tower: TowerId }
  | { type: 'ability'; ability: AbilityId; x?: number }
  | { type: 'nextWave' }
  /** 木の実・花の蜜を摘む。 */
  | { type: 'harvest'; tree: number }
  /** 木を引き抜いてゴールドにする。 */
  | { type: 'uproot'; tree: number }
  // ここから下は検証用(デバッグパネル)。
  | { type: 'debugGold'; amount: number }
  | { type: 'debugMana'; amount: number }
  | { type: 'debugSpawnEnemy'; enemy: EnemyId }
  | { type: 'debugKillAll' }
  | { type: 'debugGod'; on: boolean }
  | { type: 'debugPlant'; unit: UnitId; x: number }
  | { type: 'debugJumpWave'; wave: number };

export type SimEvent =
  | { t: 'spawn'; id: number; side: Side }
  | { t: 'attackStart'; id: number }
  | { t: 'hit'; id: number; x: number; amount: number; crit: boolean; kind: AttackKind; magic: boolean }
  | { t: 'death'; id: number; side: Side; x: number; bounty: number }
  | { t: 'shoot'; projectileId: number }
  | { t: 'explode'; x: number; row: number; radius: number; kind: 'bomb' | 'cannon' | 'meteor' | 'slam' | 'charge' }
  | { t: 'castleHit'; amount: number; x: number }
  | { t: 'castleShot' }
  | { t: 'towerShot'; slot: number }
  | { t: 'towerBuilt'; slot: number }
  | { t: 'heal'; castleAmount: number }
  | { t: 'meteorCast'; x: number }
  | { t: 'summon'; id: number }
  | { t: 'knockback'; id: number }
  | { t: 'waveStart'; wave: number; boss: boolean }
  | { t: 'waveClear'; wave: number }
  | { t: 'earlyBonus'; gold: number }
  | { t: 'treeSeed'; id: number; tree: TreeId; x: number }
  | { t: 'treeGrow'; id: number; tree: TreeId; x: number }
  | { t: 'treeReinforce'; id: number; amount: number }
  | { t: 'treeHit'; id: number; amount: number }
  | { t: 'treeDie'; id: number; tree: TreeId; x: number; reason: 'destroyed' | 'withered' | 'replaced' | 'uprooted' | 'burst' }
  | { t: 'thornHit'; treeId: number; id: number; amount: number }
  | { t: 'treeShot'; treeId: number; projectileId: number }
  | { t: 'podBurst'; treeId: number; x: number; radius: number }
  | { t: 'harvest'; treeId: number; mana: number; gold: number }
  | { t: 'uproot'; treeId: number; gold: number }
  | { t: 'victory' }
  | { t: 'defeat' };

export interface Stats {
  kills: number;
  unitsDeployed: number;
  goldEarned: number;
  towersBuilt: number;
  treesGrown: number;
  harvests: number;
}
