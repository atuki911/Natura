'use strict';

// 注意: game 関数は toString() で HTML に埋め込まれる。外側スコープを参照しないこと。

module.exports = {
  id: 'dodger',
  label: 'よけゲー',
  howto: '指でうごかして ふってくるものを よけつづけろ！',
  words: [['サバイバル', 'survival'], ['エスケープ', 'escape'], ['ドッジ', 'dodge']],
  coinRate: 0.1,

  params(r) {
    return {
      speed: r.range(190, 250),
      every: r.range(0.45, 0.65),
      minEvery: r.range(0.16, 0.24),
      drift: r.chance(0.5), // 横にもゆれながら落ちてくる
      freeMove: r.chance(0.5), // 上下にも動ける
      rate: 10, // 1秒あたりのスコア
      bonus: r.int(20, 40),
    };
  },

  game: function game(api, P) {
    const T = api.theme;
    let p;
    let rocks;
    let stars;
    let spawnT;
    let starT;
    let bonus;

    return {
      reset() {
        p = { x: api.W / 2, y: api.H - 100, s: 46 };
        rocks = [];
        stars = [];
        spawnT = 0.6;
        starT = 3;
        bonus = 0;
      },

      // 「つづきから」: 自分の近くにあるものを消して再開
      revive() {
        rocks = rocks.filter((r) => r.y < p.y - 260);
        spawnT = Math.max(spawnT, 1);
      },

      update(dt) {
        const k = Math.min(1, dt * 14);
        p.x += (api.clamp(api.input.x, 24, api.W - 24) - p.x) * k;
        if (P.freeMove) p.y += (api.clamp(api.input.y - 60, api.H * 0.45, api.H - 40) - p.y) * k;

        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = Math.max(P.minEvery, P.every - api.time * 0.008);
          const s = api.range(30, 56);
          rocks.push({
            x: api.range(s / 2, api.W - s / 2),
            y: -s,
            s,
            vx: P.drift ? api.range(-70, 70) : 0,
            vy: P.speed * api.range(0.8, 1.3) * (1 + api.time * 0.015),
            rot: 0,
            vr: api.range(-3, 3),
            e: api.pick(T.hazards),
          });
        }
        starT -= dt;
        if (starT <= 0) {
          starT = api.range(3, 5);
          stars.push({ x: api.range(30, api.W - 30), y: -30, vy: P.speed * 0.7, e: api.pick(T.goodies), dead: false });
        }

        for (const r of rocks) {
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          r.rot += r.vr * dt;
          if (r.x < r.s / 2 || r.x > api.W - r.s / 2) r.vx = -r.vx;
          if (api.near(p.x, p.y, r.x, r.y, r.s * 0.38 + p.s * 0.3)) {
            api.burst(p.x, p.y, T.accent, 24);
            api.gameOver();
            return;
          }
        }
        for (const s of stars) {
          s.y += s.vy * dt;
          if (api.near(p.x, p.y, s.x, s.y, 40)) {
            s.dead = true;
            bonus += P.bonus;
            api.text(s.x, s.y, '+' + P.bonus, T.accent);
            api.sfx('coin');
            api.burst(s.x, s.y, T.accent, 12);
          }
        }
        rocks = rocks.filter((r) => r.y < api.H + 60);
        stars = stars.filter((s) => !s.dead && s.y < api.H + 40);
        api.setScore(Math.floor(api.time * P.rate) + bonus);
      },

      draw(ctx) {
        for (const s of stars) api.emoji(ctx, s.e, s.x, s.y, 32);
        for (const r of rocks) api.emoji(ctx, r.e, r.x, r.y, r.s, r.rot);
        api.emoji(ctx, T.player, p.x, p.y, p.s);
      },
    };
  },
};
