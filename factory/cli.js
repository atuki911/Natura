#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { GENRES } = require('./genres');
const { THEMES } = require('./themes');
const { resolveSpec, planBatch, randomSeed } = require('./spec');
const { buildGame, buildGallery, buildArcade, saveBlueprint, loadBlueprints } = require('./build');

const ROOT = path.resolve(__dirname, '..');

const HELP = `🏭 Natura Game Factory — スマホゲーム量産工場

使い方: node factory/cli.js <コマンド> [オプション]

  batch [-n 12]          ゲームをまとめて量産（ジャンル×テーマがなるべく被らない）
        [--genres a,b]   使うジャンルを絞る
        [--themes x,y]   使うテーマを絞る
        [--seed 42]      同じシードなら同じラインナップになる
  new                    1本だけ作る
        [--genre runner] [--theme space] [--seed 7] [--title "名前"]
  build <spec.json...>   注文書(JSON)からゲームを作る
  rebuild                games/ の設計図から全ゲームを作り直す（エンジン更新の反映に）
                         いつも dist/arcade.html（全ゲーム入りの1ファイル版）も作られる
  remove <slug...>       ゲームを廃番にする（設計図と出力を削除）
  list                   使えるジャンル・テーマと、生産済みゲームの一覧
  serve [--port 8080]    dist/ をローカル配信（同じ Wi-Fi のスマホから遊べる）
  clean                  dist/ を削除

共通オプション:
  --games <dir>   設計図の保存先（既定: games）
  --out <dir>     ビルド出力先（既定: dist）
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-n') args.n = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) args[key] = true;
      else args[key] = argv[++i];
    } else args._.push(a);
  }
  return args;
}

function list(v) {
  return typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
}

function int(v, name) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} には 0 以上の整数を指定してください: ${v}`);
  return n;
}

function produce(specs, ctx) {
  const total = specs.length;
  const made = [];
  specs.forEach((spec, i) => {
    const bp = resolveSpec(spec);
    saveBlueprint(bp, ctx.games);
    const { dir, bytes } = buildGame(bp, ctx.out);
    made.push(bp);
    const tag = `${GENRES[bp.genre].label} × ${THEMES[bp.theme].label}`;
    console.log(`  🎮 [${String(i + 1).padStart(String(total).length)}/${total}] ${bp.title}  (${tag})  → ${path.relative(ROOT, dir)}/  ${(bytes / 1024).toFixed(1)}KB`);
  });
  return made;
}

function finish(ctx) {
  const bps = loadBlueprints(ctx.games);
  const entries = buildGallery(bps, ctx.out);
  const arcade = buildArcade(bps, ctx.out);
  console.log(`\n🏬 ギャラリー更新: ${path.relative(ROOT, path.join(ctx.out, 'index.html'))}（全 ${entries.length} 本）`);
  console.log(`🕹️  1ファイル版: ${path.relative(ROOT, arcade.file)}（${(arcade.bytes / 1024).toFixed(0)}KB、ダブルクリックやスマホに送るだけで遊べる）`);
  console.log(`   遊ぶには: npm run serve`);
}

function checkIds(ids, table, kind) {
  for (const id of ids || []) if (!table[id]) throw new Error(`不明な${kind}: ${id}（使えるもの: ${Object.keys(table).join(', ')}）`);
}

const COMMANDS = {
  batch(args, ctx) {
    const n = int(args.n ?? args._[0] ?? 12, '-n');
    const genres = list(args.genres);
    const themes = list(args.themes);
    checkIds(genres, GENRES, 'ジャンル');
    checkIds(themes, THEMES, 'テーマ');
    const seed = int(args.seed, '--seed') ?? randomSeed();
    console.log(`🏭 量産ライン稼働: ${n} 本（seed ${seed}）\n`);
    produce(planBatch(n, { seed, genres, themes }), ctx);
    finish(ctx);
  },

  new(args, ctx) {
    const spec = { genre: args.genre, theme: args.theme, seed: int(args.seed, '--seed'), title: typeof args.title === 'string' ? args.title : undefined };
    checkIds(spec.genre && [spec.genre], GENRES, 'ジャンル');
    checkIds(spec.theme && [spec.theme], THEMES, 'テーマ');
    console.log('🏭 1 本生産します\n');
    produce([spec], ctx);
    finish(ctx);
  },

  build(args, ctx) {
    if (!args._.length) throw new Error('注文書の JSON ファイルを指定してください（例: specs/example.json）');
    const specs = [];
    for (const file of args._) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      specs.push(...(Array.isArray(data) ? data : [data]));
    }
    console.log(`🏭 注文書から ${specs.length} 本生産します\n`);
    produce(specs, ctx);
    finish(ctx);
  },

  rebuild(args, ctx) {
    const bps = loadBlueprints(ctx.games);
    console.log(`🔁 設計図 ${bps.length} 枚から再ビルドします\n`);
    produce(bps, ctx);
    finish(ctx);
  },

  remove(args, ctx) {
    if (!args._.length) throw new Error('廃番にする slug を指定してください');
    for (const slug of args._) {
      const file = path.join(ctx.games, `${slug}.json`);
      if (!fs.existsSync(file)) {
        console.log(`  ⚠️  見つかりません: ${slug}`);
        continue;
      }
      fs.rmSync(file);
      fs.rmSync(path.join(ctx.out, slug), { recursive: true, force: true });
      console.log(`  🗑️  廃番: ${slug}`);
    }
    finish(ctx);
  },

  list(args, ctx) {
    console.log('ジャンル:');
    for (const g of Object.values(GENRES)) console.log(`  ${g.id.padEnd(8)} ${g.label} — ${g.howto}`);
    console.log('\nテーマ:');
    for (const t of Object.values(THEMES)) console.log(`  ${t.id.padEnd(8)} ${t.player} ${t.label}`);
    const bps = loadBlueprints(ctx.games);
    console.log(`\n生産済み: ${bps.length} 本`);
    for (const bp of bps) console.log(`  ${bp.slug.padEnd(28)} ${bp.title}`);
  },

  serve(args, ctx) {
    require('./serve').serve(ctx.out, int(args.port, '--port') ?? 8080);
  },

  clean(args, ctx) {
    fs.rmSync(ctx.out, { recursive: true, force: true });
    console.log(`🧹 ${path.relative(ROOT, ctx.out)}/ を削除しました（設計図 games/ は残っています）`);
  },
};

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._.shift();
  if (!cmd || args.help || !COMMANDS[cmd]) {
    console.log(HELP);
    return cmd && !args.help && !COMMANDS[cmd] ? 1 : 0;
  }
  const ctx = {
    games: path.resolve(typeof args.games === 'string' ? args.games : path.join(ROOT, 'games')),
    out: path.resolve(typeof args.out === 'string' ? args.out : path.join(ROOT, 'dist')),
  };
  try {
    COMMANDS[cmd](args, ctx);
    return 0;
  } catch (e) {
    console.error(`❌ ${e.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { main, parseArgs };
