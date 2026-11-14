// SPDX-License-Identifier: AGPL-3.0-or-later
import { IMAGE_UPS } from "./display.ts";
import { DEFAULT_RULE_PROFILE, type RuleProfile } from "./profile.ts";
import { type Layout, NAME_SLOTS, nameSlotOffset, type NameWords, NAME_WORDS, nameSlotStart, nameTileShift } from "./layout.ts";
import { type FaceBands, faceFlatShare, facePixelsPerUnit, faceVisibleShare, monthBanner, nameAboveShare, NAMES_BANNER_BOTTOM_OFFSET, NAMES_BANNER_HEIGHT, NAMES_BANNER_OVERHANG, NAMES_BANNER_RADIUS, NAMES_BANNER_THIN_TILE_TOP, NAMES_FACE_PX_PER_UNIT, NAMES_WEEKDAY_DOWN, outerLayerWidth, CALENDAR7_SIZE } from "./geometry.ts";
import { type ColorScheme, namesGround, type ResolvedBannerStyle, type SchemeLine, underlineInk } from "./schemes.ts";

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
export type TileClass = "blank" | "band" | "day" | "weekend" | "weekday" | "sunsat" | "month";

/** What a scheme gives one tile: ground, ink, ink of the small number of a split label, and the bottom line. */
export interface TileRoles {
  readonly cls: TileClass;
  readonly fill: string;
  readonly ink: string;
  readonly inkSmall: string;
  readonly line: SchemeLine | null;
  /** Names-face artwork only; absent on the historical sheet and unmodified palettes. */
  readonly banner?: { readonly style: ResolvedBannerStyle; readonly outline: SchemeLine | null };
}

/** Texture pixels per scheme line pixel: scheme widths are pixels of a sheet tile of about 48 px, the texture is 192 px. */
export const LINE_SCALE = 4;
/** Names layout: the lines under row 1 and the weekday row are this many times as thick as in the standard layout. */
export const NAMES_LINE_FACTOR = 1.5;

/**
 * Size of a tile on a cubie face of the names layout, in widths of an inner layer (the layer-width profile makes outer
 * tiles larger): `w` along the texture x axis (sticker right), `h` along y (sticker up). No tile means 1 x 1.
 */
export interface FaceTile {
  readonly w: number;
  readonly h: number;
  /**
   * Unit grid (names layout): the bands of the outer layers, in units, per side (`faceBandsOf`). The content is the unit cell
   * on the inner side of the tile; the bands are white margin. Without bands the whole tile is the content cell.
   */
  readonly band?: FaceBands;
}
const NO_BAND: FaceBands = { l: 0, r: 0, t: 0, b: 0 };
const hasBand = (tile?: FaceTile): boolean => !!tile?.band && (tile.band.l > 0 || tile.band.r > 0 || tile.band.t > 0 || tile.band.b > 0);
/** A rectangle in canvas pixels (y down). */
export interface PxRect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }
/**
 * The unit cell of a tile on its canvas: its center (`cx`, `cy`) and its rectangle (`cell`: a side with a band ends at the cell
 * edge, a side without one at the canvas edge; the face is flat inside, so the cell edge is exact there), with the canvas pixels
 * per unit along both axes (`px`, `py`: the flat part of the real face). `banner`: the red banner of the month row (horizontally inset
 * by `NAMES_BANNER_OVERHANG` beyond the unit cell on a side with a band; vertically `NAMES_BANNER_HEIGHT` high, its bottom `NAMES_BANNER_BOTTOM_OFFSET` above the lower edge of the tile; a tile that is not in the thick month row (height other than `outer`) keeps a top margin of `NAMES_BANNER_THIN_TILE_TOP`). The rectangle is not clipped: it can reach beyond the canvas (a small outer factor), the canvas clips it.
 */
