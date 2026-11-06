import { AXES, cross, dot, eq, rotate, type Rotation, type Vec3 } from "@cubistry/cube-core";

/** Row convention of `rotate`: `rotate(v, R)` is `v * R`, so `then(A, B)` applies A first, then B. */
export const then = (a: Rotation, b: Rotation): Rotation =>
  a.map((row) => rotate(row, b)) as unknown as Rotation;

export const inverse = (r: Rotation): Rotation => [
  [r[0][0], r[1][0], r[2][0]],
  [r[0][1], r[1][1], r[2][1]],
  [r[0][2], r[1][2], r[2][2]],
];

export const IDENTITY_ROTATION: Rotation = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** The 24 proper whole-cube rotations, identity first. Same construction as `ROTATIONS` in cube-mechanics. */
export const CUBE_ROTATIONS: readonly Rotation[] = (() => {
  const all = AXES.flatMap((x) => AXES.filter((y) => dot(x, y) === 0).map((y): Rotation => [x, y, cross(x, y)]));
  const i = all.findIndex((r) => r.every((row, k) => eq(row, IDENTITY_ROTATION[k])));
  return [all[i], ...all.filter((_, k) => k !== i)];
})();

export const rotationEquals = (a: Rotation, b: Rotation): boolean => a.every((row, k) => eq(row, b[k]));

const clean = (n: number) => (n === 0 ? 0 : n);
const key3 = (v: Vec3) => `${clean(v[0])},${clean(v[1])},${clean(v[2])}`;

/** Canonical slot key `x,y,z|nx,ny,nz`: cubie position (doubled integer coordinates) and outward normal. */
export const slotKey = (p: Vec3, n: Vec3): string => `${key3(p)}|${key3(n)}`;

/** Reference "up" of a face normal. Any fixed choice works: only differences between stickers on one slot matter. */
export function referenceUp(n: Vec3): Vec3 {
  if (eq(n, [0, 1, 0])) return [0, 0, -1];
  if (eq(n, [0, -1, 0])) return [0, 0, 1];
  return [0, 1, 0];
}

/**
 * Counterclockwise quarter-turn index (0..3) of a sticker's world `up` relative to the reference up of its
 * normal. One step is `up := cross(n, up)`, the same step `matchesTarget` in cube-mechanics uses.
 */
export function quarterIndex(n: Vec3, up: Vec3): 0 | 1 | 2 | 3 {
  let v = referenceUp(n);
  for (let q = 0; q < 4; q++) {
    if (eq(v, up)) return q as 0 | 1 | 2 | 3;
    v = cross(n, v);
  }
  throw new Error("Sticker up is not perpendicular to its normal");
}
