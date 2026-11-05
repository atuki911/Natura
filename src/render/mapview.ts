import * as THREE from 'three';
import { STAGES, REGIONS } from '../data/stages.ts';
import type { SaveData } from '../save.ts';
import { stageUnlocked } from '../save.ts';
import { Path } from '../sim/path.ts';
import { Rng } from '../sim/rng.ts';
import { MB } from './builder.ts';
import { toonMat, withOutline, glowMat, swayMat, swayUniform } from './toon.ts';
import { PALETTES, fbm, buildDecoTypes, pickDeco, SWAYING } from './env.ts';
import { egg } from './models/towers.ts';
import { createRig, animateRig, type Rig } from './rig.ts';
import { ICON } from '../ui/icons.ts';

/** world position of a stage on the map */
export function nodePos(i: number): THREE.Vector3 {
  const m = STAGES[i].mapPos;
  return new THREE.Vector3(8 + m.x * 1.44 - 80, 0, m.y * 0.92 + 5 - 50);
}

interface IslandDef { region: number; cx: number; cz: number; rx: number; rz: number; label: THREE.Vector3 }
const ISLANDS: IslandDef[] = [
  { region: 0, cx: -47, cz: 13, rx: 21, rz: 23, label: new THREE.Vector3(-47, 0, 36) },
  { region: 1, cx: -5, cz: 9, rx: 18, rz: 18, label: new THREE.Vector3(-5, 0, 28) },
  { region: 2, cx: 26, cz: -17, rx: 20, rz: 18, label: new THREE.Vector3(26, 0, -37) },
  { region: 3, cx: 51, cz: 18, rx: 18, rz: 25, label: new THREE.Vector3(66, 0, 2) },
];

function insideIsland(x: number, z: number): IslandDef | null {
  for (const I of ISLANDS) {
    const k = ((x - I.cx) / I.rx) ** 2 + ((z - I.cz) / I.rz) ** 2;
    if (k < 0.86) return I;
  }
  return null;
}

