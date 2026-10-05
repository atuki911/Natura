'use strict';

/*
 * テーマ = 見た目・キャラ・効果音の味付け。
 * どのジャンルとも組み合わせられる。追加するときは同じ形のオブジェクトを足すだけ。
 *
 *   player   主人公の絵文字
 *   hazards  避けるもの / 敵
 *   goodies  集めるもの / 味方
 *   deco     背景に漂う飾り
 *   palette  ブロックなどに使う色（4色以上）
 *   words    タイトル用の単語 [日本語, 英語(slug用)]
 */
const THEMES = {
  space: {
    label: 'うちゅう',
    words: [['ギャラクシー', 'galaxy'], ['コズミック', 'cosmic'], ['スター', 'star']],
    player: '🚀',
    hazards: ['☄️', '🛸', '👾'],
    goodies: ['⭐', '💎', '🪐'],
    deco: '✨',
    bg1: '#0b1026',
    bg2: '#2a1b5e',
    ground: '#3b2f7a',
    accent: '#ffd166',
    palette: ['#ff6b9d', '#c77dff', '#4cc9f0', '#ffd166', '#80ffdb'],
    sound: { pitch: 1.2, wave: 'square' },
  },
  ocean: {
    label: 'うみ',
    words: [['オーシャン', 'ocean'], ['マリン', 'marine'], ['ディープ', 'deep']],
    player: '🐠',
    hazards: ['🦈', '🪼', '🦀'],
    goodies: ['🐚', '🦐', '💎'],
    deco: '🫧',
    bg1: '#48cae4',
    bg2: '#03045e',
    ground: '#e9c46a',
    accent: '#ffe66d',
    palette: ['#00b4d8', '#90e0ef', '#f4a261', '#e76f51', '#2a9d8f'],
    sound: { pitch: 0.9, wave: 'sine' },
  },
  forest: {
    label: 'もり',
    words: [['フォレスト', 'forest'], ['もりもり', 'morimori'], ['グリーン', 'green']],
    player: '🐿️',
    hazards: ['🐝', '🍄', '🦔'],
    goodies: ['🌰', '🍎', '🍓'],
    deco: '🍃',
    bg1: '#b7e4c7',
    bg2: '#2d6a4f',
    ground: '#6b4226',
    accent: '#ffb703',
    palette: ['#95d5b2', '#52b788', '#d4a373', '#e9edc9', '#ffb703'],
    sound: { pitch: 1, wave: 'triangle' },
  },
  candy: {
    label: 'おかし',
    words: [['キャンディ', 'candy'], ['スイーツ', 'sweets'], ['シュガー', 'sugar']],
    player: '🧁',
    hazards: ['🌶️', '🧅', '🥦'],
    goodies: ['🍬', '🍭', '🍩'],
    deco: '💖',
    bg1: '#ffc8dd',
    bg2: '#a06cd5',
    ground: '#ff8fab',
    accent: '#fff3b0',
    palette: ['#ffafcc', '#bde0fe', '#cdb4db', '#fff3b0', '#a2d2ff'],
    sound: { pitch: 1.4, wave: 'sine' },
  },
  city: {
    label: 'まち',
    words: [['シティ', 'city'], ['ネオン', 'neon'], ['メトロ', 'metro']],
    player: '🛹',
    hazards: ['🚧', '🚨', '🛢️'],
    goodies: ['💰', '🪙', '🎁'],
    deco: '☁️',
    bg1: '#8ecae6',
    bg2: '#023047',
    ground: '#495057',
    accent: '#fb8500',
    palette: ['#fb8500', '#ffb703', '#219ebc', '#8ecae6', '#adb5bd'],
    sound: { pitch: 1.1, wave: 'square' },
  },
  ninja: {
    label: 'にんじゃ',
    words: [['ニンジャ', 'ninja'], ['サクラ', 'sakura'], ['カゲ', 'kage']],
    player: '🥷',
    hazards: ['🔥', '💣', '👹'],
    goodies: ['📜', '🍙', '🏮'],
    deco: '🌸',
    bg1: '#ffb4a2',
    bg2: '#5f0f40',
    ground: '#3d2c2e',
    accent: '#ffd60a',
    palette: ['#e5989b', '#b5838d', '#ffcdb2', '#6d6875', '#ffd60a'],
    sound: { pitch: 0.8, wave: 'triangle' },
  },
  dino: {
    label: 'きょうりゅう',
    words: [['ダイノ', 'dino'], ['ジュラ', 'jura'], ['ガオガオ', 'gaogao']],
    player: '🦖',
    hazards: ['🌋', '🪨', '☄️'],
    goodies: ['🥚', '🍖', '🦴'],
    deco: '🌿',
    bg1: '#ffe8a3',
    bg2: '#e76f51',
    ground: '#8d5524',
    accent: '#fffffc',
    palette: ['#f4a261', '#e9c46a', '#2a9d8f', '#8d5524', '#e76f51'],
    sound: { pitch: 0.7, wave: 'sawtooth' },
  },
  winter: {
    label: 'ふゆ',
    words: [['フロスト', 'frost'], ['ペンギン', 'penguin'], ['スノー', 'snow']],
    player: '🐧',
    hazards: ['🧊', '⛄', '🌨️'],
    goodies: ['🐟', '🎁', '⭐'],
    deco: '❄️',
    bg1: '#e0fbfc',
    bg2: '#3d5a80',
    ground: '#f8f9fa',
    accent: '#ee6c4d',
    palette: ['#98c1d9', '#e0fbfc', '#ee6c4d', '#3d5a80', '#caf0f8'],
    sound: { pitch: 1.3, wave: 'sine' },
  },
};

// 全テーマ共通の UI 配色（タイトル/リザルト画面のパネル）
const UI = { fg: '#ffffff', ink: '#22223b', inkSoft: '#6c6f7d', panel: 'rgba(255,255,255,0.94)' };

for (const [id, t] of Object.entries(THEMES)) {
  t.id = id;
  for (const [k, v] of Object.entries(UI)) if (t[k] == null) t[k] = v;
}

module.exports = { THEMES };