export function tileGrid(tile?: FaceTile, outer: number = outerLayerWidth(CALENDAR7_SIZE)): { W: number; H: number; px: number; py: number; cx: number; cy: number; cell: PxRect; banner: PxRect } {
  const [W, H] = tileCanvasSize(tile), t = tile ?? { w: 1, h: 1 }, b = t.band ?? NO_BAND;
  const px = facePixelsPerUnit(t.w, W), py = facePixelsPerUnit(t.h, H);
  const cell = { x0: b.l > 0 ? W / 2 - (t.w / 2 - b.l) * px : 0, x1: b.r > 0 ? W / 2 + (t.w / 2 - b.r) * px : W, y0: b.t > 0 ? H / 2 - (t.h / 2 - b.t) * py : 0, y1: b.b > 0 ? H / 2 + (t.h / 2 - b.b) * py : H };
  const yBottom = H / 2 + (t.h / 2 - NAMES_BANNER_BOTTOM_OFFSET) * py;
  const banner = { x0: b.l > 0 ? cell.x0 - NAMES_BANNER_OVERHANG * px : 0, x1: b.r > 0 ? cell.x1 + NAMES_BANNER_OVERHANG * px : W, y0: t.h === outer ? yBottom - NAMES_BANNER_HEIGHT * py : H / 2 - (t.h / 2 - NAMES_BANNER_THIN_TILE_TOP) * py, y1: yBottom };
  return { W, H, px, py, cx: W / 2 + (b.l - b.r) / 2 * px, cy: H / 2 + (b.t - b.b) / 2 * py, cell, banner };
}
/** Tile classes drawn as the red banner of the month row (names layout). */
export const isBannerClass = (cls: TileClass): boolean => cls === "month" || cls === "band";
type GroundContext = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect"> & Partial<Pick<CanvasRenderingContext2D, "beginPath" | "roundRect" | "fill">>;
interface BannerShape { readonly rect: PxRect; readonly radii: readonly [number, number, number, number]; readonly color: string }
/** Outer and inner shapes share the existing banner bounds and font placement. */
function bannerShapes(roles: TileRoles, tile: FaceTile, outer: number = outerLayerWidth(CALENDAR7_SIZE)): readonly BannerShape[] {
  const g = tileGrid(tile, outer), r = g.banner, b = tile.band ?? NO_BAND;
  const radius = roles.banner?.style === "square" || roles.banner?.style === "boxed" ? 0 : NAMES_BANNER_RADIUS * g.px;
  const radii = (rad: number): [number, number, number, number] => [b.l > 0 ? rad : 0, b.r > 0 ? rad : 0, b.r > 0 ? rad : 0, b.l > 0 ? rad : 0];
  const shape = (rect: PxRect, rad: number, color: string): BannerShape => {
    const corners = radii(rad), w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
    // Canvas roundRect scales all radii together when the corner sums exceed an edge.
    const limit = (length: number, sum: number): number => sum > 0 ? length / sum : 1;
    const factor = Math.min(1, limit(w, corners[0] + corners[1]), limit(w, corners[2] + corners[3]), limit(h, corners[0] + corners[3]), limit(h, corners[1] + corners[2]));
    return { rect, radii: corners.map(v => v * factor) as [number, number, number, number], color };
  };
  const outline = roles.banner?.outline;
  if (!outline) return [shape(r, radius, roles.fill)];
  const thickness = outline.px * LINE_SCALE * NAMES_LINE_FACTOR;
  return [
    shape(r, radius, outline.color),
    shape({ x0: b.l > 0 ? r.x0 + thickness : r.x0 - 1, x1: b.r > 0 ? r.x1 - thickness : r.x1 + 1, y0: r.y0 + thickness, y1: r.y1 - thickness }, Math.max(0, radius - thickness), roles.fill),
  ];
}
function paintShape(ctx: GroundContext, shape: BannerShape): void {
  const { rect: r, radii, color } = shape;
  ctx.fillStyle = color;
  if (radii.some(v => v > 0) && ctx.roundRect && ctx.beginPath && ctx.fill) {
    ctx.beginPath(); ctx.roundRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, [...radii]); ctx.fill();
  } else ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
}
/**
 * Names layout, ground of a tile of the unit grid: the white margin (the paper ground of the scheme) on the whole tile, then
 * the fill of the tile on its unit cell only (a weekend tint stays on the cell), in the month row the red banner (inset from
 * the left and right cube edges by the bands, a white strip at the top and the bottom). A tile without bands and without a
 * banner is one fill of the whole canvas.
 */
