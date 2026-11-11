// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Layout } from "./layout.ts";

/**
 * Body geometry of the cubies. The scene has no physical unit: the standard layout has a cubie pitch (center to center) of
 * 1 scene unit and keeps the shipped body width .99 (PRESENTATION_PRESET.bodyWidth, a gap of .01 units). The names layout
 * uses the layer-width profile below (thicker outer layers); its unit is the width of an inner layer. It sets the gap
 * between cubies to 0.01 mm (never 0: no overlap, no z-fighting).
 */
export const STANDARD_BODY_WIDTH = 0.99;

/**
 * Width of the two outer layers of an N-cube relative to an inner layer (1): real big cubes have thicker outer layers
 * (the corners must keep contact at 45 degree turns). ESTIMATES, to be replaced by caliper measurements of real cubes:
 * N = 2, 3, 4: 1.0 (owner decision 2026-11-10); N = 5: 1.2 and N = 7: 1.8 (owner estimates); N = 6: 1.5 is a PROPOSAL
 * (UNKNOWN, between the 5 and the 7). This is the one table; change a value here only.
 */
export const OUTER_LAYER_WIDTH: Readonly<Record<number, number>> = Object.freeze({ 2: 1, 3: 1, 4: 1, 5: 1.2, 6: 1.5, 7: 1.8 });
export const outerLayerWidth = (n: number): number => {
  const f = OUTER_LAYER_WIDTH[n];
  if (f === undefined) throw new Error(`No outer layer width for N = ${n}`);
  return f;
};
/** Layer widths of an N-cube, in units of an inner layer: [f, 1, ..., 1, f]. */
export const layerWidthsFor = (n: number): number[] =>
  Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1 ? outerLayerWidth(n) : 1));
/** Bevel radius of the body geometry: PRESENTATION_PRESET.bodyRadius (tests/calendar7-layer-widths.test.mjs compares them; this module stays free of three.js, the 2D sheet imports it). */
export const BODY_RADIUS = 0.055;
/** The Calendar7 cube is a 7x7. */
export const CALENDAR7_SIZE = 7;
/** Total edge of the 7x7 in units of an inner layer: (N - 2) + 2 f = 5 + 2 * 1.8 = 8.6. */
export const NAMES_CUBE_EDGE = layerWidthsFor(CALENDAR7_SIZE).reduce((sum, w) => sum + w, 0);
/**
 * Physical edge of the 7x7 in mm: the middle of the 61.5 to 70 mm range of common 7x7 cubes (an assumption, not measured on
 * the owner's cube). The names layout states its gap in mm with it.
 */
export const CUBE_EDGE_MM_7X7 = 66.5;
/** Edge of an inner cubie in mm: 66.5 / (5 + 2 f) = 66.5 / 8.6 = 7.7326 mm. */
export const INNER_CUBIE_EDGE_MM = CUBE_EDGE_MM_7X7 / NAMES_CUBE_EDGE;
/** Gap between neighboring cubies of the names layout in mm. */
export const NAMES_GAP_MM = 0.01;
/** The same gap in scene units (inner layer = 1): 0.01 mm / 7.7326 mm = 0.0012932. */
export const NAMES_GAP = NAMES_GAP_MM / INNER_CUBIE_EDGE_MM;
/** Body width of an inner cubie of the names layout: the width 1 minus the gap. */
export const NAMES_BODY_WIDTH = 1 - NAMES_GAP;
/** Body size of a names-layout cubie with the layer widths `cell`: every width minus the gap. */
export const namesBodySize = (cell: readonly number[]): [number, number, number] => cell.map(w => w - NAMES_GAP) as [number, number, number];
/** Bevel radius of a body (the preset's, but never more than half of the thinnest side, as RoundedBoxGeometry clamps it). */
export const bevelRadius = (width: number): number => Math.min(BODY_RADIUS, width / 2);
/**
 * Texture pixels per scene unit across the flat part of a body face of an extent `w` (in inner layers) whose texture is
 * `pixels` wide. RoundedBoxGeometry (one bevel segment) maps the texture along the arc length: the face is `L - (2 - pi/2) r`
 * long in uv space, so px per unit = pixels / (L - (2 - pi/2) r) with L = w - gap. tests/calendar7-layer-widths.test.mjs
 * measures it on the real geometry.
 */
