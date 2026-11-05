import Phaser from 'phaser';
import { ENDLESS_STAGE, REGIONS, STAGES } from '../data/stages.ts';
import { getLang, t } from '../i18n.ts';
import { loadSave } from '../save.ts';
import type { StageDef } from '../sim/types.ts';
import { ART_SCALE, DEPTH, VIEW, setupCamera } from './layout.ts';
import { INK_HEX } from './palette.ts';
import { sfx } from './sfx.ts';
import { addUpgradeButton } from './UpgradeScene.ts';
import { button, label } from './widgets.ts';

// ステージ選択の地図。3つの地域に3ステージずつ。前のステージを1度でも勝つと次が開く。

const S = 1 / ART_SCALE;

export function isUnlocked(stage: StageDef, stars: Record<string, number>): boolean {
  const i = STAGES.indexOf(stage);
  return i <= 0 || (stars[STAGES[i - 1].id] ?? 0) > 0;
}

export class MapScene extends Phaser.Scene {
  private focus: string | undefined;

  constructor() {
    super('map');
  }

  init(data: { focus?: string }): void {
    this.focus = data?.focus;
  }

  create(): void {
    setupCamera(this);
    const L = t();
    const lang = getLang();
    const stars = loadSave().bestStars;
    this.add.image(0, 0, 'bg_stage1').setOrigin(0, 0).setScale(S).setAlpha(0.35);
    const shade = this.add.graphics();
    shade.fillStyle(0x14121f, 0.7);
    shade.fillRect(0, 0, VIEW.width, VIEW.height);
    label(this, VIEW.width / 2, 56, L.selectStage, { size: 40, color: '#e8ffd0' });

    // 次に遊ぶステージ(まだ勝っていない最初のステージ)
    const nextId = this.focus ?? STAGES.find((s) => !(stars[s.id] > 0) && isUnlocked(s, stars))?.id;

    REGIONS.forEach((region, ri) => {
      const cx = 230 + ri * 410;
      const top = 110;
      const card = this.add.graphics();
      card.fillStyle(0x232a3c, 0.95);
      card.lineStyle(4, INK_HEX, 1);
      card.fillRoundedRect(cx - 190, top, 380, 500, 18);
      card.strokeRoundedRect(cx - 190, top, 380, 500, 18);
      const stagesInRegion = STAGES.filter((s) => s.region === region.id);
      const regionOpen = stagesInRegion.some((s) => isUnlocked(s, stars));
      const bgKey = stagesInRegion[0].background;
      const thumb = this.add.image(cx, top + 14, this.textures.exists(bgKey) ? bgKey : 'bg_stage1').setOrigin(0.5, 0);
      thumb.setDisplaySize(352, 198);
      if (!regionOpen) thumb.setTint(0x555066);
      const frame = this.add.graphics();
      frame.lineStyle(3, INK_HEX, 1);
      frame.strokeRoundedRect(cx - 176, top + 14, 352, 198, 8);
      label(this, cx, top + 236, `${region.id}. ${region.name[lang]}`, { size: 24, color: regionOpen ? '#ffe9a8' : '#8a8498' });

      stagesInRegion.forEach((stage, si) => {
        const y = top + 290 + si * 70;
        const open = isUnlocked(stage, stars);
        const got = stars[stage.id] ?? 0;
        const isNext = stage.id === nextId;
        const key = !open ? 'btn_stone' : isNext ? 'btn_green' : got > 0 ? 'btn_gold' : 'btn_green';
        const b = button(
          this,
          cx,
          y,
          key,
          null,
          () => {
            if (!open) return;
            sfx.unlock();
            this.scene.start('battle', { mode: 'play', stageId: stage.id });
          },
          { width: 340, height: 60 },
        );
        b.setEnabled(open);
        b.root.add(label(this, -150, -3, stage.id, { size: 22, align: 'left' }));
        b.root.add(label(this, -98, -3, open ? stage.name[lang] : L.locked, { size: 20, align: 'left', color: open ? '#ffffff' : '#c8c4d4' }));
        if (open) {
          const starText = '★'.repeat(got) + '☆'.repeat(3 - got);
          b.root.add(label(this, 150, -3, starText, { size: 20, align: 'right', color: got > 0 ? '#ffe28a' : '#d8e4ff' }));
        }
        if (isNext) this.tweens.add({ targets: b.root, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
    });

    const total = STAGES.reduce((sum, s) => sum + (stars[s.id] ?? 0), 0);
    label(this, VIEW.width - 40, 660, `★ ${total} / ${STAGES.length * 3}`, { size: 24, align: 'right', color: '#ffe28a' }).setDepth(DEPTH.hud);
    button(this, 110, 660, 'btn_stone', L.back, () => this.scene.start('title'), { width: 160, height: 50, size: 20 });
    // 強化(葉で買う、戦闘をまたぐ成長)への入口
    addUpgradeButton(this, VIEW.width / 2 - 130, 660);
    // 耐久モード(1-3 を勝つと開く)
    const endlessOpen = (stars['1-3'] ?? 0) > 0;
    const best = loadSave().bestEndless ?? 0;
    const endless = button(
      this,
      VIEW.width / 2 + 150,
      660,
      endlessOpen ? 'btn_red' : 'btn_stone',
      endlessOpen ? `${L.endless}  ${L.best} ${best}` : `${L.endless}  🔒 1-3`,
      () => {
        if (!endlessOpen) return;
        sfx.unlock();
        this.scene.start('battle', { mode: 'play', stageId: ENDLESS_STAGE.id });
      },
      { width: 250, height: 50, size: 18 },
    );
    endless.setEnabled(endlessOpen);
  }
}
