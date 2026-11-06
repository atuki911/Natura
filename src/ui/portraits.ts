import * as THREE from 'three';
import { createRig, animateRig } from '../render/rig.ts';
import { TOWER_MODELS } from '../render/models/towers.ts';
import { toonMat, withOutline, outlineUniforms } from '../render/toon.ts';
import { envMap } from '../render/postfx.ts';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let rt: THREE.WebGLRenderTarget;
let canvas: HTMLCanvasElement;
let ctx2d: CanvasRenderingContext2D;
let pixels: Uint8Array;
const cache = new Map<string, string>();
const SIZE = 192;

/** Portraits are rendered with the main renderer into an offscreen target (shaders are shared, no second GL context). */
export function initPortraits(r: THREE.WebGLRenderer) {
  renderer = r;
  scene = new THREE.Scene();
  scene.environment = envMap(r);
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.1));
  const d = new THREE.DirectionalLight(0xffffff, 2.2);
  d.position.set(-3, 5, 6);
  scene.add(d);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  ctx2d = canvas.getContext('2d')!;
  pixels = new Uint8Array(SIZE * SIZE * 4);
}

let bigRT: THREE.WebGLRenderTarget | null = null;
function snap(obj: THREE.Object3D, key: string, tilt = 0.35, SZ = SIZE): string {
  if (!renderer) throw new Error('portraits not initialised');
  const prevRes = outlineUniforms.uResolution.value.clone();
  const prevW = outlineUniforms.uOutline.value;
  outlineUniforms.uResolution.value.set(SZ, SZ);
  outlineUniforms.uOutline.value = 1.6;
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !o.userData.outline) {
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
    }
  });
  const c = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  const r = Math.max(sz.x * 0.9, sz.y, sz.z * 0.6) * 0.56;
  const dist = r / Math.tan(THREE.MathUtils.degToRad(15)) * 1.05;
  camera.position.set(c.x + dist * 0.35, c.y + dist * Math.sin(tilt), c.z + dist * Math.cos(tilt));
  camera.lookAt(c);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  const target = SZ === SIZE ? rt : (bigRT ??= new THREE.WebGLRenderTarget(SZ, SZ, { samples: 4 }));
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const px = SZ === SIZE ? pixels : new Uint8Array(SZ * SZ * 4);
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, SZ, SZ, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.shadowMap.enabled = prevShadow;
  const cv = SZ === SIZE ? canvas : Object.assign(document.createElement('canvas'), { width: SZ, height: SZ });
  const cx = SZ === SIZE ? ctx2d : cv.getContext('2d')!;
  const img = cx.createImageData(SZ, SZ);
  for (let y = 0; y < SZ; y++) {
    const src = (SZ - 1 - y) * SZ * 4;
    img.data.set(px.subarray(src, src + SZ * 4), y * SZ * 4);
  }
  cx.putImageData(img, 0, 0);
  const url = cv.toDataURL('image/png');
  scene.remove(obj);
  outlineUniforms.uResolution.value.copy(prevRes);
  outlineUniforms.uOutline.value = prevW;
  cache.set(key, url);
  return url;
}

/** generate portraits a few at a time in the background */
export function warmPortraits(jobs: (() => void)[]) {
  const step = () => {
    const t = performance.now();
    while (jobs.length && performance.now() - t < 12) jobs.shift()!();
    if (jobs.length) setTimeout(step, 30);
  };
  setTimeout(step, 400);
}

/** large hero art for the title screen */
export function rigPortraitHQ(model: string): string {
  const key = 'righq:' + model;
  const c = cache.get(key);
  if (c) return c;
  const rig = createRig(model, { shadow: false });
  animateRig(rig, 0, 0, 0.2, 0);
  rig.root.rotation.y = 0.55;
  return snap(rig.root, key, 0.12, 400);
}

export function rigPortrait(model: string): string {
  const key = 'rig:' + model;
  const c = cache.get(key);
  if (c) return c;
  const rig = createRig(model, { shadow: false });
  animateRig(rig, 0, 0, 0, 0, !!rig.def.float);
  rig.root.rotation.y = 0.45;
  return snap(rig.root, key, rig.def.float ? 0.3 : 0.28);
}

