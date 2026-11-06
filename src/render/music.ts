// 音楽をその場で合成して鳴らす(音の素材ファイルなし)。
//
// しくみ:
//  - 曲(Track)は「節(Section)」を並べたもの。節は小節の数・和音・旋律(文字で書く)を持つ。
//  - 曲ごとの arrange() が1小節ずつ、どの楽器で何を鳴らすかを決める(ドラムの型・ベースの型・分散和音など)。
//  - Player は少し先(LOOKAHEAD)までの小節を AudioContext の時刻に予約していく。止める・切り替える時は
//    Player の出口の音量を下げるだけでよい(予約済みの音は出口の先で消える)。
//  - 楽器はすべてオシレーター + フィルター + 音量の包絡で作る。残響は作った残響の響き(ConvolverNode)。
//
// 旋律の書き方: "D5:3 B4:1 G4:2 | r:4 ..."  音名+オクターブ:長さ(16分音符いくつ分)。r は休み。| は読みやすさのためだけ。
// 和音の書き方: "G | C | Am D | G"  | で小節を区切る。1小節に2つ以上書くと等分する。
//
// 検証: renderTrack() で OfflineAudioContext に描き出せる(tools/music-check.mjs)。

import { sfx } from './sfx.ts';

export type TrackName = 'title' | 'region1' | 'region2' | 'region3' | 'boss' | 'victory' | 'defeat';

// ---------------------------------------------------------------- 音の理屈

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#5" → MIDI の番号 */
export function noteNumber(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`音名が読めない: ${name}`);
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export interface Chord {
  root: number; // 0..11
  bass: number; // 0..11
  tones: number[]; // 根音からの半音の数
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  '5': [0, 7],
};

