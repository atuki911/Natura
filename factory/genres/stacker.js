'use strict';

// 注意: game 関数は toString() で HTML に埋め込まれる。外側スコープを参照しないこと。

module.exports = {
  id: 'stacker',
  label: 'スタック',
  howto: 'タップでブロックをおとして 高くつみあげよう',
  words: [['タワー', 'tower'], ['スタック', 'stack'], ['つみつみ', 'tsumitsumi']],

  params(r) {
    return {
      h: r.range(30, 38),
      width: r.range(180, 220),
      speed: r.range(160, 220),
      speedUp: r.range(3, 6),
      maxSpeed: r.range(380, 460),
      perfect: r.range(5, 8), // この誤差(px)以内ならパーフェクト（削れない）
    };
  },

  game: function game(api, P) {
    const T = api.theme;
    const baseY = api.H - 90;
    let blocks;
    let cur;
    let falling;
    let camY;
    let speed;
    let combo;

    function spawnNext() {
      const top = blocks[blocks.length - 1];
      const fromLeft = blocks.length % 2 === 0;
      cur = { x: fromLeft ? -top.w : api.W, w: top.w, y: top.y - P.h, dir: fromLeft ? 1 : -1 };
      speed = Math.min(P.maxSpeed, P.speed + blocks.length * P.speedUp);
    }

    function block(ctx, b, i) {
      ctx.fillStyle = T.palette[i % T.palette.length];
      api.roundRect(ctx, b.x, b.y, b.w, P.h, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(b.x + 4, b.y + 3, Math.max(0, b.w - 8), 4);
    }

    return {
      reset() {
        blocks = [{ x: api.W / 2 - P.width / 2, w: P.width, y: baseY - P.h }];
        falling = [];
        camY = 0;
        combo = 0;
        spawnNext();
      },

      update(dt) {
        cur.x += cur.dir * speed * dt;
        if (cur.dir < 0 && cur.x < -cur.w * 0.5) cur.dir = 1;
        if (cur.dir > 0 && cur.x + cur.w * 0.5 > api.W) cur.dir = -1;

        if (api.input.pressed) {
          const top = blocks[blocks.length - 1];
          const l = Math.max(cur.x, top.x);
          const r = Math.min(cur.x + cur.w, top.x + top.w);
          if (r - l <= 0) {
            falling.push({ x: cur.x, y: cur.y, w: cur.w, vy: 0, rot: 0, vr: api.range(-3, 3), i: blocks.length });
            api.gameOver();
            return;
          }
          if (Math.abs(cur.x - top.x) <= P.perfect) {
            combo++;
            blocks.push({ x: top.x, w: top.w, y: cur.y });
            api.addScore(2, api.W / 2, cur.y + camY - 10);
            api.sfx('perfect');
            api.burst(top.x + top.w / 2, cur.y + camY + P.h / 2, T.accent, 16);
          } else {
            combo = 0;
            const cut = cur.x < top.x ? { x: cur.x, w: top.x - cur.x } : { x: r, w: cur.x + cur.w - r };
            falling.push({ x: cut.x, y: cur.y, w: cut.w, vy: 0, rot: 0, vr: api.range(-3, 3), i: blocks.length });
            blocks.push({ x: l, w: r - l, y: cur.y });
            api.addScore(1);
            api.sfx('tap');
          }
          spawnNext();
        }

        const target = Math.max(0, api.H * 0.38 - cur.y);
        camY += (target - camY) * Math.min(1, dt * 5);

        for (const f of falling) {
          f.vy += 1500 * dt;
          f.y += f.vy * dt;
          f.rot += f.vr * dt;
        }
        falling = falling.filter((f) => f.y + camY < api.H + 100);
      },

      draw(ctx) {
        ctx.save();
        ctx.translate(0, camY);
        ctx.fillStyle = T.ground;
        ctx.fillRect(-20, baseY, api.W + 40, api.H + 200);
        const first = Math.max(0, blocks.length - 40);
        for (let i = first; i < blocks.length; i++) block(ctx, blocks[i], i);
        for (const f of falling) {
          ctx.save();
          ctx.translate(f.x + f.w / 2, f.y + P.h / 2);
          ctx.rotate(f.rot);
          block(ctx, { x: -f.w / 2, y: -P.h / 2, w: f.w }, f.i);
          ctx.restore();
        }
        if (cur) {
          block(ctx, cur, blocks.length);
          api.emoji(ctx, T.player, cur.x + cur.w / 2, cur.y - 18, 34);
        }
        ctx.restore();
        if (combo >= 2) {
          ctx.fillStyle = T.accent;
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('パーフェクト x' + combo, api.W / 2, 120);
        }
      },
    };
  },
};
