/*
 * Natura engine — 海外事例を日本向けに評価・ローカライズする純粋関数群。
 * ブラウザ（window.NaturaEngine）と Node（require）の両方で動く。外部APIは使わない。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NaturaEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AXES = [
    { key: 'demand', label: '日本での需要', weight: 20 },
    { key: 'openness', label: '競合の空き', weight: 15 },
    { key: 'regulatoryLightness', label: '規制の軽さ', weight: 15 },
    { key: 'languageMoat', label: '日本語・国内事情の参入障壁', weight: 15 },
    { key: 'wtp', label: '支払意欲', weight: 10 },
    { key: 'soloFeasibility', label: '個人での実行しやすさ', weight: 15 },
    { key: 'evidence', label: '海外での実績', weight: 10 }
  ];

  var MODEL_LABEL = { B2C: '個人向け', B2B: '法人向け', B2B2C: '広告・スポンサー型', Prosumer: '個人＋法人' };
  var PRICING_LABEL = { subscription: 'サブスク', 'one-time': '買い切り', credits: 'クレジット', freemium: 'フリーミアム', ads: '広告', license: 'ライセンス' };
  var STATUS_LABEL = { active: '運営中', acquired: '売却済み', declined: '縮小', closed: '終了' };
  var CONFIDENCE_LABEL = { high: '本人公表・報道', medium: '取材・事例記事', low: '推計' };
  var METRIC_LABEL = { MRR: 'MRR', ARR: 'ARR', monthly: '月間売上', annual: '年間売上', total: '累計売上' };

  var STRENGTH_CHANNELS = {
    sns: ['x-build-in-public', 'short-video', 'influencer', 'viral-loop'],
    writing: ['seo', 'newsletter', 'free-tools'],
    sales: ['cold-outreach', 'partnership'],
    video: ['short-video', 'youtube'],
    community: ['community', 'open-source', 'hacker-news'],
    ads: ['paid-ads', 'affiliate', 'app-store'],
    design: ['viral-loop', 'app-store', 'marketplace'],
    engineering: ['open-source', 'free-tools', 'hacker-news']
  };
  var STRENGTH_LABEL = {
    sns: 'SNS発信', writing: '文章・SEO', sales: '営業', video: '動画制作', community: 'コミュニティ運営',
    ads: '広告運用', design: 'デザイン', engineering: '開発', domain: '業界知識'
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function byId(list) { var m = {}; (list || []).forEach(function (x) { m[x.id] = x; }); return m; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 金額 ---------- */

  function monthlyUsd(rev) {
    if (!rev || typeof rev.usd !== 'number') return null;
    switch (rev.metric) {
      case 'MRR': case 'monthly': return rev.usd;
      case 'ARR': case 'annual': return rev.usd / 12;
      default: return null;
    }
  }

  function formatUsd(v) {
    if (v == null) return '—';
    if (v >= 1e6) return '$' + round1(v / 1e6) + 'M';
    if (v >= 1e3) return '$' + round1(v / 1e3) + 'K';
    return '$' + Math.round(v);
  }

  function formatJpy(v) {
    if (v == null || isNaN(v)) return '—';
    var sign = v < 0 ? '-' : '';
    var a = Math.abs(v);
    if (a >= 1e8) return sign + round1(a / 1e8) + '億円';
    if (a >= 1e4) return sign + (a >= 1e6 ? Math.round(a / 1e4) : round1(a / 1e4)) + '万円';
    return sign + Math.round(a).toLocaleString('ja-JP') + '円';
  }

  // 日本でよく使われる価格（980円、1,480円、29,800円…）の候補
  var PRICE_POINTS = (function () {
    var base = [0.98, 1.28, 1.48, 1.98, 2.48, 2.98, 3.98, 4.98, 6.98];
    var pts = [];
    for (var k = 2; k <= 6; k++) base.forEach(function (b) { pts.push(Math.round(b * Math.pow(10, k))); });
    pts.push(100, 300, 500);
    return pts.sort(function (a, b) { return a - b; });
  })();

  function nicePriceJpy(v) {
    if (!(v > 0)) return 0;
    var best = PRICE_POINTS[0], bestD = Infinity;
    PRICE_POINTS.forEach(function (p) {
      var d = Math.abs(Math.log(p / v));
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
  }

  var MODEL_PRICE_FACTOR = { B2C: 0.85, Prosumer: 0.9, B2B: 1.0, B2B2C: 1.0 };

  function localizePrice(usd, opts) {
    opts = opts || {};
    var rate = opts.rate || 150;
    var factor = MODEL_PRICE_FACTOR[opts.model] || 0.9;
    var raw = usd * rate;
    var adjusted = raw * factor;
    return {
      raw: Math.round(raw),
      factor: factor,
      jpy: nicePriceJpy(adjusted),
      note: factor < 1 ? '単純換算×' + factor + '（日本の個人向け価格感に合わせて調整）を日本でよく使われる価格帯に丸めました' : '単純換算を日本でよく使われる価格帯に丸めました'
    };
  }

  /* ---------- エンジン本体 ---------- */

  function create(data) {
    data = data || {};
    var cases = data.cases || [];
    var categories = data.categories || [];
    var regulations = data.regulations || [];
    var channels = data.channels || [];
    var catMap = byId(categories), regMap = byId(regulations), chMap = byId(channels), caseMap = byId(cases);

    function category(c) { return catMap[c && c.category] || null; }

    function revenueSummary(c) {
      var list = (c && c.revenue) || [];
      var best = null;
      list.forEach(function (r) {
        var m = monthlyUsd(r);
        if (m == null) return;
        if (!best || m > best.monthly) best = { monthly: m, rev: r };
      });
      var latest = list.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null;
      return {
        bestMonthlyUsd: best ? best.monthly : null,
        best: best ? best.rev : null,
        latest: latest,
        label: best ? formatUsd(best.monthly) + '/月' : (latest ? formatUsd(latest.usd) + '（' + (METRIC_LABEL[latest.metric] || latest.metric) + '）' : '非公開'),
        confidence: best ? best.rev.confidence : (latest ? latest.confidence : null)
      };
    }

    function evidenceScore(c) {
      var rs = revenueSummary(c);
      var m = rs.bestMonthlyUsd;
      var s;
      var total = ((c && c.revenue) || []).filter(function (r) { return r.metric === 'total'; })
        .reduce(function (mx, r) { return Math.max(mx, r.usd || 0); }, 0);
      if (m == null && total > 0) s = total >= 1e6 ? 4 : total >= 1e5 ? 3 : 2;
      else if (m == null) s = (c.traction && c.traction.length) ? 2 : 1;
      else if (m < 5000) s = 2;
      else if (m < 20000) s = 3;
      else if (m < 100000) s = 4;
      else s = 5;
      if (rs.confidence === 'low') s -= 0.5;
      if (c.status === 'declined' || c.status === 'closed') s -= 0.5;
      return clamp(s, 1, 5);
    }

    function soloScore(c, cat) {
      var s = cat ? cat.scores.soloFeasibility : 3;
      var t = c.teamSize;
      if (t === 1) s += 0.5;
      else if (t >= 10) s -= 1;
      else if (t >= 4) s -= 0.5;
      if (c.buildComplexity >= 5) s -= 0.5;
      if (c.nocodePossible) s += 0.5;
      return s;
    }

    function axisValues(c) {
      var cat = category(c);
      var sc = (cat && cat.scores) || {};
      var adj = (c.japan && c.japan.scoreAdjust) || {};
      var v = {
        demand: sc.demand || 3,
        openness: sc.openness || 3,
        regulatoryLightness: sc.regulatoryLightness || 3,
        languageMoat: sc.languageMoat || 3,
        wtp: sc.wtp || 3,
        soloFeasibility: soloScore(c, cat),
        evidence: evidenceScore(c)
      };
      Object.keys(adj).forEach(function (k) { if (k in v) v[k] += adj[k]; });
      Object.keys(v).forEach(function (k) { v[k] = clamp(v[k], 1, 5); });
      return v;
    }

    function japanFit(c, weights) {
      var v = axisValues(c);
      var cat = category(c);
      var notes = (cat && cat.notes) || {};
      var heavyRegs = regulationsForCase(c).filter(function (r) { return r.severity >= 3; }).map(function (r) { return r.name; });
      var rs = revenueSummary(c);
      var noteFor = {
        demand: notes.demand,
        openness: notes.competition,
        regulatoryLightness: heavyRegs.length ? '重要度の高い規制：' + heavyRegs.slice(0, 4).join('、') : '重要度の高い規制は少ない',
        languageMoat: notes.language,
        wtp: notes.wtp,
        soloFeasibility: 'チーム規模 ' + (c.teamSize || '不明') + '人、開発難易度 ' + (c.buildComplexity || '—') + '/5' + (c.nocodePossible ? '、ノーコード実績あり' : ''),
        evidence: '最大の公表値 ' + rs.label + (rs.confidence ? '（' + CONFIDENCE_LABEL[rs.confidence] + '）' : '')
      };
      var total = 0, wsum = 0;
      var axes = AXES.map(function (a) {
        var w = weights && weights[a.key] != null ? Number(weights[a.key]) : a.weight;
        total += w * (v[a.key] - 1) / 4;
        wsum += w;
        return { key: a.key, label: a.label, value: v[a.key], weight: w, note: noteFor[a.key] || '' };
      });
      var score = wsum > 0 ? Math.round(total / wsum * 100) : 0;
      return { score: score, grade: grade(score), axes: axes };
    }

    function grade(score) {
      if (score >= 72) return 'S';
      if (score >= 62) return 'A';
      if (score >= 52) return 'B';
      return 'C';
    }

    function profileMatch(c, p) {
      p = p || {};
      var cat = category(c);
      var score = 50;
      var reasons = [];
      function add(d, text) { score += d; reasons.push({ delta: d, text: text }); }
      var need = c.buildComplexity || 3;

      if (p.tech === 'none') {
        if (c.nocodePossible) add(12, 'ノーコードで作れる実績がある');
        else if (need >= 3) add(-(need - 1) * 6, '開発難易度が高め（' + need + '/5）。外注かノーコード代替が必要');
        else add(-4, '多少の開発が必要');
      } else if (p.tech === 'basic') {
        if (need >= 4) add(-(need - 3) * 8, '開発難易度が高い（' + need + '/5）');
        else add(4, '基本的な開発スキルで作れる範囲');
      } else if (p.tech === 'dev') {
        if (need >= 3) add(6, '開発力を差別化に使える');
      }

      if (p.model && p.model !== 'any') {
        if (c.model === p.model) add(10, 'ビジネスモデルの希望（' + (MODEL_LABEL[p.model] || p.model) + '）と一致');
        else if (c.model === 'Prosumer') add(3, '個人・法人の両方に売れる');
        else add(-8, 'ビジネスモデルが希望と異なる（' + (MODEL_LABEL[c.model] || c.model) + '）');
      }

      var interests = p.interests || [];
      if (interests.indexOf(c.category) >= 0) add(15, '関心分野（' + (cat ? cat.name : c.category) + '）に合う');
      else if ((c.secondaryCategories || []).some(function (s) { return interests.indexOf(s) >= 0; })) add(8, '関心分野に近い');

      var strengths = p.strengths || [];
      var chs = c.channels || [];
      var hits = [];
      strengths.forEach(function (s) {
        var list = STRENGTH_CHANNELS[s] || [];
        if (chs.some(function (ch) { return list.indexOf(ch) >= 0; })) hits.push(STRENGTH_LABEL[s] || s);
      });
      if (hits.length) add(Math.min(15, hits.length * 6), '得意分野（' + hits.join('・') + '）が成功事例の集客手段と重なる');
      if (strengths.indexOf('domain') >= 0 && interests.indexOf(c.category) >= 0) add(6, '業界知識を活かせる');

      var hours = Number(p.hours) || 0;
      if (hours > 0 && hours < 10) {
        if (chs.indexOf('cold-outreach') >= 0 || chs.indexOf('partnership') >= 0) add(-8, '営業・提携型の集客は時間がかかる（週' + hours + '時間）');
        if (need >= 4) add(-6, '週' + hours + '時間では開発に時間がかかる');
      } else if (hours >= 30) {
        add(4, '十分な稼働時間を確保できる');
      }

      var budget = Number(p.budget);
      if (!isNaN(budget) && p.budget !== '' && p.budget != null) {
        if ((c.initialCost || 2) >= 4 && budget < 100000) add(-8, '広告・原価などの初期費用がかかりやすい');
        else if ((c.initialCost || 2) <= 1) add(4, '初期費用をほぼかけずに始められる');
      }

      if (p.risk === 'low') {
        var lightness = axisValues(c).regulatoryLightness;
        if (lightness <= 2) add(-10, '規制リスクが高いカテゴリ');
        else if (lightness >= 4) add(4, '規制リスクが比較的小さい');
      }

      if (p.goal === 'side' && c.model === 'B2B' && chs.indexOf('cold-outreach') >= 0) add(-4, '副業だと法人営業の時間確保が難しい');

      return { score: clamp(Math.round(score), 0, 100), reasons: reasons };
    }

    function rank(list, opts) {
      opts = opts || {};
      return (list || cases).map(function (c) {
        var fit = japanFit(c, opts.weights);
        var match = opts.profile ? profileMatch(c, opts.profile) : null;
        var total = match ? Math.round(fit.score * 0.5 + match.score * 0.5) : fit.score;
        return { case: c, fit: fit, match: match, total: total };
      }).sort(function (a, b) { return b.total - a.total; });
    }

    function regulationsForCase(c) {
      var cat = category(c);
      var ids = ((cat && cat.regulations) || []).slice();
      if (c.model === 'B2B' || c.model === 'Prosumer') ids.push('invoice');
      ids.push('tokushoho', 'ai-governance', 'kaigyo');
      if (c.aiDependency === 'high' || c.aiDependency === 'medium') ids.push('appi-overseas-ai');
      if ((c.channels || []).some(function (ch) { return ch === 'influencer' || ch === 'affiliate'; })) ids.push('keihyo');
      if ((c.channels || []).indexOf('app-store') >= 0) ids.push('smartphone-act');
      if ((c.pricing && c.pricing.type) === 'credits') ids.push('prepaid');
      var seen = {};
      return ids.filter(function (id) { if (seen[id] || !regMap[id]) return false; seen[id] = true; return true; })
        .map(function (id) { return regMap[id]; })
        .sort(function (a, b) { return b.severity - a.severity; });
    }

    var QUESTIONS = [
      { id: 'sell-online', text: 'ネットで有料サービス・商品を販売する', triggers: ['sell-online', 'subscription'] },
      { id: 'personal-data', text: 'ユーザーの氏名・メール・写真などの個人情報を扱う', triggers: ['personal-data'] },
      { id: 'overseas-ai-api', text: 'ユーザーの入力を海外のAI API（OpenAI等）に送る', triggers: ['overseas-ai-api'] },
      { id: 'web-service', text: 'アクセス解析・広告タグなどをWebサイトに入れる', triggers: ['web-service'] },
      { id: 'user-messaging', text: 'ユーザー同士がメッセージをやり取りできる', triggers: ['user-messaging'] },
      { id: 'advertising', text: '広告・インフルエンサー・アフィリエイトで集客する', triggers: ['advertising'] },
      { id: 'generative-content', text: 'AIで画像・文章・動画などを生成して提供する', triggers: ['generative-content'] },
      { id: 'face-or-voice', text: '人の顔写真や声を扱う・生成する', triggers: ['face-or-voice'] },
      { id: 'legal-advice', text: '契約書・法律相談など法律に関わる回答をする', triggers: ['legal-advice'] },
      { id: 'tax-advice', text: '税金の計算・申告・相談に関わる', triggers: ['tax-advice'] },
      { id: 'health-diagnosis', text: '症状・病気・治療に関わる判断をする', triggers: ['health-diagnosis'] },
      { id: 'health-beauty-claims', text: 'ダイエット・美容・健康の効果を訴求する', triggers: ['health-beauty-claims'] },
      { id: 'investment-advice', text: '投資・株・暗号資産の売買判断に関わる', triggers: ['investment-advice'] },
      { id: 'prepaid-credits', text: '前払いのクレジット・ポイントを販売する', triggers: ['prepaid-credits'] },
      { id: 'job-matching', text: '求職者と企業をマッチングする・求人情報を扱う', triggers: ['job-matching'] },
      { id: 'real-estate', text: '不動産の売買・賃貸・広告に関わる', triggers: ['real-estate'] },
      { id: 'email-marketing', text: '営業メール・メルマガを送る', triggers: ['email-marketing'] },
      { id: 'minors', text: '未成年が使う可能性がある', triggers: ['minors'] },
      { id: 'b2b-sales', text: '法人に請求書で販売する', triggers: ['b2b-sales'] },
      { id: 'outsourcing', text: 'デザイナー・エンジニア等のフリーランスに外注する', triggers: ['outsourcing'] },
      { id: 'mobile-app', text: 'スマホアプリとして配信する', triggers: ['mobile-app'] }
    ];

    function checkRegulations(answers) {
      var active = { always: true, 'ai-product': true };
      QUESTIONS.forEach(function (q) { if (answers && answers[q.id]) q.triggers.forEach(function (t) { active[t] = true; }); });
      return regulations.filter(function (r) { return (r.triggers || []).some(function (t) { return active[t]; }); })
        .sort(function (a, b) { return b.severity - a.severity; });
    }

    function defaultAnswersForCase(c) {
      var a = { 'sell-online': true, 'web-service': true, 'generative-content': c.aiDependency !== 'low' };
      if (c.aiDependency === 'high' || c.aiDependency === 'medium') a['overseas-ai-api'] = true;
      regulationsForCase(c).forEach(function (r) { (r.triggers || []).forEach(function (t) { a[t] = true; }); });
      return a;
    }

    function channelMap(c) {
      return (c.channels || []).map(function (id) { return chMap[id]; }).filter(Boolean);
    }

    function suggestedChannels(c) {
      var cat = category(c);
      var ids = ((cat && cat.channels) || []).slice();
      (c.channels || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
      return ids.map(function (id) { return chMap[id]; }).filter(Boolean)
        .sort(function (a, b) { return b.jpFit - a.jpFit; });
    }

    function competitorLinks(c) {
      var cat = category(c);
      var kws = ((cat && cat.keywordsJa) || []).slice(0, 3);
      if (!kws.length && c.name) kws = [c.name + ' 日本'];
      var links = [];
      kws.forEach(function (kw) {
        var q = encodeURIComponent(kw);
        links.push({ label: 'Google「' + kw + '」', url: 'https://www.google.com/search?q=' + q });
      });
      var main = kws[0] || c.name;
      var mq = encodeURIComponent(main);
      links.push({ label: 'PR TIMES（プレスリリース）', url: 'https://www.google.com/search?q=' + encodeURIComponent('site:prtimes.jp ' + main) });
      links.push({ label: 'App Store 日本', url: 'https://www.google.com/search?q=' + encodeURIComponent('site:apps.apple.com/jp ' + main) });
      links.push({ label: 'note の記事', url: 'https://www.google.com/search?q=' + encodeURIComponent('site:note.com ' + main) });
      links.push({ label: 'X の最新投稿', url: 'https://x.com/search?f=live&q=' + mq });
      links.push({ label: 'Google トレンド（日本）', url: 'https://trends.google.co.jp/trends/explore?geo=JP&q=' + mq });
      links.push({ label: 'ITreview（法人向けSaaSの口コミ）', url: 'https://www.google.com/search?q=' + encodeURIComponent('site:itreview.jp ' + main) });
      return links;
    }

    function mainPriceUsd(c) {
      var plans = (c.pricing && c.pricing.plans) || [];
      var monthly = plans.filter(function (p) { return p.period === 'month'; })[0];
      if (monthly) return { usd: monthly.usd, period: 'month' };
      var once = plans.filter(function (p) { return p.period === 'once'; })[0];
      if (once) return { usd: once.usd, period: 'once' };
      return null;
    }

    function suggestedPriceJpy(c, rate) {
      var cat = category(c);
      var p = mainPriceUsd(c);
      if (p) {
        var lp = localizePrice(p.usd, { rate: rate, model: c.model });
        return { jpy: lp.jpy, raw: lp.raw, period: p.period, basis: '海外価格 $' + p.usd + (p.period === 'month' ? '/月' : '（買い切り）') + ' を換算', note: lp.note };
      }
      var range = cat && cat.pricing ? (c.model === 'B2B' ? cat.pricing.b2b : cat.pricing.b2c) : '';
      var m = String(range || '').replace(/,/g, '').match(/(\d+)[〜~](\d+)/);
      if (m) {
        var mid = Math.sqrt(Number(m[1]) * Number(m[2]));
        var head = String(range).slice(0, String(range).search(/\d/));
        var once = /単発|買い切り|製本|アイテム/.test(head);
        return { jpy: nicePriceJpy(mid), raw: null, period: once ? 'once' : 'month', basis: '日本の価格相場（' + range + '）の中央値', note: '' };
      }
      return { jpy: c.model === 'B2B' ? 9800 : 980, raw: null, period: 'month', basis: '既定値', note: '' };
    }

    /* ---------- 収益シミュレーション ---------- */

    function simulate(params) {
      var p = Object.assign({
        price: 980, visitors: 3000, visitorGrowth: 0.1, signupRate: 0.05, paidRate: 0.05,
        churn: 0.08, aiCostPerUser: 100, feeRate: 0.036, fixedCost: 5000, adBudget: 0, cpc: 60, months: 24, targetProfit: 300000
      }, params || {});
      var rows = [], active = 0, cum = 0, breakEven = null, cumBreakEven = null, adPaidTotal = 0;
      for (var t = 1; t <= p.months; t++) {
        var organic = p.visitors * Math.pow(1 + p.visitorGrowth, t - 1);
        var adVisitors = p.cpc > 0 ? p.adBudget / p.cpc : 0;
        var visitors = organic + adVisitors;
        var signups = visitors * p.signupRate;
        var newPaid = signups * p.paidRate;
        adPaidTotal += adVisitors * p.signupRate * p.paidRate;
        active = active * (1 - p.churn) + newPaid;
        var revenue = active * p.price;
        var fees = revenue * p.feeRate;
        var aiCost = active * p.aiCostPerUser;
        var cost = fees + aiCost + p.fixedCost + p.adBudget;
        var profit = revenue - cost;
        cum += profit;
        if (breakEven == null && profit > 0) breakEven = t;
        if (cumBreakEven == null && t > 1 && cum >= 0 && rows.some(function (r) { return r.cumulative < 0; })) cumBreakEven = t;
        rows.push({ month: t, visitors: Math.round(visitors), signups: Math.round(signups), newPaid: round1(newPaid), active: Math.round(active), revenue: Math.round(revenue), cost: Math.round(cost), profit: Math.round(profit), cumulative: Math.round(cum) });
      }
      var unitMargin = p.price * (1 - p.feeRate) - p.aiCostPerUser;
      var grossMargin = p.price > 0 ? unitMargin / p.price : 0;
      var ltv = p.churn > 0 ? unitMargin / p.churn : null;
      var adNewPerMonth = p.cpc > 0 ? (p.adBudget / p.cpc) * p.signupRate * p.paidRate : 0;
      var cac = adNewPerMonth > 0 ? p.adBudget / adNewPerMonth : null;
      var need = unitMargin > 0 ? Math.ceil((p.targetProfit + p.fixedCost + p.adBudget) / unitMargin) : null;
      var last = rows[rows.length - 1];
      var m12 = rows[Math.min(11, rows.length - 1)];
      return {
        params: p,
        rows: rows,
        summary: {
          breakEvenMonth: breakEven,
          cumulativeBreakEvenMonth: cumBreakEven,
          mrr12: m12 ? m12.revenue : 0,
          mrrLast: last ? last.revenue : 0,
          activeLast: last ? last.active : 0,
          profitLast: last ? last.profit : 0,
          grossMargin: grossMargin,
          ltv: ltv,
          cac: cac,
          ltvCac: ltv && cac ? ltv / cac : null,
          customersForTarget: need
        }
      };
    }

    function simDefaultsForCase(c, rate) {
      var price = suggestedPriceJpy(c, rate);
      var b2b = c.model === 'B2B';
      var monthly = price.period === 'once' ? Math.max(480, Math.round(price.jpy / 12)) : price.jpy;
      return {
        price: monthly,
        visitors: b2b ? 800 : 3000,
        visitorGrowth: 0.12,
        signupRate: b2b ? 0.04 : 0.06,
        paidRate: b2b ? 0.12 : 0.05,
        churn: b2b ? 0.04 : 0.09,
        aiCostPerUser: c.aiDependency === 'high' ? Math.round(monthly * 0.15) : (c.aiDependency === 'medium' ? Math.round(monthly * 0.07) : 0),
        feeRate: 0.036,
        fixedCost: 5000,
        adBudget: 0,
        cpc: b2b ? 150 : 50,
        months: 24,
        targetProfit: 300000
      };
    }

    /* ---------- 事業プラン生成（Markdown） ---------- */

    function bullet(list) { return (list || []).filter(Boolean).map(function (x) { return '- ' + x; }).join('\n'); }

    function generatePlan(c, opts) {
      opts = opts || {};
      var rate = opts.rate || 150;
      var cat = category(c) || { name: '未分類', notes: {}, scores: {}, localizationAngles: [], pitfalls: [], validation: [], pricing: {} };
      var fit = japanFit(c, opts.weights);
      var match = opts.profile ? profileMatch(c, opts.profile) : null;
      var rs = revenueSummary(c);
      var price = suggestedPriceJpy(c, rate);
      var simP = Object.assign(simDefaultsForCase(c, rate), opts.sim || {});
      var sim = simulate(simP);
      var regs = regulationsForCase(c);
      var chs = suggestedChannels(c).slice(0, 5);
      var overseasCh = channelMap(c);
      var angle = (c.japan && c.japan.localAngle) || (cat.localizationAngles || [])[0] || '';
      var out = [];
      var today = opts.today || new Date().toISOString().slice(0, 10);

      out.push('# 日本版事業プラン：' + c.name + ' を日本で');
      out.push('> 作成日 ' + today + '／為替 1ドル=' + rate + '円で試算。数値は公開情報と仮定に基づく目安です。');
      out.push('');
      out.push('## 1. サマリー');
      out.push('| 項目 | 内容 |');
      out.push('|---|---|');
      out.push('| 元になった海外事例 | ' + c.name + '（' + (c.founders || []).map(function (f) { return f.name; }).join('、') + '）|');
      out.push('| 海外での実績 | ' + rs.label + (rs.confidence ? '（' + CONFIDENCE_LABEL[rs.confidence] + '）' : '') + ' |');
      out.push('| カテゴリ | ' + cat.name + ' |');
      out.push('| 日本適合スコア | ' + fit.score + ' / 100（' + fit.grade + '）|');
      if (match) out.push('| あなたとの相性 | ' + match.score + ' / 100 |');
      out.push('| 日本版の切り口 | ' + (angle || '要検討') + ' |');
      out.push('| 想定価格 | ' + formatJpy(price.jpy) + (price.period === 'once' ? '（買い切り）' : '／月') + ' |');
      out.push('');
      out.push('## 2. 海外事例の分解：なぜ伸びたか');
      out.push('**課題**：' + (c.problem || '—'));
      out.push('');
      out.push('**解決策**：' + (c.solution || '—'));
      out.push('');
      out.push('**顧客**：' + (c.target || '—') + '（' + (MODEL_LABEL[c.model] || c.model || '—') + '）');
      out.push('');
      if ((c.growthTactics || []).length) { out.push('**成長の要因**'); out.push(bullet(c.growthTactics)); out.push(''); }
      if ((c.lessons || []).length) { out.push('**教訓**'); out.push(bullet(c.lessons)); out.push(''); }
      out.push('## 3. 日本版のコンセプト');
      out.push('**推奨の切り口**：' + (angle || '下の候補から選ぶ'));
      out.push('');
      var angles = (cat.localizationAngles || []).filter(function (a) { return a !== angle; });
      if (angles.length) { out.push('**ほかの切り口の候補**'); out.push(bullet(angles)); out.push(''); }
      if (c.japan && (c.japan.notes || []).length) { out.push('**注意点**'); out.push(bullet(c.japan.notes)); out.push(''); }
      out.push('## 4. 日本市場での評価');
      out.push('| 観点 | スコア | 根拠 |');
      out.push('|---|---|---|');
      fit.axes.forEach(function (a) {
        out.push('| ' + a.label + ' | ' + '●'.repeat(Math.round(a.value)) + '○'.repeat(5 - Math.round(a.value)) + ' | ' + (a.note || '—').replace(/\|/g, '／') + ' |');
      });
      out.push('');
      if ((cat.knownCompetitors || []).length) {
        out.push('**国内外の主な競合（既知のもの。最新状況は要確認）**');
        out.push(bullet(cat.knownCompetitors));
        out.push('');
      }
      out.push('## 5. 価格設計');
      out.push('- 推奨価格：**' + formatJpy(price.jpy) + (price.period === 'once' ? '（買い切り）' : '／月') + '**（' + price.basis + '）');
      if (price.raw) out.push('- 参考：単純換算 ' + formatJpy(price.raw));
      if (cat.pricing) {
        if (cat.pricing.b2c) out.push('- 日本の相場（個人向け）：' + cat.pricing.b2c);
        if (cat.pricing.b2b) out.push('- 日本の相場（法人向け）：' + cat.pricing.b2b);
        if (cat.pricing.note) out.push('- ' + cat.pricing.note);
      }
      out.push('- 決済：カード（Stripe等）に加え、法人向けは請求書払い、個人向けはコンビニ払い・キャリア決済の要否を検討');
      out.push('');
      out.push('## 6. 集客チャネル');
      if (overseasCh.length) {
        out.push('**海外での集客手段 → 日本での置き換え**');
        out.push('| 海外 | 日本での置き換え | 日本での有効度 |');
        out.push('|---|---|---|');
        overseasCh.forEach(function (ch) { out.push('| ' + ch.name + ' | ' + ch.jpEquivalent + ' | ' + '★'.repeat(ch.jpFit) + '☆'.repeat(5 - ch.jpFit) + ' |'); });
        out.push('');
      }
      out.push('**日本で優先するチャネル**');
      chs.forEach(function (ch, i) { out.push((i + 1) + '. **' + ch.jpEquivalent + '**：' + ch.howTo); });
      out.push('');
      out.push('## 7. MVP（最小限の製品）');
      out.push('- 海外事例の中核機能1つだけを日本語で再現する（' + (c.solution || '').split('。')[0] + '）');
      out.push('- 開発難易度の目安：' + (c.buildComplexity || 3) + ' / 5' + (c.nocodePossible ? '（ノーコードでの実績あり）' : ''));
      if ((c.techStack || []).length) out.push('- 海外事例の技術構成：' + c.techStack.join('、'));
      out.push('- 無料枠で始められる構成例：静的ホスティング（Cloudflare Pages等）＋認証・DB（Supabase等の無料枠）＋決済（Stripe：月額固定費なし）');
      out.push('- AI原価：' + (c.aiDependency === 'high' ? '高い。1ユーザーあたりの生成回数に上限を設け、無料枠を絞る' : c.aiDependency === 'medium' ? '中程度。利用量の上限設計を入れる' : '低い（ローカル処理やユーザー自身のAPIキー利用）'));
      out.push('');
      out.push('## 8. 最初の2週間でやる検証');
      out.push(bullet((cat.validation || []).concat([
        'LP（日本語）を作り、事前登録フォームで「月' + formatJpy(price.jpy) + 'なら使うか」を聞く',
        '想定顧客10人にヒアリング（今どう解決しているか・いくら払っているか）',
        '成功基準：事前登録50件 または 有料の先行予約5件'
      ])));
      out.push('');
      out.push('## 9. 30／60／90日ロードマップ');
      out.push('| 期間 | やること | 到達目標 |');
      out.push('|---|---|---|');
      out.push('| 〜30日 | ヒアリング・LP・手動での価値提供（AI＋人手） | 有料の先行顧客3〜5件 |');
      out.push('| 〜60日 | MVPの公開、' + (chs[0] ? chs[0].jpEquivalent : '主要チャネル') + 'での発信開始 | 有料会員 ' + Math.max(10, Math.round((sim.rows[1] || {}).active || 10)) + '人前後 |');
      out.push('| 〜90日 | 解約理由の分析と改善、2つ目のチャネル追加 | 月次売上 ' + formatJpy((sim.rows[2] || {}).revenue || 0) + ' 前後（シミュレーション値） |');
      out.push('');
      out.push('## 10. 収益シミュレーション（仮定）');
      out.push('| 仮定 | 値 |');
      out.push('|---|---|');
      out.push('| 月額単価 | ' + formatJpy(simP.price) + ' |');
      out.push('| 初月の訪問数／月次成長 | ' + simP.visitors.toLocaleString('ja-JP') + '／' + Math.round(simP.visitorGrowth * 100) + '% |');
      out.push('| 登録率／有料転換率 | ' + round1(simP.signupRate * 100) + '%／' + round1(simP.paidRate * 100) + '% |');
      out.push('| 月次解約率 | ' + round1(simP.churn * 100) + '% |');
      out.push('| AI原価／人・月 | ' + formatJpy(simP.aiCostPerUser) + ' |');
      out.push('');
      out.push('| 結果 | 値 |');
      out.push('|---|---|');
      out.push('| 12か月目の月次売上 | ' + formatJpy(sim.summary.mrr12) + ' |');
      out.push('| ' + simP.months + 'か月目の月次売上 | ' + formatJpy(sim.summary.mrrLast) + '（有料会員 ' + sim.summary.activeLast + '人） |');
      out.push('| 単月黒字化 | ' + (sim.summary.breakEvenMonth ? sim.summary.breakEvenMonth + 'か月目' : '期間内は未達') + ' |');
      out.push('| 顧客生涯価値（LTV） | ' + (sim.summary.ltv ? formatJpy(sim.summary.ltv) : '—') + ' |');
      out.push('| 月' + formatJpy(simP.targetProfit) + 'の利益に必要な有料会員数 | ' + (sim.summary.customersForTarget ? sim.summary.customersForTarget.toLocaleString('ja-JP') + '人' : '—') + ' |');
      out.push('');
      out.push('## 11. 法規制チェックリスト');
      out.push('> 一般的な整理です。事業開始前に一次情報と専門家で確認してください。');
      regs.forEach(function (r) {
        out.push('### ' + r.name + '（重要度 ' + r.severity + '/5）');
        out.push(r.summary);
        out.push((r.actions || []).map(function (a) { return '- [ ] ' + a; }).join('\n'));
        out.push('');
      });
      out.push('## 12. リスクと対策');
      var risks = (c.risks || []).concat(cat.pitfalls || []);
      out.push(bullet(risks));
      out.push('');
      out.push('## 13. 競合・需要の調査リンク');
      competitorLinks(c).forEach(function (l) { out.push('- [' + l.label + '](' + l.url + ')'); });
      out.push('');
      if (match) {
        out.push('## 14. あなたとの相性の内訳');
        out.push(bullet(match.reasons.map(function (r) { return (r.delta > 0 ? '＋' : '−') + Math.abs(r.delta) + '：' + r.text; })));
        out.push('');
      }
      out.push('## 出典');
      (c.sources || []).forEach(function (s) { out.push('- [' + s.title + '](' + s.url + ')（' + (s.accessed || '') + ' 確認）'); });
      return out.join('\n');
    }

    function deepDivePrompt(c, opts) {
      opts = opts || {};
      var cat = category(c) || {};
      var brief = {
        name: c.name, tagline: c.tagline, problem: c.problem, solution: c.solution, target: c.target,
        model: c.model, pricing: c.pricing, revenue: c.revenue, channels: c.channels, growthTactics: c.growthTactics,
        lessons: c.lessons, risks: c.risks, japanAngle: c.japan && c.japan.localAngle
      };
      var lines = [
        'あなたは日本市場に詳しい起業アドバイザーです。次の海外の個人AI起業事例を、日本で個人が再現するための具体的な提案にしてください。',
        '',
        '# 事例データ',
        JSON.stringify(brief, null, 2),
        '',
        '# 参考：日本市場の整理（カテゴリ「' + (cat.name || '') + '」）',
        '- 需要：' + ((cat.notes || {}).demand || ''),
        '- 競合：' + ((cat.notes || {}).competition || ''),
        '- 言語・国内事情：' + ((cat.notes || {}).language || ''),
        '- 支払意欲：' + ((cat.notes || {}).wtp || ''),
        ''
      ];
      if (opts.profile) {
        lines.push('# 起業する人の条件');
        lines.push(JSON.stringify(opts.profile));
        lines.push('');
      }
      lines.push('# 出力してほしいこと（日本語・Markdown）');
      lines.push('1. 日本版の具体的なコンセプトを3案（ターゲット、提供価値、差別化を各1〜2行）。最も勝ち筋がある案を1つ選び理由を書く');
      lines.push('2. 選んだ案の想定顧客像（ペルソナ）と、最初の10人の顧客をどこでどう見つけるか');
      lines.push('3. 日本の競合として考えられるもの。実在が確かなものだけ名前を挙げ、不確かなものは「要確認」と明記する');
      lines.push('4. 価格設定案（円）と、その根拠');
      lines.push('5. 日本特有の法規制・商習慣上の注意点');
      lines.push('6. 2週間でできる需要検証の手順（費用ゼロ〜1万円以内）');
      lines.push('7. この事業をやめるべきサイン（撤退基準）');
      lines.push('');
      lines.push('推測と事実を区別し、数字には根拠か「仮定」と書いてください。');
      return lines.join('\n');
    }

    /* ---------- 集計 ---------- */

    function aggregate(list) {
      list = list || cases;
      function countBy(fn) {
        var m = {};
        list.forEach(function (c) { var ks = fn(c); (Array.isArray(ks) ? ks : [ks]).forEach(function (k) { if (k == null) return; m[k] = (m[k] || 0) + 1; }); });
        return Object.keys(m).map(function (k) { return { key: k, count: m[k] }; }).sort(function (a, b) { return b.count - a.count; });
      }
      var byCategory = countBy(function (c) { return c.category; }).map(function (x) {
        var cat = catMap[x.key];
        var revs = list.filter(function (c) { return c.category === x.key; }).map(function (c) { return revenueSummary(c).bestMonthlyUsd; }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
        var median = revs.length ? revs[Math.floor((revs.length - 1) / 2)] : null;
        return { key: x.key, label: cat ? cat.name : x.key, count: x.count, medianMonthlyUsd: median };
      });
      var teamBucket = function (c) { var t = c.teamSize || 0; return t <= 1 ? '1人' : t <= 3 ? '2〜3人' : t <= 9 ? '4〜9人' : '10人以上'; };
      return {
        total: list.length,
        byCategory: byCategory,
        byModel: countBy(function (c) { return MODEL_LABEL[c.model] || c.model; }),
        byPricing: countBy(function (c) { return PRICING_LABEL[c.pricing && c.pricing.type] || '不明'; }),
        byTeam: countBy(teamBucket),
        byChannel: countBy(function (c) { return (c.channels || []).map(function (id) { return chMap[id] ? chMap[id].name : id; }); }),
        byAiDependency: countBy(function (c) { return { high: 'AI依存 高', medium: 'AI依存 中', low: 'AI依存 低' }[c.aiDependency] || '不明'; }),
        solo: list.filter(function (c) { return c.teamSize === 1; }).length,
        bootstrapped: list.filter(function (c) { return /bootstrapped|外部資金なし/.test(c.funding || ''); }).length
      };
    }

    /* ---------- 新着候補 → 仮の事例 ---------- */

    function candidateToCase(cand) {
      var rev = [];
      (cand.signals && cand.signals.revenue || []).forEach(function (r) { rev.push({ date: (cand.publishedAt || '').slice(0, 7), metric: r.metric, usd: r.usd, sourceId: 's1', confidence: 'low', note: '本文から自動抽出：' + r.text }); });
      return {
        id: 'cand-' + cand.id,
        name: cand.title,
        url: cand.url,
        tagline: cand.title,
        founders: [{ name: cand.author || '不明', country: '不明' }],
        teamSize: cand.signals && cand.signals.solo ? 1 : null,
        status: 'active',
        category: cand.category || 'ai-agency',
        secondaryCategories: [],
        model: 'Prosumer',
        problem: '（自動収集のため未調査）',
        solution: cand.summary || '（未調査）',
        target: '（未調査）',
        pricing: { type: 'subscription', plans: [], note: '' },
        revenue: rev,
        traction: [],
        buildComplexity: 3,
        initialCost: 2,
        aiDependency: 'high',
        channels: [],
        growthTactics: [],
        lessons: [],
        risks: ['自動収集した候補のため、事実確認が済んでいません'],
        japan: { localAngle: '', notes: ['自動収集された候補です。深掘りリサーチで事実確認してから判断してください。'], scoreAdjust: {} },
        sources: [{ id: 's1', title: cand.title + '（' + cand.source + '）', url: cand.url, kind: 'aggregator', accessed: (cand.firstSeen || '').slice(0, 10) }],
        tags: ['未検証']
      };
    }

    return {
      cases: cases, categories: categories, regulations: regulations, channels: channels,
      caseById: function (id) { return caseMap[id] || null; },
      categoryById: function (id) { return catMap[id] || null; },
      regulationById: function (id) { return regMap[id] || null; },
      channelById: function (id) { return chMap[id] || null; },
      category: category,
      revenueSummary: revenueSummary,
      axisValues: axisValues,
      japanFit: japanFit,
      profileMatch: profileMatch,
      rank: rank,
      regulationsForCase: regulationsForCase,
      regulationQuestions: QUESTIONS,
      checkRegulations: checkRegulations,
      defaultAnswersForCase: defaultAnswersForCase,
      channelMap: channelMap,
      suggestedChannels: suggestedChannels,
      competitorLinks: competitorLinks,
      suggestedPriceJpy: suggestedPriceJpy,
      simulate: simulate,
      simDefaultsForCase: simDefaultsForCase,
      generatePlan: generatePlan,
      deepDivePrompt: deepDivePrompt,
      aggregate: aggregate,
      candidateToCase: candidateToCase
    };
  }

  /* ---------- 最小限のMarkdown→HTML ---------- */

  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, t, u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>';
    });
    return s;
  }

  function mdToHtml(md) {
    var lines = String(md || '').split('\n');
    var html = [], i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { var n = h[1].length; html.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); i++; continue; }
      if (/^---+\s*$/.test(line)) { html.push('<hr>'); i++; continue; }
      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        html.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>');
        continue;
      }
      if (/^\|/.test(line)) {
        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var cells = function (r) { return r.replace(/^\||\|\s*$/g, '').split('|').map(function (x) { return x.trim(); }); };
        var head = cells(rows[0]);
        var body = rows.slice(1).filter(function (r) { return !/^\|[\s\-:|]+\|?\s*$/.test(r); });
        html.push('<div class="table-wrap"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          body.map(function (r) { return '<tr>' + cells(r).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
        html.push('<ul>' + items.map(function (it) {
          var cb = it.match(/^\[( |x)\]\s+(.*)$/);
          if (cb) return '<li class="check"><span class="box" aria-hidden="true">' + (cb[1] === 'x' ? '☑' : '☐') + '</span>' + inline(cb[2]) + '</li>';
          return '<li>' + inline(it) + '</li>';
        }).join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { ol.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
        html.push('<ol>' + ol.map(function (it) { return '<li>' + inline(it) + '</li>'; }).join('') + '</ol>');
        continue;
      }
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|\||>|\s*[-*]\s|\s*\d+\.\s|---)/.test(lines[i])) { para.push(lines[i]); i++; }
      html.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return html.join('\n');
  }

  return {
    version: '1.0.0',
    AXES: AXES,
    MODEL_LABEL: MODEL_LABEL,
    PRICING_LABEL: PRICING_LABEL,
    STATUS_LABEL: STATUS_LABEL,
    CONFIDENCE_LABEL: CONFIDENCE_LABEL,
    METRIC_LABEL: METRIC_LABEL,
    STRENGTH_LABEL: STRENGTH_LABEL,
    create: create,
    monthlyUsd: monthlyUsd,
    formatUsd: formatUsd,
    formatJpy: formatJpy,
    nicePriceJpy: nicePriceJpy,
    localizePrice: localizePrice,
    mdToHtml: mdToHtml,
    escapeHtml: esc
  };
});