const pitchClass = (s: string): number => (PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;

export function parseChord(sym: string): Chord {
  const m = /^([A-G][#b]?)(maj7|m7|m|7|sus4|sus2|dim|5)?(?:\/([A-G][#b]?))?$/.exec(sym);
  if (!m) throw new Error(`和音が読めない: ${sym}`);
  const root = pitchClass(m[1]);
  return { root, bass: m[3] ? pitchClass(m[3]) : root, tones: QUALITY[m[2] ?? ''] };
}

export interface Note {
  step: number; // 節の頭からの16分音符の数
  len: number;
  midi: number;
}

export function parseLine(text: string): { notes: Note[]; length: number } {
  const notes: Note[] = [];
  let step = 0;
  for (const tok of text.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [name, lenText] = tok.split(':');
    const len = lenText ? Number(lenText) : 2;
    if (!(len > 0)) throw new Error(`長さが読めない: ${tok}`);
    if (name !== 'r') notes.push({ step, len, midi: noteNumber(name) });
    step += len;
  }
  return { notes, length: step };
}

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

/** 音階の上で n 段ずらす(3度下のハモり = -2)。 */
function diatonic(midi: number, tonic: number, scale: number[], n: number): number {
  const rel = (((midi - tonic) % 12) + 12) % 12;
  let deg = 0;
  for (let i = 0; i < scale.length; i++) if (scale[i] <= rel) deg = i;
  const octave = Math.floor((midi - tonic - rel) / 12);
  const idx = deg + n;
  const o = Math.floor(idx / scale.length);
  const d = ((idx % scale.length) + scale.length) % scale.length;
  return tonic + (octave + o) * 12 + scale[d] + (rel - scale[deg]);
}

// ---------------------------------------------------------------- 曲のかたち

export interface Section {
  bars: number;
  chords: string;
  lines?: Record<string, string>;
}

interface ParsedSection {
  name: string;
  bars: number;
  chords: Chord[][];
  lines: Record<string, Note[]>;
}

export interface TrackDef {
  bpm: number;
  /** 1小節の16分音符の数(4/4 = 16, 3/4 = 12) */
  steps: number;
  key: string; // 主音 (例 'G')
  scale: keyof typeof SCALES;
  /** 16分音符の裏を遅らせる割合(はねるノリ) */
  swing?: number;
  sections: Record<string, Section>;
  form: string[];
  /** 2周目以降どこから繰り返すか(form の番号) */
  loopFrom?: number;
  /** false なら1回で終わる(勝利・敗北の短い曲) */
  loop?: boolean;
  arrange(b: Bar): void;
}

// ---------------------------------------------------------------- 楽器

type InstName =
  | 'pluck'
  | 'harp'
  | 'pad'
  | 'strings'
  | 'bass'
  | 'subBass'
  | 'flute'
  | 'horn'
  | 'bell'
  | 'marimba'
  | 'choir'
  | 'stab'
  | 'kick'
  | 'bigKick'
  | 'snare'
  | 'clap'
  | 'rim'
  | 'hat'
  | 'openHat'
  | 'shaker'
  | 'tom'
  | 'taiko'
  | 'timpani'
  | 'frame'
  | 'crash';

/** 楽器ごとの音量・定位・残響の量 */
const MIX: Record<InstName, { level: number; pan: number; wet: number }> = {
  pluck: { level: 0.26, pan: -0.25, wet: 0.25 },
  harp: { level: 0.3, pan: 0.2, wet: 0.35 },
  pad: { level: 0.065, pan: 0, wet: 0.45 },
  strings: { level: 0.1, pan: -0.1, wet: 0.45 },
  bass: { level: 0.24, pan: 0, wet: 0.05 },
  subBass: { level: 0.22, pan: 0, wet: 0.02 },
  flute: { level: 0.25, pan: 0.1, wet: 0.35 },
  horn: { level: 0.22, pan: -0.05, wet: 0.35 },
  bell: { level: 0.22, pan: 0.3, wet: 0.45 },
  marimba: { level: 0.24, pan: -0.3, wet: 0.25 },
  choir: { level: 0.05, pan: 0, wet: 0.55 },
  stab: { level: 0.11, pan: 0.15, wet: 0.25 },
  kick: { level: 0.55, pan: 0, wet: 0.04 },
  bigKick: { level: 0.45, pan: 0, wet: 0.06 },
  snare: { level: 0.6, pan: 0.05, wet: 0.2 },
  clap: { level: 1.0, pan: 0.05, wet: 0.25 },
  rim: { level: 0.8, pan: 0.2, wet: 0.2 },
  hat: { level: 0.45, pan: 0.3, wet: 0.08 },
  openHat: { level: 0.3, pan: 0.3, wet: 0.15 },
  shaker: { level: 0.3, pan: -0.35, wet: 0.12 },
  tom: { level: 0.32, pan: -0.15, wet: 0.2 },
  taiko: { level: 0.42, pan: 0, wet: 0.3 },
  timpani: { level: 0.38, pan: 0, wet: 0.35 },
  frame: { level: 0.3, pan: -0.1, wet: 0.3 },
  crash: { level: 0.07, pan: -0.2, wet: 0.3 },
};

/** 曲を鳴らす土台(AudioContext ごとに1つ): 残響・まとめのコンプレッサー・ノイズ。 */
export interface Rig {
  ctx: BaseAudioContext;
  dry: AudioNode;
  reverb: AudioNode;
  noise: AudioBuffer;
}

export function createRig(ctx: BaseAudioContext, output: AudioNode): Rig {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.008;
  comp.release.value = 0.25;
  const out = ctx.createGain();
  out.gain.value = 0.72;
  comp.connect(out).connect(output);

  // 残響: 指数で減るノイズを少しずつ丸めた響き(左右で別のノイズ)
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 2.6);
  const ir = ctx.createBuffer(2, len, sr);
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const smooth = Math.min(0.92, 0.15 + t * 0.4);
      lp = lp * smooth + (rnd() * 2 - 1) * (1 - smooth);
      const early = t < 0.012 ? t / 0.012 : 1;
      d[i] = lp * Math.exp(-t * 2.6) * early * 1.4;
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const wetOut = ctx.createGain();
  wetOut.gain.value = 0.5;
  conv.connect(wetOut).connect(comp);

  const noise = ctx.createBuffer(1, sr * 2, sr);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
  return { ctx, dry: comp, reverb: conv, noise };
}

// ---------------------------------------------------------------- 1小節を組み立てる道具

const VEL: Record<string, number> = { X: 1, x: 0.72, o: 0.42, '.': 0 };

export class Bar {
  readonly t0: number;
  readonly stepDur: number;
  readonly section: ParsedSection;
  /** 節の中で何小節目か(0 から) */
  readonly index: number;
  /** 何周目か(0 から) */
  readonly pass: number;
  readonly track: TrackDef;
  private player: Player;
  private minTime: number;

  constructor(player: Player, t0: number, stepDur: number, section: ParsedSection, index: number, pass: number, track: TrackDef, minTime: number) {
    this.player = player;
    this.t0 = t0;
    this.stepDur = stepDur;
    this.section = section;
    this.index = index;
    this.pass = pass;
    this.track = track;
    this.minTime = minTime;
  }

  get steps(): number {
    return this.track.steps;
  }
  get name(): string {
    return this.section.name;
  }
  get last(): boolean {
    return this.index === this.section.bars - 1;
  }
  get first(): boolean {
    return this.index === 0;
  }

  chordAt(step: number): Chord {
    const cs = this.section.chords[this.index];
    return cs[Math.min(cs.length - 1, Math.floor((step * cs.length) / this.steps))];
  }

  time(step: number): number {
    const swing = this.track.swing ?? 0;
    const off = Math.floor(step) % 2 === 1 ? swing * this.stepDur : 0;
    return this.t0 + step * this.stepDur + off;
  }

  /** 1つの音を鳴らす(midi は MIDI 番号、ドラムなら音の高さの目安)。 */
  note(inst: InstName, midi: number, step: number, len: number, vel = 1): void {
    const t = this.time(step) + this.player.jitter();
    if (t < this.minTime) return;
    this.player.voice(inst, t, midi, len * this.stepDur, vel * this.player.humanVel());
  }

  /** ドラムの型。"X...x...o..." X=強 x=中 o=弱 .=休み。短い型はくり返して埋める。 */
  drums(inst: InstName, pattern: string, vel = 1, midi = 0): void {
    const p = pattern.replace(/\s/g, '');
    for (let s = 0; s < this.steps; s++) {
      const v = VEL[p[s % p.length]] ?? 0;
      if (v > 0) this.note(inst, midi, s, 1, v * vel);
    }
  }

  /** ベースの型。R=根音 5=5度 3=3度 7=7度 8=1オクターブ上 -=のばす .=休み */
  bass(pattern: string, inst: InstName = 'bass', vel = 1, low = 36): void {
    const p = pattern.replace(/\s/g, '');
    for (let s = 0; s < this.steps; s++) {
      const c = p[s % p.length];
      if (c === '-' || c === '.') continue;
      let len = 1;
      while (s + len < this.steps && p[(s + len) % p.length] === '-') len++;
      const chord = this.chordAt(s);
      const base = low + ((chord.bass - low) % 12 + 12) % 12;
      const root = low + ((chord.root - low) % 12 + 12) % 12;
      const third = chord.tones.find((x) => x === 3 || x === 4) ?? 4;
      const seventh = chord.tones.find((x) => x === 10 || x === 11) ?? 10;
      const midi =
        c === 'R' ? base : c === '5' ? root + 7 : c === '3' ? root + third : c === '7' ? root + seventh : c === '8' ? base + 12 : base;
      this.note(inst, midi, s, len, (s % 4 === 0 ? 1 : 0.8) * vel);
    }
  }

  /** 和音の音を低い方から並べたもの(low 以上)。 */
  voicing(chord: Chord, low: number): number[] {
    const root = low + ((chord.root - low) % 12 + 12) % 12;
    return chord.tones.map((x) => root + x);
  }

  /** 分散和音。数字は和音の何番目の音か(足りなければオクターブ上)。-=のばす .=休み */
  arp(inst: InstName, pattern: string, low: number, vel = 1): void {
    const p = pattern.replace(/\s/g, '');
    for (let s = 0; s < this.steps; s++) {
      const c = p[s % p.length];
      if (c === '-' || c === '.') continue;
      let len = 1;
      while (s + len < this.steps && p[(s + len) % p.length] === '-') len++;
      const tones = this.voicing(this.chordAt(s), low);
      const k = Number(c);
      const midi = tones[k % tones.length] + 12 * Math.floor(k / tones.length);
      this.note(inst, midi, s, len, vel);
    }
  }

  /** 和音をのばす(和音が変わるところで区切る)。 */
  hold(inst: InstName, low: number, vel = 1): void {
    const cs = this.section.chords[this.index];
    const each = this.steps / cs.length;
    cs.forEach((chord, i) => {
      for (const m of this.voicing(chord, low)) this.note(inst, m, i * each, each, vel);
    });
  }

  /** 和音をかき鳴らす/刻む。X/x/o の位置で、低い音から少しずつずらして鳴らす。 */
  strum(inst: InstName, pattern: string, low: number, vel = 1, len = 2): void {
    const p = pattern.replace(/\s/g, '');
    for (let s = 0; s < this.steps; s++) {
      const v = VEL[p[s % p.length]] ?? 0;
      if (v <= 0) continue;
      const tones = this.voicing(this.chordAt(s), low);
      tones.forEach((m, i) => {
        const t = this.time(s) + i * 0.012;
        if (t >= this.minTime) this.player.voice(inst, t, m, len * this.stepDur, v * vel * (1 - i * 0.08));
      });
    }
  }

  /** 節に書いた旋律を鳴らす。harmony は音階の上で何段ずらすか(3度下 = -2)。 */
  line(inst: InstName, key = 'lead', opts: { oct?: number; vel?: number; harmony?: number; only?: (n: Note) => boolean; len?: number } = {}): void {
    const notes = this.section.lines[key];
    if (!notes) return;
    const from = this.index * this.steps;
    const to = from + this.steps;
    const tonic = noteNumber(`${this.track.key}4`);
    for (const n of notes) {
      if (n.step < from || n.step >= to) continue;
      if (opts.only && !opts.only(n)) continue;
      let m = n.midi + (opts.oct ?? 0);
      if (opts.harmony) m = diatonic(m, tonic, SCALES[this.track.scale], opts.harmony);
      // 長い音は少し強く(フレーズの山)
      const vel = (opts.vel ?? 1) * (n.len >= 6 ? 1 : 0.9);
      this.note(inst, m, n.step - from, opts.len ?? n.len, vel);
    }
  }

  /** 決まった乱数(周・小節ごとに同じ)。 */
  rand(): number {
    return this.player.rand();
  }
}

// ---------------------------------------------------------------- 1曲を鳴らす係

export class Player {
  readonly out: GainNode;
  private wetOut: GainNode;
  private channels = new Map<InstName, { dry: AudioNode; wet: GainNode }>();
  private sections: ParsedSection[];
  private formIndex = 0;
  private barInSection = 0;
  private pass = 0;
  private nextBar: number;
  private seed: number;
  private ended = false;
  private endTime = Infinity;
  stopping = false;
  private stopAt = Infinity;

  private rig: Rig;
  readonly name: TrackName;
  readonly track: TrackDef;

  constructor(rig: Rig, name: TrackName, track: TrackDef, start: number, fadeIn = 0) {
    this.rig = rig;
    this.name = name;
    this.track = track;
    const ctx = rig.ctx;
    this.out = ctx.createGain();
    this.wetOut = ctx.createGain();
    this.out.connect(rig.dry);
    this.wetOut.connect(rig.reverb);
    for (const g of [this.out, this.wetOut]) {
      if (fadeIn > 0) {
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(1, start + fadeIn);
      }
    }
    this.nextBar = start;
    this.seed = 0x9e3779b9 ^ name.length * 7919;
    this.sections = track.form.map((key) => parseSection(key, track));
  }

  get barDuration(): number {
    return (60 / this.track.bpm / 4) * this.track.steps;
  }

  /** until までに始まる小節を予約する。silent なら音は作らずに時間だけ進める。 */
  scheduleUntil(until: number, silent = false, now = 0): void {
    while (!this.ended && this.nextBar < until && this.nextBar < this.stopAt) {
      const sec = this.sections[this.formIndex];
      // 遅れて小節が丸ごと過ぎていたら飛ばす
      const behind = this.nextBar + this.barDuration < now;
      if (!silent && !behind) {
        const bar = new Bar(this, this.nextBar, 60 / this.track.bpm / 4, sec, this.barInSection, this.pass, this.track, now);
        this.track.arrange(bar);
      }
      this.nextBar += this.barDuration;
      this.barInSection++;
      if (this.barInSection >= sec.bars) {
        this.barInSection = 0;
        this.formIndex++;
        if (this.formIndex >= this.sections.length) {
          if (this.track.loop === false) {
            this.ended = true;
            this.endTime = this.nextBar + 3;
          } else {
            this.formIndex = this.track.loopFrom ?? 0;
            this.pass++;
          }
        }
      }
    }
  }

  fadeOut(at: number, dur: number): void {
    if (this.stopping) return;
    this.stopping = true;
    this.stopAt = at + dur;
    for (const g of [this.out, this.wetOut]) {
      g.gain.cancelScheduledValues(at);
      g.gain.setValueAtTime(g.gain.value, at);
      g.gain.linearRampToValueAtTime(0, at + Math.max(0.02, dur));
    }
  }

  /** もう音を出さない(片づけてよい)か。 */
  finished(now: number): boolean {
    return (this.stopping && now > this.stopAt + 0.2) || now > this.endTime;
  }

  dispose(): void {
    this.out.disconnect();
    this.wetOut.disconnect();
  }

  rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  jitter(): number {
    return (this.rand() - 0.5) * 0.006;
  }
  humanVel(): number {
    return 0.92 + this.rand() * 0.12;
  }

  private channel(inst: InstName): AudioNode {
    let ch = this.channels.get(inst);
    if (!ch) {
      const ctx = this.rig.ctx;
      const mix = MIX[inst];
      const level = ctx.createGain();
      level.gain.value = mix.level;
      const pan = ctx.createStereoPanner();
      pan.pan.value = mix.pan;
      const wet = ctx.createGain();
      wet.gain.value = mix.wet;
      level.connect(pan);
      pan.connect(this.out);
      pan.connect(wet).connect(this.wetOut);
      ch = { dry: level, wet };
      this.channels.set(inst, ch);
    }
    return ch.dry;
  }

  voice(inst: InstName, t: number, midi: number, dur: number, vel: number): void {
    synth(this.rig, this.channel(inst), inst, t, midi, dur, vel, () => this.rand());
  }
}

function parseSection(key: string, track: TrackDef): ParsedSection {
  const sec = track.sections[key];
  if (!sec) throw new Error(`節がない: ${key}`);
  const bars = sec.chords.split('|').map((b) => b.trim().split(/\s+/).map(parseChord));
  if (bars.length !== sec.bars) throw new Error(`${key}: 和音の小節数 ${bars.length} ≠ ${sec.bars}`);
  const lines: Record<string, Note[]> = {};
  for (const [name, text] of Object.entries(sec.lines ?? {})) {
    const parsed = parseLine(text);
    if (parsed.length !== sec.bars * track.steps) throw new Error(`${key}.${name}: 長さ ${parsed.length} ≠ ${sec.bars * track.steps}`);
    lines[name] = parsed.notes;
  }
  return { name: key, bars: sec.bars, chords: bars, lines };
}

// ---------------------------------------------------------------- 音を作る(楽器ごと)

// 1音ぶんのノード。鳴り終わったらまとめて外す(グラフに残ると処理が重くなる)。
let voiceNodes: AudioNode[] = [];
let lastSource: AudioScheduledSourceNode | null = null;
let lastEnd = 0;

function track<T extends AudioNode>(node: T): T {
  voiceNodes.push(node);
  return node;
}

function source(node: AudioScheduledSourceNode, end: number): void {
  track(node);
  if (end >= lastEnd) {
    lastEnd = end;
    lastSource = node;
  }
}

function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, t: number, end: number, dest: AudioNode, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  o.connect(dest);
  o.start(t);
  o.stop(end);
  source(o, end);
  return o;
}

function gainNode(ctx: BaseAudioContext, dest: AudioNode, value = 0): GainNode {
  const g = track(ctx.createGain());
  g.gain.value = value;
  g.connect(dest);
  return g;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode {
  const f = track(ctx.createBiquadFilter());
  f.type = type;
  f.frequency.value = Math.min(freq, ctx.sampleRate * 0.45);
  f.Q.value = q;
  f.connect(dest);
  return f;
}

/** 立ち上がり→減衰 の包絡(打楽器・撥弦) */
function perc(g: GainNode, t: number, peak: number, attack: number, decay: number): number {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return t + attack + decay + 0.02;
}

/** 立ち上がり→保持→余韻 の包絡(管・パッド) */
function sustain(g: GainNode, t: number, peak: number, attack: number, dur: number, release: number, level = 0.85): number {
  const holdEnd = t + Math.max(dur, attack + 0.02);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(peak * level, Math.min(holdEnd, t + attack + 0.15));
  g.gain.setValueAtTime(peak * level, holdEnd);
  g.gain.exponentialRampToValueAtTime(0.0001, holdEnd + release);
  return holdEnd + release + 0.02;
}

function noise(rig: Rig, t: number, end: number, dest: AudioNode, rand: () => number): void {
  const src = rig.ctx.createBufferSource();
  src.buffer = rig.noise;
  src.loop = true;
  src.connect(dest);
  src.start(t, rand() * 1.5);
  src.stop(end);
  source(src, end);
}

function vibrato(ctx: BaseAudioContext, targets: OscillatorNode[], t: number, end: number, rate: number, cents: number, delay: number): void {
  const lfo = track(ctx.createOscillator());
  lfo.frequency.value = rate;
  const depth = track(ctx.createGain());
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(0, t + delay);
  depth.gain.linearRampToValueAtTime(cents, t + delay + 0.3);
  lfo.connect(depth);
  for (const o of targets) depth.connect(o.detune);
  lfo.start(t);
  lfo.stop(end);
}

function synth(rig: Rig, dest: AudioNode, inst: InstName, t: number, midi: number, dur: number, vel: number, rand: () => number): void {
  voiceNodes = [];
  lastSource = null;
  lastEnd = 0;
  play(rig, dest, inst, t, midi, dur, vel, rand);
  const nodes = voiceNodes;
  const last = lastSource as AudioScheduledSourceNode | null; // play() の中で入る
  if (last) last.onended = () => nodes.forEach((n) => n.disconnect());
}

function play(rig: Rig, dest: AudioNode, inst: InstName, t: number, midi: number, dur: number, vel: number, rand: () => number): void {
  const ctx = rig.ctx;
  const f = hz(midi);
  switch (inst) {
    case 'pluck': {
      // リュート: のこぎり波+三角波を、閉じていくフィルターで弾いた音に
      const g = gainNode(ctx, dest);
      const lp = filter(ctx, 'lowpass', Math.min(f * 9, 7000), 1.8, g);
      lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.3, 180), t + 0.3);
      const decay = Math.min(1.2, Math.max(0.22, dur * 1.4 + 0.08));
      const end = perc(g, t, vel, 0.004, decay);
      osc(ctx, 'sawtooth', f, t, end, lp);
      if (dur > 0.2) osc(ctx, 'triangle', f, t, end, lp, 6);
      break;
    }
    case 'harp': {
      const g = gainNode(ctx, dest);
      const lp = filter(ctx, 'lowpass', 4200, 0.7, g);
      const end = perc(g, t, vel, 0.003, 1.7);
      osc(ctx, 'triangle', f, t, end, lp);
      const h = gainNode(ctx, lp, 0.22);
      osc(ctx, 'sine', f * 2, t, end, h);
      break;
    }
    case 'pad':
    case 'strings': {
      // 温かいパッド: ずらした2本ののこぎり波を柔らかく
      const g = gainNode(ctx, dest);
      const lp = filter(ctx, 'lowpass', inst === 'pad' ? 1100 : 2200, 0.6, g);
      const end = sustain(g, t, vel, inst === 'pad' ? 0.45 : 0.25, dur, 0.7, 0.9);
      const a = osc(ctx, 'sawtooth', f, t, end, lp, -8);
      const b = osc(ctx, 'sawtooth', f, t, end, lp, 8);
      if (inst === 'strings') vibrato(ctx, [a, b], t, end, 5, 6, 0.2);
      break;
    }
    case 'choir': {
      // 声のようなパッド: 母音「あ」の帯域を強める
      const g = gainNode(ctx, dest);
      const mix = gainNode(ctx, g, 1);
      const f1 = filter(ctx, 'bandpass', 800, 2.5, g);
      const f2 = filter(ctx, 'lowpass', 550, 0.5, g);
      mix.disconnect();
      mix.connect(f1);
      mix.connect(f2);
      const end = sustain(g, t, vel * 1.6, 0.5, dur, 0.9, 0.95);
      const oscs = [-9, 9].map((d) => osc(ctx, 'sawtooth', f, t, end, mix, d));
      vibrato(ctx, oscs, t, end, 4.6, 8, 0.3);
      break;
    }
    case 'bass': {
      const g = gainNode(ctx, dest);
      const lp = filter(ctx, 'lowpass', f * 7, 2.5, g);
      lp.frequency.setValueAtTime(f * 7, t);
      lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + 0.18);
      const end = sustain(g, t, vel, 0.006, Math.max(0.05, dur * 0.85), 0.08, 0.7);
      osc(ctx, 'triangle', f, t, end, lp);
      const s = gainNode(ctx, lp, 0.45);
      osc(ctx, 'sawtooth', f, t, end, s);
      break;
    }
    case 'subBass': {
      // 重いベース: のこぎり波を歪ませ気味に(ボス・地域3)
      const g = gainNode(ctx, dest);
      const lp = filter(ctx, 'lowpass', f * 5, 4, g);
      lp.frequency.setValueAtTime(f * 9, t);
      lp.frequency.exponentialRampToValueAtTime(f * 3, t + 0.12);
      const end = sustain(g, t, vel, 0.004, Math.max(0.05, dur * 0.8), 0.05, 0.75);
      osc(ctx, 'sawtooth', f, t, end, lp);
      osc(ctx, 'sine', f, t, end, g);
      break;
    }
    case 'flute': {
      // 笛: 正弦波+少しの三角波、遅れてかかるビブラート、吹き始めの息
      const g = gainNode(ctx, dest);
      const lp = filter(ctx, 'lowpass', f * 6, 0.5, g);
      const end = sustain(g, t, vel, 0.05, dur * 0.92, 0.14, 0.82);
      const a = osc(ctx, 'sine', f, t, end, lp);
      const b = osc(ctx, 'triangle', f, t, end, gainNode(ctx, lp, 0.35), 3);
      vibrato(ctx, [a, b], t, end, 5.4, 12, Math.min(0.25, dur * 0.4));
      const chiffG = gainNode(ctx, dest);
      const chiffEnd = perc(chiffG, t, vel * 0.18, 0.005, 0.06);
      noise(rig, t, chiffEnd, filter(ctx, 'bandpass', f * 2.5, 2, chiffG), rand);
      break;
    }
    case 'horn': {
      // 金管: フィルターが開いて少し閉じる「パァー」
      const g = gainNode(ctx, dest);
      const lp = filter(ctx, 'lowpass', f * 1.5, 1.4, g);
      lp.frequency.setValueAtTime(f * 1.2, t);
      lp.frequency.linearRampToValueAtTime(Math.min(f * 5, 6000), t + 0.06);
      lp.frequency.linearRampToValueAtTime(Math.min(f * 3, 4500), t + 0.25);
      const end = sustain(g, t, vel, 0.035, dur * 0.95, 0.12, 0.8);
      const a = osc(ctx, 'sawtooth', f, t, end, lp, -4);
      const b = osc(ctx, 'sawtooth', f, t, end, lp, 4);
      a.frequency.setValueAtTime(f * 0.985, t);
      a.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      vibrato(ctx, [a, b], t, end, 5, 7, Math.min(0.3, dur * 0.5));
      break;
    }
    case 'stab': {
      const g = gainNode(ctx, dest);
      const lp = filter(ctx, 'lowpass', f * 8, 2, g);
      lp.frequency.setValueAtTime(Math.min(f * 10, 8000), t);
      lp.frequency.exponentialRampToValueAtTime(f * 2, t + 0.22);
      const end = perc(g, t, vel, 0.006, Math.min(0.35, dur + 0.1));
      osc(ctx, 'sawtooth', f, t, end, lp, -9);
      osc(ctx, 'sawtooth', f, t, end, lp, 9);
      break;
    }
    case 'bell': {
      // グロッケン: 1 : 2.76 : 5.4 の倍音(整数でないので鐘らしく聞こえる)
      const out = gainNode(ctx, dest, vel);
      const parts: [number, number, number][] = [
        [1, 1, 1.6],
        [2.76, 0.22, 0.4],
        [5.4, 0.08, 0.15],
      ];
      for (const [r, a, d] of parts) {
        const g = gainNode(ctx, out);
        const end = perc(g, t, a, 0.002, d);
        osc(ctx, 'sine', f * r, t, end, g);
      }
      break;
    }
    case 'marimba': {
      const out = gainNode(ctx, dest, vel);
      const g1 = gainNode(ctx, out);
      osc(ctx, 'sine', f, t, perc(g1, t, 1, 0.002, 0.55), g1);
      const g2 = gainNode(ctx, out);
      osc(ctx, 'sine', f * 4, t, perc(g2, t, 0.25, 0.001, 0.05), g2);
      break;
    }
    case 'kick':
    case 'bigKick': {
      const big = inst === 'bigKick';
      const g = gainNode(ctx, dest);
      const end = perc(g, t, vel, 0.002, big ? 0.5 : 0.32);
      const o = osc(ctx, 'sine', big ? 160 : 150, t, end, g);
      o.frequency.exponentialRampToValueAtTime(big ? 42 : 50, t + (big ? 0.16 : 0.12));
      const cg = gainNode(ctx, dest);
      noise(rig, t, perc(cg, t, vel * 0.3, 0.001, 0.015), filter(ctx, 'highpass', 1500, 0.7, cg), rand);
      break;
    }
    case 'snare':
    case 'clap':
    case 'rim': {
      if (inst === 'clap') {
        for (let i = 0; i < 3; i++) {
          const g = gainNode(ctx, dest);
          const tt = t + i * 0.011;
          noise(rig, tt, perc(g, tt, vel * (i === 2 ? 1 : 0.6), 0.001, i === 2 ? 0.16 : 0.012), filter(ctx, 'bandpass', 1500, 0.8, g), rand);
        }
        break;
      }
      if (inst === 'rim') {
        const g = gainNode(ctx, dest);
        osc(ctx, 'triangle', 820, t, perc(g, t, vel, 0.001, 0.05), filter(ctx, 'bandpass', 1600, 3, g));
        break;
      }
      const g = gainNode(ctx, dest);
      noise(rig, t, perc(g, t, vel, 0.001, 0.19), filter(ctx, 'highpass', 900, 0.6, g), rand);
      const tg = gainNode(ctx, dest);
      const o = osc(ctx, 'triangle', 200, t, perc(tg, t, vel * 0.7, 0.001, 0.09), tg);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      break;
    }
    case 'hat':
    case 'openHat':
    case 'shaker': {
      const g = gainNode(ctx, dest);
      const decay = inst === 'openHat' ? 0.28 : inst === 'shaker' ? 0.07 : 0.045;
      const attack = inst === 'shaker' ? 0.02 : 0.001;
      const hp = filter(ctx, inst === 'shaker' ? 'bandpass' : 'highpass', inst === 'shaker' ? 6000 : 6500, inst === 'shaker' ? 1.2 : 0.7, g);
      noise(rig, t, perc(g, t, vel, attack, decay), hp, rand);
      break;
    }
    case 'tom':
    case 'taiko':
    case 'timpani':
    case 'frame': {
      // 太鼓類: 音の高さが少し下がる正弦波 + 皮の雑音
      const base = inst === 'taiko' ? 70 : inst === 'timpani' ? (midi ? hz(midi) : 87) : inst === 'frame' ? 105 : midi ? hz(midi) : 130;
      const decay = inst === 'taiko' ? 0.6 : inst === 'timpani' ? 0.9 : inst === 'frame' ? 0.32 : 0.35;
      const g = gainNode(ctx, dest);
      const end = perc(g, t, vel, 0.003, decay);
      const o = osc(ctx, 'sine', base * 1.5, t, end, g);
      o.frequency.exponentialRampToValueAtTime(base, t + 0.05);
      if (inst === 'timpani') osc(ctx, 'sine', base * 1.5, t, end, gainNode(ctx, g, 0.3));
      const ng = gainNode(ctx, dest);
      noise(rig, t, perc(ng, t, vel * (inst === 'frame' ? 0.5 : 0.35), 0.002, inst === 'taiko' ? 0.15 : 0.08), filter(ctx, 'lowpass', inst === 'frame' ? 1800 : 900, 0.8, ng), rand);
      break;
    }
    case 'crash': {
      const g = gainNode(ctx, dest);
      const end = perc(g, t, vel, 0.002, 1.8);
      noise(rig, t, end, filter(ctx, 'highpass', 4500, 0.5, g), rand);
      break;
    }
  }
}

