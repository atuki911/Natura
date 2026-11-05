import type { Lang } from './i18n.ts';

// 進み具合と設定の保存。ブラウザの保存が使えない時(プライベートモード等)も、遊べなくはならないようにする。

export interface SaveData {
  bestStars: Record<string, number>;
  muted: boolean;
  lang: Lang | null;
  tutorialDone: boolean;
  /** 強化に使う通貨「葉」。 */
  leaves: number;
  /** 強化の id → 買った段数。 */
  upgrades: Record<string, number>;
  /** 1度でも勝ったステージ(初回の葉を1度だけ渡すため)。 */
  cleared: Record<string, boolean>;
  /** 葉に換えた星の数。bestStars とは別に持つ(結果の画面がどちらを先に書いても二重にならない)。 */
  rewardedStars: Record<string, number>;
}

const KEY = 'natura.save.v1';

export const defaultSave = (): SaveData => ({
  bestStars: {},
  muted: false,
  lang: null,
  tutorialDone: false,
  leaves: 0,
  upgrades: {},
  cleared: {},
  rewardedStars: {},
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    return defaultSave();
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
