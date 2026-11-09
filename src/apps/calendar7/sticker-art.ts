// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_RULE_PROFILE, type RuleProfile } from "./profile.ts";
import type { ColorScheme, SchemeLine } from "./schemes.ts";

/** Sticker artwork of the 7x7 calendar cube: paper, ink colors and the text fitting. DOM-free apart from the 2D context argument. */

/**
 * Printed paper and the plastic body. `PAPER`, `BLANK_PAPER` and `INK_COLORS` are the print look WITHOUT a scheme (what
 * `drawSticker` draws when no scheme is passed); the viewer always passes a scheme (default Paper Red). Fixed in both page themes: the studio backdrop is light in both. */
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

/** The role of a tile, decided by its printed label and ink class only, never by where the tile sits (tiles move). */
export type TileClass = "blank" | "day" | "weekend" | "weekday" | "sunsat" | "month";

/** What a scheme gives one tile: ground, ink, ink of the small number of a split label, and the bottom line. */
export interface TileRoles {
  readonly cls: TileClass;
  readonly fill: string;
  readonly ink: string;
  readonly inkSmall: string;
  readonly line: SchemeLine | null;
}

/** Texture pixels per scheme line pixel: scheme widths are pixels of a sheet tile of about 48 px, the texture is 192 px. */
export const LINE_SCALE = 4;

/**
 * Class of a tile from its label and ink. The ink classes are the print's: dark = weekday digits, red = weekend digits
 * and the labels SUN and SAT, weekday = MON..FRI, month = month letters, blank = no text.
 */
export function tileClass(text: string, ink: string): TileClass {
  if (text === "") return "blank";
  if (ink === "month") return "month";
  if (ink === "weekday") return "weekday";
  if (ink === "red") return text === "SUN" || text === "SAT" ? "sunsat" : "weekend";
  return "day";
}

/**
 * Fill and inks of a tile in a scheme. The grounds are the ones tests/calendar7-schemes.test.mjs gates the inks on:
 * weekend digits sit on weekendFill or weekendTint, SUN/SAT on weekdayRowFill, else the weekend ground, month letters on
 * bandFill or dayFill. A blank tile is emptyFill: the print has one blank class, so it cannot join a band (see
 * docs/CALENDAR_7X7.md). The line under the weekday row (lineRow2) is drawn on the weekday-name tiles; lineRow1 is not
 * applied (it needs band tiles).
 */
export function tileRoles(scheme: ColorScheme, text: string, ink: string): TileRoles {
  const cls = tileClass(text, ink);
  const weekend = scheme.weekendFill ?? scheme.weekendTint ?? scheme.dayFill;
  const roles = (fill: string, color: string, small = color, line: SchemeLine | null = null): TileRoles => ({ cls, fill, ink: color, inkSmall: small, line });
  switch (cls) {
    case "blank": return roles(scheme.emptyFill, scheme.dayInk);
    case "day": return roles(scheme.dayFill, scheme.dayInk);
    case "weekday": return roles(scheme.weekdayRowFill ?? scheme.dayFill, scheme.weekdayInk, scheme.weekdayInk, scheme.lineRow2);
    case "sunsat": return roles(scheme.weekdayRowFill ?? weekend, scheme.sunSatInk, scheme.sunSatInk, scheme.lineRow2);
    case "weekend": return roles(weekend, scheme.weekendInk, scheme.weekendInkSmall);
    case "month": return roles(scheme.bandFill ?? scheme.dayFill, scheme.monthInk);
  }
}
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

/**
 * Real ink extents of the digits 6 and 9 in Noto Sans 600, in em (canvas `measureText` actualBoundingBox at 1000 px,
 * baseline alphabetic): ascent and descent about the baseline (the round digits overshoot it) and the horizontal ink
 * extent measured from the left edge of the advance box. The 6 and the 9 differ only in their right edge.
 */