// ---------------------------------------------------------------- 曲

/** 地域・ボス共通: 節の終わりのドラムのつなぎ */
function fill(b: Bar, heavy: boolean): void {
  if (heavy) {
    b.drums('snare', '........x.x.XxXx');
    b.note('tom', 50, 8, 1, 0.8);
    b.note('tom', 45, 12, 1, 0.9);
    b.note('tom', 41, 14, 1, 1);
  } else {
    b.drums('snare', '............oxXx');
  }
}

const TITLE: TrackDef = {
  // 3/4 拍子・ニ長調。ハープの分散和音の上で笛が歌う、やさしい英雄の民謡。
  bpm: 92,
  steps: 12,
  key: 'D',
  scale: 'major',
  sections: {
    A: {
      bars: 8,
      chords: 'D | G | Bm | A | G | D/F# | Em | A',
      lines: {
        lead: 'F#4:4 A4:4 D5:4 | B4:6 A4:2 G4:4 | F#4:4 D5:4 C#5:2 B4:2 | A4:12 | B4:4 D5:4 G5:4 | F#5:6 E5:2 D5:4 | E5:4 G5:4 F#5:2 E5:2 | E5:8 r:4',
      },
    },
    B: {
      bars: 8,
      chords: 'Bm | G | D | A | Bm | G | Em | A',
      lines: {
        lead: 'D5:4 F#5:4 B5:4 | B5:6 A5:2 G5:4 | F#5:4 A5:4 D5:4 | E5:6 F#5:2 E5:4 | D5:4 C#5:4 B4:4 | D5:6 B4:2 G4:4 | G4:4 B4:4 E5:4 | E5:4 C#5:4 A4:4',
      },
    },
    A2: {
      bars: 8,
      chords: 'D | G | Bm | A | G | D/F# | Em A | D',
      lines: {
        lead: 'F#4:4 A4:4 D5:4 | B4:6 A4:2 G4:4 | F#4:4 D5:4 C#5:2 B4:2 | A4:12 | B4:4 D5:4 G5:4 | F#5:6 E5:2 D5:4 | E5:4 G5:2 F#5:2 E5:4 | D5:12',
        bell: 'r:4 A5:4 F#5:4 | r:4 D6:4 B5:4 | r:4 F#5:4 D6:4 | r:4 E6:4 C#6:4 | r:4 D6:4 B5:4 | r:4 A5:4 D6:4 | r:4 B5:4 A5:4 | r:4 F#5:8',
      },
    },
  },
  form: ['A', 'B', 'A2'],
  arrange(b) {
    b.arp('harp', '0-2-4-5-4-2-', 50, 0.85);
    b.bass(b.name === 'A' ? 'R-----------' : 'R-------5---', 'bass', 0.6, 38);
    b.line('flute', 'lead');
    if (b.name !== 'A' || b.pass > 0) b.hold('strings', 57, 0.55);
    if (b.name === 'A' && b.pass > 0) b.line('horn', 'lead', { oct: -12, vel: 0.4 });
    if (b.name === 'A2') b.line('bell', 'bell', { vel: 0.7 });
    if (b.name !== 'A' || b.pass > 0) {
      b.drums('frame', 'X.......o...', 0.7);
      b.drums('shaker', 'o.x.o.x.o.x.', 0.6);
    }
    if (b.name === 'B' && b.last) b.drums('frame', '........o.x.', 0.6);
  },
};

