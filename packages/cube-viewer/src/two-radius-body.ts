// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from "three";

/**
 * Two-radius body of a cubie (owner decision 2026-11-14): the edges of the cubie that lie on one of the 12 edges of the whole
 * cube have the large radius `big`, every other edge the small radius `small`. A cubie knows which of its faces are exterior
 * faces of the cube (`outer[axis][side]`, side 0 = -, 1 = +); an edge is big when both faces that meet there are exterior.
 *
 * Construction (the scheme of three's RoundedBoxGeometry with a radius per axis and corner): every vertex q of the sharp box
 * moves to `inner + rho * m`, where `inner` is q clamped to the box shrunk by `rho` per axis, `m` the unit vector of
 * `(q - inner) / rho` and `rho` the radii of the three axes. `rho[a]` at a corner is big when the face (a, side) is exterior and
 * one of the two other faces at that corner is exterior, so an exterior face gets the large rounding only along the borders it
 * shares with another exterior face; its other borders (the seams to its neighbors on the same cube face) get the small one.
 *
 * Face groups, vertex order and the UV of the faces follow three's Box/RoundedBox (+X, -X, +Y, -Y, +Z, -Z, the same image
 * orientation per face), but the UV is linear in position (`u = position / extent + 0.5`, see `planarBodyUv`).
 */
export type OuterSides = readonly [readonly [boolean, boolean], readonly [boolean, boolean], readonly [boolean, boolean]];
export const NO_OUTER_SIDES: OuterSides = [[false, false], [false, false], [false, false]];

export interface TwoRadiusBodyOptions {
  /** Box extent per axis (the cell less the gap). */
  readonly size: readonly [number, number, number];
  readonly outer: OuterSides;
  /** Radius of the edges on a cube edge. */
  readonly big: number;
  /** Radius of every other edge. */
  readonly small: number;
  /** Segments per bevel (3 is the preset of the shared viewer). */
  readonly segments: number;
}

/** Radius of the edge along `axis` that lies at the sides `signs` (0 = -, 1 = +) of the other two axes. */
export function edgeRadius(outer: OuterSides, axis: number, signs: readonly [number, number, number], big: number, small: number): number {
  const b = (axis + 1) % 3, c = (axis + 2) % 3;
  return outer[b][signs[b]] && outer[c][signs[c]] ? big : small;
}

/** The three rounding extents (along x, y, z) at the corner with the sides `signs`. */
export function cornerRho(outer: OuterSides, signs: readonly [number, number, number], big: number, small: number): [number, number, number] {
  return [0, 1, 2].map((a) => {
    const b = (a + 1) % 3, c = (a + 2) % 3;
    return outer[a][signs[a]] && (outer[b][signs[b]] || outer[c][signs[c]]) ? big : small;
  }) as [number, number, number];
}

// Three's Box UV per face group: [u axis, u sign, v axis, v sign] of +X, -X, +Y, -Y, +Z, -Z.
const FACE_UV: readonly (readonly [number, number, number, number])[] = [
  [2, -1, 1, 1], [2, 1, 1, 1], [0, 1, 2, -1], [0, 1, 2, 1], [0, 1, 1, 1], [0, -1, 1, 1],
];