const HALF_TURN_INK: Readonly<Record<string, { ascent: number; descent: number; left: number; right: number }>> = {
  "6": { ascent: 0.735, descent: 0.016, left: 0.031, right: 0.547 },
  "9": { ascent: 0.735, descent: 0.016, left: 0.031, right: 0.532 },
};

/** True for the single digits 6 and 9 in the strict profile: they read as each other after a half turn, so their ink must sit exactly on the sticker center. */
export const isHalfTurnDigit = (text: string, profile: RuleProfile): boolean => profile === "strict" && Object.hasOwn(HALF_TURN_INK, text);

/**
 * Placement of a strict 6 or 9 at font size `size` so that the ink box is centered on the sticker, drawn with
 * `textAlign` "center" and an alphabetic baseline (texture pixels, y down). A half-turned label is shown rotated by 180
 * degrees about the sticker center, so an ink offset d from the center shows as a drift of 2d between the two readings.
 * Pure geometry, like `splitLayout`; `box` is the ink box.
 */
export function halfTurnDigitPlacement(text: string, size: number): { x: number; baseline: number; box: { x0: number; y0: number; x1: number; y1: number } } {
  const ink = Object.hasOwn(HALF_TURN_INK, text) ? HALF_TURN_INK[text] : undefined;
  if (!ink) throw new Error(`not a half-turn digit: ${text}`);
  const baseline = TEXTURE / 2 + ((ink.ascent - ink.descent) * size) / 2;
  // The advance box is centered on x; the ink center sits at (left + right) / 2 inside it.
  const x = TEXTURE / 2 - (((ink.left + ink.right) / 2 - EM.digitAdvance / 2) * size);
  const w = EM.digitAdvance * size;
  const x0 = x - w / 2;
  return { x, baseline, box: { x0: x0 + ink.left * size, y0: baseline - ink.ascent * size, x1: x0 + ink.right * size, y1: baseline + ink.descent * size } };
}

type Context = Pick<
  CanvasRenderingContext2D,
  "fillStyle" | "fillRect" | "fillText" | "font" | "measureText" | "textAlign" | "textBaseline"
>;

/**
 * Draws one sticker: paper, then the text centered and fitted into the sticker. Blank text is plain blank paper.
 * Without `scheme` the print look (`PAPER`, `BLANK_PAPER`, `INK_COLORS`) is drawn; with one, `tileRoles` gives the fill,
 * the inks and the weekday-row line (a bottom edge line on the sticker).
 */
export function drawSticker(
  ctx: Context,
  text: string,
  ink: string,
  profile: RuleProfile = DEFAULT_RULE_PROFILE,
  scheme?: ColorScheme,
): void {
  paintSticker(ctx, text, ink, profile, scheme ? tileRoles(scheme, text, ink) : null, true);
}

function paintSticker(ctx: Context, text: string, ink: string, profile: RuleProfile, roles: TileRoles | null, edgeLine: boolean): void {
  ctx.fillStyle = roles ? roles.fill : text === "" ? BLANK_PAPER : PAPER;
  ctx.fillRect(0, 0, TEXTURE, TEXTURE);
  if (text === "") return;
  const big = roles ? roles.ink : (INK_COLORS[ink] ?? INK_COLORS.dark);
  ctx.fillStyle = big;
  if (profile === "strict" && isSplitLabel(text)) {
    ctx.textBaseline = "alphabetic";
    const l = splitLayout(text);
    for (const p of [l.first, l.second]) {
      ctx.font = `600 ${p.size}px ${FONT}`;
      ctx.textAlign = p.align;
      if (roles) ctx.fillStyle = p === l.first ? roles.ink : roles.inkSmall;
      ctx.fillText(p.text, p.x, p.baseline);
    }
  } else {
    ctx.textAlign = "center";
    const exact = isHalfTurnDigit(text, profile);
    ctx.textBaseline = exact ? "alphabetic" : "middle";
    const base = baseFontSize(text.length);
    ctx.font = `600 ${base}px ${FONT}`;
    const width = ctx.measureText(text).width;
    const size = Math.floor(Math.min(base, (base * TEXTURE * 0.86) / Math.max(width, 1)));
    ctx.font = `600 ${size}px ${FONT}`;
    if (exact) {
      const at = halfTurnDigitPlacement(text, size);
      ctx.fillText(text, at.x, at.baseline);
    } else ctx.fillText(text, TEXTURE / 2, TEXTURE / 2 + size * 0.04);
  }
  if (roles?.line && edgeLine) {
    const h = roles.line.px * LINE_SCALE;
    ctx.fillStyle = roles.line.color;
    ctx.fillRect(0, TEXTURE - h, TEXTURE, h);
  }
}

