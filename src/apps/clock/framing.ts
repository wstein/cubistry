import { Quaternion, Euler, Vector3 } from "three";
import { cubePresentationRadius } from "@cubistry/cube-viewer";

/** Legal-turn spheres per cube, not one sphere around the entire horizontal row. */
export const clockCubeRadius = cubePresentationRadius(1);
/** Distance between neighboring cube centers in a stage row. */
export const clockCubeSpacing = 2.8;
/** Centers of the three-cube H–M–S row (the default stage). */
export const clockCenters = [-2.8, 0, 2.8] as const;
export const clockDefaultQuaternion = new Quaternion().setFromEuler(new Euler(.16, -.2, 0));
const margin = .94;

/** Cube counts a stage row supports: two (for example H–M or M–S) or three (H–M–S). */
export type ClockCubeCount = 2 | 3;

/** The validated cube count; any value other than the integers 2 and 3 is rejected. */
export function clockCubeCount(count: unknown): ClockCubeCount {
  if (count !== 2 && count !== 3) throw Error(`A clock stage needs two or three cubes, not ${String(count)}`);
  return count;
}

/**
 * Row centers for `count` cubes, symmetric about the origin:
 * `(index - (count - 1) / 2) * clockCubeSpacing`. Three cubes give exactly
 * `clockCenters`; two give `[-1.4, 1.4]`.
 */
export function clockCentersFor(count: number): readonly number[] {
  const n = clockCubeCount(count);
  return n === 3 ? clockCenters : Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * clockCubeSpacing);
}

/** Largest distance of a cube center from the row center. */
export function clockRowExtent(centers: readonly number[] = clockCenters): number {
  return Math.max(...centers.map(Math.abs));
}

function validCenters(centers: readonly number[]): boolean {
  return Array.isArray(centers) && centers.length > 0 && centers.every(Number.isFinite);
}

/** Exact support against the four perspective side planes, including depth. */
export function clockRequiredDistance(aspect: number, quaternion: Quaternion, fov = 28,
  centers: readonly number[] = clockCenters): number {
  if (!Number.isFinite(aspect) || !Number.isFinite(fov) || aspect <= 0 || fov <= 0 || fov >= 180 ||
      !Number.isFinite(quaternion.lengthSq()) || Math.abs(quaternion.lengthSq() - 1) > 1e-6 ||
      !validCenters(centers)) throw Error("Invalid clock camera");
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
export function clockCameraRadius(aspect: number, yaw = 0, pitch = 0, fov = 28,
  centers: readonly number[] = clockCenters): number {
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) throw Error("Invalid clock camera");
  return clockRequiredDistance(aspect, clockDefaultQuaternion, fov, centers);
}

/** Continuous uniform containment at normal zoom. Explicit closer zoom may crop. */
export function clockPresentationScale(aspect: number, quaternion: Quaternion, fov = 28,
  centers: readonly number[] = clockCenters): number {
  return Math.min(1, clockCameraRadius(aspect, 0, 0, fov, centers) /
    clockRequiredDistance(aspect, quaternion, fov, centers));
}

/** Reusable output, filled from the final presentation pose for studio fitting. */
export function clockWorldCenters(quaternion: Quaternion, scale: number, output: Vector3[],
  centers: readonly number[] = clockCenters): void {
  if (!validCenters(centers) || output.length < centers.length) throw Error("Invalid clock centers");
  for (let i = 0; i < centers.length; i++)
    output[i].set(centers[i] * scale, 0, 0).applyQuaternion(quaternion);
}

/** Valid sampled envelope points of the per-cube caster union of a row. */
export function clockBoundsFor(centers: readonly number[]): (readonly [number, number, number])[] {
  if (!validCenters(centers)) throw Error("Invalid clock centers");
  return centers.flatMap(center => Array.from({ length: 100 }, (_, i) => {
    const z = 1 - 2 * (i + .5) / 100, r = Math.sqrt(1 - z * z), angle = i * 2.399963229728653;
    return [center + clockCubeRadius * r * Math.cos(angle), clockCubeRadius * r * Math.sin(angle), clockCubeRadius * z] as const;
  }));
}

/** Valid sampled envelope points for existing static/browser projection diagnostics.
 * The old whole-row AABB corners were not points in the per-cube caster union. */
export const clockBounds = clockBoundsFor(clockCenters);
