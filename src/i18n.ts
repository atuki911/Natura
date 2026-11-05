// 画面の文言。英語と日本語。ブラウザの言語で選び、タイトル画面で切り替えられる。

const en = {
  subtitle: 'Defend the Green Realm',
  play: 'PLAY',
  stage1: 'Stage 1 — The Green Border',
  gold: 'Gold',
  mana: 'Mana',
  manaShort: 'M',
  wave: 'Wave',
  nextWave: 'NEXT WAVE',
  inProgress: 'Wave in progress',
  callEarly: 'Call early',
  abilities: 'Abilities',
  castle: 'CASTLE',
  grove: 'Grove',
  paused: 'PAUSED',
  resume: 'RESUME',
  restart: 'RESTART',
  title: 'TITLE',
  victory: 'VICTORY!',
  defeat: 'DEFEAT',
  retry: 'RETRY',
  nextStage: 'NEXT',
  map: 'MAP',
  finale: 'THE REALM IS SAVED!',
  locked: 'Locked',
  back: 'BACK',
  selectStage: 'Choose a battle',
  kills: 'Enemies defeated',
  deployed: 'Units deployed',
  reached: 'Reached wave',
  waveBanner: 'WAVE',
  bossBanner: 'BOSS INCOMING!',
  waveClear: 'WAVE CLEAR',
  bonus: 'Early bonus',
  needGold: 'Not enough gold',
  needMana: 'Not enough mana',
  tooMany: 'Too many units',
  build: 'Build',
  pickTarget: 'Click the battlefield to drop the meteor',
  bestStars: 'Best',
  units: {
    sword: 'Swordsman',
    archer: 'Archer',
    mage: 'Mage',
    bomber: 'Bomber',
  },
  unitInfo: {
    sword: 'Melee. Falls → thorn bush',
    archer: 'Hits air. Falls → watch tree',
    mage: 'Magic splash. Falls → mana flower',
    bomber: 'Explodes. Falls → seed pod',
  },
  towers: {
    arrowTower: 'Arrow Tower',
    cannonTower: 'Cannon',
  },
  towerInfo: {
    arrowTower: 'Hits air and ground',
    cannonTower: 'Ground splash',
  },
  abilityNames: {
    heal: 'Heal',
    meteor: 'Meteor',
  },
  enemies: {
    mireMaw: 'THE MIRE MAW',
    sporeMother: 'THE SPORE MOTHER',
    blightHeart: 'HEART OF THE BLIGHT',
  },
  tut: {
    spawn: 'Tap a card to send a soldier',
    fight: 'Soldiers march right and fight. Protect the castle!',
    tree: 'Fallen soldiers become trees that keep fighting!',
    harvest: 'Brush over a ripe tree to harvest it',
    nextWave: 'Call the next wave early for bonus gold',
  },
};

type Dict = typeof en;

const ja: Dict = {
  subtitle: '緑の王国を守れ',
  play: 'あそぶ',
  stage1: 'ステージ1 — 緑の境',
  gold: 'ゴールド',
  mana: 'マナ',
  manaShort: 'マナ',
  wave: 'ウェーブ',
  nextWave: '次のウェーブ',
  inProgress: '戦闘中',
  callEarly: '早めに呼ぶ',
  abilities: '特殊能力',
  castle: '城',
  grove: '森',
  paused: '一時停止',
  resume: 'つづける',
  restart: 'やりなおす',
  title: 'タイトル',
  victory: '勝利！',
  defeat: '敗北',
  retry: 'もう一度',
  nextStage: '次へ',
  map: '地図',
  finale: '王国は救われた！',
  locked: 'まだ行けない',
  back: 'もどる',
  selectStage: '戦う場所を選ぶ',
  kills: '倒した敵',
  deployed: '出したユニット',
  reached: '到達ウェーブ',
  waveBanner: 'ウェーブ',
  bossBanner: 'ボス出現！',
  waveClear: 'ウェーブ突破',
  bonus: '早呼びボーナス',
  needGold: 'ゴールドが足りない',
  needMana: 'マナが足りない',
  tooMany: 'これ以上出せない',
  build: '建てる',
  pickTarget: '隕石を落とす場所をタップ',
  bestStars: 'ベスト',
  units: {
    sword: '剣士',
    archer: '弓兵',
    mage: '魔法使い',
    bomber: '爆弾兵',
  },
  unitInfo: {
    sword: '近接。倒れると茨になる',
    archer: '空も撃つ。倒れると見張りの木',
    mage: '範囲魔法。倒れると魔法の花',
    bomber: '自爆。倒れると種の莢',
  },
  towers: {
    arrowTower: '弓の塔',
    cannonTower: '大砲',
  },
  towerInfo: {
    arrowTower: '空にも地上にも届く',
    cannonTower: '地上に範囲攻撃',
  },
  abilityNames: {
    heal: '回復',
    meteor: '隕石',
  },
  enemies: {
    mireMaw: '泥沼の大口',
    sporeMother: '胞子の母',
    blightHeart: '穢れの心臓',
  },
  tut: {
    spawn: 'カードを押して兵を出そう',
    fight: '兵は右へ進んで戦う。城を守りきれば勝ち!',
    tree: '倒れた兵は木になって、戦い続ける!',
    harvest: '実った木をなでると収穫できる',
    nextWave: '次のウェーブを早く呼ぶとボーナス',
  },
};

export type Lang = 'en' | 'ja';

let current: Lang = typeof navigator !== 'undefined' && navigator.language?.startsWith('ja') ? 'ja' : 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function t(): Dict {
  return current === 'ja' ? ja : en;
}
