import { Quaternion, Euler, Vector3 } from "three";
import { cubePresentationRadius } from "@cubistry/cube-viewer";

/** Three legal-turn spheres, not one sphere around the entire horizontal row. */
export const clockCubeRadius = cubePresentationRadius(1);
export const clockCenters = [-2.8, 0, 2.8] as const;
export const clockDefaultQuaternion = new Quaternion().setFromEuler(new Euler(.16, -.2, 0));
const margin = .94;

/** Exact support against the four perspective side planes, including depth. */
export function clockRequiredDistance(aspect: number, quaternion: Quaternion, fov = 28): number {
  if (!Number.isFinite(aspect) || !Number.isFinite(fov) || aspect <= 0 || fov <= 0 || fov >= 180 ||
      !Number.isFinite(quaternion.lengthSq()) || Math.abs(quaternion.lengthSq() - 1) > 1e-6) throw Error("Invalid clock camera");
  const ty = Math.tan(fov * Math.PI / 360) * margin, tx = ty * aspect;
  // Rotation of the row's X axis; no per-frame vectors or mesh traversal.
  const { x, y, z, w } = quaternion;
  const ax = 1 - 2 * (y * y + z * z), ay = 2 * (x * y + z * w), az = 2 * (x * z - y * w);
  let distance = 0;
  for (const center of clockCenters) {
    const cx = center * ax, cy = center * ay, cz = center * az;
    distance = Math.max(distance, cz + (Math.abs(cx) + clockCubeRadius * Math.hypot(1, tx)) / tx,
      cz + (Math.abs(cy) + clockCubeRadius * Math.hypot(1, ty)) / ty);
  }
  return distance;
}

/** Camera fitting depends on resize/explicit zoom, never the current drag pose. */
export function clockCameraRadius(aspect: number, yaw = 0, pitch = 0, fov = 28): number {
  if (![yaw, pitch].every(Number.isFinite)) throw Error("Invalid clock camera");
  return clockRequiredDistance(aspect, clockDefaultQuaternion, fov);
}

/** Continuous uniform containment at normal zoom. Explicit closer zoom may crop. */
export function clockPresentationScale(aspect: number, quaternion: Quaternion, fov = 28): number {
  return Math.min(1, clockCameraRadius(aspect, 0, 0, fov) / clockRequiredDistance(aspect, quaternion, fov));
}

/** Reusable output, filled from the final presentation pose for studio fitting. */
export function clockWorldCenters(quaternion: Quaternion, scale: number, output: Vector3[]): void {
  for (let i = 0; i < clockCenters.length; i++)
    output[i].set(clockCenters[i] * scale, 0, 0).applyQuaternion(quaternion);
}

/** Valid sampled envelope points for existing static/browser projection diagnostics.
 * The old whole-row AABB corners were not points in the per-cube caster union. */
export const clockBounds = clockCenters.flatMap(center => Array.from({ length: 100 }, (_, i) => {
  const z = 1 - 2 * (i + .5) / 100, r = Math.sqrt(1 - z * z), angle = i * 2.399963229728653;
  return [center + clockCubeRadius * r * Math.cos(angle), clockCubeRadius * r * Math.sin(angle), clockCubeRadius * z] as const;
}));
