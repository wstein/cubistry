// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from "three";

/**
 * Colors of the normally hidden (cut) faces of a stickerless cubie, as on a real cube: along an edge that it shares with an
 * exterior face with a sticker, a cut face carries the color of THAT face. Where a cut face borders two exterior faces
 * with different colors it is split diagonally (miter) so that each edge has the color of the exterior face it touches.
 * A cut face that touches no exterior face keeps the body color. Pure functions; no scene needed.
 */

/** The four edges of a face in its texture space: `u1` is the edge at u = 1, `v0` the edge at v = 0 and so on. */
export type CutEdge = "u0" | "u1" | "v0" | "v1";
/** An exterior face touching a cut face: the edge of the cut face it borders and its color. */
export interface CutEdgeColor {
  readonly edge: CutEdge;
  readonly color: string;
  /** The color changes along the edge: stops from the low to the high end of the coordinate along the edge (v for a u edge, u for a v edge); `color` is the first. */
  readonly stops?: readonly EdgeStop[];
}
/** A stretch of an edge up to the fraction `to` (0..1) of its length. The last stop ends at 1. */
export interface EdgeStop { readonly to: number; readonly color: string }
/** The stops of an exterior face along one of its edges and the direction (a body-local vector) in which they run. */
export interface EdgeProfile { readonly stops: readonly EdgeStop[]; readonly dir: readonly number[] }
/** How the texture space (u, v) of a face group lies on the body: which tangent axis grows with u and v, and the sign. */
export interface FaceUvAxes { readonly uAxis: number; readonly uSign: 1 | -1; readonly vAxis: number; readonly vSign: 1 | -1 }

/** Face-group order of Three's Box/RoundedBox geometry: +x, -x, +y, -y, +z, -z. */
export const faceAxis = (index: number): number => index >> 1;
export const faceSign = (index: number): 1 | -1 => ((index & 1) === 0 ? 1 : -1);

/**
 * Measures `FaceUvAxes` of every face group of a Box/RoundedBox geometry (position and uv attributes, six groups), so no
 * assumption about the library's uv orientation is made.
 */
export function faceUvAxes(geometry: THREE.BufferGeometry): readonly FaceUvAxes[] {
  const pos = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  return Array.from({ length: 6 }, (_, face) => {
    const group = geometry.groups.find(g => g.materialIndex === face);
    if (!group) throw new Error("Missing body face group");
    const tangents = [0, 1, 2].filter(a => a !== faceAxis(face));
    const cov = (value: (vertex: number) => number, axis: number): number => {
      let sum = 0;
      for (let i = group.start; i < group.start + group.count; i++) {
        const vertex = geometry.index?.getX(i) ?? i;
        sum += (value(vertex) - 0.5) * pos.getComponent(vertex, axis);
      }
      return sum;
    };
    const along = (value: (vertex: number) => number): { axis: number; sign: 1 | -1 } => {
      const [a, b] = tangents.map(axis => cov(value, axis));
      const axis = Math.abs(a) >= Math.abs(b) ? tangents[0] : tangents[1];
      return { axis, sign: (Math.abs(a) >= Math.abs(b) ? a : b) >= 0 ? 1 : -1 };
    };
    const u = along(vertex => uv.getX(vertex)), v = along(vertex => uv.getY(vertex));
    if (u.axis === v.axis) throw new Error("Body face uv axes are not perpendicular");
    return { uAxis: u.axis, uSign: u.sign, vAxis: v.axis, vSign: v.sign };
  });
}

/**
 * The exterior faces next to cut face `face` of a cubie. `exterior[k]` is the color of the exterior face k (group order) or
 * null when face k is a cut face too. A neighbor of the cut face is a face on one of its two tangent axes; it lies on the
 * edge of the cut face on that side.
 */
