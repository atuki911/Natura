#!/usr/bin/env node
// Natura CLI: collect / build / validate / list / report / serve / new-case
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { createServer } from 'node:http';
import { ROOT, loadData, validate } from './lib/data.mjs';
import { build } from './build.mjs';
import { runCollect } from '../collector/index.mjs';

const require = createRequire(import.meta.url);
const Engine = require('../app/engine.js');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) args[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

const HELP = `Natura — 海外AI個人起業リサーチ CLI

使い方: node scripts/cli.mjs <コマンド> [オプション]

  collect [--only hackernews,reddit,rss] [--no-build]
        無料の公開ソースから新着候補を収集して data/candidates.json に統合
  build       データを検証して app/data.js と dist/*.html を生成
  validate    データの検証だけを行う
  list [--top 20] [--profile profile.json]
        事例を日本適合スコア順（プロフィール指定時は相性込み）に一覧表示
  report <事例ID> [--rate 150] [--profile profile.json] [--out path.md]
        日本版事業プラン（Markdown）を生成。既定の出力先は reports/
  serve [--port 8000]
        app/ をローカルサーバーで配信
  new-case <事例ID>
        新しい事例のひな形 data/cases/<事例ID>.json を作成
`;

function loadProfile(p) {
  if (!p) return null;
  return JSON.parse(readFileSync(resolve(p), 'utf8'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  switch (cmd) {
    case 'collect': {
      console.log('新着候補を収集します（APIキー不要・無料の公開ソースのみ）');
      const stats = await runCollect({ root: ROOT, only: args.only ? String(args.only).split(',') : null });
      console.log(`取得 ${stats.fetched} 件 → 関連 ${stats.relevant} 件（新規 ${stats.added}／更新 ${stats.updated}）。候補の総数 ${stats.total} 件`);
      if (!args['no-build']) build();
      break;
    }
    case 'build':
      build();
      break;
    case 'validate': {
      const errors = validate(loadData());
      if (errors.length) { console.error(errors.map((e) => '✗ ' + e).join('\n')); process.exit(1); }
      console.log('✓ データに問題はありません');
      break;
    }
    case 'list': {
      const e = Engine.create(loadData());
      const ranked = e.rank(null, { profile: loadProfile(args.profile) });
      const top = Number(args.top) || ranked.length;
      console.log('順位  総合  適合  事例                          カテゴリ                 海外実績');
      ranked.slice(0, top).forEach((r, i) => {
        const cat = e.category(r.case);
        console.log(`${String(i + 1).padStart(3)}  ${String(r.total).padStart(4)}  ${r.fit.grade}${String(r.fit.score).padStart(4)}  ${r.case.name.padEnd(28).slice(0, 28)}  ${(cat ? cat.name : '').padEnd(20).slice(0, 20)}  ${e.revenueSummary(r.case).label}`);
      });
      break;
    }
    case 'report': {
      const id = args._[1];
      const data = loadData();
      const e = Engine.create(data);
      const c = e.caseById(id);
      if (!c) {
        console.error(`事例「${id || ''}」が見つかりません。利用できるID:\n` + data.cases.map((x) => '  ' + x.id).join('\n'));
        process.exit(1);
      }
      const md = e.generatePlan(c, { rate: Number(args.rate) || 150, profile: loadProfile(args.profile) });
      const out = args.out || join(ROOT, 'reports', `${id}-${new Date().toISOString().slice(0, 10)}.md`);
      mkdirSync(join(out, '..'), { recursive: true });
      writeFileSync(out, md + '\n');
      console.log(`日本版事業プランを書き出しました: ${out}`);
      break;
    }
    case 'serve': {
      const port = Number(args.port) || 8000;
      const appDir = join(ROOT, 'app');
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
      createServer((req, res) => {
        const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = normalize(join(appDir, path === '/' ? 'index.html' : path));
        if (!file.startsWith(appDir) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
        res.end(readFileSync(file));
      }).listen(port, () => console.log(`http://localhost:${port} で配信中（Ctrl+C で終了）`));
      break;
    }
    case 'new-case': {
      const id = args._[1];
      if (!/^[a-z0-9-]+$/.test(id || '')) { console.error('事例IDは英小文字・数字・ハイフンで指定してください（例: my-case）'); process.exit(1); }
      const path = join(ROOT, 'data', 'cases', `${id}.json`);
      if (existsSync(path)) { console.error(`既に存在します: ${path}`); process.exit(1); }
      const today = new Date().toISOString().slice(0, 10);
      const tpl = {
        id, name: '', url: '', tagline: '',
        founders: [{ name: '', country: '' }], basedIn: '',
        teamSize: 1, teamNote: '', launched: today.slice(0, 7), status: 'active',
        category: 'ai-agency', secondaryCategories: [], model: 'B2C',
        problem: '', solution: '', target: '',
        pricing: { type: 'subscription', plans: [], note: '' },
        revenue: [{ date: today.slice(0, 7), metric: 'MRR', usd: 0, sourceId: 's1', confidence: 'medium', note: '' }],
        traction: [], funding: 'bootstrapped',
        buildComplexity: 3, nocodePossible: false, initialCost: 2, aiDependency: 'high',
        techStack: [], channels: [], growthTactics: [], lessons: [], risks: [],
        japan: { localAngle: '', notes: [], scoreAdjust: {} },
        sources: [{ id: 's1', title: '', url: 'https://', kind: 'founder', accessed: today }],
        tags: []
      };
      writeFileSync(path, JSON.stringify(tpl, null, 2) + '\n');
      console.log(`ひな形を作成しました: ${path}\n記入後に npm run validate → npm run build を実行してください。`);
      break;
    }
    default:
      console.log(HELP);
      if (cmd && cmd !== 'help') process.exit(1);
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
