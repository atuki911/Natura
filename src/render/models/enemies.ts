import * as THREE from 'three';
import { MB, part, type RigDef, type RigPart, type Vec3 } from '../builder.ts';

// ───────── blobs ─────────
function blob(o: { color: number; dark: number; r: number; crown?: boolean; crust?: number; teeth?: boolean; glow?: boolean }): RigDef {
  const mb = new MB();
  const r = o.r;
  mb.sphere(r, o.color, [0, r * 0.82, 0], [1.08, 0.85, 1.05], 18);
  mb.sphere(r * 0.75, o.dark, [0, r * 0.35, 0], [1.25, 0.45, 1.25], 14);
  mb.sphere(r * 0.22, 0xffffff, [-r * 0.42, r * 1.25, r * 0.35], [1, 0.6, 0.6], 8);
  mb.eye(r * 0.2, [r * 0.3, r * 0.98, r * 0.78], [0.2, 0, 1]);
  mb.eye(r * 0.2, [-r * 0.3, r * 0.98, r * 0.78], [-0.2, 0, 1]);
  mb.sphere(r * 0.28, 0x3a1020, [0, r * 0.6, r * 0.86], [1.3, 0.55, 0.4], 10);
  if (o.teeth) {
    mb.cone(r * 0.06, r * 0.14, 0xffffff, [r * 0.12, r * 0.7, r * 0.95], [Math.PI, 0, 0], 5);
    mb.cone(r * 0.06, r * 0.14, 0xffffff, [-r * 0.12, r * 0.7, r * 0.95], [Math.PI, 0, 0], 5);
  }
  if (o.crust) {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, y = 0.6 + (i % 3) * 0.3;
      mb.dodeca(r * 0.2, o.crust, [Math.cos(a) * r * 0.85, r * y, Math.sin(a) * r * 0.85 - r * 0.1], [1, 0.6, 1]);
    }
  }
  if (o.crown) {
    mb.cyl(r * 0.42, r * 0.48, r * 0.3, 0xffcc33, [0, r * 1.62, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      mb.cone(r * 0.08, r * 0.22, 0xffcc33, [Math.cos(a) * r * 0.42, r * 1.86, Math.sin(a) * r * 0.42], [0, 0, 0], 5);
      mb.sphere(r * 0.05, i % 2 ? 0xe53935 : 0x42a5f5, [Math.cos(a) * r * 0.46, r * 1.62, Math.sin(a) * r * 0.46], [1, 1, 1], 6);
    }
  }
  return { body: mb.build(), parts: [], height: r * 1.7 };
}

// ───────── spiky ball ─────────
function spikeball(color: number, spike: number, r: number): RigDef {
  const mb = new MB();
  mb.sphere(r, color, [0, r, 0], [1, 1, 1], 18);
  const n = 22;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    const dir: Vec3 = [Math.cos(th) * rad, y, Math.sin(th) * rad];
    if (dir[2] > 0.55 && dir[1] < 0.5 && dir[1] > -0.4) continue; // keep the face clear
    const pos: Vec3 = [dir[0] * r, r + dir[1] * r, dir[2] * r];
    coneAlong(mb, r * 0.2, r * 0.55, spike, pos, dir);
  }
  mb.eye(r * 0.24, [r * 0.3, r * 1.25, r * 0.82], [0.2, 0, 1], 0x1a1410, 0xfff27a);
  mb.eye(r * 0.24, [-r * 0.3, r * 1.25, r * 0.82], [-0.2, 0, 1], 0x1a1410, 0xfff27a);
  mb.sphere(r * 0.42, 0x3a0d22, [0, r * 0.78, r * 0.78], [1.2, 0.6, 0.5]);
  for (let i = -2; i <= 2; i++) mb.cone(r * 0.07, r * 0.18, 0xffffff, [i * r * 0.15, r * 0.98, r * 0.92], [Math.PI, 0, 0], 4);
  return { body: mb.build(), parts: [], height: r * 2.2 };
}