export function cutFaceEdges(face: number, exterior: readonly (string | null)[], axes: readonly FaceUvAxes[], profiles: readonly (EdgeProfile | null | undefined)[] = []): readonly CutEdgeColor[] {
  const { uAxis, uSign, vAxis, vSign } = axes[face];
  const side = (axis: number, sign: 1 | -1, high: CutEdge, low: CutEdge): [number, CutEdge][] => [[axis * 2 + (sign > 0 ? 0 : 1), high], [axis * 2 + (sign > 0 ? 1 : 0), low]];
  const edges: CutEdgeColor[] = [];
  for (const [neighbor, edge] of [...side(uAxis, uSign, "u1", "u0"), ...side(vAxis, vSign, "v1", "v0")]) {
    const color = exterior[neighbor];
    if (!color) continue;
    const profile = profiles[neighbor];
    // along the edge runs the other tangent axis of the cut face; the stops run along `dir`, this is the same way iff dir points to growing uv
    const along = edge[0] === "u" ? { axis: vAxis, sign: vSign } : { axis: uAxis, sign: uSign };
    const same = profile ? profile.dir[along.axis] * along.sign : 0;
    if (profile && same !== 0) {
      const stops = same > 0 ? profile.stops : profile.stops.map((stop, i, all) => ({ to: 1 - (i === 0 ? 0 : all[i - 1].to), color: stop.color })).reverse();
      edges.push({ edge, color: stops[0].color, stops });
    } else edges.push({ edge, color });
  }
  return edges;
}

/** Distance of the point (u, v) of the unit square to an edge. */
const distance = (edge: CutEdge, u: number, v: number): number => (edge === "u1" ? 1 - u : edge === "u0" ? u : edge === "v1" ? 1 - v : v);

/**
 * Color of the point (u, v) of a cut face with these exterior edges: the color of the nearest exterior edge. One edge gives
 * the whole face its color; two neighboring edges give the diagonal miter through their shared corner; none gives null
 * (the body color). A tie (on the diagonal) goes to the first edge.
 */
export function cutColorAt(edges: readonly CutEdgeColor[], u: number, v: number): string | null {
  let best: CutEdgeColor | null = null, bestDistance = Infinity;
  for (const e of edges) {
    const d = distance(e.edge, u, v);
    if (d < bestDistance) { best = e; bestDistance = d; }
  }
  if (!best) return null;
  if (!best.stops) return best.color;
  const q = best.edge[0] === "u" ? v : u;
  return (best.stops.find(stop => q <= stop.to) ?? best.stops[best.stops.length - 1]).color;
}

/** The single color of a cut face when every exterior edge has the same color (no miter needed), else null. */
export const flatCutColor = (edges: readonly CutEdgeColor[]): string | null =>
  edges.length > 0 && edges.every(e => !e.stops && e.color === edges[0].color) ? edges[0].color : null;

/** Stable key of a miter pattern. */
export const cutPatternKey = (edges: readonly CutEdgeColor[]): string => edges.map(e => `${e.edge}${e.color}${e.stops ? e.stops.map(stop => `${stop.to.toFixed(4)}${stop.color}`).join(",") : ""}`).sort().join("|");

const hexBytes = (color: string): [number, number, number] => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
export const CUT_TEXTURE_SIZE = 64;

/** The sRGB RGBA bytes of a miter pattern, supersampled 4 x 4 so the diagonal is smooth. Row 0 is v = 0 (flipY false). */
export function paintCutPattern(edges: readonly CutEdgeColor[], size = CUT_TEXTURE_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * 4), n = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c = cutColorAt(edges, (x + (i + 0.5) / n) / size, (y + (j + 0.5) / n) / size);
      const rgb = hexBytes(c ?? "#000000");
      for (let k = 0; k < 3; k++) sum[k] += rgb[k];
    }
    for (let k = 0; k < 3; k++) data[(y * size + x) * 4 + k] = Math.round(sum[k] / (n * n));
    data[(y * size + x) * 4 + 3] = 255;
  }
  return data;
}

/** A texture of a miter pattern, nearest-free linear filtering; owned (and disposed) by the caller. */
export function cutPatternTexture(edges: readonly CutEdgeColor[]): THREE.DataTexture {
  const texture = new THREE.DataTexture(paintCutPattern(edges), CUT_TEXTURE_SIZE, CUT_TEXTURE_SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