const el = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export class MapView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 700);
  readonly layer: HTMLElement;
  private target = new THREE.Vector2(0, 0);
  private vel = new THREE.Vector2();
  private dist = 60;
  private pitch = 1.0;
  private nodes: { pos: THREE.Vector3; el: HTMLElement }[] = [];
  private labels: { pos: THREE.Vector3; el: HTMLElement }[] = [];
  private spin: THREE.Object3D[] = [];
  private clouds: { o: THREE.Object3D; base: number; sp: number }[] = [];
  private smoke: { o: THREE.Mesh; t: number }[] = [];
  private flags: THREE.Object3D[] = [];
  private hero: Rig | null = null;
  private heroBase = new THREE.Vector3();
  private lava: THREE.Mesh | null = null;
  private time = 0;
  private sun: THREE.DirectionalLight;

  constructor(private renderer: THREE.WebGLRenderer, parent: HTMLElement, data: SaveData, heroModel: string, private onSelect: (i: number) => void) {
    this.layer = el('div', 'map-layer');
    parent.appendChild(this.layer);
    // light & sky
    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x7a9a5a, 1.3));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
    this.sun.position.set(-40, 70, 45);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -90; sc.right = 90; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 220;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0x9fd6f8, 150, 340);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x3f92ea) }, mid: { value: new THREE.Color(0xd2efff) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; varying vec3 vP; void main(){ float h = clamp(vP.y*1.5+0.35,0.0,1.0); gl_FragColor = vec4(mix(mid, top, h), 1.0); }',
    }));
    sky.renderOrder = -1;
    this.scene.add(sky);

    this.build(data, heroModel);
    this.setupInput();
    // start centred on the next stage
    const next = STAGES.findIndex((_, i) => stageUnlocked(data, i) && data.progress[i].stars === 0);
    const focus = nodePos(next >= 0 ? next : STAGES.length - 1);
    this.target.set(focus.x, focus.z);
    this.resize();
  }

  // ───────────────────────── scene ─────────────────────────
  private build(data: SaveData, heroModel: string) {
    const rng = new Rng(4242);
    const pts = STAGES.map((_, i) => nodePos(i));
    const route = new Path(pts.map((p) => ({ x: p.x, y: p.z })));

    // sea of clouds far below
    const sea = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshBasicMaterial({ color: 0x7cc6f2, fog: false }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -34;
    this.scene.add(sea);

    for (const I of ISLANDS) this.scene.add(this.island(I, rng));

    // route: dirt dots on land, rope bridge planks over the gaps
    {
      const land: THREE.Matrix4[] = [], plank: THREE.Matrix4[] = [], post: THREE.Matrix4[] = [];
      let k = 0;
      for (let d = 0; d <= route.length; d += 0.9) {
        const q = route.at(d);
        const ang = Math.atan2(q.dx, q.dy);
        const onLand = insideIsland(q.x, q.y);
        if (onLand) land.push(new THREE.Matrix4().compose(new THREE.Vector3(q.x, 0.06, q.y), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0)), new THREE.Vector3(1, 1, 1)));
        else {
          const sag = -0.6;
          plank.push(new THREE.Matrix4().compose(new THREE.Vector3(q.x, sag, q.y), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0)), new THREE.Vector3(1, 1, 1)));
          if (k++ % 3 === 0) for (const s of [-1, 1]) post.push(new THREE.Matrix4().makeTranslation(q.x - q.dy * 1.1 * s, sag + 0.5, q.y + q.dx * 1.1 * s));
        }
      }
      const mk = (fn: (m: MB) => void) => { const m = new MB(); fn(m); return m.build(); };
      const dot = mk((m) => m.cyl(1.25, 1.35, 0.1, 0xe2c48a, [0, 0, 0], [0, 0, 0], 10, [1, 1, 0.8]));
      const pl = mk((m) => { m.box(2.2, 0.16, 0.7, 0xb07840, [0, 0, 0], [0, 0, 0], 0.04); m.box(2.4, 0.08, 0.08, 0x6e4322, [0, 0.4, 0.3]); });
      const ps = mk((m) => m.cyl(0.1, 0.12, 1.2, 0x6e4322, [0, 0, 0], [0, 0, 0], 6));
      for (const [geo, list, outline] of [[dot, land, false], [pl, plank, true], [ps, post, true]] as const) {
        if (!list.length) continue;
        const im = new THREE.InstancedMesh(geo, toonMat(), list.length);
        list.forEach((m, i) => im.setMatrixAt(i, m));
        im.receiveShadow = true;
        im.castShadow = outline;
        if (outline) withOutline(im);
        this.scene.add(im);
      }
    }

    this.landmarks(rng, pts);
    this.decorate(rng, route, pts);

    // stage platforms + flags
    STAGES.forEach((st, i) => {
      const p = pts[i];
      const pr = data.progress[i];
      const unlocked = stageUnlocked(data, i);
      const mb = new MB();
      mb.cyl(2.1, 2.4, 0.6, 0xc8c0b0, [0, 0.3, 0], [0, 0, 0], 16);
      mb.cyl(1.7, 1.7, 0.08, unlocked ? 0xffd86a : 0x9a9080, [0, 0.62, 0], [0, 0, 0], 16);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; mb.dodeca(0.32, k % 2 ? 0xa8a090 : 0xd8d0c0, [Math.cos(a) * 2.2, 0.35, Math.sin(a) * 2.2], [1, 0.7, 1]); }
      const base = withOutline(new THREE.Mesh(mb.build(), toonMat()));
      base.position.copy(p);
      base.castShadow = true; base.receiveShadow = true;
      this.scene.add(base);
      const fm = new MB();
      fm.cyl(0.08, 0.08, 3.2, 0x6e4322, [0, 1.6, 0]);
      const col = !unlocked ? 0x8a8278 : pr.stars ? [0x5fb04a, 0x3f9a8a, 0x5a8ad0, 0xd9473a][st.region] : 0xffc93c;
      fm.box(1.5, 0.95, 0.06, col, [0.78, 2.7, 0], [0, 0, 0], 0.03);
      fm.sphere(0.16, 0xffd23f, [0, 3.25, 0]);
      const flag = withOutline(new THREE.Mesh(fm.build(), toonMat()));
      flag.position.set(p.x + 1.3, 0.5, p.z - 0.8);
      flag.castShadow = true;
      this.scene.add(flag);
      this.flags.push(flag);
      // HTML marker
      const next = unlocked && pr.stars === 0;
      const b = el('div', 'mnode' + (unlocked ? '' : ' locked') + (next ? ' next' : '') + (pr.stars ? ' done r' + st.region : ''));
      b.innerHTML = `${next ? '<div class="mn-arrow">▼</div>' : ''}<div class="mn-badge outlined">${unlocked ? i + 1 : ICON.lock}</div>
        ${unlocked ? `<div class="mn-stars">${[0, 1, 2].map((k) => (k < pr.stars ? ICON.star : ICON.starEmpty)).join('')}${pr.heroic ? '<i class="mn-b h"></i>' : ''}${pr.iron ? '<i class="mn-b i"></i>' : ''}</div>` : ''}
        ${next ? `<div class="mn-name outlined">${st.name}</div>` : ''}`;
      b.dataset.i = String(i);
      this.layer.appendChild(b);
      this.nodes.push({ pos: p.clone().setY(1.2), el: b });
    });
    REGIONS.forEach((r, k) => {
      const lab = el('div', 'mregion outlined', `<span>${r.name}</span>`);
      this.layer.appendChild(lab);
      this.labels.push({ pos: ISLANDS[k].label, el: lab });
    });

    // the selected hero waits beside the next stage
    const next = STAGES.findIndex((_, i) => stageUnlocked(data, i) && data.progress[i].stars === 0);
    const hp = pts[next >= 0 ? next : STAGES.length - 1];
    this.hero = createRig(heroModel);
    this.heroBase.set(hp.x - 2.6, 0.6, hp.z + 1.2);
    this.hero.root.position.copy(this.heroBase);
    this.hero.root.scale.setScalar(2.2);
    this.hero.root.rotation.y = 0.4;
    this.scene.add(this.hero.root);

    // clouds around and between the islands
    const cg = (() => { const m = new MB(); for (let i = 0; i < 6; i++) m.sphere(rng.range(1.8, 2.8), 0xffffff, [i * 1.9 - 4.8, rng.range(-0.3, 0.6), rng.range(-0.9, 0.9)], [1, 0.72, 1], 10); return m.build(); })();
    for (let i = 0; i < 34; i++) {
      const c = new THREE.Mesh(cg, toonMat({ transparent: true, opacity: 0.9 }));
      const x = rng.range(-110, 110), z = rng.range(-70, 70);
      const onLand = insideIsland(x, z);
      c.position.set(x, onLand ? rng.range(-22, -12) : rng.range(-14, -3), z);
      c.scale.setScalar(rng.range(1.4, 3));
      this.scene.add(c);
      this.clouds.push({ o: c, base: x, sp: rng.range(0.4, 1) });
    }
    // little floating rocks
    for (let i = 0; i < 14; i++) {
      const m = new MB();
      const r = rng.range(1.2, 2.6);
      m.cyl(r, r * 0.85, 0.6, 0x86cf4f, [0, 0, 0], [0, 0, 0], 8);
      m.cone(r * 0.85, r * 2, 0x8a7060, [0, -r - 0.3, 0], [Math.PI, 0, 0], 8);
      if (rng.chance(0.6)) m.sphere(r * 0.5, 0x5fb04a, [0, r * 0.5, 0], [1, 1.1, 1], 8);
      const o = withOutline(new THREE.Mesh(m.build(), toonMat()));
      let x = 0, z = 0;
      for (let t = 0; t < 20; t++) { x = rng.range(-95, 95); z = rng.range(-60, 60); if (!insideIsland(x, z) && !ISLANDS.some((I) => Math.hypot((x - I.cx) / (I.rx + 6), (z - I.cz) / (I.rz + 6)) < 1)) break; }
      o.position.set(x, rng.range(-8, 2), z);
      this.scene.add(o);
      this.clouds.push({ o, base: x, sp: 0 });
    }
  }

  private island(I: IslandDef, rng: Rng): THREE.Group {
    const pal = PALETTES[I.region];
    const g = new THREE.Group();
    const R = 9, S = 64;
    const radius = (a: number) => 1 + (fbm(Math.cos(a) * 1.4 + I.cx, Math.sin(a) * 1.4 + I.cz) - 0.5) * 0.32;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const c1 = new THREE.Color(pal.grass), c2 = new THREE.Color(pal.grass2), lip = new THREE.Color(pal.lip), t = new THREE.Color();
    pos.push(I.cx, 0, I.cz); col.push(c1.r, c1.g, c1.b);
    for (let r = 1; r <= R; r++) {
      for (let s = 0; s < S; s++) {
        const a = (s / S) * Math.PI * 2;
        const k = (r / R) * radius(a);
        const x = I.cx + Math.cos(a) * I.rx * k, z = I.cz + Math.sin(a) * I.rz * k;
        const y = r === R ? -0.15 : (fbm(x * 0.18, z * 0.18) - 0.5) * 0.25;
        pos.push(x, y, z);
        t.copy(c1).lerp(c2, Math.min(1, Math.max(0, fbm(x * 0.15 + 3, z * 0.15) * 1.6 - 0.4)));
        if (r >= R - 1) t.lerp(lip, 0.5);
        col.push(t.r, t.g, t.b);
      }
    }
    const vi = (r: number, s: number) => (r === 0 ? 0 : 1 + (r - 1) * S + (s % S));
    for (let s = 0; s < S; s++) idx.push(0, vi(1, s + 1), vi(1, s));
    for (let r = 1; r < R; r++) for (let s = 0; s < S; s++) {
      const a = vi(r, s), b = vi(r, s + 1), c = vi(r + 1, s), d = vi(r + 1, s + 1);
      idx.push(a, b, c, b, d, c);
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    top.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    top.setIndex(idx);
    top.computeVertexNormals();
    const tm = new THREE.Mesh(top, toonMat());
    tm.receiveShadow = true;
    g.add(tm);
    // cliffs
    const levels = [{ y: -1.4, s: 1.02 }, { y: -4.5, s: 0.93 }, { y: -9.5, s: 0.74 }, { y: -16, s: 0.48 }, { y: -24, s: 0.16 }];
    const cols = [pal.lip, pal.dirt, pal.rock, pal.rock2, pal.rock2];
    const ring = (s: number, l: number) => {
      const a = (s / S) * Math.PI * 2;
      const k = radius(a) * (l < 0 ? 1 : levels[l].s) + (l >= 0 ? (fbm(s * 0.7 + l * 3, l) - 0.5) * 0.12 : 0);
      return new THREE.Vector3(I.cx + Math.cos(a) * I.rx * k, l < 0 ? -0.15 : levels[l].y + (fbm(s * 1.3, l * 7) - 0.5) * 1.6, I.cz + Math.sin(a) * I.rz * k);
    };
    const cp: number[] = [], cc: number[] = [];
    for (let l = -1; l < levels.length - 1; l++) {
      t.set(cols[l + 1]);
      for (let s = 0; s < S; s++) {
        const A0 = ring(s, l), B0 = ring(s + 1, l), A1 = ring(s, l + 1), B1 = ring(s + 1, l + 1);
        const sh = 0.85 + fbm(s * 2.1, l * 5.3) * 0.3;
        for (const v of [A0, A1, B0, B0, A1, B1]) { cp.push(v.x, v.y, v.z); cc.push(t.r * sh, t.g * sh, t.b * sh); }
      }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    cg.computeVertexNormals();
    const cm = new THREE.Mesh(cg, toonMat({ }));
    (cm.material as THREE.Material).side = THREE.DoubleSide;
    g.add(cm);
    void rng;
    return g;
  }

  private decorate(rng: Rng, route: Path, pts: THREE.Vector3[]) {
    const routePts: { x: number; y: number }[] = [];
    for (let d = 0; d <= route.length; d += 1) routePts.push(route.at(d));
    const lm = this.landmarkSpots;
    for (const I of ISLANDS) {
      const types = buildDecoTypes(I.region, PALETTES[I.region]);
      const place = new Map<string, THREE.Matrix4[]>();
      const n = Math.round(I.rx * I.rz * 0.19);
      for (let t = 0; t < n * 3 && n > 0; t++) {
        const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 0.9;
        const x = I.cx + Math.cos(a) * I.rx * r, z = I.cz + Math.sin(a) * I.rz * r;
        if (routePts.some((q) => (q.x - x) ** 2 + (q.y - z) ** 2 < 5.5)) continue;
        if (pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 16)) continue;
        if (lm.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r)) continue;
        const type = pickDeco(rng, I.region, false);
        const def = types[type];
        const sc = rng.range(def.scale[0], def.scale[1]) * 1.25;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, 6.3), 0)), new THREE.Vector3(sc, sc, sc));
        if (!place.has(type)) place.set(type, []);
        place.get(type)!.push(m);
        if ([...place.values()].reduce((s, l) => s + l.length, 0) >= n) break;
      }
      for (const [type, list] of place) {
        const def = types[type];
        const sway = SWAYING.includes(type);
        const im = new THREE.InstancedMesh(def.geo, def.glow ? glowMat() : sway ? swayMat() : toonMat(), list.length);
        list.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = !def.flat;
        im.receiveShadow = true;
        if (!def.flat && !def.glow) withOutline(im, undefined, sway);
        this.scene.add(im);
      }
    }
  }

  private landmarkSpots: { x: number; z: number; r: number }[] = [];

  private landmarks(rng: Rng, pts: THREE.Vector3[]) {
    const add = (o: THREE.Object3D, x: number, z: number, r: number) => { o.position.set(x, 0, z); this.scene.add(o); this.landmarkSpots.push({ x, z, r }); };
    const mesh = (fn: (m: MB) => void, glow = false) => { const m = new MB(); fn(m); const o = new THREE.Mesh(m.build(), glow ? glowMat() : toonMat()); if (!glow) withOutline(o); o.castShadow = true; o.receiveShadow = true; return o; };
    // home castle with the golden egg
    const castle = mesh((m) => {
      const W = 0xe2dccd;
      m.box(7, 3.6, 5, W, [0, 1.8, 0], [0, 0, 0], 0.2);
      for (let i = -3; i <= 3; i++) m.box(0.7, 0.7, 0.5, W, [i * 1.0, 3.95, 2.4], [0, 0, 0], 0.08);
      m.box(1.8, 2.4, 0.3, 0x6b4428, [0, 1.2, 2.5], [0, 0, 0], 0.1);
      m.cyl(0.9, 0.9, 0.32, 0x6b4428, [0, 2.4, 2.5], [Math.PI / 2, 0, 0], 16);
      for (const [x, z] of [[-3.6, 2.2], [3.6, 2.2], [-3.6, -2.2], [3.6, -2.2]]) {
        m.cyl(1.2, 1.3, 5.4, W, [x, 2.7, z], [0, 0, 0], 14);
        m.cone(1.6, 2.4, 0xd9473a, [x, 6.6, z], [0, 0, 0], 12);
        m.sphere(0.2, 0xffd23f, [x, 7.9, z]);
      }
      m.cyl(2.2, 1.8, 0.8, 0xc8a050, [0, 4.0, -0.4], [0, 0, 0], 16);
      m.sphere(1.0, 0xffd23c, [0, 5.0, -0.4], [1, 1.3, 1]);
      m.sphere(0.25, 0xffffff, [-0.35, 5.6, 0.2]);
      m.box(0.8, 1.4, 0.06, 0x3d6fb5, [-1.8, 2.4, 2.53], [0, 0, 0], 0.02);
      m.box(0.8, 1.4, 0.06, 0x3d6fb5, [1.8, 2.4, 2.53], [0, 0, 0], 0.02);
    });
    castle.rotation.y = 0.5;
    add(castle, -63, 14, 6.5);
    // windmill
    const mill = mesh((m) => {
      m.cyl(1.4, 1.9, 5, 0xf2e6cc, [0, 2.5, 0], [0, 0, 0], 10);
      m.cone(2.0, 1.8, 0xc0392b, [0, 5.9, 0], [0, 0, 0], 10);
      m.box(0.8, 1.2, 0.1, 0x6b4428, [0, 0.6, 1.75], [0, 0, 0], 0.05);
      m.cyl(0.35, 0.35, 0.1, 0x6fbfff, [0, 3.6, 1.55], [Math.PI / 2, 0, 0], 10);
    });
    add(mill, -38, 28, 4);
    const blades = mesh((m) => {
      m.cyl(0.25, 0.25, 0.6, 0x6b4428, [0, 0, 0], [Math.PI / 2, 0, 0], 8);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        m.box(0.5, 3.6, 0.08, 0xf5ecd7, [Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.2], [0, 0, a - Math.PI / 2], 0.02);
        m.box(0.1, 3.8, 0.12, 0x8a5a2b, [Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.12], [0, 0, a - Math.PI / 2]);
      }
    });
    blades.position.set(-38, 4.6, 28 + 1.9);
    this.scene.add(blades);
    this.spin.push(blades);
    // village coops
    for (const [x, z] of [[-55, 0], [-58, 3], [-51, -3]]) add(mesh((m) => {
      m.box(2, 1.4, 1.6, 0xe8d0a0, [0, 0.7, 0], [0, 0, 0], 0.06);
      m.box(1.5, 0.12, 1.9, 0xd9473a, [0.5, 1.75, 0], [0, 0, -0.6], 0.03);
      m.box(1.5, 0.12, 1.9, 0xd9473a, [-0.5, 1.75, 0], [0, 0, 0.6], 0.03);
      m.box(0.5, 0.7, 0.05, 0x6b4428, [0, 0.35, 0.82]);
    }), x + rng.range(-1, 1), z, 2.2);
    // giant tree in the forest
    add(mesh((m) => {
      m.cyl(1.0, 1.6, 6, 0x7a4a26, [0, 3, 0], [0, 0, 0], 9);
      for (const [x, y, z, r] of [[0, 7, 0, 3.6], [2.4, 6.2, 1, 2.4], [-2.2, 6.4, -0.8, 2.5], [0.4, 9.2, 0.2, 2.4], [-1, 5.6, 2.2, 2]]) m.sphere(r, 0x3f8a5a, [x, y, z], [1, 0.85, 1], 12);
      m.sphere(0.4, 0xd84a8a, [2, 8.4, 2]);
      m.sphere(0.35, 0xffd23f, [-2, 7.2, 2.3]);
    }), -15, 23, 5);
    // ice peaks
    for (const [x, z, h] of [[37, -30, 11], [31, -34, 8], [16, -26, 7], [42, -22, 6]]) add(mesh((m) => {
      m.cone(h * 0.55, h, 0xa8c0e0, [0, h / 2, 0], [0, rng.range(0, 3), 0], 6);
      m.cone(h * 0.24, h * 0.36, 0xffffff, [0, h * 0.84, 0], [0, rng.range(0, 3), 0], 6);
    }), x, z, h * 0.5);
    // volcano
    const vol = mesh((m) => {
      m.cone(7, 10, 0x4a3438, [0, 5, 0], [0, 0.3, 0], 9);
      m.cyl(2.2, 2.6, 0.6, 0x3a2a30, [0, 9.8, 0], [0, 0, 0], 9);
      for (let k = 0; k < 3; k++) m.box(0.6, 6, 0.3, 0xff7a1a, [Math.cos(k * 2.1) * 3.4, 5, Math.sin(k * 2.1) * 3.4], [Math.sin(k * 2.1) * 0.6, 0, -Math.cos(k * 2.1) * 0.6]);
    });
    add(vol, 63, 27, 8);
    this.lava = mesh((m) => m.cyl(2.0, 2.0, 0.2, 0xffa030, [0, 0, 0], [0, 0, 0], 12), true);
    this.lava.position.set(63, 10.1, 27);
    this.scene.add(this.lava);
    // demon fortress beside the last stage
    const last = pts[pts.length - 1];
    add(mesh((m) => {
      m.box(5, 4, 4, 0x4a3048, [0, 2, 0], [0, 0, 0], 0.15);
      for (const [x, z] of [[-2.6, 1.8], [2.6, 1.8], [-2.6, -1.8], [2.6, -1.8]]) { m.cyl(0.9, 1, 5.6, 0x3a2438, [x, 2.8, z], [0, 0, 0], 8); m.cone(1.2, 2.4, 0x2a1a2a, [x, 6.8, z], [0, 0, 0], 8); }
      m.box(1.4, 2, 0.2, 0x1a0a1a, [0, 1, 2.05]);
      m.sphere(0.5, 0xff3a5a, [0, 3.2, 2.05]);
      m.cone(0.4, 1.2, 0xf2ecdc, [1.2, 4.6, 0], [0, 0, -0.6], 5);
      m.cone(0.4, 1.2, 0xf2ecdc, [-1.2, 4.6, 0], [0, 0, 0.6], 5);
    }), last.x + 6, last.z + 2, 5.5);
  }

  // ───────────────────────── input ─────────────────────────
  private setupInput() {
    let down: { x: number; y: number; sx: number; sy: number; t: number; node: number } | null = null;
    let dragging = false;
    this.layer.addEventListener('pointerdown', (e) => {
      const n = (e.target as HTMLElement).closest('.mnode') as HTMLElement | null;
      down = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), node: n ? Number(n.dataset.i) : -1 };
      dragging = false;
      this.vel.set(0, 0);
      this.layer.setPointerCapture(e.pointerId);
    });
    this.layer.addEventListener('pointermove', (e) => {
      if (!down) return;
      if (!dragging && Math.hypot(e.clientX - down.sx, e.clientY - down.sy) > 8) dragging = true;
      if (dragging) {
        const a = this.ground(down.x, down.y), b = this.ground(e.clientX, e.clientY);
        if (a && b) {
          this.target.x -= b.x - a.x; this.target.y -= b.z - a.z;
          const dt = Math.max(1, performance.now() - down.t);
          this.vel.set(-(b.x - a.x) / dt * 16, -(b.z - a.z) / dt * 16);
        }
        down.x = e.clientX; down.y = e.clientY; down.t = performance.now();
      }
    });
    const up = () => {
      if (down && !dragging && down.node >= 0) this.onSelect(down.node);
      if (!dragging) this.vel.set(0, 0);
      down = null;
    };
    this.layer.addEventListener('pointerup', up);
    this.layer.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    this.layer.addEventListener('pointercancel', () => { down = null; });
  }

  private ground(sx: number, sy: number): THREE.Vector3 | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1), this.camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
  }

  resize() {
    const r = this.renderer.domElement.getBoundingClientRect();
    const w = r.width || window.innerWidth, h = r.height || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // fixed zoom: about one and a half islands across the screen
    const visW = this.camera.aspect >= 1 ? 72 : 48;
    this.dist = Math.min(130, Math.max(34, visW / (2 * Math.tan(THREE.MathUtils.degToRad(20)) * this.camera.aspect)));
  }

  nodeElement(i: number): HTMLElement | null { return this.nodes[i]?.el.querySelector('.mn-badge') ?? null; }

  frame(dt: number) {
    this.time += dt;
    swayUniform.value = this.time;
    // inertia + bounds
    if (this.vel.lengthSq() > 1e-4) { this.target.addScaledVector(this.vel, dt * 3); this.vel.multiplyScalar(Math.pow(0.02, dt)); }
    this.target.x = Math.max(-58, Math.min(58, this.target.x));
    this.target.y = Math.max(-34, Math.min(36, this.target.y));
    const off = Math.cos(this.pitch) * this.dist;
    this.camera.position.set(this.target.x, Math.sin(this.pitch) * this.dist, this.target.y + off);
    this.camera.lookAt(this.target.x, 0, this.target.y);
    for (const b of this.spin) b.rotation.z += dt * 1.2;
    for (const c of this.clouds) c.o.position.x = c.base + Math.sin(this.time * 0.05 * c.sp) * 6;
    this.flags.forEach((f, i) => { f.rotation.y = Math.sin(this.time * 2 + i) * 0.18; });
    if (this.lava) (this.lava.material as THREE.MeshBasicMaterial).color.setHSL(0.07, 1, 0.55 + Math.sin(this.time * 3) * 0.08);
    // volcano smoke
    if (Math.random() < dt * 2.5) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8a8078, transparent: true, opacity: 0.6, depthWrite: false }));
      m.position.set(63 + (Math.random() - 0.5), 11, 27);
      this.scene.add(m);
      this.smoke.push({ o: m, t: 0 });
    }
    for (const s of this.smoke) {
      s.t += dt;
      s.o.position.y += dt * 2.2; s.o.position.x += dt * 0.8;
      s.o.scale.setScalar(1 + s.t * 0.9);
      (s.o.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - s.t * 0.15);
    }
    const old = this.smoke.filter((s) => s.t > 4);
    for (const s of old) { this.scene.remove(s.o); s.o.geometry.dispose(); }
    this.smoke = this.smoke.filter((s) => s.t <= 4);
    if (this.hero) {
      animateRig(this.hero, dt, 0, 0, this.time);
      this.hero.root.position.y = this.heroBase.y + Math.abs(Math.sin(this.time * 3)) * 0.25;
    }
    // HTML markers
    const r = this.renderer.domElement.getBoundingClientRect();
    const place = (pos: THREE.Vector3, e: HTMLElement) => {
      const v = pos.clone().project(this.camera);
      const x = r.left + (v.x * 0.5 + 0.5) * r.width, y = r.top + (-v.y * 0.5 + 0.5) * r.height;
      const vis = v.z < 1 && x > -120 && x < r.width + 120 && y > -120 && y < r.height + 120;
      e.style.display = vis ? '' : 'none';
      if (vis) e.style.transform = `translate(${x}px, ${y}px)`;
    };
    for (const n of this.nodes) place(n.pos, n.el);
    for (const l of this.labels) place(l.pos, l.el);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.layer.remove();
    // the hero rig shares cached geometry with battle models: detach it before freeing map geometry
    if (this.hero) this.scene.remove(this.hero.root);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !o.userData.outline && m.geometry) m.geometry.dispose();
    });
  }
}
