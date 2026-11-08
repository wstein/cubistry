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
/** Strict split labels: digit ink height as a fraction of the text square. */
export const SPLIT_DIGIT_FRACTION = 0.35;
/** Strict split labels: slash ink height as a fraction of the text square. */
export const SPLIT_SLASH_FRACTION = 0.24;
/** Strict split labels: the slash center sits this fraction of the texture above the sticker center (0 = centered, equal room to both numbers). */
export const SPLIT_SLASH_LIFT = 0;
/** Strict split labels: required minimum ink gap between the slash stroke and either number, as a fraction of the texture. */
export const SPLIT_MIN_GAP = 0.02;
/** Estimated horizontal stroke thickness of the Noto Sans 600 slash and the side bearing of a digit, in em (conservative). */
export const STROKE_EM = 0.12;
export const DIGIT_BEARING_EM = 0.04;
/** Noto Sans metrics in em (research glyph-geometry.tsv): digit ink height, digit advance, slash ink height and advance. */
export const EM = { digitInk: 0.735, digitAdvance: 0.572, slashInk: 0.722, slashAdvance: 0.399 } as const;
const FONT = '"Counter Sans", "Noto Sans", system-ui, sans-serif';

/** One text run of the diagonal layout: font size, anchor and the box its advance occupies (texture pixels, y down). */
export interface SplitPart {
  readonly text: string;
  readonly size: number;
  readonly align: "left" | "center" | "right";
  /** Anchor x of `align` and the alphabetic baseline y. */
  readonly x: number;
  readonly baseline: number;
  readonly box: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
}
export interface SplitLayout {
  readonly first: SplitPart;
  readonly slash: SplitPart;
  readonly second: SplitPart;
}

/** True for a stacked label "a/b" as printed (1 to 2 digits each side). */
export const isSplitLabel = (text: string): boolean => /^[1-9][0-9]?\/[1-9][0-9]?$/.test(text);

/**
 * Diagonal layout of a split label (strict profile): the first number top-left, the slash in the
 * middle, the second number bottom-right; every part upright (no rotation), digit ink height
 * `SPLIT_DIGIT_FRACTION` of the text square. Pure geometry, no context needed.
 */
export function splitLayout(
  text: string,
  slashFraction: number = SPLIT_SLASH_FRACTION,
  lift: number = SPLIT_SLASH_LIFT,
): SplitLayout {
  if (!isSplitLabel(text)) throw new Error(`not a split label: ${text}`);
  const [a, b] = text.split("/");
  const lo = (TEXTURE - TEXT_SQUARE) / 2;
  const hi = lo + TEXT_SQUARE;
  const digitH = SPLIT_DIGIT_FRACTION * TEXT_SQUARE;
  const size = digitH / EM.digitInk;
  const part = (t: string, align: "left" | "right", x: number, bottom: number): SplitPart => {
    const w = t.length * EM.digitAdvance * size;
    const x0 = align === "left" ? x : x - w;
    return { text: t, size, align, x, baseline: bottom, box: { x0, y0: bottom - digitH, x1: x0 + w, y1: bottom } };
  };
  const slashSize = (slashFraction * TEXT_SQUARE) / EM.slashInk;
  const slashH = slashFraction * TEXT_SQUARE;
  const sw = EM.slashAdvance * slashSize;
  const mid = TEXTURE / 2;
  const midY = mid - lift * TEXTURE;
  return {
    first: part(a, "left", lo, lo + digitH),
    slash: {
      text: "/",
      size: slashSize,
      align: "center",
      x: mid,
      baseline: midY + slashH / 2,
      box: { x0: mid - sw / 2, y0: midY - slashH / 2, x1: mid + sw / 2, y1: midY + slashH / 2 },
    },
    second: part(b, "right", hi, hi),
  };
}

/** Ink-level boxes of a number (digit side bearings removed). */
const numberInk = (p: SplitPart) => {
  const b = DIGIT_BEARING_EM * p.size;
  return { x0: p.box.x0 + b, y0: p.box.y0, x1: p.box.x1 - b, y1: p.box.y1 };
};
/** The slash stroke as a polygon (bottom-left to top-right, `STROKE_EM` thick), texture pixels. */
export function slashStroke(slash: SplitPart): [number, number][] {
  const t = STROKE_EM * slash.size;
  const { x0, y0, x1, y1 } = slash.box;
  const half = (0.384 / 2) * slash.size; // slash ink width 0.384 em, centered on the advance box
  const cx = (x0 + x1) / 2;
  const l = cx - half;
  const r = cx + half;
  return [[l, y1], [l + t, y1], [r, y0], [r - t, y0]];
}
const pointBoxDistance = (x: number, y: number, b: { x0: number; y0: number; x1: number; y1: number }): number =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));
/** Smallest ink distance (texture pixels) from the slash stroke to the first and to the second number. */
export function splitInkGaps(layout: SplitLayout): { first: number; second: number } {
  const poly = slashStroke(layout.slash);
  const edges: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    for (let k = 0; k <= 64; k++) edges.push([ax + ((bx - ax) * k) / 64, ay + ((by - ay) * k) / 64]);
  }
  const gap = (b: { x0: number; y0: number; x1: number; y1: number }) =>
    Math.min(...edges.map(([x, y]) => pointBoxDistance(x, y, b)));
  return { first: gap(numberInk(layout.first)), second: gap(numberInk(layout.second)) };
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
    for (const p of [l.first, l.slash, l.second]) {
      ctx.font = `600 ${p.size}px ${FONT}`;
      ctx.textAlign = p.align;
      ctx.fillText(p.text, p.x, p.baseline);
    }
    return;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const base = text.length === 1 ? 140 : text.length === 2 ? 110 : 80;
  ctx.font = `600 ${base}px ${FONT}`;
  const width = ctx.measureText(text).width;
  const size = Math.floor(Math.min(base, (base * TEXTURE * 0.86) / Math.max(width, 1)));
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.fillText(text, TEXTURE / 2, TEXTURE / 2 + size * 0.04);
}
