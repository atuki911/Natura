import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/lib/data.mjs';

const require = createRequire(import.meta.url);
const Engine = require('../app/engine.js');
const data = loadData();
const X = Engine.create(data);

test('日本でよく使われる価格帯に丸める', () => {
  assert.equal(Engine.nicePriceJpy(1000), 980);
  assert.equal(Engine.nicePriceJpy(1500), 1480);
  assert.equal(Engine.nicePriceJpy(30000), 29800);
  assert.equal(Engine.nicePriceJpy(0), 0);
});

test('ドル価格を円に換算し、個人向けは割り引いて丸める', () => {
  const b2c = Engine.localizePrice(9.99, { rate: 150, model: 'B2C' });
  assert.equal(b2c.raw, 1499);
  assert.equal(b2c.jpy, 1280);
  const b2b = Engine.localizePrice(99, { rate: 150, model: 'B2B' });
  assert.equal(b2b.jpy, 14800);
});

test('売上の月換算', () => {
  assert.equal(Engine.monthlyUsd({ metric: 'ARR', usd: 1200000 }), 100000);
  assert.equal(Engine.monthlyUsd({ metric: 'MRR', usd: 5000 }), 5000);
  assert.equal(Engine.monthlyUsd({ metric: 'total', usd: 5000 }), null);
});

test('全事例の日本適合スコアが0〜100で、7軸すべてが1〜5', () => {
  for (const c of data.cases) {
    const fit = X.japanFit(c);
    assert.ok(fit.score >= 0 && fit.score <= 100, c.id);
    assert.equal(fit.axes.length, 7);
    for (const a of fit.axes) assert.ok(a.value >= 1 && a.value <= 5, `${c.id}.${a.key}`);
    assert.match(fit.grade, /^[SABC]$/);
  }
});

test('重みを変えるとスコアが変わる', () => {
  const c = X.caseById('photoai');
  const base = X.japanFit(c).score;
  const onlyEvidence = X.japanFit(c, { demand: 0, openness: 0, regulatoryLightness: 0, languageMoat: 0, wtp: 0, soloFeasibility: 0, evidence: 10 }).score;
  assert.notEqual(base, onlyEvidence);
  assert.equal(onlyEvidence, 100);
});

test('相性：ノーコード実績のある事例は非エンジニアに有利', () => {
  const profile = { tech: 'none', model: 'any', interests: [], strengths: [] };
  const easy = X.profileMatch(X.caseById('formulabot'), profile).score;
  const hard = X.profileMatch(X.caseById('base44'), profile).score;
  assert.ok(easy > hard, `${easy} > ${hard}`);
  assert.ok(X.profileMatch(X.caseById('formulabot'), profile).reasons.length > 0);
});

test('相性：関心分野・規制リスクが反映される', () => {
  const c = X.caseById('calai');
  const a = X.profileMatch(c, { interests: ['health-nutrition'], risk: 'mid' }).score;
  const b = X.profileMatch(c, { interests: [], risk: 'low' }).score;
  assert.ok(a > b);
});

test('rank はプロフィール込みの総合点で降順', () => {
  const r = X.rank(null, { profile: { tech: 'dev', interests: ['support-chatbot'] } });
  assert.equal(r.length, data.cases.length);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].total >= r[i].total);
});

test('事例ごとの規制には特商法と開業届が必ず含まれ、重要度順', () => {
  for (const c of data.cases) {
    const regs = X.regulationsForCase(c);
    const ids = regs.map((r) => r.id);
    assert.ok(ids.includes('tokushoho'), c.id);
    assert.ok(ids.includes('kaigyo'), c.id);
    for (let i = 1; i < regs.length; i++) assert.ok(regs[i - 1].severity >= regs[i].severity);
  }
  const legal = X.regulationsForCase(X.caseById('calai')).map((r) => r.id);
  assert.ok(legal.includes('medical'));
});

test('法規制チェック：回答に応じて該当法令が増える', () => {
  const base = X.checkRegulations({}).map((r) => r.id);
  assert.ok(base.includes('kaigyo'));
  assert.ok(!base.includes('bengoshi72'));
  const legal = X.checkRegulations({ 'legal-advice': true }).map((r) => r.id);
  assert.ok(legal.includes('bengoshi72'));
});

