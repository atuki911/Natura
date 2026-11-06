// 効果音をその場で合成する(音の素材ファイルなし)。
// 音の流れ: 効果音(master) と 音楽(musicInput) → bus(消音) → limiter(割れ防止) → スピーカー。
// AudioContext は音楽(music.ts)と共有する。消音(save.muted)は bus で効くので、音楽も効果音もまとめて止まる。

export type SfxName =
  | 'hit'
  | 'slash'
  | 'arrow'
  | 'bolt'
  | 'explode'
  | 'bigExplode'
  | 'coin'
  | 'spawn'
  | 'castleHit'
  | 'horn'
  | 'boss'
  | 'heal'
  | 'meteor'
  | 'click'
  | 'error'
  | 'squish'
  | 'victory'
  | 'defeat'
  | 'build'
  | 'harvest'
  | 'treeGrow'
  | 'uproot'
  | 'rally'
  | 'upgrade'
  | 'buy';

const MIN_GAP: Partial<Record<SfxName, number>> = {
  hit: 0.05,
  slash: 0.06,
  arrow: 0.05,
  coin: 0.05,
  squish: 0.05,
  bolt: 0.06,
  harvest: 0.12,
  treeGrow: 0.15,
  uproot: 0.1,
};

/** 音の高さ(MIDI の番号)→ 周波数 */
const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private musicIn: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<SfxName, number>();
  private listeners: (() => void)[] = [];
  muted = false;
  volume = 0.55;

  /** 音楽(music.ts)と共有する AudioContext。unlock の前は null。 */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** 音楽をつなぐ入口(消音・割れ防止を通る)。unlock の前は null。 */
  get musicInput(): GainNode | null {
    return this.musicIn;
  }

  /** AudioContext ができた時に呼ばれる(音楽が後からつながるため)。 */
  onUnlock(fn: () => void): void {
    if (this.ctx) fn();
    else this.listeners.push(fn);
  }

  /** 最初の操作の時に呼ぶ(ブラウザは操作前に音を鳴らせない)。 */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    limiter.connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.gain.value = this.muted ? 0 : 1;
    this.bus.connect(limiter);
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.bus);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.bus);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    // タブが隠れたら音を止める(提出先の決まりでもある)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    if (ctx.state === 'suspended') void ctx.resume();
    const fns = this.listeners;
    this.listeners = [];
    for (const fn of fns) fn();
  }

  /** 全体の消音(音楽も効果音も)。 */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.bus && this.ctx) this.bus.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master) this.master.gain.value = volume;
  }

  play(name: SfxName, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || !(volume > 0)) return;
    const now = ctx.currentTime + 0.005;
    const gap = MIN_GAP[name] ?? 0.03;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    this.last.set(name, now);
    const v = volume;
    // 同じ音が続いても機械的に聞こえないよう、高さを少し揺らす
    const r = 0.94 + Math.random() * 0.12;
    switch (name) {
      case 'hit':
        // 打撃: 低い胴鳴り + 乾いた打音 + 一瞬のクリック
        this.tone(now, 'sine', 190 * r, 52, 0.12, 0.5 * v);
        this.noiseBurst(now, 0.06, 'bandpass', 2200 * r, 700, 0.42 * v, 1.2);
        this.tone(now, 'square', 1400 * r, 220, 0.018, 0.12 * v);
        break;
      case 'slash':
        // 刃の振り: 上がる風切り + 金属のかすかな響き
        this.noiseBurst(now, 0.11, 'bandpass', 1400 * r, 6500, 0.3 * v, 1.6);
        this.tone(now + 0.03, 'triangle', 2600 * r, 2300, 0.12, 0.035 * v);
        this.tone(now, 'sine', 150 * r, 60, 0.07, 0.25 * v);
        break;
      case 'arrow':
        // 弦の弾き + 風切り
        this.tone(now, 'triangle', 320 * r, 180, 0.06, 0.14 * v);
        this.noiseBurst(now + 0.01, 0.1, 'bandpass', 4200 * r, 1600, 0.16 * v, 2);
        break;
      case 'bolt':
        this.tone(now, 'sine', 700 * r, 1700, 0.16, 0.13 * v);
        this.tone(now, 'triangle', 1400 * r, 2600, 0.12, 0.06 * v);
        this.noiseBurst(now, 0.12, 'highpass', 5000, 8000, 0.06 * v);
        break;
      case 'explode':
        this.noiseBurst(now, 0.5, 'lowpass', 1600, 110, 0.6 * v);
        this.tone(now, 'sine', 120 * r, 32, 0.4, 0.65 * v);
        this.noiseBurst(now, 0.04, 'highpass', 2000, 1200, 0.25 * v);
        break;
      case 'bigExplode':
        this.noiseBurst(now, 1.1, 'lowpass', 2200, 70, 0.8 * v);
        this.tone(now, 'sine', 95 * r, 24, 0.9, 0.85 * v);
        this.tone(now + 0.05, 'sine', 60, 28, 0.7, 0.4 * v);
        this.noiseBurst(now, 0.06, 'highpass', 2200, 1200, 0.3 * v);
        break;
      case 'coin':
        // 金貨: 明るいベルを2つ(シ→ミ)
        this.bell(now, 83, 0.32, 0.11 * v);
        this.bell(now + 0.07, 88, 0.5, 0.12 * v);
        break;
      case 'harvest':
        // 収穫: 上がっていくベルの分散和音 + きらめき
        [79, 84, 88, 91, 96].forEach((m, i) => this.bell(now + i * 0.055, m, 0.7, (0.1 - i * 0.008) * v));
        this.noiseBurst(now + 0.1, 0.35, 'highpass', 6000, 9000, 0.035 * v);
        break;
      case 'treeGrow':
        // 木が育つ: やわらかい魔法の風 + 小さなチャイム
        this.swell(now, 0.55, 500, 3200, 0.16 * v);
        this.tone(now, 'sine', 110, 165, 0.45, 0.12 * v);
        this.bell(now + 0.22, 88, 0.9, 0.07 * v);
        this.bell(now + 0.32, 95, 0.9, 0.05 * v);
        break;
      case 'uproot':
        // 根を抜く: 土がちぎれる音 + ぽんと抜ける音 + 金貨
        this.noiseBurst(now, 0.22, 'lowpass', 1200, 200, 0.35 * v, 0.8);
        this.crackle(now, 0.18, 0.12 * v);
        this.tone(now + 0.1, 'sine', 180, 520, 0.12, 0.25 * v);
        this.bell(now + 0.2, 84, 0.35, 0.07 * v);
        break;
      case 'spawn':
        this.tone(now, 'triangle', 420 * r, 720, 0.1, 0.15 * v);
        this.noiseBurst(now, 0.06, 'lowpass', 900, 300, 0.12 * v);
        break;
      case 'build':
        this.noiseBurst(now, 0.12, 'lowpass', 900, 300, 0.32 * v);
        this.tone(now, 'sine', 140, 60, 0.12, 0.3 * v);
        this.bell(now + 0.1, 76, 0.4, 0.08 * v);
        this.bell(now + 0.17, 83, 0.5, 0.08 * v);
        break;
      case 'buy':
        // 買う: カチッ + チャリン
        this.tone(now, 'square', 1800, 900, 0.02, 0.08 * v);
        this.bell(now + 0.03, 84, 0.3, 0.09 * v);
        this.bell(now + 0.09, 91, 0.6, 0.1 * v);
        break;
      case 'upgrade':
        // 強化: 上がるうねり + 長三和音のベル
        this.swell(now, 0.35, 600, 4000, 0.1 * v);
        [72, 76, 79, 84].forEach((m, i) => this.bell(now + 0.08 + i * 0.07, m, 0.8, 0.09 * v));
        break;
      case 'castleHit':
        this.noiseBurst(now, 0.22, 'lowpass', 600, 140, 0.5 * v);
        this.tone(now, 'sine', 90, 40, 0.2, 0.35 * v);
        break;
      case 'horn':
        this.horn(now, 55, 0.9, 0.16 * v);
        this.horn(now, 62, 0.9, 0.08 * v);
        break;
      case 'rally':
        // 号令の角笛: ド・ソ・ドー
        this.horn(now, 60, 0.18, 0.15 * v);
        this.horn(now + 0.2, 67, 0.18, 0.15 * v);
        this.horn(now + 0.4, 72, 0.7, 0.16 * v);
        this.horn(now + 0.4, 64, 0.7, 0.08 * v);
        break;
      case 'boss':
        this.horn(now, 43, 1.6, 0.24 * v);
        this.horn(now, 44, 1.6, 0.16 * v);
        this.tone(now, 'sine', 70, 30, 1.2, 0.5 * v);
        this.noiseBurst(now, 1.2, 'lowpass', 500, 60, 0.3 * v);
        break;
      case 'heal':
        [72, 76, 79, 84].forEach((m, i) => this.bell(now + i * 0.07, m, 0.5, 0.08 * v));
        break;
      case 'meteor':
        this.noiseBurst(now, 0.7, 'bandpass', 400, 2400, 0.28 * v);
        this.tone(now, 'sine', 300, 900, 0.6, 0.05 * v);
        break;
      case 'click':
        this.tone(now, 'triangle', 1000, 700, 0.04, 0.12 * v);
        this.tone(now, 'sine', 300, 200, 0.03, 0.1 * v);
        break;
      case 'error':
        this.tone(now, 'square', 180, 150, 0.09, 0.07 * v);
        this.tone(now + 0.1, 'square', 150, 130, 0.12, 0.07 * v);
        break;
      case 'squish':
        this.tone(now, 'sine', 340 * r, 70, 0.14, 0.24 * v);
        this.noiseBurst(now, 0.08, 'lowpass', 900, 300, 0.16 * v);
        break;
      case 'victory':
        // 勝利の旋律は音楽(music.ts)の victory が鳴らす。ここは輝きだけ。
        this.swell(now, 0.6, 1500, 8000, 0.08 * v);
        [84, 88, 91, 96, 100].forEach((m, i) => this.bell(now + 0.05 + i * 0.05, m, 0.6, 0.05 * v));
        break;
      case 'defeat':
        // 負けの旋律は音楽(music.ts)の defeat が鳴らす。ここは重い崩れの音だけ。
        this.tone(now, 'sine', 80, 30, 1.2, 0.5 * v);
        this.noiseBurst(now, 1, 'lowpass', 700, 60, 0.35 * v);
        break;
    }
  }

  private tone(at: number, type: OscillatorType, from: number, to: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** 鐘・グロッケンのような澄んだ音(倍音が整数でない)。m は MIDI の番号。 */
  private bell(at: number, m: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const f = hz(m);
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(this.master!);
    const partials: [number, number, number][] = [
      [1, 1, dur],
      [2.76, 0.28, dur * 0.35],
      [5.4, 0.1, dur * 0.15],
    ];
    for (const [ratio, amp, d] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(amp, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + d + 0.02);
    }
  }

  private noiseBurst(at: number, dur: number, type: BiquadFilterType, from: number, to: number, vol: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  /** ふわっと立ち上がって消える風(フィルターが上がっていく)。 */
  private swell(at: number, dur: number, from: number, to: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(vol, at + dur * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  /** 土や枝がぱちぱち鳴る細かい粒。 */
  private crackle(at: number, dur: number, vol: number): void {
    for (let i = 0; i < 5; i++) {
      const t = at + Math.random() * dur;
      this.noiseBurst(t, 0.02, 'bandpass', 1500 + Math.random() * 2500, 800, vol, 3);
    }
  }

  /** 角笛・金管(m は MIDI の番号)。 */
  private horn(at: number, m: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const freq = hz(m);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(freq * 1.5, at);
    filter.frequency.linearRampToValueAtTime(freq * 5, at + 0.08);
    filter.frequency.linearRampToValueAtTime(freq * 3.2, at + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.05);
    gain.gain.setValueAtTime(vol * 0.85, at + Math.max(0.06, dur * 0.7));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    filter.connect(gain).connect(this.master!);
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(freq * 0.96, at);
      osc.frequency.exponentialRampToValueAtTime(freq, at + 0.06);
      osc.connect(filter);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    }
  }
}

export const sfx = new Sfx();
