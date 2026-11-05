// 効果音をその場で合成する(音の素材ファイルなし)。後で本物の音素材に差し替える前提の仮の音。

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
  | 'build';

const MIN_GAP: Partial<Record<SfxName, number>> = { hit: 0.05, slash: 0.06, arrow: 0.05, coin: 0.04, squish: 0.05, bolt: 0.06 };

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<SfxName, number>();
  muted = false;
  volume = 0.5;

  /** 最初の操作の時に呼ぶ(ブラウザは操作前に音を鳴らせない)。 */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  play(name: SfxName, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const now = ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0.03;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    this.last.set(name, now);
    switch (name) {
      case 'hit':
        this.noiseBurst(now, 0.07, 'bandpass', 1400, 600, 0.35 * volume);
        this.tone(now, 'sine', 160, 60, 0.08, 0.35 * volume);
        break;
      case 'slash':
        this.noiseBurst(now, 0.09, 'highpass', 2500, 5000, 0.18 * volume);
        break;
      case 'arrow':
        this.noiseBurst(now, 0.08, 'bandpass', 3200, 1800, 0.14 * volume);
        break;
      case 'bolt':
        this.tone(now, 'sine', 700, 1600, 0.16, 0.12 * volume);
        this.tone(now, 'triangle', 1400, 2400, 0.12, 0.06 * volume);
        break;
      case 'explode':
        this.noiseBurst(now, 0.45, 'lowpass', 1200, 120, 0.5 * volume);
        this.tone(now, 'sine', 110, 35, 0.35, 0.5 * volume);
        break;
      case 'bigExplode':
        this.noiseBurst(now, 1, 'lowpass', 1800, 80, 0.7 * volume);
        this.tone(now, 'sine', 90, 25, 0.8, 0.7 * volume);
        break;
      case 'coin':
        this.tone(now, 'square', 988, 988, 0.06, 0.06 * volume);
        this.tone(now + 0.06, 'square', 1319, 1319, 0.12, 0.06 * volume);
        break;
      case 'spawn':
        this.tone(now, 'triangle', 420, 700, 0.1, 0.16 * volume);
        break;
      case 'build':
        this.noiseBurst(now, 0.12, 'lowpass', 900, 300, 0.3 * volume);
        this.tone(now + 0.1, 'triangle', 520, 780, 0.15, 0.15 * volume);
        break;
      case 'castleHit':
        this.noiseBurst(now, 0.18, 'lowpass', 500, 150, 0.4 * volume);
        break;
      case 'horn':
        this.horn(now, 196, 0.9, 0.18 * volume);
        break;
      case 'boss':
        this.horn(now, 98, 1.6, 0.25 * volume);
        this.horn(now, 104, 1.6, 0.2 * volume);
        break;
      case 'heal':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(now + i * 0.07, 'sine', f, f, 0.25, 0.12 * volume));
        break;
      case 'meteor':
        this.noiseBurst(now, 0.7, 'bandpass', 400, 2400, 0.25 * volume);
        break;
      case 'click':
        this.tone(now, 'triangle', 900, 700, 0.05, 0.12 * volume);
        break;
      case 'error':
        this.tone(now, 'square', 170, 140, 0.14, 0.08 * volume);
        break;
      case 'squish':
        this.tone(now, 'sine', 340, 70, 0.14, 0.22 * volume);
        this.noiseBurst(now, 0.08, 'lowpass', 900, 300, 0.15 * volume);
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(now + i * 0.12, 'triangle', f, f, 0.3, 0.16 * volume));
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => this.tone(now + i * 0.22, 'triangle', f, f * 0.98, 0.4, 0.16 * volume));
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
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private noiseBurst(at: number, dur: number, type: BiquadFilterType, from: number, to: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  private horn(at: number, freq: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.94, at);
    osc.frequency.linearRampToValueAtTime(freq, at + 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.1);
    gain.gain.setValueAtTime(vol, at + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(filter).connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}

export const sfx = new Sfx();
