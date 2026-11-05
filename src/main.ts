import '@fontsource/lilita-one/400.css';
import Phaser from 'phaser';
import { setLang, t } from './i18n.ts';
import { BattleScene } from './render/BattleScene.ts';
import { BootScene } from './render/BootScene.ts';
import { CANVAS } from './render/layout.ts';
import { sfx } from './render/sfx.ts';
import { MapScene } from './render/MapScene.ts';
import { TitleScene } from './render/TitleScene.ts';
import { loadSave } from './save.ts';

async function start(): Promise<void> {
  const save = loadSave();
  if (save.lang) setLang(save.lang);
  sfx.setMuted(save.muted);
  // ロゴと文字はフォントが読み込まれてから描く
  try {
    await Promise.race([document.fonts.load('40px "Lilita One"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    // フォントが無くても続ける
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: CANVAS.width,
    height: CANVAS.height,
    backgroundColor: '#14121f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 2 },
    scene: [BootScene, TitleScene, MapScene, BattleScene],
  });
  // 検証ツール(tools/screenshot.mjs)から状態を読めるようにする
  (window as unknown as { __natura: Phaser.Game }).__natura = game;
  window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
  addRotateHint();
}

/** スマホを縦に持っている時は、横にしてもらう案内を出す。 */
function addRotateHint(): void {
  const style = document.createElement('style');
  style.textContent = `#rotate-hint{display:none;position:fixed;inset:0;z-index:20;background:#14121f;color:#e8ffd0;font:24px "Lilita One",sans-serif;align-items:center;justify-content:center;text-align:center;padding:24px}
@media (orientation: portrait) and (max-width: 900px){#rotate-hint{display:flex}}`;
  document.head.appendChild(style);
  const hint = document.createElement('div');
  hint.id = 'rotate-hint';
  hint.textContent = `⟳ ${t().rotate}`;
  document.body.appendChild(hint);
}

void start();
