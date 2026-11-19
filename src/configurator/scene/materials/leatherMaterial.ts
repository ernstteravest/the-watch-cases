/**
 * PBR leather / suede materials.
 *
 * MeshPhysicalMaterial (clearcoat for soft leather reflections, sheen for
 * suede) extended with:
 *  • procedural object-space grain — pebbled full-grain cells, fine nappa
 *    grain, suede nap — evaluated analytically in the shader, so it has no UV
 *    seams and looks identical at preview and final-render resolution;
 *  • analytic ambient occlusion from signed-distance primitives describing
 *    the box interior (walls, floor, cushions, dividers, pocket).
 *
 * Hashing uses integer PCG (no sin()), so the grain pattern is bit-identical
 * across GPUs and the headless renderer.
 */
import { Color, MeshPhysicalMaterial, Vector3, Vector4, type WebGLProgramParametersWithUniforms } from "three";
import type { ResolvedMaterial } from "../../catalog/configuration";
import type { Finish } from "../../catalog/schema";
import { AO_MAX, type AoPrimitive } from "../geometry/boxGeometry";

export interface AoSettings {
  primitives: AoPrimitive[];
  selfGroup: number;
  /** Sampling distance along the normal, cm. */
  radius: number;
  strength: number;
  /** Fraction of the AO also applied to direct light. */
  direct: number;
}

const FINISH_ID: Record<Finish, number> = { pebbled: 0, smooth: 1, suede: 2 };
const AO_TYPE: Record<AoPrimitive["type"], number> = { solid: 0, cavity: 1, ground: 2 };

