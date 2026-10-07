// データの読み込み・検証（Node専用）
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'data');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function loadData(root = ROOT) {
  const dir = join(root, 'data');
  const casesDir = join(dir, 'cases');
  const cases = readdirSync(casesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, ...readJson(join(casesDir, f)) }))
    .map(({ file, ...c }) => c);
  const categories = readJson(join(dir, 'japan', 'categories.json'));
  const regulations = readJson(join(dir, 'japan', 'regulations.json'));
  const channels = readJson(join(dir, 'japan', 'channels.json'));
  const candPath = join(dir, 'candidates.json');
  const candidates = existsSync(candPath) ? readJson(candPath) : { updated: null, items: [] };
  return {
    meta: {
      knowledgeUpdated: categories.updated,
      disclaimer: regulations.disclaimer
    },
    cases,
    categories: categories.items,
    regulations: regulations.items,
    channels: channels.items,
    candidates
  };
}

const MODELS = ['B2C', 'B2B', 'B2B2C', 'Prosumer'];
const STATUSES = ['active', 'acquired', 'declined', 'closed'];
const PRICING = ['subscription', 'one-time', 'credits', 'freemium', 'ads', 'license'];
const METRICS = ['MRR', 'ARR', 'monthly', 'annual', 'total'];
const CONF = ['high', 'medium', 'low'];
const AXES = ['demand', 'openness', 'regulatoryLightness', 'languageMoat', 'wtp', 'soloFeasibility', 'evidence'];

export function validate(data) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const catIds = new Set(data.categories.map((c) => c.id));
  const regIds = new Set(data.regulations.map((r) => r.id));
  const chIds = new Set(data.channels.map((c) => c.id));

  for (const cat of data.categories) {
    const w = `category ${cat.id}`;
    for (const k of ['demand', 'openness', 'regulatoryLightness', 'languageMoat', 'wtp', 'soloFeasibility']) {
      const v = cat.scores?.[k];
      if (!(Number.isInteger(v) && v >= 1 && v <= 5)) err(w, `scores.${k} は1〜5の整数`);
    }
    for (const r of cat.regulations || []) if (!regIds.has(r)) err(w, `未知の規制ID ${r}`);
    for (const ch of cat.channels || []) if (!chIds.has(ch)) err(w, `未知のチャネルID ${ch}`);
    if (!(cat.keywordsEn || []).length) err(w, 'keywordsEn が空');
  }

  const ids = new Set();
  for (const c of data.cases) {
    const w = `case ${c.id}`;
    if (!/^[a-z0-9-]+$/.test(c.id || '')) err(w, 'id は英小文字・数字・ハイフン');
    if (ids.has(c.id)) err(w, 'id が重複');
    ids.add(c.id);
    for (const k of ['name', 'tagline', 'problem', 'solution', 'target']) if (!c[k]) err(w, `${k} が空`);
    if (!catIds.has(c.category)) err(w, `未知のカテゴリ ${c.category}`);
    for (const s of c.secondaryCategories || []) if (!catIds.has(s)) err(w, `未知の副カテゴリ ${s}`);
    if (!MODELS.includes(c.model)) err(w, `model は ${MODELS.join('/')}`);
    if (!STATUSES.includes(c.status)) err(w, `status は ${STATUSES.join('/')}`);
    if (!PRICING.includes(c.pricing?.type)) err(w, `pricing.type は ${PRICING.join('/')}`);
    if (!(Number.isInteger(c.teamSize) && c.teamSize >= 1)) err(w, 'teamSize は1以上の整数');
    for (const k of ['buildComplexity', 'initialCost']) if (!(Number.isInteger(c[k]) && c[k] >= 1 && c[k] <= 5)) err(w, `${k} は1〜5の整数`);
    if (!['high', 'medium', 'low'].includes(c.aiDependency)) err(w, 'aiDependency は high/medium/low');
    for (const ch of c.channels || []) if (!chIds.has(ch)) err(w, `未知のチャネルID ${ch}`);
    const srcIds = new Set((c.sources || []).map((s) => s.id));
    if (!srcIds.size) err(w, '出典(sources)が必要');
    for (const s of c.sources || []) {
      if (!/^https?:\/\//.test(s.url || '')) err(w, `出典URLが不正 ${s.id}`);
      if (!s.title) err(w, `出典タイトルが空 ${s.id}`);
    }
    for (const r of c.revenue || []) {
      if (!METRICS.includes(r.metric)) err(w, `revenue.metric は ${METRICS.join('/')}`);
      if (typeof r.usd !== 'number' || r.usd < 0) err(w, 'revenue.usd は0以上の数値');
      if (!CONF.includes(r.confidence)) err(w, 'revenue.confidence は high/medium/low');
      if (!srcIds.has(r.sourceId)) err(w, `revenue.sourceId ${r.sourceId} が sources にない`);
      if (!/^\d{4}(-\d{2})?$/.test(r.date || '')) err(w, 'revenue.date は YYYY または YYYY-MM');
    }
    for (const t of c.traction || []) if (t.sourceId && !srcIds.has(t.sourceId)) err(w, `traction.sourceId ${t.sourceId} が sources にない`);
    for (const k of Object.keys(c.japan?.scoreAdjust || {})) if (!AXES.includes(k)) err(w, `scoreAdjust の未知の軸 ${k}`);
  }
  return errors;
}