export function paintTileGround(ctx: GroundContext, roles: TileRoles, scheme: ColorScheme, tile: FaceTile): void {
  const g = tileGrid(tile), banner = isBannerClass(roles.cls), r = banner ? g.banner : g.cell;
  if (!banner && !hasBand(tile)) { ctx.fillStyle = roles.fill; ctx.fillRect(0, 0, g.W, g.H); return; }
  ctx.fillStyle = namesGround(scheme.dayFill);
  ctx.fillRect(0, 0, g.W, g.H);
  if (banner && roles.banner) {
    if (roles.banner.style !== "underline") for (const shape of bannerShapes(roles, tile)) paintShape(ctx, shape);
    return;
  }
  ctx.fillStyle = roles.fill;
  const rad = banner ? NAMES_BANNER_RADIUS * g.px : 0, b = tile.band ?? NO_BAND; // rounded outer corners of the banner (variant), only at a cube edge
  if (rad > 0 && ctx.roundRect && ctx.beginPath && ctx.fill && (b.l > 0 || b.r > 0)) {
    ctx.beginPath();
    ctx.roundRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, [b.l > 0 ? rad : 0, b.r > 0 ? rad : 0, b.r > 0 ? rad : 0, b.l > 0 ? rad : 0]);
    ctx.fill();
  } else ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
}
/** One stretch of an edge of a tile up to the fraction `to` (0..1) of its length, and the color there. */
export interface TileEdgeStop { readonly to: number; readonly color: string }
export type TileEdgeColors = Partial<Record<"left" | "right" | "top" | "bottom", string | readonly TileEdgeStop[]>>;
/**
 * The colors along the four edges of a tile of the names layout, as drawn by `paintTileGround` (what a cut face next to the edge
 * must show): a side edge runs bottom to top, a top or bottom edge left to right. An edge that lies in the white margin is
 * the ground, an edge along the fill is changing between the ground and the fill where the fill rectangle (the unit cell or the
 * banner) starts and ends; the rounded banner corner is not part of it (the banner rectangle reaches a tile edge only at an outer factor from 1.3 to 1.6, reachable by `?outer` only, where the corner pixels at the edge are ground). null when the whole tile edge is the fill (a tile without bands or banner): the face color applies.
 */
export function tileEdgeColors(roles: TileRoles, ground: string, tile: FaceTile, outer: number = outerLayerWidth(CALENDAR7_SIZE)): TileEdgeColors | null {
  const g = tileGrid(tile, outer), banner = isBannerClass(roles.cls), r = banner ? g.banner : g.cell;
  if (banner && roles.banner && roles.banner.style !== "underline") return bannerEdgeColors(roles, ground, tile, outer);
  const lr = roles.line ? lineRect(roles.line, "names", true, tile, banner, outer) : null; // the line runs over the edge where it reaches the tile edge
  if (!banner && !hasBand(tile) && !lr) return null;
  const along = (lo: number, hi: number, size: number): string | readonly TileEdgeStop[] => {
    const stops = [{ to: lo / size, color: ground }, { to: hi / size, color: roles.fill }, { to: 1, color: ground }].filter((s, i, all) => s.to > (i === 0 ? 0 : all[i - 1].to) + 1e-9);
    return stops.length === 1 ? stops[0].color : stops;
  };
  const up = along(g.H - r.y1, g.H - r.y0, g.H), right = along(r.x0, r.x1, g.W); // up: from the bottom of the face, right: from the left
  const withLine = (edge: string | readonly TileEdgeStop[], reaches: boolean): string | readonly TileEdgeStop[] => {
    if (!lr || !reaches) return edge;
    const a = (g.H - (lr.y + lr.h)) / g.H, b = (g.H - lr.y) / g.H, color = roles.line!.color, base: readonly TileEdgeStop[] = typeof edge === "string" ? [{ to: 1, color: edge }] : edge;
    const colorAt = (t: number): string => (base.find((x) => t <= x.to + 1e-12) ?? base[base.length - 1]).color;
    const cuts = [...new Set([...base.map((x) => x.to), a, b, 1])].filter((t) => t > 1e-9 && t <= 1 + 1e-12).sort((p, q) => p - q);
    const out: TileEdgeStop[] = [];
    let from = 0;
    for (const t of cuts) { const mid = (from + t) / 2, c = mid > a && mid < b ? color : colorAt(mid); if (out.length && out[out.length - 1].color === c) out[out.length - 1] = { to: t, color: c }; else out.push({ to: t, color: c }); from = t; }
    return out.length === 1 ? out[0].color : out;
  };
  return { left: r.x0 > 0 ? ground : withLine(up, lr !== null && lr.x <= 0.5), right: r.x1 < g.W ? ground : withLine(up, lr !== null && lr.x + lr.w >= g.W - 0.5), top: r.y0 > 0 ? ground : right, bottom: r.y1 < g.H ? ground : right };
}

