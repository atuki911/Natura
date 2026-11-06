import { type V2 } from './rng.ts';

const STEP = 0.25;

function crPoint(p0: V2, p1: V2, p2: V2, p3: V2, t: number): V2 {
  // centripetal Catmull-Rom (Barry & Goldman)
  const a = 0.5;
  const d = (p: V2, q: V2) => Math.max(1e-4, Math.pow(Math.hypot(q.x - p.x, q.y - p.y), a));
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const L = (P: V2, Q: V2, ta: number, tb: number): V2 => {
    const w = (tt - ta) / (tb - ta);
    return { x: P.x + (Q.x - P.x) * w, y: P.y + (Q.y - P.y) * w };
  };
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}

export class Path {
  readonly pts: V2[] = [];
  readonly length: number;
  readonly ctrl: V2[];

  constructor(ctrl: V2[]) {
    this.ctrl = ctrl;
    const dense: V2[] = [];
    const n = ctrl.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1];
      const p3 = ctrl[Math.min(n - 1, i + 2)];
      const p0e = i === 0 ? { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y } : p0;
      const p3e = i + 2 >= n ? { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y } : p3;
      const segs = Math.max(8, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 6));
      for (let s = 0; s < segs; s++) dense.push(crPoint(p0e, p1, p2, p3e, s / segs));
    }
    dense.push({ ...ctrl[n - 1] });
    // resample uniformly
    this.pts.push({ ...dense[0] });
    let acc = 0;
    let total = 0;
    for (let i = 1; i < dense.length; i++) {
      const a = dense[i - 1], b = dense[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      let pos = 0;
      while (acc + (seg - pos) >= STEP) {
        const need = STEP - acc;
        pos += need;
        const w = pos / seg;
        this.pts.push({ x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w });
        acc = 0;
      }
      acc += seg - pos;
      total += seg;
    }
    this.pts.push({ ...dense[dense.length - 1] });
    this.length = (this.pts.length - 2) * STEP + acc;
    void total;
  }

  /** position at distance d along path, with unit direction */
  at(d: number, out?: { x: number; y: number; dx: number; dy: number }) {
    const o = out ?? { x: 0, y: 0, dx: 1, dy: 0 };
    const f = Math.max(0, Math.min(d, this.length)) / STEP;
    let i = Math.floor(f);
    if (i >= this.pts.length - 1) i = this.pts.length - 2;
    const w = Math.min(1, f - i);
    const a = this.pts[i], b = this.pts[i + 1];
    o.x = a.x + (b.x - a.x) * w;
    o.y = a.y + (b.y - a.y) * w;
    let dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    o.dx = dx; o.dy = dy;
    return o;
  }

  /** nearest point on the path: returns along-path distance and lateral distance */
  nearest(p: V2): { d: number; dist: number } {
    let best = Infinity, bi = 0;
    for (let i = 0; i < this.pts.length; i++) {
      const q = this.pts[i];
      const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (dd < best) { best = dd; bi = i; }
    }
    return { d: bi * STEP, dist: Math.sqrt(best) };
  }
}
