import { emptyUpgrades, type UpgradeState, UPGRADES } from './data/upgrades.ts';
import { STAGES } from './data/stages.ts';

export interface StageProgress { stars: number; heroic: boolean; iron: boolean }
export interface SaveData {
  v: 1;
  progress: StageProgress[];
  upgrades: UpgradeState;
  heroXp: Record<string, number>;
  hero: string;
  seen: string[];
  difficulty: number;
  sfx: number;
  music: number;
  quality: 'high' | 'low';
  tutorialDone: boolean;
}

const KEY = 'kokko-fortress-save-v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    progress: STAGES.map(() => ({ stars: 0, heroic: false, iron: false })),
    upgrades: emptyUpgrades(),
    heroXp: { kokka: 0, bomba: 0, miko: 0, gardon: 0 },
    hero: 'kokka',
    seen: [],
    difficulty: 1,
    sfx: 0.8,
    music: 0.5,
    quality: 'high',
    tutorialDone: false,
  };
}

let mem: SaveData | null = null;

export function load(): SaveData {
  if (mem) return mem;
  let d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      d = { ...d, ...p, upgrades: { ...d.upgrades, ...(p.upgrades ?? {}) }, heroXp: { ...d.heroXp, ...(p.heroXp ?? {}) } };
      while (d.progress.length < STAGES.length) d.progress.push({ stars: 0, heroic: false, iron: false });
    }
  } catch { /* storage unavailable: play without persistence */ }
  mem = d;
  return d;
}

export function save() {
  if (!mem) return;
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* ignore */ }
}

export function resetSave() {
  mem = defaultSave();
  save();
}

export function totalStars(d: SaveData): number {
  return d.progress.reduce((a, p) => a + p.stars + (p.heroic ? 1 : 0) + (p.iron ? 1 : 0), 0);
}
export function spentStars(d: SaveData): number {
  let s = 0;
  for (const t of UPGRADES) for (let i = 0; i < d.upgrades[t.id]; i++) s += t.levels[i].cost;
  return s;
}
export function stageUnlocked(d: SaveData, i: number): boolean {
  return i === 0 || d.progress[i - 1].stars > 0;
}
