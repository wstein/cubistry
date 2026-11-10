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

/** Shown when the names layout is selected but the displayed month is outside its window. */
export const NAMES_NOTICE = "The names layout covers May 2026 to January 2028. Showing the standard layout.";
/** Shown when the names data cannot be loaded. */
export const NAMES_LOAD_NOTICE = "The names layout data could not be loaded. Showing the standard layout.";

/** The month names as the tiles of row 1, columns 1 to 3 (owner table of 2026-11-10). */
export const NAME_WORDS: readonly (readonly string[])[] = [
  ["J", "ANU", "ARY"],
  ["FE", "BRU", "ARY"],
  ["MA", "RCH"],
  ["APR", "IL"],
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

/** Center x of letter `i` of a name tile on the 3-slot grid of a text square `square` wide, centered in a texture `texture` wide. The one place of the slot math (sticker art and font art). */
export const nameSlotCenter = (label: string, i: number, square: number, texture: number): number =>
  texture / 2 - square / 2 + (nameSlotStart(label) + i + 0.5) * (square / NAME_SLOTS);

/** First slot (0-based, may be fractional for a centered tile) of the letters of a name tile. */
export function nameSlotStart(label: string): number {
  const n = Math.min(label.length, NAME_SLOTS);
  switch (nameAlign(label)) {
    case "right": return NAME_SLOTS - n;
    case "center": return (NAME_SLOTS - n) / 2;
    default: return 0;
  }
}
