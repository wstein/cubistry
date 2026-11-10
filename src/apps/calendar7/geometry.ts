// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Layout } from "./layout.ts";

/**
 * Body geometry of the cubies. The scene has no physical unit: the cubie pitch (center to center) is 1 scene unit. The
 * standard layout keeps the shipped body width .99 (PRESENTATION_PRESET.bodyWidth, a gap of .01 units). The names layout
 * sets the gap between cubies to 0.01 mm (never 0: no overlap, no z-fighting).
 */
export const STANDARD_BODY_WIDTH = 0.99;
/**
 * Assumed edge length of a cubie in mm, to state the gap in mm: the 16 mm calendar print preset of docs/PRINT_STICKERS.md
 * (an example size, not measured on a real cube). The names layout gap in scene units follows from it.
 */
export const CUBIE_PITCH_MM = 16;
/** Gap between neighboring cubies of the names layout in mm. */
export const NAMES_GAP_MM = 0.01;
/** The same gap in scene units: 0.01 mm / 16 mm = 0.000625. */
export const NAMES_GAP = NAMES_GAP_MM / CUBIE_PITCH_MM;
/** Body width of the names layout: the cubie pitch (1) minus the gap. */
export const NAMES_BODY_WIDTH = 1 - NAMES_GAP;
/**
 * Texture pixels (of 192) per scene unit across the flat part of a body face of the names layout, measured on
 * RoundedBoxGeometry(NAMES_BODY_WIDTH, one bevel segment, radius .055); tests/calendar7-names-look.test.mjs checks it.
 */
export const NAMES_FACE_PX_PER_UNIT = 196.77;

export const bodyWidthFor = (layout: Layout): number => (layout === "names" ? NAMES_BODY_WIDTH : STANDARD_BODY_WIDTH);
