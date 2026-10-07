// app/data.js と、配布用の単一HTML（dist/）を生成する
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadData, validate } from './lib/data.mjs';

export function buildDataJs(data) {
  // </script> を含む文字列でスクリプトが閉じないようにエスケープ
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `/* 自動生成ファイル: npm run build で再生成されます。直接編集しないでください。 */\nwindow.NATURA_DATA = ${json};\n`;
}

function inlineAssets(html, appDir, dataJs) {
  const read = (f) => readFileSync(join(appDir, f), 'utf8');
  return html
    .replace(/<link rel="stylesheet" href="styles\.css">/, () => `<style>\n${read('styles.css')}\n</style>`)
    .replace(/<script src="engine\.js"><\/script>/, () => `<script>\n${read('engine.js')}\n</script>`)
    .replace(/<script src="data\.js"><\/script>/, () => `<script>\n${dataJs}\n</script>`)
    .replace(/<script src="app\.js"><\/script>/, () => `<script>\n${read('app.js')}\n</script>`);
}

// Artifact公開用：doctype/html/head/body を外し、<title> と <style> を先頭に置いた断片にする
export function toFragment(fullHtml) {
  const head = (fullHtml.match(/<head>([\s\S]*?)<\/head>/i) || [, ''])[1]
    .replace(/<meta[^>]*>\s*/gi, '');
  const body = (fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [, ''])[1];
  return `${head.trim()}\n${body.trim()}\n`;
}

export function build({ root = ROOT, log = console.log } = {}) {
  const data = loadData(root);
  const errors = validate(data);
  if (errors.length) {
    const e = new Error('データ検証エラー:\n' + errors.map((x) => '  - ' + x).join('\n'));
    e.errors = errors;
    throw e;
  }
  const appDir = join(root, 'app');
  const dataJs = buildDataJs(data);
  writeFileSync(join(appDir, 'data.js'), dataJs);
  const html = readFileSync(join(appDir, 'index.html'), 'utf8');
  const single = inlineAssets(html, appDir, dataJs);
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist', 'natura.html'), single);
  writeFileSync(join(root, 'dist', 'natura-artifact.html'), toFragment(single));
  log(`事例 ${data.cases.length} 件／カテゴリ ${data.categories.length}／規制 ${data.regulations.length}／新着候補 ${data.candidates.items.length} 件`);
  log('生成: app/data.js, dist/natura.html, dist/natura-artifact.html');
  return data;
}
