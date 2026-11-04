import * as THREE from 'three';
import { MB } from './builder.ts';
import { toonMat, withOutline, glowMat } from './toon.ts';
import { egg } from './models/towers.ts';
import type { Path } from '../sim/path.ts';
import type { Spot } from '../sim/game.ts';
import { Rng, type V2 } from '../sim/rng.ts';

export interface Palette {
  grass: number; grass2: number; dirt: number; rock: number; rock2: number; lip: number;
  path: number; pathEdge: number; skyTop: number; skyHorizon: number; skyBottom: number; mountain: number; mountainSnow: number;
  fog: number; sun: number; ambient: number; hemiGround: number; cloud: number;
}

export const PALETTES: Palette[] = [
  { grass: 0x86cf4f, grass2: 0x6fbf45, dirt: 0x8a5a32, rock: 0x9a8268, rock2: 0x6e5a4a, lip: 0x4f9a35, path: 0xe9cf95, pathEdge: 0xc9a46a,
    skyTop: 0x4b9cf0, skyHorizon: 0xcdeeff, skyBottom: 0xa8d8ff, mountain: 0x9a7ad0, mountainSnow: 0xf4eeff, fog: 0xbfe2ff, sun: 0xfff1d6, ambient: 0xbfdcff, hemiGround: 0x6a8a3a, cloud: 0xffffff },
  { grass: 0x5aa86a, grass2: 0x47905a, dirt: 0x6a4a3a, rock: 0x7a7068, rock2: 0x55504a, lip: 0x2f7a4a, path: 0xc8b28a, pathEdge: 0x9a8662,
    skyTop: 0x5a7aa8, skyHorizon: 0xd0e0d0, skyBottom: 0xa0b8b0, mountain: 0x5a6a90, mountainSnow: 0xd8e0f0, fog: 0xb8c8c0, sun: 0xf0f0d8, ambient: 0xa8c0c8, hemiGround: 0x3a5a3a, cloud: 0xe8f0ec },
  { grass: 0xe9f1f8, grass2: 0xd6e4f0, dirt: 0x7a6a62, rock: 0x8a96a8, rock2: 0x6a7488, lip: 0xc8dcec, path: 0xc8c0b8, pathEdge: 0xa8a0a0,
    skyTop: 0x6aa8e8, skyHorizon: 0xeaf6ff, skyBottom: 0xc0dcf4, mountain: 0x8aa4cc, mountainSnow: 0xffffff, fog: 0xdaeaf8, sun: 0xffffff, ambient: 0xc8d8f0, hemiGround: 0x9aa8b8, cloud: 0xffffff },
  { grass: 0x6a5a58, grass2: 0x5a4a4c, dirt: 0x4a3030, rock: 0x5a4448, rock2: 0x3a2a30, lip: 0x7a4a3a, path: 0x9a7a62, pathEdge: 0x6a4a3a,
    skyTop: 0x3a2050, skyHorizon: 0xff9a6a, skyBottom: 0xb05a4a, mountain: 0x4a2a40, mountainSnow: 0xff7a3a, fog: 0x9a5a5a, sun: 0xffc8a0, ambient: 0xc89aa8, hemiGround: 0x5a2a2a, cloud: 0xd8b0b0 },
];

const pathMats = new Map<number, THREE.MeshToonMaterial>();
function pathMat(level: number) {
  let m = pathMats.get(level);
  if (!m) {
    m = toonMat().clone();
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1 - level;
    m.polygonOffsetUnits = -2 - level * 2;
    pathMats.set(level, m);
  }
  return m;
}

// ───────── noise ─────────
function hash(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}
export function fbm(x: number, y: number) { return vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 1, y * 4.3 + 9) * 0.1; }

const HX = 37, HY = 23;
function islandSD(x: number, y: number, seed: number) {
  const r = 7;
  const qx = Math.abs(x) - (HX - r), qy = Math.abs(y) - (HY - r);
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return sd + (fbm(x * 0.12 + seed, y * 0.12) - 0.5) * 5;
}

export interface EnvBuild {
  group: THREE.Group;
  spotMeshes: THREE.Object3D[];
  castle: THREE.Group;
  castleFlag: THREE.Object3D | null;
  portals: THREE.Object3D[];
  animated: { obj: THREE.Object3D; kind: 'cloud' | 'bob' | 'spin' | 'portal' | 'lava'; base: number; speed: number }[];
  heightAt: (x: number, y: number) => number;
}

