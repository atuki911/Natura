import * as THREE from 'three';
import type { RigDef } from './builder.ts';
import { toonMat, withOutline, glowMat } from './toon.ts';
import { CHICKEN_MODELS } from './models/chickens.ts';
import { ENEMY_MODELS } from './models/enemies.ts';

const defs = new Map<string, RigDef>();
export function rigDef(id: string): RigDef {
  let d = defs.get(id);
  if (!d) {
    const f = CHICKEN_MODELS[id] ?? ENEMY_MODELS[id];
    if (!f) throw new Error('unknown model ' + id);
    d = f();
    defs.set(id, d);
  }
  return d;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  parts: Record<string, THREE.Object3D>;
  def: RigDef;
  id: string;
  phase: number;
  meshes: THREE.Mesh[];
  flashing: boolean;
  shadow?: THREE.Mesh;
}

let flashMat: THREE.Material | null = null;
/** brief white flash when hit */
export function setRigFlash(r: Rig, on: boolean) {
  if (r.flashing === on) return;
  r.flashing = on;
  flashMat ??= toonMat({ emissive: 0xffffff, emissiveIntensity: 0.85 });
  for (const m of r.meshes) {
    if (on) { m.userData.baseMat = m.material; m.material = flashMat; }
    else if (m.userData.baseMat) m.material = m.userData.baseMat;
  }
}

let shadowGeo: THREE.CircleGeometry | null = null;
let shadowMat: THREE.MeshBasicMaterial | null = null;

export function createRig(id: string, opts: { shadow?: boolean; outline?: boolean } = {}): Rig {
  const def = rigDef(id);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const outline = opts.outline !== false;
  const mat = toonMat();
  const bm = new THREE.Mesh(def.body, mat);
  bm.castShadow = opts.shadow !== false;
  if (outline) withOutline(bm);
  body.add(bm);
  const parts: Record<string, THREE.Object3D> = {};
  const meshes: THREE.Mesh[] = [bm];
  for (const p of def.parts) {
    const g = new THREE.Group();
    g.position.set(...p.pivot);
    const m = new THREE.Mesh(p.geo, p.glow ? glowMat() : mat);
    m.castShadow = opts.shadow !== false;
    if (outline && !p.glow) withOutline(m);
    g.add(m);
    if (p.name === 'head') body.add(g); else body.add(g);
    parts[p.name] = g;
    if (!p.glow) meshes.push(m);
  }
  const rig: Rig = { root, body, parts, def, id, phase: Math.random() * 10, meshes, flashing: false };
  if (def.float) {
    // soft ground shadow so flying enemies read at the right spot
    shadowGeo ??= new THREE.CircleGeometry(0.5, 20);
    shadowMat ??= new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.04;
    sh.scale.setScalar(def.height * 1.1);
    sh.userData.outline = true;
    root.add(sh);
    rig.shadow = sh;
  }
  return rig;
}

/**
 * Procedural animation.
 * move: 0..1 how fast it walks, attack: 0..1 remaining attack anim, t: time
 */
export function animateRig(r: Rig, dt: number, move: number, attack: number, t: number, flying = false) {
  r.phase += dt * (6 + move * 6) * (move > 0.05 ? 1 : 0.35);
  const ph = r.phase;
  const P = r.parts;
  const h = r.def.height;
  const sw = Math.sin(ph);
  const atk = attack > 0 ? Math.sin(Math.min(1, attack / 0.35) * Math.PI) : 0;
  const hasLegs = !!(P.legL || P.leg0);
  if (!hasLegs && !flying && !P.seg0 && !P.wingL) {
    // blob: squash & stretch hop
    const hop = move > 0.05 ? Math.abs(Math.sin(ph * 0.8)) : 0.15 * (0.5 + 0.5 * Math.sin(t * 3));
    r.body.position.y = hop * h * 0.18;
    const sq = 1 + (move > 0.05 ? Math.cos(ph * 1.6) * 0.1 : Math.sin(t * 3) * 0.04) - atk * 0.15;
    r.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    return;
  }
  if (flying) {
    const bob = Math.sin(t * 2 + r.phase * 0.1);
    r.body.position.y = (r.def.float ?? 2) + bob * 0.18;
    const f = Math.sin(t * 14 + r.phase);
    if (P.wingL) P.wingL.rotation.z = f * 0.75 + 0.1;
    if (P.wingR) P.wingR.rotation.z = -f * 0.75 - 0.1;
    r.body.rotation.x = 0.12 + atk * 0.5;
    r.body.rotation.z = Math.sin(t * 1.3 + r.phase) * 0.08;
    r.body.position.z = atk * h * 0.3;
    if (r.shadow) r.shadow.scale.setScalar(r.def.height * (1.05 - bob * 0.08));
    return;
  }
  r.body.position.y = move > 0.05 ? Math.abs(sw) * h * 0.05 : 0;
  r.body.rotation.z = move > 0.05 ? sw * 0.06 : 0;
  r.body.rotation.x = atk * 0.22;
  // attack lunge and idle breathing
  r.body.position.z = atk * h * 0.18;
  const breathe = move > 0.05 ? 0 : Math.sin(t * 2.4 + r.phase) * 0.025;
  r.body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
  if (P.head) {
    if (atk > 0) { P.head.rotation.x = 0.45 * atk; P.head.rotation.y = 0; }
    else if (move > 0.05) { P.head.rotation.x = Math.sin(ph * 2) * 0.12; P.head.rotation.y *= 0.9; }
    else {
      // look around, with an occasional peck
      const k = (t * 0.6 + r.phase) % 6;
      P.head.rotation.y = Math.sin(t * 0.7 + r.phase) * 0.5;
      P.head.rotation.x = k > 5.4 ? Math.sin((k - 5.4) / 0.6 * Math.PI * 2) * 0.5 : 0;
    }
  }
  const legA = move > 0.05 ? 0.7 : 0;
  if (P.legL) { P.legL.rotation.x = sw * legA; P.legR.rotation.x = -sw * legA; }
  if (P.leg0) {
    for (let i = 0; i < 8; i++) {
      const L = P['leg' + i];
      if (!L) break;
      const s = (i % 2 === 0 ? 1 : -1) * (i >= 2 && i < 6 ? -1 : 1);
      if (P.leg4) L.rotation.y = Math.sin(ph * 1.5) * 0.35 * s; // spider
      else L.rotation.x = sw * legA * s;
    }
  }
  if (P.armL) {
    P.armL.rotation.x = -sw * 0.6 * (move > 0.05 ? 1 : 0.1);
    P.armR.rotation.x = atk > 0 ? -2.2 * atk : sw * 0.6 * (move > 0.05 ? 1 : 0.1);
  }
  if (P.wingL) {
    // chickens: little wing flaps while walking, weapon swing on attack
    P.wingL.rotation.z = -0.15 - (move > 0.05 ? Math.abs(Math.sin(ph * 2)) * 0.25 : 0);
    P.wingR.rotation.z = 0.15 + (move > 0.05 ? Math.abs(Math.sin(ph * 2)) * 0.25 : 0);
    P.wingR.rotation.x = atk > 0 ? -1.6 * atk + 0.4 : 0;
  }
  if (P.seg0) {
    r.body.position.y = 0;
    for (let i = 0; i < 12; i++) {
      const s = P['seg' + i];
      if (!s) break;
      s.position.x = Math.sin(t * 6 - i * 0.9) * 0.12 * h * (1 + i * 0.15);
    }
  }
}