function coneAlong(mb: MB, r: number, h: number, color: number, pos: Vec3, dir: Vec3) {
  const g = new THREE.ConeGeometry(r, h, 7);
  g.translate(0, h / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  mb.add(g, color, pos, [e.x, e.y, e.z]);
}

// ───────── bipeds ─────────
interface BipedOpts {
  skin: number; body?: number; size: number; belly?: number;
  headR?: number; torso?: Vec3; armLen?: number; legLen?: number; arms?: number; legs?: number;
  extra?: (mb: MB, s: number, headY: number) => void;
  hand?: (mb: MB, s: number, side: number) => void;
  eyeColor?: number; eyes?: number; mouth?: boolean; hunch?: number;
}
function biped(o: BipedOpts): RigDef {
  const s = o.size;
  const mb = new MB();
  const tor = o.torso ?? [0.42, 0.5, 0.36];
  const legLen = (o.legLen ?? 0.35) * s;
  const hipY = legLen + 0.05 * s;
  const torsoY = hipY + tor[1] * s * 0.5;
  const body = o.body ?? o.skin;
  mb.sphere(tor[0] * s, body, [0, torsoY, 0], [1, tor[1] / tor[0], tor[2] / tor[0]]);
  if (o.belly) mb.sphere(tor[0] * s * 0.75, o.belly, [0, torsoY - 0.05 * s, tor[2] * s * 0.45], [1, tor[1] / tor[0] * 0.9, 0.6]);
  const headR = (o.headR ?? 0.3) * s;
  const headY = torsoY + tor[1] * s * 0.75 + headR * 0.5 - (o.hunch ?? 0) * s;
  const headZ = (o.hunch ?? 0) * s * 0.8;
  mb.sphere(headR, o.skin, [0, headY, headZ]);
  const ec = o.eyeColor ?? 0xffffff;
  if ((o.eyes ?? 2) === 1) mb.eye(headR * 0.42, [0, headY + headR * 0.15, headZ + headR * 0.78], [0, 0, 1], 0x1a1410, ec);
  else if ((o.eyes ?? 2) > 0) {
    mb.eye(headR * 0.28, [headR * 0.38, headY + headR * 0.15, headZ + headR * 0.8], [0.2, 0, 1], 0x1a1410, ec);
    mb.eye(headR * 0.28, [-headR * 0.38, headY + headR * 0.15, headZ + headR * 0.8], [-0.2, 0, 1], 0x1a1410, ec);
  }
  if (o.mouth !== false) mb.sphere(headR * 0.35, 0x3a1020, [0, headY - headR * 0.38, headZ + headR * 0.82], [1.2, 0.45, 0.4], 8);
  o.extra?.(mb, s, headY);
  const shoulderY = torsoY + tor[1] * s * 0.45;
  const armLen = (o.armLen ?? 0.45) * s;
  const arm = (side: number) => part(side > 0 ? 'armR' : 'armL', [side * tor[0] * s * 0.95, shoulderY, 0], (m) => {
    m.capsule(0.09 * s, armLen, o.arms ?? o.skin, [side * 0.04 * s, -armLen * 0.55, 0]);
    m.sphere(0.12 * s, o.arms ?? o.skin, [side * 0.05 * s, -armLen * 1.1, 0.02 * s]);
    o.hand?.(m, s, side);
  });
  const leg = (side: number) => part(side > 0 ? 'legR' : 'legL', [side * tor[0] * s * 0.45, hipY, 0], (m) => {
    m.capsule(0.11 * s, legLen * 0.7, o.legs ?? o.skin, [0, -legLen * 0.5, 0]);
    m.sphere(0.13 * s, o.legs ?? o.skin, [0, -legLen + 0.05 * s, 0.06 * s], [1, 0.6, 1.3]);
  });
  return { body: mb.build(), parts: [arm(-1), arm(1), leg(-1), leg(1)], height: headY + headR + 0.1 * s };
}

// ───────── quadrupeds ─────────
interface QuadOpts {
  fur: number; belly?: number; size: number; len?: number; legLen?: number; headR?: number; snout?: number; ears?: 'point' | 'round' | 'none';
  tail?: 'bushy' | 'thin' | 'none' | 'nine'; tailColor?: number; legColor?: number; eyeColor?: number;
  extra?: (mb: MB, s: number) => void;
}
function quad(o: QuadOpts): RigDef {
  const s = o.size;
  const mb = new MB();
  const len = (o.len ?? 0.7) * s;
  const legLen = (o.legLen ?? 0.32) * s;
  const bodyY = legLen + 0.22 * s;
  mb.capsule(0.26 * s, len, o.fur, [0, bodyY, 0], [Math.PI / 2, 0, 0]);
  if (o.belly) mb.capsule(0.2 * s, len * 0.8, o.belly, [0, bodyY - 0.08 * s, 0.02 * s], [Math.PI / 2, 0, 0]);
  const headR = (o.headR ?? 0.26) * s;
  const hz = len * 0.5 + headR * 0.9, hy = bodyY + 0.2 * s;
  mb.sphere(headR, o.fur, [0, hy, hz]);
  mb.sphere(headR * 0.55, o.belly ?? o.fur, [0, hy - headR * 0.25, hz + headR * (0.7 + (o.snout ?? 0.4))], [0.9, 0.75, 1.3]);
  mb.sphere(headR * 0.16, 0x1a1410, [0, hy - headR * 0.1, hz + headR * (1.25 + (o.snout ?? 0.4))]);
  mb.eye(headR * 0.26, [headR * 0.42, hy + headR * 0.25, hz + headR * 0.68], [0.35, 0, 1], 0x1a1410, o.eyeColor ?? 0xffffff);
  mb.eye(headR * 0.26, [-headR * 0.42, hy + headR * 0.25, hz + headR * 0.68], [-0.35, 0, 1], 0x1a1410, o.eyeColor ?? 0xffffff);
  if (o.ears !== 'none') {
    const round = o.ears === 'round';
    for (const sd of [-1, 1]) {
      if (round) mb.sphere(headR * 0.3, o.fur, [sd * headR * 0.6, hy + headR * 0.8, hz - headR * 0.1], [1, 1, 0.5]);
      else mb.cone(headR * 0.28, headR * 0.7, o.fur, [sd * headR * 0.55, hy + headR * 0.95, hz - headR * 0.1], [0, 0, -sd * 0.25], 6);
    }
  }
  const tc = o.tailColor ?? o.fur;
  if (o.tail === 'bushy') {
    mb.sphere(0.16 * s, tc, [0, bodyY + 0.2 * s, -len * 0.5 - 0.25 * s], [1, 1, 2.2]);
    mb.sphere(0.1 * s, 0xffffff, [0, bodyY + 0.3 * s, -len * 0.5 - 0.6 * s]);
  } else if (o.tail === 'thin') {
    mb.cyl(0.04 * s, 0.06 * s, 0.5 * s, tc, [0, bodyY + 0.1 * s, -len * 0.5 - 0.25 * s], [-1.1, 0, 0]);
  } else if (o.tail === 'nine') {
    const base = new THREE.Vector3(0, bodyY + 0.1 * s, -len * 0.5 - 0.1 * s);
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.32;
      const d = new THREE.Vector3(Math.sin(a) * 0.9, 0.55 + Math.cos(a) * 0.45, -0.55).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      const e = new THREE.Euler().setFromQuaternion(q);
      const mid = base.clone().addScaledVector(d, 0.42 * s);
      const tip = base.clone().addScaledVector(d, 0.82 * s);
      mb.sphere(0.12 * s, tc, [mid.x, mid.y, mid.z], [1, 1, 3.2], 10, [e.x, e.y, e.z]);
      mb.sphere(0.1 * s, 0xfff2ff, [tip.x, tip.y, tip.z], [1, 1, 1.6], 8, [e.x, e.y, e.z]);
    }
  }
  o.extra?.(mb, s);
  const lc = o.legColor ?? o.fur;
  const legs: RigPart[] = [];
  const pos: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  pos.forEach(([sx, sz], i) => {
    legs.push(part('leg' + i, [sx * 0.16 * s, bodyY - 0.05 * s, sz * len * 0.42], (m) => {
      m.capsule(0.08 * s, legLen * 0.8, lc, [0, -legLen * 0.5, 0]);
      m.sphere(0.09 * s, lc, [0, -legLen - 0.04 * s + 0.08 * s, 0.03 * s], [1, 0.7, 1.2]);
    }));
  });
  return { body: mb.build(), parts: legs, height: hy + headR + 0.2 * s };
}