export function buildEnvironment(region: number, paths: Path[], spots: Spot[], seed: number): EnvBuild {
  const pal = PALETTES[region];
  const group = new THREE.Group();
  const rng = new Rng(seed * 7 + 3);
  const animated: EnvBuild['animated'] = [];

  // distance-to-path field (coarse, for terrain shaping and decoration)
  const pathPts: V2[] = [];
  for (const p of paths) for (let i = 0; i < p.pts.length; i += 2) pathPts.push(p.pts[i]);
  const pathDist = (x: number, y: number) => {
    let m = Infinity;
    for (const q of pathPts) { const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < m) m = d; }
    return Math.sqrt(m);
  };
  const spotDist = (x: number, y: number) => {
    let m = Infinity;
    for (const s of spots) m = Math.min(m, Math.hypot(s.x - x, s.y - y));
    return m;
  };
  const castlePos = paths[0].pts[paths[0].pts.length - 1];
  const heightAt = (x: number, y: number) => {
    const pd = pathDist(x, y), sd = spotDist(x, y);
    const k = Math.min(1, Math.max(0, (Math.min(pd - 2.4, sd - 1.8)) / 4));
    let h = (fbm(x * 0.15 + seed, y * 0.15 - seed) - 0.45) * 1.6 * k;
    if (region === 2) h += k * 0.4 * fbm(x * 0.3, y * 0.3);
    return Math.max(-0.15, h);
  };

  // ───────── terrain top ─────────
  const step = 1;
  const nx = Math.round((HX + 3) * 2 / step) + 1, ny = Math.round((HY + 3) * 2 / step) + 1;
  const x0 = -(HX + 3), y0 = -(HY + 3);
  const inside: boolean[] = new Array(nx * ny);
  const pos: number[] = [], col: number[] = [];
  const cGrass = new THREE.Color(pal.grass), cGrass2 = new THREE.Color(pal.grass2), tmpC = new THREE.Color();
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * step, y = y0 + j * step;
      const sdv = islandSD(x, y, seed);
      inside[j * nx + i] = sdv < 0;
      const h = heightAt(x, y);
      pos.push(x, h, y);
      const n = fbm(x * 0.2 + 3, y * 0.2 + 5);
      tmpC.copy(cGrass).lerp(cGrass2, Math.min(1, Math.max(0, n * 1.6 - 0.3)));
      const pd = pathDist(x, y);
      if (pd < 3.3) tmpC.lerp(new THREE.Color(pal.pathEdge), (1 - (pd - 1.5) / 1.8) * 0.35 * (pd > 1.5 ? 1 : 0));
      if (sdv > -1.4) tmpC.lerp(new THREE.Color(pal.lip), 0.5);
      col.push(tmpC.r, tmpC.g, tmpC.b);
    }
  }
  const idx: number[] = [];
  const edgeCount = new Map<string, [number, number, number]>();
  const addEdge = (a: number, b: number) => {
    const k = a < b ? a + ',' + b : b + ',' + a;
    const e = edgeCount.get(k);
    if (e) e[2]++; else edgeCount.set(k, [a, b, 1]);
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (inside[a] && inside[b] && inside[c] && inside[d]) {
        idx.push(a, c, b, b, c, d);
        addEdge(a, c); addEdge(c, b); addEdge(b, a); addEdge(b, c); addEdge(c, d); addEdge(d, b);
      }
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  topGeo.setIndex(idx);
  topGeo.computeVertexNormals();
  const top = new THREE.Mesh(topGeo, toonMat());
  top.receiveShadow = true;
  group.add(top);

  // ───────── cliffs ─────────
  const ringOf = new Map<number, THREE.Vector3[]>();
  const levels = [
    { y: -1.0, shrink: 1.02, jit: 0.4 },
    { y: -3.5, shrink: 0.94, jit: 1.0 },
    { y: -7.5, shrink: 0.76, jit: 1.6 },
    { y: -12, shrink: 0.5, jit: 1.6 },
    { y: -17, shrink: 0.2, jit: 1.0 },
  ];
  const getRing = (vi: number) => {
    let r = ringOf.get(vi);
    if (r) return r;
    const x = pos[vi * 3], y = pos[vi * 3 + 1], z = pos[vi * 3 + 2];
    r = [new THREE.Vector3(x, y, z)];
    levels.forEach((L, li) => {
      const j = (hash(Math.round(x * 10) + li * 31, Math.round(z * 10)) - 0.5) * L.jit;
      const yj = (hash(Math.round(z * 10) + li * 17, Math.round(x * 10)) - 0.5) * 1.2 * (li > 0 ? 1 : 0.3);
      const len = Math.hypot(x, z) || 1;
      r!.push(new THREE.Vector3(x * L.shrink + (x / len) * j, L.y + yj, z * L.shrink + (z / len) * j));
    });
    ringOf.set(vi, r);
    return r;
  };
  const cliffCols = [pal.lip, pal.dirt, pal.rock, pal.rock2, pal.rock2];
  const cp: number[] = [], cc: number[] = [];
  const tc = new THREE.Color();
  for (const [a, b, n] of edgeCount.values()) {
    if (n !== 1) continue;
    const ra = getRing(a), rb = getRing(b);
    for (let l = 0; l < levels.length; l++) {
      const A0 = ra[l], B0 = rb[l], A1 = ra[l + 1], B1 = rb[l + 1];
      // orientation: outward facing — determine via cross with center
      const quad = [A0, A1, B0, B0, A1, B1];
      const nrm = new THREE.Vector3().subVectors(A1, A0).cross(new THREE.Vector3().subVectors(B0, A0));
      const mid = new THREE.Vector3().addVectors(A0, B0).multiplyScalar(0.5);
      const flip = nrm.x * mid.x + nrm.z * mid.z < 0;
      const tris = flip ? [A0, B0, A1, B0, B1, A1] : quad;
      tc.set(cliffCols[l]);
      const shade = 0.85 + hash(a + l * 7, b) * 0.25;
      for (const v of tris) { cp.push(v.x, v.y, v.z); cc.push(tc.r * shade, tc.g * shade, tc.b * shade); }
    }
  }
  const cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cliffGeo.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  cliffGeo.computeVertexNormals();
  const cliff = new THREE.Mesh(cliffGeo, toonMat());
  cliff.receiveShadow = true;
  group.add(cliff);

  // ───────── paths ─────────
  paths.forEach((p, pi) => {
    for (const layer of [{ w: 2.0, c: pal.pathEdge, y: 0.03 }, { w: 1.55, c: pal.path, y: 0.05 }]) {
      const vp: number[] = [], vc: number[] = [];
      const c1 = new THREE.Color(layer.c);
      const ii: number[] = [];
      let k = 0;
      for (let d = 0; d <= p.length; d += 0.5) {
        const q = p.at(d);
        const w = layer.w + (fbm(d * 0.3 + pi, 1) - 0.5) * 0.35;
        const nxv = -q.dy, nyv = q.dx;
        for (const sgn of [-1, 1]) {
          const x = q.x + nxv * w * sgn, z = q.y + nyv * w * sgn;
          vp.push(x, layer.y + pi * 0.004 + Math.max(0, heightAt(x, z)) * 0.2, z);
          const sh = 0.94 + fbm(x * 0.8, z * 0.8) * 0.12;
          vc.push(c1.r * sh, c1.g * sh, c1.b * sh);
        }
        if (k > 0) { const a = (k - 1) * 2; ii.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        k++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3));
      g.setIndex(ii);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, pathMat(layer.y > 0.04 ? 2 : 1));
      m.receiveShadow = true;
      m.renderOrder = 1;
      group.add(m);
    }
  });
  // pebbles along path edges
  {
    const mb = new MB();
    mb.dodeca(0.16, 0xffffff, [0, 0.05, 0], [1, 0.55, 1]);
    const geo = mb.build();
    const list: THREE.Matrix4[] = [];
    for (const p of paths) for (let d = 1; d < p.length; d += rng.range(1.2, 2.6)) {
      const q = p.at(d);
      const side = rng.chance(0.5) ? 1 : -1;
      const w = rng.range(1.6, 2.2);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(q.x - q.dy * w * side, 0.04, q.y + q.dx * w * side),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, 6), 0)), new THREE.Vector3().setScalar(rng.range(0.6, 1.3)));
      list.push(m);
    }
    const inst = new THREE.InstancedMesh(geo, toonMat(), list.length);
    const pc = new THREE.Color(pal.rock).lerp(new THREE.Color(0xffffff), 0.3);
    list.forEach((m, i) => { inst.setMatrixAt(i, m); inst.setColorAt(i, pc); });
    inst.receiveShadow = true;
    group.add(inst);
  }

  // ───────── build spots ─────────
  const spotMeshes: THREE.Object3D[] = [];
  {
    const mb = new MB();
    mb.cyl(1.25, 1.35, 0.12, 0x7a5232, [0, 0.06, 0], [0, 0, 0], 22);
    mb.cyl(1.05, 1.1, 0.14, 0x9a6a3e, [0, 0.08, 0], [0, 0, 0], 22);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      mb.dodeca(0.17, i % 2 ? 0xa8a090 : 0xc8c0b0, [Math.cos(a) * 1.25, 0.12, Math.sin(a) * 1.25], [1, 0.6, 1]);
    }
    // little sign
    mb.cyl(0.04, 0.04, 0.6, 0x6e4322, [0.9, 0.3, -0.7]);
    mb.box(0.4, 0.26, 0.05, 0xc08048, [0.9, 0.58, -0.68], [0, 0, 0], 0.02);
    const geo = mb.build();
    for (const s of spots) {
      const m = withOutline(new THREE.Mesh(geo, toonMat()));
      m.position.set(s.x, 0, s.y);
      m.receiveShadow = true;
      m.userData.spot = s.id;
      group.add(m);
      spotMeshes.push(m);
    }
  }

  // ───────── castle / nest at the exit ─────────
  const castle = new THREE.Group();
  let castleFlag: THREE.Object3D | null = null;
  {
    const end = paths[0].at(paths[0].length);
    const mb = new MB();
    const W = 0xd8d2c4, WD = 0xa8a294;
    // keep walls
    mb.box(4.6, 2.6, 4.2, W, [0, 1.3, -0.8], [0, 0, 0], 0.15);
    for (let i = -2; i <= 2; i++) mb.box(0.55, 0.5, 0.4, W, [i * 0.95, 2.85, 1.25], [0, 0, 0], 0.06);
    for (let i = -2; i <= 2; i++) mb.box(0.55, 0.5, 0.4, W, [i * 0.95, 2.85, -2.85], [0, 0, 0], 0.06);
    for (let i = 0; i < 18; i++) mb.box(0.5, 0.3, 0.08, i % 3 ? WD : 0xe8e2d4, [-2 + (i % 6) * 0.8, 0.4 + Math.floor(i / 6) * 0.75, 1.31], [0, 0, 0], 0.03);
    // gate
    mb.box(1.5, 1.8, 0.2, 0x6b4428, [0, 0.9, 1.35], [0, 0, 0], 0.08);
    mb.cyl(0.75, 0.75, 0.22, 0x6b4428, [0, 1.8, 1.35], [Math.PI / 2, 0, 0], 16);
    for (let i = -1; i <= 1; i++) mb.box(0.06, 2.0, 0.05, 0x3a2a1a, [i * 0.4, 1.0, 1.48]);
    mb.box(1.9, 0.35, 0.3, 0xffc93c, [0, 2.4, 1.38], [0, 0, 0], 0.06);
    // corner towers with rainbow eggs
    const eggs = [[0xb57cff, 0x7be37b, 0xffd24a, 0xff6fae], [0x7be37b, 0xff6fae, 0x6fd6ff], [0xff6fae, 0xffd24a, 0xb57cff, 0x6fd6ff], [0x6fd6ff, 0xffd24a, 0x7be37b]];
    [[-2.4, 1.2], [2.4, 1.2], [-2.4, -2.8], [2.4, -2.8]].forEach(([x, z], k) => {
      mb.cyl(0.85, 0.95, 3.8, W, [x, 1.9, z], [0, 0, 0], 14);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        mb.box(0.36, 0.38, 0.3, W, [x + Math.cos(a) * 0.85, 3.95, z + Math.sin(a) * 0.85], [0, -a, 0], 0.05);
      }
      mb.cyl(0.75, 0.75, 0.15, 0x8a6a3a, [x, 3.85, z], [0, 0, 0], 12);
      egg(mb, 0.55, [x, 4.6, z], [eggs[k][0], ...eggs[k]]);
      mb.box(0.3, 0.5, 0.06, 0x2a1a10, [x, 2.5, z + 0.9], [0, 0, 0], 0.08);
    });
    // nest on top with golden egg
    mb.cyl(1.6, 1.3, 0.6, 0xc8a050, [0, 2.95, -0.8], [0, 0, 0], 18);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      mb.cyl(0.05, 0.05, 1.0, i % 2 ? 0xa07a3a : 0xd8b060, [Math.cos(a) * 1.5, 3.25, -0.8 + Math.sin(a) * 1.5], [0.3 * Math.sin(i), a, Math.PI / 2 - 0.25]);
    }
    mb.sphere(0.6, 0xffd23c, [0.85, 3.6, -0.3], [1, 1.3, 1]);
    mb.sphere(0.18, 0xffffff, [0.65, 3.95, -0.05]);
    // banners
    mb.box(0.6, 1.0, 0.04, 0xd9473a, [-1.2, 1.9, 1.33], [0, 0, 0], 0.02);
    mb.box(0.6, 1.0, 0.04, 0xd9473a, [1.2, 1.9, 1.33], [0, 0, 0], 0.02);
    mb.sphere(0.18, 0xffc93c, [-1.2, 2.0, 1.37]);
    mb.sphere(0.18, 0xffc93c, [1.2, 2.0, 1.37]);
    const body = withOutline(new THREE.Mesh(mb.build(), toonMat()));
    body.castShadow = true; body.receiveShadow = true;
    castle.add(body);
    // flag
    const fmb = new MB();
    fmb.cyl(0.05, 0.05, 2.2, 0x6e4322, [0, 1.1, 0]);
    fmb.box(1.0, 0.6, 0.04, 0xffc93c, [0.52, 1.85, 0], [0, 0, 0], 0.02);
    fmb.sphere(0.25, 0xffffff, [0.5, 1.85, 0.04], [1, 1, 0.2]);
    fmb.sphere(0.1, 0xe53935, [0.55, 2.05, 0.06], [1, 1, 0.3]);
    const fl = withOutline(new THREE.Mesh(fmb.build(), toonMat()));
    fl.position.set(-2.4, 4.9, -2.8);
    castle.add(fl);
    castleFlag = fl;
    castle.position.set(end.x + end.dx * 2.2, 0, end.y + end.dy * 2.2);
    castle.rotation.y = Math.atan2(-end.dx, -end.dy);
    castle.scale.setScalar(0.95);
    group.add(castle);
  }

  // ───────── portals (enemy spawn caves) ─────────
  const portals: THREE.Object3D[] = [];
  const seenStarts: V2[] = [];
  for (const p of paths) {
    const s = p.at(0);
    if (seenStarts.some((q) => Math.hypot(q.x - s.x, q.y - s.y) < 2)) continue;
    seenStarts.push(s);
    const g = new THREE.Group();
    const mb = new MB();
    const rc = region === 3 ? 0x4a3a40 : region === 2 ? 0x8a96a8 : 0x8a7a6a;
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      mb.dodeca(0.75 + (i % 2) * 0.15, i % 2 ? rc : 0x6a5a50, [Math.cos(a) * 2.1, Math.sin(a) * 2.4, 0], [1, 1, 0.9]);
    }
    mb.dodeca(1.1, rc, [2.5, 0.4, -0.5]);
    mb.dodeca(0.9, rc, [-2.6, 0.3, -0.4]);
    if (region !== 2) mb.sphere(0.6, pal.lip, [1.4, 2.7, 0.2], [1.3, 0.6, 1]);
    const arch = withOutline(new THREE.Mesh(mb.build(), toonMat()));
    arch.castShadow = true;
    g.add(arch);
    const swirlM = new MB();
    swirlM.cyl(1.85, 1.85, 0.1, region === 3 ? 0x7a1a1a : 0x3a1a5a, [0, 0, 0], [Math.PI / 2, 0, 0], 24);
    swirlM.torus(1.3, 0.12, region === 3 ? 0xff6a3a : 0x9a5aff, [0, 0, 0.06], [0, 0, 0]);
    swirlM.torus(0.75, 0.1, region === 3 ? 0xffa060 : 0xc89aff, [0, 0, 0.07], [0, 0, 0]);
    const swirl = new THREE.Mesh(swirlM.build(), glowMat());
    swirl.position.set(0, 1.0, -0.2);
    g.add(swirl);
    animated.push({ obj: swirl, kind: 'portal', base: 0, speed: 1 });
    g.position.set(s.x - s.dx * 0.5, 0, s.y - s.dy * 0.5);
    g.rotation.y = Math.atan2(s.dx, s.dy);
    group.add(g);
    portals.push(g);
  }

  // ───────── decoration ─────────
  const decoTypes = buildDecoTypes(region, pal);
  const placements = new Map<string, THREE.Matrix4[]>();
  const castleP = castle.position;
  const portalPts = seenStarts;
  const tries = 520;
  for (let t = 0; t < tries; t++) {
    const x = rng.range(-HX, HX), y = rng.range(-HY, HY);
    if (islandSD(x, y, seed) > -1.2) continue;
    const pd = pathDist(x, y);
    if (pd < 2.7) continue;
    if (pd < 6 && rng.chance(0.55)) continue;
    if (spotDist(x, y) < 2.3) continue;
    if (Math.hypot(castleP.x - x, castleP.z - y) < 5) continue;
    if (portalPts.some((q) => Math.hypot(q.x - x, q.y - y) < 3.5)) continue;
    const near = pd < 4.5;
    const type = pickDeco(rng, region, near);
    const def = decoTypes[type];
    const sc = rng.range(def.scale[0], def.scale[1]);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, y) - 0.05, y),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, Math.PI * 2), 0)), new THREE.Vector3(sc, sc * rng.range(0.9, 1.15), sc));
    if (!placements.has(type)) placements.set(type, []);
    placements.get(type)!.push(m);
  }
  for (const [type, list] of placements) {
    const def = decoTypes[type];
    const mat = def.glow ? glowMat() : toonMat();
    const inst = new THREE.InstancedMesh(def.geo, mat, list.length);
    list.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = !def.flat;
    inst.receiveShadow = true;
    if (!def.flat && !def.glow) withOutline(inst);
    group.add(inst);
  }

  // ───────── background: mountains, clouds, little islands ─────────
  {
    const mb = new MB();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rng.range(-0.1, 0.1);
      const R = rng.range(85, 120);
      const h = rng.range(18, 42);
      const r = rng.range(12, 22);
      const x = Math.cos(a) * R, z = Math.sin(a) * R * 0.85 - 10;
      if (z > 30) continue;
      mb.cone(r, h, pal.mountain, [x, h / 2 - 22, z], [0, rng.range(0, 3), 0], 6);
      mb.cone(r * 0.32, h * 0.32, pal.mountainSnow, [x, h - 22 - h * 0.16 + 0.3, z], [0, rng.range(0, 3), 0], 6);
    }
    const mtn = new THREE.Mesh(mb.build(), toonMat());
    group.add(mtn);
  }
  {
    const cloudGeo = (() => {
      const mb = new MB();
      for (let i = 0; i < 6; i++) mb.sphere(rng.range(1.6, 2.6), pal.cloud, [i * 1.8 - 4.5, rng.range(-0.3, 0.6), rng.range(-0.8, 0.8)], [1, 0.75, 1], 10);
      return mb.build();
    })();
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(cloudGeo, toonMat({ transparent: true, opacity: 0.92 }));
      const a = rng.range(0, Math.PI * 2);
      const R = rng.range(42, 80);
      c.position.set(Math.cos(a) * R, rng.range(-14, 4), Math.sin(a) * R * 0.75 - 6);
      if (c.position.z > 18 && c.position.y > -6) c.position.y -= 10;
      c.scale.setScalar(rng.range(1, 2.4));
      group.add(c);
      animated.push({ obj: c, kind: 'cloud', base: c.position.x, speed: rng.range(0.3, 0.8) });
    }
    // low clouds under the island
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(cloudGeo, toonMat({ transparent: true, opacity: 0.85 }));
      c.position.set(rng.range(-40, 40), rng.range(-16, -10), rng.range(-28, 28));
      c.scale.setScalar(rng.range(1.4, 2.6));
      group.add(c);
      animated.push({ obj: c, kind: 'cloud', base: c.position.x, speed: rng.range(0.2, 0.5) });
    }
  }
  for (let i = 0; i < 6; i++) {
    const mb = new MB();
    const r = rng.range(2.5, 4.5);
    mb.cyl(r, r * 0.9, 0.8, pal.grass, [0, 0, 0], [0, 0, 0], 9);
    mb.cone(r * 0.9, r * 2.2, pal.rock, [0, -r * 1.1 - 0.4, 0], [Math.PI, 0, 0], 9);
    mb.cyl(r * 1.01, r * 0.92, 0.4, pal.lip, [0, -0.45, 0], [0, 0, 0], 9);
    const tree = decoTypes[region === 3 ? 'deadtree' : region === 2 ? 'pine' : 'tree'];
    void tree;
    mb.sphere(r * 0.35, region === 2 ? 0xffffff : region === 3 ? 0x5a3a3a : 0x5fb04a, [r * 0.2, r * 0.5, 0], [1, 1.1, 1], 10);
    mb.cyl(0.2, 0.3, r * 0.5, 0x6e4322, [r * 0.2, r * 0.15, 0], [0, 0, 0], 6);
    const isl = withOutline(new THREE.Mesh(mb.build(), toonMat()));
    const a = rng.range(0, Math.PI * 2);
    const R = rng.range(48, 64);
    isl.position.set(Math.cos(a) * R, rng.range(-6, 6), Math.sin(a) * R * 0.7 - 8);
    if (isl.position.z > 15) isl.position.z = -isl.position.z;
    group.add(isl);
    animated.push({ obj: isl, kind: 'bob', base: isl.position.y, speed: rng.range(0.3, 0.6) });
  }

  return { group, spotMeshes, castle, castleFlag, portals, animated, heightAt };
}