/**
 * Stickerless surface: how the label is placed on the cubie face instead of on a sticker.
 *
 * The body face texture (the 0..1 UV square of the rounded body) is flat only in its middle: the flat part spans
 * `FACE_FLAT` of the texture, centered, the rest wraps the bevel around the cubie. The label is the same drawing
 * as on a sticker (`drawSticker`: same sizes, fit, split labels, 6/9 rule) scaled about the center by `FACE_SCALE`,
 * so its text square covers `FACE_TEXT_SQUARE` (0.92) of the flat face; the paper fills the whole texture, so
 * there is no gap and no sticker edge. The value is checked against the real body geometry in
 * tests/calendar7-stickerless.test.mjs (preset body width .99, radius .055, one bevel segment).
 */
export const FACE_FLAT = 0.9106;
/**
 * The text square of a face label as a fraction of the flat face (a sticker label uses 0.86 of its sticker).
 * Measured with real Noto Sans 600 on candidates 0.86, 0.92 and 0.97: the ink margin to the flat-face edge of the
 * three-letter labels (VEM, EMB, BER, MON, WED, WWW) is at least 7.1%, 4.2% and 1.4% of the flat width; 0.92 is the
 * largest candidate with at least 4% on every side (VEM is the tightest, 4.2% on the left).
 */
export const FACE_TEXT_SQUARE = 0.92;
/** Scale of the sticker label about the texture center: the 86% text square becomes `FACE_TEXT_SQUARE` of the flat face. */
export const FACE_SCALE = (FACE_FLAT * FACE_TEXT_SQUARE) / 0.86;
/** How the 3D view draws the labels: on sticker bodies (scheme A, default) or directly on the cubie faces. */
export type Surface = "sticker" | "face";

type FaceContext = Context & Pick<CanvasRenderingContext2D, "save" | "restore" | "translate" | "scale">;

/**
 * Draws one cubie face: the ground on the whole texture, then the sticker label scaled about the center by `FACE_SCALE`.
 * With a `scheme` the weekday-row line sits on the bottom edge of the flat face, not of the scaled sticker square.
 */
export function drawFace(
  ctx: FaceContext,
  text: string,
  ink: string,
  profile: RuleProfile = DEFAULT_RULE_PROFILE,
  scheme?: ColorScheme,
): void {
  const roles = scheme ? tileRoles(scheme, text, ink) : null;
  ctx.fillStyle = roles ? roles.fill : text === "" ? BLANK_PAPER : PAPER;
  ctx.fillRect(0, 0, TEXTURE, TEXTURE);
  ctx.save();
  ctx.translate(TEXTURE / 2, TEXTURE / 2);
  ctx.scale(FACE_SCALE, FACE_SCALE);
  ctx.translate(-TEXTURE / 2, -TEXTURE / 2);
  // paintSticker paints the same ground again over the scaled square (same color), then the label.
  paintSticker(ctx, text, ink, profile, roles, false);
  ctx.restore();
  if (roles?.line) {
    const h = roles.line.px * LINE_SCALE;
    const edge = TEXTURE * ((1 + FACE_FLAT) / 2);
    ctx.fillStyle = roles.line.color;
    ctx.fillRect(TEXTURE * ((1 - FACE_FLAT) / 2), edge - h, TEXTURE * FACE_FLAT, h);
  }
}
