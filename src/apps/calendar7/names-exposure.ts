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
 */
export const FACE_WEIGHT_POWER = 8;

const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
const luminance = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Irradiance (three.js units, before the division by pi) on a diffuse surface with the unit normal `n`. */
export function irradiance(scene: THREE.Object3D, n: THREE.Vector3): number {
  let sum = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!(o as THREE.Light).isLight || !o.visible) return;
    if ((o as THREE.AmbientLight).isAmbientLight) {
      const l = o as THREE.AmbientLight;
      sum += l.intensity * luminance(l.color);
    } else if ((o as THREE.HemisphereLight).isHemisphereLight) {
      const l = o as THREE.HemisphereLight, w = 0.5 + 0.5 * n.dot(new THREE.Vector3(0, 1, 0).transformDirection(l.matrixWorld));
      sum += l.intensity * (w * luminance(l.color) + (1 - w) * luminance(l.groundColor));
    } else if ((o as THREE.DirectionalLight).isDirectionalLight) {
      const l = o as THREE.DirectionalLight, to = new THREE.Vector3().setFromMatrixPosition(l.matrixWorld)
        .sub(new THREE.Vector3().setFromMatrixPosition(l.target.matrixWorld)).normalize();
      sum += l.intensity * luminance(l.color) * Math.max(0, n.dot(to));
    }
  });
  return sum;
}

/** The exposure for a cube turned by `rotation` (the presentation quaternion) seen by `camera` (looking at the origin). */
export function namesExposure(scene: THREE.Object3D, rotation: THREE.Quaternion, camera: THREE.Camera): number {
  const toCamera = camera.position.clone().normalize(), n = new THREE.Vector3();
  let weights = 0, weighted = 0;
  for (const [x, y, z] of AXES) {
    n.set(x, y, z).applyQuaternion(rotation);
    const w = Math.max(0, n.dot(toCamera)) ** FACE_WEIGHT_POWER;
    if (w === 0) continue;
    weights += w;
    weighted += w * irradiance(scene, n);
  }
  return weights > 0 ? Math.PI / (weighted / weights) : 1;
}