export function createTwoRadiusBody(options: TwoRadiusBodyOptions): THREE.BufferGeometry {
  const { size, outer, segments } = options;
  const h = size.map((s) => s / 2) as [number, number, number];
  const limit = Math.min(...h);
  const big = Math.min(options.big, limit), small = Math.min(options.small, limit);
  // rho[a][sa][sb][sc]: indexed by the corner (s0, s1, s2) as a flat number s0 + 2 s1 + 4 s2.
  const rho: [number, number, number][] = [];
  for (let k = 0; k < 8; k++) rho.push(cornerRho(outer, [k & 1, (k >> 1) & 1, (k >> 2) & 1], big, small));
  const rhoAt = (a: number, q: readonly number[]): number => {
    const b = (a + 1) % 3, c = (a + 2) % 3, sa = q[a] >= 0 ? 1 : 0;
    const corner = (sb: number, sc: number): number => { const s = [0, 0, 0]; s[a] = sa; s[b] = sb; s[c] = sc; return rho[s[0] + 2 * s[1] + 4 * s[2]][a]; };
    // The share of a corner end along an axis: 1 up to `big` from the end (the span of its rounding), 0 from 2 `big` on.
    const ramp = (distance: number): number => Math.min(1, Math.max(0, 2 - distance / big));
    const rb = [ramp(q[b] + h[b]), ramp(h[b] - q[b])], rc = [ramp(q[c] + h[c]), ramp(h[c] - q[c])];
    // Along one axis: the smaller end value, and each end opens up to its own value near it.
    const along = (v0: number, v1: number, r0: number, r1: number): number => { const m = Math.min(v0, v1); return m + (v0 - m) * r0 + (v1 - m) * r1; };
    return along(along(corner(0, 0), corner(1, 0), rb[0], rb[1]), along(corner(0, 1), corner(1, 1), rb[0], rb[1]), rc[0], rc[1]);
  };
  /**
   * Grid lines of one axis of a face: the bevel of the low border, the flat part, the bevel of the high border. A border whose two
   * corners have different extents gets the lines of both (the large rounding at one end, the small one along the seam), and a
   * line at `big` and at 2 `big` from an end where the rounding across opens to the large radius (the ramp of `rhoAt`).
   */
  type Ends = { extents: readonly number[]; ramp: boolean };
  const lines = (half: number, lo: Ends, hi: Ends): number[] => {
    const set = (end: Ends, sign: number): number[] => {
      const out: number[] = [];
      for (const e of new Set(end.extents)) for (let j = 0; j <= segments; j++) out.push(sign * (half - (e * j) / segments));
      if (end.ramp) out.push(sign * (half - big), sign * (half - 2 * big));
      return out;
    };
    return [...new Set([...set(lo, -1), ...set(hi, 1)])].sort((x, y) => x - y);
  };
  const position: number[] = [], normal: number[] = [], uv: number[] = [], index: number[] = [];
  const groups: { start: number; count: number; materialIndex: number }[] = [];
  const point = (q: number[]): { p: number[]; n: number[] } => {
    const r = [0, 1, 2].map((a) => rhoAt(a, q));
    const inner = [0, 1, 2].map((a) => Math.min(h[a] - r[a], Math.max(-(h[a] - r[a]), q[a])));
    const m = [0, 1, 2].map((a) => (q[a] - inner[a]) / r[a]);
    const len = Math.hypot(m[0], m[1], m[2]);
    const mu = m.map((x) => x / len);
    const p = [0, 1, 2].map((a) => inner[a] + r[a] * mu[a]);
    const nv = [0, 1, 2].map((a) => mu[a] / r[a]);
    const nl = Math.hypot(nv[0], nv[1], nv[2]);
    return { p, n: nv.map((x) => x / nl) };
  };
  let vertexCount = 0;
  for (let face = 0; face < 6; face++) {
    const a = face >> 1, s = face & 1 ? -1 : 1, b = (a + 1) % 3, c = (a + 2) % 3;
    const side = s > 0 ? 1 : 0;
    // The rounding extents of each border along the face (two values for mixed corners).
    const extent = (axis: number, other: number, sAxis: number): Ends => {
      const extents: number[] = [];
      let ramp = false;
      for (let so = 0; so < 2; so++) {
        const sg = [0, 0, 0]; sg[a] = side; sg[axis] = sAxis; sg[other] = so; extents.push(rho[sg[0] + 2 * sg[1] + 4 * sg[2]][axis]);
        const across = rho[sg[0] + 2 * sg[1] + 4 * sg[2]][other]; sg[axis] = 1 - sAxis;
        if (across > rho[sg[0] + 2 * sg[1] + 4 * sg[2]][other] + 1e-12) ramp = true; // the rounding across opens up at this end only
      }
      return { extents, ramp };
    };
    const ub = lines(h[b], extent(b, c, 0), extent(b, c, 1)), vc = lines(h[c], extent(c, b, 0), extent(c, b, 1));
    const first = vertexCount, startIndex = index.length;
    const [uAxis, uSign, vAxis, vSign] = FACE_UV[face];
    for (const y of vc) for (const x of ub) {
      const q = [0, 0, 0]; q[a] = s * h[a]; q[b] = x; q[c] = y;
      const { p, n } = point(q);
      position.push(p[0], p[1], p[2]); normal.push(n[0], n[1], n[2]);
      uv.push(uSign * p[uAxis] / size[uAxis] + 0.5, vSign * p[vAxis] / size[vAxis] + 0.5);
      vertexCount++;
    }
    const nu = ub.length, nv = vc.length;
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const v0 = first + j * nu + i, v1 = v0 + 1, v2 = v0 + nu, v3 = v2 + 1;
      if (s > 0) index.push(v0, v1, v3, v0, v3, v2); else index.push(v0, v3, v1, v0, v2, v3);
    }
    groups.push({ start: startIndex, count: index.length - startIndex, materialIndex: face });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  for (const g of groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  geometry.userData.size = [...size];
  return geometry;
}
