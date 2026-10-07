import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, validate } from '../scripts/lib/data.mjs';
import { buildDataJs, toFragment } from '../scripts/build.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('同梱データに検証エラーがない', () => {
  assert.deepEqual(validate(loadData()), []);
});

test('検証は壊れたデータを検出する', () => {
  const d = loadData();
  const bad = structuredClone(d);
  bad.cases[0].category = 'no-such-category';
  bad.cases[1].revenue = [{ date: '2026-01', metric: 'weekly', usd: -1, sourceId: 'zz', confidence: 'maybe' }];
  bad.cases[2].sources = [];
  const errors = validate(bad);
  assert.ok(errors.some((e) => e.includes('未知のカテゴリ')));
  assert.ok(errors.some((e) => e.includes('revenue.metric')));
  assert.ok(errors.some((e) => e.includes('revenue.confidence')));
  assert.ok(errors.some((e) => e.includes('出典(sources)が必要')));
});

test('全カテゴリが知識ベースで参照される規制・チャネルを持つ', () => {
  const d = loadData();
  for (const c of d.categories) {
    assert.ok(c.regulations.length > 0, c.id);
    assert.ok(c.channels.length > 0, c.id);
    assert.ok(c.localizationAngles.length > 0, c.id);
    assert.ok(c.validation.length > 0, c.id);
  }
});

test('data.js は </script> を含んでもスクリプトを閉じない', () => {
  const js = buildDataJs({ x: '</script><script>alert(1)</script>' });
  assert.ok(!js.includes('</script>'));
  assert.ok(js.startsWith('/*'));
});

test('Artifact用の断片は doctype/head/body を含まず title が先頭', () => {
  const html = readFileSync(join(here, '..', 'app', 'index.html'), 'utf8');
  const frag = toFragment(html);
  assert.ok(!/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]|<meta[\s>]/i.test(frag));
  assert.ok(frag.trimStart().startsWith('<title>'));
  assert.ok(frag.includes('id="view"'));
});
