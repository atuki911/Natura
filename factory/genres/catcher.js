'use strict';

// 注意: game 関数は toString() で HTML に埋め込まれる。外側スコープを参照しないこと。

module.exports = {
  id: 'catcher',
  label: 'キャッチ',
  howto: '指でうごかして いいものだけキャッチ！',
  words: [['キャッチ', 'catch'], ['コレクト', 'collect'], ['パラダイス', 'paradise']],

  params(r) {
    return {
      fall: r.range(170, 230),
      every: r.range(0.65, 0.9),
      minEvery: r.range(0.3, 0.4),
      badRatio: r.range(0.22, 0.35),
      follow: r.range(10, 16),
      lives: 3,
      missPenalty: r.chance(0.35), // いいものを落としてもライフが減るモード
    };
  },

  game: function game(api, P) {
    const T = api.theme;
    const PY = api.H - 110;
    let p;
    let items;
    let spawnT;
    let lives;
    let combo;

    function loseLife(x, y) {
      lives--;
      combo = 0;
      api.sfx('hit');
      api.shake(8);
      api.burst(x, y, '#ff4d6d', 14);
      if (lives <= 0) api.gameOver();
    }

    return {
      reset() {
        p = { x: api.W / 2, s: 60 };
        items = [];
        spawnT = 0.5;
        lives = P.lives;
        combo = 0;
      },

      update(dt) {
        p.x += (api.clamp(api.input.x, 30, api.W - 30) - p.x) * Math.min(1, dt * P.follow);

        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = Math.max(P.minEvery, P.every - api.time * 0.006);
          const bad = api.chance(Math.min(0.55, P.badRatio + api.time * 0.002));
          items.push({
            x: api.range(30, api.W - 30),
            y: -30,
            vy: P.fall * (1 + api.time * 0.01) * api.range(0.85, 1.2),
            bad,
            e: api.pick(bad ? T.hazards : T.goodies),
            s: 42,
            rot: api.range(-0.3, 0.3),
            vr: api.range(-2, 2),
            dead: false,
          });
        }

        for (const it of items) {
          it.y += it.vy * dt;
          it.rot += it.vr * dt;
          if (api.overlap(it.x, it.y, it.s * 0.7, it.s * 0.7, p.x, PY, p.s * 0.9, p.s * 0.6)) {
            it.dead = true;
            if (it.bad) {
              loseLife(it.x, it.y);
            } else {
              combo++;
              const pts = 1 + Math.floor(combo / 5);
              api.addScore(pts, it.x, it.y);
              api.sfx('coin');
              api.burst(it.x, it.y, T.accent, 10);
            }
          } else if (it.y > api.H + 30) {
            it.dead = true;
            if (!it.bad) {
              combo = 0;
              if (P.missPenalty) loseLife(it.x, api.H - 20);
            }
          }
          if (lives <= 0) return;
        }
        items = items.filter((it) => !it.dead);
      },

      draw(ctx) {
        for (const it of items) api.emoji(ctx, it.e, it.x, it.y, it.s, it.rot);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(p.x, PY + p.s * 0.45, p.s * 0.45, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        api.emoji(ctx, T.player, p.x, PY, p.s);
        for (let i = 0; i < lives; i++) api.emoji(ctx, '❤️', 22 + i * 26, 30, 22);
        if (combo >= 3) {
          ctx.fillStyle = T.accent;
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(combo + ' コンボ!', p.x, PY - 50);
        }
      },
    };
  },
};
