import { Quaternion, Euler, Vector3 } from "three";
import { cubePresentationRadius } from "@cubistry/cube-viewer";

/** One legal-turn sphere per cube, not one sphere around the entire horizontal row. */
export const clockCubeRadius = cubePresentationRadius(1);
/** Distance between neighboring cube centers in the row. */
export const clockSpacing = 2.8;
/** A row holds two or three cubes. */
export type ClockCubeCount = 2 | 3;

/** Rejects every cube count other than the integers two and three. */
export function assertClockCubeCount(count: unknown): asserts count is ClockCubeCount {
  if (count !== 2 && count !== 3) throw Error(`Clock stage needs two or three cubes, got ${String(count)}`);
}

/** X positions of a row centered on the origin: two cubes at -1.4 and 1.4, three at -2.8, 0 and 2.8. */
export function clockCentersFor(count: number): number[] {
  assertClockCubeCount(count);
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * clockSpacing);
}

export const clockCenters = clockCentersFor(3) as readonly number[];
export const clockDefaultQuaternion = new Quaternion().setFromEuler(new Euler(.16, -.2, 0));
const margin = .94;

/** Exact support against the four perspective side planes, including depth. */
export function clockRequiredDistance(aspect: number, quaternion: Quaternion, fov = 28, count: number = 3): number {
  const centers = clockCentersFor(count);
  if (!Number.isFinite(aspect) || !Number.isFinite(fov) || aspect <= 0 || fov <= 0 || fov >= 180 ||
      !Number.isFinite(quaternion.lengthSq()) || Math.abs(quaternion.lengthSq() - 1) > 1e-6) throw Error("Invalid clock camera");
  const ty = Math.tan(fov * Math.PI / 360) * margin, tx = ty * aspect;
  // Rotation of the row's X axis; no per-frame vectors or mesh traversal.
  const { x, y, z, w } = quaternion;
  const ax = 1 - 2 * (y * y + z * z), ay = 2 * (x * y + z * w), az = 2 * (x * z - y * w);
  let distance = 0;
  for (const center of centers) {
    const cx = center * ax, cy = center * ay, cz = center * az;
    distance = Math.max(distance, cz + (Math.abs(cx) + clockCubeRadius * Math.hypot(1, tx)) / tx,
      cz + (Math.abs(cy) + clockCubeRadius * Math.hypot(1, ty)) / ty);
  }
  return distance;
}

/** Camera fitting depends on resize/explicit zoom, never the current drag pose. */
export function clockCameraRadius(aspect: number, yaw = 0, pitch = 0, fov = 28, count: number = 3): number {
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) throw Error("Invalid clock camera");
  return clockRequiredDistance(aspect, clockDefaultQuaternion, fov, count);
}

/** Continuous uniform containment at normal zoom. Explicit closer zoom may crop. */
export function clockPresentationScale(aspect: number, quaternion: Quaternion, fov = 28, count: number = 3): number {
  return Math.min(1, clockCameraRadius(aspect, 0, 0, fov, count) / clockRequiredDistance(aspect, quaternion, fov, count));
}

/** Reusable output, filled from the final presentation pose for studio fitting. */
export function clockWorldCenters(quaternion: Quaternion, scale: number, output: Vector3[], count: number = 3): void {
  const centers = clockCentersFor(count);
  for (let i = 0; i < centers.length; i++)
    output[i].set(centers[i] * scale, 0, 0).applyQuaternion(quaternion);
}

/** Valid sampled envelope points for existing static/browser projection diagnostics.
 * The old whole-row AABB corners were not points in the per-cube caster union. */
export function clockBoundsFor(count: number) {
  return clockCentersFor(count).flatMap(center => Array.from({ length: 100 }, (_, i) => {
    const z = 1 - 2 * (i + .5) / 100, r = Math.sqrt(1 - z * z), angle = i * 2.399963229728653;
    return [center + clockCubeRadius * r * Math.cos(angle), clockCubeRadius * r * Math.sin(angle), clockCubeRadius * z] as const;
  }));
}
export const clockBounds = clockBoundsFor(3);