const GRAIN_GLSL = /* glsl */ `
uniform float uGrainScale;
uniform float uGrainStrength;
uniform float uRoughVar;
uniform float uMottle;
uniform float uCrease;
uniform mat3 normalMatrix;
uniform int uAoCount;
uniform vec3 uAoCenter[${AO_MAX}];
uniform vec3 uAoHalf[${AO_MAX}];
uniform vec4 uAoParams[${AO_MAX}]; // radius, type, group, unused
uniform float uAoSelf;
uniform float uAoRadius;
uniform float uAoStrength;
uniform float uAoDirect;
varying vec3 vObjPos;
varying vec3 vObjNormal;

uvec3 wbPcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 wbHash(vec3 cell) {
  uvec3 u = uvec3(ivec3(cell) + ivec3(65536));
  return vec3(wbPcg3d(u)) * (1.0 / 4294967295.0);
}

// Cellular noise: distances to the nearest/second-nearest feature point and the
// vectors (feature − p) to them.
void wbCellular(vec3 p, out float f1, out float f2, out vec3 r1, out vec3 r2) {
  vec3 ip = floor(p);
  vec3 fp = p - ip;
  f1 = 1e4; f2 = 1e4; r1 = vec3(0.0); r2 = vec3(0.0);
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 o = vec3(float(i), float(j), float(k));
    vec3 r = o + 0.12 + 0.76 * wbHash(ip + o) - fp;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; r2 = r1; f1 = d; r1 = r; }
    else if (d < f2) { f2 = d; r2 = r; }
  }
  f1 = sqrt(max(f1, 1e-8));
  f2 = sqrt(max(f2, 1e-8));
}

float wbValueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  float n000 = wbHash(i).x, n100 = wbHash(i + vec3(1,0,0)).x, n010 = wbHash(i + vec3(0,1,0)).x, n110 = wbHash(i + vec3(1,1,0)).x;
  float n001 = wbHash(i + vec3(0,0,1)).x, n101 = wbHash(i + vec3(1,0,1)).x, n011 = wbHash(i + vec3(0,1,1)).x, n111 = wbHash(i + vec3(1,1,1)).x;
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

// Grain height h in [0, 1] (1 = top of a pebble) and its object-space gradient.
// Pebbles are soft domes separated by shallow valleys (no sharp "cracks").
void wbGrain(vec3 pos, out float h, out vec3 grad) {
  float f1, f2; vec3 r1, r2;
  vec3 p = pos / uGrainScale;
  wbCellular(p, f1, f2, r1, r2);
  float e = f2 - f1;
  #if WB_FINISH == 2
    float w = 0.9;   // suede: very soft nap
  #elif WB_FINISH == 1
    float w = 0.8;   // nappa: faint, wide grain
  #else
    float w = 0.62;  // full-grain: rounded pebbles
  #endif
  float s = clamp(e / w, 0.0, 1.0);
  // smootherstep keeps the valley floor and the pebble top flat-ish
  h = s * s * s * (s * (s * 6.0 - 15.0) + 10.0);
  float ds = (e < w) ? 30.0 * s * s * (1.0 - s) * (1.0 - s) / w : 0.0;
  vec3 gE = (-r2 / f2) - (-r1 / f1);
  // dome: highest at the cell centre
  float dome = 0.45;
  grad = 0.55 * ds * gE + dome * (r1 / f1) * clamp(1.0 - f1, 0.0, 1.0);
  // Fine second octave for micro-texture
  float g1, g2; vec3 q1, q2;
  vec3 p2 = pos / (uGrainScale * 0.38) + vec3(17.3, 5.1, 9.7);
  wbCellular(p2, g1, g2, q1, q2);
  float e2 = g2 - g1;
  float s2 = clamp(e2 / 0.7, 0.0, 1.0);
  float ds2 = (e2 < 0.7) ? 30.0 * s2 * s2 * (1.0 - s2) * (1.0 - s2) / 0.7 : 0.0;
  grad += 0.18 * ds2 * ((-q2 / g2) - (-q1 / g1));
  h = mix(h, s2, 0.15);
}

float wbSdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float wbSdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float wbAoScene(vec3 p) {
  float d = 1e4;
  for (int i = 0; i < ${AO_MAX}; i++) {
    if (i >= uAoCount) break;
    vec4 prm = uAoParams[i];
    if (abs(prm.z - uAoSelf) < 0.5) continue;
    vec3 q = p - uAoCenter[i];
    float di;
    if (prm.y < 0.5) di = wbSdRoundBox(q, uAoHalf[i], prm.x);
    else if (prm.y < 1.5) di = -wbSdBox(q, uAoHalf[i]);
    else di = q.y;
    d = min(d, di);
  }
  return d;
}
float wbAmbientOcclusion(vec3 p, vec3 n) {
  if (uAoCount == 0) return 1.0;
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = uAoRadius * float(i) / 5.0;
    float d = wbAoScene(p + n * h);
    occ += max(h - d, 0.0) * sca;
    sca *= 0.7;
  }
  return clamp(1.0 - uAoStrength * occ / uAoRadius, 0.0, 1.0);
}
`;

export interface LeatherMaterialHandle {
  material: MeshPhysicalMaterial;
  setColor: (hex: string) => void;
  setAo: (ao: AoSettings | null) => void;
}

const sheenTint = (finish: Finish, hex: string): Color => {
  const base = new Color(hex);
  const white = new Color(1, 1, 1);
  return base.clone().lerp(white, finish === "suede" ? 0.16 : 0.12);
};

