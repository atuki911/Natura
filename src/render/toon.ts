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

/** shared vertex-colored toon material */
export function toonMat(opts: { emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}): THREE.MeshToonMaterial {
  const key = 'toon:' + JSON.stringify(opts);
  let m = cache.get(key) as THREE.MeshToonMaterial | undefined;
  if (!m) {
    m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
    if (opts.emissive != null) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity ?? 0.8; m.depthWrite = false; }
    cache.set(key, m);
  }
  return m;
}

/** vertex-colored material that also glows (for magic things) */
export function glowMat(): THREE.MeshBasicMaterial {
  const key = 'glow';
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) { m = new THREE.MeshBasicMaterial({ vertexColors: true }); cache.set(key, m); }
  return m;
}

export const outlineUniforms = {
  uOutline: { value: 2.0 },
  uResolution: { value: new THREE.Vector2(1280, 720) },
};

const outlineCache = new Map<number, THREE.MeshBasicMaterial>();
export function outlineMat(color = 0x2a1a12): THREE.MeshBasicMaterial {
  let m = outlineCache.get(color);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = outlineUniforms.uOutline;
    shader.uniforms.uResolution = outlineUniforms.uResolution;
    shader.vertexShader = 'uniform float uOutline;\nuniform vec2 uResolution;\n' + shader.vertexShader.replace(
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
  outlineCache.set(color, m);
  return m;
}

/** Add an outline shell to a mesh (shares geometry). */
export function withOutline<T extends THREE.Mesh | THREE.InstancedMesh>(mesh: T, color?: number): T {
  let o: THREE.Mesh;
  if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
    const im = mesh as THREE.InstancedMesh;
    const oi = new THREE.InstancedMesh(im.geometry, outlineMat(color), im.count);
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
