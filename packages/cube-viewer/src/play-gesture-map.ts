// SPDX-License-Identifier: AGPL-3.0-or-later
// Play mode, pure part 1: map a hit sticker and a drag vector to rotation axis, layer and direction.
// Framework-free: no DOM, no WebGL. The caller supplies the raycast hit (cube-local) and the screen
// projection of the three cube axes, so the same code serves any camera, including inverted views.

export type Axis = "x" | "y" | "z";
export type Face = "R" | "L" | "U" | "D" | "F" | "B";
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

/** Raycast hit in the cube's local frame: the cube spans [-1, 1] on each axis. */
export interface Hit { readonly face: Face; readonly point: Vec3 }
/** Screen vector (pixels) of each unit cube axis under the current camera. */
export interface AxisScreen { readonly x: Vec2; readonly y: Vec2; readonly z: Vec2 }

export const AXES: readonly Axis[] = ["x", "y", "z"];
export const DEAD_ZONE_PX = 8;
export const MIN_SIZE = 2;
export const MAX_SIZE = 7;
const FACE_AXIS: Record<Face, readonly [number, 1 | -1]> = {
  R: [0, 1], L: [0, -1], U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1],
};
const SURFACE_TOLERANCE = 1e-6;
const BOUNDARY_TOLERANCE = 1e-9;

export function checkSize(n: number): void {
  if (!Number.isInteger(n) || n < MIN_SIZE || n > MAX_SIZE) throw RangeError(`Invalid cube size ${n}; expected an integer ${MIN_SIZE}..${MAX_SIZE}`);
}

/**
 * Layer index of a cube-local coordinate, counted from the negative side (0..n-1).
 * Sticker edge rule: a coordinate on (or within 1e-9 below) an inner boundary belongs to the higher
 * layer; the cube's upper edge belongs to the last layer; overshoot clamps.
 */
export function cellIndex(coordinate: number, n: number): number {
  checkSize(n);
  const c = Math.max(-1, Math.min(1, coordinate));
  return Math.min(n - 1, Math.max(0, Math.floor(((c + 1) * n) / 2 + BOUNDARY_TOLERANCE)));
}

/** Cubie index triple [ix, iy, iz] of the touched sticker, or null when the hit is not on the face. */
export function hitCell(hit: Hit, n: number): [number, number, number] | null {
  checkSize(n);
  const [fa, fs] = FACE_AXIS[hit.face];
  const p = hit.point;
  if (!p.every(Number.isFinite)) return null;
  if (Math.abs(p[fa] - fs) > SURFACE_TOLERANCE) return null;
  for (let a = 0; a < 3; a++) if (a !== fa && Math.abs(p[a]) > 1 + SURFACE_TOLERANCE) return null;
  const cell = [0, 1, 2].map((a) => (a === fa ? (fs > 0 ? n - 1 : 0) : cellIndex(p[a], n)));
  return cell as [number, number, number];
}

export interface DragDecision {
  readonly axis: Axis;
  /** Layer index along the axis, counted from the negative side. */
  readonly layer: number;
  /** +1 = right-hand rotation about the positive axis, -1 = the opposite. */
  readonly direction: 1 | -1;
  /** Unit screen vector along which a positive (right-hand) rotation progresses. */
  readonly screenDir: Vec2;
  /** Signed drag length along screenDir (positive = positive rotation). */
  readonly progressPx: number;
  /** Touched cubie, for the sticker highlight. */
  readonly cell: readonly [number, number, number];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
const unit = (k: number): Vec3 => (k === 0 ? [1, 0, 0] : k === 1 ? [0, 1, 0] : [0, 0, 1]);

/** Screen vector of the 3D vector v, a linear combination of the axis projections. */
function project(v: Vec3, s: AxisScreen): Vec2 {
  return [v[0] * s.x[0] + v[1] * s.y[0] + v[2] * s.z[0], v[0] * s.x[1] + v[1] * s.y[1] + v[2] * s.z[1]];
}

/**
 * Decide axis, layer and direction from the touched sticker and the drag vector (screen px since
 * pointer-down). Returns null inside the dead zone (|drag| < deadZonePx) or when the view cannot
 * resolve a direction (face seen edge-on).
 *
 * A point on face normal n moves along e_k x n under a positive rotation about axis k. Of the two
 * axes tangent to the face, the one whose screen direction the drag follows most closely wins; an
 * exact tie goes to the lower axis index. The layer is the hit depth along that axis.
 */
export function mapDrag(hit: Hit, n: number, drag: Vec2, axes: AxisScreen, deadZonePx = DEAD_ZONE_PX): DragDecision | null {
  const cell = hitCell(hit, n);
  if (!cell) return null;
  if (Math.hypot(drag[0], drag[1]) < deadZonePx) return null;
  const [fa, fs] = FACE_AXIS[hit.face];
  const normal: Vec3 = [fa === 0 ? fs : 0, fa === 1 ? fs : 0, fa === 2 ? fs : 0];
  let best: { k: number; score: number; dir: Vec2 } | null = null;
  for (let k = 0; k < 3; k++) {
    if (k === fa) continue;
    const s = project(cross3(unit(k), normal), axes);
    const len = Math.hypot(s[0], s[1]);
    if (!(len > 1e-9)) continue;
    const dir: Vec2 = [s[0] / len, s[1] / len];
    const score = drag[0] * dir[0] + drag[1] * dir[1];
    if (!best || Math.abs(score) > Math.abs(best.score)) best = { k, score, dir };
  }
  if (!best || best.score === 0) return null;
  return {
    axis: AXES[best.k], layer: cell[best.k], direction: best.score > 0 ? 1 : -1,
    screenDir: best.dir, progressPx: best.score, cell,
  };
}

/**
 * Range for a wide turn started from one point (mouse Shift+drag): the touched layer through the
 * nearest outer layer; the exact middle goes to the low side. Inclusive [from, to].
 */
export function wideRangeFromOne(layer: number, n: number): [number, number] {
  checkSize(n);
  if (!Number.isInteger(layer) || layer < 0 || layer >= n) throw RangeError(`Invalid layer ${layer}`);
  return layer <= n - 1 - layer ? [0, layer] : [layer, n - 1];
}
