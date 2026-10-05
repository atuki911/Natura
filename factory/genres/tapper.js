'use strict';

// 注意: game 関数は toString() で HTML に埋め込まれる。外側スコープを参照しないこと。

module.exports = {
  id: 'tapper',
  label: 'タップ',
  howto: 'でてきた なかまをタップ！ てきは さわるな',
  words: [['タップ', 'tap'], ['ポップ', 'pop'], ['パニック', 'panic']],
  coinRate: 1,

  params(r) {
    return {
      life: r.range(1.1, 1.5),
      minLife: r.range(0.55, 0.7),
      every: r.range(0.65, 0.85),
      minEvery: r.range(0.3, 0.38),
      badRatio: r.range(0.18, 0.3),
      lives: 3,
      cols: 3,
      rows: r.chance(0.5) ? 4 : 3,
    };
  },

  game: function game(api, P) {
    const T = api.theme;
    const n = P.cols * P.rows;
    const top = 170;
    const cellW = api.W / P.cols;
    const cellH = (api.H - top - 70) / P.rows;
    let holes;
    let spawnT;
    let lives;

    function center(i) {
      return { x: cellW * ((i % P.cols) + 0.5), y: top + cellH * (Math.floor(i / P.cols) + 0.5) };
    }

    function spawn() {
      const free = [];
      for (let i = 0; i < n; i++) if (!holes[i]) free.push(i);
      if (!free.length) return;
      const bad = api.chance(P.badRatio);
      holes[api.pick(free)] = { e: api.pick(bad ? T.hazards : T.goodies), bad, t: 0, life: Math.max(P.minLife, P.life - api.time * 0.008) };
    }

    function loseLife(x, y) {
      lives--;
      api.sfx('hit');
      api.shake(8);
      api.burst(x, y, '#ff4d6d', 14);
      if (lives <= 0) api.gameOver();
    }

    return {
      reset() {
        holes = new Array(n).fill(null);
        spawnT = 0.4;
        lives = P.lives;
      },

      // 「つづきから」: ライフ1で、穴を空にして再開
      revive() {
        holes = new Array(n).fill(null);
        lives = 1;
        spawnT = 1;
      },

      update(dt) {
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = Math.max(P.minEvery, P.every - api.time * 0.01);
          spawn();
          if (api.chance(Math.min(0.5, api.time * 0.01))) spawn();
        }

        if (api.input.pressed) {
          for (let i = 0; i < n; i++) {
            const h = holes[i];
            if (!h) continue;
            const c = center(i);
            if (!api.near(api.input.x, api.input.y, c.x, c.y, Math.min(cellW, cellH) * 0.45)) continue;
            holes[i] = null;
            if (h.bad) {
              loseLife(c.x, c.y);
            } else {
              const pts = h.t < h.life * 0.4 ? 2 : 1;
              api.addScore(pts, c.x, c.y - 30);
              api.sfx('coin');
              api.burst(c.x, c.y, T.accent, 12);
            }
            break;
          }
          if (lives <= 0) return;
        }

        for (let i = 0; i < n; i++) {
          const h = holes[i];
          if (!h) continue;
          h.t += dt;
          if (h.t >= h.life) {
            holes[i] = null;
            if (!h.bad) {
              const c = center(i);
              loseLife(c.x, c.y);
              if (lives <= 0) return;
            }
          }
        }
      },

      draw(ctx) {
        const r = Math.min(cellW, cellH) * 0.4;
        for (let i = 0; i < n; i++) {
          const c = center(i);
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath();
          ctx.ellipse(c.x, c.y + r * 0.55, r * 0.95, r * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
          const h = holes[i];
          if (!h) continue;
          const pop = Math.min(1, h.t / 0.12);
          const fade = Math.min(1, (h.life - h.t) / 0.15);
          const size = r * 1.5 * pop * Math.max(0.3, fade);
          if (!h.bad) {
            ctx.strokeStyle = T.accent;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r * 0.95, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - h.t / h.life));
            ctx.stroke();
          }
          api.emoji(ctx, h.e, c.x, c.y, size);
        }
        for (let i = 0; i < lives; i++) api.emoji(ctx, '❤️', 22 + i * 26, 30, 22);
      },
    };
  },
};