const REGION1: TrackDef = {
  // ト長調の行進曲。小太鼓の刻み・オンパのベース・リュートの刻みの上で笛、2回目は角笛のハモり。
  bpm: 110,
  steps: 16,
  key: 'G',
  scale: 'major',
  sections: {
    intro: { bars: 2, chords: 'G | D' },
    A: {
      bars: 8,
      chords: 'G | C | G | D | G | C | Am D | G',
      lines: {
        lead: 'D5:3 B4:1 G4:2 B4:2 D5:4 G5:4 | E5:3 D5:1 C5:2 E5:2 G5:4 E5:4 | D5:3 B4:1 D5:2 G5:2 B5:4 A5:4 | F#5:4 E5:2 D5:2 A4:8 | B4:3 C5:1 D5:2 B4:2 G5:4 D5:4 | E5:3 F#5:1 G5:2 E5:2 C5:4 E5:4 | C5:2 E5:2 A5:4 F#5:2 E5:2 D5:2 F#5:2 | G5:4 D5:2 B4:2 G4:8',
      },
    },
    A2: {
      bars: 8,
      chords: 'G | C | G | D | G | C | Am D | G',
      lines: {
        lead: 'D5:3 B4:1 G4:2 B4:2 D5:4 G5:4 | E5:3 D5:1 C5:2 E5:2 G5:4 E5:4 | D5:3 B4:1 D5:2 G5:2 B5:4 A5:4 | F#5:4 E5:2 D5:2 A4:8 | B4:3 C5:1 D5:2 B4:2 G5:4 D5:4 | E5:3 F#5:1 G5:2 E5:2 C5:4 E5:4 | C5:2 E5:2 A5:4 F#5:2 E5:2 D5:2 F#5:2 | G5:4 D5:2 B4:2 G4:8',
      },
    },
    B: {
      bars: 8,
      chords: 'Em | C | G | D | Em | C | Am | D',
      lines: {
        lead: 'B4:4 E5:4 G5:6 F#5:2 | E5:4 C5:4 G4:8 | B4:4 D5:4 G5:6 A5:2 | F#5:8 D5:4 A4:4 | G5:4 F#5:2 E5:2 B5:6 A5:2 | G5:4 E5:2 C5:2 E5:4 G5:4 | A5:4 G5:2 E5:2 C5:4 E5:4 | A5:4 F#5:4 E5:2 F#5:2 D5:4',
      },
    },
  },
  form: ['intro', 'A', 'A2', 'B'],
  loopFrom: 1,
  arrange(b) {
    const n = b.name;
    b.drums('kick', n === 'B' ? 'X.......X...x...' : 'X.......x.......');
    if (b.last && n !== 'intro') fill(b, false);
    else b.drums('snare', n === 'A2' ? '..o.X..o..o.X.oo' : '....X.......X..o', 0.9);
    b.drums(n === 'B' ? 'hat' : 'shaker', 'x.o.x.o.x.o.x.o.');
    if (b.first && n !== 'intro') b.note('crash', 0, 0, 1, 0.8);
    b.bass(n === 'B' ? 'R-.R5-..R-.R5-.5' : 'R-..5-..R-..5-..', 'bass', 0.9, 36);
    b.strum('pluck', '..x...x...x...x.', 55, 0.8, 2);
    if (n === 'A' || n === 'A2') b.line('flute', 'lead');
    if (n === 'A2') {
      b.line('horn', 'lead', { harmony: -2, vel: 0.55, oct: -12 });
      b.line('bell', 'lead', { oct: 12, vel: 0.5, only: (x) => x.step % 8 === 0 });
    }
    if (n === 'B') {
      b.line('horn', 'lead', { vel: 0.85 });
      b.hold('strings', 55, 0.7);
      b.arp('harp', '0.1.2.3.4.3.2.1.', 67, 0.4);
    }
    if (n === 'A' && b.pass > 0) b.arp('harp', '0...2...4...2...', 67, 0.45);
  },
};

