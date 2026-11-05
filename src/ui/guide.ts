// Hand-pointer tutorial overlay: dims the screen, spotlights a target and taps it with an animated hand.
// Every element ignores pointer events, so the player taps the real control underneath.

export interface GuideTarget { x: number; y: number; r: number; w?: number; h?: number }

const HAND = `<svg viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg"><g stroke="#2b1a10" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
<path d="M22 6 C22 2 30 2 30 6 L30 34 L33 33 C33 28 41 28 41 33 L41 36 C41 31 49 31 49 36 L49 39 C49 35 57 35 57 40 L57 58 C57 70 49 77 39 77 L30 77 C22 77 17 72 13 64 L5 48 C3 43 9 40 12 44 L22 56 Z" fill="#fff"/>
<path d="M30 34 L30 46 M41 36 L41 46 M49 39 L49 47" fill="none"/></g>
<ellipse cx="26" cy="9" rx="2.5" ry="1.5" fill="#ffd0c0"/></svg>`;

export class Guide {
  private root: HTMLElement;
  private spot: HTMLElement;
  private hand: HTMLElement;
  private ripple: HTMLElement;
  private bubble: HTMLElement;
  private getTarget: (() => GuideTarget | null) | null = null;
  private text = '';
  private dim = true;
  visible = false;
  private preferBelow = false;
  private skipBtn!: HTMLElement;
  onSkip: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'guide';
    this.root.innerHTML = `<div class="guide-spot"></div><div class="guide-ripple"></div><div class="guide-hand">${HAND}</div><div class="guide-bubble panel"></div><button class="guide-skip btn small wood">チュートリアルを飛ばす</button>`;
    this.skipBtn = this.root.querySelector('.guide-skip') as HTMLElement;
    this.skipBtn.onclick = () => this.onSkip?.();
    this.spot = this.root.querySelector('.guide-spot')!;
    this.hand = this.root.querySelector('.guide-hand')!;
    this.ripple = this.root.querySelector('.guide-ripple')!;
    this.bubble = this.root.querySelector('.guide-bubble')!;
    this.root.style.display = 'none';
    parent.appendChild(this.root);
  }

  /** show (or keep showing) a step. Calling again with the same text only updates the target. */
  show(text: string, target: () => GuideTarget | null, opts: { dim?: boolean; skip?: boolean; below?: boolean } = {}) {
    this.getTarget = target;
    this.preferBelow = !!opts.below;
    this.dim = opts.dim !== false;
    if (text !== this.text) {
      this.text = text;
      this.bubble.innerHTML = `<div>${text}</div>`;
      this.skipBtn.style.display = opts.skip !== false && this.onSkip ? '' : 'none';
      this.bubble.classList.remove('guide-pop');
      void this.bubble.offsetWidth;
      this.bubble.classList.add('guide-pop');
    }
    this.root.style.display = 'block';
    this.visible = true;
    this.update();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.text = '';
    this.getTarget = null;
    this.root.style.display = 'none';
  }

  update() {
    if (!this.visible || !this.getTarget) return;
    const t = this.getTarget();
    if (!t) { this.root.style.visibility = 'hidden'; return; }
    this.root.style.visibility = 'visible';
    const r = Math.max(26, t.r);
    const hw = t.w ? t.w / 2 : r, hh = t.h ? t.h / 2 : r;
    Object.assign(this.spot.style, { left: t.x - hw + 'px', top: t.y - hh + 'px', width: hw * 2 + 'px', height: hh * 2 + 'px', borderRadius: t.w ? '22px' : '50%' });
    this.spot.classList.toggle('dim', this.dim);
    Object.assign(this.ripple.style, { left: t.x + 'px', top: t.y + 'px' });
    // hand comes from the lower right, fingertip on the target; flip when near the right/bottom edge
    const flipX = t.x > window.innerWidth - 110;
    const flipY = t.y > window.innerHeight - 120;
    this.hand.style.left = t.x + 'px';
    this.hand.style.top = t.y + 'px';
    this.hand.style.transform = `translate(${flipX ? '-75%' : '-38%'}, ${flipY ? '-100%' : '0'}) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`;
    // bubble: above the target when there is room, otherwise below
    const bw = Math.min(300, window.innerWidth - 24);
    this.bubble.style.width = bw + 'px';
    const bh = this.bubble.offsetHeight;
    const below = t.y + hh + 96, above = t.y - hh - 18 - bh;
    const fitsAbove = above >= 10, fitsBelow = below + bh <= window.innerHeight - 8;
    let by: number, bx: number;
    if (fitsAbove || fitsBelow) {
      by = (this.preferBelow && fitsBelow) || !fitsAbove ? below : above;
      bx = Math.max(12, Math.min(window.innerWidth - bw - 12, t.x - bw / 2));
    } else {
      // short screens: put the bubble beside the target so it never covers it
      const right = t.x + hw + 70, left = t.x - hw - 24 - bw;
      bx = right + bw <= window.innerWidth - 8 ? right : Math.max(8, left);
      by = Math.max(10, Math.min(window.innerHeight - bh - 8, t.y - bh / 2));
    }
    this.bubble.style.left = bx + 'px';
    this.bubble.style.top = by + 'px';
  }
}

export function rectTarget(el: Element | null | undefined, pad = 6): GuideTarget | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const t: GuideTarget = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 + pad };
  if (r.width > r.height * 1.4) { t.w = r.width + pad * 2; t.h = r.height + pad * 2; t.r = t.h / 2; }
  return t;
}
