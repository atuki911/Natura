import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Vec3 = [number, number, number];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

/** Accumulates primitive shapes with per-vertex color and merges them into one geometry. */
export class MB {
  parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: number | string, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): this {
    let g = geo.index ? geo.toNonIndexed() : geo;
    // keep only the standard attributes
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _m.compose(new THREE.Vector3(...pos), _q, new THREE.Vector3(...scale));
    g.applyMatrix4(_m);
    _c.set(color as THREE.ColorRepresentation);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    if (g !== geo) geo.dispose();
    return this;
  }

  sphere(r: number, color: number | string, pos: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1], seg = 14, rot: Vec3 = [0, 0, 0]) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.75))), color, pos, rot, scale);
  }
  hemi(r: number, color: number | string, pos: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1], rot: Vec3 = [0, 0, 0]) {
    return this.add(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), color, pos, rot, scale);
  }
  box(w: number, h: number, d: number, color: number | string, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], radius = 0) {
    const g = radius > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, Math.min(w, h, d) / 2 - 0.001)) : new THREE.BoxGeometry(w, h, d);
    return this.add(g, color, pos, rot);
  }
  cyl(rt: number, rb: number, h: number, color: number | string, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], seg = 12, scale: Vec3 = [1, 1, 1]) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, pos, rot, scale);
  }
  cone(r: number, h: number, color: number | string, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], seg = 12, scale: Vec3 = [1, 1, 1]) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, pos, rot, scale);
  }
  torus(r: number, tube: number, color: number | string, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], arc = Math.PI * 2, scale: Vec3 = [1, 1, 1]) {
    return this.add(new THREE.TorusGeometry(r, tube, 8, 20, arc), color, pos, rot, scale);
  }
  capsule(r: number, len: number, color: number | string, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    return this.add(new THREE.CapsuleGeometry(r, len, 4, 10), color, pos, rot, scale);
  }
  ico(r: number, color: number | string, pos: Vec3 = [0, 0, 0], detail = 0, scale: Vec3 = [1, 1, 1], rot: Vec3 = [0, 0, 0]) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, pos, rot, scale);
  }
  dodeca(r: number, color: number | string, pos: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1], rot: Vec3 = [0, 0, 0]) {
    return this.add(new THREE.DodecahedronGeometry(r, 0), color, pos, rot, scale);
  }
  /** cartoon eye: white sclera + dark pupil + shine, looking along +z */
  eye(r: number, pos: Vec3, look: Vec3 = [0, 0, 1], pupil = 0x1a1410, white = 0xffffff) {
    const l = new THREE.Vector3(...look).normalize();
    this.sphere(r, white, pos, [1, 1, 1], 12);
    const p: Vec3 = [pos[0] + l.x * r * 0.62, pos[1] + l.y * r * 0.62 + r * 0.05, pos[2] + l.z * r * 0.62];
    this.sphere(r * 0.52, pupil, p, [1, 1, 1], 10);
    this.sphere(r * 0.18, 0xffffff, [p[0] + l.x * r * 0.35 + r * 0.15, p[1] + r * 0.2, p[2] + l.z * r * 0.35], [1, 1, 1], 6);
    return this;
  }
  build(): THREE.BufferGeometry {
    const g = this.parts.length ? mergeGeometries(this.parts, false)! : new THREE.BufferGeometry();
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export interface RigPart { name: string; geo: THREE.BufferGeometry; pivot: Vec3; glow?: boolean; outline?: boolean }
export interface RigDef { body: THREE.BufferGeometry; glowBody?: THREE.BufferGeometry; parts: RigPart[]; height: number; outline?: boolean; float?: number }

export function part(name: string, pivot: Vec3, fn: (mb: MB) => void, opts: { glow?: boolean; outline?: boolean } = {}): RigPart {
  const mb = new MB();
  fn(mb);
  return { name, geo: mb.build(), pivot, ...opts };
}