/** Exact intersections of the drawn rounded rectangles with each physical tile edge. */
function bannerEdgeColors(roles: TileRoles, ground: string, tile: FaceTile, outer: number): TileEdgeColors {
  const g = tileGrid(tile, outer), shapes = bannerShapes(roles, tile, outer);
  const inside = (shape: BannerShape, x: number, y: number): boolean => {
    const { x0, x1, y0, y1 } = shape.rect;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const corners = [[x0, y0, shape.radii[0], 1, 1], [x1, y0, shape.radii[1], -1, 1], [x1, y1, shape.radii[2], -1, -1], [x0, y1, shape.radii[3], 1, -1]];
    return corners.every(([cx, cy, rad, sx, sy]) => !rad || (x - cx) * sx >= rad || (y - cy) * sy >= rad || Math.hypot(x - cx - sx * rad, y - cy - sy * rad) <= rad);
  };
  const edge = (vertical: boolean, fixed: number, size: number, reverse: boolean): string | readonly TileEdgeStop[] => {
    const cuts = [0, size];
    for (const { rect: r, radii } of shapes) {
      cuts.push(...(vertical ? [r.y0, r.y1] : [r.x0, r.x1]));
      for (const [cx, cy, rad] of [[r.x0 + radii[0], r.y0 + radii[0], radii[0]], [r.x1 - radii[1], r.y0 + radii[1], radii[1]], [r.x1 - radii[2], r.y1 - radii[2], radii[2]], [r.x0 + radii[3], r.y1 - radii[3], radii[3]]]) {
        const distance = fixed - (vertical ? cx : cy);
        if (rad > 0 && Math.abs(distance) <= rad) {
          const delta = Math.sqrt(Math.max(0, rad * rad - distance * distance));
          cuts.push((vertical ? cy : cx) - delta, (vertical ? cy : cx) + delta);
        }
      }
    }
    const sorted = [...new Set(cuts.map(v => reverse ? size - v : v).filter(v => v >= 0 && v <= size))].sort((a, b) => a - b), stops: TileEdgeStop[] = [];
    for (let i = 1; i < sorted.length; i++) {
      let at = (sorted[i - 1] + sorted[i]) / 2;
      if (reverse) at = size - at;
      const x = vertical ? fixed : at, y = vertical ? at : fixed;
      let color = ground;
      for (const shape of shapes) if (inside(shape, x, y)) color = shape.color;
      const to = sorted[i] / size;
      if (stops.at(-1)?.color === color) stops[stops.length - 1] = { to, color };
      else stops.push({ to, color });
    }
    return stops.length === 1 ? stops[0].color : stops;
  };
  return { left: edge(true, 0, g.H, true), right: edge(true, g.W, g.H, true), top: edge(false, 0, g.W, false), bottom: edge(false, g.H, g.W, false) };
}
/** Weekday words (SUN to SAT) of a tile of the unit grid sit `NAMES_WEEKDAY_DOWN` below the cell center: the vertical shift in drawing px. */
export const weekdayShift = (cls: TileClass): number => (cls === "weekday" || cls === "sunsat" ? NAMES_WEEKDAY_DOWN * namePxPerUnit() : 0);
/**
 * Vertical center of the month name in the cell frame (units above the unit cell center): the free height of the banner is
 * split with `nameAboveShare` above the ink (2/3 with square banner corners, 1/2 centered with rounded ones), `capUnits` is the ink height.
 */