// ───────── decoration catalogue ─────────
interface DecoDef { geo: THREE.BufferGeometry; scale: [number, number]; flat?: boolean; glow?: boolean }

function buildDecoTypes(region: number, pal: Palette): Record<string, DecoDef> {
  const out: Record<string, DecoDef> = {};
  const mk = (fn: (mb: MB) => void) => { const mb = new MB(); fn(mb); return mb.build(); };
  out.tree = { scale: [0.8, 1.35], geo: mk((mb) => {
    mb.cyl(0.18, 0.28, 1.4, 0x7a4a26, [0, 0.7, 0], [0, 0, 0], 7);
    const g = region === 1 ? [0x3f8a5a, 0x4f9a6a, 0x2f7a4a] : [0x5fb04a, 0x6fc255, 0x4f9a3a];
    mb.sphere(1.0, g[0], [0, 2.0, 0], [1, 0.9, 1], 10);
    mb.sphere(0.75, g[1], [0.55, 2.5, 0.2], [1, 0.9, 1], 9);
    mb.sphere(0.7, g[2], [-0.5, 2.35, -0.25], [1, 0.9, 1], 9);
    mb.sphere(0.6, g[1], [0.05, 2.85, -0.1], [1, 0.9, 1], 9);
  }) };
  out.pine = { scale: [0.8, 1.4], geo: mk((mb) => {
    mb.cyl(0.15, 0.22, 1.0, 0x6e4322, [0, 0.5, 0], [0, 0, 0], 6);
    const c = region === 2 ? 0x3f7a6a : 0x2f6a4a;
    mb.cone(1.1, 1.4, c, [0, 1.5, 0], [0, 0, 0], 8);
    mb.cone(0.85, 1.2, c, [0, 2.2, 0], [0, 0.3, 0], 8);
    mb.cone(0.6, 1.0, c, [0, 2.85, 0], [0, 0.6, 0], 8);
    if (region === 2) {
      mb.cone(0.62, 0.5, 0xffffff, [0, 3.15, 0], [0, 0.6, 0], 8);
      mb.cone(0.9, 0.35, 0xffffff, [0, 2.6, 0], [0, 0.3, 0], 8);
      mb.cone(1.12, 0.3, 0xffffff, [0, 1.95, 0], [0, 0, 0], 8);
    }
  }) };
  out.deadtree = { scale: [0.8, 1.3], geo: mk((mb) => {
    mb.cyl(0.14, 0.3, 2.2, 0x3a2a2a, [0, 1.1, 0], [0, 0, 0], 6);
    mb.cyl(0.06, 0.12, 1.0, 0x3a2a2a, [0.4, 1.9, 0], [0, 0, -0.9], 5);
    mb.cyl(0.05, 0.1, 0.8, 0x3a2a2a, [-0.35, 2.1, 0.1], [0.2, 0, 0.8], 5);
    mb.cyl(0.04, 0.08, 0.6, 0x3a2a2a, [0.1, 2.4, -0.3], [-0.7, 0, 0.1], 5);
  }) };
  out.bush = { scale: [0.7, 1.2], geo: mk((mb) => {
    const c = region === 1 ? 0x3f8a5a : region === 2 ? 0xe8f2fa : region === 3 ? 0x5a3a3a : 0x5aa83f;
    mb.sphere(0.55, c, [0, 0.35, 0], [1, 0.75, 1], 9);
    mb.sphere(0.42, c, [0.45, 0.3, 0.1], [1, 0.75, 1], 8);
    mb.sphere(0.4, c, [-0.4, 0.28, -0.1], [1, 0.75, 1], 8);
    if (region === 0) { mb.sphere(0.08, 0xff5a7a, [0.2, 0.7, 0.3]); mb.sphere(0.08, 0xff5a7a, [-0.3, 0.6, 0.25]); }
  }) };
  out.rock = { scale: [0.5, 1.4], geo: mk((mb) => {
    mb.dodeca(0.6, pal.rock, [0, 0.3, 0], [1.2, 0.8, 1]);
    mb.dodeca(0.35, pal.rock2, [0.55, 0.15, 0.2], [1, 0.8, 1]);
    if (region === 2) mb.sphere(0.5, 0xffffff, [0, 0.62, 0], [1.2, 0.35, 1]);
  }) };
  out.flowers = { scale: [0.8, 1.2], flat: true, geo: mk((mb) => {
    const cs = [0xff6f91, 0xffd24a, 0xffffff, 0xb57cff, 0x6fd6ff];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.7, r = 0.3 + (i % 3) * 0.15;
      mb.cyl(0.015, 0.015, 0.25, 0x4f9a35, [Math.cos(a) * r, 0.12, Math.sin(a) * r], [0, 0, 0], 4);
      mb.sphere(0.07, cs[i % cs.length], [Math.cos(a) * r, 0.27, Math.sin(a) * r], [1, 0.6, 1], 6);
    }
  }) };
  out.mushroom = { scale: [0.7, 1.4], geo: mk((mb) => {
    const cap = region === 1 ? 0xb558d6 : 0xe5533a;
    mb.cyl(0.1, 0.14, 0.35, 0xf5ecd7, [0, 0.17, 0], [0, 0, 0], 7);
    mb.hemi(0.3, cap, [0, 0.32, 0], [1, 0.7, 1]);
    mb.sphere(0.05, 0xffffff, [0.12, 0.48, 0.1]);
    mb.cyl(0.07, 0.1, 0.22, 0xf5ecd7, [0.35, 0.11, 0.1], [0, 0, 0], 6);
    mb.hemi(0.2, cap, [0.35, 0.22, 0.1], [1, 0.7, 1]);
  }) };
  out.pond = { scale: [1.2, 2.2], flat: true, geo: mk((mb) => {
    mb.cyl(1.2, 1.2, 0.06, region === 1 ? 0x3a7a7a : 0x5ab8e8, [0, 0.02, 0], [0, 0, 0], 16, [1, 1, 0.7]);
    mb.cyl(1.35, 1.35, 0.04, 0x6a5a3a, [0, 0.0, 0], [0, 0, 0], 16, [1, 1, 0.7]);
    mb.cyl(0.25, 0.25, 0.03, 0x6aaa5a, [0.4, 0.06, 0.2], [0, 0, 0], 8);
    mb.sphere(0.06, 0xff9ac0, [0.4, 0.1, 0.2]);
  }) };
  out.crystal = { scale: [0.6, 1.3], geo: mk((mb) => {
    const c = region === 2 ? 0xbfefff : region === 3 ? 0xff5a4a : 0xc89aff;
    mb.cone(0.25, 1.2, c, [0, 0.5, 0], [0, 0, 0.1], 5);
    mb.cone(0.18, 0.8, c, [0.3, 0.35, 0.1], [0.2, 0, -0.4], 5);
    mb.cone(0.15, 0.6, c, [-0.25, 0.25, -0.1], [-0.2, 0, 0.5], 5);
  }) };
  out.lava = { scale: [1.0, 1.8], flat: true, glow: true, geo: mk((mb) => {
    mb.cyl(1.2, 1.2, 0.06, 0xff6a1a, [0, 0.03, 0], [0, 0, 0], 14, [1, 1, 0.75]);
    mb.cyl(0.7, 0.7, 0.07, 0xffc040, [0.2, 0.04, 0.1], [0, 0, 0], 12, [1, 1, 0.7]);
  }) };
  out.bones = { scale: [0.7, 1.1], geo: mk((mb) => {
    mb.sphere(0.25, 0xf2ecdc, [0, 0.2, 0]);
    mb.sphere(0.06, 0x1a1410, [0.08, 0.25, 0.2]);
    mb.sphere(0.06, 0x1a1410, [-0.08, 0.25, 0.2]);
    mb.cyl(0.05, 0.05, 0.7, 0xf2ecdc, [0.4, 0.05, 0.1], [0, 0.6, Math.PI / 2], 5);
  }) };
  out.snowman = { scale: [0.8, 1.0], geo: mk((mb) => {
    mb.sphere(0.5, 0xffffff, [0, 0.45, 0]);
    mb.sphere(0.35, 0xffffff, [0, 1.1, 0]);
    mb.cone(0.06, 0.3, 0xff8a1a, [0, 1.1, 0.4], [Math.PI / 2, 0, 0], 6);
    mb.sphere(0.05, 0x1a1410, [0.1, 1.2, 0.3]);
    mb.sphere(0.05, 0x1a1410, [-0.1, 1.2, 0.3]);
    mb.cyl(0.22, 0.25, 0.25, 0xd9473a, [0, 1.45, 0]);
  }) };
  out.log = { scale: [0.8, 1.2], geo: mk((mb) => {
    mb.cyl(0.25, 0.25, 1.6, 0x7a4a26, [0, 0.25, 0], [0, 0, Math.PI / 2], 8);
    mb.cyl(0.2, 0.2, 1.62, 0xc89a5a, [0, 0.25, 0], [0, 0, Math.PI / 2], 8, [1, 1, 1]);
    mb.sphere(0.12, 0x5aa83f, [0.3, 0.5, 0], [1, 0.5, 1]);
  }) };
  return out;
}

function pickDeco(rng: Rng, region: number, nearPath: boolean): string {
  const table: Record<number, [string, number][]> = {
    0: [['tree', 3], ['bush', 3], ['rock', 2], ['flowers', 6], ['mushroom', 1], ['pond', 0.3], ['log', 0.5]],
    1: [['tree', 3], ['pine', 2], ['bush', 3], ['mushroom', 3], ['pond', 1.2], ['rock', 1.5], ['log', 1], ['crystal', 0.4]],
    2: [['pine', 5], ['rock', 3], ['crystal', 1.5], ['bush', 1.5], ['snowman', 0.25]],
    3: [['deadtree', 4], ['rock', 5], ['crystal', 2], ['lava', 1.5], ['bones', 1.5], ['bush', 0.8]],
  };
  let t = table[region];
  if (nearPath) t = t.filter(([k]) => !['tree', 'pine', 'deadtree', 'pond', 'lava'].includes(k));
  const total = t.reduce((a, b) => a + b[1], 0);
  let r = rng.next() * total;
  for (const [k, w] of t) { r -= w; if (r <= 0) return k; }
  return t[0][0];
}
