/** Color grids: a face background is sampled on an M x M cell grid, then merged into few rects. */
import { toHex, quantize } from "./color.mjs";

/**
 * Normalized sample positions for M cells across a face. The first and last cell sample the exact
 * edge (0 and 1), all others their center. Two faces that share an edge therefore sample the very
 * same panorama position along it, so the edge pixels match by construction.
 */
export function cellPositions(M) {
  return Array.from({ length: M }, (_, i) => (i === 0 ? 0 : i === M - 1 ? 1 : (i + 0.5) / M));
}

/** Number of cells per face: about `target` px per cell, a whole number so cells tile the face exactly. */
export function cellsPerFace(S, target = 5) {
  return Math.max(2, Math.round(S / target));
}

/**
 * Builds a grid by calling fn(s, t) -> [r, g, b] (floats) for every cell; s runs left to right and
 * t top to bottom, both in 0..1 and exact at the border. `step` quantizes channels (default 2/255,
 * invisible in flat vector art, and it lets runs of equal cells merge).
 */
export function buildGrid(M, fn, step = 2) {
  const pos = cellPositions(M);
  const colors = [];
  for (let j = 0; j < M; j++) {
    const row = [];
    for (let i = 0; i < M; i++) row.push(toHex(quantize(fn(pos[i], pos[j]), step)));
    colors.push(row);
  }
  return { M, colors };
}