export const nameCenterUp = (capUnits: number, radius: number = NAMES_BANNER_RADIUS): number => { const b = monthBanner(); return b.top - nameAboveShare(radius) * (b.height - capUnits) - capUnits / 2; };
/** Canvas pixels of a tile: 192 per unit of width. */
export const tileCanvasSize = (tile?: FaceTile): [number, number] => (tile ? [Math.round(TEXTURE * tile.w), Math.round(TEXTURE * tile.h)] : [TEXTURE, TEXTURE]);
/**
 * Transform of the drawing (192 x 192 sticker coordinates) onto the canvas of a cubie face: the drawing center (96, 96) goes
 * to the center of the unit cell of the tile (the canvas center without bands), the scale is `NAMES_FACE_SCALE` on a 1 x 1 face and follows the pixels per unit of the face's real geometry
 * (the texture is mapped planar, so a larger face has the same pixels per unit). No tile: the centered `FACE_SCALE` of the
 * standard layout, `NAMES_FACE_SCALE` for the names layout.
 */
export function faceTransform(tile?: FaceTile, layout: Layout = "standard"): { cx: number; cy: number; kx: number; ky: number } {
  if (!tile) { const k = layout === "names" ? NAMES_FACE_SCALE : FACE_SCALE; return { cx: TEXTURE / 2, cy: TEXTURE / 2, kx: k, ky: k }; }
  const g = tileGrid(tile);
  return { cx: g.cx, cy: g.cy, kx: NAMES_FACE_SCALE * g.px / NAMES_FACE_PX_PER_UNIT, ky: NAMES_FACE_SCALE * g.py / NAMES_FACE_PX_PER_UNIT };
}

/**
 * The rectangle of a tile line in texture pixels. On a sticker (the 2D sheet) the full width at the bottom edge, on a cubie
 * face the flat width (`FACE_FLAT`) at the bottom edge of the flat face. Names layout on a cubie face (the 3D cube): the
 * full texture width, so the lines of neighboring cubies meet as one continuous line, and `NAMES_LINE_FACTOR` times as
 * thick. The sheet (sticker surface) keeps its look in both layouts.
 */
export function lineRect(line: SchemeLine, layout: Layout, face: boolean, tile?: FaceTile, banner = false, outer: number = outerLayerWidth(CALENDAR7_SIZE)): { x: number; y: number; w: number; h: number } {
  const names = layout === "names" && face;
  const h = line.px * LINE_SCALE * (names ? NAMES_LINE_FACTOR : 1);
  if (names && tile) {
    // A tile of any size: the width of the unit cell (the full tile width without bands), at the bottom edge of the flat face
    // (the flat share of the height); in the month row at the bottom edge of the red banner.
    const g = tileGrid(tile, outer);
    const r = banner ? g.banner : g.cell; // the month line spans the banner, the weekday line the unit cell: one line across the seven columns
    return { x: r.x0, y: (banner ? g.banner.y1 : g.H * (1 + faceFlatShare(tile.h)) / 2) - h, w: r.x1 - r.x0, h };
  }
  const bottom = face ? TEXTURE * (1 + FACE_FLAT) / 2 : TEXTURE;
  if (face && !names) return { x: TEXTURE * (1 - FACE_FLAT) / 2, y: bottom - h, w: TEXTURE * FACE_FLAT, h };
  return { x: 0, y: bottom - h, w: TEXTURE, h };
}