const REGION2: TrackDef = {
  // ニ短調(ドリア旋法)、少しはねる沼のグルーヴ。マリンバ・暗いパッド・オカリナのような笛・しずくのベル。
  bpm: 96,
  steps: 16,
  key: 'D',
  scale: 'dorian',
  swing: 0.16,
  sections: {
    A0: { bars: 8, chords: 'Dm7 | G | Dm7 | G | Fmaj7 | Em7 | Dm7 | Asus4 A' },
    A: {
      bars: 8,
      chords: 'Dm7 | G | Dm7 | G | Fmaj7 | Em7 | Dm7 | Asus4 A',
      lines: {
        lead: 'r:4 A4:2 C5:2 D5:4 r:2 F5:2 | E5:6 D5:2 B4:4 r:4 | r:4 A4:2 C5:2 D5:2 F5:2 A5:4 | G5:4 F5:2 E5:2 D5:8 | r:2 C5:2 E5:2 F5:2 A5:6 G5:2 | G5:4 E5:4 B4:8 | r:2 D5:2 F5:2 E5:2 D5:2 C5:2 A4:4 | D5:6 E5:2 C#5:8',
      },
    },
    B: {
      bars: 8,
      chords: 'Bbmaj7 | C | Am7 | Dm7 | Bbmaj7 | C | Em7 | A7',
      lines: {
        lead: 'F5:4 D5:2 F5:2 A5:6 F5:2 | G5:6 E5:2 C5:8 | E5:4 C5:2 E5:2 G5:4 A5:4 | F5:6 E5:2 D5:8 | D6:4 A5:2 F5:2 D5:4 F5:4 | E5:4 G5:4 C6:6 B5:2 | B5:4 G5:2 E5:2 D5:4 B4:4 | C#5:6 E5:2 G5:4 A5:4',
      },
    },
  },
  form: ['A0', 'A', 'B', 'A'],
  arrange(b) {
    const n = b.name;
    b.drums('kick', n === 'B' ? 'X......x..X...x.' : 'X......x..X.....');
    b.drums(n === 'A0' ? 'rim' : 'clap', '....x.......x...', 0.9);
    b.drums('hat', 'x.oxx.oxx.oxx.ox', 0.9);
    if (n !== 'A0') b.drums('shaker', '..o...o...o...o.', 0.8);
    if (b.last) b.drums('tom', '..........o.x.x.', 0.7, 45);
    b.bass('R--8..5-..7-R-5.', 'bass', 0.9, 38);
    b.hold('pad', 57, 0.8);
    if (n === 'A0' || b.pass % 2 === 1) b.arp('marimba', '0..2..1..3..2.4.', 62, 0.7);
    if (n === 'A' || n === 'B') b.line('flute', 'lead', { vel: 0.9 });
    if (n === 'B') b.line('marimba', 'lead', { oct: -12, vel: 0.45 });
    if (n === 'A' && b.pass % 2 === 1) b.line('bell', 'lead', { oct: 12, vel: 0.3, only: (x) => x.len >= 6 });
    // 沼のしずく: 決まった乱数でまばらにベル
    const drops = [62, 65, 67, 69, 72, 74, 77];
    if (b.rand() < 0.7) b.note('bell', drops[Math.floor(b.rand() * drops.length)] + 12, 2 + Math.floor(b.rand() * 12), 2, 0.35);
  },
};

