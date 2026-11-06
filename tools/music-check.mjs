// 音楽を耳なしで確かめる: 各曲を OfflineAudioContext に描き出し、数字で調べる。
//   - 無音でない(RMS)・割れていない(ピーク < 0.95)
//   - リズムがある(拍の長さで音量の山がくり返す = 拍の自己相関が高い、16分ごとの音量がばらつく)
//   - 例外が出ない
// さらにゲームを実際に動かして、曲が切り替わること・ブラウザのエラーが出ないことを確かめる。
// 使い方: node tools/music-check.mjs [秒数=20]

import { createRequire } from 'node:module';
import { createServer } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const seconds = Number(process.argv[2] ?? 20);

const server = await createServer({ server: { port: 5198, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

await page.goto(`${base}?map`);
await page.waitForTimeout(1500);

const results = await page.evaluate(async (seconds) => {
  const mod = await import('/src/render/music.ts');
  const out = [];
  for (const name of Object.keys(mod.TRACKS)) {
    const track = mod.TRACKS[name];
    const stinger = track.loop === false;
    const sr = 44100;
    const len = stinger ? 8 : seconds;
    try {
      const ctx = new OfflineAudioContext(2, sr * len, sr);
      const t0 = performance.now();
      mod.renderTrack(ctx, ctx.destination, name, len);
      const buf = await ctx.startRendering();
      const ms = performance.now() - t0;
      const L = buf.getChannelData(0);
      const R = buf.getChannelData(1);
      let peak = 0;
      let sum = 0;
      for (let i = 0; i < L.length; i++) {
        peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
        sum += L[i] * L[i] + R[i] * R[i];
      }
      const rms = Math.sqrt(sum / (2 * L.length));
      // 10ms ごとの音量の包絡と、その増え方(音の立ち上がり)
      const win = Math.floor(sr * 0.01);
      const env = [];
      for (let i = 0; i + win <= L.length; i += win) {
        let s = 0;
        for (let j = i; j < i + win; j++) s += L[j] * L[j] + R[j] * R[j];
        env.push(Math.sqrt(s / (2 * win)));
      }
      const onset = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? 0)));
      const mean = onset.reduce((a, b) => a + b, 0) / onset.length;
      const centered = onset.map((v) => v - mean);
      const ac = (lag) => {
        let num = 0;
        let den = 0;
        for (let i = 0; i < centered.length; i++) {
          den += centered[i] * centered[i];
          if (i + lag < centered.length) num += centered[i] * centered[i + lag];
        }
        return num / den;
      };
      const beatSec = 60 / track.bpm;
      const beatLag = Math.round(beatSec / 0.01);
      const offLag = Math.round((beatSec * 0.37) / 0.01);
      // 16分ごとの RMS のばらつき(変動係数)
      const stepWin = Math.floor((sr * beatSec) / 4);
      const steps = [];
      for (let i = Math.floor(sr * 0.05); i + stepWin <= L.length; i += stepWin) {
        let s = 0;
        for (let j = i; j < i + stepWin; j++) s += L[j] * L[j];
        steps.push(Math.sqrt(s / stepWin));
      }
      const sm = steps.reduce((a, b) => a + b, 0) / steps.length;
      const cv = Math.sqrt(steps.reduce((a, b) => a + (b - sm) ** 2, 0) / steps.length) / sm;
      // 1秒ごとの RMS(途中で黙り込んでいないか)
      const perSec = [];
      for (let s = 0; s < len; s++) {
        let x = 0;
        for (let i = s * sr; i < (s + 1) * sr; i++) x += L[i] * L[i];
        perSec.push(Math.sqrt(x / sr));
      }
      out.push({
        name,
        bpm: track.bpm,
        seconds: len,
        renderMs: Math.round(ms),
        peak: +peak.toFixed(3),
        rms: +rms.toFixed(4),
        beatAC: +ac(beatLag).toFixed(3),
        offAC: +ac(offLag).toFixed(3),
        stepCV: +cv.toFixed(3),
        minSecRms: +Math.min(...perSec.slice(0, stinger ? 4 : len)).toFixed(4),
      });
    } catch (e) {
      out.push({ name, error: String(e && e.stack ? e.stack : e) });
    }
  }
  return out;
}, seconds);

let failed = false;
for (const r of results) {
  if (r.error) {
    console.log(`NG ${r.name}: ${r.error}`);
    failed = true;
    continue;
  }
  const problems = [];
  if (r.rms < 0.02) problems.push('音が小さすぎる');
  if (r.minSecRms < 0.005) problems.push('途中で無音');
  if (r.peak >= 0.95) problems.push('割れている');
  if (r.name !== 'victory' && r.name !== 'defeat' && !(r.beatAC > r.offAC && r.beatAC > 0.1)) problems.push('拍のくり返しが弱い');
  if (r.stepCV < 0.08) problems.push('音量が平ら');
  if (problems.length) failed = true;
  console.log(`${problems.length ? 'NG' : 'OK'} ${JSON.stringify(r)}${problems.length ? '  ← ' + problems.join(', ') : ''}`);
}

// ゲームの中で: 最初のクリックで音が始まり、タイトル→地図→戦闘(地域ごとの曲)→ボスへ切り替わる
const playing = async () => page.evaluate(async () => (await import('/src/render/music.ts')).music.playing);
await page.goto(`${base}`);
await page.waitForTimeout(2500);
await page.mouse.click(5, 5);
await page.waitForTimeout(1500);
console.log('タイトル:', await playing());
for (const [url, expect] of [
  ['?map', 'title'],
  ['?play&stage=1-1', 'region1'],
  ['?autoplay&stage=2-1', 'region2'],
  ['?autoplay&stage=3-1', 'region3'],
  ['?autoplay&stage=1-3&wave=10&speed=3', 'boss'],
]) {
  await page.goto(`${base}${url}`);
  await page.waitForTimeout(2000);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(url.includes('wave=10') ? 6000 : 2500);
  const now = await playing();
  const ok = now === expect;
  if (!ok) failed = true;
  console.log(`${ok ? 'OK' : 'NG'} ${url} → ${now} (期待 ${expect})`);
}
const muteCheck = await page.evaluate(async () => {
  const { sfx } = await import('/src/render/sfx.ts');
  sfx.setMuted(true);
  await new Promise((r) => setTimeout(r, 300));
  const muted = sfx.muted;
  sfx.setMuted(false);
  return muted;
});
console.log('消音の切り替え:', muteCheck ? 'OK' : 'NG');
// 効果音: すべての名前を鳴らして例外が出ないこと
const sfxCheck = await page.evaluate(async () => {
  const { sfx } = await import('/src/render/sfx.ts');
  const names = ['hit', 'slash', 'arrow', 'bolt', 'explode', 'bigExplode', 'coin', 'spawn', 'castleHit', 'horn', 'boss', 'heal', 'meteor', 'click', 'error', 'squish', 'victory', 'defeat', 'build', 'harvest', 'treeGrow', 'uproot', 'rally', 'upgrade', 'buy'];
  const bad = [];
  for (const n of names) {
    try {
      sfx.play(n);
      sfx.play(n, 0);
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      bad.push(`${n}: ${e}`);
    }
  }
  return bad;
});
console.log('効果音:', sfxCheck.length ? `NG ${sfxCheck.join(', ')}` : 'OK');
if (sfxCheck.length) failed = true;

await browser.close();
await server.close();
if (errors.length) {
  console.error('\nブラウザのエラー:');
  for (const e of [...new Set(errors)]) console.error(`  ${e}`);
  failed = true;
}
process.exit(failed ? 1 : 0);