test('収益シミュレーション：解約率0なら会員は単調増加、損益分岐と必要会員数を返す', () => {
  const r = X.simulate({ price: 1000, visitors: 1000, visitorGrowth: 0, signupRate: 0.1, paidRate: 0.1, churn: 0, aiCostPerUser: 100, feeRate: 0.036, fixedCost: 0, adBudget: 0, months: 12, targetProfit: 100000 });
  assert.equal(r.rows.length, 12);
  assert.equal(r.rows[0].active, 10);
  assert.equal(r.rows[11].active, 120);
  assert.equal(r.summary.breakEvenMonth, 1);
  assert.equal(r.summary.ltv, null);
  assert.equal(r.summary.customersForTarget, Math.ceil(100000 / (1000 * 0.964 - 100)));
});

test('収益シミュレーション：固定費が大きいと黒字化しない', () => {
  const r = X.simulate({ price: 500, visitors: 100, visitorGrowth: 0, signupRate: 0.01, paidRate: 0.01, churn: 0.1, fixedCost: 100000, months: 6 });
  assert.equal(r.summary.breakEvenMonth, null);
  assert.ok(r.rows[5].cumulative < 0);
});

test('日本版プランに主要セクションと出典が入る', () => {
  for (const c of data.cases) {
    const md = X.generatePlan(c, { rate: 150, today: '2026-10-07', profile: { tech: 'basic', interests: [c.category] } });
    for (const h of ['## 1. サマリー', '## 5. 価格設計', '## 6. 集客チャネル', '## 8. 最初の2週間でやる検証', '## 10. 収益シミュレーション', '## 11. 法規制チェックリスト', '## 14. あなたとの相性の内訳', '## 出典']) {
      assert.ok(md.includes(h), `${c.id}: ${h}`);
    }
    assert.ok(!md.includes('undefined'), `${c.id}: undefined が含まれる`);
    assert.ok(!md.includes('NaN'), `${c.id}: NaN が含まれる`);
    for (const s of c.sources) assert.ok(md.includes(s.url), `${c.id}: 出典URL`);
  }
});

test('深掘りプロンプトに事例名と出力指示が入る', () => {
  const p = X.deepDivePrompt(X.caseById('chatbase'), { profile: { tech: 'dev' } });
  assert.ok(p.includes('Chatbase'));
  assert.ok(p.includes('撤退基準'));
  assert.ok(p.includes('"tech":"dev"'));
});

test('Markdown→HTML：見出し・表・リスト・リンクを変換し、HTMLをエスケープする', () => {
  const html = Engine.mdToHtml('# 見出し\n\n| a | b |\n|---|---|\n| 1 | **2** |\n\n- [ ] やること\n- 項目\n\n1. 一\n2. 二\n\n[リンク](https://example.com) <script>alert(1)</script>');
  assert.ok(html.includes('<h1>見出し</h1>'));
  assert.ok(html.includes('<td><strong>2</strong></td>'));
  assert.ok(html.includes('class="check"'));
  assert.ok(html.includes('<ol><li>一</li><li>二</li></ol>'));
  assert.ok(html.includes('<a href="https://example.com" target="_blank" rel="noopener">リンク</a>'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('javascript: リンクはリンク化しない', () => {
  const html = Engine.mdToHtml('[x](javascript:alert(1))');
  assert.ok(!html.includes('href="javascript'));
});

test('集計：カテゴリ件数の合計が事例数と一致', () => {
  const ag = X.aggregate();
  assert.equal(ag.total, data.cases.length);
  assert.equal(ag.byCategory.reduce((s, x) => s + x.count, 0), data.cases.length);
  assert.ok(ag.solo > 0);
});

test('競合調査リンクはすべて https', () => {
  for (const c of data.cases) for (const l of X.competitorLinks(c)) assert.match(l.url, /^https:\/\//);
});

test('新着候補から仮の事例を作り、プランを生成できる', () => {
  const cand = {
    id: 'deadbeef', title: 'AI notes app hits $5k MRR', url: 'https://example.com/x', source: 'hackernews', author: 'a',
    summary: 'solo founder', publishedAt: '2026-10-01T00:00:00Z', firstSeen: '2026-10-02T00:00:00Z', category: 'voice-notes',
    signals: { ai: true, solo: true, funded: false, revenue: [{ usd: 5000, metric: 'MRR', text: '$5k MRR' }] }
  };
  const c = X.candidateToCase(cand);
  assert.equal(c.teamSize, 1);
  assert.equal(X.revenueSummary(c).bestMonthlyUsd, 5000);
  const md = X.generatePlan(c, { today: '2026-10-07' });
  assert.ok(md.includes('AI notes app'));
  assert.ok(!md.includes('undefined'));
});
