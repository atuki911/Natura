// 本文から売上・AI・ソロ創業などのシグナルを抽出し、候補をスコアリングする

const MULT = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

function toNumber(num, unit) {
  const n = parseFloat(String(num).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const u = (unit || '').toLowerCase();
  return n * (MULT[u] || 1);
}

function metricOf(label) {
  const l = label.toLowerCase().replace(/\s+/g, ' ');
  if (l.includes('mrr')) return 'MRR';
  if (l.includes('arr')) return 'ARR';
  if (/(\/ ?mo|per month|a month|monthly|\/ ?month)/.test(l)) return 'monthly';
  if (/(\/ ?yr|\/ ?year|per year|a year|annual|yearly)/.test(l)) return 'annual';
  return 'total';
}

const REVENUE_RES = [
  // $12k MRR, $1.2M ARR, $5,000/month, $300K a month, $40k in revenue
  /\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m|mm|b|thousand|million|billion)?\b\s*(mrr|arr|\/\s?mo(?:nth)?\b|per month|a month|monthly|\/\s?(?:yr|year)\b|per year|a year|annual(?:ly)?|yearly|in (?:annual )?revenue|revenue|in sales|in profit)/gi,
  // 12k MRR / 1.5M ARR（$なし）
  /\b(\d[\d,]*(?:\.\d+)?)\s?(k|m)\s?(mrr|arr)\b/gi,
  // MRR of $12k / ARR: $1M
  /\b(mrr|arr)\s*(?:of|:|is|at|to|hit|reached|crossed)?\s*\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m|million|thousand)?\b/gi
];

export function extractRevenue(text) {
  const t = String(text || '');
  const out = [];
  const seen = new Set();
  REVENUE_RES.forEach((re, idx) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t))) {
      let usd, metric;
      if (idx === 2) { usd = toNumber(m[2], m[3]); metric = m[1].toUpperCase(); }
      else { usd = toNumber(m[1], m[2]); metric = metricOf(m[3]); }
      if (usd == null || usd < 100 || usd > 5e9) continue;
      const key = `${metric}:${Math.round(usd)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ usd: Math.round(usd), metric, text: m[0].trim() });
    }
  });
  return out;
}

export function monthlyEquivalent(r) {
  if (r.metric === 'MRR' || r.metric === 'monthly') return r.usd;
  if (r.metric === 'ARR' || r.metric === 'annual') return r.usd / 12;
  return null;
}

const AI_RE = /\b(ai|a\.i\.|gpt(?:-?\d)?|llms?|chatgpt|claude|openai|anthropic|gemini|machine learning|stable diffusion|midjourney|whisper|genai|generative|agents?|copilot|flux|elevenlabs)\b/i;
const SOLO_RE = /\b(solo|solopreneur|indie ?hacker|one[- ]person|one[- ]man|by myself|on my own|alone|single founder|side project|bootstrapp(?:ed|ing)|i built|i made|i launched|my (?:saas|app|startup))\b/i;
const NEGATIVE_RE = /\b(raises? \$|series [abc]|seed round|funding round|hiring|job opening|layoffs?|ipo)\b/i;

export const detectAI = (t) => AI_RE.test(String(t || ''));
export const detectSolo = (t) => SOLO_RE.test(String(t || ''));
export const detectFunded = (t) => NEGATIVE_RE.test(String(t || ''));

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function classify(text, categories) {
  const t = ` ${String(text || '').toLowerCase()} `;
  let best = null;
  let bestScore = 0;
  for (const cat of categories || []) {
    let s = 0;
    for (const kw of cat.keywordsEn || []) {
      // 複数形（-s / -es）も一致させる
      const re = new RegExp(`(^|[^a-z])${escapeRe(kw.toLowerCase())}(?:e?s)?([^a-z]|$)`, 'g');
      const n = (t.match(re) || []).length;
      if (n) s += n * (kw.includes(' ') ? 2 : 1);
    }
    if (s > bestScore) { bestScore = s; best = cat.id; }
  }
  return best;
}

export function signalsFor(item) {
  const text = `${item.title || ''} \n ${item.text || ''}`;
  const revenue = extractRevenue(text);
  return {
    ai: detectAI(text),
    solo: detectSolo(text),
    funded: detectFunded(text),
    revenue
  };
}

export function scoreCandidate(item, signals, now = new Date()) {
  let s = 0;
  if (signals.ai) s += 25;
  if (signals.solo) s += 15;
  if (signals.funded) s -= 15;
  const monthly = Math.max(0, ...signals.revenue.map(monthlyEquivalent).filter((v) => v != null));
  const anyRevenue = signals.revenue.length > 0;
  if (monthly >= 100000) s += 30;
  else if (monthly >= 10000) s += 25;
  else if (monthly >= 1000) s += 18;
  else if (anyRevenue) s += 10;
  const engagement = (item.points || 0) + 2 * (item.comments || 0);
  if (engagement > 0) s += Math.min(20, Math.round(Math.log10(engagement + 1) * 8));
  if (item.publishedAt) {
    const days = (now - new Date(item.publishedAt)) / 86400000;
    if (days <= 7) s += 10;
    else if (days <= 30) s += 5;
  }
  return Math.max(0, Math.min(100, s));
}

// FNV-1a 32bit
export function hashId(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|ref_src$|fbclid$|gclid$|oc$)/i.test(k)) url.searchParams.delete(k);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return String(u || '').trim();
  }
}

export function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
