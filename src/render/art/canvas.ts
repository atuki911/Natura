import type Phaser from 'phaser';
import { Rng } from '../../sim/rng.ts';
import { ART_SCALE } from '../layout.ts';
import { INK } from '../palette.ts';

export type Ctx = CanvasRenderingContext2D;

/**
 * Canvas 2D で絵を描いてテクスチャにする。
 * 同じ key のテクスチャが既にあれば(assets/ から読み込んだ生成画像など)描かずにそちらを使う。
 * 描く大きさは論理座標(w, h)で指定し、実際は ART_SCALE 倍の解像度で描く。
 */
export function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, Math.ceil(w * ART_SCALE), Math.ceil(h * ART_SCALE));
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.save();
  ctx.scale(ART_SCALE, ART_SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  ctx.restore();
  texture.refresh();
}

export function rng(seed: number): Rng {
  return new Rng(seed);
}

/** 塗ってから輪郭線を引く。 */
export function fillStroke(ctx: Ctx, fill: string | CanvasGradient, lineWidth = 3, stroke: string = INK): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/**
 * 図形を塗り、内側に光と影を入れてから輪郭線を引く。
 * path は図形のパスを作る関数(beginPath から呼ぶ)。
 */
export function shaded(
  ctx: Ctx,
  path: () => void,
  base: string,
  options: { light?: string; dark?: string; lineWidth?: number; lightOffset?: [number, number]; box: [number, number, number, number] },
): void {
  const [x, y, w, h] = options.box;
  path();
  ctx.fillStyle = base;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  if (options.dark) {
    ctx.fillStyle = options.dark;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.75, y + h * 0.85, w * 0.7, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (options.light) {
    const [lx, ly] = options.lightOffset ?? [0.32, 0.25];
    ctx.fillStyle = options.light;
    ctx.beginPath();
    ctx.ellipse(x + w * lx, y + h * ly, w * 0.28, h * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  path();
  ctx.lineWidth = options.lineWidth ?? 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** でこぼこした丸いパス(粘体・木の葉・雲)。 */
export function blobPath(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, r: Rng, points = 10, amp = 0.12): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + (r.next() * 2 - 1) * amp;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  smoothClosed(ctx, pts);
}

/** 点の並びを通るなめらかな閉じた曲線。 */
export function smoothClosed(ctx: Ctx, pts: [number, number][]): void {
  ctx.beginPath();
  const n = pts.length;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function poly(ctx: Ctx, pts: [number, number][]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** 色を明るく(amt>0)・暗く(amt<0)する。 */
export function tint(color: string, amt: number): string {
  const n = parseInt(color.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgba(color: string, alpha: number): string {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** やわらかい光の円(加算で重ねる用)。 */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.4, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
