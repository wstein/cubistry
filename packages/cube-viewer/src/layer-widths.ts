// SPDX-License-Identifier: AGPL-3.0-or-later
import { demand } from "@cubistry/cube-core";

/**
 * Layer-width profile of an N-cube: the width of each of the N layers, in scene units, the same in every axis. The default
 * profile of the viewer is `uniformLayerWidths` (every layer 1), which is the historical unit pitch.
 *
 * Real big cubes have thicker outer layers (the corners must keep contact at 45 degree turns). A profile
 * `[f, 1, ..., 1, f]` gives corners f x f x f, outer-ring pieces on a face 1 x f and inner pieces 1 x 1.
 */
export type LayerWidths = readonly number[];

export const uniformLayerWidths = (n: number): number[] => {
  demand(Number.isInteger(n) && n >= 1, "Invalid layer count");
  return Array<number>(n).fill(1);
};

/** Widths `[outer, 1, ..., 1, outer]`; for n = 1 the single layer is 1, for n = 2 both layers are `outer`. */
export function thickOuterLayerWidths(n: number, outer: number): number[] {
  demand(Number.isFinite(outer) && outer >= 1, "Invalid outer layer width");
  const widths = uniformLayerWidths(n);
  if (n >= 2) { widths[0] = outer; widths[n - 1] = outer; }
  return widths;
}

export function validateLayerWidths(widths: LayerWidths): void {
  demand(widths.length >= 1 && widths.every(w => Number.isFinite(w) && w > 0), "Invalid layer widths");
}

/** Edge length of the whole cube: the sum of the widths. */
export const layerEdge = (widths: LayerWidths): number => widths.reduce((sum, w) => sum + w, 0);

/** The N + 1 cut planes along an axis (cube centered at 0): plane k lies between layer k - 1 and layer k. */
export function layerPlanes(widths: LayerWidths): number[] {
  validateLayerWidths(widths);
  const planes = [-layerEdge(widths) / 2];
  for (const w of widths) planes.push(planes[planes.length - 1] + w);
  return planes;
}

/** Center of every layer along an axis (cube centered at 0). */
export function layerCenters(widths: LayerWidths): number[] {
  const planes = layerPlanes(widths);
  return widths.map((_, i) => (planes[i] + planes[i + 1]) / 2);
}

/**
 * Layer index 0..N-1 of the layer coordinate `p` of the mechanics (unit steps, centered: -3..3 for N = 7, half integers
 * -2.5..2.5 for N = 6). Anything else is an error.
 */
export function layerIndexOf(n: number, p: number): number {
  const index = p + (n - 1) / 2;
  demand(Math.abs(index - Math.round(index)) < 1e-9 && Math.round(index) >= 0 && Math.round(index) < n, "Layer coordinate outside the cube");
  return Math.round(index);
}
