// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from "three";

/**
 * Exposure of the names layout (renderer.toneMappingExposure at Linear tone mapping): the inverse of the radiance a white
 * diffuse surface gets from the scene lights on the face that looks at the camera, so that face shows its albedo and a color
 * token renders as itself, with the paper white as the reference. three.js lights give an albedo times irradiance / pi.
 *
 * "The face that looks at the camera" is a smooth weighting of the six cube faces by max(0, n . c)^FACE_WEIGHT_POWER (n: the
 * world normal of a face, c: the direction to the camera): head on or slightly tilted one face carries the whole weight, a
 * cube turned 45 degrees mixes the two faces that look at the camera equally, so the exposure never jumps while the cube
 * is rotated. The irradiance is read from the lights of the scene (ambient, hemisphere, directional: intensity, color,
 * visibility), so the lighting switches and the preset are followed.
 *
 * Limit (measured, Paper Red, production effects): up to the start view (pitch 0.22, yaw 0.3) every fill is within 1 of 255 of its
 * token. At a steeper pitch the brighter top face pulls the weighted irradiance up and the face that looks at the camera renders
 * darker than its token (pitch 0.63, yaw 0.3: weekend tint #d6cbcd instead of #fdeeee, 39 off). Faces that look away are shaded by
 * the lights, as on a real cube.
 */
export const FACE_WEIGHT_POWER = 8;

const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
const luminance = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/**
 * The lights that shade a diffuse surface by direction only: ambient, hemisphere and directional lights (the studio's light
 * types, asserted in tests/calendar7-names-look.test.mjs). Point, spot and rect-area lights, light probes and scene.environment
 * are not counted: a scene that adds one is not calibrated by this function.
 */
export type Lighting = { ambient: number; hemispheres: { up: THREE.Vector3; sky: number; ground: number }[]; directionals: { to: THREE.Vector3; amount: number }[] };

/** Reads the visible lights of `scene` once (the matrices are updated here). */
export function collectLights(scene: THREE.Object3D): Lighting {
  const lighting: Lighting = { ambient: 0, hemispheres: [], directionals: [] };
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!(o as THREE.Light).isLight || !o.visible) return;
    if ((o as THREE.AmbientLight).isAmbientLight) {
      const l = o as THREE.AmbientLight;
      lighting.ambient += l.intensity * luminance(l.color);
    } else if ((o as THREE.HemisphereLight).isHemisphereLight) {
      // three.js takes the hemisphere direction from the light position (sky side).
      const l = o as THREE.HemisphereLight;
      lighting.hemispheres.push({ up: new THREE.Vector3().setFromMatrixPosition(l.matrixWorld).normalize(), sky: l.intensity * luminance(l.color), ground: l.intensity * luminance(l.groundColor) });
    } else if ((o as THREE.DirectionalLight).isDirectionalLight) {
      const l = o as THREE.DirectionalLight;
      lighting.directionals.push({ to: new THREE.Vector3().setFromMatrixPosition(l.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(l.target.matrixWorld)).normalize(), amount: l.intensity * luminance(l.color) });
    }
  });
  return lighting;
}

/** Irradiance (three.js units, before the division by pi) on a diffuse surface with the unit normal `n`. */
export function irradianceOf(lighting: Lighting, n: THREE.Vector3): number {
  let sum = lighting.ambient;
  for (const h of lighting.hemispheres) { const w = 0.5 + 0.5 * n.dot(h.up); sum += w * h.sky + (1 - w) * h.ground; }
  for (const d of lighting.directionals) sum += d.amount * Math.max(0, n.dot(d.to));
  return sum;
}
export const irradiance = (scene: THREE.Object3D, n: THREE.Vector3): number => irradianceOf(collectLights(scene), n);

/**
 * The exposure for a cube turned by `rotation` (the presentation quaternion) seen by `camera` (looking at the origin).
 * 1 (the shared value) when no light reaches the faces, instead of an infinite exposure.
 */
export function namesExposure(scene: THREE.Object3D, rotation: THREE.Quaternion, camera: THREE.Camera): number {
  const lighting = collectLights(scene), toCamera = camera.position.clone().normalize(), n = new THREE.Vector3();
  let weights = 0, weighted = 0;
  for (const [x, y, z] of AXES) {
    n.set(x, y, z).applyQuaternion(rotation);
    const w = Math.max(0, n.dot(toCamera)) ** FACE_WEIGHT_POWER;
    if (w === 0) continue;
    weights += w;
    weighted += w * irradianceOf(lighting, n);
  }
  const mean = weights > 0 ? weighted / weights : 0;
  return mean > 1e-6 ? Math.PI / mean : 1;
}