// ───────── flyers ─────────
interface FlyOpts {
  color: number; belly?: number; size: number; wing: number; wingSpan?: number; wingShape?: 'bat' | 'bird' | 'bug' | 'dragon';
  extra?: (mb: MB, s: number) => void; float?: number;
}
function flyer(o: FlyOpts): RigDef {
  const s = o.size;
  const mb = new MB();
  o.extra?.(mb, s);
  const span = (o.wingSpan ?? 0.6) * s;
  const wing = (side: number) => part(side > 0 ? 'wingR' : 'wingL', [side * 0.22 * s, 0.1 * s, 0], (m) => {
    switch (o.wingShape) {
      case 'bat':
        m.box(span, 0.03 * s, 0.4 * s, o.wing, [side * span * 0.5, 0, -0.05 * s], [0, 0, 0], 0.01);
        for (let k = 0; k < 3; k++) m.cone(0.08 * s, 0.18 * s, o.wing, [side * span * (0.3 + k * 0.3), 0, -0.25 * s], [-Math.PI / 2, 0, 0], 4);
        break;
      case 'bug':
        m.sphere(span * 0.5, o.wing, [side * span * 0.5, 0.05 * s, -0.05 * s], [1, 0.08, 0.45]);
        break;
      case 'dragon':
        m.box(span, 0.04 * s, 0.6 * s, o.wing, [side * span * 0.5, 0, -0.1 * s], [0, 0, 0], 0.01);
        m.cyl(0.04 * s, 0.04 * s, span, o.color, [side * span * 0.5, 0.03 * s, 0.2 * s], [0, 0, Math.PI / 2]);
        for (let k = 0; k < 3; k++) m.cone(0.12 * s, 0.25 * s, o.wing, [side * span * (0.3 + k * 0.32), 0, -0.45 * s], [-Math.PI / 2, 0, 0], 4);
        break;
      default:
        m.sphere(span * 0.5, o.wing, [side * span * 0.5, 0, -0.05 * s], [1, 0.12, 0.42]);
        for (let k = 0; k < 3; k++) m.sphere(0.08 * s, o.wing, [side * span * (0.75 + k * 0.08), 0, -0.12 * s - k * 0.06 * s], [1.6, 0.3, 0.6]);
    }
  });
  return { body: mb.build(), parts: [wing(-1), wing(1)], height: 0.8 * s, float: o.float ?? 2.0 };
}

// ───────── serpents ─────────
function serpentRig(o: { color: number; belly: number; size: number; segs: number; head: (mb: MB, s: number) => void }): RigDef {
  const s = o.size;
  const mb = new MB();
  o.head(mb, s);
  const parts: RigPart[] = [];
  for (let i = 0; i < o.segs; i++) {
    const r = 0.22 * s * (1 - i / (o.segs + 2));
    parts.push(part('seg' + i, [0, 0, -0.35 * s * (i + 1)], (m) => {
      m.sphere(r, o.color, [0, r, 0], [1, 0.9, 1.25]);
      m.sphere(r * 0.75, o.belly, [0, r * 0.45, 0], [1.1, 0.5, 1.2]);
      if (i % 2 === 0) m.sphere(r * 0.35, o.belly, [0, r * 1.75, 0], [1, 0.4, 1]);
    }));
  }
  return { body: mb.build(), parts, height: 0.8 * s };
}

// ───────── spider ─────────
function spider(s: number): RigDef {
  const mb = new MB();
  mb.sphere(0.42 * s, 0x6b5a3a, [0, 0.62 * s, -0.4 * s], [1, 0.85, 1.15]);
  for (let i = 0; i < 6; i++) mb.cone(0.07 * s, 0.25 * s, 0x8c6c8c, [Math.cos(i) * 0.25 * s, 0.98 * s, -0.4 * s + Math.sin(i * 2) * 0.2 * s], [0.2 * Math.sin(i), 0, 0.3 * Math.cos(i)], 5);
  mb.sphere(0.12 * s, 0xd46a8a, [0.2 * s, 0.75 * s, -0.75 * s]);
  mb.sphere(0.32 * s, 0x7a6a48, [0, 0.55 * s, 0.12 * s]);
  mb.eye(0.1 * s, [0.12 * s, 0.68 * s, 0.38 * s], [0.2, 0, 1], 0x1a1410, 0xfff27a);
  mb.eye(0.1 * s, [-0.12 * s, 0.68 * s, 0.38 * s], [-0.2, 0, 1], 0x1a1410, 0xfff27a);
  mb.eye(0.06 * s, [0.24 * s, 0.6 * s, 0.33 * s], [0.4, 0, 1], 0x1a1410, 0xfff27a);
  mb.eye(0.06 * s, [-0.24 * s, 0.6 * s, 0.33 * s], [-0.4, 0, 1], 0x1a1410, 0xfff27a);
  mb.sphere(0.1 * s, 0x3a1020, [0, 0.45 * s, 0.4 * s], [1.4, 0.6, 0.6]);
  mb.sphere(0.07 * s, 0xff6f91, [0, 0.38 * s, 0.46 * s], [1, 0.5, 1.4]);
  mb.cone(0.04 * s, 0.14 * s, 0xf5f0e0, [0.08 * s, 0.36 * s, 0.42 * s], [Math.PI, 0, 0], 5);
  mb.cone(0.04 * s, 0.14 * s, 0xf5f0e0, [-0.08 * s, 0.36 * s, 0.42 * s], [Math.PI, 0, 0], 5);
  const parts: RigPart[] = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const z = (0.25 - k * 0.2) * s;
    parts.push(part('leg' + i, [side * 0.25 * s, 0.55 * s, z], (m) => {
      const ang = (k - 1.5) * 0.35;
      m.cyl(0.045 * s, 0.04 * s, 0.5 * s, 0x5a4a30, [side * 0.22 * s, 0.12 * s, Math.sin(ang) * 0.2 * s], [Math.sin(ang) * 0.3, 0, -side * 1.0]);
      m.cyl(0.04 * s, 0.02 * s, 0.6 * s, 0x5a4a30, [side * 0.5 * s, -0.22 * s, Math.sin(ang) * 0.35 * s], [Math.sin(ang) * 0.3, 0, side * 0.35]);
    }));
  }
  return { body: mb.build(), parts, height: 1.1 * s };
}

// ───────── accessories ─────────
const horns = (mb: MB, s: number, y: number, c = 0xf5ecd7, spread = 0.22) => {
  mb.cone(0.07 * s, 0.25 * s, c, [spread * s, y + 0.25 * s, 0], [0, 0, -0.5], 6);
  mb.cone(0.07 * s, 0.25 * s, c, [-spread * s, y + 0.25 * s, 0], [0, 0, 0.5], 6);
};