export const createLeatherMaterial = (resolved: ResolvedMaterial, ao: AoSettings | null): LeatherMaterialHandle => {
  const { material: spec } = resolved;
  const finish = spec.finish;
  const material = new MeshPhysicalMaterial({
    color: new Color(resolved.hex),
    roughness: spec.pbr.roughness,
    metalness: 0,
    clearcoat: spec.pbr.clearcoat,
    clearcoatRoughness: spec.pbr.clearcoatRoughness,
    sheen: spec.pbr.sheen,
    sheenRoughness: spec.pbr.sheenRoughness,
    sheenColor: sheenTint(finish, resolved.hex),
    specularIntensity: spec.pbr.specularIntensity,
    ior: 1.45,
  });
  material.name = `leather:${resolved.key}`;

  const uniforms = {
    uGrainScale: { value: spec.grain.scaleCm },
    uGrainStrength: { value: spec.grain.strength },
    uRoughVar: { value: spec.grain.roughnessVariation },
    uMottle: { value: spec.grain.mottle },
    uCrease: { value: spec.grain.creaseDarkening },
    uAoCount: { value: 0 },
    uAoCenter: { value: Array.from({ length: AO_MAX }, () => new Vector3()) },
    uAoHalf: { value: Array.from({ length: AO_MAX }, () => new Vector3()) },
    uAoParams: { value: Array.from({ length: AO_MAX }, () => new Vector4()) },
    uAoSelf: { value: -1 },
    uAoRadius: { value: 1 },
    uAoStrength: { value: 0 },
    uAoDirect: { value: 0 },
  };

  const setAo = (settings: AoSettings | null) => {
    const prims = settings?.primitives.slice(0, AO_MAX) ?? [];
    uniforms.uAoCount.value = prims.length;
    prims.forEach((p, i) => {
      uniforms.uAoCenter.value[i].set(...p.center);
      uniforms.uAoHalf.value[i].set(...p.half);
      uniforms.uAoParams.value[i].set(p.radius, AO_TYPE[p.type], p.group, 0);
    });
    uniforms.uAoSelf.value = settings?.selfGroup ?? -1;
    uniforms.uAoRadius.value = settings?.radius ?? 1;
    uniforms.uAoStrength.value = settings?.strength ?? 0;
    uniforms.uAoDirect.value = settings?.direct ?? 0;
  };
  setAo(ao);

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.defines = { ...(shader.defines ?? {}), WB_FINISH: FINISH_ID[finish] };

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjPos = transformed;\nvObjNormal = objectNormal;");

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GRAIN_GLSL}`)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float wbH; vec3 wbGrad;
        wbGrain(vObjPos, wbH, wbGrad);
        float wbMottle = wbValueNoise(vObjPos / 2.6) - 0.5;
        diffuseColor.rgb *= (1.0 - uCrease * (1.0 - wbH)) * (1.0 + 2.0 * uMottle * wbMottle);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + uRoughVar * (0.5 - wbH), 0.04, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
        {
          vec3 g = normalMatrix * wbGrad;
          normal = normalize(normal - uGrainStrength * (g - dot(g, normal) * normal));
        }`,
      )
      .replace(
        "#include <aomap_fragment>",
        /* glsl */ `#include <aomap_fragment>
        {
          float wbAo = wbAmbientOcclusion(vObjPos, normalize(vObjNormal));
          reflectedLight.indirectDiffuse *= wbAo;
          reflectedLight.indirectSpecular *= mix(1.0, wbAo, 0.85);
          reflectedLight.directDiffuse *= mix(1.0, wbAo, uAoDirect);
          #ifdef USE_CLEARCOAT
            clearcoatSpecularIndirect *= wbAo;
          #endif
          #ifdef USE_SHEEN
            sheenSpecularIndirect *= wbAo;
          #endif
        }`,
      );
  };
  material.customProgramCacheKey = () => `wb-leather-${finish}`;

  return {
    material,
    setColor: (hex: string) => {
      material.color.set(hex);
      material.sheenColor.copy(sheenTint(finish, hex));
    },
    setAo,
  };
};

/** Simple materials for thread, zip tape and brass hardware. */
export const createThreadMaterial = (hex: string) =>
  new MeshPhysicalMaterial({ color: new Color(hex), roughness: 0.78, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new Color(hex) });

export const createTapeMaterial = (hex: string) =>
  new MeshPhysicalMaterial({ color: new Color(hex), roughness: 0.92, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new Color(hex) });

export const createMetalMaterial = (hex: string, roughness: number) =>
  new MeshPhysicalMaterial({ color: new Color(hex), metalness: 1, roughness, clearcoat: 0.3, clearcoatRoughness: 0.15 });

/** Darkens a hex colour (used for zip tape matching the exterior). */
export const darken = (hex: string, amount: number): string => {
  const c = new Color(hex);
  c.multiplyScalar(1 - amount);
  return `#${c.getHexString()}`;
};