export function towerPortrait(model: string, tier: number): string {
  const key = 'tower:' + model + ':' + tier;
  const c = cache.get(key);
  if (c) return c;
  const tr = TOWER_MODELS[model](tier);
  const g = new THREE.Group();
  g.add(withOutline(new THREE.Mesh(tr.body, toonMat())));
  for (const p of [tr.turret, tr.orb]) {
    if (!p) continue;
    const m = withOutline(new THREE.Mesh(p.geo, toonMat()));
    m.position.set(...p.pivot);
    if (p === tr.turret) m.rotation.y = 0.6;
    g.add(m);
  }
  for (const cr of tr.crew) {
    const rig = createRig(cr.model, { shadow: false });
    rig.root.position.set(...cr.pos);
    if (cr.turret && tr.turret) rig.root.position.set(cr.pos[0], cr.pos[1], cr.pos[2]);
    animateRig(rig, 0, 0, 0, 0);
    g.add(rig.root);
  }
  g.rotation.y = -0.35;
  return snap(g, key, 0.42);
}

const silCache = new Map<string, string>();
/** dark silhouette of an enemy not yet encountered */
export function rigSilhouette(model: string): string {
  const c = silCache.get(model);
  if (c) return c;
  rigPortrait(model);
  // the last snap left this model's pixels on the 2D canvas when freshly made; redraw from cache to be safe
  const img = new Image();
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const x = cv.getContext('2d')!;
  const url = cache.get('rig:' + model)!;
  img.src = url;
  // data URLs decode synchronously enough in practice, but guard with onload
  const draw = () => {
    x.clearRect(0, 0, SIZE, SIZE);
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#4a3a30';
    x.fillRect(0, 0, SIZE, SIZE);
    x.globalCompositeOperation = 'source-over';
    return cv.toDataURL('image/png');
  };
  if (img.complete && img.naturalWidth) { const u = draw(); silCache.set(model, u); return u; }
  // fall back to the drawn-on-load version for later calls
  img.onload = () => silCache.set(model, draw());
  return url;
}

// ───────── stage preview for the briefing lens ─────────
import { buildEnvironment, PALETTES } from '../render/env.ts';
import { STAGES } from '../data/stages.ts';
import { Path } from '../sim/path.ts';
import { computeSpots } from '../sim/game.ts';

const PREV = 360;
let prevRT: THREE.WebGLRenderTarget | null = null;
const prevCache = new Map<number, string>();

export function stagePreview(i: number): string {
  const c = prevCache.get(i);
  if (c) return c;
  if (!renderer) throw new Error('portraits not initialised');
  const st = STAGES[i];
  const paths = st.paths.map((p) => new Path(p));
  const env = buildEnvironment(st.region, paths, computeSpots(st, paths), st.id + 1);
  const sc = new THREE.Scene();
  const pal = PALETTES[st.region];
  sc.background = new THREE.Color(pal.skyHorizon);
  sc.environment = envMap(renderer);
  sc.environmentIntensity = 0.55;
  sc.add(new THREE.HemisphereLight(pal.ambient, pal.hemiGround, 1.0));
  const sun = new THREE.DirectionalLight(pal.sun, 2.3);
  sun.position.set(-30, 50, 30);
  sc.add(sun, env.group);
  const cam = new THREE.PerspectiveCamera(34, 1, 1, 400);
  cam.position.set(0, 74, 30);
  cam.lookAt(0, 0, 2);
  prevRT ??= new THREE.WebGLRenderTarget(PREV, PREV, { samples: 4 });
  prevRT.texture.colorSpace = THREE.SRGBColorSpace;
  const prevRes = outlineUniforms.uResolution.value.clone();
  const prevW = outlineUniforms.uOutline.value;
  outlineUniforms.uResolution.value.set(PREV, PREV);
  outlineUniforms.uOutline.value = 1.2;
  const prevTarget = renderer.getRenderTarget();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(prevRT);
  renderer.render(sc, cam);
  const px = new Uint8Array(PREV * PREV * 4);
  renderer.readRenderTargetPixels(prevRT, 0, 0, PREV, PREV, px);
  renderer.setRenderTarget(prevTarget);
  renderer.shadowMap.enabled = prevShadow;
  outlineUniforms.uResolution.value.copy(prevRes);
  outlineUniforms.uOutline.value = prevW;
  const cv = document.createElement('canvas');
  cv.width = cv.height = PREV;
  const x = cv.getContext('2d')!;
  const img = x.createImageData(PREV, PREV);
  for (let y = 0; y < PREV; y++) img.data.set(px.subarray((PREV - 1 - y) * PREV * 4, (PREV - y) * PREV * 4), y * PREV * 4);
  x.putImageData(img, 0, 0);
  const url = cv.toDataURL('image/jpeg', 0.85);
  env.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.outline) m.geometry.dispose(); });
  prevCache.set(i, url);
  return url;
}