const REGION3: TrackDef = {
  // ホ短調の速い戦いの曲。16分で刻む撥弦の型・8分のベース・弦の刻み・合唱の上で金管が鳴る。
  bpm: 128,
  steps: 16,
  key: 'E',
  scale: 'minor',
  sections: {
    I: { bars: 8, chords: 'Em | C | D | B | Em | C | Am | B' },
    A: {
      bars: 8,
      chords: 'Em | C | D | B | Em | C | Am | B',
      lines: {
        lead: 'E5:4 r:2 B4:2 E5:4 G5:4 | G5:6 F#5:2 E5:8 | F#5:4 r:2 D5:2 F#5:4 A5:4 | A5:6 G5:2 F#5:8 | B5:4 r:2 G5:2 E5:4 B5:4 | C6:6 B5:2 G5:4 E5:4 | A5:4 G5:2 F#5:2 E5:4 C5:4 | D#5:8 F#5:4 B4:4',
      },
    },
    B: {
      bars: 8,
      chords: 'Am | C | D | Em | Am | C | B | B7',
      lines: {
        lead: 'E5:8 A5:8 | G5:8 E5:4 C5:4 | D5:4 F#5:4 A5:8 | G5:6 F#5:2 E5:8 | C6:8 B5:4 A5:4 | G5:8 E5:4 G5:4 | F#5:8 D#5:4 F#5:4 | B5:12 r:4',
      },
    },
  },
  form: ['I', 'A', 'B', 'A'],
  arrange(b) {
    const n = b.name;
    const busy = n !== 'I' || b.index >= 4;
    b.drums('kick', n === 'B' ? 'X..xX...X..xX.x.' : 'X...x...X...x...');
    if (busy) {
      if (b.last) fill(b, true);
      else b.drums('snare', '....X.......X...');
    }
    b.drums('hat', 'xoxoxoxoxoxoxoxo', 0.8);
    if (b.first) b.note('crash', 0, 0, 1, n === 'I' ? 0.6 : 1);
    b.bass('R-R-R-R-R-R-8-R-', 'subBass', 0.85, 28);
    b.arp('pluck', '0121012101210123', 52, 0.55);
    if (n !== 'I') b.strum('stab', n === 'B' ? 'X..X..X...X..X..' : 'X.....x.X.....x.', 55, 0.8, 2);
    if (n === 'B' || (n === 'A' && b.pass > 0)) b.hold('choir', 59, 0.8);
    if (n === 'A' || n === 'B') b.line('horn', 'lead');
    if (n === 'A' && b.pass > 0) b.line('bell', 'lead', { oct: 12, vel: 0.35, only: (x) => x.len >= 4 });
    if (n === 'B') b.line('strings', 'lead', { oct: -12, vel: 0.6 });
  },
};

