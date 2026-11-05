import type { Lang } from './i18n.ts';

// 進み具合と設定の保存。ブラウザの保存が使えない時(プライベートモード等)も、遊べなくはならないようにする。

export interface SaveData {
  bestStars: Record<string, number>;
  muted: boolean;
  lang: Lang | null;
  tutorialDone: boolean;
}

const KEY = 'natura.save.v1';

const defaults = (): SaveData => ({ bestStars: {}, muted: false, lang: null, tutorialDone: false });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    return defaults();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 保存できなくても続ける
  }
}

export function updateSave(change: (data: SaveData) => void): SaveData {
  const data = loadSave();
  change(data);
  writeSave(data);
  return data;
}
