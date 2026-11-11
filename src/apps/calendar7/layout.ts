// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Calendar7 front layouts (research candidate, not certified). `standard` is the shipped layout (month letters in row 1,
 * scheme A); `names` is the second mode: the month name in labels in columns 1 to 3 of row 1 and `band` tiles in columns 4
 * to 7, proven for May 2026 to January 2028 only (public/calendar7/names). DOM-free.
 */

export type Layout = "standard" | "names";

/** The URL parameter of the layout (`?layout=names`); every other value is the standard layout. */
export const LAYOUT_PARAM = "layout";

export const parseLayout = (value: string | null | undefined): Layout => (value === "names" ? "names" : "standard");

/**
 * Any-date selection (not a layout of its own: the front is rendered as `names`). `?layout=names-any` shows print B
 * (public/calendar7/names-any) for every date, display only. The `names` layout uses the same display for every month
 * outside its chain window. `parseLayout` never returns it; the dropdown lists the option only while it is selected through the URL.
 */
export type LayoutMode = Layout | "names-any";
export const NAMES_ANY_MODE = "names-any";
export const parseLayoutMode = (value: string | null | undefined): LayoutMode => (value === NAMES_ANY_MODE ? NAMES_ANY_MODE : parseLayout(value));
export const NAMES_ANY_LABEL = "Names (any date, print B, display only)";
export const NAMES_ANY_LOAD_NOTICE = "The names layout data for any date could not be loaded. Showing the standard layout.";
/** Shown for every date displayed from print B (the names layout outside its chain window, and `names-any`). */
export const ANY_DISPLAY_ONLY_NOTICE = "Display only: no move sequence for this date (print B).";
/** Shown when the names data cannot be loaded. */
export const NAMES_LOAD_NOTICE = "The names layout data could not be loaded. Showing the standard layout.";

/** The month names as the tiles of row 1, columns 1 to 3 (owner table of 2026-11-10). */
export const NAME_WORDS: readonly (readonly string[])[] = [
  ["J", "ANU", "ARY"],
  ["FE", "BRU", "ARY"],
  ["MA", "RCH"],
  ["AP", "RIL"],
  ["MA", "Y"],
  ["J", "UNE"],
  ["J", "ULY"],
  ["AUG", "UST"],
  ["SEP", "TEM", "BER"],
  ["OC", "TOB", "ER"],
  ["NOV", "EMB", "ER"],
  ["DEC", "EMB", "ER"],
];

/** Letter slots of a name tile in rendering: every tile is a monospaced grid of three slots. */
export const NAME_SLOTS = 3;

export type NameAlign = "left" | "right" | "center" | "full";

/**
 * Alignment of a name tile by its label alone (a tile moves, so it cannot depend on its position): the first tile of a
 * multi-tile word is right-flush, the last left-flush, a middle tile (and any three-letter tile) full, a single-tile
 * word centered. A label that is no name tile is centered. Built from `NAME_WORDS`; a label used in two roles throws.
 */
const ALIGN = new Map<string, NameAlign>();
for (const word of NAME_WORDS) {
  word.forEach((tile, k) => {
    const role: NameAlign = tile.length === NAME_SLOTS ? "full" : word.length === 1 ? "center" : k === 0 ? "right" : k === word.length - 1 ? "left" : "full";
    if (ALIGN.has(tile) && ALIGN.get(tile) !== role) throw new Error(`name tile ${tile} has two roles`);
    ALIGN.set(tile, role);
  });
}
export const nameAlign = (label: string): NameAlign => ALIGN.get(label) ?? "center";

/**
 * Edge a name tile is anchored to when it is wider than a cubie pitch (a tile on a thick outer layer of the names layout):
 * 1 = its right edge (the first tile of a multi-tile word, also a three-letter one), -1 = its left edge (the last tile),
 * 0 = its center. Anchoring to the shared edge keeps the letter pitch uniform across the tile boundary; the tiles of the
 * first column sit on corner cubies and are always first tiles. Built from `NAME_WORDS`; a label used with two anchors throws.
 */
const ANCHOR = new Map<string, -1 | 0 | 1>();
for (const word of NAME_WORDS) {
  word.forEach((tile, k) => {
    const anchor = word.length === 1 ? 0 : k === 0 ? 1 : k === word.length - 1 ? -1 : 0;
    if (ANCHOR.has(tile) && ANCHOR.get(tile) !== anchor) throw new Error(`name tile ${tile} has two anchors`);
    ANCHOR.set(tile, anchor);
  });
}
export const nameAnchor = (label: string): -1 | 0 | 1 => ANCHOR.get(label) ?? 0;
/** Shift (cubie pitches) of the letters of a tile of width `width` (in cubie pitches) from the 1-wide placement: anchor * (width - 1) / 2. */
export const nameTileShift = (label: string, width: number): number => (nameAnchor(label) * (width - 1)) / 2;

/**
 * Offset of letter `i` of a name tile from the tile center, in cubie pitches (scene units). The slots are thirds of the
 * cubie pitch, so the letter pitch is 1/3 over the whole row of tiles, across tile boundaries too (a middle tile of three
 * letters fills its pitch exactly). The one place of the slot math (sticker art and font art).
 */
export const nameSlotOffset = (label: string, i: number): number => (nameSlotStart(label) + i + 0.5) / NAME_SLOTS - 0.5;

/** First slot (0-based, may be fractional for a centered tile) of the letters of a name tile. */
export function nameSlotStart(label: string): number {
  const n = Math.min(label.length, NAME_SLOTS);
  switch (nameAlign(label)) {
    case "right": return NAME_SLOTS - n;
    case "center": return (NAME_SLOTS - n) / 2;
    default: return 0;
  }
}