/**
 * Class of a tile from its label and ink. The ink classes are the print's: dark = weekday digits, red = weekend digits
 * and the labels SUN and SAT, weekday = MON..FRI, month = month letters, blank = no text, band = no text with ink
 * `band` (the empty tiles of row 1 in the names layout; never an empty day).
 */
export function tileClass(text: string, ink: string): TileClass {
  if (text === "") return ink === "band" ? "band" : "blank";
  if (ink === "month") return "month";
  if (ink === "weekday") return "weekday";
  if (ink === "red") return text === "SUN" || text === "SAT" ? "sunsat" : "weekend";
  return "day";
}

/**
 * Fill and inks of a tile in a scheme. The grounds are the ones tests/calendar7-schemes.test.mjs gates the inks on:
 * weekend digits sit on weekendFill or weekendTint, SUN/SAT on weekdayRowFill, else the weekend ground, month letters on
 * bandFill or dayFill. A blank tile is emptyFill. The line under the weekday row (lineRow2) is drawn on the weekday-name
 * tiles. In the names layout (`layout` "names") a `band` tile takes the fill of the month name tiles (bandFill, else
 * dayFill, ink monthInk) and both carry the line under row 1 (lineRow1); in the standard layout lineRow1 is not applied
 * and a band tile does not occur.
 */