export const ENEMY_MODELS: Record<string, () => RigDef> = {
  slime: () => blob({ color: 0x7ed957, dark: 0x4caf50, r: 0.42 }),
  bigslime: () => blob({ color: 0x5cc8d6, dark: 0x2f9fb0, r: 0.75, teeth: true }),
  kingslime: () => blob({ color: 0x6fdc5a, dark: 0x3e9e3a, r: 1.55, crown: true, teeth: true }),
  lavaslime: () => blob({ color: 0xff7a2f, dark: 0xd84315, r: 0.8, crust: 0x4a2c25, teeth: true }),
  lavaling: () => blob({ color: 0xffa040, dark: 0xe0561a, r: 0.42, crust: 0x4a2c25 }),
  spore: () => {
    const mb = new MB();
    mb.cyl(0.12, 0.15, 0.25, 0xf5ecd7, [0, 0.13, 0]);
    mb.hemi(0.26, 0xb558d6, [0, 0.25, 0], [1, 0.7, 1]);
    mb.sphere(0.05, 0xffffff, [0.1, 0.38, 0.1]);
    mb.eye(0.05, [0.06, 0.16, 0.12], [0, 0, 1]);
    mb.eye(0.05, [-0.06, 0.16, 0.12], [0, 0, 1]);
    return { body: mb.build(), parts: [part('legL', [-0.06, 0.05, 0], (m) => m.sphere(0.05, 0xf5ecd7)), part('legR', [0.06, 0.05, 0], (m) => m.sphere(0.05, 0xf5ecd7))], height: 0.55 };
  },
  spikeball: () => spikeball(0x9b4fd1, 0xd9b3ff, 0.45),
  spider: () => spider(0.95),
  sprout: () => biped({ skin: 0x8bc34a, body: 0x689f38, size: 0.85, headR: 0.3, torso: [0.25, 0.38, 0.22], eyeColor: 0xfff27a,
    extra: (mb, s, y) => {
      mb.cyl(0.03 * s, 0.03 * s, 0.25 * s, 0x558b2f, [0, y + 0.35 * s, 0]);
      mb.sphere(0.16 * s, 0x9ccc65, [0.12 * s, y + 0.5 * s, 0], [1.4, 0.3, 0.8], 10, [0, 0, -0.4]);
      mb.sphere(0.14 * s, 0x9ccc65, [-0.12 * s, y + 0.45 * s, 0], [1.4, 0.3, 0.8], 10, [0, 0, 0.5]);
      mb.box(0.3 * s, 0.07 * s, 0.05 * s, 0x6a4a8a, [0, y + 0.0 * s, 0.25 * s], [0, 0, 0.2]);
    } }),
  weasel: () => quad({ fur: 0x9b6a3a, belly: 0xf3dcb8, size: 0.8, len: 0.9, legLen: 0.22, snout: 0.5, ears: 'round', tail: 'thin', tailColor: 0x6b4a2a,
    extra: (mb, s) => {
      mb.box(0.5 * s, 0.1 * s, 0.1 * s, 0x2a2a2a, [0, 0.82 * s, 0.75 * s], [0, 0, 0], 0.03);
      mb.sphere(0.2 * s, 0xc8a46b, [0, 0.82 * s, -0.25 * s], [1, 1, 1.1]);
    } }),
  fox: () => quad({ fur: 0xf08a24, belly: 0xffffff, size: 0.9, len: 0.75, legLen: 0.3, snout: 0.6, ears: 'point', tail: 'bushy', legColor: 0x3a2a2a,
    extra: (mb, s) => {
      mb.torus(0.22 * s, 0.05 * s, 0x2f3a5a, [0, 0.98 * s, 0.6 * s], [Math.PI / 2, 0, 0]);
      mb.box(0.08 * s, 0.35 * s, 0.04 * s, 0x2f3a5a, [0.1 * s, 0.95 * s, 0.35 * s], [0.6, 0, 0.3]);
      mb.box(0.06 * s, 0.6 * s, 0.04 * s, 0xd0d6dd, [0.1 * s, 1.0 * s, -0.2 * s], [0.9, 0, 0.5]);
    } }),
  wolf: () => quad({ fur: 0x7d8a96, belly: 0xd5dde4, size: 1.0, len: 0.85, legLen: 0.35, snout: 0.7, ears: 'point', tail: 'bushy', tailColor: 0x5d6a76, eyeColor: 0xfff27a,
    extra: (mb, s) => {
      // goblin rider
      mb.box(0.45 * s, 0.08 * s, 0.4 * s, 0x8a5a2b, [0, 0.82 * s, -0.05 * s], [0, 0, 0], 0.03);
      mb.sphere(0.2 * s, 0x6aa84f, [0, 1.12 * s, -0.05 * s], [1, 1.2, 0.9]);
      mb.sphere(0.17 * s, 0x7cc35a, [0, 1.42 * s, 0.02 * s]);
      mb.cone(0.05 * s, 0.22 * s, 0x7cc35a, [0.18 * s, 1.48 * s, 0], [0, 0, -1.2], 5);
      mb.cone(0.05 * s, 0.22 * s, 0x7cc35a, [-0.18 * s, 1.48 * s, 0], [0, 0, 1.2], 5);
      mb.eye(0.05 * s, [0.06 * s, 1.45 * s, 0.15 * s], [0, 0, 1]);
      mb.eye(0.05 * s, [-0.06 * s, 1.45 * s, 0.15 * s], [0, 0, 1]);
      mb.cyl(0.025 * s, 0.025 * s, 1.1 * s, 0x8a5a2b, [0.25 * s, 1.25 * s, 0.1 * s], [0.6, 0, 0]);
      mb.cone(0.05 * s, 0.15 * s, 0xd0d6dd, [0.25 * s, 1.68 * s, 0.4 * s], [0.6, 0, 0], 5);
    } }),
  hound: () => quad({ fur: 0x2a1f2e, belly: 0x4a3040, size: 1.0, len: 0.85, legLen: 0.36, snout: 0.6, ears: 'point', tail: 'thin', tailColor: 0xff6a1a, eyeColor: 0xff5a1a,
    extra: (mb, s) => {
      for (let i = 0; i < 5; i++) mb.cone(0.08 * s, 0.3 * s, i % 2 ? 0xff8a1a : 0xffd04a, [0, 0.95 * s, 0.35 * s - i * 0.18 * s], [-0.5, 0, 0], 5);
    } }),
  boar: () => quad({ fur: 0x7a4f3a, belly: 0x9a6f5a, size: 1.15, len: 0.8, legLen: 0.26, headR: 0.32, snout: 0.35, ears: 'point', tail: 'thin', eyeColor: 0xffd04a,
    extra: (mb, s) => {
      mb.box(0.62 * s, 0.25 * s, 0.75 * s, 0x8f9aa6, [0, 0.82 * s, -0.05 * s], [0, 0, 0], 0.08);
      for (let i = 0; i < 3; i++) mb.cone(0.05 * s, 0.15 * s, 0xc0c8d0, [0, 1.0 * s, 0.2 * s - i * 0.25 * s], [0, 0, 0], 5);
      mb.cone(0.05 * s, 0.25 * s, 0xfff6e0, [0.14 * s, 0.6 * s, 1.0 * s], [-0.6, 0, -0.3], 6);
      mb.cone(0.05 * s, 0.25 * s, 0xfff6e0, [-0.14 * s, 0.6 * s, 1.0 * s], [-0.6, 0, 0.3], 6);
    } }),
  demonfox: () => quad({ fur: 0xf5f0ff, belly: 0xffffff, size: 2.1, len: 0.85, legLen: 0.34, snout: 0.6, ears: 'point', tail: 'nine', tailColor: 0xb47aff, eyeColor: 0xff3a5a, legColor: 0x6a3a9a,
    extra: (mb, s) => {
      mb.torus(0.24 * s, 0.04 * s, 0xe53935, [0, 0.85 * s, 0.45 * s], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 5; i++) mb.cone(0.035 * s, 0.12 * s, 0xffcc33, [Math.cos(i * 1.2) * 0.12 * s, 1.18 * s, 0.75 * s + Math.sin(i * 1.2) * 0.05 * s], [0, 0, 0], 5);
      mb.sphere(0.06 * s, 0xe53935, [0, 1.0 * s, 1.0 * s]);
    } }),
  bat: () => flyer({ color: 0x5b3a7a, size: 0.8, wing: 0x7a4fa0, wingShape: 'bat', wingSpan: 0.7,
    extra: (mb, s) => {
      mb.sphere(0.26 * s, 0x5b3a7a, [0, 0.1 * s, 0]);
      mb.cone(0.08 * s, 0.22 * s, 0x5b3a7a, [0.14 * s, 0.38 * s, 0], [0, 0, -0.3], 5);
      mb.cone(0.08 * s, 0.22 * s, 0x5b3a7a, [-0.14 * s, 0.38 * s, 0], [0, 0, 0.3], 5);
      mb.eye(0.08 * s, [0.09 * s, 0.15 * s, 0.2 * s], [0, 0, 1], 0x1a1410, 0xffe14a);
      mb.eye(0.08 * s, [-0.09 * s, 0.15 * s, 0.2 * s], [0, 0, 1], 0x1a1410, 0xffe14a);
      mb.cone(0.03 * s, 0.08 * s, 0xffffff, [0.05 * s, -0.02 * s, 0.24 * s], [Math.PI, 0, 0], 4);
      mb.cone(0.03 * s, 0.08 * s, 0xffffff, [-0.05 * s, -0.02 * s, 0.24 * s], [Math.PI, 0, 0], 4);
    } }),
  crow: () => flyer({ color: 0x2a2a3a, size: 0.85, wing: 0x1f1f2e, wingShape: 'bird', wingSpan: 0.8,
    extra: (mb, s) => {
      mb.sphere(0.25 * s, 0x2a2a3a, [0, 0.05 * s, 0], [1, 0.9, 1.4]);
      mb.sphere(0.18 * s, 0x2a2a3a, [0, 0.2 * s, 0.32 * s]);
      mb.cone(0.06 * s, 0.22 * s, 0x5a5a6a, [0, 0.17 * s, 0.55 * s], [Math.PI / 2, 0, 0], 6);
      mb.eye(0.06 * s, [0.09 * s, 0.25 * s, 0.44 * s], [0.4, 0, 1], 0x1a1410, 0xff4a4a);
      mb.eye(0.06 * s, [-0.09 * s, 0.25 * s, 0.44 * s], [-0.4, 0, 1], 0x1a1410, 0xff4a4a);
      mb.box(0.3 * s, 0.06 * s, 0.05 * s, 0x2a2a2a, [0, 0.27 * s, 0.4 * s], [0, 0, 0]);
      mb.cone(0.12 * s, 0.35 * s, 0x1f1f2e, [0, 0.05 * s, -0.45 * s], [-Math.PI / 2, 0, 0], 5);
      mb.sphere(0.08 * s, 0xffd24a, [0, -0.2 * s, 0.1 * s]);
    } }),
  hawk: () => flyer({ color: 0x8a5a3a, size: 1.05, wing: 0x6b4428, wingShape: 'bird', wingSpan: 1.0,
    extra: (mb, s) => {
      mb.sphere(0.27 * s, 0x8a5a3a, [0, 0.05 * s, 0], [1, 0.9, 1.4]);
      mb.sphere(0.24 * s, 0xf3e6d0, [0, 0.0, 0.12 * s], [0.9, 0.8, 1.1]);
      mb.sphere(0.2 * s, 0xf3e6d0, [0, 0.25 * s, 0.35 * s]);
      mb.cone(0.07 * s, 0.18 * s, 0xffc23a, [0, 0.2 * s, 0.58 * s], [Math.PI / 2 + 0.4, 0, 0], 6);
      mb.eye(0.07 * s, [0.1 * s, 0.3 * s, 0.48 * s], [0.4, 0, 1], 0x1a1410, 0xffd04a);
      mb.eye(0.07 * s, [-0.1 * s, 0.3 * s, 0.48 * s], [-0.4, 0, 1], 0x1a1410, 0xffd04a);
      mb.box(0.25 * s, 0.05 * s, 0.1 * s, 0x6b4428, [0, 0.38 * s, 0.42 * s], [0.3, 0, 0]);
      mb.cone(0.15 * s, 0.4 * s, 0x6b4428, [0, 0.0, -0.5 * s], [-Math.PI / 2, 0, 0], 5);
    } }),
  mosquito: () => flyer({ color: 0x6a5a4a, size: 0.6, wing: 0xcfeaff, wingShape: 'bug', wingSpan: 0.6, float: 1.6,
    extra: (mb, s) => {
      mb.sphere(0.18 * s, 0x6a5a4a, [0, 0.05 * s, 0], [1, 1, 1.2]);
      mb.sphere(0.2 * s, 0xb03a2e, [0, 0.0, -0.32 * s], [0.9, 0.9, 1.4]);
      mb.sphere(0.13 * s, 0x6a5a4a, [0, 0.12 * s, 0.25 * s]);
      mb.eye(0.07 * s, [0.07 * s, 0.17 * s, 0.33 * s], [0.4, 0, 1], 0x1a1410, 0xff5a5a);
      mb.eye(0.07 * s, [-0.07 * s, 0.17 * s, 0.33 * s], [-0.4, 0, 1], 0x1a1410, 0xff5a5a);
      mb.cyl(0.01 * s, 0.02 * s, 0.35 * s, 0x2a2a2a, [0, 0.05 * s, 0.5 * s], [Math.PI / 2 + 0.3, 0, 0]);
    } }),
  icespirit: () => flyer({ color: 0xbfe9ff, size: 0.95, wing: 0x9fd8ff, wingShape: 'bug', wingSpan: 0.7, float: 1.8,
    extra: (mb, s) => {
      mb.ico(0.32 * s, 0xd8f4ff, [0, 0.1 * s, 0], 1);
      mb.cone(0.22 * s, 0.6 * s, 0xa8e0ff, [0, -0.35 * s, -0.05 * s], [Math.PI, 0, 0], 6);
      for (let i = 0; i < 5; i++) mb.cone(0.06 * s, 0.3 * s, 0xffffff, [Math.cos(i * 1.26) * 0.18 * s, 0.4 * s, Math.sin(i * 1.26) * 0.18 * s], [Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4], 4);
      mb.eye(0.08 * s, [0.11 * s, 0.15 * s, 0.27 * s], [0.2, 0, 1], 0x2a5a8a, 0xffffff);
      mb.eye(0.08 * s, [-0.11 * s, 0.15 * s, 0.27 * s], [-0.2, 0, 1], 0x2a5a8a, 0xffffff);
    } }),
  wyvern: () => flyer({ color: 0x8a3a4a, size: 1.25, wing: 0xb85a4a, wingShape: 'dragon', wingSpan: 1.2,
    extra: (mb, s) => {
      mb.sphere(0.35 * s, 0x8a3a4a, [0, 0.0, 0], [1, 0.9, 1.5]);
      mb.sphere(0.25 * s, 0xf0c070, [0, -0.08 * s, 0.15 * s], [0.9, 0.7, 1.2]);
      mb.capsule(0.12 * s, 0.35 * s, 0x8a3a4a, [0, 0.25 * s, 0.5 * s], [0.9, 0, 0]);
      mb.sphere(0.22 * s, 0x8a3a4a, [0, 0.42 * s, 0.78 * s], [1, 0.85, 1.3]);
      mb.eye(0.07 * s, [0.12 * s, 0.52 * s, 0.9 * s], [0.4, 0, 1], 0x1a1410, 0xffd04a);
      mb.eye(0.07 * s, [-0.12 * s, 0.52 * s, 0.9 * s], [-0.4, 0, 1], 0x1a1410, 0xffd04a);
      horns(mb, s, 0.42 * s, 0xf5ecd7, 0.1);
      mb.cone(0.12 * s, 0.7 * s, 0x8a3a4a, [0, -0.05 * s, -0.75 * s], [-Math.PI / 2, 0, 0], 6);
      mb.cone(0.12 * s, 0.2 * s, 0xb85a4a, [0, 0.0, -1.15 * s], [-Math.PI / 2, 0, 0], 3);
    } }),
  snake: () => serpentRig({ color: 0x6aa84f, belly: 0xdce775, size: 0.8, segs: 5,
    head: (mb, s) => {
      mb.sphere(0.26 * s, 0x6aa84f, [0, 0.24 * s, 0.05 * s], [1, 0.8, 1.3]);
      mb.eye(0.08 * s, [0.12 * s, 0.38 * s, 0.25 * s], [0.4, 0, 1], 0x1a1410, 0xfff27a);
      mb.eye(0.08 * s, [-0.12 * s, 0.38 * s, 0.25 * s], [-0.4, 0, 1], 0x1a1410, 0xfff27a);
      mb.box(0.03 * s, 0.02 * s, 0.2 * s, 0xe53935, [0, 0.18 * s, 0.45 * s]);
      mb.box(0.36 * s, 0.07 * s, 0.07 * s, 0x2a2a2a, [0, 0.4 * s, 0.22 * s]);
    } }),
  serpent: () => serpentRig({ color: 0x3a7a6a, belly: 0xc8e6a0, size: 2.2, segs: 8,
    head: (mb, s) => {
      mb.sphere(0.3 * s, 0x3a7a6a, [0, 0.35 * s, 0.1 * s], [1, 0.85, 1.35]);
      mb.sphere(0.2 * s, 0xc8e6a0, [0, 0.22 * s, 0.25 * s], [1, 0.5, 1.2]);
      mb.eye(0.08 * s, [0.15 * s, 0.5 * s, 0.32 * s], [0.4, 0, 1], 0x1a1410, 0xffd04a);
      mb.eye(0.08 * s, [-0.15 * s, 0.5 * s, 0.32 * s], [-0.4, 0, 1], 0x1a1410, 0xffd04a);
      horns(mb, s, 0.45 * s, 0xf5ecd7, 0.12);
      mb.cone(0.035 * s, 0.14 * s, 0xffffff, [0.08 * s, 0.18 * s, 0.48 * s], [Math.PI, 0, 0], 5);
      mb.cone(0.035 * s, 0.14 * s, 0xffffff, [-0.08 * s, 0.18 * s, 0.48 * s], [Math.PI, 0, 0], 5);
      for (let i = 0; i < 4; i++) mb.cone(0.06 * s, 0.18 * s, 0x2a5a4a, [0, 0.62 * s - i * 0.02 * s, -0.05 * s - i * 0.15 * s], [-0.4, 0, 0], 4);
    } }),
  frog: () => biped({ skin: 0x5aa860, belly: 0xd8f0a8, size: 0.9, headR: 0.36, torso: [0.36, 0.38, 0.32], legLen: 0.22, eyes: 0,
    extra: (mb, s, y) => {
      mb.eye(0.13 * s, [0.17 * s, y + 0.28 * s, 0.12 * s], [0.3, 0, 1], 0x1a1410, 0xfff27a);
      mb.eye(0.13 * s, [-0.17 * s, y + 0.28 * s, 0.12 * s], [-0.3, 0, 1], 0x1a1410, 0xfff27a);
      mb.box(0.5 * s, 0.25 * s, 0.05 * s, 0x8a3a8a, [0, y - 0.3 * s, 0.32 * s], [0.2, 0, 0], 0.03);
      mb.torus(0.3 * s, 0.04 * s, 0xffcc33, [0, y - 0.25 * s, 0.05 * s], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 5; i++) mb.cone(0.05 * s, 0.25 * s, i % 2 ? 0xe53935 : 0x42a5f5, [Math.cos(i * 0.6 - 1.2) * 0.25 * s, y + 0.38 * s, -0.12 * s], [0, 0, (i - 2) * -0.3], 4);
    },
    hand: (m, s, side) => { if (side > 0) { m.cyl(0.025 * s, 0.025 * s, 0.9 * s, 0x7a5230, [0.05 * s, -0.2 * s, 0.1 * s]); m.sphere(0.09 * s, 0x7dff9a, [0.05 * s, 0.27 * s, 0.1 * s]); } } }),
  mushroom: () => biped({ skin: 0xf5ecd7, size: 1.0, headR: 0.18, torso: [0.3, 0.45, 0.3], legLen: 0.25, arms: 0xf5ecd7, eyes: 0, mouth: false,
    extra: (mb, s, y) => {
      mb.hemi(0.6 * s, 0xd84a4a, [0, y + 0.0, 0], [1, 0.75, 1]);
      for (let i = 0; i < 7; i++) mb.sphere(0.08 * s, 0xffffff, [Math.cos(i * 0.9) * 0.35 * s, y + 0.3 * s + (i % 2) * 0.08 * s, Math.sin(i * 0.9) * 0.35 * s], [1, 0.5, 1]);
      mb.eye(0.1 * s, [0.12 * s, y - 0.3 * s, 0.25 * s], [0.2, 0, 1]);
      mb.eye(0.1 * s, [-0.12 * s, y - 0.3 * s, 0.25 * s], [-0.2, 0, 1]);
      mb.sphere(0.08 * s, 0x3a1020, [0, y - 0.48 * s, 0.28 * s], [1.3, 0.5, 0.5]);
    } }),
  troll: () => biped({ skin: 0x6f9a6a, belly: 0x9ac08a, size: 1.25, headR: 0.25, torso: [0.48, 0.55, 0.42], armLen: 0.6, legLen: 0.32, hunch: 0.15, eyeColor: 0xfff27a,
    extra: (mb, s, y) => {
      mb.sphere(0.12 * s, 0x6f9a6a, [0, y - 0.05 * s, 0.4 * s], [1, 1.2, 1]);
      mb.cone(0.04 * s, 0.1 * s, 0xffffff, [0.1 * s, y - 0.1 * s, 0.37 * s], [0, 0, 0], 4);
      mb.cone(0.04 * s, 0.1 * s, 0xffffff, [-0.1 * s, y - 0.1 * s, 0.37 * s], [0, 0, 0], 4);
      mb.box(0.7 * s, 0.25 * s, 0.6 * s, 0x6b4a2b, [0, 0.42 * s, 0], [0, 0, 0], 0.05);
      for (let i = 0; i < 3; i++) mb.sphere(0.08 * s, 0x4a7a4a, [Math.cos(i * 2) * 0.3 * s, 0.9 * s, -0.3 * s], [1, 1, 0.5]);
    },
    hand: (m, s, side) => { if (side > 0) { m.cyl(0.06 * s, 0.12 * s, 0.8 * s, 0x8a5a2b, [0.05 * s, -0.95 * s, 0.25 * s], [1.2, 0, 0]); } } }),
  treant: () => biped({ skin: 0x7a5232, body: 0x6b4428, size: 1.35, headR: 0.32, torso: [0.42, 0.7, 0.38], armLen: 0.6, legLen: 0.3, arms: 0x6b4428, eyeColor: 0xb6ff6b,
    extra: (mb, s, y) => {
      mb.sphere(0.5 * s, 0x4f8a3a, [0, y + 0.35 * s, -0.05 * s], [1.3, 0.8, 1.1]);
      mb.sphere(0.32 * s, 0x6aa84f, [0.35 * s, y + 0.5 * s, 0.05 * s]);
      mb.sphere(0.3 * s, 0x5a9a42, [-0.35 * s, y + 0.45 * s, -0.1 * s]);
      mb.sphere(0.09 * s, 0xd84a8a, [0.2 * s, y + 0.75 * s, 0.2 * s]);
      for (let i = 0; i < 4; i++) mb.box(0.06 * s, 0.4 * s, 0.06 * s, 0x5a3a20, [Math.cos(i * 1.6) * 0.3 * s, 0.15 * s, Math.sin(i * 1.6) * 0.3 * s], [Math.sin(i) * 0.5, 0, Math.cos(i) * 0.5]);
    } }),
  yeti: () => biped({ skin: 0xf2f6fa, belly: 0xdfe8f0, size: 1.3, headR: 0.28, torso: [0.5, 0.55, 0.45], armLen: 0.65, legLen: 0.3, hunch: 0.1, arms: 0xf2f6fa, eyeColor: 0x9fd8ff,
    extra: (mb, s, y) => {
      mb.sphere(0.2 * s, 0x8fb0cc, [0, y - 0.05 * s, 0.22 * s], [1.1, 0.9, 0.6]);
      mb.cone(0.04 * s, 0.1 * s, 0xffffff, [0.08 * s, y - 0.15 * s, 0.33 * s], [Math.PI, 0, 0], 4);
      mb.cone(0.04 * s, 0.1 * s, 0xffffff, [-0.08 * s, y - 0.15 * s, 0.33 * s], [Math.PI, 0, 0], 4);
      horns(mb, s, y, 0xc0b090, 0.22);
    } }),
  golem: () => biped({ skin: 0x8d8d9a, body: 0x7a7a88, size: 1.4, headR: 0.24, torso: [0.55, 0.55, 0.42], armLen: 0.6, legLen: 0.3, arms: 0x8d8d9a, eyes: 0, mouth: false,
    extra: (mb, s, y) => {
      mb.sphere(0.07 * s, 0x6be0ff, [0.1 * s, y + 0.03 * s, 0.22 * s]);
      mb.sphere(0.07 * s, 0x6be0ff, [-0.1 * s, y + 0.03 * s, 0.22 * s]);
      for (let i = 0; i < 6; i++) mb.dodeca(0.18 * s, i % 2 ? 0x6a6a78 : 0x9a9aa8, [Math.cos(i) * 0.45 * s, 0.75 * s + (i % 3) * 0.2 * s, Math.sin(i) * 0.35 * s]);
      mb.dodeca(0.16 * s, 0x5aa86a, [0.2 * s, y + 0.28 * s, 0]);
      mb.ico(0.12 * s, 0x6be0ff, [0, 0.85 * s, 0.38 * s]);
    },
    hand: (m, s, side) => m.dodeca(0.2 * s, 0x7a7a88, [side * 0.05 * s, -0.7 * s, 0]) }),
  shield: () => biped({ skin: 0x6aa84f, body: 0x6b5a4a, size: 1.05, headR: 0.28, torso: [0.36, 0.42, 0.32], eyeColor: 0xfff27a,
    extra: (mb, s, y) => {
      mb.cone(0.06 * s, 0.3 * s, 0x6aa84f, [0.3 * s, y + 0.05 * s, 0], [0, 0, -1.3], 5);
      mb.cone(0.06 * s, 0.3 * s, 0x6aa84f, [-0.3 * s, y + 0.05 * s, 0], [0, 0, 1.3], 5);
      mb.hemi(0.3 * s, 0x8f9aa6, [0, y + 0.08 * s, 0], [1, 0.8, 1]);
    },
    hand: (m, s, side) => {
      if (side < 0) { m.box(0.6 * s, 0.8 * s, 0.08 * s, 0x8a5a2b, [-0.1 * s, -0.35 * s, 0.35 * s], [0, 0.2, 0], 0.04); m.box(0.4 * s, 0.6 * s, 0.1 * s, 0xb0bac4, [-0.1 * s, -0.35 * s, 0.38 * s], [0, 0.2, 0], 0.04); }
      else m.box(0.06 * s, 0.6 * s, 0.04 * s, 0xd0d6dd, [0.05 * s, -0.4 * s, 0.2 * s], [1.2, 0, 0]);
    } }),
  imp: () => biped({ skin: 0xd84a4a, body: 0xb83a3a, size: 0.75, headR: 0.32, torso: [0.25, 0.35, 0.22], eyeColor: 0xfff27a,
    extra: (mb, s, y) => {
      horns(mb, s, y, 0x3a2a2a, 0.15);
      mb.cyl(0.02 * s, 0.03 * s, 0.4 * s, 0xb83a3a, [0, 0.4 * s, -0.3 * s], [-1.0, 0, 0]);
      mb.cone(0.06 * s, 0.1 * s, 0xb83a3a, [0, 0.55 * s, -0.5 * s], [-1.0, 0, 0], 3);
      mb.sphere(0.32 * s, 0x2f2a3a, [0, 0.95 * s, -0.25 * s]);
      mb.cyl(0.04 * s, 0.04 * s, 0.15 * s, 0x8a6a3a, [0, 1.3 * s, -0.25 * s]);
      mb.sphere(0.06 * s, 0xffd04a, [0, 1.4 * s, -0.25 * s]);
    } }),
  skeleton: () => biped({ skin: 0xf2ecdc, body: 0xd8d0bc, size: 0.9, headR: 0.28, torso: [0.25, 0.4, 0.2], arms: 0xf2ecdc, eyeColor: 0x1a1410,
    extra: (mb, s, y) => {
      for (let i = 0; i < 3; i++) mb.torus(0.2 * s, 0.025 * s, 0xf2ecdc, [0, 0.6 * s + i * 0.12 * s, 0], [Math.PI / 2, 0, 0], Math.PI * 2, [1, 0.8, 1]);
      mb.box(0.25 * s, 0.06 * s, 0.05 * s, 0x2a2a2a, [0, y - 0.15 * s, 0.25 * s]);
    },
    hand: (m, s, side) => { if (side > 0) m.box(0.05 * s, 0.55 * s, 0.03 * s, 0xb0b8c0, [0.05 * s, -0.5 * s, 0.25 * s], [1.2, 0, 0]); } }),
  darkknight: () => biped({ skin: 0x2f2f3e, body: 0x3a3a4e, size: 1.35, headR: 0.27, torso: [0.42, 0.5, 0.36], arms: 0x3a3a4e, legs: 0x2f2f3e, eyes: 0, mouth: false,
    extra: (mb, s, y) => {
      mb.box(0.32 * s, 0.05 * s, 0.05 * s, 0xff3a3a, [0, y + 0.02 * s, 0.26 * s]);
      horns(mb, s, y, 0xb02a3a, 0.2);
      mb.sphere(0.18 * s, 0x4a4a5e, [0.45 * s, 0.98 * s, 0], [1, 0.8, 1]);
      mb.sphere(0.18 * s, 0x4a4a5e, [-0.45 * s, 0.98 * s, 0], [1, 0.8, 1]);
      mb.box(0.75 * s, 0.75 * s, 0.05 * s, 0x6a1a2a, [0, 0.75 * s, -0.38 * s], [0.15, 0, 0], 0.02);
    },
    hand: (m, s, side) => {
      if (side > 0) { m.box(0.1 * s, 1.0 * s, 0.05 * s, 0x6a6a7e, [0.05 * s, -0.25 * s, 0.35 * s], [1.0, 0, 0], 0.02); }
      else m.box(0.5 * s, 0.7 * s, 0.08 * s, 0x2a2a3a, [-0.1 * s, -0.4 * s, 0.25 * s], [0, 0.3, 0], 0.05);
    } }),
  necro: () => biped({ skin: 0xe8a050, body: 0x4a2a6a, size: 1.05, headR: 0.3, torso: [0.36, 0.5, 0.32], arms: 0x4a2a6a, legs: 0x3a1f55, eyeColor: 0xb47aff,
    extra: (mb, s, y) => {
      mb.cone(0.08 * s, 0.25 * s, 0xe8a050, [0.18 * s, y + 0.3 * s, 0], [0, 0, -0.3], 6);
      mb.cone(0.08 * s, 0.25 * s, 0xe8a050, [-0.18 * s, y + 0.3 * s, 0], [0, 0, 0.3], 6);
      mb.sphere(0.15 * s, 0xffffff, [0, y - 0.1 * s, 0.22 * s], [1, 0.7, 1.2]);
      mb.cone(0.45 * s, 0.6 * s, 0x4a2a6a, [0, 0.45 * s, 0], [0, 0, 0], 12);
      mb.sphere(0.1 * s, 0xf2ecdc, [0, 0.95 * s, 0.33 * s]);
    },
    hand: (m, s, side) => { if (side > 0) { m.cyl(0.025 * s, 0.025 * s, 1.1 * s, 0x3a2a2a, [0.05 * s, -0.3 * s, 0.1 * s]); m.sphere(0.1 * s, 0xb47aff, [0.05 * s, 0.3 * s, 0.1 * s]); } } }),
  shadow: () => biped({ skin: 0x2a1f3e, body: 0x1f1530, size: 1.05, headR: 0.32, torso: [0.36, 0.55, 0.3], arms: 0x2a1f3e, legs: 0x1f1530, eyeColor: 0xff4ad0, mouth: false,
    extra: (mb, s) => { mb.cone(0.45 * s, 0.7 * s, 0x1f1530, [0, 0.3 * s, 0], [Math.PI, 0, 0], 10); } }),
  frostgiant: () => biped({ skin: 0x9fc8e8, body: 0x7aa8d0, size: 2.3, headR: 0.25, torso: [0.5, 0.6, 0.42], armLen: 0.65, legLen: 0.35, arms: 0x9fc8e8, legs: 0x6a8ab0, eyeColor: 0xe8ffff,
    extra: (mb, s, y) => {
      mb.sphere(0.2 * s, 0xffffff, [0, y - 0.2 * s, 0.15 * s], [1.2, 1.1, 0.8]);
      for (let i = 0; i < 5; i++) mb.cone(0.07 * s, 0.35 * s, 0xd8f4ff, [(i - 2) * 0.1 * s, y + 0.32 * s, 0], [0, 0, (i - 2) * -0.25], 5);
      for (let i = 0; i < 6; i++) mb.ico(0.12 * s, 0xd8f4ff, [Math.cos(i * 1.1) * 0.45 * s, 1.15 * s, Math.sin(i * 1.1) * 0.3 * s - 0.15 * s]);
      mb.box(0.9 * s, 0.3 * s, 0.7 * s, 0x6a5a8a, [0, 0.5 * s, 0], [0, 0, 0], 0.08);
    },
    hand: (m, s, side) => { if (side > 0) { m.cyl(0.06 * s, 0.08 * s, 1.2 * s, 0x8a6a4a, [0.05 * s, -0.6 * s, 0.3 * s], [1.1, 0, 0]); m.ico(0.25 * s, 0xc8eeff, [0.05 * s, -0.45 * s, 0.9 * s], 0); } } }),
};
