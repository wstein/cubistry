// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Home-face tints of the color scheme "Rubik-Tint" (owner design 2026-11-12). The background of a sticker is a very light tint of
 * the standard Rubik color of its HOME face: the face the sticker lies on in the solved cube, that is its normal in the identity
 * pose of the print (the root pose of the chain). The tint is a property of the stone and travels with it; the print stays black,
 * so the color is a hint and carries no information. Rendering only: print, layout, chain and month list are not touched.
 *
 * The six tints and the thresholds they are gated on come from scripts/calendar7-rubik-tint.mjs (tests/calendar7-rubik-tint.test.mjs).
 */
import { type Pose, type Printing, STICKERS } from "./engine.ts";
import type { Layout } from "./layout.ts";
import { type ColorScheme, namesGround } from "./schemes.ts";
import { tileEdgeColors, tileRoles, type FaceTile } from "./sticker-art.ts";
import type { FaceEdgeColors } from "@cubistry/cube-viewer";

export type HomeFace = "white" | "yellow" | "red" | "orange" | "blue" | "green";

/** The id of the scheme in the catalog. */
export const RUBIK_TINT_ID = "rubik-tint";

/**
 * The assumed orientation, one constant: the home color of each face normal "x,y,z" of the solved cube (front +z, right +x, top +y).
 * White front, red right, blue top. White opposite yellow, red opposite orange, blue opposite green, and the arrangement is the
 * standard cube (white up, green front, red right) turned by a rotation. The owner's wording "white front, green top, red right"
 * is the mirror image of a standard cube (no rotation gives it); with green on top, orange would be on the right.
 */
export const HOME_ORIENTATION: Readonly<Record<string, HomeFace>> = Object.freeze({
  "0,0,1": "white",
  "0,0,-1": "yellow",
  "1,0,0": "red",
  "-1,0,0": "orange",
  "0,1,0": "blue",
  "0,-1,0": "green",
});

/**
 * Tint of each face: the Rubik color mixed into white, with the strengths found by `optimize()` of the script (white 0, yellow 0.19,
 * red 0.13, orange 0.23, blue 0.16, green 0.14). Measured: black #111111 print at least 14.31:1 on every tint and 12.02:1 on every
 * weekend ground, least CIEDE2000 distance of any two tints 10.19, of a weekend ground to the weekday ground of its face 4.10.
 */
export const RUBIK_TINTS: Readonly<Record<HomeFace, string>> = Object.freeze({
  white: "#ffffff",
  yellow: "#fff7cf",
  red: "#f6e0e5",
  orange: "#ffd9c4",
  blue: "#d6e1f2",
  green: "#dbf1e5",
});

/** Share of black mixed into a tint to give the weekend ground (equal to WEEKEND_DARKEN of the measuring script, which the test checks). */
export const HOME_WEEKEND_DARKEN = 0.08;

/** Weekend (red class) ground of a tint: the tint darkened toward black on the neutral scale, per channel rounded like the script. */
export const weekendGroundOf = (tint: string): string =>
  "#" + [1, 3, 5].map((i) => { const v = parseInt(tint.slice(i, i + 2), 16); return Math.round(v + (0 - v) * HOME_WEEKEND_DARKEN).toString(16).padStart(2, "0"); }).join("");

/** Home face of a sticker normal. */
export function homeFaceOfNormal(normal: ArrayLike<number>): HomeFace {
  const face = HOME_ORIENTATION[`${normal[0]},${normal[1]},${normal[2]}`];
  if (!face) throw new RangeError(`not a face normal: ${normal[0]},${normal[1]},${normal[2]}`);
  return face;
}

/** Home face of every sticker (index 0..293) from the identity pose of the print. */
export function homeFacesOf(root: Pose): HomeFace[] {
  return Array.from({ length: STICKERS }, (_, i) => homeFaceOfNormal(root.normal.subarray(3 * i, 3 * i + 3)));
}

/** True for a scheme that colors the stones by their home face. */
export const usesHomeTints = (scheme: ColorScheme): boolean => scheme.id === RUBIK_TINT_ID;

const derived = new WeakMap<ColorScheme, Map<HomeFace, ColorScheme>>();

/**
 * The scheme as one stone of this home face sees it: every ground that is not the month band is the tint of the face, the weekend ground (red class) is that tint darkened. Any other
 * scheme, or an unknown home face, gives the scheme itself.
 */
export function schemeForHome(scheme: ColorScheme, home: HomeFace | undefined): ColorScheme {
  if (!usesHomeTints(scheme) || !home) return scheme;
  let byFace = derived.get(scheme);
  if (!byFace) derived.set(scheme, (byFace = new Map()));
  let s = byFace.get(home);
  if (!s) {
    const tint = RUBIK_TINTS[home];
    byFace.set(home, (s = Object.freeze({ ...scheme, dayFill: tint, emptyFill: tint, weekendFill: weekendGroundOf(tint), weekendTint: null, weekdayRowFill: null })));
  }
  return s;
}

/** Fill of every printed tile (sticker id to color) with the tint of its home face; `homes` is `homeFacesOf(root)`. */
export function faceFillsByHome(printing: Printing, scheme: ColorScheme, layout: Layout, homes: readonly HomeFace[]): Map<number, string> {
  const fills = new Map<number, string>();
  for (let i = 0; i < STICKERS; i++) fills.set(i + 1, tileRoles(schemeForHome(scheme, homes[i]), printing.text[i], printing.ink[i], layout).fill);
  return fills;
}

/** Names layout: the edge colors of the tiles as `faceEdgeFills` gives them, with the tint of the home face as the ground. */
export function faceEdgeFillsByHome(printing: Printing, scheme: ColorScheme, layout: Layout, tiles: readonly (FaceTile | undefined)[], homes: readonly HomeFace[]): Map<number, FaceEdgeColors> {
  const edges = new Map<number, FaceEdgeColors>();
  if (layout !== "names") return edges;
  for (let i = 0; i < STICKERS; i++) {
    const tile = tiles[i];
    if (!tile) continue;
    const s = schemeForHome(scheme, homes[i]);
    const colors = tileEdgeColors(tileRoles(s, printing.text[i], printing.ink[i], layout), namesGround(s.dayFill), tile);
    if (colors) edges.set(i + 1, colors);
  }
  return edges;
}
