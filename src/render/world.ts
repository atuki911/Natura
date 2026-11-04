import * as THREE from 'three';
import type { Game, Enemy, Unit, Tower, Projectile, GEvent } from '../sim/game.ts';
import { buildEnvironment, PALETTES, type EnvBuild } from './env.ts';
import { createRig, animateRig, type Rig } from './rig.ts';
import { TOWER_MODELS, egg, type TowerRig } from './models/towers.ts';
import { MB } from './builder.ts';
import { toonMat, withOutline, glowMat, outlineUniforms } from './toon.ts';
import { ParticleSystem, PCOL } from './particles.ts';

export type PickKind = 'spot' | 'tower' | 'hero' | 'enemy' | 'ground' | 'none';
export interface Pick { kind: PickKind; id: number; x: number; y: number; sx: number; sy: number; inside: boolean }

interface EnemyView { rig: Rig; dying: number; lastX: number; lastY: number; ice?: THREE.Mesh; scalePulse: number; size: number; flying: boolean }
interface UnitView { rig: Rig; dying: number; lastX: number; lastY: number; ring?: THREE.Mesh; wasDead: boolean; appear: number }
interface TowerView { group: THREE.Group; defId: string; turret?: THREE.Object3D; orb?: THREE.Object3D; crew: Rig[]; ice?: THREE.Mesh; built: number; top: number }
interface ProjView { obj: THREE.Object3D; kind: string }
interface Fx { obj: THREE.Object3D; t: number; dur: number; update: (f: Fx, k: number) => void; dispose?: boolean }

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const ENT = 1.75, TWR = 1.3;

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  private skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
  private stage: THREE.Group | null = null;
  env: EnvBuild | null = null;
  game: Game | null = null;
  private enemyViews = new Map<number, EnemyView>();
  private unitViews = new Map<number, UnitView>();
  private towerViews = new Map<number, TowerView>();
  private projViews = new Map<number, ProjView>();
  private zoneViews = new Map<number, THREE.Object3D>();
  private fx: Fx[] = [];
  private pNormal = new ParticleSystem(2500, false);
  private pAdd = new ParticleSystem(3500, true);
  private hpBg: THREE.InstancedMesh;
  private hpFg: THREE.InstancedMesh;
  private rangeRing: THREE.Group;
  private rallyFlag: THREE.Group;
  private selRing: THREE.Mesh;
  private targetMarker: THREE.Mesh;
  private time = 0;
  private shake = 0;
  region = 0;
  quality = { shadows: true, pixelRatio: Math.min(2, window.devicePixelRatio || 1) };
  // camera
  target = new THREE.Vector2(0, 1);
  dist = 60;
  fitDist = 60;
  pitch = 0.86;
  private towerRigCache = new Map<string, TowerRig>();
  private projGeo = new Map<string, THREE.BufferGeometry>();
  private iceGeo: THREE.BufferGeometry;
  onTap: (p: Pick) => void = () => {};
  onHover: (p: Pick) => void = () => {};
  heroSelected = false;
  menuMode = false;

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 600);

    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x6a8a3a, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    this.sun.position.set(-28, 50, 30);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -46; sc.right = 46; sc.top = 34; sc.bottom = -34; sc.near = 10; sc.far = 140;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // sky dome
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h*1.6,0.0,1.0), 0.8)) : mix(horizon, bottom, clamp(-h*2.5,0.0,1.0));
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    this.scene.add(this.pNormal.points, this.pAdd.points);

    // health bars
    const bgGeo = new THREE.PlaneGeometry(1, 0.17);
    const fgGeo = new THREE.PlaneGeometry(1, 0.11);
    fgGeo.translate(0.5, 0, 0);
    this.hpBg = new THREE.InstancedMesh(bgGeo, new THREE.MeshBasicMaterial({ color: 0x2a1410, depthWrite: false }), 600);
    this.hpFg = new THREE.InstancedMesh(fgGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }), 600);
    this.hpFg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3);
    this.hpBg.renderOrder = 20; this.hpFg.renderOrder = 21;
    this.hpBg.frustumCulled = false; this.hpFg.frustumCulled = false;
    this.scene.add(this.hpBg, this.hpFg);

    // range ring
    this.rangeRing = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
    ring.rotation.x = fill.rotation.x = -Math.PI / 2;
    this.rangeRing.add(fill, ring);
    this.rangeRing.visible = false;
    this.rangeRing.renderOrder = 5;
    this.scene.add(this.rangeRing);
    // rally flag
    {
      const mb = new MB();
      mb.cyl(0.04, 0.04, 1.3, 0x6e4322, [0, 0.65, 0]);
      mb.box(0.55, 0.38, 0.03, 0x3d6fb5, [0.29, 1.1, 0], [0, 0, 0], 0.01);
      mb.sphere(0.07, 0xffc93c, [0, 1.32, 0]);
      this.rallyFlag = new THREE.Group();
      this.rallyFlag.add(withOutline(new THREE.Mesh(mb.build(), toonMat())));
      this.rallyFlag.visible = false;
      this.scene.add(this.rallyFlag);
    }
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.9, depthWrite: false }));
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.visible = false;
    this.scene.add(this.selRing);
    this.targetMarker = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.1, 40), new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0.8, depthWrite: false }));
    this.targetMarker.rotation.x = -Math.PI / 2;
    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker);

    {
      const mb = new MB();
      mb.ico(1, 0xbfefff, [0, 0.7, 0], 0, [1, 0.9, 1]);
      this.iceGeo = mb.build();
    }

    this.setupInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // ───────────────────────── stage ─────────────────────────
  setStage(game: Game) {
    this.clearStage();
    this.game = game;
    this.region = game.stage.region;
    const pal = PALETTES[this.region];
    this.skyUniforms.top.value.set(pal.skyTop);
    this.skyUniforms.horizon.value.set(pal.skyHorizon);
    this.skyUniforms.bottom.value.set(pal.skyBottom);
    this.scene.fog = new THREE.Fog(pal.fog, 110, 260);
    this.sun.color.set(pal.sun);
    this.hemi.color.set(pal.ambient);
    this.hemi.groundColor.set(pal.hemiGround);
    this.env = buildEnvironment(this.region, game.paths, game.spots, game.stage.id + 1);
    this.stage = this.env.group;
    this.stage.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.outline) { (o as THREE.Mesh).receiveShadow = true; } });
    this.scene.add(this.stage);
    this.target.set(0, 1);
    this.resize();
    this.dist = this.fitDist;
  }

  clearStage() {
    if (this.stage) {
      this.scene.remove(this.stage);
      this.stage.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !o.userData.outline && m.geometry && !(m as any).__shared) {
          // decoration geometries are per-stage; rigs and towers are cached elsewhere
          if (!(m.geometry as any).__cached) m.geometry.dispose();
        }
      });
    }
    for (const v of this.enemyViews.values()) this.scene.remove(v.rig.root);
    for (const v of this.unitViews.values()) this.scene.remove(v.rig.root);
    for (const v of this.towerViews.values()) this.scene.remove(v.group);
    for (const v of this.projViews.values()) this.scene.remove(v.obj);
    for (const v of this.zoneViews.values()) this.scene.remove(v);
    for (const f of this.fx) this.scene.remove(f.obj);
    this.enemyViews.clear(); this.unitViews.clear(); this.towerViews.clear(); this.projViews.clear(); this.zoneViews.clear();
    this.fx = [];
    this.pNormal.clear(); this.pAdd.clear();
    this.stage = null; this.env = null; this.game = null;
    this.rangeRing.visible = false; this.rallyFlag.visible = false; this.selRing.visible = false; this.targetMarker.visible = false;
  }

  // ───────────────────────── camera ─────────────────────────
  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    outlineUniforms.uResolution.value.set(w, h);
    outlineUniforms.uOutline.value = Math.max(1.2, Math.min(2.4, h / 420));
    this.pNormal.uniforms.uScale.value = this.pAdd.uniforms.uScale.value = h * 1.1;
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const wantW = 72, wantH = 48;
    const dW = wantW / (2 * t * this.camera.aspect), dH = wantH / (2 * t) * 0.78;
    const prevFit = this.fitDist;
    this.fitDist = Math.min(110, Math.max(32, Math.max(dW, dH)));
    this.dist = Math.min(this.maxDist(), Math.max(this.minDist(), this.dist * (this.fitDist / prevFit)));
  }
  minDist() { return Math.max(22, this.fitDist * 0.42); }
  maxDist() { return this.fitDist * 1.08; }

  private updateCamera() {
    const lim = 1 - (this.dist - this.minDist()) / Math.max(1, this.maxDist() - this.minDist());
    const lx = 6 + 26 * lim, ly = 4 + 16 * lim;
    this.target.x = Math.max(-lx, Math.min(lx, this.target.x));
    this.target.y = Math.max(-ly + 1, Math.min(ly + 1, this.target.y));
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(this.target.x + sx, Math.sin(this.pitch) * this.dist, this.target.y + Math.cos(this.pitch) * this.dist + sy);
    this.camera.lookAt(this.target.x + sx, 0, this.target.y + sy);
    if (this.menuMode) {
      const a = this.time * 0.05;
      const d = this.fitDist * 0.9;
      this.camera.position.set(Math.sin(a) * d * 0.5, Math.sin(0.75) * d, Math.cos(a) * d * 0.75);
      this.camera.lookAt(0, -2, 0);
    }
  }

  groundAt(sx: number, sy: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    const hit = ray.ray.intersectPlane(new THREE.Plane(UP, 0), p);
    return hit ? p : null;
  }

  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    tmpV.set(x, y, z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (tmpV.x * 0.5 + 0.5) * rect.width, y: rect.top + (-tmpV.y * 0.5 + 0.5) * rect.height, visible: tmpV.z < 1 };
  }

  pick(sx: number, sy: number): Pick {
    const p = this.groundAt(sx, sy);
    const g = this.game;
    if (!p || !g) return { kind: 'none', id: -1, x: 0, y: 0, sx, sy, inside: false };
    const x = p.x, y = p.z;
    const inside = Math.abs(x) < 34 && Math.abs(y) < 21;
    const base = { x, y, sx, sy, inside };
    const h = g.hero;
    if (h && !h.dead && Math.hypot(h.x - x, h.y - y) < 1.3) return { kind: 'hero', id: h.id, ...base };
    for (const t of g.towers) if (Math.hypot(t.x - x, t.y - y) < 1.6) return { kind: 'tower', id: t.id, ...base };
    // screen-space test for tall towers
    for (const t of g.towers) {
      const tv = this.towerViews.get(t.id);
      const top = this.project(t.x, (tv?.top ?? 2) * 0.6, t.y);
      if (Math.hypot(top.x - sx, top.y - sy) < 40) return { kind: 'tower', id: t.id, ...base };
    }
    for (const s of g.spots) if (!g.towers.some((t) => t.spot === s.id) && Math.hypot(s.x - x, s.y - y) < 1.5) return { kind: 'spot', id: s.id, ...base };
    let best: Enemy | null = null, bd = 1.2;
    for (const e of g.enemies) {
      const d = Math.hypot(e.x - x, e.y - y) - e.def.size;
      if (d < bd) { bd = d; best = e; }
      if (e.def.flying) {
        const sp = this.project(e.x, 2.2, e.y);
        if (Math.hypot(sp.x - sx, sp.y - sy) < 30) { best = e; bd = -1; }
      }
    }
    if (best) return { kind: 'enemy', id: best.id, ...base };
    return { kind: 'ground', id: -1, ...base };
  }

  private setupInput() {
    const el = this.renderer.domElement;
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
    let dragging = false;
    let pinchStart = 0, pinchDist = 0;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y); pinchDist = this.dist;
        dragging = true;
      }
    });
    el.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') this.onHover(this.pick(e.clientX, e.clientY));
        return;
      }
      if (pointers.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart > 0) this.dist = Math.max(this.minDist(), Math.min(this.maxDist(), pinchDist * (pinchStart / d)));
        return;
      }
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (!dragging && moved > 8) dragging = true;
      if (dragging && !this.menuMode) {
        const a = this.groundAt(p.x, p.y), b = this.groundAt(e.clientX, e.clientY);
        if (a && b) { this.target.x -= b.x - a.x; this.target.y -= b.z - a.z; }
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (!p) return;
      if (!dragging && performance.now() - p.t < 600 && !this.menuMode) this.onTap(this.pick(e.clientX, e.clientY));
      if (pointers.size === 0) dragging = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); if (pointers.size === 0) dragging = false; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = Math.max(this.minDist(), Math.min(this.maxDist(), this.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: false });
  }

  // ───────────────────────── UI helpers ─────────────────────────
  showRange(x: number, y: number, r: number, color = 0xffffff) {
    this.rangeRing.visible = true;
    this.rangeRing.position.set(x, 0.12, y);
    this.rangeRing.scale.setScalar(r);
    this.rangeRing.children.forEach((c) => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color));
  }
  hideRange() { this.rangeRing.visible = false; }
  showRally(x: number, y: number) { this.rallyFlag.visible = true; this.rallyFlag.position.set(x, 0, y); }
  hideRally() { this.rallyFlag.visible = false; }
  showTargetMarker(x: number | null, y = 0, r = 2, color = 0xff7a3a) {
    if (x == null) { this.targetMarker.visible = false; return; }
    this.targetMarker.visible = true;
    this.targetMarker.position.set(x, 0.15, y);
    this.targetMarker.scale.setScalar(r / 2);
    (this.targetMarker.material as THREE.MeshBasicMaterial).color.set(color);
  }
  focus(x: number, y: number) { this.target.set(x, y); }
  shakeCamera(v: number) { this.shake = Math.max(this.shake, v); }

  // ───────────────────────── per-frame ─────────────────────────
  frame(dt: number, events: GEvent[]) {
    this.time += dt;
    const g = this.game;
    if (g) {
      for (const ev of events) this.handleEvent(ev);
      this.syncEnemies(dt, g);
      this.syncUnits(dt, g);
      this.syncTowers(dt, g);
      this.syncProjectiles(g);
      this.syncZones(g);
      this.updateHpBars(g);
      this.ambient(dt);
    }
    if (this.env) {
      for (const a of this.env.animated) {
        if (a.kind === 'cloud') { a.obj.position.x = a.base + Math.sin(this.time * 0.03 * a.speed) * 8; }
        else if (a.kind === 'bob') { a.obj.position.y = a.base + Math.sin(this.time * a.speed) * 0.6; }
        else if (a.kind === 'portal') { a.obj.rotation.z += dt * 1.5; }
      }
      if (this.env.castleFlag) this.env.castleFlag.rotation.y = Math.sin(this.time * 2) * 0.15;
    }
    // fx
    for (const f of this.fx) { f.t += dt; f.update(f, Math.min(1, f.t / f.dur)); }
    const dead = this.fx.filter((f) => f.t >= f.dur);
    if (dead.length) {
      for (const f of dead) { this.scene.remove(f.obj); if (f.dispose) (f.obj as THREE.Mesh).geometry?.dispose(); }
      this.fx = this.fx.filter((f) => f.t < f.dur);
    }
    this.pNormal.update(dt);
    this.pAdd.update(dt);
    if (this.selRing.visible) this.selRing.rotation.z += dt;
    if (this.targetMarker.visible) this.targetMarker.rotation.z -= dt * 1.5;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.sun.castShadow = this.quality.shadows;
    this.updateCamera();
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  // ───────────────────────── enemies ─────────────────────────
  private syncEnemies(dt: number, g: Game) {
    const alive = new Set<number>();
    for (const e of g.enemies) {
      alive.add(e.id);
      let v = this.enemyViews.get(e.id);
      if (!v) {
        const rig = createRig(e.def.model);
        rig.root.position.set(e.x, 0, e.y);
        this.scene.add(rig.root);
        v = { rig, dying: -1, lastX: e.x, lastY: e.y, scalePulse: 0, size: e.def.size, flying: !!e.def.flying };
        this.enemyViews.set(e.id, v);
        rig.root.scale.setScalar(0.01);
      }
      const moved = Math.hypot(e.x - v.lastX, e.y - v.lastY) / Math.max(dt, 1e-3);
      v.lastX = e.x; v.lastY = e.y;
      const r = v.rig;
      r.root.position.set(e.x, 0, e.y);
      r.root.rotation.y = Math.PI / 2 - e.dir;
      const frozen = e.freezeT > 0 || e.stunT > 0;
      const grow = Math.min(1, e.age * 4);
      if (e.hitFlash > 0) v.scalePulse = 0.12;
      v.scalePulse = Math.max(0, v.scalePulse - dt);
      r.root.scale.setScalar(ENT * grow * (1 + v.scalePulse * 0.8));
      if (!frozen) animateRig(r, dt * (e.slowF < 1 ? 0.5 : 1), Math.min(1, moved / 1.5), e.attackAnim, this.time, v.flying);
      // status fx
      if (e.freezeT > 0) {
        if (!v.ice) {
          v.ice = new THREE.Mesh(this.iceGeo, toonMat({ transparent: true, opacity: 0.6 }));
          v.ice.scale.setScalar(e.def.size * 1.3);
          r.root.add(v.ice);
        }
        v.ice.visible = true;
        v.ice.position.y = v.flying ? (r.def.float ?? 2) - 0.6 : 0;
      } else if (v.ice) v.ice.visible = false;
      const hy = v.flying ? (r.def.float ?? 2) : r.def.height * 0.6;
      if (e.burnT > 0 && Math.random() < dt * 25) this.pAdd.emit(e.x + rnd(0.3), hy, e.y + rnd(0.3), rnd(0.3), 1.5, rnd(0.3), 0.5, 0.35, 0.05, Math.random() < 0.5 ? PCOL.fire1 : PCOL.fire2);
      if (e.poisonT > 0 && Math.random() < dt * 10) this.pAdd.emit(e.x + rnd(0.3), hy, e.y + rnd(0.3), 0, 0.8, 0, 0.7, 0.25, 0.1, PCOL.poison, 0.8);
      if (e.slowF < 1 && e.slowT > 0 && Math.random() < dt * 8) this.pAdd.emit(e.x + rnd(0.4), 0.3 + Math.random() * hy, e.y + rnd(0.4), 0, 0.3, 0, 0.6, 0.2, 0.05, PCOL.ice, 0.9);
      if (e.stunT > 0 && Math.random() < dt * 12) {
        const a = this.time * 6;
        this.pAdd.emit(e.x + Math.cos(a) * 0.4, r.def.height + 0.2, e.y + Math.sin(a) * 0.4, 0, 0, 0, 0.3, 0.3, 0.1, PCOL.gold);
      }
      if (e.def.boss && Math.random() < dt * 6) this.pNormal.emit(e.x + rnd(1), 0.1, e.y + rnd(1), rnd(0.5), 0.5, rnd(0.5), 0.8, 0.8, 1.4, PCOL.dust, 0.5);
    }
    for (const [id, v] of this.enemyViews) {
      if (alive.has(id)) continue;
      if (v.dying < 0) v.dying = 0;
      v.dying += dt;
      const k = v.dying / 0.35;
      v.rig.root.scale.setScalar(ENT * Math.max(0.01, 1 - k) * (1 + k * 0.3));
      v.rig.root.position.y = (v.flying ? -k * 1.5 : 0);
      if (k >= 1) { this.scene.remove(v.rig.root); this.enemyViews.delete(id); }
    }
  }

  // ───────────────────────── units ─────────────────────────
  private syncUnits(dt: number, g: Game) {
    const alive = new Set<number>();
    for (const u of g.units) {
      alive.add(u.id);
      let v = this.unitViews.get(u.id);
      if (!v) {
        const rig = createRig(u.model);
        this.scene.add(rig.root);
        v = { rig, dying: -1, lastX: u.x, lastY: u.y, wasDead: false, appear: 0 };
        if (u.kind === 'hero') {
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.98, 32), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.7, depthWrite: false }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.08;
          rig.root.add(ring);
          v.ring = ring;
        }
        this.unitViews.set(u.id, v);
      }
      if (v.rig.id !== u.model) {
        // soldier upgraded
        this.scene.remove(v.rig.root);
        const rig = createRig(u.model);
        this.scene.add(rig.root);
        v.rig = rig;
        this.burst('dust', u.x, 0.3, u.y, 10);
      }
      const r = v.rig;
      if (u.dead) {
        if (!v.wasDead) { v.wasDead = true; v.dying = 0; }
        v.dying += dt;
        const k = Math.min(1, v.dying / 0.4);
        r.root.rotation.z = k * 1.4;
        r.root.scale.setScalar(ENT * Math.max(0.01, 1 - k * 0.9));
        if (k >= 1) r.root.visible = false;
        continue;
      }
      if (v.wasDead) { v.wasDead = false; v.appear = 0; r.root.visible = true; r.root.rotation.z = 0; this.burst('pop', u.x, 0.5, u.y, 10); }
      const moved = Math.hypot(u.x - v.lastX, u.y - v.lastY) / Math.max(dt, 1e-3);
      v.lastX = u.x; v.lastY = u.y;
      r.root.position.set(u.x, 0, u.y);
      let tr = Math.PI / 2 - u.dir;
      let da = tr - r.root.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      r.root.rotation.y += da * Math.min(1, dt * 12);
      void tr;
      const life = u.lifeT > 0 && u.lifeT < 1 ? u.lifeT : 1;
      v.appear = Math.min(1, v.appear + dt * 4);
      r.root.scale.setScalar(ENT * Math.max(0.01, v.appear) * life);
      if (u.stunT <= 0) animateRig(r, dt, Math.min(1, moved / 1.5), u.attackAnim, this.time);
      if (v.ring) {
        v.ring.visible = true;
        (v.ring.material as THREE.MeshBasicMaterial).opacity = this.heroSelected ? 0.95 : 0.45;
        v.ring.scale.setScalar(this.heroSelected ? 1.15 + Math.sin(this.time * 6) * 0.08 : 1);
      }
      if (u.buffT > 0 && Math.random() < dt * 10) this.pAdd.emit(u.x + rnd(0.3), 0.3, u.y + rnd(0.3), 0, 1.2, 0, 0.6, 0.25, 0.05, PCOL.fire1);
      if (u.invulnT > 0 && Math.random() < dt * 14) this.pAdd.emit(u.x + rnd(0.6), Math.random() * 1.6, u.y + rnd(0.6), 0, 0.5, 0, 0.5, 0.3, 0.05, PCOL.blue);
      if (u.stunT > 0 && Math.random() < dt * 10) this.pAdd.emit(u.x + rnd(0.3), r.def.height + 0.1, u.y + rnd(0.3), 0, 0.2, 0, 0.4, 0.25, 0.1, PCOL.gold);
    }
    for (const [id, v] of this.unitViews) {
      if (alive.has(id)) continue;
      this.scene.remove(v.rig.root);
      this.unitViews.delete(id);
    }
  }

  // ───────────────────────── towers ─────────────────────────
  private towerRig(model: string, tier: number): TowerRig {
    const key = model + ':' + tier;
    let r = this.towerRigCache.get(key);
    if (!r) { r = TOWER_MODELS[model](tier); this.towerRigCache.set(key, r); }
    return r;
  }

  buildTowerGroup(model: string, tier: number): { group: THREE.Group; turret?: THREE.Object3D; orb?: THREE.Object3D; crew: Rig[]; top: number } {
    const tr = this.towerRig(model, tier);
    const group = new THREE.Group();
    const body = withOutline(new THREE.Mesh(tr.body, toonMat()));
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    let turret: THREE.Object3D | undefined, orb: THREE.Object3D | undefined;
    if (tr.turret) {
      turret = new THREE.Group();
      turret.position.set(...tr.turret.pivot);
      const m = withOutline(new THREE.Mesh(tr.turret.geo, toonMat()));
      m.castShadow = true;
      turret.add(m);
      group.add(turret);
    }
    if (tr.orb) {
      orb = new THREE.Group();
      orb.position.set(...tr.orb.pivot);
      const m = new THREE.Mesh(tr.orb.geo, tr.orb.glow ? glowMat() : toonMat({ emissive: 0x3a2a5a, emissiveIntensity: 0.6 }));
      if (!tr.orb.glow) withOutline(m);
      m.castShadow = true;
      orb.add(m);
      group.add(orb);
    }
    const crew: Rig[] = [];
    for (const c of tr.crew) {
      const rig = createRig(c.model);
      if (c.turret && turret) {
        rig.root.position.set(c.pos[0] - turret.position.x, c.pos[1] - turret.position.y, c.pos[2] - turret.position.z);
        turret.add(rig.root);
      } else {
        rig.root.position.set(...c.pos);
        group.add(rig.root);
      }
      crew.push(rig);
    }
    return { group, turret, orb, crew, top: tr.top };
  }

  private syncTowers(dt: number, g: Game) {
    const alive = new Set<number>();
    for (const t of g.towers) {
      alive.add(t.id);
      let v = this.towerViews.get(t.id);
      if (!v || v.defId !== t.def.id) {
        if (v) this.scene.remove(v.group);
        const b = this.buildTowerGroup(t.def.model, t.def.tier);
        b.group.position.set(t.x, 0, t.y);
        this.scene.add(b.group);
        v = { group: b.group, defId: t.def.id, turret: b.turret, orb: b.orb, crew: b.crew, built: 0, top: b.top };
        this.towerViews.set(t.id, v);
      }
      v.built += dt;
      const k = Math.min(1, v.built / 0.45);
      const bounce = k < 1 ? Math.sin(k * Math.PI * 0.5) * (1 + Math.sin(k * Math.PI) * 0.25) : 1;
      v.group.scale.set(TWR, TWR * Math.max(0.05, bounce), TWR);
      const aimY = Math.PI / 2 - t.aim;
      if (v.turret) {
        let da = aimY - v.turret.rotation.y;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        v.turret.rotation.y += da * Math.min(1, dt * 10);
        const recoil = t.fireAnim > 0 ? Math.sin((t.fireAnim / 0.25) * Math.PI) * 0.12 : 0;
        v.turret.position.z = this.towerRig(t.def.model, t.def.tier).turret!.pivot[2] - Math.cos(v.turret.rotation.y) * recoil;
        v.turret.position.x = this.towerRig(t.def.model, t.def.tier).turret!.pivot[0] - Math.sin(v.turret.rotation.y) * recoil;
      }
      if (v.orb) {
        v.orb.rotation.y += dt * (t.def.id === 'arcane' ? 1.2 : 0.8);
        v.orb.position.y = this.towerRig(t.def.model, t.def.tier).orb!.pivot[1] + Math.sin(this.time * 2 + t.id) * 0.12;
        const pulse = 1 + (t.fireAnim > 0 ? t.fireAnim * 1.2 : 0);
        v.orb.scale.setScalar(pulse);
        if (Math.random() < dt * 4) {
          const c = t.def.id === 'frost' ? PCOL.ice : t.def.id === 'tesla' ? PCOL.blue : PCOL.magic;
          const p = v.orb.position;
          this.pAdd.emit(t.x + rnd(0.5), p.y + rnd(0.3), t.y + rnd(0.5), 0, 0.4, 0, 1, 0.25, 0.05, c, 0.9);
        }
      }
      for (const c of v.crew) {
        if (!(c.root.parent === v.turret)) {
          let da = aimY - c.root.rotation.y;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          c.root.rotation.y += da * Math.min(1, dt * 8);
        }
        animateRig(c, dt, 0, t.fireAnim, this.time);
      }
      if (t.frozenT > 0) {
        if (!v.ice) {
          v.ice = new THREE.Mesh(this.iceGeo, toonMat({ transparent: true, opacity: 0.55 }));
          v.ice.scale.set(1.6, 2.2, 1.6);
          v.group.add(v.ice);
        }
        v.ice.visible = true;
      } else if (v.ice) v.ice.visible = false;
    }
    for (const [id, v] of this.towerViews) {
      if (alive.has(id)) continue;
      this.scene.remove(v.group);
      this.towerViews.delete(id);
    }
    // spots visibility
    if (this.env) {
      const used = new Set(g.towers.map((t) => t.spot));
      for (const m of this.env.spotMeshes) m.visible = !used.has(m.userData.spot);
    }
  }

  towerTop(id: number): number { return (this.towerViews.get(id)?.top ?? 2) * TWR; }

  // ───────────────────────── projectiles ─────────────────────────
  private projGeometry(kind: string): THREE.BufferGeometry {
    let g = this.projGeo.get(kind);
    if (g) return g;
    const mb = new MB();
    switch (kind) {
      case 'arrow':
        mb.cyl(0.03, 0.03, 0.8, 0x8a5a2b, [0, 0, 0], [Math.PI / 2, 0, 0], 5);
        mb.cone(0.07, 0.18, 0xd8dde3, [0, 0, 0.45], [Math.PI / 2, 0, 0], 5);
        mb.box(0.16, 0.02, 0.18, 0xffffff, [0, 0, -0.35]);
        break;
      case 'bullet': mb.sphere(0.12, 0xffd24a, [0, 0, 0], [0.8, 0.8, 1.3], 6); break;
      case 'egg': egg(mb, 0.24, [0, 0, 0], [0xfff6e6, 0xffd24a, 0xff6fae]); break;
      case 'bigegg': egg(mb, 0.45, [0, 0, 0], [0xfff6e6, 0xff6fae, 0xffd24a, 0x6fd6ff]); break;
      case 'minibomb': egg(mb, 0.14, [0, 0, 0], [0xfff6e6, 0xffd24a]); break;
      case 'bomb': case 'megabomb':
        mb.sphere(kind === 'megabomb' ? 0.42 : 0.22, 0x2f2a3a, [0, 0, 0]);
        mb.cyl(0.05, 0.05, 0.12, 0x8a6a3a, [0, kind === 'megabomb' ? 0.45 : 0.25, 0]);
        break;
      case 'meteor': egg(mb, 0.6, [0, 0, 0], [0xffb02a, 0xff6a1a, 0xffe04a]); break;
      case 'missile':
        mb.cyl(0.12, 0.12, 0.7, 0xd9473a, [0, 0, 0], [Math.PI / 2, 0, 0], 8);
        mb.cone(0.12, 0.25, 0xfff6e6, [0, 0, 0.47], [Math.PI / 2, 0, 0], 8);
        mb.box(0.4, 0.03, 0.15, 0xffc93c, [0, 0, -0.3]);
        mb.box(0.03, 0.4, 0.15, 0xffc93c, [0, 0, -0.3]);
        break;
      case 'axe':
        mb.cyl(0.03, 0.03, 0.5, 0x7a4a22, [0, 0, 0]);
        mb.box(0.05, 0.22, 0.2, 0xc8ced6, [0, 0.2, 0.1], [0, 0, 0], 0.02);
        break;
      case 'icicle': case 'ice':
        mb.cone(0.12, 0.6, 0xbfefff, [0, 0, 0], [Math.PI / 2, 0, 0], 5);
        break;
      case 'star': case 'starbolt':
        mb.cone(0.25, 0.25, 0xffe66b, [0, 0, 0], [0, 0, 0], 5);
        mb.cone(0.25, 0.25, 0xffe66b, [0, 0, 0], [Math.PI, 0, 0], 5);
        break;
      default: // bolt, arcane, spit, darkbolt
        mb.sphere(kind === 'arcane' ? 0.32 : 0.2, kind === 'spit' ? 0x9aff5a : kind === 'darkbolt' ? 0x8a3aff : kind === 'arcane' ? 0xffb0ff : 0xe0b0ff, [0, 0, 0], [1, 1, 1], 10);
    }
    g = mb.build();
    this.projGeo.set(kind, g);
    return g;
  }

  private syncProjectiles(g: Game) {
    const alive = new Set<number>();
    for (const p of g.projectiles) {
      alive.add(p.id);
      let v = this.projViews.get(p.id);
      if (!v) {
        const glow = ['bolt', 'arcane', 'spit', 'darkbolt', 'star', 'starbolt', 'meteor'].includes(p.kind);
        const m = new THREE.Mesh(this.projGeometry(p.kind), glow ? glowMat() : toonMat());
        if (!glow && p.kind !== 'bullet') withOutline(m);
        m.castShadow = p.kind === 'egg' || p.kind === 'bigegg' || p.kind === 'meteor';
        this.scene.add(m);
        v = { obj: m, kind: p.kind };
        this.projViews.set(p.id, v);
      }
      const o = v.obj;
      o.position.set(p.x, p.z, p.y);
      tmpV.set(p.x - p.prevX, p.z - p.prevZ, p.y - p.prevY);
      if (tmpV.lengthSq() > 1e-8) {
        if (p.kind === 'egg' || p.kind === 'bigegg' || p.kind === 'minibomb' || p.kind === 'bomb' || p.kind === 'megabomb') {
          o.rotation.x += 0.2; o.rotation.z += 0.13;
        } else if (p.kind === 'axe') {
          o.rotation.x += 0.5;
        } else if (p.kind === 'star' || p.kind === 'starbolt') {
          o.rotation.y += 0.3;
        } else {
          tmpV.normalize();
          tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmpV);
          o.quaternion.copy(tmpQ);
        }
      }
      this.trail(p);
    }
    for (const [id, v] of this.projViews) {
      if (alive.has(id)) continue;
      this.scene.remove(v.obj);
      this.projViews.delete(id);
    }
  }

  private trail(p: Projectile) {
    const r = Math.random();
    switch (p.kind) {
      case 'bolt': case 'starbolt': this.pAdd.emit(p.x, p.z, p.y, rnd(0.2), rnd(0.2), rnd(0.2), 0.35, 0.45, 0.05, r < 0.5 ? PCOL.magic : PCOL.magic2); break;
      case 'arcane': this.pAdd.emit(p.x, p.z, p.y, rnd(0.3), rnd(0.3), rnd(0.3), 0.45, 0.6, 0.05, r < 0.5 ? PCOL.white : PCOL.magic2); break;
      case 'ice': case 'icicle': this.pAdd.emit(p.x, p.z, p.y, rnd(0.2), rnd(0.2), rnd(0.2), 0.35, 0.35, 0.05, PCOL.ice); break;
      case 'meteor':
        this.pAdd.emit(p.x + rnd(0.3), p.z, p.y + rnd(0.3), rnd(1), rnd(1), rnd(1), 0.5, 1.4, 0.2, r < 0.4 ? PCOL.fire1 : PCOL.fire2);
        this.pNormal.emit(p.x, p.z, p.y, rnd(0.5), 0.5, rnd(0.5), 1.0, 0.8, 1.8, PCOL.smokeD, 0.5);
        break;
      case 'missile':
        this.pNormal.emit(p.x, p.z, p.y, rnd(0.2), 0.3, rnd(0.2), 0.7, 0.4, 1.0, PCOL.smoke, 0.6);
        this.pAdd.emit(p.x, p.z, p.y, 0, 0, 0, 0.15, 0.5, 0.1, PCOL.fire1);
        break;
      case 'star': this.pAdd.emit(p.x, p.z, p.y, rnd(0.3), rnd(0.3), rnd(0.3), 0.4, 0.5, 0.05, PCOL.gold); break;
      case 'bomb': case 'megabomb': if (r < 0.5) this.pAdd.emit(p.x, p.z + 0.3, p.y, 0, 0.5, 0, 0.2, 0.2, 0.05, PCOL.spark); break;
      case 'darkbolt': this.pAdd.emit(p.x, p.z, p.y, rnd(0.2), rnd(0.2), rnd(0.2), 0.35, 0.4, 0.05, PCOL.dark); break;
      case 'spit': this.pAdd.emit(p.x, p.z, p.y, 0, -0.5, 0, 0.3, 0.25, 0.05, PCOL.poison); break;
    }
  }

  private syncZones(g: Game) {
    const alive = new Set<number>();
    for (const z of g.zones) {
      alive.add(z.id);
      let o = this.zoneViews.get(z.id);
      if (!o) {
        const mb = new MB();
        if (z.kind === 'mine') {
          mb.cyl(0.3, 0.35, 0.15, 0x3a3a3a, [0, 0.08, 0], [0, 0, 0], 10);
          mb.sphere(0.08, 0xff3a3a, [0, 0.2, 0]);
        } else {
          mb.cyl(z.r, z.r, 0.04, 0xff6a1a, [0, 0.06, 0], [0, 0, 0], 20);
        }
        o = new THREE.Mesh(mb.build(), z.kind === 'mine' ? toonMat() : glowMat());
        o.position.set(z.x, 0, z.y);
        this.scene.add(o);
        this.zoneViews.set(z.id, o);
      }
      if (z.kind === 'fire' && Math.random() < 0.5) this.pAdd.emit(z.x + rnd(z.r), 0.2, z.y + rnd(z.r), 0, 1.5, 0, 0.6, 0.5, 0.05, Math.random() < 0.5 ? PCOL.fire1 : PCOL.fire2);
      if (z.kind === 'fire') ((o as THREE.Mesh).scale.setScalar(Math.min(1, z.t)));
    }
    for (const [id, o] of this.zoneViews) {
      if (alive.has(id)) continue;
      this.scene.remove(o);
      (o as THREE.Mesh).geometry.dispose();
      this.zoneViews.delete(id);
    }
  }

  // ───────────────────────── health bars ─────────────────────────
  private updateHpBars(g: Game) {
    const q = this.camera.quaternion;
    const right = tmpV2.set(1, 0, 0).applyQuaternion(q);
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    let i = 0;
    const put = (x: number, y: number, z: number, w: number, frac: number) => {
      if (i >= 600) return;
      p.set(x, y, z);
      m.compose(p, q, s.set(w + 0.08, 1, 1));
      this.hpBg.setMatrixAt(i, m);
      p.addScaledVector(right, -w / 2);
      p.y += 0.002;
      m.compose(p, q, s.set(Math.max(0.001, w * frac), 1, 1));
      this.hpFg.setMatrixAt(i, m);
      col.set(frac > 0.5 ? 0x5ad13a : frac > 0.25 ? 0xffc21a : 0xff3a2a);
      this.hpFg.setColorAt(i, col);
      i++;
    };
    for (const e of g.enemies) {
      const v = this.enemyViews.get(e.id);
      if (!v) continue;
      const h = ENT * (v.flying ? (v.rig.def.float ?? 2) + 0.9 : v.rig.def.height + 0.25);
      put(e.x, h, e.y, e.def.boss ? 2.6 : Math.max(0.8, e.def.size * 1.6), Math.max(0, e.hp / e.maxHp));
    }
    for (const u of g.units) {
      if (u.dead || (u.hp >= u.maxHp && u.kind !== 'hero')) continue;
      const v = this.unitViews.get(u.id);
      if (!v) continue;
      put(u.x, ENT * v.rig.def.height + 0.15, u.y, u.kind === 'hero' ? 1.2 : 0.7, u.hp / u.maxHp);
    }
    this.hpBg.count = i;
    this.hpFg.count = i;
    this.hpBg.instanceMatrix.needsUpdate = true;
    this.hpFg.instanceMatrix.needsUpdate = true;
    if (this.hpFg.instanceColor) this.hpFg.instanceColor.needsUpdate = true;
  }

  // ───────────────────────── effects ─────────────────────────
  private ambient(dt: number) {
    const n = dt * 30;
    for (let k = 0; k < n; k++) {
      if (Math.random() > 0.5) continue;
      const x = rnd(40), z = rnd(26);
      if (this.region === 2) this.pNormal.emit(x, 14, z, rnd(0.5) + 0.6, -1.6, rnd(0.5), 9, 0.35, 0.35, PCOL.snow, 0.9);
      else if (this.region === 3) this.pAdd.emit(x, 0.2, z, rnd(0.3), 1.2 + Math.random(), rnd(0.3), 4, 0.35, 0.05, PCOL.ember, 0.8);
      else if (this.region === 1 && Math.random() < 0.3) this.pAdd.emit(x, 0.5 + Math.random() * 2, z, rnd(0.4), rnd(0.2), rnd(0.4), 3, 0.25, 0.25, PCOL.poison, 0.7);
      else if (this.region === 0 && Math.random() < 0.15) this.pNormal.emit(x, 6, z, 1.2, -0.5, rnd(0.3), 8, 0.22, 0.22, Math.random() < 0.5 ? PCOL.white : PCOL.leaf, 0.9);
    }
  }

  burst(kind: string, x: number, y: number, z: number, n: number) {
    for (let i = 0; i < n; i++) {
      switch (kind) {
        case 'dust': this.pNormal.emit(x + rnd(0.8), y, z + rnd(0.8), rnd(2), Math.random() * 1.5, rnd(2), 0.8, 0.6, 1.6, PCOL.dust, 0.7, 0, 2); break;
        case 'pop': this.pAdd.emit(x, y, z, rnd(3), Math.random() * 3, rnd(3), 0.5, 0.35, 0.05, PCOL.spark); break;
        case 'feather': this.pNormal.emit(x + rnd(0.3), y, z + rnd(0.3), rnd(2), 1 + Math.random() * 2, rnd(2), 1.4, 0.3, 0.3, PCOL.feather, 1, 1.5, 2); break;
        case 'poof': this.pNormal.emit(x + rnd(0.4), y + rnd(0.3), z + rnd(0.4), rnd(1.5), Math.random() * 1.5, rnd(1.5), 0.6, 0.6, 1.4, PCOL.smoke, 0.7, 0, 3); break;
        case 'gold': this.pAdd.emit(x, y, z, rnd(1.5), 2 + Math.random() * 2, rnd(1.5), 0.7, 0.3, 0.1, PCOL.gold, 1, 6); break;
        case 'heal': this.pAdd.emit(x + rnd(0.5), y + Math.random(), z + rnd(0.5), 0, 1.2, 0, 0.8, 0.35, 0.1, PCOL.heal); break;
        case 'magic': this.pAdd.emit(x, y, z, rnd(3), rnd(3), rnd(3), 0.6, 0.4, 0.05, Math.random() < 0.5 ? PCOL.magic : PCOL.magic2); break;
        case 'ice': this.pAdd.emit(x + rnd(0.6), y + Math.random(), z + rnd(0.6), rnd(2), Math.random() * 2, rnd(2), 0.8, 0.45, 0.05, PCOL.ice); break;
        case 'spark': this.pAdd.emit(x, y, z, rnd(4), Math.random() * 3, rnd(4), 0.3, 0.25, 0.05, PCOL.spark, 1, 4); break;
        case 'teleport': this.pAdd.emit(x + rnd(0.5), y + Math.random() * 1.5, z + rnd(0.5), rnd(0.5), 1.5, rnd(0.5), 0.7, 0.4, 0.05, Math.random() < 0.5 ? PCOL.magic : PCOL.white); break;
        case 'level': this.pAdd.emit(x + rnd(0.8), y + Math.random() * 0.5, z + rnd(0.8), 0, 3 + Math.random() * 2, 0, 1.0, 0.4, 0.05, Math.random() < 0.5 ? PCOL.gold : PCOL.white); break;
      }
    }
  }

  private explosion(x: number, z: number, r: number, kind: string) {
    const fire = kind === 'meteor' || kind === 'big' || kind === 'fire' || kind === 'egg' || kind === 'flame';
    const n = Math.round(14 + r * 10);
    if (kind === 'star') {
      for (let i = 0; i < 16; i++) this.pAdd.emit(x, 0.6, z, rnd(3), Math.random() * 3, rnd(3), 0.5, 0.45, 0.05, Math.random() < 0.5 ? PCOL.gold : PCOL.white);
      this.ring(x, z, r, 0xffe66b, 0.35);
      return;
    }
    if (kind === 'dust') {
      for (let i = 0; i < n; i++) this.pNormal.emit(x + rnd(r), 0.2, z + rnd(r), rnd(3), 1 + Math.random() * 2, rnd(3), 0.9, 0.8, 2.0, PCOL.dust, 0.75, 2, 2);
      return;
    }
    if (fire) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = Math.random() * r * 3;
        this.pAdd.emit(x, 0.4, z, Math.cos(a) * s, 1 + Math.random() * 3, Math.sin(a) * s, 0.45 + Math.random() * 0.3, 0.9 + r * 0.3, 0.1, [PCOL.fire1, PCOL.fire2, PCOL.fire3][i % 3]);
      }
      for (let i = 0; i < n * 0.6; i++) this.pNormal.emit(x + rnd(r * 0.6), 0.5, z + rnd(r * 0.6), rnd(1.2), 1 + Math.random() * 1.5, rnd(1.2), 1.2, 0.8, 2.2 + r * 0.4, PCOL.smoke, 0.6, -0.5, 1.5);
      if (kind === 'egg' || kind === 'big' || kind === 'meteor') {
        for (let i = 0; i < 8; i++) this.pNormal.emit(x, 0.4, z, rnd(4), 2 + Math.random() * 3, rnd(4), 0.8, 0.25, 0.2, i % 2 ? PCOL.shell : PCOL.yolk, 1, 9);
      }
      this.flash(x, z, r * 0.7, 0xffc04a);
      this.ring(x, z, r, 0xffa040, 0.35);
      if (kind === 'meteor' || kind === 'big') this.shake = Math.max(this.shake, kind === 'meteor' ? 0.5 : 0.3);
    } else {
      for (let i = 0; i < n; i++) this.pAdd.emit(x, 0.5, z, rnd(3), Math.random() * 3, rnd(3), 0.4, 0.5, 0.05, PCOL.magic);
    }
  }

  private flash(x: number, z: number, r: number, color: number) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, 0.4, z);
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, dur: 0.25, dispose: true, update: (f, k) => {
      f.obj.scale.setScalar(r * (0.4 + k * 1.2));
      ((f.obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    } });
  }

  private ring(x: number, z: number, r: number, color: number, dur = 0.5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.15, z);
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, dur, dispose: true, update: (f, k) => {
      f.obj.scale.setScalar(Math.max(0.01, r * (0.2 + k * 0.9)));
      ((f.obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    } });
  }

  private beam(a: THREE.Vector3, b: THREE.Vector3, w: number, color: number, dur: number) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    const d = tmpV.subVectors(b, a);
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    m.scale.set(w, d.length(), w);
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, dur, dispose: true, update: (f, k) => {
      ((f.obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k;
      f.obj.scale.x = f.obj.scale.z = w * (1 - k * 0.5);
    } });
  }

  private lightning(pts: { x: number; y: number; z: number }[], color = 0xaee8ff) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(pts[i].x, pts[i].z, pts[i].y), b = new THREE.Vector3(pts[i + 1].x, pts[i + 1].z, pts[i + 1].y);
      let prev = a.clone();
      const segs = 5;
      for (let s = 1; s <= segs; s++) {
        const p = a.clone().lerp(b, s / segs);
        if (s < segs) p.add(new THREE.Vector3(rnd(0.5), rnd(0.5), rnd(0.5)));
        this.beam(prev, p, 0.07, color, 0.18);
        this.beam(prev, p, 0.18, 0x3a7aff, 0.12);
        prev = p;
      }
      for (let k = 0; k < 6; k++) this.pAdd.emit(b.x, b.y, b.z, rnd(3), rnd(3), rnd(3), 0.25, 0.3, 0.05, PCOL.blue);
    }
  }

  private handleEvent(ev: GEvent) {
    switch (ev.type) {
      case 'explode': this.explosion(ev.x, ev.y, ev.r, ev.kind); break;
      case 'death': {
        const e = ev.e;
        const y = e.def.flying ? 2 : 0.5;
        this.burst('poof', e.x, y, e.y, e.def.boss ? 40 : 10);
        this.burst('spark', e.x, y, e.y, 6);
        if (e.def.boss) { this.shake = 0.6; this.explosion(e.x, e.y, 3, 'big'); }
        break;
      }
      case 'gold': this.burst('gold', ev.x, 1, ev.y, 4); break;
      case 'lightning': this.lightning(ev.pts); break;
      case 'hit':
        if (ev.kind === 'headshot') { this.burst('spark', ev.x, 1, ev.y, 14); this.ring(ev.x, ev.y, 1, 0xff3a3a, 0.3); }
        else if (ev.kind === 'bolt' || ev.kind === 'arcane' || ev.kind === 'starbolt') this.burst('magic', ev.x, ev.z, ev.y, ev.kind === 'arcane' ? 14 : 8);
        else if (ev.kind === 'ice' || ev.kind === 'icicle') this.burst('ice', ev.x, ev.z - 0.3, ev.y, 8);
        else if (ev.kind === 'miss') this.burst('dust', ev.x, 0.4, ev.y, 2);
        else this.burst('spark', ev.x, ev.z, ev.y, 3);
        break;
      case 'heal': this.burst('heal', ev.x, 0.4, ev.y, 6); break;
      case 'freezeArea':
        this.ring(ev.x, ev.y, ev.r, 0xbfefff, 0.5);
        for (let i = 0; i < 30; i++) this.pAdd.emit(ev.x + rnd(ev.r), 0.3, ev.y + rnd(ev.r), 0, 1 + Math.random() * 2, 0, 0.9, 0.5, 0.05, PCOL.ice);
        break;
      case 'ray': {
        const top = 4.5;
        this.beam(new THREE.Vector3(ev.x, top, ev.y), new THREE.Vector3(ev.tx, 0.6, ev.ty), 0.35, 0xffb0ff, 0.5);
        this.beam(new THREE.Vector3(ev.x, top, ev.y), new THREE.Vector3(ev.tx, 0.6, ev.ty), 0.12, 0xffffff, 0.5);
        this.burst('magic', ev.tx, 0.6, ev.ty, 30);
        this.ring(ev.tx, ev.ty, 1.5, 0xff80ff, 0.4);
        break;
      }
      case 'teleport': this.burst('teleport', ev.x, 0.2, ev.y, 14); break;
      case 'spawn': this.burst('poof', ev.e.x, 0.6, ev.e.y, 4); break;
      case 'unitDeath': this.burst('feather', ev.u.x, 0.7, ev.u.y, 12); this.burst('poof', ev.u.x, 0.4, ev.u.y, 5); break;
      case 'levelUp': this.burst('level', ev.u.x, 0.2, ev.u.y, 40); this.ring(ev.u.x, ev.u.y, 2, 0xffd84a, 0.6); break;
      case 'whirl':
        this.ring(ev.x, ev.y, 1.8, 0xffffff, 0.3);
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; this.pAdd.emit(ev.x + Math.cos(a) * 1.2, 0.6, ev.y + Math.sin(a) * 1.2, -Math.sin(a) * 4, 0, Math.cos(a) * 4, 0.25, 0.3, 0.05, PCOL.white); }
        break;
      case 'shockwave': this.ring(ev.x, ev.y, ev.r, ev.color, 0.5); break;
      case 'build': this.burst('dust', ev.tower.x, 0.3, ev.tower.y, 18); break;
      case 'sell': this.burst('dust', ev.x, 0.3, ev.y, 18); this.burst('gold', ev.x, 1, ev.y, 12); break;
      case 'meteorCast': this.ring(ev.x, ev.y, 3, 0xff7a3a, 0.9); break;
      case 'skill':
        if (ev.skill === 'flameSlash') this.ring(ev.u.x, ev.u.y, 2.4, 0xff7a1a, 0.4);
        break;
    }
  }

  dispose() { this.clearStage(); this.renderer.dispose(); }
}

function rnd(a: number) { return (Math.random() - 0.5) * 2 * a; }
export type { Tower, Unit };
