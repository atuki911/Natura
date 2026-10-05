'use strict';

/*
 * ストア配信用アプリの外枠（ホーム画面・ワールド解放・デイリー・設定・広告・課金）。
 * 1 ジャンルのアプリ = この外枠 + エンジン + そのジャンルのルール + ワールドの設定。
 *
 * ネイティブ（Capacitor）では AdMob と Google Play 課金を使い、
 * ブラウザでは「テスト広告」「テスト購入」の画面で同じ流れを再現する（開発・テスト用）。
 */
const { escapeHtml, inlineJson } = require('./util');

const CSS = `
:root {
  --night: #120f24;
  --glass: rgba(18, 15, 36, 0.62);
  --glass-strong: rgba(18, 15, 36, 0.86);
  --edge: rgba(255, 255, 255, 0.16);
  --text: #fbf9ff;
  --soft: rgba(251, 249, 255, 0.74);
  --coin: #ffcf3f;
  --go: #ff6b3d;
  --ok: #3ddc97;
  --world1: #ffc8dd;
  --world2: #a06cd5;
  --ui: "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent }
[hidden] { display: none !important }
html, body { margin: 0; height: 100%; background: var(--night); color: var(--text); font-family: var(--ui); overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none }
button { font: inherit; color: inherit; cursor: pointer }
button:focus-visible { outline: 3px solid var(--coin); outline-offset: 2px }
#home { position: fixed; inset: 0; overflow-y: auto; background: linear-gradient(var(--world1), var(--world2)); transition: background .4s }
.page { min-height: 100%; display: flex; flex-direction: column; gap: 14px; padding-inline: 16px; padding-block: calc(env(safe-area-inset-top, 0px) + 12px) calc(env(safe-area-inset-bottom, 0px) + 20px); max-width: 520px; margin: 0 auto }
.top { display: flex; justify-content: space-between; align-items: center }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; background: var(--glass); border: 1px solid var(--edge); font-weight: 700; font-variant-numeric: tabular-nums }
.pill b { color: var(--coin) }
.icon-btn { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--edge); background: var(--glass); font-size: 20px }
.hero { display: grid; justify-items: center; gap: 4px; padding-block: 10px 4px; text-align: center }
.hero .mascot { font-size: 96px; line-height: 1.1; animation: bob 2.4s ease-in-out infinite; filter: drop-shadow(0 10px 18px rgba(0,0,0,.25)) }
.hero h1 { margin: 6px 0 4px; font-size: clamp(28px, 9vw, 40px); letter-spacing: .02em; text-shadow: 0 3px 0 rgba(18,15,36,.55), 0 0 22px rgba(18,15,36,.45); text-wrap: balance }
.hero .plate { display: grid; gap: 2px; padding: 8px 16px; border-radius: 16px; background: var(--glass); border: 1px solid var(--edge) }
.hero .world { margin: 0; font-size: 15px; font-weight: 700 }
.hero .best { margin: 0; font-size: 13px; color: var(--soft); font-variant-numeric: tabular-nums }
.play { align-self: center; width: min(100%, 320px); padding: 18px 20px; border: 0; border-radius: 22px; background: var(--go); color: #fff; font-size: 26px; font-weight: 800; letter-spacing: .08em; box-shadow: 0 6px 0 rgba(0,0,0,.25); transition: transform .08s }
.play:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(0,0,0,.25) }
.card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 18px; background: var(--glass); border: 1px solid var(--edge); text-align: left; width: 100% }
.card .em { font-size: 30px }
.card .txt { display: grid; gap: 2px; min-width: 0; flex: 1 }
.card .txt b { font-size: 15px }
.card .txt small { color: var(--soft); font-size: 12px }
.card .tag { flex: none; padding: 4px 10px; border-radius: 999px; background: var(--coin); color: var(--night); font-weight: 800; font-size: 13px }
.card[disabled] { opacity: .55 }
h2 { margin: 6px 0 0; font-size: 14px; letter-spacing: .12em; color: var(--soft) }
.rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px }
.world-card { position: relative; display: grid; justify-items: center; gap: 2px; padding: 10px 4px; border-radius: 16px; border: 2px solid transparent; font-size: 11px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.5) }
.world-card .em { font-size: 30px; line-height: 1.2 }
.world-card .num { font-weight: 800; font-size: 12px }
.world-card.on { border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.25) }
.world-card.locked .em { filter: grayscale(1) brightness(.6) }
.world-card .lock { position: absolute; top: 4px; right: 6px; font-size: 13px }
#stage { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; touch-action: none }
#stage canvas { display: block; touch-action: none }
#stage .btn { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 10px); width: 42px; height: 42px; border: 0; border-radius: 50%; background: rgba(0,0,0,.3); color: #fff; font-size: 20px; line-height: 42px; text-align: center }
#stage #mute { right: 10px }
#stage #exit { right: 60px }
.sheet-wrap { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,.5) }
.sheet { width: 100%; max-width: 520px; max-height: 88%; overflow-y: auto; display: grid; gap: 10px; padding-inline: 16px; padding-block: 18px calc(env(safe-area-inset-bottom, 0px) + 18px); border-radius: 24px 24px 0 0; background: var(--glass-strong); border: 1px solid var(--edge); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px) }
.sheet h3 { margin: 0 0 4px; font-size: 20px }
.sheet p { margin: 0; color: var(--soft); font-size: 14px; line-height: 1.6; -webkit-user-select: text; user-select: text }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,.06); border: 1px solid var(--edge); width: 100%; text-align: left }
.row span { min-width: 0 }
.row b { flex: none; white-space: nowrap }
.row small { color: var(--soft) }
.primary { padding: 14px; border: 0; border-radius: 16px; background: var(--go); color: #fff; font-weight: 800; font-size: 17px }
.secondary { padding: 12px; border: 1px solid var(--edge); border-radius: 16px; background: transparent; font-size: 15px }
#toast { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 24px); transform: translateX(-50%); z-index: 50; max-width: calc(100% - 32px); padding: 10px 18px; border-radius: 999px; background: var(--glass-strong); border: 1px solid var(--edge); font-size: 14px; text-align: center }
#adMock { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; align-content: center; gap: 16px; background: #000; color: #fff; text-align: center; padding-inline: 16px }
#adMock .big { font-size: 64px }
#adMock small { color: #aaa }
@keyframes bob { 50% { transform: translateY(-8px) } }
@media (prefers-reduced-motion: reduce) { .hero .mascot { animation: none } #home { transition: none } }
`;

