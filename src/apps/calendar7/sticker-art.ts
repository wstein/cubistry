// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_RULE_PROFILE, type RuleProfile } from "./profile.ts";

/** Sticker artwork of the 7x7 calendar cube: paper, ink colors and the text fitting. DOM-free apart from the 2D context argument. */

/** Printed paper and the plastic body. Fixed in both page themes: the studio backdrop is light in both. */
export const PAPER = "#fffdf6";
export const BLANK_PAPER = "#d9d3c2";
export const PLASTIC = "#23272e";
/** Ink colors on `PAPER`; every one has a contrast of at least 4.5:1 (tests/calendar7-player.test.mjs). */
export const INK_COLORS: Readonly<Record<string, string>> = {
  dark: "#1f2933",
  month: "#8a4a12",
  red: "#b3261e",
  weekday: "#2c4a6b",
};
export const TEXTURE = 192;
/** The text square: the part of the sticker the text may use (the legacy fit uses the same 86%). */
export const TEXT_SQUARE = TEXTURE * 0.86;
/** Noto Sans metrics in em (research glyph-geometry.tsv): digit ink height and digit advance. */
export const EM = { digitInk: 0.735, digitAdvance: 0.572 } as const;
/** Strict split labels: the big first number is lifted by this many texture pixels above the sticker center. */
export const SPLIT_FIRST_LIFT = 18;
/** Strict split labels: the small second number (font size, right edge and baseline, texture pixels). */
export const SPLIT_SECOND_SIZE = 50;
export const SPLIT_SECOND_RIGHT = 178;
export const SPLIT_SECOND_BASELINE = 178;
/** Strict split labels: required minimum ink gap between the two numbers, as a fraction of the texture (12 px at 192 px). */
export const SPLIT_MIN_GAP = 0.0625;
const FONT = '"Counter Sans", "Noto Sans", system-ui, sans-serif';

/** Normal font size of a one-line label by its length (shared by the one-line fit and the big split number). */
export const baseFontSize = (length: number): number => (length === 1 ? 140 : length === 2 ? 110 : 80);

/** One text run of the split layout: font size, anchor and the box its advance occupies (texture pixels, y down). */
export interface SplitPart {
  readonly text: string;
  readonly size: number;
  readonly align: "center" | "right";
  /** Anchor x of `align` and the alphabetic baseline y. */
  readonly x: number;
  readonly baseline: number;
  readonly box: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
}
export interface SplitLayout {
  readonly first: SplitPart;
  readonly second: SplitPart;
}

/** True for a stacked label "a/b" as printed (1 to 2 digits each side). */
export const isSplitLabel = (text: string): boolean => /^[1-9][0-9]?\/[1-9][0-9]?$/.test(text);

/**
 * Layout of a split label (strict profile): the first number at the normal size, centered and
 * lifted, the second number small in the lower right; no slash is drawn and every run is upright.
 * Pure geometry, no context needed. Boxes are digit advance boxes with the digit ink height.
 */
export function splitLayout(text: string): SplitLayout {
  if (!isSplitLabel(text)) throw new Error(`not a split label: ${text}`);
  const [a, b] = text.split("/");
  const part = (t: string, size: number, align: "center" | "right", x: number, baseline: number): SplitPart => {
    const w = t.length * EM.digitAdvance * size;
    const x0 = align === "center" ? x - w / 2 : x - w;
    return { text: t, size, align, x, baseline, box: { x0, y0: baseline - EM.digitInk * size, x1: x0 + w, y1: baseline } };
  };
  const bigSize = baseFontSize(a.length);
  const bigBaseline = TEXTURE / 2 - SPLIT_FIRST_LIFT + (EM.digitInk * bigSize) / 2;
  return {
    first: part(a, bigSize, "center", TEXTURE / 2, bigBaseline),
    second: part(b, SPLIT_SECOND_SIZE, "right", SPLIT_SECOND_RIGHT, SPLIT_SECOND_BASELINE),
  };
}

/** Distance (texture pixels) between the boxes of the two numbers; 0 when they touch or overlap. */
export function splitInkGap(layout: SplitLayout): number {
  const { first: f, second: s } = layout;
  return Math.hypot(
    Math.max(f.box.x0 - s.box.x1, 0, s.box.x0 - f.box.x1),
    Math.max(f.box.y0 - s.box.y1, 0, s.box.y0 - f.box.y1),
  );
}

type Context = Pick<
  CanvasRenderingContext2D,
  "fillStyle" | "fillRect" | "fillText" | "font" | "measureText" | "textAlign" | "textBaseline"
>;

/** Draws one sticker: paper, then the text centered and fitted into the sticker. Blank text is plain blank paper. */
export function drawSticker(
  ctx: Context,
  text: string,
  ink: string,
  profile: RuleProfile = DEFAULT_RULE_PROFILE,
): void {
  ctx.fillStyle = text === "" ? BLANK_PAPER : PAPER;
  ctx.fillRect(0, 0, TEXTURE, TEXTURE);
  if (text === "") return;
  ctx.fillStyle = INK_COLORS[ink] ?? INK_COLORS.dark;
  if (profile === "strict" && isSplitLabel(text)) {
    ctx.textBaseline = "alphabetic";
    const l = splitLayout(text);
    for (const p of [l.first, l.second]) {
      ctx.font = `600 ${p.size}px ${FONT}`;
      ctx.textAlign = p.align;
      ctx.fillText(p.text, p.x, p.baseline);
    }
    return;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const base = baseFontSize(text.length);
  ctx.font = `600 ${base}px ${FONT}`;
  const width = ctx.measureText(text).width;
  const size = Math.floor(Math.min(base, (base * TEXTURE * 0.86) / Math.max(width, 1)));
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.fillText(text, TEXTURE / 2, TEXTURE / 2 + size * 0.04);
}