export const facePixelsPerUnit = (w: number, pixels: number): number => {
  const length = w - NAMES_GAP;
  return pixels / (length - (2 - Math.PI / 2) * bevelRadius(length));
};
/** Share of the texture (along one axis) that is the flat part of the face: (L - 2 r) / (L - (2 - pi/2) r). */
export const faceFlatShare = (w: number): number => {
  const length = w - NAMES_GAP, r = bevelRadius(length);
  return (length - 2 * r) / (length - (2 - Math.PI / 2) * r);
};
/** Texture pixels of a 1 x 1 face of the names layout: 192 / (L - (2 - pi/2) r) = 196.9. */
export const NAMES_FACE_PX_PER_UNIT = facePixelsPerUnit(1, 192);

/**
 * Size of the face of a sticker on its cubie, in inner layers: `w` along the sticker's right axis (up x normal) and `h`
 * along its up axis, each the width of the layer the cubie sits in on that axis (`pos`, `normal`, `up`: the sticker's
 * three integer vectors at the pose the cube is built from; the layer coordinate p is -3..3 for the 7x7).
 */
export function faceTileOf(pos: ArrayLike<number>, normal: ArrayLike<number>, up: ArrayLike<number>, widths: readonly number[]): { w: number; h: number } {
  const right = [up[1] * normal[2] - up[2] * normal[1], up[2] * normal[0] - up[0] * normal[2], up[0] * normal[1] - up[1] * normal[0]];
  const widthAlong = (v: ArrayLike<number>): number => {
    const axis = [0, 1, 2].find(a => v[a] !== 0);
    const index = axis === undefined ? NaN : pos[axis] + (widths.length - 1) / 2;
    if (!Number.isInteger(index) || index < 0 || index >= widths.length) throw new Error("Sticker outside the layer profile");
    return widths[index];
  };
  return { w: widthAlong(right), h: widthAlong(up) };
}

export const bodyWidthFor = (layout: Layout): number => (layout === "names" ? NAMES_BODY_WIDTH : STANDARD_BODY_WIDTH);
/** Layer widths of the Calendar7 cube per layout: the standard layout has none (unit pitch), the names layout the thick outer layers. */
export const layerWidthsOf = (layout: Layout): number[] | null => (layout === "names" ? layerWidthsFor(CALENDAR7_SIZE) : null);
/** Half the edge of the cube in scene units (camera, studio): 3.5 in the standard layout, 4.3 in the names layout. */
export const halfEdgeOf = (layout: Layout): number => (layout === "names" ? NAMES_CUBE_EDGE / 2 : CALENDAR7_SIZE / 2);

/**
 * Tone mapping of the renderer. The standard layout and every other app keep the shared presentation value (Neutral tone
 * mapping, exposure 1). The names layout reproduces its color tokens on screen, with the paper white as the reference:
 * - Linear tone mapping (the exposure scales the linear color, clipped at 1; three.js ignores the exposure without any tone
 *   mapping). Neutral compresses every channel above 0.76 and then mixes the color toward white, so a saturated red at the
 *   raised exposure that makes white read white came out as #f85759 instead of #e0282c;
 * - the exposure follows the face that looks at the camera (names-exposure.ts): the inverse of the radiance a white diffuse
 *   surface gets there, 1.217 head on at the shared presentation lights;
 * - the shared plastic (specular 1, clearcoat 0.18) adds about 1.3% linear white to every color (#e0282c rendered #e1373a), so
 *   the names layout has its own shading: plasticity (names-plasticity.ts, default 0.6) scales specular, clearcoat and face
 *   shadows from none (0, flat and exact) up, and the exposure gives back what the shading takes. The standard layout keeps
 *   its gloss.
 */
export const STANDARD_EXPOSURE = 1;
