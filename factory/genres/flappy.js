'use strict';

// 注意: game 関数は toString() で HTML に埋め込まれる。外側スコープを参照しないこと。

module.exports = {
  id: 'flappy',
  label: 'フライ',
  howto: 'タップではばたいて すきまを くぐろう',
  words: [['フライト', 'flight'], ['パタパタ', 'patapata'], ['スカイ', 'sky']],

  params(r) {
    const gravity = r.range(1150, 1500);
    const hop = r.range(60, 80); // 1回のはばたきで上がる高さ(px)
    const speed = r.range(140, 180);
    return {
      gravity,
      flap: Math.sqrt(2 * gravity * hop),
      speed,
      interval: r.range(220, 260) / speed, // 柱の間隔(px) / 速度
      gap: r.range(170, 200),
      minGap: r.range(135, 150),
      shrink: r.range(0.4, 0.9),
      width: r.range(62, 78),
      coinChance: r.range(0.25, 0.5),
    };
  },

  game: function game(api, P) {
    const T = api.theme;
    const GY = api.H - 70;
    let p;
    let pipes;
    let spawnT;
    let lastCy;
    let scroll;

    return {
      reset() {
        // スタートのタップが最初のはばたきになるよう上向きの初速を与える
        p = { x: 110, y: api.H * 0.42, vy: -P.flap, s: 44 };
        pipes = [];
        spawnT = 0.8;
        lastCy = api.H * 0.45;
        scroll = 0;
      },

      update(dt) {
        scroll += P.speed * dt;
        if (api.input.pressed) {
          p.vy = -P.flap;
          api.sfx('jump');
        }
        p.vy += P.gravity * dt;
        p.y += p.vy * dt;
        if (p.y < 24) {
          p.y = 24;
          p.vy = 0;
        }
        const r = p.s * 0.36;
        if (p.y + r > GY) {
          api.burst(p.x, p.y, T.accent, 20);
          api.gameOver();
          return;
        }

        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = P.interval;
          const gap = Math.max(P.minGap, P.gap - api.time * P.shrink);
          const lo = 120 + gap / 2;
          const hi = GY - 50 - gap / 2;
          const cy = api.clamp(lastCy + api.range(-170, 170), lo, hi);
          lastCy = cy;
          pipes.push({ x: api.W + P.width, cy, gap, passed: false, coin: api.chance(P.coinChance), e: api.pick(T.hazards) });
        }

        const w = P.width;
        for (const q of pipes) {
          q.x -= P.speed * dt;
          const top = q.cy - q.gap / 2;
          const bottom = q.cy + q.gap / 2;
          if (api.circleRect(p.x, p.y, r, q.x - w / 2, -50, w, top + 50) || api.circleRect(p.x, p.y, r, q.x - w / 2, bottom, w, GY - bottom)) {
            api.burst(p.x, p.y, T.accent, 20);
            api.gameOver();
            return;
          }
          if (!q.passed && q.x + w / 2 < p.x) {
            q.passed = true;
            api.addScore(1);
            api.sfx('tap');
          }
          if (q.coin && api.near(p.x, p.y, q.x, q.cy, 36)) {
            q.coin = false;
            api.addScore(2, q.x, q.cy);
            api.sfx('coin');
            api.burst(q.x, q.cy, T.accent, 10);
          }
        }
        pipes = pipes.filter((q) => q.x > -P.width);
      },

      draw(ctx) {
        const w = P.width;
        for (const q of pipes) {
          const top = q.cy - q.gap / 2;
          const bottom = q.cy + q.gap / 2;
          ctx.fillStyle = T.ground;
          ctx.fillRect(q.x - w / 2, 0, w, top);
          ctx.fillRect(q.x - w / 2, bottom, w, GY - bottom);
          ctx.fillStyle = T.accent;
          api.roundRect(ctx, q.x - w / 2 - 6, top - 22, w + 12, 22, 6);
          ctx.fill();
          api.roundRect(ctx, q.x - w / 2 - 6, bottom, w + 12, 22, 6);
          ctx.fill();
          api.emoji(ctx, q.e, q.x, top - 46, 30);
          api.emoji(ctx, q.e, q.x, bottom + 46, 30);
          if (q.coin) api.emoji(ctx, T.goodies[0], q.x, q.cy, 30);
        }
        ctx.fillStyle = T.ground;
        ctx.fillRect(0, GY, api.W, api.H - GY);
        ctx.fillStyle = T.accent;
        ctx.globalAlpha = 0.35;
        for (let x = -(scroll % 40); x < api.W; x += 40) ctx.fillRect(x, GY + 6, 20, 8);
        ctx.globalAlpha = 1;
        api.emoji(ctx, T.player, p.x, p.y, p.s, api.clamp(p.vy / 700, -0.5, 0.9));
      },
    };
  },
};
