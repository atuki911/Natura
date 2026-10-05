'use strict';

/*
 * 設計図（blueprint）まわり。
 *
 * spec      … 人が書く/CLI が作る、部分的な注文書。{ genre?, theme?, seed?, title?, params? ... }
 * blueprint … spec をシードから確定させた完全な設計図。games/<slug>.json に保存され、
 *             これさえあれば同じゲームを何度でも再ビルドできる。
 */
const { mulberry32 } = require('./engine/runtime');
const { GENRES } = require('./genres');
const { THEMES } = require('./themes');

const SUFFIXES = ['', '', '', '!', ' DX', ' 2', ' GO'];
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

function rng(seed) {
  const rand = mulberry32(seed);
  return {
    rand,
    range: (a, b) => a + (b - a) * rand(),
    int: (a, b) => Math.floor(a + (b - a + 1) * rand()),
    chance: (p) => rand() < p,
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

function tidy(params) {
  const out = {};
  for (const [k, v] of Object.entries(params)) out[k] = typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v;
  return out;
}

function resolveSpec(spec = {}) {
  const seed = spec.seed != null ? Number(spec.seed) >>> 0 : randomSeed();
  const r = rng(seed);
  const genreId = spec.genre || r.pick(Object.keys(GENRES));
  const themeId = spec.theme || r.pick(Object.keys(THEMES));
  const genre = GENRES[genreId];
  const theme = THEMES[themeId];
  if (!genre) throw new Error(`不明なジャンル: ${genreId}（使えるもの: ${Object.keys(GENRES).join(', ')}）`);
  if (!theme) throw new Error(`不明なテーマ: ${themeId}（使えるもの: ${Object.keys(THEMES).join(', ')}）`);

  const params = { ...tidy(genre.params(r)), ...(spec.params || {}) };
  const [tJa, tEn] = r.pick(theme.words);
  const [gJa, gEn] = r.pick(genre.words);
  const suffix = r.pick(SUFFIXES);
  const title = spec.title || `${tJa}・${gJa}${suffix}`;
  const slug = spec.slug || `${tEn}-${gEn}-${seed.toString(36)}`;
  if (!SLUG_RE.test(slug)) throw new Error(`slug は英小文字・数字・ハイフンのみ: ${slug}`);

  const blueprint = { slug, title, genre: genreId, theme: themeId, seed, params };
  if (spec.themeOverrides) blueprint.themeOverrides = spec.themeOverrides;
  return blueprint;
}

// blueprint → ブラウザに渡す実行時設定
function runtimeConfig(bp) {
  const genre = GENRES[bp.genre];
  const theme = { ...THEMES[bp.theme], ...(bp.themeOverrides || {}) };
  if (!genre || !THEMES[bp.theme]) throw new Error(`壊れた設計図です: ${bp.slug}`);
  return {
    id: bp.slug,
    title: bp.title,
    genre: bp.genre,
    genreLabel: genre.label,
    howto: genre.howto,
    seed: bp.seed,
    theme,
    sound: theme.sound,
    params: bp.params,
  };
}

// 量産用: ジャンル×テーマの組み合わせがなるべく重ならないように n 本ぶんの spec を作る
function planBatch(n, { seed = randomSeed(), genres, themes } = {}) {
  const r = rng(seed >>> 0);
  const gs = genres && genres.length ? genres : Object.keys(GENRES);
  const ts = themes && themes.length ? themes : Object.keys(THEMES);
  const combos = [];
  for (const g of gs) for (const t of ts) combos.push([g, t]);
  const specs = [];
  let deck = [];
  while (specs.length < n) {
    if (!deck.length) deck = r.shuffle(combos);
    const [genre, theme] = deck.pop();
    specs.push({ genre, theme, seed: (r.rand() * 4294967296) >>> 0 });
  }
  return specs;
}

module.exports = { resolveSpec, runtimeConfig, planBatch, randomSeed, rng };
