// 提出先(CrazyGames・Poki など)の SDK とのつなぎ目。
// 今は何もしない。提出の段階で、提出先ごとの実装をここに入れる(ゲーム側のコードは変えない)。

export interface Platform {
  /** 遊び始めた(広告を止める合図)。 */
  gameplayStart(): void;
  /** 遊びが止まった(ポーズ・結果画面)。 */
  gameplayStop(): void;
  /** 大きな成功の瞬間(勝利など)。 */
  happyTime(): void;
  /** 報酬つき広告。見終わったら true。 */
  rewardedAd(): Promise<boolean>;
}

export const platform: Platform = {
  gameplayStart() {},
  gameplayStop() {},
  happyTime() {},
  async rewardedAd() {
    return false;
  },
};
