/* Natura UI — 依存ライブラリなし。データは window.NATURA_DATA、ロジックは NaturaEngine。 */
(function () {
  'use strict';

  var E = window.NaturaEngine;
  var D = window.NATURA_DATA || { cases: [], categories: [], regulations: [], channels: [], candidates: { items: [] }, meta: {} };
  var X = E.create(D);
  var h = E.escapeHtml;
  var yen = E.formatJpy;

  /* ---------- 保存（ブラウザ内のみ。失敗しても動作する） ---------- */
  var store = {
    get: function (k, def) {
      try { var v = localStorage.getItem('natura:' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    has: function (k) { try { return localStorage.getItem('natura:' + k) != null; } catch (e) { return false; } },
    set: function (k, v) { try { localStorage.setItem('natura:' + k, JSON.stringify(v)); } catch (e) { /* 保存できない環境 */ } }
  };

  var EXAMPLE_PROFILE = { tech: 'basic', hours: 12, budget: 50000, model: 'any', interests: ['document-ai', 'support-chatbot', 'ai-agency'], strengths: ['writing', 'domain'], risk: 'mid', goal: 'side' };
  var EXAMPLE_LEGAL = { 'sell-online': true, 'personal-data': true, 'overseas-ai-api': true, 'web-service': true, 'generative-content': true };

  var S = {
    filters: Object.assign({ q: '', cat: '', model: '', team: '', rev: '', easy: false, sort: 'fit' }, store.get('filters', {})),
    compare: store.get('compare', []),
    profile: store.get('profile', EXAMPLE_PROFILE),
    profileIsExample: !store.has('profile'),
    weights: store.get('weights', null),
    rate: store.get('rate', 150),
    notes: store.get('notes', {}),
    leadStatus: store.get('leadStatus', {}),
    legal: store.get('legal', EXAMPLE_LEGAL),
    legalIsExample: !store.has('legal'),
    simCase: store.get('simCase', 'formulabot'),
    simParams: store.get('simParams', {}),
    leadFilters: { q: '', status: 'open', cat: '', rev: false },
    subtab: {},
    usePlanProfile: store.get('usePlanProfile', true)
  };

  function saveNotes() { store.set('notes', S.notes); }
  function noteFor(id) { return S.notes[id] || (S.notes[id] = { status: '', text: '', saved: false, checks: {} }); }

  /* ---------- 小物 ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }
  var modalAction = null;
  function showModal(title, note, text, action) {
    $('#modal-title').textContent = title;
    $('#modal-note').textContent = note || '';
    var ta = $('#modal-text');
    ta.value = text || '';
    ta.readOnly = !action;
    modalAction = action || null;
    var head = $('.modal-head');
    var old = $('#modal-apply');
    if (old) old.remove();
    if (action) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.id = 'modal-apply'; b.textContent = action.label;
      b.setAttribute('data-action', 'modal-apply');
      head.insertBefore(b, head.lastElementChild);
    }
    $('#modal').hidden = false;
    setTimeout(function () { ta.focus(); if (!action) ta.select(); }, 30);
  }
  function closeModal() { $('#modal').hidden = true; modalAction = null; }

  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
  function pct(v) { return Math.round(v * 1000) / 10 + '%'; }
  function fmtDate(iso) { if (!iso) return '日付不明'; var d = new Date(iso); return isNaN(d) ? String(iso) : d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); }
  function cat(c) { return X.category(c) || { name: '未分類', id: '' }; }
  function teamLabel(n) { return n == null ? '不明' : n === 1 ? '1人' : n + '人'; }

  /* ---------- Claude 連携（Artifactとして開いたときだけ有効） ---------- */
  var P = {
    inViewer: !!(window.claude && typeof window.claude.use === 'function'),
    sample: null,
    sampleState: 'none',
    downloads: null,
    init: function () {
      if (!this.inViewer) return;
      var self = this;
      self.sampleState = 'pending';
      window.claude.use('sample').then(function (s) {
        self.sample = s || null;
        self.sampleState = s ? 'ready' : 'none';
        refreshAsk();
      }).catch(function () { self.sampleState = 'none'; refreshAsk(); });
      window.claude.use('downloads').then(function (d) { self.downloads = d || null; }).catch(function () {});
    },
    copy: function (text, title) {
      var fallback = function () { showModal(title || 'テキスト', '自動でコピーできなかったため、下のテキストを選択してコピーしてください。', text); };
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) { fallback(); return; }
        navigator.clipboard.writeText(text).then(function () { toast('コピーしました'); }, fallback);
      } catch (e) { fallback(); }
    },
    save: function (filename, text) {
      if (this.downloads) {
        this.downloads.save({ filename: filename, data: text }).then(function () { toast('保存しました'); }, function (e) {
          if (e && e.code === 'declined') return;
          showModal(filename, 'ファイルとして保存できなかったため、下のテキストをコピーして保存してください。', text);
        });
        return;
      }
      if (this.inViewer) { showModal(filename, 'この画面ではファイル保存が使えないため、下のテキストをコピーして保存してください。', text); return; }
      try {
        var type = /\.json$/.test(filename) ? 'application/json' : 'text/markdown';
        var blob = new Blob([text], { type: type + ';charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        toast('保存しました：' + filename);
      } catch (e) {
        showModal(filename, '保存できなかったため、下のテキストをコピーしてください。', text);
      }
    }
  };

  /* ---------- ルーティング ---------- */
  function route() {
    var hash = (location.hash || '').replace(/^#/, '') || 'cases';
    if (hash.indexOf('case-') === 0) return { tab: 'cases', view: 'detail', id: hash.slice(5) };
    if (hash.indexOf('lead-') === 0) return { tab: 'leads', view: 'lead', id: hash.slice(5) };
    if (hash === 'compare') return { tab: 'cases', view: 'compare' };
    var tabs = ['cases', 'match', 'trends', 'leads', 'legal', 'sim', 'notes', 'guide'];
    return { tab: tabs.indexOf(hash) >= 0 ? hash : 'cases', view: hash };
  }

  var current = null;
  function render() {
    var r = route();
    current = r;
    $$('#tabs a').forEach(function (a) {
      if (a.getAttribute('data-tab') === r.tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var view = $('#view');
    if (r.view === 'detail') {
      var c = X.caseById(r.id);
      if (c) renderDetail(view, c, false); else renderNotFound(view);
    } else if (r.view === 'lead') {
      var cand = (D.candidates.items || []).filter(function (x) { return x.id === r.id; })[0];
      if (cand) renderDetail(view, X.candidateToCase(cand), true, cand); else renderNotFound(view);
    } else if (r.view === 'compare') renderCompare(view);
    else ({ cases: renderCases, match: renderMatch, trends: renderTrends, leads: renderLeads, legal: renderLegal, sim: renderSimView, notes: renderNotes, guide: renderGuide })[r.tab](view);
  }

  function renderNotFound(view) {
    view.innerHTML = '<div class="empty"><h2>ページが見つかりません</h2><p>リンク先の事例が削除されたか、IDが変わった可能性があります。</p><p><a href="#cases">事例の一覧へ戻る</a></p></div>';
  }

  /* ---------- 事例一覧 ---------- */
  function sealHtml(fit, lg) {
    return '<div class="seal' + (lg ? ' lg' : '') + ' grade-' + fit.grade + '" title="日本適合スコア ' + fit.score + '/100">' + fit.grade + '<small>' + fit.score + '</small></div>';
  }

  function confChip(conf) {
    if (!conf) return '';
    var cls = conf === 'high' ? 'good' : conf === 'medium' ? '' : 'warn';
    return '<span class="chip ' + cls + '">' + h(E.CONFIDENCE_LABEL[conf]) + '</span>';
  }

  function cardHtml(r) {
    var c = r.case, rs = X.revenueSummary(c), note = S.notes[c.id];
    var inCompare = S.compare.indexOf(c.id) >= 0;
    var angle = (c.japan && c.japan.localAngle) || '';
    return '<article class="card">' +
      '<div class="card-top">' + sealHtml(r.fit) +
      '<div class="card-title"><h2><a href="#case-' + h(c.id) + '">' + h(c.name) + '</a></h2><p>' + h(c.tagline) + '</p></div></div>' +
      '<dl class="card-facts">' +
      '<div><dt>海外実績</dt><dd class="num">' + h(rs.label) + '</dd></div>' +
      '<div><dt>チーム</dt><dd>' + h(teamLabel(c.teamSize)) + '</dd></div>' +
      '<div><dt>顧客</dt><dd>' + h(E.MODEL_LABEL[c.model] || c.model) + '</dd></div>' +
      '</dl>' +
      '<p class="card-angle"><b>日本版の切り口</b>　' + h(angle.length > 90 ? angle.slice(0, 88) + '…' : angle) + '</p>' +
      '<div class="card-foot"><div class="chips"><span class="chip ai">' + h(cat(c).name) + '</span>' +
      (c.status !== 'active' ? '<span class="chip">' + h(E.STATUS_LABEL[c.status]) + '</span>' : '') +
      (note && note.status ? '<span class="chip shu">' + h(note.status) + '</span>' : '') +
      (r.match ? '<span class="chip">相性 ' + r.match.score + '</span>' : '') + '</div>' +
      '<label class="toggle"><input type="checkbox" data-action="compare" data-id="' + h(c.id) + '"' + (inCompare ? ' checked' : '') + '>比較</label></div>' +
      '</article>';
  }

  function filteredCases() {
    var f = S.filters;
    var q = (f.q || '').trim().toLowerCase();
    var ranked = X.rank(null, { weights: S.weights, profile: f.sort === 'match' ? S.profile : null });
    var list = ranked.filter(function (r) {
      var c = r.case;
      if (f.cat && c.category !== f.cat && (c.secondaryCategories || []).indexOf(f.cat) < 0) return false;
      if (f.model && c.model !== f.model) return false;
      if (f.team === 'solo' && c.teamSize !== 1) return false;
      if (f.team === 'small' && !(c.teamSize <= 5)) return false;
      var m = X.revenueSummary(c).bestMonthlyUsd || 0;
      if (f.rev === '10k' && m < 10000) return false;
      if (f.rev === '100k' && m < 100000) return false;
      if (f.easy && !(c.nocodePossible || c.buildComplexity <= 2)) return false;
      if (q) {
        var hay = [c.name, c.tagline, c.problem, c.solution, c.target, cat(c).name, (c.tags || []).join(' '), (c.founders || []).map(function (x) { return x.name; }).join(' '), c.japan && c.japan.localAngle].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var sorters = {
      fit: function (a, b) { return b.fit.score - a.fit.score; },
      match: function (a, b) { return b.total - a.total; },
      rev: function (a, b) { return (X.revenueSummary(b.case).bestMonthlyUsd || 0) - (X.revenueSummary(a.case).bestMonthlyUsd || 0); },
      new: function (a, b) { return String(b.case.launched).localeCompare(String(a.case.launched)); }
    };
    return list.sort(sorters[f.sort] || sorters.fit);
  }

  function renderCases(view) {
    var f = S.filters;
    var catOpts = D.categories.map(function (c) { return '<option value="' + h(c.id) + '"' + (f.cat === c.id ? ' selected' : '') + '>' + h(c.name) + '</option>'; }).join('');
    var opt = function (v, label, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>'; };
    view.innerHTML =
      '<div class="view-head"><div><h1>海外のAI個人起業 事例集</h1>' +
      '<p>海外で個人・少人数が立ち上げたAI事業を出典付きで収録しています。判子は日本で再現したときの勝ち筋を示す「日本適合スコア」です。</p></div></div>' +
      '<div class="filters">' +
      '<label class="field grow"><span>キーワード</span><input type="search" id="f-q" placeholder="例：議事録、PDF、ノーコード" value="' + h(f.q) + '"></label>' +
      '<label class="field"><span>カテゴリ</span><select id="f-cat"><option value="">すべて</option>' + catOpts + '</select></label>' +
      '<label class="field"><span>顧客</span><select id="f-model">' + opt('', 'すべて', f.model) + opt('B2C', '個人向け', f.model) + opt('B2B', '法人向け', f.model) + opt('Prosumer', '個人＋法人', f.model) + opt('B2B2C', '広告・スポンサー型', f.model) + '</select></label>' +
      '<label class="field"><span>チーム規模</span><select id="f-team">' + opt('', 'すべて', f.team) + opt('solo', '1人のみ', f.team) + opt('small', '5人以下', f.team) + '</select></label>' +
      '<label class="field"><span>海外実績</span><select id="f-rev">' + opt('', 'すべて', f.rev) + opt('10k', '月$10K以上', f.rev) + opt('100k', '月$100K以上', f.rev) + '</select></label>' +
      '<label class="field"><span>並び順</span><select id="f-sort">' + opt('fit', '日本適合スコア', f.sort) + opt('match', 'あなたとの相性込み', f.sort) + opt('rev', '海外実績', f.sort) + opt('new', '新しい順', f.sort) + '</select></label>' +
      '<label class="toggle"><input type="checkbox" id="f-easy"' + (f.easy ? ' checked' : '') + '>非エンジニアでも作りやすい</label>' +
      '</div><div id="case-results"></div><div id="tray"></div>';
    var bind = function (id, key, ev) {
      $(id).addEventListener(ev || 'change', function (e) { f[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; store.set('filters', f); updateCaseResults(); });
    };
    $('#f-q').addEventListener('input', debounce(function (e) { f.q = e.target.value; store.set('filters', f); updateCaseResults(); }, 150));
    bind('#f-cat', 'cat'); bind('#f-model', 'model'); bind('#f-team', 'team'); bind('#f-rev', 'rev'); bind('#f-sort', 'sort'); bind('#f-easy', 'easy');
    updateCaseResults();
  }

  function updateCaseResults() {
    var list = filteredCases();
    var box = $('#case-results');
    if (!box) return;
    var note = S.filters.sort === 'match' ? '（相性は「相性診断」の条件で計算' + (S.profileIsExample ? '。現在は例の条件' : '') + '）' : '';
    box.innerHTML = '<div class="result-bar"><span>' + list.length + ' 件' + h(note) + '</span><span class="muted small">スコアの重みは「相性診断」で変更できます</span></div>' +
      (list.length ? '<div class="cards">' + list.map(cardHtml).join('') + '</div>' :
        '<div class="empty"><h2>条件に合う事例がありません</h2><p>絞り込みを緩めるか、キーワードを変えてみてください。</p></div>');
    renderTray();
  }

  function renderTray() {
    var tray = $('#tray');
    if (!tray) return;
    if (!S.compare.length) { tray.innerHTML = ''; return; }
    var names = S.compare.map(function (id) { var c = X.caseById(id); return c ? c.name : id; });
    tray.innerHTML = '<div class="tray"><span>比較リスト：' + h(names.join('、')) + '</span><span class="btn-row"><button class="btn ghost" data-action="compare-clear">クリア</button><a class="btn" href="#compare">比較する（' + S.compare.length + '）</a></span></div>';
  }

  /* ---------- 比較 ---------- */
  function renderCompare(view) {
    var list = S.compare.map(function (id) { return X.caseById(id); }).filter(Boolean);
    if (!list.length) {
      view.innerHTML = '<a class="crumb" href="#cases">← 事例の一覧</a><div class="empty"><h2>比較する事例を選んでください</h2><p>事例カードの「比較」にチェックを入れると、ここで最大4件まで並べて比較できます。</p></div>';
      return;
    }
    var rows = [
      ['日本適合スコア', function (c) { var f = X.japanFit(c, S.weights); return '<b class="num">' + f.score + '</b>（' + f.grade + '）'; }],
      ['あなたとの相性', function (c) { return '<span class="num">' + X.profileMatch(c, S.profile).score + '</span>'; }],
      ['カテゴリ', function (c) { return h(cat(c).name); }],
      ['顧客', function (c) { return h(E.MODEL_LABEL[c.model]); }],
      ['海外実績', function (c) { var rs = X.revenueSummary(c); return '<span class="num">' + h(rs.label) + '</span> ' + confChip(rs.confidence); }],
      ['チーム', function (c) { return h(teamLabel(c.teamSize)); }],
      ['課金方式', function (c) { return h(E.PRICING_LABEL[c.pricing.type] || ''); }],
      ['日本での想定価格', function (c) { var p = X.suggestedPriceJpy(c, S.rate); return '<span class="num">' + yen(p.jpy) + '</span>' + (p.period === 'once' ? '（買い切り）' : '／月'); }],
      ['開発難易度', function (c) { return '<span class="num">' + c.buildComplexity + '/5</span>' + (c.nocodePossible ? '（ノーコード実績あり）' : ''); }],
      ['AI原価への依存', function (c) { return { high: '高', medium: '中', low: '低' }[c.aiDependency]; }],
      ['海外での集客', function (c) { return h(X.channelMap(c).map(function (x) { return x.name; }).join('、')); }],
      ['日本版の切り口', function (c) { return h((c.japan && c.japan.localAngle) || ''); }],
      ['重要な規制', function (c) { return h(X.regulationsForCase(c).filter(function (r) { return r.severity >= 3; }).slice(0, 3).map(function (r) { return r.name; }).join('、') || '大きなものはなし'); }]
    ];
    view.innerHTML = '<a class="crumb" href="#cases">← 事例の一覧</a><div class="view-head"><div><h1>事例の比較</h1><p>選んだ事例を、日本で再現するときの観点で並べています。</p></div>' +
      '<button class="btn ghost" data-action="compare-clear">比較リストをクリア</button></div>' +
      '<div class="panel"><div class="table-wrap"><table><thead><tr><th></th>' +
      list.map(function (c) { return '<th><a href="#case-' + h(c.id) + '">' + h(c.name) + '</a> <button class="btn quiet" data-action="compare-remove" data-id="' + h(c.id) + '" aria-label="' + h(c.name) + 'を比較から外す">×</button></th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><th>' + r[0] + '</th>' + list.map(function (c) { return '<td>' + r[1](c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  /* ---------- 詳細 ---------- */
  var SUBTABS = [['overview', '概要'], ['plan', '日本版プラン'], ['sim', '収益試算'], ['legal', '法規制'], ['ask', '深掘り'], ['memo', 'メモ']];

  function renderDetail(view, c, isLead, cand) {
    var fit = X.japanFit(c, S.weights);
    var rs = X.revenueSummary(c);
    var tab = S.subtab[c.id] || 'overview';
    var note = S.notes[c.id];
    var facts = [
      ['創業者', (c.founders || []).map(function (f) { return f.name + (f.country && f.country !== '非公開' && f.country !== '不明' ? '（' + f.country + '）' : ''); }).join('、')],
      ['拠点', c.basedIn],
      ['開始', c.launched],
      ['状態', E.STATUS_LABEL[c.status]],
      ['チーム', teamLabel(c.teamSize) + (c.teamNote ? '｜' + c.teamNote : '')],
      ['資金', c.funding],
      ['課金', (E.PRICING_LABEL[c.pricing && c.pricing.type] || '') + ((c.pricing && c.pricing.plans || []).length ? '｜' + c.pricing.plans.map(function (p) { return p.name + ' $' + p.usd + (p.period === 'month' ? '/月' : p.period === 'year' ? '/年' : ''); }).join('、') : '')],
      ['技術', (c.techStack || []).join('、')],
      ['開発難易度', (c.buildComplexity || '—') + ' / 5' + (c.nocodePossible ? '（ノーコード実績あり）' : '')],
      ['AI依存', { high: '高（AI原価が大きい）', medium: '中', low: '低（原価が小さい）' }[c.aiDependency] || '—']
    ].filter(function (x) { return x[1]; });
    var inCompare = S.compare.indexOf(c.id) >= 0;
    view.innerHTML =
      '<a class="crumb" href="' + (isLead ? '#leads' : '#cases') + '">← ' + (isLead ? '新着候補' : '事例の一覧') + '</a>' +
      (isLead ? '<div class="empty" style="margin-bottom:16px"><h2>自動収集された候補の仮評価です</h2><p>記事タイトルと本文から推定したカテゴリで評価しています。事実確認が済んでいないため、気になる候補は「深掘り」タブの手順で調べてから判断してください。</p></div>' : '') +
      '<div class="detail-head">' + sealHtml(fit, true) +
      '<div class="titles"><p class="eyebrow">' + h(cat(c).name) + '</p><h1>' + h(c.name) + '</h1><p class="tagline">' + h(c.tagline) + '</p>' +
      '<div class="chips"><span class="chip ai">海外実績 ' + h(rs.label) + '</span>' + confChip(rs.confidence) +
      '<span class="chip">' + h(E.MODEL_LABEL[c.model] || '') + '</span>' + (c.tags || []).map(function (t) { return '<span class="chip">' + h(t) + '</span>'; }).join('') + '</div></div>' +
      '<div class="btn-row">' + (c.url ? '<a class="btn ghost" href="' + h(c.url) + '" target="_blank" rel="noopener">公式・元記事 ↗</a>' : '') +
      (!isLead ? '<button class="btn ghost" data-action="save-case" data-id="' + h(c.id) + '">' + (note && note.saved ? '★ 保存済み' : '☆ 保存') + '</button>' +
        '<button class="btn ghost" data-action="compare-toggle" data-id="' + h(c.id) + '">' + (inCompare ? '比較から外す' : '比較に追加') + '</button>' : '') +
      '</div></div>' +
      '<div class="detail-grid"><aside class="panel"><h2>基本情報</h2><dl class="facts">' +
      facts.map(function (f) { return '<div><dt>' + h(f[0]) + '</dt><dd>' + h(f[1]) + '</dd></div>'; }).join('') + '</dl></aside>' +
      '<section style="min-width:0"><div class="subtabs" role="tablist">' + SUBTABS.filter(function (t) { return !(isLead && t[0] === 'memo'); }).map(function (t) {
        return '<button role="tab" aria-selected="' + (t[0] === tab) + '" data-action="subtab" data-id="' + h(c.id) + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div><div id="subview"></div></section></div>';
    renderSubview(c, tab, isLead, cand);
  }

  function renderSubview(c, tab, isLead, cand) {
    var box = $('#subview');
    if (!box) return;
    ({ overview: subOverview, plan: subPlan, sim: subSim, legal: subLegal, ask: subAsk, memo: subMemo })[tab](box, c, isLead, cand);
  }

  function list(items) { return (items || []).length ? '<ul>' + items.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul>' : '<p class="muted small">情報なし</p>'; }

  function meterHtml(a) {
    return '<div class="meter"><span class="label">' + h(a.label) + '</span><span class="track" aria-hidden="true"><span class="fill" style="width:' + (a.value / 5 * 100) + '%;display:block"></span></span><span class="val">' + (Math.round(a.value * 10) / 10) + '</span>' +
      (a.note ? '<span class="note">' + h(a.note) + '</span>' : '') + '</div>';
  }

  function subOverview(box, c) {
    var fit = X.japanFit(c, S.weights);
    var srcMap = {};
    (c.sources || []).forEach(function (s) { srcMap[s.id] = s; });
    var revRows = (c.revenue || []).map(function (r) {
      var m = E.monthlyUsd(r), s = srcMap[r.sourceId];
      return '<tr><td class="num">' + h(r.date) + '</td><td>' + h(E.METRIC_LABEL[r.metric] || r.metric) + '</td><td class="num">' + E.formatUsd(r.usd) + '</td><td class="num">' + (m != null ? E.formatUsd(m) + '/月' : '—') + '</td><td>' + confChip(r.confidence) + '</td><td>' + h(r.note || '') + (s ? ' <a href="' + h(s.url) + '" target="_blank" rel="noopener">出典</a>' : '') + '</td></tr>';
    }).join('');
    var trac = (c.traction || []).map(function (t) { var s = srcMap[t.sourceId]; return '<li>' + h(t.date) + '：' + h(t.label) + (s ? ' <a href="' + h(s.url) + '" target="_blank" rel="noopener">出典</a>' : '') + '</li>'; }).join('');
    var chs = X.channelMap(c);
    box.innerHTML =
      '<div class="panel"><h2>事業の中身</h2><h3>課題</h3><p>' + h(c.problem) + '</p><h3>解決策</h3><p>' + h(c.solution) + '</p><h3>顧客</h3><p>' + h(c.target) + '</p></div>' +
      '<div class="panel"><h2>海外での実績</h2>' +
      (revRows ? '<div class="table-wrap"><table><thead><tr><th>時期</th><th>指標</th><th class="num">金額</th><th class="num">月換算</th><th>確度</th><th>補足</th></tr></thead><tbody>' + revRows + '</tbody></table></div>' : '<p class="muted">売上は公表されていません。</p>') +
      (trac ? '<h3>そのほかの実績</h3><ul>' + trac + '</ul>' : '') +
      '<p class="muted small" style="margin-top:8px">確度：「本人公表・報道」＞「取材・事例記事」＞「推計」。推計値は第三者データベースの見積もりで、実際と大きく異なることがあります。</p></div>' +
      '<div class="panel"><h2>日本適合スコアの内訳（' + fit.score + ' / 100）</h2><div class="meter-list">' + fit.axes.map(meterHtml).join('') + '</div></div>' +
      '<div class="cols"><div class="panel"><h2>成長の要因</h2>' + list(c.growthTactics) + '</div><div class="panel"><h2>教訓</h2>' + list(c.lessons) + '</div><div class="panel"><h2>リスク</h2>' + list(c.risks) + '</div></div>' +
      (chs.length ? '<div class="panel"><h2>集客チャネルの日本での置き換え</h2><div class="table-wrap"><table><thead><tr><th>海外で使われた手段</th><th>日本での置き換え</th><th>日本での有効度</th></tr></thead><tbody>' +
        chs.map(function (ch) { return '<tr><td>' + h(ch.name) + '</td><td>' + h(ch.jpEquivalent) + '</td><td class="num" title="5段階中 ' + ch.jpFit + '">' + '★'.repeat(ch.jpFit) + '☆'.repeat(5 - ch.jpFit) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '') +
      '<div class="panel"><h2>日本の競合・需要を調べる</h2><p class="small muted">外部サイトで検索します（無料）。</p><div class="btn-row" style="margin-top:10px">' +
      X.competitorLinks(c).map(function (l) { return '<a class="btn ghost" href="' + h(l.url) + '" target="_blank" rel="noopener">' + h(l.label) + ' ↗</a>'; }).join('') + '</div></div>' +
      '<div class="panel"><h2>出典</h2><ul>' + (c.sources || []).map(function (s) { return '<li><a href="' + h(s.url) + '" target="_blank" rel="noopener">' + h(s.title) + '</a> <span class="muted small">' + h(s.accessed || '') + ' 確認</span></li>'; }).join('') + '</ul></div>';
  }

  function planMarkdown(c) {
    return X.generatePlan(c, { rate: S.rate, weights: S.weights, profile: S.usePlanProfile ? S.profile : null, sim: S.simParams[c.id] });
  }

  function subPlan(box, c) {
    box.innerHTML = '<div class="panel"><div class="filters" style="margin-bottom:8px">' +
      '<label class="field"><span>為替（円/ドル）</span><input type="number" id="plan-rate" min="50" max="400" step="1" value="' + h(S.rate) + '"></label>' +
      '<label class="toggle"><input type="checkbox" id="plan-prof"' + (S.usePlanProfile ? ' checked' : '') + '>相性診断の条件を反映</label>' +
      '<div class="btn-row"><button class="btn" data-action="plan-copy" data-id="' + h(c.id) + '">Markdownをコピー</button><button class="btn ghost" data-action="plan-save" data-id="' + h(c.id) + '">.md で保存</button></div></div>' +
      '<p class="muted small">収益の仮定は「収益試算」タブで変えると、このプランにも反映されます。</p></div>' +
      '<div class="panel"><div class="doc" id="plan-doc"></div></div>';
    var draw = function () { $('#plan-doc').innerHTML = E.mdToHtml(planMarkdown(c)); };
    $('#plan-rate').addEventListener('input', debounce(function (e) { var v = Number(e.target.value); if (v >= 50 && v <= 400) { S.rate = v; store.set('rate', v); draw(); } }, 200));
    $('#plan-prof').addEventListener('change', function (e) { S.usePlanProfile = e.target.checked; store.set('usePlanProfile', S.usePlanProfile); draw(); });
    draw();
  }

  function subSim(box, c) {
    var params = Object.assign(X.simDefaultsForCase(c, S.rate), S.simParams[c.id] || {});
    box.innerHTML = '<div id="sim-host"></div>';
    simComponent($('#sim-host'), params, function (p) { S.simParams[c.id] = p; store.set('simParams', S.simParams); }, function () {
      delete S.simParams[c.id]; store.set('simParams', S.simParams); subSim(box, c);
    });
  }

  function regulationHtml(r, checks, caseId) {
    var done = (checks && checks[r.id]) || [];
    var q = encodeURIComponent(r.searchQuery || r.name);
    return '<div class="reg"><div class="sev sev-' + r.severity + '" title="重要度 ' + r.severity + '/5">' + r.severity + '</div><div style="min-width:0">' +
      '<h3>' + h(r.name) + '</h3><p class="who">所管・根拠：' + h(r.authority) + '</p><p class="small" style="margin-top:4px">' + h(r.summary) + '</p>' +
      '<ul class="acts">' + (r.actions || []).map(function (a, i) {
        return '<li><label><input type="checkbox"' + (caseId ? ' data-action="reg-check" data-id="' + h(caseId) + '" data-reg="' + h(r.id) + '" data-i="' + i + '"' : '') + (done.indexOf(i) >= 0 ? ' checked' : '') + '><span>' + h(a) + '</span></label></li>';
      }).join('') + '</ul>' +
      '<div class="btn-row" style="margin-top:8px">' + (r.links || []).map(function (l) { return '<a class="small" href="' + h(l.url) + '" target="_blank" rel="noopener">' + h(l.title) + ' ↗</a>'; }).join('') +
      '<a class="small" href="https://www.google.com/search?q=' + q + '" target="_blank" rel="noopener">公式情報を検索 ↗</a></div></div></div>';
  }

  function subLegal(box, c, isLead) {
    var regs = X.regulationsForCase(c);
    var checks = isLead ? null : noteFor(c.id).checks;
    box.innerHTML = '<div class="panel"><h2>この事業で確認すべき日本の法規制（' + regs.length + '件）</h2>' +
      '<p class="small muted" style="margin-bottom:12px">' + h(D.meta.disclaimer || '') + (isLead ? '' : ' チェックはこのブラウザに保存されます。') + '</p>' +
      regs.map(function (r) { return regulationHtml(r, checks, isLead ? null : c.id); }).join('') +
      '<p class="small" style="margin-top:12px">事業内容に合わせて詳しく確認するには <a href="#legal">法規制チェック</a> を使ってください。</p></div>';
  }

  var askCtl = null;
  function subAsk(box, c, isLead, cand) {
    var prompt = X.deepDivePrompt(c, { profile: S.usePlanProfile ? S.profile : null });
    var cmd = isLead ? '/research-case ' + c.url : '/localize ' + c.id;
    var ready = P.sampleState === 'ready';
    var pending = P.sampleState === 'pending';
    box.innerHTML =
      (ready || pending ? '<div class="panel"><h2>Claude に日本版の戦略を深掘りしてもらう</h2>' +
        '<p class="small">事例データと日本市場の整理を渡し、日本版のコンセプト3案・最初の顧客の見つけ方・価格・検証手順を提案してもらいます。あなたの Claude の利用枠で動き、追加のAPI料金はかかりません。Claude はこの画面からWeb検索できないため、固有名詞は「要確認」と表示されることがあります。</p>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn" id="ask-go"' + (ready ? '' : ' disabled') + '>' + (ready ? '深掘りを始める' : '準備中…') + '</button><button class="btn ghost" id="ask-stop" hidden>止める</button><button class="btn ghost" id="ask-copy" hidden>結果をコピー</button></div>' +
        '<div class="ask-out doc" id="ask-out" hidden></div></div>' : '') +
      '<div class="panel"><h2>Claude Code で深掘りする（Web検索つき）</h2>' +
      '<p class="small">このリポジトリを Claude Code で開き、次のコマンドを実行すると、Web検索で事実確認しながら' + (isLead ? '事例データ（data/cases/）を作成' : '日本の競合調査とレポート作成（reports/）') + 'まで行います。Claude のサブスクリプションの範囲で動きます。</p>' +
      '<pre class="cmd">' + h(cmd) + '</pre><div class="btn-row" style="margin-top:8px"><button class="btn ghost" data-action="copy-text" data-text="' + h(cmd) + '">コマンドをコピー</button></div></div>' +
      '<div class="panel"><h2>ほかのAIチャットに貼り付けて使う</h2><p class="small">claude.ai などのチャットに貼り付けると、同じ深掘りができます。</p>' +
      '<div class="btn-row" style="margin-top:8px"><button class="btn ghost" data-action="copy-prompt" data-id="' + h(c.id) + '">プロンプトをコピー</button><button class="btn quiet" data-action="show-prompt" data-id="' + h(c.id) + '">中身を見る</button></div></div>';
    box.setAttribute('data-prompt-for', c.id);
    box._prompt = prompt;
    if (!ready) return;
    var go = $('#ask-go'), stop = $('#ask-stop'), out = $('#ask-out'), copyBtn = $('#ask-copy');
    var lastText = '';
    go.addEventListener('click', function () {
      if (askCtl) askCtl.abort();
      askCtl = new AbortController();
      go.disabled = true; stop.hidden = false; copyBtn.hidden = true; out.hidden = false;
      out.textContent = '考えています…（数十秒かかることがあります）';
      P.sample(prompt, {
        signal: askCtl.signal,
        onText: function (u) { lastText = u.text; out.innerHTML = E.mdToHtml(u.text); }
      }).then(function (res) {
        lastText = res.text;
        out.innerHTML = E.mdToHtml(res.text) + (res.truncated ? '<p class="muted small">回答が長いため途中で終わっています。</p>' : '');
        copyBtn.hidden = false;
      }).catch(function (e) {
        var msg = {
          cancelled: '止めました。',
          not_granted: 'この画面からの Claude の利用が許可されませんでした。下の Claude Code かプロンプトのコピーを使ってください。',
          sampling_disabled: 'このアカウントでは Claude を呼び出せません。下の方法を使ってください。',
          rate_limited: '利用回数の上限に達しました。しばらく待ってから再度お試しください。',
          refused: 'この内容には回答できませんでした。',
          session_expired: 'もう一度サインインしてから試してください。'
        }[e && e.code] || '応答を受け取れませんでした。時間をおいて再度お試しください。';
        if (e && e.code === 'refused') out.innerHTML = '';
        else if (e && e.text) out.innerHTML = E.mdToHtml(e.text);
        out.insertAdjacentHTML('beforeend', '<p class="muted small">' + h(msg) + '</p>');
        if (e && e.text) { lastText = e.text; copyBtn.hidden = false; }
        if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) { P.sampleState = 'none'; }
      }).then(function () { go.disabled = P.sampleState !== 'ready'; stop.hidden = true; });
    });
    stop.addEventListener('click', function () { if (askCtl) askCtl.abort(); });
    copyBtn.addEventListener('click', function () { P.copy(lastText, '深掘りの結果'); });
  }

  function refreshAsk() {
    var box = $('#subview');
    if (!box || !current) return;
    var id = box.getAttribute('data-prompt-for');
    if (!id) return;
    var c = X.caseById(id);
    var isLead = false, cand = null;
    if (!c && current.view === 'lead') { cand = (D.candidates.items || []).filter(function (x) { return x.id === current.id; })[0]; c = cand && X.candidateToCase(cand); isLead = true; }
    if (c && (S.subtab[c.id] || 'overview') === 'ask') subAsk(box, c, isLead, cand);
  }

  function subMemo(box, c) {
    var n = noteFor(c.id);
    var statuses = ['', '気になる', '検証中', '着手', '見送り'];
    box.innerHTML = '<div class="panel"><h2>メモ</h2><p class="small muted" style="margin-bottom:12px">メモはこのブラウザにだけ保存されます。別の端末に移すときは「マイノート」から書き出してください。</p>' +
      '<div class="filters"><label class="field"><span>ステータス</span><select id="memo-status">' + statuses.map(function (s) { return '<option value="' + h(s) + '"' + (n.status === s ? ' selected' : '') + '>' + (s || '未設定') + '</option>'; }).join('') + '</select></label>' +
      '<label class="toggle"><input type="checkbox" id="memo-saved"' + (n.saved ? ' checked' : '') + '>保存リストに入れる</label></div>' +
      '<label class="field"><span>気づき・検証メモ</span><textarea id="memo-text" placeholder="例：日本だと税理士事務所向けが良さそう。来週3件ヒアリングする。">' + h(n.text) + '</textarea></label>' +
      '<p class="small muted" id="memo-state" style="margin-top:6px">自動保存されます</p></div>';
    var saved = function (msg) { saveNotes(); $('#memo-state').textContent = msg || '保存しました'; };
    $('#memo-status').addEventListener('change', function (e) { n.status = e.target.value; saved(); });
    $('#memo-saved').addEventListener('change', function (e) { n.saved = e.target.checked; saved(); });
    $('#memo-text').addEventListener('input', debounce(function (e) { n.text = e.target.value; saved(); }, 400));
  }

  /* ---------- 収益シミュレーター部品 ---------- */
  var SIM_FIELDS = [
    { k: 'price', label: '月額単価', unit: '円', min: 100, max: 100000, step: 10 },
    { k: 'visitors', label: '初月の訪問数', unit: '人', min: 100, max: 100000, step: 100 },
    { k: 'visitorGrowth', label: '訪問数の月次成長率', unit: '%', pct: true, min: 0, max: 50, step: 1 },
    { k: 'signupRate', label: '訪問→無料登録率', unit: '%', pct: true, min: 0.5, max: 30, step: 0.5 },
    { k: 'paidRate', label: '登録→有料転換率', unit: '%', pct: true, min: 0.5, max: 60, step: 0.5 },
    { k: 'churn', label: '月次解約率', unit: '%', pct: true, min: 0.5, max: 30, step: 0.5 },
    { k: 'aiCostPerUser', label: 'AI原価（1人・月）', unit: '円', min: 0, max: 20000, step: 10 },
    { k: 'feeRate', label: '決済手数料', unit: '%', pct: true, min: 0, max: 15, step: 0.1 },
    { k: 'fixedCost', label: '固定費（月）', unit: '円', min: 0, max: 500000, step: 1000 },
    { k: 'adBudget', label: '広告費（月）', unit: '円', min: 0, max: 1000000, step: 1000 },
    { k: 'cpc', label: '広告のクリック単価', unit: '円', min: 10, max: 1000, step: 5 },
    { k: 'months', label: '期間', unit: 'か月', min: 6, max: 36, step: 1 },
    { k: 'targetProfit', label: '目標の月利益', unit: '円', min: 0, max: 5000000, step: 10000 }
  ];

  function simComponent(root, params, onChange, onReset) {
    var p = Object.assign({}, params);
    var dv = function (f) { var v = p[f.k]; return f.pct ? Math.round(v * 1000) / 10 : v; };
    root.innerHTML = '<div class="cols" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))">' +
      '<div class="panel"><h2>仮定</h2><div class="stack">' + SIM_FIELDS.map(function (f) {
        return '<label class="field"><span>' + f.label + '（' + f.unit + '）</span><span style="display:grid;grid-template-columns:minmax(0,1fr) 7.5em;gap:8px;align-items:center">' +
          '<input type="range" data-sim="' + f.k + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + dv(f) + '" aria-label="' + f.label + '">' +
          '<input type="number" class="num" data-sim="' + f.k + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + dv(f) + '" aria-label="' + f.label + '（数値）"></span></label>';
      }).join('') + '</div><div class="btn-row" style="margin-top:14px"><button class="btn ghost" type="button" id="sim-reset">事例の初期値に戻す</button></div>' +
      '<p class="small muted" style="margin-top:10px">決済手数料の初期値 3.6% は Stripe の国内カード手数料（2026年時点の公表値）です。消費税・所得税は含みません。</p></div>' +
      '<div style="min-width:0"><div class="tiles" id="sim-tiles"></div><div class="panel"><h2>月次の売上と利益</h2><div class="legend"><span><i style="background:var(--ai)"></i>売上</span><span><i style="background:var(--shu)"></i>利益</span></div><div class="chart-wrap" id="sim-chart"></div>' +
      '<details style="margin-top:10px"><summary class="small">表で見る</summary><div class="table-wrap" id="sim-table"></div></details></div></div></div>';
    var update = function () {
      var res = X.simulate(p);
      var s = res.summary;
      $('#sim-tiles', root).innerHTML = [
        ['12か月目の月商', yen(s.mrr12), ''],
        [p.months + 'か月目の月商', yen(s.mrrLast), '有料会員 ' + s.activeLast.toLocaleString('ja-JP') + '人'],
        [p.months + 'か月目の月利益', yen(s.profitLast), '粗利率 ' + pct(s.grossMargin)],
        ['単月黒字化', s.breakEvenMonth ? s.breakEvenMonth + 'か月目' : '期間内は未達', s.cumulativeBreakEvenMonth ? '累計の回収 ' + s.cumulativeBreakEvenMonth + 'か月目' : ''],
        ['顧客生涯価値（LTV）', s.ltv ? yen(s.ltv) : '—', s.ltvCac ? 'LTV÷獲得単価 ' + (Math.round(s.ltvCac * 10) / 10) + '倍' : (p.adBudget > 0 ? '' : '広告なしの場合')],
        ['目標利益に必要な会員', s.customersForTarget ? s.customersForTarget.toLocaleString('ja-JP') + '人' : '単価が原価を下回っています', '目標 ' + yen(p.targetProfit) + '／月']
      ].map(function (t) { return '<div class="tile"><div class="k">' + t[0] + '</div><div class="v">' + h(t[1]) + '</div><div class="d">' + h(t[2]) + '</div></div>'; }).join('');
      $('#sim-chart', root).innerHTML = lineChart(res.rows);
      $('#sim-table', root).innerHTML = '<table><thead><tr><th class="num">月</th><th class="num">訪問</th><th class="num">新規有料</th><th class="num">有料会員</th><th class="num">売上</th><th class="num">費用</th><th class="num">利益</th><th class="num">累計</th></tr></thead><tbody>' +
        res.rows.map(function (r) { return '<tr><td class="num">' + r.month + '</td><td class="num">' + r.visitors.toLocaleString('ja-JP') + '</td><td class="num">' + r.newPaid + '</td><td class="num">' + r.active.toLocaleString('ja-JP') + '</td><td class="num">' + yen(r.revenue) + '</td><td class="num">' + yen(r.cost) + '</td><td class="num">' + yen(r.profit) + '</td><td class="num">' + yen(r.cumulative) + '</td></tr>'; }).join('') + '</tbody></table>';
    };
    var onInput = function (e) {
      var k = e.target.getAttribute('data-sim');
      if (!k) return;
      var f = SIM_FIELDS.filter(function (x) { return x.k === k; })[0];
      var v = Number(e.target.value);
      if (isNaN(v)) return;
      p[k] = f.pct ? v / 100 : v;
      $$('[data-sim="' + k + '"]', root).forEach(function (el) { if (el !== e.target) el.value = v; });
      update();
      onChange && onChange(Object.assign({}, p));
    };
    root.addEventListener('input', onInput);
    $('#sim-reset', root).addEventListener('click', function () { onReset && onReset(); });
    update();
  }

  /* ---------- チャート（SVG） ---------- */
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  function shortYen(v) {
    var a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e8) return s + (a / 1e8) + '億';
    if (a >= 1e4) return s + (a / 1e4) + '万';
    return s + a;
  }

  function lineChart(rows) {
    var W = 640, H = 280, L = 56, R = 64, T = 12, B = 30;
    var maxV = Math.max.apply(null, rows.map(function (r) { return Math.max(r.revenue, r.profit); }).concat([1]));
    var minV = Math.min.apply(null, rows.map(function (r) { return r.profit; }).concat([0]));
    var top = niceMax(maxV), bottom = minV < 0 ? -niceMax(-minV) : 0;
    var x = function (i) { return L + (rows.length <= 1 ? 0 : i / (rows.length - 1) * (W - L - R)); };
    var y = function (v) { return T + (top - v) / (top - bottom) * (H - T - B); };
    var ticks = [];
    var stepCount = 4;
    for (var i = 0; i <= stepCount; i++) ticks.push(bottom + (top - bottom) * i / stepCount);
    var path = function (key) { return rows.map(function (r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[key]).toFixed(1); }).join(' '); };
    var area = path('revenue') + ' L' + x(rows.length - 1).toFixed(1) + ' ' + y(Math.max(0, bottom)).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(Math.max(0, bottom)).toFixed(1) + ' Z';
    var last = rows[rows.length - 1];
    var ly1 = y(last.revenue), ly2 = y(last.profit);
    if (Math.abs(ly1 - ly2) < 14) { if (ly1 <= ly2) ly2 = ly1 + 14; else ly1 = ly2 + 14; }
    var xLabels = rows.filter(function (r) { return r.month === 1 || r.month % 6 === 0; });
    var colW = (W - L - R) / Math.max(1, rows.length - 1);
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="月次の売上と利益の推移">' +
      ticks.map(function (t) { return '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="axis-text" x="' + (L - 6) + '" y="' + (y(t) + 3) + '" text-anchor="end">' + shortYen(Math.round(t)) + '</text>'; }).join('') +
      (bottom < 0 ? '<line class="zero" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' : '') +
      xLabels.map(function (r) { return '<text class="axis-text" x="' + x(r.month - 1) + '" y="' + (H - 10) + '" text-anchor="middle">' + r.month + 'か月</text>'; }).join('') +
      '<path class="area-rev" d="' + area + '"/><path class="line-rev" d="' + path('revenue') + '"/><path class="line-profit" d="' + path('profit') + '"/>' +
      '<circle class="dot" r="4" cx="' + x(rows.length - 1) + '" cy="' + y(last.revenue) + '" style="fill:var(--ai)"/><circle class="dot" r="4" cx="' + x(rows.length - 1) + '" cy="' + y(last.profit) + '" style="fill:var(--shu)"/>' +
      '<text x="' + (x(rows.length - 1) + 8) + '" y="' + (ly1 + 4) + '">売上</text><text x="' + (x(rows.length - 1) + 8) + '" y="' + (ly2 + 4) + '">利益</text>' +
      rows.map(function (r, i) {
        return '<rect class="hit" x="' + (x(i) - colW / 2) + '" y="' + T + '" width="' + colW + '" height="' + (H - T - B) + '" data-tip="' + h(r.month + 'か月目｜売上 ' + yen(r.revenue) + '｜利益 ' + yen(r.profit) + '｜有料会員 ' + r.active.toLocaleString('ja-JP') + '人') + '" data-cross="' + x(i) + '"/>';
      }).join('') +
      '</svg>';
  }

  function barChart(items, opts) {
    opts = opts || {};
    var rowH = 26, barH = 14, labelW = opts.labelW || 210, W = 640, R = 48;
    var H = items.length * rowH + 8;
    var max = Math.max.apply(null, items.map(function (d) { return d.value; }).concat([1]));
    var sx = function (v) { return v / max * (W - labelW - R); };
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(opts.title || '') + '">' +
      '<line class="base" x1="' + labelW + '" x2="' + labelW + '" y1="0" y2="' + H + '"/>' +
      items.map(function (d, i) {
        var yy = i * rowH + 4, w = Math.max(2, sx(d.value));
        var label = d.label.length > 17 ? d.label.slice(0, 16) + '…' : d.label;
        var bar = 'M' + labelW + ' ' + yy + ' H' + (labelW + w - 4) + ' Q' + (labelW + w) + ' ' + yy + ' ' + (labelW + w) + ' ' + (yy + 4) + ' V' + (yy + barH - 4) + ' Q' + (labelW + w) + ' ' + (yy + barH) + ' ' + (labelW + w - 4) + ' ' + (yy + barH) + ' H' + labelW + ' Z';
        return '<g' + (d.href ? ' data-href="' + h(d.href) + '" style="cursor:pointer"' : '') + '>' +
          '<text x="' + (labelW - 8) + '" y="' + (yy + barH - 3) + '" text-anchor="end">' + h(label) + '</text>' +
          '<path class="bar" d="' + bar + '"/>' +
          '<text class="axis-text" x="' + (labelW + w + 6) + '" y="' + (yy + barH - 3) + '">' + h(d.valueLabel || d.value) + '</text>' +
          '<rect class="hit" x="0" y="' + (yy - 4) + '" width="' + W + '" height="' + rowH + '" data-tip="' + h(d.tip || d.label + '：' + d.value) + '"/></g>';
      }).join('') + '</svg>';
  }

  function scatterChart(points) {
    var W = 640, H = 320, L = 56, R = 16, T = 16, B = 40;
    var xs = points.map(function (p) { return p.x; });
    var x0 = Math.floor((Math.min.apply(null, xs) - 3) / 10) * 10, x1 = Math.ceil((Math.max.apply(null, xs) + 3) / 10) * 10;
    var maxY = Math.max.apply(null, points.map(function (p) { return p.y; }).concat([1e6]));
    var y0 = 3, y1 = Math.ceil(Math.log10(maxY) * 10) / 10 + 0.15; // $1K から最大値まで（対数）
    var sx = function (v) { return L + (v - x0) / (x1 - x0) * (W - L - R); };
    var sy = function (v) { return T + (y1 - Math.log10(Math.max(1000, v))) / (y1 - y0) * (H - T - B); };
    var yt = [[1e3, '≤$1K'], [1e4, '$10K'], [1e5, '$100K'], [1e6, '$1M'], [1e7, '$10M']].filter(function (t) { return Math.log10(t[0]) <= y1; });
    var xt = [];
    for (var v = x0; v <= x1; v += 10) xt.push(v);
    var labeled = points.slice().sort(function (a, b) { return (b.x + Math.log10(b.y) * 10) - (a.x + Math.log10(a.y) * 10); }).slice(0, 3).map(function (p) { return p.id; });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="日本適合スコアと海外実績の分布">' +
      yt.map(function (t) { return '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(t[0]) + '" y2="' + sy(t[0]) + '"/><text class="axis-text" x="' + (L - 6) + '" y="' + (sy(t[0]) + 3) + '" text-anchor="end">' + t[1] + '</text>'; }).join('') +
      xt.map(function (t) { return '<line class="grid" x1="' + sx(t) + '" x2="' + sx(t) + '" y1="' + T + '" y2="' + (H - B) + '"/><text class="axis-text" x="' + sx(t) + '" y="' + (H - B + 14) + '" text-anchor="middle">' + t + '</text>'; }).join('') +
      '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">日本適合スコア →</text>' +
      '<text x="12" y="' + ((T + H - B) / 2) + '" transform="rotate(-90 12 ' + ((T + H - B) / 2) + ')" text-anchor="middle">海外の月商（対数） →</text>' +
      points.map(function (p) {
        var cx = sx(p.x), cy = sy(p.y);
        return '<g data-href="#case-' + h(p.id) + '"><circle class="dot" r="5" cx="' + cx + '" cy="' + cy + '"/>' +
          (labeled.indexOf(p.id) >= 0 ? '<text x="' + (cx - 8) + '" y="' + (cy - 8) + '" text-anchor="end">' + h(p.label) + '</text>' : '') +
          '<circle class="hit" r="12" cx="' + cx + '" cy="' + cy + '" data-tip="' + h(p.label + '｜適合 ' + p.x + '｜' + E.formatUsd(p.y) + '/月') + '"/></g>';
      }).join('') + '</svg>';
  }

  // ツールチップ（マウス・タップ共通）
  function bindTips() {
    var showTip = function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]');
      var wrap = t && t.closest('.chart-wrap');
      $$('.tip').forEach(function (x) { if (!wrap || x.parentNode !== wrap) x.remove(); });
      $$('.chart .cross').forEach(function (x) { x.remove(); });
      if (!t || !wrap) return;
      var tip = $('.tip', wrap);
      if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; wrap.appendChild(tip); }
      tip.textContent = t.getAttribute('data-tip');
      var rect = wrap.getBoundingClientRect();
      var px = e.clientX - rect.left, py = e.clientY - rect.top;
      var half = 110;
      tip.style.left = Math.max(half, Math.min(rect.width - half, px)) + 'px';
      tip.style.top = Math.max(30, py) + 'px';
      var cross = t.getAttribute('data-cross');
      if (cross) {
        var svg = t.ownerSVGElement;
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'cross'); line.setAttribute('x1', cross); line.setAttribute('x2', cross);
        line.setAttribute('y1', t.getAttribute('y')); line.setAttribute('y2', Number(t.getAttribute('y')) + Number(t.getAttribute('height')));
        svg.insertBefore(line, svg.firstChild);
      }
    };
    document.addEventListener('pointermove', showTip);
    document.addEventListener('pointerdown', showTip);
  }

  /* ---------- 相性診断 ---------- */
  var TECH = [['none', 'プログラミングはしない'], ['basic', '少しできる・AIに書かせられる'], ['dev', 'エンジニア']];
  var STRENGTHS = ['sns', 'writing', 'sales', 'video', 'community', 'ads', 'design', 'engineering', 'domain'];

  function renderMatch(view) {
    var p = S.profile;
    var w = S.weights || {};
    view.innerHTML = '<div class="view-head"><div><h1>あなたに合う事例の診断</h1><p>スキル・時間・予算・関心から、再現しやすい海外事例を順位づけします。総合点は「日本適合スコア」と「あなたとの相性」の平均です。</p></div></div>' +
      '<div class="detail-grid" style="grid-template-columns:minmax(0,360px) minmax(0,1fr)">' +
      '<form class="panel" id="prof-form" autocomplete="off"><h2>あなたの条件' + (S.profileIsExample ? ' <span class="chip shu">例の条件</span>' : '') + '</h2><div class="stack">' +
      '<label class="field"><span>開発スキル</span><select name="tech">' + TECH.map(function (t) { return '<option value="' + t[0] + '"' + (p.tech === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>使える時間（週あたり・時間）</span><input type="number" name="hours" min="1" max="80" value="' + h(p.hours) + '"></label>' +
      '<label class="field"><span>初期予算（円）</span><input type="number" name="budget" min="0" step="10000" value="' + h(p.budget) + '"></label>' +
      '<label class="field"><span>売りたい相手</span><select name="model">' + [['any', 'こだわらない'], ['B2C', '個人'], ['B2B', '法人'], ['Prosumer', '個人＋法人']].map(function (t) { return '<option value="' + t[0] + '"' + (p.model === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>目的</span><select name="goal">' + [['side', '副業として'], ['main', '本業として']].map(function (t) { return '<option value="' + t[0] + '"' + (p.goal === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>規制リスクの許容度</span><select name="risk">' + [['low', '低い（避けたい）'], ['mid', 'ふつう'], ['high', '高い（専門家と組める）']].map(function (t) { return '<option value="' + t[0] + '"' + (p.risk === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="field"><span>得意なこと</span><div class="pickgrid">' + STRENGTHS.map(function (s) { return '<label class="pick"><input type="checkbox" name="strengths" value="' + s + '"' + ((p.strengths || []).indexOf(s) >= 0 ? ' checked' : '') + '><span>' + h(E.STRENGTH_LABEL[s]) + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="field"><span>関心のある分野</span><div class="pickgrid">' + D.categories.map(function (c) { return '<label class="pick"><input type="checkbox" name="interests" value="' + h(c.id) + '"' + ((p.interests || []).indexOf(c.id) >= 0 ? ' checked' : '') + '><span>' + h(c.name) + '</span></label>'; }).join('') + '</div></div>' +
      '<details><summary class="small">日本適合スコアの重みを調整する</summary><div class="stack" style="margin-top:10px">' +
      E.AXES.map(function (a) { var val = w[a.key] != null ? w[a.key] : a.weight; return '<label class="field"><span>' + h(a.label) + '：<b class="num" id="wv-' + a.key + '">' + val + '</b></span><input type="range" name="w-' + a.key + '" min="0" max="40" step="1" value="' + val + '"></label>'; }).join('') +
      '<button type="button" class="btn ghost" data-action="weights-reset">重みを初期値に戻す</button></div></details>' +
      '</div></form><div id="match-results" style="min-width:0"></div></div>';
    var form = $('#prof-form');
    var read = function () {
      var fd = new FormData(form);
      S.profile = {
        tech: fd.get('tech'), hours: Number(fd.get('hours')) || 0, budget: Number(fd.get('budget')) || 0,
        model: fd.get('model'), goal: fd.get('goal'), risk: fd.get('risk'),
        strengths: fd.getAll('strengths'), interests: fd.getAll('interests')
      };
      S.profileIsExample = false;
      store.set('profile', S.profile);
      var weights = {};
      var custom = false;
      E.AXES.forEach(function (a) { var v = Number(fd.get('w-' + a.key)); weights[a.key] = v; if (v !== a.weight) custom = true; var el = $('#wv-' + a.key); if (el) el.textContent = v; });
      S.weights = custom ? weights : null;
      store.set('weights', S.weights);
      var badge = $('#prof-form h2 .chip');
      if (badge) badge.remove();
      updateMatch();
    };
    form.addEventListener('input', debounce(read, 120));
    form.addEventListener('change', read);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    updateMatch();
  }

  function updateMatch() {
    var box = $('#match-results');
    if (!box) return;
    var ranked = X.rank(null, { weights: S.weights, profile: S.profile }).slice(0, 12);
    box.innerHTML = '<div class="panel"><h2>おすすめ順（上位12件）</h2>' + ranked.map(function (r, i) {
      var pos = r.match.reasons.filter(function (x) { return x.delta > 0; }).sort(function (a, b) { return b.delta - a.delta; }).slice(0, 3);
      var neg = r.match.reasons.filter(function (x) { return x.delta < 0; }).sort(function (a, b) { return a.delta - b.delta; }).slice(0, 2);
      return '<div class="reg"><div class="seal grade-' + r.fit.grade + '" style="width:44px;height:44px;font-size:1.25rem">' + (i + 1) + '</div><div style="min-width:0">' +
        '<h3><a href="#case-' + h(r.case.id) + '">' + h(r.case.name) + '</a> <span class="muted small">' + h(cat(r.case).name) + '</span></h3>' +
        '<p class="small"><span class="num">総合 <b>' + r.total + '</b></span>　<span class="num">日本適合 ' + r.fit.score + '</span>　<span class="num">相性 ' + r.match.score + '</span>　<span class="muted">' + h(X.revenueSummary(r.case).label) + '</span></p>' +
        '<ul class="small" style="margin-top:4px">' + pos.map(function (x) { return '<li><span style="color:var(--good)">＋</span> ' + h(x.text) + '</li>'; }).join('') + neg.map(function (x) { return '<li><span style="color:var(--bad)">−</span> ' + h(x.text) + '</li>'; }).join('') + '</ul></div></div>';
    }).join('') + '</div>';
  }

  /* ---------- 傾向 ---------- */
  function renderTrends(view) {
    var ag = X.aggregate();
    var revs = D.cases.map(function (c) { return X.revenueSummary(c).bestMonthlyUsd; }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    var median = revs.length ? revs[Math.floor((revs.length - 1) / 2)] : null;
    var points = D.cases.map(function (c) { var m = X.revenueSummary(c).bestMonthlyUsd; return m ? { id: c.id, label: c.name, x: X.japanFit(c, S.weights).score, y: m } : null; }).filter(Boolean);
    var noRev = D.cases.length - points.length;
    var catItems = ag.byCategory.map(function (x) { return { label: x.label, value: x.count, valueLabel: x.count + '件', tip: x.label + '：' + x.count + '件' + (x.medianMonthlyUsd ? '｜月商の中央値 ' + E.formatUsd(x.medianMonthlyUsd) : '') }; });
    var chItems = ag.byChannel.slice(0, 10).map(function (x) { return { label: x.key, value: x.count, valueLabel: x.count + '件' }; });
    view.innerHTML = '<div class="view-head"><div><h1>海外事例の傾向</h1><p>収録事例 ' + ag.total + ' 件から、どんな事業・課金・集客が多いかを集計しています。</p></div></div>' +
      '<div class="tiles">' +
      '<div class="tile"><div class="k">収録事例</div><div class="v">' + ag.total + '件</div><div class="d">すべて出典付き</div></div>' +
      '<div class="tile"><div class="k">1人で運営している事例</div><div class="v">' + ag.solo + '件</div><div class="d">全体の ' + Math.round(ag.solo / Math.max(1, ag.total) * 100) + '%（収録時点のチーム規模）</div></div>' +
      '<div class="tile"><div class="k">外部資金なし</div><div class="v">' + ag.bootstrapped + '件</div><div class="d">bootstrapped の割合 ' + Math.round(ag.bootstrapped / Math.max(1, ag.total) * 100) + '%</div></div>' +
      '<div class="tile"><div class="k">月商の中央値</div><div class="v">' + E.formatUsd(median) + '</div><div class="d">売上公表 ' + revs.length + '件の中央値</div></div>' +
      '</div>' +
      '<div class="panel"><h2>日本適合スコアと海外実績</h2><p class="small muted" style="margin-bottom:8px">右上ほど「海外で実績があり、日本でも勝ち筋がある」事例です。点を押すと詳細を開きます。売上非公表の ' + noRev + ' 件は含みません。</p>' +
      '<div class="chart-wrap">' + scatterChart(points) + '</div>' +
      '<details style="margin-top:8px"><summary class="small">表で見る</summary><div class="table-wrap"><table><thead><tr><th>事例</th><th class="num">日本適合</th><th class="num">月商（最大公表値）</th></tr></thead><tbody>' +
      points.slice().sort(function (a, b) { return b.x - a.x; }).map(function (p) { return '<tr><td><a href="#case-' + h(p.id) + '">' + h(p.label) + '</a></td><td class="num">' + p.x + '</td><td class="num">' + E.formatUsd(p.y) + '</td></tr>'; }).join('') + '</tbody></table></div></details></div>' +
      '<div class="cols">' +
      '<div class="panel"><h2>カテゴリ別の事例数</h2><div class="chart-wrap">' + barChart(catItems, { title: 'カテゴリ別の事例数' }) + '</div></div>' +
      '<div class="panel"><h2>海外でよく使われた集客手段</h2><div class="chart-wrap">' + barChart(chItems, { title: '集客手段' }) + '</div><p class="small muted" style="margin-top:6px">Xでの発信（Build in Public）が突出しています。日本ではnote・Zennとの組み合わせが定番の置き換えです。</p></div>' +
      '<div class="panel"><h2>課金方式</h2><div class="chart-wrap">' + barChart(ag.byPricing.map(function (x) { return { label: x.key, value: x.count, valueLabel: x.count + '件' }; }), { title: '課金方式', labelW: 130 }) + '</div></div>' +
      '<div class="panel"><h2>チーム規模（現在）</h2><div class="chart-wrap">' + barChart(ag.byTeam.map(function (x) { return { label: x.key, value: x.count, valueLabel: x.count + '件' }; }), { title: 'チーム規模', labelW: 130 }) + '</div></div>' +
      '</div>';
  }

  /* ---------- 新着候補 ---------- */
  function renderLeads(view) {
    var c = D.candidates || { items: [] };
    var f = S.leadFilters;
    var items = c.items || [];
    view.innerHTML = '<div class="view-head"><div><h1>新着候補</h1><p>Hacker News・Reddit・ニュース検索など無料の公開ソースから、海外のAI個人起業の話題を自動で集めた候補です。売上の言及やソロ創業のシグナルで点数をつけています。</p></div></div>' +
      '<div class="panel"><div class="cols" style="align-items:center"><div><p class="small"><b>最終収集：</b>' + h(c.updated ? fmtDate(c.updated) : 'まだ収集していません') + '（' + items.length + '件）</p>' +
      '<p class="small muted">更新するには、このリポジトリで次のコマンドを実行します。APIキーも料金も不要です。</p><pre class="cmd">npm run collect</pre></div>' +
      '<div class="small"><p><b>候補を本採用するには</b></p><p class="muted">候補の「Claude Codeで事例化」でコマンドをコピーし、Claude Code に貼り付けると、Web検索で事実確認したうえで事例データ（data/cases/）が作られます。</p></div></div></div>' +
      (items.length ? '<div class="filters" style="margin-top:16px">' +
        '<label class="field grow"><span>キーワード</span><input type="search" id="l-q" value="' + h(f.q) + '" placeholder="例：MRR、chatbot"></label>' +
        '<label class="field"><span>状態</span><select id="l-status"><option value="open"' + (f.status === 'open' ? ' selected' : '') + '>未処理と★</option><option value="starred"' + (f.status === 'starred' ? ' selected' : '') + '>★のみ</option><option value="dismissed"' + (f.status === 'dismissed' ? ' selected' : '') + '>除外したもの</option><option value="all"' + (f.status === 'all' ? ' selected' : '') + '>すべて</option></select></label>' +
        '<label class="field"><span>推定カテゴリ</span><select id="l-cat"><option value="">すべて</option>' + D.categories.map(function (x) { return '<option value="' + h(x.id) + '"' + (f.cat === x.id ? ' selected' : '') + '>' + h(x.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="toggle"><input type="checkbox" id="l-rev"' + (f.rev ? ' checked' : '') + '>売上の言及があるものだけ</label></div><div id="lead-list"></div>' :
        '<div class="empty" style="margin-top:16px"><h2>候補はまだありません</h2><p>ターミナルで <code>npm run collect</code> を実行すると、ここに新しい候補が並びます。</p></div>');
    if (!items.length) return;
    $('#l-q').addEventListener('input', debounce(function (e) { f.q = e.target.value; updateLeads(); }, 150));
    $('#l-status').addEventListener('change', function (e) { f.status = e.target.value; updateLeads(); });
    $('#l-cat').addEventListener('change', function (e) { f.cat = e.target.value; updateLeads(); });
    $('#l-rev').addEventListener('change', function (e) { f.rev = e.target.checked; updateLeads(); });
    updateLeads();
  }

  function leadState(cand) { return S.leadStatus[cand.id] || (cand.status === 'new' ? '' : cand.status); }

  function updateLeads() {
    var box = $('#lead-list');
    if (!box) return;
    var f = S.leadFilters;
    var q = f.q.trim().toLowerCase();
    var items = (D.candidates.items || []).filter(function (c) {
      var st = leadState(c);
      if (f.status === 'open' && st === 'dismissed') return false;
      if (f.status === 'starred' && st !== 'starred') return false;
      if (f.status === 'dismissed' && st !== 'dismissed') return false;
      if (f.cat && c.category !== f.cat) return false;
      if (f.rev && !(c.signals && c.signals.revenue && c.signals.revenue.length)) return false;
      if (q && (c.title + ' ' + c.summary).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    box.innerHTML = '<div class="result-bar"><span>' + items.length + ' 件</span></div>' + (items.length ? '<div class="panel">' + items.map(function (c) {
      var st = leadState(c);
      var catObj = X.categoryById(c.category);
      var rev = (c.signals && c.signals.revenue) || [];
      return '<div class="lead' + (st === 'dismissed' ? ' dismissed' : '') + '"><div class="score-pill" title="注目度スコア">' + c.score + '</div><div style="min-width:0">' +
        '<h3><a href="' + h(c.url) + '" target="_blank" rel="noopener">' + h(c.title) + '</a></h3>' +
        '<p class="meta">' + h(c.sourceName || c.source) + '・' + h(fmtDate(c.publishedAt)) + (c.author ? '・' + h(c.author) : '') + (c.points ? '・' + c.points + 'pt' : '') + (c.comments ? '・コメント' + c.comments : '') + '</p>' +
        (c.summary ? '<p class="sum">' + h(c.summary.length > 220 ? c.summary.slice(0, 218) + '…' : c.summary) + '</p>' : '') +
        '<div class="chips">' + (st === 'starred' ? '<span class="chip shu">★ 注目</span>' : '') + (catObj ? '<span class="chip ai">' + h(catObj.name) + '</span>' : '') +
        (c.signals && c.signals.solo ? '<span class="chip">ソロ創業のシグナル</span>' : '') +
        rev.slice(0, 2).map(function (r) { return '<span class="chip good">' + h(r.text) + '</span>'; }).join('') +
        (c.signals && c.signals.funded ? '<span class="chip warn">資金調達の話題</span>' : '') + '</div>' +
        '<div class="btn-row"><a class="btn ghost" href="#lead-' + h(c.id) + '">日本向けに仮評価</a>' +
        (c.discussionUrl ? '<a class="btn quiet" href="' + h(c.discussionUrl) + '" target="_blank" rel="noopener">議論を見る ↗</a>' : '') +
        '<button class="btn quiet" data-action="copy-text" data-text="' + h('/research-case ' + c.url) + '">Claude Codeで事例化</button>' +
        '<button class="btn quiet" data-action="lead-star" data-id="' + h(c.id) + '">' + (st === 'starred' ? '★を外す' : '☆ 注目') + '</button>' +
        '<button class="btn quiet" data-action="lead-dismiss" data-id="' + h(c.id) + '">' + (st === 'dismissed' ? '戻す' : '除外') + '</button></div></div></div>';
    }).join('') + '</div>' : '<div class="empty"><h2>条件に合う候補がありません</h2><p>絞り込みを変えてみてください。</p></div>');
  }

  /* ---------- 法規制チェック ---------- */
  function renderLegal(view) {
    view.innerHTML = '<div class="view-head"><div><h1>法規制チェック</h1><p>当てはまる項目を選ぶと、日本で事業を始める前に確認すべき法律と、やるべきことを重要度順に表示します。</p></div></div>' +
      '<div class="panel"><h2>あなたの事業に当てはまるもの' + (S.legalIsExample ? ' <span class="chip shu">例の回答</span>' : '') + '</h2><div class="qgrid">' +
      X.regulationQuestions.map(function (q) { return '<label class="toggle"><input type="checkbox" data-q="' + q.id + '"' + (S.legal[q.id] ? ' checked' : '') + '>' + h(q.text) + '</label>'; }).join('') +
      '</div><div class="btn-row" style="margin-top:10px"><button class="btn ghost" data-action="legal-clear">すべて外す</button><select id="legal-from" aria-label="事例から回答を読み込む"><option value="">事例から回答を読み込む…</option>' +
      D.cases.map(function (c) { return '<option value="' + h(c.id) + '">' + h(c.name) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="panel" id="legal-results"></div>';
    $$('[data-q]', view).forEach(function (el) {
      el.addEventListener('change', function () { S.legal[el.getAttribute('data-q')] = el.checked; S.legalIsExample = false; store.set('legal', S.legal); updateLegal(); });
    });
    $('#legal-from').addEventListener('change', function (e) {
      var c = X.caseById(e.target.value);
      if (!c) return;
      S.legal = X.defaultAnswersForCase(c); S.legalIsExample = false; store.set('legal', S.legal); renderLegal(view);
      toast(c.name + ' の内容で回答を読み込みました');
    });
    updateLegal();
  }

  function updateLegal() {
    var regs = X.checkRegulations(S.legal);
    $('#legal-results').innerHTML = '<h2>確認すべき法規制（' + regs.length + '件）</h2><p class="small muted" style="margin-bottom:12px">' + h(D.meta.disclaimer || '') + '</p>' +
      regs.map(function (r) { return regulationHtml(r, null, null); }).join('');
  }

  /* ---------- 収益シミュレーター（単独） ---------- */
  function renderSimView(view) {
    var c = X.caseById(S.simCase) || D.cases[0];
    view.innerHTML = '<div class="view-head"><div><h1>収益シミュレーター</h1><p>事例を選ぶと、日本での想定価格や業態に合わせた初期値が入ります。数字を動かして、月いくら稼げるか・いつ黒字になるかを試算できます。</p></div>' +
      '<label class="field" style="min-width:min(100%,280px)"><span>もとにする事例</span><select id="sim-case">' + D.cases.map(function (x) { return '<option value="' + h(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + h(x.name) + '</option>'; }).join('') + '</select></label></div><div id="simv"></div>';
    $('#sim-case').addEventListener('change', function (e) { S.simCase = e.target.value; store.set('simCase', S.simCase); renderSimView(view); });
    var params = Object.assign(X.simDefaultsForCase(c, S.rate), S.simParams[c.id] || {});
    simComponent($('#simv'), params, function (p) { S.simParams[c.id] = p; store.set('simParams', S.simParams); }, function () { delete S.simParams[c.id]; store.set('simParams', S.simParams); renderSimView(view); });
  }

  /* ---------- マイノート ---------- */
  function renderNotes(view) {
    var ids = Object.keys(S.notes).filter(function (id) { var n = S.notes[id]; return X.caseById(id) && (n.saved || n.status || n.text || Object.keys(n.checks || {}).length); });
    view.innerHTML = '<div class="view-head"><div><h1>マイノート</h1><p>保存した事例・ステータス・メモ・法規制のチェック状況をまとめています。データはこのブラウザ内にだけ保存されます。</p></div>' +
      '<div class="btn-row"><button class="btn ghost" data-action="export">書き出す（JSON）</button><button class="btn ghost" data-action="import">読み込む</button></div></div>' +
      (ids.length ? '<div class="panel"><div class="table-wrap"><table><thead><tr><th>事例</th><th>ステータス</th><th>メモ</th><th class="num">法規制の対応</th></tr></thead><tbody>' +
        ids.map(function (id) {
          var c = X.caseById(id), n = S.notes[id];
          var regs = X.regulationsForCase(c);
          var total = regs.reduce(function (s, r) { return s + (r.actions || []).length; }, 0);
          var done = Object.keys(n.checks || {}).reduce(function (s, k) { return s + (n.checks[k] || []).length; }, 0);
          return '<tr><td><a href="#case-' + h(id) + '">' + (n.saved ? '★ ' : '') + h(c.name) + '</a></td><td>' + h(n.status || '—') + '</td><td>' + h((n.text || '').slice(0, 80)) + ((n.text || '').length > 80 ? '…' : '') + '</td><td class="num">' + done + ' / ' + total + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' :
        '<div class="empty"><h2>まだ保存した事例はありません</h2><p>事例の詳細で「☆ 保存」を押すか、「メモ」タブでステータスやメモを書くと、ここに一覧で表示されます。</p><p><a href="#cases">事例を見る</a></p></div>');
  }

  /* ---------- 使い方 ---------- */
  function renderGuide(view) {
    view.innerHTML = '<div class="view-head"><div><h1>使い方</h1><p>海外の事例を調べ、日本向けに評価し、事業プランに落とすまでの流れです。外部の有料APIは使いません。</p></div></div>' +
      '<div class="cols"><div class="panel"><h2>基本の流れ</h2><ol class="guide-steps">' +
      '<li><div><b>相性診断で条件を入れる</b><p class="small muted">スキル・時間・予算・関心から、再現しやすい事例が上位に来ます。</p></div></li>' +
      '<li><div><b>事例を読む</b><p class="small muted">海外での実績（確度つき）、成長要因、日本適合スコアの内訳を確認します。</p></div></li>' +
      '<li><div><b>日本版プランを作る</b><p class="small muted">価格の円換算、集客チャネルの置き換え、2週間の検証計画、法規制チェックリストまで自動で作られます。Markdownで持ち出せます。</p></div></li>' +
      '<li><div><b>数字を試算する</b><p class="small muted">収益シミュレーターで価格・転換率・解約率を動かし、黒字化の時期を確かめます。</p></div></li>' +
      '<li><div><b>深掘りして検証へ</b><p class="small muted">Claude で競合や戦略を深掘りし、メモに検証の進捗を残します。</p></div></li></ol></div>' +
      '<div class="panel"><h2>データを最新にする</h2><p class="small">リポジトリのフォルダで実行します（Node.js 18 以上）。</p>' +
      '<h3>新着候補を集める（無料・APIキー不要）</h3><pre class="cmd">npm run collect</pre>' +
      '<h3>画面を開く</h3><pre class="cmd">npm run serve   # http://localhost:8000\n# または app/index.html をブラウザで直接開く</pre>' +
      '<h3>事業プランをファイルに書き出す</h3><pre class="cmd">npm run report -- photoai</pre>' +
      '<h3>Claude Code で深掘り（Web検索つき）</h3><pre class="cmd">/research-case &lt;URLまたはサービス名&gt;\n/localize &lt;事例ID&gt;\n/triage-leads</pre>' +
      '<p class="small muted" style="margin-top:8px">Claude Code のコマンドは Claude のサブスクリプションの範囲で動きます（従量課金のAPIキーで Claude Code を使っている場合は、その分の料金がかかります）。</p></div></div>' +
      '<div class="panel"><h2>スコアの考え方</h2><p class="small">日本適合スコアは、カテゴリごとに整理した日本市場の知識（需要・競合・規制・日本語の参入障壁・支払意欲・個人での実行しやすさ）と、事例ごとの海外実績を重み付けして100点満点にしたものです。S（72以上）・A（62以上）・B（52以上）・C の4段階で表示します。重みは「相性診断」で変えられます。点数は判断の出発点であり、実際の需要はヒアリングや先行販売で確かめてください。</p>' +
      '<h3>売上の確度</h3><p class="small">「本人公表・報道」は創業者自身の発信や報道、「取材・事例記事」はインタビューやケーススタディ、「推計」は第三者データベースの見積もりです。海外の売上は自己申告が多く、検証されていない数字も含みます。</p></div>';
  }

  /* ---------- 共通イベント ---------- */
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-href]');
    if (g && !e.target.closest('a,button,input')) { location.hash = g.getAttribute('data-href'); return; }
    var el = e.target.closest && e.target.closest('[data-action]');
    if (!el) return;
    var a = el.getAttribute('data-action'), id = el.getAttribute('data-id');
    switch (a) {
      case 'compare': {
        var i = S.compare.indexOf(id);
        if (el.checked && i < 0) {
          if (S.compare.length >= 4) { el.checked = false; toast('比較できるのは4件までです'); return; }
          S.compare.push(id);
        } else if (!el.checked && i >= 0) S.compare.splice(i, 1);
        store.set('compare', S.compare); renderTray();
        break;
      }
      case 'compare-toggle': {
        var j = S.compare.indexOf(id);
        if (j >= 0) S.compare.splice(j, 1);
        else if (S.compare.length >= 4) { toast('比較できるのは4件までです'); return; }
        else S.compare.push(id);
        store.set('compare', S.compare); toast(j >= 0 ? '比較から外しました' : '比較に追加しました'); render();
        break;
      }
      case 'compare-remove': S.compare = S.compare.filter(function (x) { return x !== id; }); store.set('compare', S.compare); render(); break;
      case 'compare-clear': S.compare = []; store.set('compare', S.compare); render(); break;
      case 'subtab': S.subtab[id] = el.getAttribute('data-tab'); render(); break;
      case 'save-case': { var n = noteFor(id); n.saved = !n.saved; saveNotes(); toast(n.saved ? '保存しました' : '保存を外しました'); render(); break; }
      case 'plan-copy': P.copy(planMarkdown(X.caseById(id)), '日本版事業プラン'); break;
      case 'plan-save': P.save('natura-plan-' + id + '.md', planMarkdown(X.caseById(id))); break;
      case 'copy-text': P.copy(el.getAttribute('data-text'), 'コマンド'); break;
      case 'copy-prompt': { var box = $('#subview'); P.copy(box && box._prompt || '', '深掘り用プロンプト'); break; }
      case 'show-prompt': { var b2 = $('#subview'); showModal('深掘り用プロンプト', 'AIチャットに貼り付けて使えます。', b2 && b2._prompt || ''); break; }
      case 'reg-check': {
        var nn = noteFor(id), reg = el.getAttribute('data-reg'), idx = Number(el.getAttribute('data-i'));
        var arr = nn.checks[reg] || (nn.checks[reg] = []);
        var k = arr.indexOf(idx);
        if (el.checked && k < 0) arr.push(idx); else if (!el.checked && k >= 0) arr.splice(k, 1);
        if (!arr.length) delete nn.checks[reg];
        saveNotes();
        break;
      }
      case 'weights-reset': S.weights = null; store.set('weights', null); render(); break;
      case 'lead-star': S.leadStatus[id] = leadState({ id: id, status: '' }) === 'starred' ? '' : 'starred'; store.set('leadStatus', S.leadStatus); updateLeads(); break;
      case 'lead-dismiss': S.leadStatus[id] = S.leadStatus[id] === 'dismissed' ? '' : 'dismissed'; store.set('leadStatus', S.leadStatus); updateLeads(); break;
      case 'legal-clear': S.legal = {}; S.legalIsExample = false; store.set('legal', S.legal); render(); break;
      case 'export': {
        var payload = JSON.stringify({ app: 'natura', version: 1, exportedAt: new Date().toISOString(), notes: S.notes, profile: S.profile, weights: S.weights, rate: S.rate, leadStatus: S.leadStatus, legal: S.legal, simParams: S.simParams }, null, 2);
        P.save('natura-notes.json', payload);
        break;
      }
      case 'import':
        showModal('マイノートを読み込む', '書き出したJSONを貼り付けて「取り込む」を押してください。今のメモは上書きされます。', '', {
          label: '取り込む',
          run: function (text) {
            var obj = JSON.parse(text);
            if (!obj || obj.app !== 'natura') throw new Error('Natura で書き出したデータではありません');
            ['notes', 'profile', 'weights', 'rate', 'leadStatus', 'legal', 'simParams'].forEach(function (key) { if (obj[key] !== undefined) { S[key] = obj[key]; store.set(key, obj[key]); } });
            S.profileIsExample = false; S.legalIsExample = false;
          }
        });
        break;
      case 'modal-close': closeModal(); break;
      case 'modal-apply':
        try { modalAction.run($('#modal-text').value); closeModal(); toast('取り込みました'); render(); }
        catch (err) { $('#modal-note').textContent = '取り込めませんでした：' + err.message; }
        break;
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });

  /* ---------- 起動 ---------- */
  var collected = D.candidates && D.candidates.updated ? fmtDate(D.candidates.updated) : '';
  $('#brand-meta').textContent = '収録事例 ' + D.cases.length + '件（出典付き）・知識ベース ' + ((D.meta && D.meta.knowledgeUpdated) || '') + ' 時点' + (collected ? '・候補の最終収集 ' + collected : '');
  $('#foot-disclaimer').textContent = (D.meta && D.meta.disclaimer ? D.meta.disclaimer + ' ' : '') + '海外の売上は公開情報に基づく値で、検証済みとは限りません。';
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
  bindTips();
  P.init();
  render();
})();