const SCRIPT = String.raw`
(function () {
'use strict';
var CAP = window.Capacitor;
var NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
var PLUG = (CAP && CAP.Plugins) || {};
var ECO = APP.economy;
var ADS = APP.ads;
var KEY = 'natura:app:' + APP.key;
var $ = function (id) { return document.getElementById(id); };

// ------------------------------------------------------------ 保存データ
var S = {
  coins: 0, unlocked: [true], selected: 0, adsRemoved: false,
  games: 0, sinceInter: 0, lastInter: 0,
  bonusAt: 0, dailyDone: ''
};
try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) for (var k in saved) S[k] = saved[k]; } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function best(i) { try { return Number(localStorage.getItem('natura:' + WORLDS[i].id + ':best')) || 0; } catch (e) { return 0; } }
function isUnlocked(i) { return i === 0 || !!S.unlocked[i]; }
function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function dailyWorld() {
  var s = today(), h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % WORLDS.length;
}

var toastTimer = 0;
function toast(msg) {
  var t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
}

// ------------------------------------------------------------ 広告
var Ads = (function () {
  var A = PLUG.AdMob;
  var useNative = NATIVE && !!A;
  var ready = { reward: !useNative, inter: !useNative };
  var canRequest = !useNative;
  var privacyRequired = false;

  function loadReward() {
    if (!useNative || !canRequest) return;
    A.prepareRewardVideoAd({ adId: ADS.rewarded, isTesting: ADS.testing })
      .then(function () { ready.reward = true; renderHome(); })
      .catch(function () { ready.reward = false; setTimeout(loadReward, 60000); });
  }
  function loadInter() {
    if (!useNative || !canRequest) return;
    A.prepareInterstitial({ adId: ADS.interstitial, isTesting: ADS.testing })
      .then(function () { ready.inter = true; })
      .catch(function () { ready.inter = false; setTimeout(loadInter, 60000); });
  }

  // ブラウザ用: 本物の広告の代わりに 3 秒の「テスト広告」画面を出す
  function mock(kind) {
    return new Promise(function (resolve) {
      var box = $('adMock');
      var left = 3;
      box.hidden = false;
      box.innerHTML = '<div class="big">📺</div><div>' + (kind === 'reward' ? 'テスト広告（リワード）' : 'テスト広告') + '</div><small>ストア版ではここに本物の広告が出ます</small><button class="secondary" id="adClose" disabled>' + left + '</button>';
      var btn = $('adClose');
      var iv = setInterval(function () {
        left--;
        if (left > 0) { btn.textContent = left; return; }
        clearInterval(iv);
        btn.disabled = false;
        btn.textContent = '閉じる';
      }, 1000);
      btn.addEventListener('click', function () { box.hidden = true; box.innerHTML = ''; resolve(true); });
    });
  }

  function show(kind) {
    return new Promise(function (resolve) {
      var handles = [];
      var got = false;
      var finished = false;
      function finish(v) {
        if (finished) return;
        finished = true;
        handles.forEach(function (h) { h.then(function (x) { x.remove(); }); });
        if (kind === 'reward') loadReward(); else loadInter();
        resolve(v);
      }
      if (kind === 'reward') {
        ready.reward = false;
        handles.push(A.addListener('onRewardedVideoAdReward', function () { got = true; }));
        handles.push(A.addListener('onRewardedVideoAdDismissed', function () { finish(got); }));
        handles.push(A.addListener('onRewardedVideoAdFailedToShow', function () { finish(false); }));
        A.showRewardVideoAd().then(function () { got = true; }).catch(function () { finish(false); });
      } else {
        ready.inter = false;
        handles.push(A.addListener('interstitialAdDismissed', function () { finish(true); }));
        handles.push(A.addListener('interstitialAdFailedToShow', function () { finish(false); }));
        A.showInterstitial().catch(function () { finish(false); });
      }
    });
  }

  return {
    init: function () {
      if (!useNative) return Promise.resolve();
      return A.initialize({ initializeForTesting: ADS.testing, maxAdContentRating: ADS.maxAdContentRating })
        .then(function () { return A.requestConsentInfo(); })
        .then(function (info) {
          if (info.isConsentFormAvailable && info.status === 'REQUIRED') return A.showConsentForm();
          return info;
        })
        .then(function (info) {
          privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
          canRequest = info.canRequestAds !== false;
        })
        .catch(function () { canRequest = true; })
        .then(function () { loadReward(); loadInter(); });
    },
    rewardReady: function () { return ready.reward; },
    interReady: function () { return ready.inter; },
    rewarded: function () { return useNative ? show('reward') : mock('reward'); },
    interstitial: function () { return useNative ? show('inter') : mock('inter'); },
    privacyRequired: function () { return privacyRequired; },
    privacyOptions: function () { if (useNative) A.showPrivacyOptionsForm().catch(function () {}); }
  };
})();

// ------------------------------------------------------------ 課金（広告削除）
var Shop = (function () {
  var id = APP.iap.removeAds;
  var store = null;
  var C = null;
  var price = '';
  function platform() { return CAP && CAP.getPlatform && CAP.getPlatform() === 'ios' ? C.Platform.APPLE_APPSTORE : C.Platform.GOOGLE_PLAY; }
  function grant() {
    if (S.adsRemoved) return;
    S.adsRemoved = true;
    save();
    renderHome();
    renderSettings();
    toast('広告を消しました。ありがとう！');
  }
  return {
    init: function () {
      if (!NATIVE || !window.CdvPurchase || store) return;
      C = window.CdvPurchase;
      store = C.store;
      store.register([{ id: id, type: C.ProductType.NON_CONSUMABLE, platform: platform() }]);
      store.when()
        .approved(function (t) { t.verify(); })
        .verified(function (r) { r.finish(); })
        .productUpdated(function () {
          var p = store.get(id, platform());
          if (p && p.pricing) price = p.pricing.price;
          renderSettings();
        })
        .receiptUpdated(function () { if (store.owned(id)) grant(); });
      store.initialize([platform()]).catch(function () {});
    },
    price: function () { return price; },
    buy: function () {
      if (!store) {
        return openSheet('<h3>テスト購入</h3><p>ブラウザ版なので本物の支払いは起きません。ストア版では Google Play の購入画面が開きます。</p><button class="primary" id="mockBuy">購入したことにする</button><button class="secondary" data-close>やめる</button>', function () {
          $('mockBuy').addEventListener('click', function () { closeSheet(); grant(); });
        });
      }
      var p = store.get(id, platform());
      var offer = p && p.getOffer();
      if (!offer) return toast('ストアにつながりませんでした。少ししてからもう一度。');
      offer.order().then(function (err) {
        if (err && err.code !== C.ErrorCode.PAYMENT_CANCELLED) toast('購入できませんでした（' + err.message + '）');
      });
    },
    restore: function () {
      if (!store) return toast('ブラウザ版では復元するものはありません');
      store.restorePurchases().then(function () {
        toast(S.adsRemoved ? '購入を復元しました' : '復元できる購入はありませんでした');
      });
    }
  };
})();

// ------------------------------------------------------------ ホーム画面
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function renderHome() {
  var w = WORLDS[S.selected] || WORLDS[0];
  var t = w.theme;
  var home = $('home');
  home.style.setProperty('--world1', t.bg1);
  home.style.setProperty('--world2', t.bg2);
  $('coins').textContent = S.coins;
  $('mascot').textContent = t.player;
  $('worldName').textContent = 'ワールド' + (S.selected + 1) + '　' + w.title;
  $('best').textContent = 'ベスト ' + best(S.selected);

  var d = dailyWorld();
  var dw = WORLDS[d];
  var done = S.dailyDone === today();
  $('daily').innerHTML = '<span class="em">' + dw.theme.player + '</span><span class="txt"><b>今日のチャレンジ</b><small>ワールド' + (d + 1) + '「' + esc(dw.title) + '」がコイン' + ECO.dailyMultiplier + '倍' + (isUnlocked(d) ? '' : '（まだ解放していなくても遊べる）') + '</small></span><span class="tag">' + (done ? 'クリア済' : '×' + ECO.dailyMultiplier) + '</span>';

  var wait = S.bonusAt + ECO.bonusCooldownMinutes * 60000 - Date.now();
  var bonus = $('bonus');
  var canBonus = !S.adsRemoved ? (wait <= 0 && Ads.rewardReady()) : wait <= 0;
  bonus.disabled = !canBonus;
  bonus.innerHTML = '<span class="em">' + (S.adsRemoved ? '🎁' : '📺') + '</span><span class="txt"><b>' + (S.adsRemoved ? 'ボーナスコイン' : '広告を見てボーナス') + '</b><small>' + (wait > 0 ? 'あと ' + Math.ceil(wait / 60000) + ' 分でもらえる' : (canBonus ? 'いますぐもらえる' : '広告を準備中…')) + '</small></span><span class="tag">+' + ECO.bonusCoins + '</span>';

  $('rail').innerHTML = WORLDS.map(function (g, i) {
    var open = isUnlocked(i);
    return '<button class="world-card' + (i === S.selected ? ' on' : '') + (open ? '' : ' locked') + '" data-world="' + i + '" style="background:linear-gradient(' + g.theme.bg1 + ',' + g.theme.bg2 + ')" aria-label="ワールド' + (i + 1) + (open ? '' : '（ロック中）') + '">' +
      (open ? '' : '<span class="lock">🔒</span>') +
      '<span class="em">' + g.theme.player + '</span><span class="num">' + (i + 1) + '</span><span>' + (open ? 'ベスト ' + best(i) : '🪙 ' + (ECO.unlockCost[i] || 0)) + '</span></button>';
  }).join('');
}

function onWorld(i) {
  if (isUnlocked(i)) { S.selected = i; save(); renderHome(); return; }
  var cost = ECO.unlockCost[i] || 0;
  var g = WORLDS[i];
  var enough = S.coins >= cost;
  openSheet('<h3>' + g.theme.player + ' ワールド' + (i + 1) + '「' + esc(g.title) + '」</h3><p>' + (enough ? '🪙 ' + cost + ' コインで解放できます。' : 'あと 🪙 ' + (cost - S.coins) + ' コインで解放できます。遊んでコインを集めよう！') + '</p>' +
    (enough ? '<button class="primary" id="unlock">🪙 ' + cost + ' で解放する</button>' : '') + '<button class="secondary" data-close>とじる</button>', function () {
    if (!enough) return;
    $('unlock').addEventListener('click', function () {
      S.coins -= cost;
      S.unlocked[i] = true;
      S.selected = i;
      save();
      closeSheet();
      renderHome();
      toast('ワールド' + (i + 1) + 'を解放しました！');
    });
  });
}

function claimBonus() {
  var give = function () {
    S.coins += ECO.bonusCoins;
    S.bonusAt = Date.now();
    save();
    renderHome();
    toast('🪙 +' + ECO.bonusCoins + ' コイン！');
  };
  if (S.adsRemoved) return give();
  Ads.rewarded().then(function (ok) {
    if (ok) {
      S.sinceInter = 0;
      S.lastInter = Date.now();
      give();
    } else toast('最後まで見るとコインがもらえます');
  });
}

// ------------------------------------------------------------ 設定
var sheetCleanup = null;
function openSheet(html, after) {
  var wrap = $('sheet');
  wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
  wrap.hidden = false;
  if (after) after();
}
function closeSheet() {
  var wrap = $('sheet');
  wrap.hidden = true;
  wrap.innerHTML = '';
  sheetCleanup = null;
}
function renderSettings() {
  if (sheetCleanup !== 'settings') return;
  openSettings();
}
function openSettings() {
  var muted = false;
  try { muted = localStorage.getItem('natura:muted') === '1'; } catch (e) {}
  var price = Shop.price();
  openSheet('<h3>せってい</h3>' +
    '<button class="row" id="setSound"><span>サウンド</span><b>' + (muted ? 'オフ' : 'オン') + '</b></button>' +
    (S.adsRemoved
      ? '<div class="row"><span>広告削除</span><b>購入済み ✓</b></div>'
      : '<button class="row" id="setBuy"><span>広告を消す<br><small>ゲームの合間の広告がなくなり、つづきからが無料に</small></span><b>' + (price || '購入') + '</b></button>') +
    '<button class="row" id="setRestore"><span>購入を復元</span><b>›</b></button>' +
    (Ads.privacyRequired() ? '<button class="row" id="setPrivacyOptions"><span>広告のプライバシー設定</span><b>›</b></button>' : '') +
    (APP.privacyPolicyUrl ? '<a class="row" href="' + esc(APP.privacyPolicyUrl) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span>プライバシーポリシー</span><b>›</b></a>' : '') +
    (APP.contactEmail ? '<div class="row"><span>お問い合わせ<br><small>' + esc(APP.contactEmail) + '</small></span></div>' : '') +
    '<p>' + esc(APP.name) + ' v' + esc(APP.version) + (ADS.testing ? '　・テスト広告モード' : '') + '</p>' +
    '<button class="secondary" data-close>とじる</button>', function () {
    sheetCleanup = 'settings';
    $('setSound').addEventListener('click', function () {
      try { localStorage.setItem('natura:muted', muted ? '0' : '1'); } catch (e) {}
      openSettings();
    });
    if ($('setBuy')) $('setBuy').addEventListener('click', Shop.buy);
    $('setRestore').addEventListener('click', Shop.restore);
    if ($('setPrivacyOptions')) $('setPrivacyOptions').addEventListener('click', Ads.privacyOptions);
  });
}

// ------------------------------------------------------------ ゲーム
var current = null;
var playing = -1;

function maybeInterstitial(done) {
  S.games++;
  S.sinceInter++;
  var due = !S.adsRemoved && S.games > ADS.graceGames && S.sinceInter >= ADS.interstitialEvery &&
    Date.now() - S.lastInter >= ADS.interstitialMinSeconds * 1000 && Ads.interReady();
  save();
  if (!due) return done();
  Ads.interstitial().then(function () {
    S.sinceInter = 0;
    S.lastInter = Date.now();
    save();
    done();
  });
}

function launch(i, daily) {
  closeGame();
  var cfg = WORLDS[i];
  var mult = daily ? ECO.dailyMultiplier : 1;
  var stage = $('stage');
  stage.style.background = 'linear-gradient(' + cfg.theme.bg1 + ',' + cfg.theme.bg2 + ')';
  stage.innerHTML = '<canvas id="game"></canvas><button id="exit" class="btn" aria-label="ホームにもどる">🏠</button><button id="mute" class="btn" aria-label="サウンド切り替え">🔊</button>';
  stage.hidden = false;
  $('home').hidden = true;
  $('exit').addEventListener('click', closeGame);
  playing = i;
  current = NaturaEngine.start(cfg, GAME, {
    serviceWorker: false,
    rewardFor: function (score) { return score * APP.coinRate * mult; },
    canRevive: function () { return S.adsRemoved || Ads.rewardReady(); },
    reviveLabel: S.adsRemoved ? '▶ つづきから（無料）' : '▶ 広告を見てつづきから',
    onRevive: function (done) {
      if (S.adsRemoved) return done(true);
      Ads.rewarded().then(function (ok) {
        if (ok) { S.sinceInter = 0; S.lastInter = Date.now(); save(); }
        done(ok);
      });
    },
    beforeRestart: maybeInterstitial,
    onGameOver: function (score, coins) {
      S.coins += coins;
      if (daily) S.dailyDone = today();
      save();
    }
  });
}

function closeGame() {
  if (current) { current.stop(); current = null; }
  playing = -1;
  var stage = $('stage');
  stage.hidden = true;
  stage.innerHTML = '';
  $('home').hidden = false;
  renderHome();
}

// ------------------------------------------------------------ 起動
$('play').addEventListener('click', function () { launch(S.selected, false); });
$('daily').addEventListener('click', function () { launch(dailyWorld(), true); });
$('bonus').addEventListener('click', claimBonus);
$('settings').addEventListener('click', openSettings);
$('rail').addEventListener('click', function (e) {
  var b = e.target.closest('[data-world]');
  if (b) onWorld(Number(b.dataset.world));
});
$('sheet').addEventListener('click', function (e) {
  if (e.target.id === 'sheet' || e.target.closest('[data-close]')) closeSheet();
});
setInterval(function () { if (playing < 0) renderHome(); }, 30000);

if (PLUG.App) {
  PLUG.App.addListener('backButton', function () {
    if (!$('adMock').hidden) return;
    if (!$('sheet').hidden) return closeSheet();
    if (playing >= 0) return closeGame();
    PLUG.App.exitApp();
  });
}

document.addEventListener('deviceready', Shop.init);
Shop.init();
Ads.init().then(renderHome);
renderHome();
window.__app = { S: S, launch: launch, closeGame: closeGame, Ads: Ads };
})();
`;

