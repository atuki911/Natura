import type Phaser from 'phaser';
import { ART_SCALE } from './layout.ts';
import { FONT } from './palette.ts';
import { sfx } from './sfx.ts';

// ボタンと文字の共通部品。

const S = 1 / ART_SCALE;

export interface TextStyle {
  size?: number;
  color?: string;
  stroke?: number;
  align?: 'left' | 'center' | 'right';
}

export function label(scene: Phaser.Scene, x: number, y: number, text: string, style: TextStyle = {}): Phaser.GameObjects.Text {
  const size = style.size ?? 18;
  const obj = scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: style.color ?? '#ffffff',
      stroke: '#1c1726',
      strokeThickness: style.stroke ?? Math.max(3, Math.round(size / 4)),
      align: style.align ?? 'center',
    })
    .setResolution(2);
  const ox = style.align === 'left' ? 0 : style.align === 'right' ? 1 : 0.5;
  obj.setOrigin(ox, 0.5);
  return obj;
}

export interface Button {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text | null;
  setEnabled(on: boolean): void;
}

/** 押すと沈み、離すと戻るボタン。 */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  texture: string,
  text: string | null,
  onClick: () => void,
  options: { width?: number; height?: number; size?: number } = {},
): Button {
  const root = scene.add.container(x, y);
  const bg = scene.add.image(0, 0, texture).setScale(S);
  if (options.width) bg.setDisplaySize(options.width, options.height ?? bg.displayHeight);
  root.add(bg);
  let txt: Phaser.GameObjects.Text | null = null;
  if (text !== null) {
    txt = label(scene, 0, -2, text, { size: options.size ?? 22 });
    root.add(txt);
  }
  let enabled = true;
  bg.setInteractive({ useHandCursor: true });
  const baseScale = { x: root.scaleX, y: root.scaleY };
  bg.on('pointerover', () => enabled && scene.tweens.add({ targets: root, scale: 1.05, duration: 90 }));
  bg.on('pointerout', () => scene.tweens.add({ targets: root, scaleX: baseScale.x, scaleY: baseScale.y, duration: 90 }));
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event?.stopPropagation?.();
    sfx.unlock();
    if (!enabled) {
      sfx.play('error');
      return;
    }
    sfx.play('click');
    scene.tweens.add({ targets: root, scaleX: 0.92, scaleY: 0.92, duration: 50, yoyo: true });
    onClick();
  });
  return {
    root,
    bg,
    text: txt,
    setEnabled(on: boolean) {
      enabled = on;
      bg.setAlpha(on ? 1 : 0.55);
      txt?.setAlpha(on ? 1 : 0.6);
    },
  };
}
