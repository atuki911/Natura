'use strict';

// 注意: game 関数は toString() で HTML に埋め込まれる。
// 関数の外（このファイルのスコープ）の変数を参照してはいけない。api と P だけを使うこと。

module.exports = {
  id: 'runner',
  label: 'ランナー',
  howto: 'タップでジャンプ！障害物をとびこえよう',
  words: [['ダッシュ', 'dash'], ['ラン', 'run'], ['ジャンプ', 'jump']],

  params(r) {
    const gravity = r.range(1900, 2600);
    const apex = r.range(130, 160); // ジャンプの最高到達点(px)。2段積みの障害物(80px)を越えられる高さを保証
    return {
      gravity,
      jump: Math.sqrt(2 * gravity * apex),
      speed: r.range(220, 290),
      accel: r.range(3, 8),
      maxJumps: r.chance(0.4) ? 2 : 1,
      tallChance: r.range(0.15, 0.35),
      coinChance: r.range(0.3, 0.6),
    };
  },

  game: function game(api, P) {
    const T = api.theme;
    const GY = api.H - 130;
    const air = (2 * P.jump) / P.gravity; // 1回のジャンプの滞空時間
    let p;
    let obs;
    let coins;
    let spawnT;
    let speed;
    let scroll;

    return {
      reset() {
        p = { x: 84, y: GY, vy: 0, jumps: 0, s: 48 };
        obs = [];
        coins = [];
        spawnT = 1.2;
        speed = P.speed;
        scroll = 0;
      },

      update(dt) {
        speed += P.accel * dt;
        scroll += speed * dt;
        if (api.input.pressed && p.jumps < P.maxJumps) {
          p.vy = -P.jump;
          p.jumps++;
          api.sfx('jump');
        }
        p.vy += P.gravity * dt;
        p.y += p.vy * dt;
        if (p.y >= GY) {
          p.y = GY;
          p.vy = 0;
          p.jumps = 0;
        }

        spawnT -= dt;
        if (spawnT <= 0) {
          const tall = api.time > 8 && api.chance(P.tallChance);
          const s = tall ? 40 : api.range(36, 52);
          const o = { x: api.W + 40, w: s, h: tall ? 80 : s, e: api.pick(T.hazards), tall, passed: false };
          obs.push(o);
          if (api.chance(P.coinChance)) {
            coins.push({ x: o.x + api.range(110, 170), y: GY - api.range(40, 120), e: api.pick(T.goodies), dead: false });
          }
          spawnT = Math.max(air * 1.15, api.range(air * 1.35, air * 2.6) - api.time * 0.01);
        }

        const px = p.x;
        const py = p.y - p.s / 2;
        for (const o of obs) {
          o.x -= speed * dt;
          if (api.overlap(px, py, p.s * 0.55, p.s * 0.7, o.x, GY - o.h / 2, o.w * 0.7, o.h * 0.85)) {
            api.burst(px, py, T.accent, 20);
            api.gameOver();
            return;
          }
          if (!o.passed && o.x < px) {
            o.passed = true;
            api.addScore(1);
          }
        }
        for (const c of coins) {
          c.x -= speed * dt;
          if (!c.dead && api.near(px, py, c.x, c.y, 34)) {
            c.dead = true;
            api.addScore(3, c.x, c.y);
            api.sfx('coin');
            api.burst(c.x, c.y, T.accent, 10);
          }
        }
        obs = obs.filter((o) => o.x > -80);
        coins = coins.filter((c) => !c.dead && c.x > -40);
      },

      draw(ctx) {
        ctx.fillStyle = T.ground;
        ctx.fillRect(0, GY, api.W, api.H - GY);
        ctx.fillStyle = T.accent;
        ctx.fillRect(0, GY, api.W, 4);
        ctx.globalAlpha = 0.25;
        for (let x = -(scroll % 60); x < api.W; x += 60) ctx.fillRect(x, GY + 24, 28, 6);
        ctx.globalAlpha = 1;

        for (const c of coins) api.emoji(ctx, c.e, c.x, c.y + Math.sin(c.x / 20) * 4, 30);
        for (const o of obs) {
          if (o.tall) {
            api.emoji(ctx, o.e, o.x, GY - 20, 40);
            api.emoji(ctx, o.e, o.x, GY - 60, 40);
          } else {
            api.emoji(ctx, o.e, o.x, GY - o.h / 2, o.w);
          }
        }
        const onGround = p.y >= GY;
        const bob = onGround ? Math.abs(Math.sin(api.time * 18)) * -4 : 0;
        const rot = onGround ? 0 : api.clamp(p.vy / 2000, -0.35, 0.35);
        api.emoji(ctx, T.player, p.x, p.y - p.s / 2 + bob, p.s, rot);
      },
    };
  },
};
