import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const steps = [90, 150, 205, 245, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255; });
  gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map<string, THREE.Material>();

export type ToonMaterial = THREE.MeshStandardMaterial;

/**
 * Shared vertex-colored material. Stylised PBR: smooth, slightly glossy shading lit by the sun and a
 * soft environment (warm highlights, no hard toon bands) — the "polished toy" look.
 */
export function toonMat(opts: { emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number; rough?: number; metal?: number } = {}): ToonMaterial {
  const key = 'std:' + JSON.stringify(opts);
  let m = cache.get(key) as ToonMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.rough ?? 0.58, metalness: opts.metal ?? 0.0, envMapIntensity: 0.75 });
    if (opts.emissive != null) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity ?? 0.8; m.depthWrite = false; }
    cache.set(key, m);
  }
  return m;
}

/** glossy metal (gold trims, cannon barrels) */
export function metalMat(): ToonMaterial { return toonMat({ rough: 0.32, metal: 0.65 }); }

/** vertex-colored material that also glows (for magic things) */
export function glowMat(): THREE.MeshBasicMaterial {
  const key = 'glow';
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    // pushed above 1.0 so only glowing things (gems, magic, lava, portals) feed the bloom pass
    m = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3.2, 3.2, 3.2) });
    cache.set(key, m);
  }
  return m;
}

export const outlineUniforms = {
  uOutline: { value: 1.4 },
  uResolution: { value: new THREE.Vector2(1280, 720) },
};

/** shared wind clock for swaying vegetation */
export const swayUniform = { value: 0 };
const SWAY_GLSL = `
  #ifdef USE_INSTANCING
    float swPh = uSway * 1.7 + instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.29;
  #else
    float swPh = uSway * 1.7;
  #endif
  float swA = sin(swPh) * 0.05 * max(0.0, position.y);
  transformed.x += swA; transformed.z += swA * 0.5;`;

let swayToon: ToonMaterial | null = null;
export function swayMat(): ToonMaterial {
  if (swayToon) return swayToon;
  const m = toonMat().clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSway = swayUniform;
    shader.vertexShader = 'uniform float uSway;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + SWAY_GLSL);
  };
  m.customProgramCacheKey = () => 'toon-sway';
  swayToon = m;
  return m;
}

const outlineCache = new Map<string, THREE.MeshBasicMaterial>();
export function outlineMat(color = 0x2a1a12, sway = false): THREE.MeshBasicMaterial {
  const key = color + (sway ? 's' : '');
  let m = outlineCache.get(key);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.customProgramCacheKey = () => 'outline' + (sway ? '-sway' : '');
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = outlineUniforms.uOutline;
    shader.uniforms.uResolution = outlineUniforms.uResolution;
    shader.uniforms.uSway = swayUniform;
    let vs = shader.vertexShader;
    if (sway) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>' + SWAY_GLSL);
    shader.vertexShader = 'uniform float uOutline;\nuniform vec2 uResolution;\nuniform float uSway;\n' + vs.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        mat4 mm = modelMatrix;
        #ifdef USE_INSTANCING
          mm = modelMatrix * instanceMatrix;
        #endif
        vec3 wn = normalize(mat3(mm) * normal);
        vec3 vn = mat3(viewMatrix) * wn;
        vec4 cn = projectionMatrix * vec4(vn, 0.0);
        vec2 dir = cn.xy * uResolution;
        float l = length(dir);
        if (l > 1e-5) {
          dir /= l;
          gl_Position.xy += dir * uOutline * 2.0 / uResolution * gl_Position.w;
        }
      }`,
    );
  };
  outlineCache.set(key, m);
  return m;
}

/** Add an outline shell to a mesh (shares geometry). */
export function withOutline<T extends THREE.Mesh | THREE.InstancedMesh>(mesh: T, color?: number, sway = false): T {
  let o: THREE.Mesh;
  if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
    const im = mesh as THREE.InstancedMesh;
    const oi = new THREE.InstancedMesh(im.geometry, outlineMat(color, sway), im.count);
    oi.instanceMatrix = im.instanceMatrix;
    o = oi;
  } else {
    o = new THREE.Mesh(mesh.geometry, outlineMat(color));
  }
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.outline = true;
  o.frustumCulled = mesh.frustumCulled;
  mesh.add(o);
  return mesh;
}
