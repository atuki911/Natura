'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GENRES } = require('./genres');
const { THEMES } = require('./themes');
const { runtimeConfig } = require('./spec');
const { gameHtml, manifest, iconSvg, serviceWorker } = require('./templates/game');
const { galleryHtml } = require('./templates/gallery');
const { arcadeHtml } = require('./templates/arcade');

const RUNTIME = fs.readFileSync(path.join(__dirname, 'engine', 'runtime.js'), 'utf8');

function gameSource(genreId) {
  return GENRES[genreId].game.toString();
}

// 設計図 1 枚 → dist/<slug>/ に遊べるゲーム一式（HTML / PWA マニフェスト / アイコン / Service Worker）
function buildGame(bp, distDir) {
  const cfg = runtimeConfig(bp);
  const html = gameHtml({ cfg, runtime: RUNTIME, gameSource: gameSource(bp.genre) });
  const hash = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
  const dir = path.join(distDir, bp.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), manifest(cfg));
  fs.writeFileSync(path.join(dir, 'icon.svg'), iconSvg(cfg));
  fs.writeFileSync(path.join(dir, 'sw.js'), serviceWorker(`natura-${bp.slug}:${hash}`));
  return { dir, bytes: Buffer.byteLength(html) };
}

function catalogEntry(bp) {
  const theme = { ...THEMES[bp.theme], ...(bp.themeOverrides || {}) };
  return {
    slug: bp.slug,
    title: bp.title,
    genre: bp.genre,
    genreLabel: GENRES[bp.genre].label,
    theme: bp.theme,
    themeLabel: theme.label,
    player: theme.player,
    bg1: theme.bg1,
    bg2: theme.bg2,
  };
}

function buildGallery(blueprints, distDir) {
  const entries = blueprints.map(catalogEntry);
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'index.html'), galleryHtml(entries, Object.values(GENRES)));
  fs.writeFileSync(path.join(distDir, 'catalog.json'), JSON.stringify(entries, null, 2));
  return entries;
}

// 全ゲーム入りの 1 ファイル版（dist/arcade.html）。サーバー不要・非公開のまま遊べる
function arcadeSource(blueprints, { fragment = false } = {}) {
  const used = [...new Set(blueprints.map((bp) => bp.genre))];
  return arcadeHtml({
    runtime: RUNTIME,
    genres: Object.fromEntries(used.map((id) => [id, gameSource(id)])),
    games: blueprints.map(runtimeConfig),
    fragment,
  });
}

function buildArcade(blueprints, distDir) {
  fs.mkdirSync(distDir, { recursive: true });
  const file = path.join(distDir, 'arcade.html');
  const html = arcadeSource(blueprints);
  fs.writeFileSync(file, html);
  return { file, bytes: Buffer.byteLength(html) };
}

function saveBlueprint(bp, gamesDir) {
  fs.mkdirSync(gamesDir, { recursive: true });
  const file = path.join(gamesDir, `${bp.slug}.json`);
  fs.writeFileSync(file, JSON.stringify(bp, null, 2) + '\n');
  return file;
}

function loadBlueprints(gamesDir) {
  if (!fs.existsSync(gamesDir)) return [];
  return fs
    .readdirSync(gamesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(gamesDir, f), 'utf8')));
}

module.exports = { buildGame, buildGallery, buildArcade, arcadeSource, saveBlueprint, loadBlueprints, gameSource };