function appShellHtml({ runtime, gameSource, app, worlds }) {
  const first = worlds[0].theme;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="${first.bg2}">
<title>${escapeHtml(app.name)}</title>
<style>${CSS}</style>
</head>
<body>
<div id="home">
  <div class="page">
    <div class="top">
      <span class="pill">🪙 <b id="coins">0</b></span>
      <button class="icon-btn" id="settings" aria-label="せってい">⚙️</button>
    </div>
    <section class="hero">
      <div class="mascot" id="mascot" aria-hidden="true">${first.player}</div>
      <h1>${escapeHtml(app.name)}</h1>
      <div class="plate"><p class="world" id="worldName"></p><p class="best" id="best"></p></div>
    </section>
    <button class="play" id="play">▶ あそぶ</button>
    <button class="card" id="daily"></button>
    <button class="card" id="bonus"></button>
    <h2>ワールド</h2>
    <div class="rail" id="rail"></div>
  </div>
</div>
<div id="stage" hidden></div>
<div class="sheet-wrap" id="sheet" hidden></div>
<div id="adMock" hidden></div>
<div id="toast" hidden></div>
<script>
${runtime}
</script>
<script>
var APP = ${inlineJson(app)};
var WORLDS = ${inlineJson(worlds)};
var GAME = (${gameSource});
${SCRIPT}
</script>
</body>
</html>
`;
}

module.exports = { appShellHtml };
