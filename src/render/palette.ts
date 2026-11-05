// 色の決まり。docs/style-bible.md と同じ値。

export const INK = '#1c1726';
export const INK_HEX = 0x1c1726;

export const COLORS = {
  ink: INK,
  skyTop: '#62bdf0',
  skyMid: '#a9e0fa',
  skyHorizon: '#e6f7ff',
  grass: '#86cf5a',
  grassDark: '#5aa845',
  grassLight: '#b4e77a',
  hill: '#77c257',
  hillDark: '#4f9a42',
  mountain: '#8fcf7a',
  mountainFar: '#a8d8cf',
  path: '#e6c38a',
  pathDark: '#c79c5f',
  pathLight: '#f4dcaa',
  water: '#5fb8ea',
  waterLight: '#bfe9ff',
  stone: '#a7a19a',
  stoneLight: '#cdc8c0',
  stoneDark: '#7a746e',
  roof: '#c8553d',
  roofDark: '#963b2b',
  wood: '#9a6a3c',
  woodDark: '#6e4626',
  ally: '#3f7fe0',
  allyLight: '#7fb2ff',
  gold: '#ffcc33',
  goldDark: '#d99a12',
  mana: '#5fd3ff',
  blight: '#8a4fc0',
  blightDark: '#5a2f86',
  blightLight: '#b98ae6',
  blightGlow: '#e07bff',
  blightGround: '#4a3160',
  darkStone: '#3d3548',
  darkStoneLight: '#5a5068',
  darkStoneDark: '#2a2433',
  hpGreen: '#57d65a',
  hpRed: '#e84a4a',
};

export const FONT = '"Lilita One", "Hiragino Maru Gothic ProN", "Yu Gothic UI", "Meiryo", sans-serif';

export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}