const BOSS: TrackDef = {
  // ニ短調、速く重い。大太鼓の連打・和太鼓・16分のベース・金管の和音・合唱。bII(E♭)で不穏に。
  bpm: 152,
  steps: 16,
  key: 'D',
  scale: 'minor',
  sections: {
    A: {
      bars: 8,
      chords: 'Dm | Bb | Gm | A | Dm | Eb | Gm | A7',
      lines: {
        lead: 'D5:2 D5:2 F5:2 A5:6 G5:2 F5:2 | F5:6 E5:2 D5:4 Bb4:4 | G4:2 Bb4:2 D5:2 G5:6 F5:2 D5:2 | E5:6 C#5:2 A4:8 | D5:2 D5:2 F5:2 A5:6 Bb5:2 A5:2 | G5:6 Eb5:2 Bb4:8 | D5:4 G5:4 Bb5:4 A5:2 G5:2 | A5:8 C#5:4 E5:4',
      },
    },
    B: {
      bars: 8,
      chords: 'Bb | C | Dm | Dm | Bb | C | A | A7',
      lines: {
        lead: 'F5:8 D6:8 | C6:6 Bb5:2 G5:8 | A5:4 F5:4 D5:4 F5:4 | A5:16 | D6:6 C6:2 Bb5:8 | C6:6 Bb5:2 G5:8 | A5:4 E5:4 C#5:4 E5:4 | A5:8 r:8',
      },
    },
  },
  form: ['A', 'B', 'A'],
  arrange(b) {
    const n = b.name;
    b.drums('bigKick', n === 'B' ? 'XxXxX.x.XxXxX.x.' : 'X..xX..xX..xX.xx', 0.9);
    if (b.last) fill(b, true);
    else b.drums('snare', b.pass > 0 && n === 'A' ? '....X..o....X.oo' : '....X.......X...');
    b.drums('taiko', n === 'B' ? 'X.....X.X.....X.' : 'X.........X.....', 0.9);
    b.drums(n === 'B' ? 'openHat' : 'hat', n === 'B' ? '..x...x...x...x.' : 'x.x.x.x.x.x.x.x.', 0.9);
    if (b.first || (n === 'B' && b.index === 4)) b.note('crash', 0, 0, 1, 1);
    b.bass('R-RRR-RRR-RRR-88', 'subBass', 0.8, 26);
    b.arp('pluck', '0121312101213121', 50, 0.5);
    b.strum('stab', 'X..X..X.....X...', 57, 0.9, 2);
    b.hold('choir', 57, 0.9);
    b.line('horn', 'lead');
    if (b.pass > 0 || n === 'B') b.line('bell', 'lead', { oct: 12, vel: 0.3, only: (x) => x.len >= 4 });
    if (b.last && n === 'B') b.drums('timpani', 'X.x.x.x.XxXxXxXx', 0.6, 38);
  },
};