export function tileRoles(scheme: ColorScheme, text: string, ink: string, layout: Layout = "standard"): TileRoles {
  const cls = tileClass(text, ink);
  const weekend = scheme.weekendFill ?? scheme.weekendTint ?? scheme.dayFill;
  const ground = (fill: string): string => (layout === "names" ? namesGround(fill) : fill);
  const roles = (fill: string, color: string, small = color, line: SchemeLine | null = null): TileRoles => ({ cls, fill: ground(fill), ink: color, inkSmall: small, line });
  if (layout === "names" && isBannerClass(cls) && scheme.bannerStyle) {
    if (scheme.bannerStyle === "underline") {
      const color = underlineInk(scheme);
      return { ...roles(scheme.dayFill, color, color, { color, px: scheme.lineRow1?.px ?? 3 }), banner: { style: "underline", outline: null } };
    }
    if (scheme.bannerStyle === "boxed" || scheme.bannerStyle === "rounded-box") {
      const color = underlineInk(scheme), outline = { color, px: scheme.lineRow1?.px ?? 3 };
      return { ...roles(scheme.dayFill, color, color), banner: { style: scheme.bannerStyle, outline } };
    }
    // A palette without a band fill can still draw a filled banner using its existing month ink and paper colors.
    const fill = scheme.bandFill ?? scheme.monthInk, color = scheme.bandFill === null ? scheme.dayFill : scheme.monthInk;
    return { ...roles(fill, color, color), banner: { style: scheme.bannerStyle, outline: null } };
  }
  switch (cls) {
    case "blank": return roles(scheme.emptyFill, scheme.dayInk);
    case "band": return roles(scheme.bandFill ?? scheme.dayFill, scheme.monthInk, scheme.monthInk, layout === "names" ? scheme.lineRow1 : null);
    case "day": return roles(scheme.dayFill, scheme.dayInk);
    case "weekday": return roles(scheme.weekdayRowFill ?? scheme.dayFill, scheme.weekdayInk, scheme.weekdayInk, scheme.lineRow2);
    case "sunsat": return roles(scheme.weekdayRowFill ?? weekend, scheme.sunSatInk, scheme.sunSatInk, scheme.lineRow2);
    case "weekend": return roles(weekend, scheme.weekendInk, scheme.weekendInkSmall);
    case "month": return roles(scheme.bandFill ?? scheme.dayFill, scheme.monthInk, scheme.monthInk, layout === "names" ? scheme.lineRow1 : null);
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

/** Names layout: the one font size of every name tile (texture pixels); a capital M or W fits one of the three slots. */
export const NAME_FONT_SIZE = 56;

/** One letter of a name tile: the character, its slot center x and its size (texture pixels). */
export interface NameLetter {
  readonly char: string;
  readonly x: number;
  readonly size: number;
}

/**
 * Texture pixels (in drawing coordinates) per scene unit of the cubie pitch on a cubie face the drawing is scaled about the
 * center by `FACE_SCALE`, so the drawing pitch is the on-screen pitch of the flat face divided by it.
 */
export const namePxPerUnit = (): number => NAMES_FACE_PX_PER_UNIT / NAMES_FACE_SCALE;

/**
 * Center x (drawing coordinates) of letter `i` of a name tile. On a cubie face (the 3D cube): the slot grid of layout.ts,
 * thirds of the cubie pitch, uniform across tiles. On a sticker (the 2D sheet): as before, three slots of the text square.
 */
export const nameLetterX = (text: string, i: number, face: boolean, tileWidth = 1, words: NameWords = NAME_WORDS): number =>
  face
    ? TEXTURE / 2 + (nameSlotOffset(text, i, words) + nameTileShift(text, tileWidth, words)) * namePxPerUnit()
    : TEXTURE / 2 - TEXT_SQUARE / 2 + (nameSlotStart(text, words) + i + 0.5) * (TEXT_SQUARE / NAME_SLOTS);

/**
 * Letters of a name tile on the one uniform grid of the whole name row: a third of a cubie pitch between two letters, also
 * across tile boundaries, independent of the glyph widths (first tile right-flush, last left-flush, see layout.ts).
 */
export function nameGrid(text: string, face = true, tileWidth = 1, words: NameWords = NAME_WORDS): readonly NameLetter[] {
  return [...text].map((char, i) => ({ char, x: nameLetterX(text, i, face, tileWidth, words), size: NAME_FONT_SIZE }));
}

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
  layout: Layout = "standard",
): void {
  paintSticker(ctx, text, ink, profile, scheme ? tileRoles(scheme, text, ink, layout) : null, true, layout, false);
}

function paintSticker(ctx: Context, text: string, ink: string, profile: RuleProfile, roles: TileRoles | null, edgeLine: boolean, layout: Layout = "standard", face = false, tile?: FaceTile, words: NameWords = NAME_WORDS): void {
  if (!(roles && layout === "names" && face && tile)) { // a tile of the names layout has its ground already (paintTileGround)
    ctx.fillStyle = roles ? roles.fill : text === "" ? BLANK_PAPER : PAPER;
    ctx.fillRect(0, 0, TEXTURE, TEXTURE);
  }
  if (text !== "") paintLabel(ctx, text, ink, profile, roles, layout, face, tile, words);
  if (roles?.line && edgeLine) {
    const r = lineRect(roles.line, layout, false);
    ctx.fillStyle = roles.line.color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

function paintLabel(ctx: Context, text: string, ink: string, profile: RuleProfile, roles: TileRoles | null, layout: Layout, face: boolean, tile?: FaceTile, words: NameWords = NAME_WORDS): void {
  const big = roles ? roles.ink : (INK_COLORS[ink] ?? INK_COLORS.dark);
  ctx.fillStyle = big;
  if (layout === "names" && ink === "month") {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${NAME_FONT_SIZE}px ${FONT}`;
    // On a tile of the unit grid the drawing is in the frame of the unit cell: no shift for a thick tile, the name centered in the banner.
    const up = face && tile ? nameCenterUp(0.714 * NAME_FONT_SIZE / namePxPerUnit()) * namePxPerUnit() : 0;
    for (const l of nameGrid(text, face, 1, words)) ctx.fillText(l.char, l.x, TEXTURE / 2 + l.size * 0.04 - up);
  } else if (profile === "strict" && isSplitLabel(text)) {
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
    } else ctx.fillText(text, TEXTURE / 2, TEXTURE / 2 + size * 0.04 + (face && tile && layout === "names" && roles ? weekdayShift(roles.cls) : 0));
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
/**
 * The same for a tile of the names layout (O2 bevel radius, owner decision 2026-11-14): the 192 px sticker drawing is fitted to the
 * visible face (`faceVisibleShare`: up to where the bevel is 45 degrees steep, 0.912 of the texture), so its 0.86 text square is
 * 0.784 of the cell. The flat part of a 1 x 1 face is only 0.699 of the texture (FACE_FLAT is 0.9106 at the radius 0.055): the
 * outer part of the text starts on the first part of the bevel (tilt below 17 degrees); a text square at 0.92 of the flat part
 * would be 23 % smaller than before and thinner than the 6 / 255 ink limit of tests/browser/calendar7-names-color.spec.mjs can
 * measure on screen.
 */
export const NAMES_FACE_SCALE = faceVisibleShare(1);
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
  layout: Layout = "standard",
  tile?: FaceTile,
  words: NameWords = NAME_WORDS,
): void {
  const roles = scheme ? tileRoles(scheme, text, ink, layout) : null;
  const t = layout === "names" ? tile : undefined; // only the names layout has tiles of other sizes
  const [W, H] = tileCanvasSize(t);
  if (roles && scheme && t) paintTileGround(ctx, roles, scheme, t);
  else { ctx.fillStyle = roles ? roles.fill : text === "" ? BLANK_PAPER : PAPER; ctx.fillRect(0, 0, W, H); }
  const { cx, cy, kx, ky } = faceTransform(t, layout);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(kx, ky);
  ctx.translate(-TEXTURE / 2, -TEXTURE / 2);
  // paintSticker paints the same ground again over the scaled square (same color), then the label.
  paintSticker(ctx, text, ink, profile, roles, false, layout, true, t, words);
  ctx.restore();
  if (roles?.line) {
    const r = lineRect(roles.line, layout, true, t, isBannerClass(roles.cls));
    ctx.fillStyle = roles.line.color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

/** A display mismatch overlay; it makes no reachability or UNSAT claim. */
/** Translucent strokes: the printed numeral stays readable through the hatch. */
export const WRONG_CELL = { hatch: "rgba(91, 91, 91, 0.9)", halo: "rgba(255, 255, 255, 0.85)" } as const;
/** Minimal 2D context the drawing needs (a recording fake in the tests). */
export interface WrongCellContext {
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  rect(x: number, y: number, w: number, h: number): void;
  clip(): void;
}
/** Number of hatch lines across a tile of the width `w` (one per `w / HATCH_LINES`). */
export const HATCH_LINES = 10;
/** The day field in the texture frame: the unit cell that holds the numeral (`tileGrid().cell`), inside the flat face (bevel excluded). Without bands the unit cell is the whole tile, so the field is the whole flat face. */
export function wrongCellRect(w: number, h: number, tile?: FaceTile): { x: number; y: number; w: number; h: number } {
  const flatW = w * faceFlatShare(tile?.w ?? 1), flatH = h * faceFlatShare(tile?.h ?? 1), g = tileGrid(tile);
  const x0 = Math.max((w - flatW) / 2, g.cell.x0 * w / g.W), x1 = Math.min((w + flatW) / 2, g.cell.x1 * w / g.W);
  const y0 = Math.max((h - flatH) / 2, g.cell.y0 * h / g.H), y1 = Math.min((h + flatH) / 2, g.cell.y1 * h / g.H);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/**
 * Translucent hatching over the day field (the unit cell with the numeral, inside the flat face) of the original sticker (the texture turns with the cubie): light halo and dark
 * lines on the same 45 degree pitch. Line width and pitch
 * follow the tile size, so the mark looks the same on every tile; nothing is filled and the printed label stays readable.
 */
export function drawWrongCell(ctx: WrongCellContext, w: number, h: number, tile?: FaceTile): void {
  const r = wrongCellRect(w, h, tile), unit = Math.min(w, h), step = unit / HATCH_LINES;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.lineCap = "butt";
  for (const [color, width] of [[WRONG_CELL.halo, Math.max(4, unit / 32)], [WRONG_CELL.hatch, Math.max(2, unit / 48)]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let x = r.x - r.h; x < r.x + r.w; x += step) {
      ctx.moveTo(x, r.y + r.h);
      ctx.lineTo(x + r.h, r.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
