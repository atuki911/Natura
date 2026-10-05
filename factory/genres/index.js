'use strict';

// ジャンルの登録簿。新ジャンルはファイルを足してここに 1 行追加する。
const GENRES = [
  require('./runner'),
  require('./flappy'),
  require('./catcher'),
  require('./dodger'),
  require('./tapper'),
  require('./stacker'),
];

module.exports = { GENRES: Object.fromEntries(GENRES.map((g) => [g.id, g])) };