const VICTORY: TrackDef = {
  // ハ長調の短いファンファーレ(1回だけ)
  bpm: 120,
  steps: 16,
  key: 'C',
  scale: 'major',
  loop: false,
  sections: {
    V: {
      bars: 2,
      chords: 'C C F G | C',
      lines: { lead: 'C5:2 E5:2 G5:2 C6:6 A5:2 B5:2 | C6:12 r:4' },
    },
  },
  form: ['V'],
  arrange(b) {
    b.line('horn', 'lead');
    b.line('horn', 'lead', { harmony: -2, vel: 0.6 });
    b.line('flute', 'lead', { vel: 0.6 });
    if (b.first) {
      b.drums('timpani', 'X.x.x.x.X...X.xx', 0.8, 36);
      b.drums('snare', '....o.o.o.o.xxXx', 0.7);
      b.hold('strings', 55, 0.6);
    } else {
      b.note('crash', 0, 0, 1, 1);
      b.note('timpani', 36, 0, 4, 1);
      b.note('bigKick', 0, 0, 1, 0.8);
      b.strum('pluck', 'X...............', 55, 1, 12);
      b.arp('bell', '01234567........', 72, 0.6);
      b.hold('strings', 55, 0.7);
      b.note('bass', 36, 0, 12, 1);
    }
  },
};

const DEFEAT: TrackDef = {
  // イ短調の悲しい終止(1回だけ)
  bpm: 72,
  steps: 16,
  key: 'A',
  scale: 'minor',
  loop: false,
  sections: {
    D: {
      bars: 2,
      chords: 'Am Dm | E Am',
      lines: { lead: 'E5:4 C5:4 F5:4 D5:4 | B4:6 G#4:2 A4:8' },
    },
  },
  form: ['D'],
  arrange(b) {
    b.line('flute', 'lead', { vel: 0.9 });
    b.hold('strings', 52, 0.6);
    b.arp('harp', '0-1-2-3-0-1-2-3-', 45, 0.5);
    b.bass('R-------R-------', 'bass', 0.8, 33);
    if (b.first) b.note('timpani', 33, 0, 4, 0.6);
  },
};

const LOOKAHEAD = 0.35;

export const TRACKS: Record<TrackName, TrackDef> = {
  title: TITLE,
  region1: REGION1,
  region2: REGION2,
  region3: REGION3,
  boss: BOSS,
  victory: VICTORY,
  defeat: DEFEAT,
};

/** 曲の書き間違い(小節の長さ・和音)を確かめる。テストから呼ぶ。 */
export function validateTracks(): void {
  for (const track of Object.values(TRACKS)) for (const key of track.form) parseSection(key, track);
}

/**
 * 検証用: OfflineAudioContext に曲を seconds 秒分予約する(startRendering の前に呼ぶ)。
 * 本番と同じく少し先までずつ予約するため、suspend() で区切りながら足していく。
 */
export function renderTrack(ctx: OfflineAudioContext, output: AudioNode, name: TrackName, seconds: number): Player {
  const rig = createRig(ctx, output);
  const p = new Player(rig, name, TRACKS[name], 0.05);
  p.scheduleUntil(LOOKAHEAD);
  const quantum = 128 / ctx.sampleRate;
  for (let t = 0.25; t < seconds; t += 0.25) {
    const at = Math.round(t / quantum) * quantum;
    void ctx.suspend(at).then(() => {
      p.scheduleUntil(at + LOOKAHEAD, false, at);
      void ctx.resume();
    });
  }
  return p;
}

// ---------------------------------------------------------------- ゲームから使う窓口


class Music {
  /** 効果音より小さめ */
  volume = 0.42;
  muted = false;
  private rig: Rig | null = null;
  private gain: GainNode | null = null;
  private players: Player[] = [];
  private current: Player | null = null;
  private wanted: { name: TrackName; fade: number } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    sfx.onUnlock(() => this.attach());
  }

  /** いま鳴っている(鳴らそうとしている)曲 */
  get playing(): TrackName | null {
    return this.current && !this.current.stopping ? this.current.name : (this.wanted?.name ?? null);
  }

  /** 最初の操作の時に呼ぶ。AudioContext は効果音と共有する。 */
  unlock(): void {
    sfx.unlock();
    this.attach();
  }

  /** 曲を流す。同じ曲が流れていれば何もしない。前の曲とは fade 秒で入れ替わる。 */
  play(name: TrackName, opts: { fade?: number } = {}): void {
    const fade = opts.fade ?? 1.2;
    const rig = this.rig;
    if (!rig) {
      this.wanted = { name, fade };
      return;
    }
    if (this.current && this.current.name === name && !this.current.stopping) return;
    const now = rig.ctx.currentTime;
    const stinger = TRACKS[name].loop === false;
    const prev = this.current;
    const outFade = stinger ? Math.min(fade, 0.35) : fade;
    if (prev) prev.fadeOut(now, outFade);
    // 前の曲が半分以上消えてから次を入れる(2曲が重なって聞こえないように)
    const start = now + 0.05 + (prev ? outFade * 0.6 : 0);
    this.current = new Player(rig, name, TRACKS[name], start, stinger ? 0 : prev ? Math.min(0.6, fade * 0.5) : 0.4);
    this.players.push(this.current);
    this.tick();
  }

  stop(fade = 1): void {
    this.wanted = null;
    if (this.current && this.rig) this.current.fadeOut(this.rig.ctx.currentTime, fade);
    this.current = null;
  }

  /** 音楽だけを消す(全体の消音は sfx.setMuted。どちらでも音楽は止まる)。 */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyGain();
  }

  private applyGain(): void {
    if (this.gain && this.rig) this.gain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.rig.ctx.currentTime, 0.05);
  }

  private attach(): void {
    if (this.rig) return;
    const ctx = sfx.context;
    const input = sfx.musicInput;
    if (!ctx || !input) return;
    this.gain = ctx.createGain();
    this.gain.gain.value = this.muted ? 0 : this.volume;
    this.gain.connect(input);
    this.rig = createRig(ctx, this.gain);
    this.timer = setInterval(() => this.tick(), 50);
    if (this.wanted) {
      const w = this.wanted;
      this.wanted = null;
      this.play(w.name, { fade: w.fade });
    }
  }

  private tick(): void {
    const rig = this.rig;
    if (!rig || this.timer === null) return;
    const now = rig.ctx.currentTime;
    // 消音中は音を作らずに時間だけ進める(処理を軽く)
    const silent = this.muted || sfx.muted;
    for (const p of this.players) p.scheduleUntil(now + LOOKAHEAD, silent, now);
    this.players = this.players.filter((p) => {
      if (!p.finished(now)) return true;
      p.dispose();
      if (this.current === p) this.current = null;
      return false;
    });
  }
}

export const music = new Music();
