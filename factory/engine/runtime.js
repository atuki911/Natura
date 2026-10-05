/*
 * Natura Engine — 全ゲーム共通ランタイム
 *
 * ブラウザでは生成された HTML にインライン展開され window.NaturaEngine になる。
 * Node では require() でき、テストや工場側から createCore / mulberry32 を使う。
 *
 * 収益化フック（すべて任意。指定しなければ従来どおり）:
 *   opts.rewardFor(score)        → そのスコアで手に入るコイン数
 *   opts.canRevive(core)         → 「つづきから」を出すか（1プレイ1回まで。ゲーム側に revive() が必要）
 *   opts.reviveLabel             → つづきからボタンの文言
 *   opts.onRevive(done)          → リワード広告などを出し、done(true) で復活
 *   opts.beforeRestart(done)     → リトライ前（インタースティシャル広告など）。done() で開始
 *   opts.onGameOver(score, coins) → coins はこの回で新たに増えた分（復活後の二重計上なし）
 *
 * ゲーム本体（ジャンル）は GAME(api, params) =>{ reset(), update(dt), draw(ctx) } を返す関数。
 * 論理解像度は 360x640（縦持ち）。画面サイズに合わせて自動スケールする。
 */
(function (root) {
  'use strict';

  var W = 360;
  var H = 640;
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  var UI_FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // ---------------------------------------------------------------- core

  function createCore(cfg, GAME, opts) {
    opts = opts || {};
    var rand = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 4294967296) >>> 0);
    var theme = cfg.theme;
    var sfx = opts.sfx || function () {};
    var store = opts.storage || null;
    var bestKey = 'natura:' + cfg.id + ':best';
    var best = 0;
    try {
      best = Number(store && store.getItem(bestKey)) || 0;
    } catch (e) {
      best = 0;
    }

    var input = { x: W / 2, y: H * 0.75, down: false, pressed: false, released: false };
    var particles = [];
    var floaters = [];
    var shakeMag = 0;
    var core = {
      state: 'title',
      score: 0,
      best: best,
      newBest: false,
      time: 0,
      stateTime: 0,
      plays: 0,
      input: input,
      revived: false,
      reviveOffered: false,
      runReward: 0,
      reward: 0,
    };

    function range(a, b) {
      return a + (b - a) * rand();
    }

    var api = {
      W: W,
      H: H,
      cfg: cfg,
      theme: theme,
      P: cfg.params,
      input: input,
      rand: rand,
      range: range,
      int: function (a, b) {
        return Math.floor(a + (b - a + 1) * rand());
      },
      pick: function (arr) {
        return arr[Math.floor(rand() * arr.length)];
      },
      chance: function (p) {
        return rand() < p;
      },
      clamp: clamp,
      lerp: function (a, b, t) {
        return a + (b - a) * t;
      },
      get time() {
        return core.time;
      },
      get score() {
        return core.score;
      },
      addScore: function (n, x, y) {
        core.score += n;
        if (x != null) floaters.push({ x: x, y: y, text: '+' + n, life: 0.8, color: theme.fg });
      },
      setScore: function (n) {
        core.score = n;
      },
      text: function (x, y, text, color) {
        floaters.push({ x: x, y: y, text: text, life: 0.9, color: color || theme.fg });
      },
      gameOver: function () {
        if (core.state !== 'play') return;
        core.state = 'over';
        core.stateTime = 0;
        sfx('hit');
        shakeMag = Math.max(shakeMag, 12);
        var total = opts.rewardFor ? Math.max(0, Math.floor(opts.rewardFor(core.score)) || 0) : 0;
        core.reward = Math.max(0, total - core.runReward);
        core.runReward = Math.max(core.runReward, total);
        core.reviveOffered = !core.revived && typeof game.revive === 'function' && !!(opts.canRevive && opts.canRevive(core));
        if (core.score > core.best) {
          core.best = core.score;
          core.newBest = true;
          try {
            if (store) store.setItem(bestKey, String(core.best));
          } catch (e) {
            /* storage unavailable */
          }
        }
        if (opts.onGameOver) opts.onGameOver(core.score, core.reward);
      },
      sfx: function (name) {
        sfx(name);
      },
      shake: function (mag) {
        shakeMag = Math.max(shakeMag, mag);
      },
      burst: function (x, y, color, n) {
        n = n || 12;
        for (var i = 0; i < n; i++) {
          var a = rand() * Math.PI * 2;
          var sp = range(60, 260);
          var life = range(0.35, 0.8);
          particles.push({
            x: x,
            y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 60,
            life: life,
            max: life,
            size: range(3, 7),
            color: color || theme.accent,
          });
        }
      },
      emoji: function (ctx, ch, x, y, size, rot) {
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        ctx.font = Math.round(size) + 'px ' + EMOJI_FONT;
        ctx.fillStyle = '#000'; // 半透明の fillStyle が残っているとカラー絵文字まで薄くなるため
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, 0, size * 0.06);
        ctx.restore();
      },
      // 中心座標 + 幅高さの矩形同士
      overlap: function (ax, ay, aw, ah, bx, by, bw, bh) {
        return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
      },
      near: function (ax, ay, bx, by, r) {
        var dx = ax - bx;
        var dy = ay - by;
        return dx * dx + dy * dy < r * r;
      },
      // 円 と 左上基準の矩形
      circleRect: function (cx, cy, r, x, y, w, h) {
        var nx = clamp(cx, x, x + w);
        var ny = clamp(cy, y, y + h);
        var dx = cx - nx;
        var dy = cy - ny;
        return dx * dx + dy * dy < r * r;
      },
      roundRect: function (ctx, x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      },
    };

    var game = GAME(api, cfg.params);
    game.reset();

    var deco = [];
    for (var i = 0; i < 9; i++) {
      deco.push({ x: range(0, W), y: range(0, H), s: range(14, 30), v: range(8, 26), a: range(0.12, 0.3) });
    }

    function startPlay() {
      core.state = 'play';
      core.score = 0;
      core.time = 0;
      core.stateTime = 0;
      core.newBest = false;
      core.revived = false;
      core.reviveOffered = false;
      core.runReward = 0;
      core.reward = 0;
      core.plays++;
      particles.length = 0;
      floaters.length = 0;
      game.reset();
      sfx('start');
    }

    function revive() {
      core.state = 'play';
      core.stateTime = 0;
      core.revived = true;
      core.reviveOffered = false;
      game.revive();
      sfx('start');
    }

    function requestRevive() {
      core.state = 'wait';
      var called = false;
      opts.onRevive(function (ok) {
        if (called) return;
        called = true;
        if (ok) revive();
        else {
          core.state = 'over';
          core.reviveOffered = false;
        }
      });
    }

    function requestRestart() {
      if (!opts.beforeRestart) return startPlay();
      core.state = 'wait';
      var called = false;
      opts.beforeRestart(function () {
        if (called) return;
        called = true;
        startPlay();
      });
    }

    // ゲームオーバー画面のボタン位置（論理座標）
    var BTN_REVIVE = 420;
    var BTN_RETRY_WITH_REVIVE = 488;
    var BTN_RETRY = 420;

    function update(dt) {
      core.stateTime += dt;
      for (var i = 0; i < deco.length; i++) {
        var d = deco[i];
        d.y += d.v * dt;
        if (d.y > H + 30) {
          d.y = -30;
          d.x = range(0, W);
        }
      }

      if (core.state === 'title') {
        if (input.pressed) startPlay();
      } else if (core.state === 'play') {
        core.time += dt;
        game.update(dt);
      } else if (core.state === 'over') {
        if (input.pressed && core.stateTime > 0.6) {
          if (!core.reviveOffered) requestRestart();
          else if (Math.abs(input.y - BTN_REVIVE) < 32 && opts.onRevive) requestRevive();
          else if (Math.abs(input.y - BTN_RETRY_WITH_REVIVE) < 30) requestRestart();
        }
      }

      for (var j = particles.length - 1; j >= 0; j--) {
        var p = particles[j];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(j, 1);
          continue;
        }
        p.vy += 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (var k = floaters.length - 1; k >= 0; k--) {
        var f = floaters[k];
        f.life -= dt;
        f.y -= 50 * dt;
        if (f.life <= 0) floaters.splice(k, 1);
      }
      shakeMag = Math.max(0, shakeMag - 40 * dt);
      input.pressed = false;
      input.released = false;
    }

    var bgCache = null;
    var bgCtx = null;

    function fitText(ctx, text, size, maxW, weight) {
      var s = size;
      do {
        ctx.font = (weight || 'bold') + ' ' + s + 'px ' + UI_FONT;
        if (ctx.measureText(text).width <= maxW) break;
        s -= 2;
      } while (s > 12);
      return s;
    }

    function label(ctx, text, x, y, size, color, weight) {
      var s = fitText(ctx, text, size, W - 40, weight);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, s * 0.14);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color || '#fff';
      ctx.fillText(text, x, y);
    }

    function panel(ctx, y, h) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = theme.panel || 'rgba(255,255,255,0.92)';
      api.roundRect(ctx, 24, y, W - 48, h, 22);
      ctx.fill();
    }

    // 点滅する押しボタン風ラベル（パネルの白地でも読めるよう、テーマの濃い色で塗る）
    function cta(ctx, text, y, t, style) {
      var pulse = style === 'quiet' ? 1 : 1 + Math.sin(t * 5) * 0.04;
      ctx.save();
      ctx.translate(W / 2, y);
      ctx.scale(pulse, pulse);
      api.roundRect(ctx, -120, -26, 240, 52, 26);
      if (style === 'quiet') {
        ctx.lineWidth = 3;
        ctx.strokeStyle = theme.bg2;
        ctx.stroke();
      } else {
        ctx.fillStyle = style === 'gold' ? '#e85d04' : theme.bg2;
        ctx.fill();
      }
      fitText(ctx, text, 22, 210);
      ctx.fillStyle = style === 'quiet' ? theme.bg2 : '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 1);
      ctx.restore();
    }

    function draw(ctx) {
      if (bgCtx !== ctx) {
        bgCtx = ctx;
        bgCache = ctx.createLinearGradient(0, 0, 0, H);
        bgCache.addColorStop(0, theme.bg1);
        bgCache.addColorStop(1, theme.bg2);
      }
      ctx.fillStyle = bgCache;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      for (var i = 0; i < deco.length; i++) {
        ctx.globalAlpha = deco[i].a;
        api.emoji(ctx, theme.deco, deco[i].x, deco[i].y, deco[i].s);
      }
      ctx.restore();

      ctx.save();
      if (shakeMag > 0) ctx.translate((rand() - 0.5) * shakeMag, (rand() - 0.5) * shakeMag);
      game.draw(ctx);
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (var k = 0; k < floaters.length; k++) {
        var f = floaters[k];
        ctx.globalAlpha = Math.min(1, f.life * 2);
        label(ctx, f.text, f.x, f.y, 22, f.color);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      var t = core.stateTime;
      if (core.state === 'play') {
        label(ctx, String(core.score), W / 2, 50, 44, '#fff');
        label(ctx, 'BEST ' + core.best, W / 2, 84, 14, 'rgba(255,255,255,0.85)');
      } else if (core.state === 'title') {
        panel(ctx, 110, 400);
        api.emoji(ctx, theme.player, W / 2, 200 + Math.sin(t * 3) * 8, 84);
        ctx.fillStyle = theme.ink;
        fitText(ctx, cfg.title, 34, W - 80);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.title, W / 2, 290);
        fitText(ctx, cfg.genreLabel + ' × ' + theme.label, 15, W - 80, 'normal');
        ctx.fillStyle = theme.inkSoft;
        ctx.fillText(cfg.genreLabel + ' × ' + theme.label, W / 2, 324);
        fitText(ctx, cfg.howto, 16, W - 80, 'normal');
        ctx.fillStyle = theme.ink;
        ctx.fillText(cfg.howto, W / 2, 372);
        if (core.best > 0) {
          fitText(ctx, 'ベスト ' + core.best, 15, W - 80, 'normal');
          ctx.fillStyle = theme.inkSoft;
          ctx.fillText('ベスト ' + core.best, W / 2, 404);
        }
        cta(ctx, 'タップでスタート', 456, t);
      } else if (core.state === 'over' || core.state === 'wait') {
        var offer = core.reviveOffered;
        panel(ctx, 140, offer ? 390 : 320);
        ctx.fillStyle = theme.ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(ctx, 'ゲームオーバー', 30, W - 80);
        ctx.fillText('ゲームオーバー', W / 2, 186);
        fitText(ctx, String(core.score), 68, W - 80);
        ctx.fillText(String(core.score), W / 2, 256);
        fitText(ctx, 'ベスト ' + core.best, 18, W - 80, 'normal');
        ctx.fillStyle = theme.inkSoft;
        ctx.fillText('ベスト ' + core.best, W / 2, 306);
        var notes = [];
        if (core.newBest) notes.push('★ 新記録！');
        if (core.runReward > 0) notes.push('🪙 +' + core.runReward);
        if (notes.length) {
          fitText(ctx, notes.join('   '), 20, W - 80);
          ctx.fillStyle = '#e85d04';
          ctx.fillText(notes.join('   '), W / 2, 346);
        }
        if (core.state === 'wait') {
          fitText(ctx, 'よみこみ中…', 18, W - 80, 'normal');
          ctx.fillStyle = theme.inkSoft;
          ctx.fillText('よみこみ中…', W / 2, BTN_REVIVE);
        } else if (t > 0.6) {
          if (offer) {
            cta(ctx, opts.reviveLabel || '▶ つづきから', BTN_REVIVE, t, 'gold');
            cta(ctx, 'リトライ', BTN_RETRY_WITH_REVIVE, t, 'quiet');
          } else {
            cta(ctx, 'タップでリトライ', BTN_RETRY, t);
          }
        }
      }
    }

    core.update = update;
    core.draw = draw;
    core.api = api;
    core.game = game;
    return core;
  }

  // --------------------------------------------------------------- audio

  var sharedAC = null; // ブラウザは AudioContext の数に上限があるので全ゲームで 1 つを共有する

  function createAudio(cfg) {
    var muted = false;
    var pitch = (cfg.sound && cfg.sound.pitch) || 1;
    var wave = (cfg.sound && cfg.sound.wave) || 'triangle';
    // [開始Hz, 長さ秒, 波形, 終了Hz]
    var SFX = {
      jump: [520, 0.09, wave, 820],
      coin: [880, 0.1, 'square', 1320],
      tap: [660, 0.05, 'sine', 720],
      perfect: [990, 0.16, wave, 1760],
      hit: [220, 0.28, 'sawtooth', 60],
      start: [440, 0.14, wave, 880],
    };
    try {
      muted = root.localStorage && root.localStorage.getItem('natura:muted') === '1';
    } catch (e) {
      muted = false;
    }

    return {
      unlock: function () {
        if (sharedAC) {
          if (sharedAC.state === 'suspended') sharedAC.resume();
          return;
        }
        var AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        try {
          sharedAC = new AC();
        } catch (e) {
          sharedAC = null;
        }
      },
      play: function (name) {
        var ac = sharedAC;
        if (!ac || muted) return;
        var s = SFX[name];
        if (!s) return;
        var t = ac.currentTime;
        var o = ac.createOscillator();
        var g = ac.createGain();
        o.type = s[2];
        o.frequency.setValueAtTime(s[0] * pitch, t);
        o.frequency.exponentialRampToValueAtTime(s[3] * pitch, t + s[1]);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + s[1]);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t);
        o.stop(t + s[1] + 0.02);
      },
      toggle: function () {
        muted = !muted;
        try {
          root.localStorage.setItem('natura:muted', muted ? '1' : '0');
        } catch (e) {
          /* ignore */
        }
        return muted;
      },
      isMuted: function () {
        return muted;
      },
    };
  }

  // ------------------------------------------------------------- browser

  // opts.serviceWorker: false でオフライン用 Service Worker を登録しない（1ファイル版アーケードなど）
  // opts には createCore の収益化フック（rewardFor / canRevive / onRevive / beforeRestart / onGameOver）も渡せる
  // 戻り値の core.stop() でループとイベントを止められる（同じページで別のゲームに切り替えるとき用）
  function start(cfg, GAME, opts) {
    opts = opts || {};
    var doc = root.document;
    var winListeners = [];
    function listen(type, fn) {
      root.addEventListener(type, fn);
      winListeners.push([type, fn]);
    }
    var canvas = doc.getElementById('game');
    var ctx = canvas.getContext('2d');
    var audio = createAudio(cfg);
    var storage = null;
    try {
      storage = root.localStorage;
    } catch (e) {
      storage = null;
    }
    var core = createCore(cfg, GAME, {
      storage: storage,
      sfx: audio.play,
      rewardFor: opts.rewardFor,
      canRevive: opts.canRevive,
      reviveLabel: opts.reviveLabel,
      onRevive: opts.onRevive,
      beforeRestart: opts.beforeRestart,
      onGameOver: function (score, coins) {
        try {
          if (root.navigator.vibrate) root.navigator.vibrate(60);
        } catch (e) {
          /* ignore */
        }
        if (opts.onGameOver) opts.onGameOver(score, coins);
      },
    });
    var input = core.input;
    var scale = 1;
    var dpr = 1;

    function resize() {
      dpr = Math.min(root.devicePixelRatio || 1, 3);
      scale = Math.min(root.innerWidth / W, root.innerHeight / H);
      canvas.style.width = W * scale + 'px';
      canvas.style.height = H * scale + 'px';
      canvas.width = Math.round(W * scale * dpr);
      canvas.height = Math.round(H * scale * dpr);
    }
    listen('resize', resize);
    resize();

    function locate(e) {
      var r = canvas.getBoundingClientRect();
      input.x = ((e.clientX - r.left) / r.width) * W;
      input.y = ((e.clientY - r.top) / r.height) * H;
    }
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      locate(e);
      input.down = true;
      input.pressed = true;
      audio.unlock();
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
    });
    canvas.addEventListener('pointermove', function (e) {
      locate(e);
    });
    function release() {
      input.down = false;
      input.released = true;
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
    listen('keydown', function (e) {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
        e.preventDefault();
        input.down = true;
        input.pressed = true;
        audio.unlock();
      } else if (e.code === 'ArrowLeft') {
        input.x = clamp(input.x - 60, 0, W);
      } else if (e.code === 'ArrowRight') {
        input.x = clamp(input.x + 60, 0, W);
      }
    });
    listen('keyup', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') release();
    });

    var mute = doc.getElementById('mute');
    if (mute) {
      var paint = function () {
        mute.textContent = audio.isMuted() ? '🔇' : '🔊';
      };
      paint();
      mute.addEventListener('click', function (e) {
        e.stopPropagation();
        audio.toggle();
        paint();
      });
    }

    var last = root.performance.now();
    var rafId = 0;
    function frame(now) {
      var dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      core.update(dt);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      core.draw(ctx);
      rafId = root.requestAnimationFrame(frame);
    }
    function onVisibility() {
      last = root.performance.now();
    }
    doc.addEventListener('visibilitychange', onVisibility);
    rafId = root.requestAnimationFrame(frame);

    core.stop = function () {
      root.cancelAnimationFrame(rafId);
      doc.removeEventListener('visibilitychange', onVisibility);
      for (var i = 0; i < winListeners.length; i++) root.removeEventListener(winListeners[i][0], winListeners[i][1]);
      winListeners.length = 0;
    };

    if (opts.serviceWorker !== false && 'serviceWorker' in root.navigator && /^(https:|http:\/\/(localhost|127\.0\.0\.1))/.test(root.location.href)) {
      root.navigator.serviceWorker.register('sw.js').catch(function () {});
    }

    root.__natura = core;
    return core;
  }

  var NaturaEngine = { W: W, H: H, start: start, createCore: createCore, mulberry32: mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = NaturaEngine;
  else root.NaturaEngine = NaturaEngine;
})(typeof window !== 'undefined' ? window : globalThis);
