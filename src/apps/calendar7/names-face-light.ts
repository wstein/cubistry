// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from "three";
import { cameraFaces, collectLights, directionalIrradianceOf, irradianceOf } from "./names-exposure.ts";

/**
 * Light per face of the names layout. The studio lights a cube from above; the exposure (names-exposure.ts) makes the face that
 * looks at the camera show its tokens, so a face that looks up got 2 to 4.5 times that irradiance and its pastels clipped to white.
 * Lights are global to the scene, so the faces are told apart in the material: every cube material of the names layout scales
 * the directional lights (and with them the shadow map shading) of a fragment by
 *
 *     scale = SHARE + (1 - SHARE) W         W = smoothstep(FRONT_FROM, FRONT_TO, n . c)
 *
 * (n: the view space normal of the fragment, c = +z: the direction to the camera, which looks at the cube center) and raises its
 * irradiance (ambient and hemisphere light plus the scaled directional light, without shadows) to at least T, the irradiance of
 * the face that looks at the camera, in the proportion 1 - W. A face that looks away is then as bright as the front face at the
 * least and loses only the direction of the light (a face the hemisphere lights more than the front face keeps that). A face that
 * looks at the camera (n . c from FRONT_TO, 41 degrees) has W = 1: its light is the studio's, pixel for pixel. "Front" is therefore the
 * face that looks at the camera, as for the exposure (not a fixed face of the cube): it follows the turn of the cube, and W
 * changes smoothly (two faces near 45 degrees share the front role).
 */
export const NAMES_DIRECTIONAL_SHARE = 0.08;
export const FRONT_FROM = 0.45, FRONT_TO = 0.75;

const smoothstep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** W of a fragment whose normal has the cosine `d` to the camera direction. */
export const frontWeight = (d: number): number => smoothstep(FRONT_FROM, FRONT_TO, d);

/** The uniform of the shaders: (share, target T, FRONT_FROM, FRONT_TO). Share 1 and target 0 give the studio's light on every face. */
export type FaceLightUniform = { value: THREE.Vector4 };
export const faceLightUniform = (): FaceLightUniform => ({ value: new THREE.Vector4(1, 0, FRONT_FROM, FRONT_TO) });

/** T: the weighted mean irradiance of the faces that look at the camera (the irradiance the exposure is calibrated for: pi / exposure). */
export function faceLightTarget(scene: THREE.Object3D, rotation: THREE.Quaternion, camera: THREE.Camera): number {
  const lighting = collectLights(scene);
  let weights = 0, weighted = 0;
  for (const { n, w } of cameraFaces(rotation, camera)) { weights += w; weighted += w * irradianceOf(lighting, n); }
  return weights > 0 ? weighted / weights : 0;
}

/** Writes the uniform for the current view; `share` 1 (or `on` false) is the studio's light everywhere. */
export function updateFaceLight(u: FaceLightUniform, scene: THREE.Object3D, rotation: THREE.Quaternion, camera: THREE.Camera, on: boolean, share: number = NAMES_DIRECTIONAL_SHARE): void {
  if (!on || share >= 1) u.value.set(1, 0, FRONT_FROM, FRONT_TO);
  else u.value.set(share, faceLightTarget(scene, rotation, camera), FRONT_FROM, FRONT_TO);
}

/** What the shaders add up on a diffuse surface with the world normal `n` (the reference of the GLSL below, in the units of `irradianceOf`). */
export function faceIrradiance(scene: THREE.Object3D, n: THREE.Vector3, rotation: THREE.Quaternion, camera: THREE.Camera, share: number = NAMES_DIRECTIONAL_SHARE): number {
  const lighting = collectLights(scene), d = n.dot(camera.position.clone().normalize()), w = frontWeight(d);
  const direct = directionalIrradianceOf(lighting, n), base = irradianceOf(lighting, n) - direct + (share + (1 - share) * w) * direct;
  return base + (1 - w) * Math.max(0, faceLightTarget(scene, rotation, camera) - base);
}

const DECLARE = "uniform vec4 c7FaceLight;\n";
const NORMAL = "vec3 geometryNormal = normal;";
const DIRECTIONAL = "getDirectionalLightInfo( directionalLight, directLight );";
const INDIRECT = "RE_IndirectDiffuse( irradiance,";
const LUMA = "vec3( 0.2126, 0.7152, 0.0722 )";
export const FACE_LIGHT_GLSL = {
  weight: `\n\tfloat c7W = smoothstep( c7FaceLight.z, c7FaceLight.w, geometryNormal.z );\n\tfloat c7Direct = mix( c7FaceLight.x, 1.0, c7W );\n\tfloat c7DirSum = 0.0;`,
  direct: `\n\t\tdirectLight.color *= c7Direct;\n\t\tc7DirSum += saturate( dot( geometryNormal, directLight.direction ) ) * dot( directLight.color, ${LUMA} );`,
  indirect: `float c7Base = dot( irradiance, ${LUMA} ) + c7DirSum;\n\tirradiance += vec3( ( 1.0 - c7W ) * max( 0.0, c7FaceLight.y - c7Base ) );\n\t${INDIRECT}`,
};

/** The light chunks of three.js (begin: before the lights, end: the indirect diffuse call) with the face light in them (each replaced line must exist in this version of three.js). */
export function faceLightChunks(begin: string = THREE.ShaderChunk.lights_fragment_begin, end: string = THREE.ShaderChunk.lights_fragment_end): { begin: string; end: string } {
  const patch = (chunk: string, pairs: readonly (readonly [string, string])[]) => {
    let out = chunk;
    for (const [from, to] of pairs) {
      if (!out.includes(from)) throw new Error(`three.js changed its light chunk: update names-face-light.ts (${from})`);
      out = out.replace(from, to);
    }
    return out;
  };
  return { begin: patch(begin, [[NORMAL, NORMAL + FACE_LIGHT_GLSL.weight], [DIRECTIONAL, DIRECTIONAL + FACE_LIGHT_GLSL.direct]]), end: patch(end, [[INDIRECT, FACE_LIGHT_GLSL.indirect]]) };
}

/** Gives `material` the face light (idempotent; the program is shared by all patched materials, the uniform by all of them too). */
export function patchFaceLight(material: THREE.Material, uniform: FaceLightUniform): void {
  if (material.userData.c7FaceLight) return;
  material.userData.c7FaceLight = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.c7FaceLight = uniform;
    const chunks = faceLightChunks();
    shader.fragmentShader = DECLARE + shader.fragmentShader.replace("#include <lights_fragment_begin>", chunks.begin).replace("#include <lights_fragment_end>", chunks.end);
  };
  material.customProgramCacheKey = () => "c7-face-light";
  material.needsUpdate = true;
}
