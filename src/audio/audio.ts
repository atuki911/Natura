// Fully synthesized audio (no asset files): sound effects + a small procedural music sequencer.

type Ctx = AudioContext;

export class Audio {
  private ctx: Ctx | null = null;
  private sfxGain!: GainNode;
  private musGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  sfxVol = 0.8;
  musVol = 0.5;
  private lastPlay = new Map<string, number>();
  private musicTimer: number | null = null;
  private track = -1;
  private step = 0;
  private nextTime = 0;

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.musGain = this.ctx.createGain();
    this.sfxGain.connect(comp);
    this.musGain.connect(comp);
    this.setVolumes(this.sfxVol, this.musVol);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.track >= 0) this.startMusic(this.track, true);
  }

  setVolumes(sfx: number, mus: number) {
    this.sfxVol = sfx; this.musVol = mus;
    if (!this.ctx) return;
    this.sfxGain.gain.value = sfx * 0.55;
    this.musGain.gain.value = mus * 0.22;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, t0 = 0, slide?: number, dest?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + t0;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, t0 = 0, freqEnd?: number, q = 1) {
    const c = this.ctx!;
    const t = c.currentTime + t0;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name: string) {
    if (!this.ctx || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    const minGap: Record<string, number> = { arrow: 0.06, gun: 0.05, sword: 0.07, magic: 0.08, boom: 0.06, zap: 0.08, coin: 0.05, hit: 0.04 };
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < (minGap[name] ?? 0.03)) return;
    this.lastPlay.set(name, now);
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    switch (name) {
      case 'arrow': this.noise(0.12, 0.25, 'bandpass', r(2500, 3500), 0, 800, 2); break;
      case 'gun': this.noise(0.05, 0.25, 'highpass', 2000); this.tone(r(180, 220), 0.05, 'square', 0.08); break;
      case 'magic': this.tone(r(600, 750), 0.25, 'sine', 0.18, 0, 1400); this.tone(r(900, 1100), 0.2, 'triangle', 0.08, 0.03, 1800); break;
      case 'ice': this.tone(1800, 0.2, 'sine', 0.12, 0, 900); this.noise(0.15, 0.12, 'highpass', 5000); break;
      case 'cannon': this.tone(120, 0.3, 'sine', 0.45, 0, 45); this.noise(0.25, 0.35, 'lowpass', 900, 0, 200); break;
      case 'boom': this.noise(0.45, 0.45, 'lowpass', 1200, 0, 120); this.tone(80, 0.35, 'sine', 0.4, 0, 35); break;
      case 'bigboom': this.noise(0.9, 0.6, 'lowpass', 900, 0, 60); this.tone(60, 0.8, 'sine', 0.6, 0, 25); break;
      case 'zap': for (let i = 0; i < 4; i++) this.tone(r(800, 2000), 0.05, 'sawtooth', 0.08, i * 0.025); this.noise(0.18, 0.2, 'highpass', 3000); break;
      case 'sword': this.noise(0.08, 0.2, 'bandpass', r(3000, 4500), 0, 1500, 3); this.tone(r(1200, 1500), 0.06, 'triangle', 0.05); break;
      case 'build': this.tone(220, 0.08, 'square', 0.15); this.tone(330, 0.08, 'square', 0.15, 0.08); this.noise(0.2, 0.2, 'lowpass', 600); break;
      case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.2, i * 0.07)); break;
      case 'sell': [784, 659, 523].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.18, i * 0.06)); this.play('coin'); break;
      case 'coin': this.tone(1318, 0.08, 'square', 0.08); this.tone(1760, 0.12, 'square', 0.08, 0.06); break;
      case 'cluck': {
        // "kokko!" — a squawky FM-ish chicken call
        const base = r(500, 650);
        this.tone(base, 0.09, 'square', 0.12, 0, base * 1.6);
        this.tone(base * 1.3, 0.14, 'square', 0.12, 0.11, base * 0.8);
        this.noise(0.1, 0.06, 'bandpass', 2500, 0.11);
        break;
      }
      case 'rally': this.play('cluck'); break;
      case 'horn': this.tone(196, 0.5, 'sawtooth', 0.15, 0, 220); this.tone(294, 0.6, 'sawtooth', 0.12, 0.25, 294); break;
      case 'leak': this.tone(300, 0.25, 'square', 0.18, 0, 150); this.tone(200, 0.3, 'square', 0.18, 0.12, 100); break;
      case 'victory': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.25, i * 0.13)); break;
      case 'defeat': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.25, i * 0.22)); break;
      case 'meteor': this.noise(1.0, 0.25, 'bandpass', 400, 0, 1800, 1); break;
      case 'reinforce': this.play('cluck'); this.tone(880, 0.15, 'triangle', 0.15, 0.1); break;
      case 'freeze': this.tone(2400, 0.4, 'sine', 0.12, 0, 600); this.noise(0.4, 0.15, 'highpass', 6000); break;
      case 'ray': this.tone(200, 0.6, 'sawtooth', 0.2, 0, 1600); this.tone(400, 0.6, 'sine', 0.15, 0, 2400); break;
      case 'teleport': this.tone(400, 0.3, 'sine', 0.15, 0, 1600); this.tone(1600, 0.3, 'sine', 0.1, 0.1, 400); break;
      case 'headshot': this.tone(1600, 0.06, 'square', 0.15); this.noise(0.1, 0.2, 'highpass', 4000); break;
      case 'barrage': for (let i = 0; i < 6; i++) this.noise(0.04, 0.2, 'highpass', 2500, i * 0.05); break;
      case 'missile': this.noise(0.6, 0.2, 'bandpass', 800, 0, 2400, 2); break;
      case 'whirl': this.noise(0.35, 0.25, 'bandpass', 1500, 0, 4000, 2); break;
      case 'holy': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, i * 0.04)); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.12, i * 0.06)); break;
      case 'flame': this.noise(0.4, 0.3, 'bandpass', 900, 0, 300, 1); break;
      case 'slam': this.tone(70, 0.4, 'sine', 0.5, 0, 30); this.noise(0.3, 0.3, 'lowpass', 500); break;
      case 'summon': this.tone(150, 0.5, 'sawtooth', 0.15, 0, 80); this.tone(225, 0.5, 'sawtooth', 0.1, 0, 120); break;
      case 'throw': this.noise(0.15, 0.15, 'bandpass', 1200, 0, 600, 2); break;
      case 'starfall': [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.1, i * 0.08)); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, 'square', 0.1, i * 0.06)); break;
      case 'heroDown': this.tone(400, 0.5, 'triangle', 0.2, 0, 150); break;
      case 'click': this.tone(880, 0.05, 'triangle', 0.12); break;
      case 'deny': this.tone(180, 0.15, 'square', 0.12); break;
      case 'star': this.tone(1047, 0.25, 'triangle', 0.2); this.tone(1568, 0.3, 'triangle', 0.15, 0.08); break;
      case 'newEnemy': this.tone(330, 0.2, 'square', 0.12); this.tone(247, 0.3, 'square', 0.12, 0.15); break;
    }
  }

  // ───────── music ─────────
  startMusic(track: number, force = false) {
    if (this.track === track && !force && this.musicTimer != null) return;
    this.track = track;
    this.stopMusicTimer();
    if (!this.ctx) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 50);
  }
  stopMusic() { this.track = -1; this.stopMusicTimer(); }
  private stopMusicTimer() { if (this.musicTimer != null) { clearInterval(this.musicTimer); this.musicTimer = null; } }

  private schedule() {
    const c = this.ctx;
    if (!c || this.track < 0) return;
    const T = TRACKS[this.track % TRACKS.length];
    const spb = 60 / T.bpm / 2; // eighth notes
    while (this.nextTime < c.currentTime + 0.25) {
      const s = this.step % (T.mel.length);
      const bar = Math.floor(this.step / 8) % T.chords.length;
      const t0 = this.nextTime - c.currentTime;
      const root = T.chords[bar];
      const m = T.mel[s];
      if (m != null && m >= 0) this.mtone(midi(T.key + m), spb * 0.9, T.lead, 0.11, t0);
      if (this.step % 4 === 0) this.mtone(midi(T.key + root - 12), spb * 3.6, 'triangle', 0.16, t0);
      if (this.step % 2 === 0) {
        const third = T.minor ? 3 : 4;
        this.mtone(midi(T.key + root + (this.step % 4 === 0 ? third : 7)), spb * 1.6, 'sine', 0.05, t0);
      }
      if (T.drums) {
        if (this.step % 4 === 0) this.mkick(t0);
        if (this.step % 4 === 2) this.mhat(t0, 0.06);
        if (this.step % 8 === 6 && T.drums > 1) this.mhat(t0 + spb * 0.5, 0.04);
      }
      this.step++;
      this.nextTime += spb;
    }
  }
  private mtone(freq: number, dur: number, type: OscillatorType, vol: number, t0: number) {
    const c = this.ctx!;
    const t = c.currentTime + t0;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private mkick(t0: number) {
    const c = this.ctx!;
    const t = c.currentTime + t0;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.musGain); o.start(t); o.stop(t + 0.2);
  }
  private mhat(t0: number, vol: number) {
    const c = this.ctx!;
    const t = c.currentTime + t0;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musGain); s.start(t, Math.random()); s.stop(t + 0.06);
  }
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const _ = -1;
interface Track { bpm: number; key: number; minor: boolean; chords: number[]; mel: number[]; lead: OscillatorType; drums: number }
const TRACKS: Track[] = [
  // 0: title / map — cheerful
  { bpm: 112, key: 67, minor: false, lead: 'triangle', drums: 1, chords: [0, 5, 7, 5],
    mel: [0, 4, 7, 4, 9, 7, 4, _, 5, 9, 12, 9, 7, _, 4, 2, 0, 4, 7, 9, 12, 9, 7, 4, 2, 4, 5, 4, 2, _, 0, _] },
  // 1: grassland battle
  { bpm: 128, key: 62, minor: false, lead: 'square', drums: 2, chords: [0, 0, 5, 7],
    mel: [0, _, 4, 7, 9, 7, 4, _, 0, _, 4, 7, 12, _, 9, 7, 5, _, 9, 12, 14, 12, 9, _, 7, _, 11, 14, 12, _, _, _] },
  // 2: forest / swamp
  { bpm: 118, key: 57, minor: true, lead: 'triangle', drums: 2, chords: [0, 8, 3, 10],
    mel: [0, 3, 7, 3, 10, 7, 3, _, 8, 7, 3, 0, 3, _, _, _, 3, 7, 10, 12, 15, 12, 10, 7, 5, 7, 8, 7, 3, _, 0, _] },
  // 3: snow
  { bpm: 104, key: 64, minor: true, lead: 'sine', drums: 1, chords: [0, 5, 3, 7],
    mel: [12, _, 15, 12, 10, _, 7, _, 8, _, 12, 8, 7, _, 3, _, 5, _, 8, 12, 15, _, 12, _, 14, 12, 11, _, 7, _, _, _] },
  // 4: volcano
  { bpm: 140, key: 55, minor: true, lead: 'sawtooth', drums: 2, chords: [0, 0, 8, 7],
    mel: [0, 0, 12, 0, 10, 0, 7, 8, 0, 0, 12, 0, 15, 14, 12, 10, 8, _, 7, _, 3, _, 7, 8, 7, _, 5, _, 2, _, _, _] },
  // 5: boss
  { bpm: 150, key: 52, minor: true, lead: 'sawtooth', drums: 2, chords: [0, 1, 0, 6],
    mel: [0, 12, 0, 11, 0, 10, 0, 7, 1, 13, 1, 12, 1, 10, 7, 6, 0, 12, 0, 15, 14, 12, 10, 7, 6, 7, 10, 13, 12, _, _, _] },
];

export const audio = new Audio();
