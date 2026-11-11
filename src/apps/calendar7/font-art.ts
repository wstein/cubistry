// SPDX-License-Identifier: AGPL-3.0-or-later
/** Shared 2D/3D artwork: original glyphs, with one source for each 6/9 pair. */
import { numberLayout, type LoadedFont } from "./fonts.ts";
import { type Layout, NAME_SLOTS, NAME_WORDS, nameAnchor } from "./layout.ts";
import { CALENDAR7_SIZE, monthBanner, NAMES_MONTH_SIDE_BAND, outerLayerWidth } from "./geometry.ts";
import { faceTransform, type FaceTile, isBannerClass, lineRect, nameCenterUp, nameLetterX, namePxPerUnit, paintTileGround, TEXT_SQUARE, weekdayShift, TEXTURE, tileCanvasSize, tileGrid, tileRoles, type Surface } from "./sticker-art.ts";
import type { ColorScheme } from "./schemes.ts";

export interface InkBox { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }
export function labelLayout(text: string, font: LoadedFont): readonly { text: string; size: number; x: number; y: number; box: InkBox }[] {
  const part = (value: string, size: number, x: number, y: number) => {
    const p = numberLayout(value, font, size);
    return { text: value, size, x, y, box: { x0: x - p.width / 2, y0: y - p.height / 2, x1: x + p.width / 2, y1: y + p.height / 2 } };
  };
  if (/^[1-9][0-9]?\/[1-9][0-9]?$/.test(text)) {
    const [first, second] = text.split("/"), size = font.dateSize * .45;
    const small = numberLayout(second, font, size);
    return [part(first, font.dateSize, 96, 78), part(second, size, 178 - small.width / 2, 178 - small.height / 2)];
  }
  if (/^[0-9]+$/.test(text)) return [part(text, font.dateSize, 96, 96)];
  if (!text) return [];
  const capHeight = Math.max(...text.split("").map(c => font.glyphs[c].bottom - font.glyphs[c].top));
  const normal = (text.length === 1 ? 100 : text.length === 2 ? 79 : 58) / capHeight, width = numberLayout(text, font, normal).width;
  return [part(text, Math.min(normal, normal * 164 / width), 96, 96)];
}
/** Letters of the name labels: the size of the sheet's name tiles is fitted to them. */
const NAME_LETTERS = "JANUARYFEBRUCHMPILTSGOVDE";

/** Names layout on the cubie faces: the least ink gap inside a tile (drawing px), every pair of letters keeps it. */
export const NAME_MIN_INK_GAP = 2;
/** Names layout on the cubie faces: ink stays this far (drawing px, a bit more than one canvas px) inside the texture edge, so anti-aliasing never reaches it. */
export const NAME_EDGE_MARGIN = 1.5;
const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Per name tile of the 3D face layout: tracking added to the natural gaps and the resulting ink gaps (drawing px). */
export interface NameTileFit {
  readonly label: string;
  readonly anchor: -1 | 0 | 1;
  /** Tracking in px at the font's size: the uniform extra space per gap before the 2 px floor. */
  readonly tracking: number;
  /** Ink gaps between neighboring letters in px. */
  readonly gaps: readonly number[];
  /** Pairs whose natural gap is below the floor and was raised to it ("R-Y"). */
  readonly raised: readonly string[];
  readonly months: readonly string[];
}
export interface NameFace {
  readonly size: number;
  /** Height of the red banner of the month row in units and the center line of the names above the unit cell center (units, y up). */
  readonly bannerHeight: number;
  readonly centerUp: number;
  /** The largest weekday label size of the font (the month size must reach it). */
  readonly weekday: number;
  /** Ink gap at every seam between two name tiles (px); the seam is in its middle. */
  readonly seamGap: number;
  readonly tiles: ReadonlyMap<string, NameTileFit>;
  /** Empty when `size >= weekday`; otherwise the tiles (and months) that do not fit at the weekday size. */
  readonly blocked: readonly { label: string; months: readonly string[] }[];
}

interface TileInfo { readonly label: string; readonly anchor: -1 | 0 | 1; readonly months: readonly string[] }
const TILES: readonly TileInfo[] = (() => {
  const seen = new Map<string, TileInfo>(), names = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  NAME_WORDS.forEach((word, i) => word.forEach(label => {
    const anchor = nameAnchor(label), old = seen.get(label);
    seen.set(label, { label, anchor, months: [...(old?.months ?? []), names[i] ?? word.join("")] });
  }));
  return [...seen.values()];
})();

/**
 * Room of the name tiles on the unit grid, in drawing px from the center of the unit cell (the content is one unit wide in
 * every tile): `left`/`right` to the texture edge, or to the edge of the red banner on a side with a band (the first tile
 * of a name sits on the corner cubie of column 1: band on the left, the seam on the right). Row 1 is a thick layer: every
 * tile has the top band.
 */
const OUTER = outerLayerWidth(CALENDAR7_SIZE);
const roomOf = (anchor: -1 | 0 | 1): { left: number; right: number } => {
  const first = anchor === 1, tile: FaceTile = first ? { w: OUTER, h: OUTER, band: { l: OUTER - 1, r: 0, t: OUTER - 1, b: 0 } } : { w: 1, h: OUTER, band: { l: 0, r: 0, t: OUTER - 1, b: 0 } };
  const g = tileGrid(tile), k = faceTransform(tile).kx, ppu = namePxPerUnit();
  return { left: first ? (OUTER - 0.5 - NAMES_MONTH_SIDE_BAND) * ppu : g.cx / k, right: (g.W - g.cx) / k }; // the first tile: the banner starts 0.6 inside the cube edge, 0.7 from the cell center (f - 0.5 - side)
};

/** Natural geometry of a label in em: summed ink widths and the natural ink gaps between neighbors. */
function natural(font: LoadedFont, label: string): { glyphs: number; gaps: number[]; height: number } {
  const g = [...label].map(c => font.glyphs[c]);
  return {
    glyphs: g.reduce((sum, m) => sum + m.right - m.left, 0),
    gaps: g.slice(1).map((m, i) => g[i].advance - g[i].right + m.left),
    height: Math.max(...g.map(m => m.bottom - m.top))
  };
}
const inkAt = (s: number, tau: number, n: { glyphs: number; gaps: number[] }): number => s * n.glyphs + n.gaps.reduce((sum, e) => sum + Math.max(NAME_MIN_INK_GAP, s * e + tau), 0);
/** Largest tracking whose ink is at most `target`, or null when even the floored gaps are too wide. */
function trackingFor(s: number, n: { glyphs: number; gaps: number[] }, target: number): number | null {
  if (!n.gaps.length) return s * n.glyphs <= target ? 0 : null;
  let lo = -1e4, hi = 1e4;
  if (inkAt(s, lo, n) > target) return null;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (inkAt(s, mid, n) <= target) lo = mid; else hi = mid; }
  return lo;
}

/**
 * Variant under review: the first tile of a name with three letters (AUG, SEP, NOV, DEC) fills its 1.2 units of banner
 * (looser tracking than the other tiles) so that its ink keeps half a seam gap from the banner edge. Off: it takes the mean
 * tracking like the other outer tiles and sits flush to its right seam with the rest of the banner width as left margin.
 */
export const NAMES_FIRST_TILE_FILL = false;
/**
 * The layout of all name tiles at glyph size `s`, or the tiles that do not fit. Every tile has one unit of content (the unit
 * cell): a middle tile fills it between two half seam gaps, the first tile is flush right to its seam and its ink keeps half a seam gap
 * (as at a seam) from the red banner edge at most, the last is flush left and ends 1.5 px before the texture edge at most. The glyphs must fit
 * the height of the red banner.
 */
function fitAt(font: LoadedFont, s: number, c: number): { ok: true; m: number; taus: Map<string, number> } | { ok: false; fails: string[] } {
  const ppu = namePxPerUnit(), fails: string[] = [], taus = new Map<string, number>(), banner = monthBanner().height * ppu;
  // the seam sits between two texture edges (bevel reach): ink keeps 1.5 px inside the texture on the seam side
  const m = Math.max(c * s / 2, ...TILES.flatMap(t => {
    const room = roomOf(t.anchor);
    return [...(t.anchor !== -1 ? [ppu / 2 - room.right + NAME_EDGE_MARGIN] : []), ...(t.anchor !== 1 ? [ppu / 2 - room.left + NAME_EDGE_MARGIN] : [])];
  }));
  const nat = new Map(TILES.map(t => [t.label, natural(font, t.label)]));
  for (const t of TILES) if (t.anchor === 0) {
    const tau = trackingFor(s, nat.get(t.label)!, ppu - 2 * m);
    if (tau === null) fails.push(t.label); else taus.set(t.label, tau);
  }
  const mean = taus.size ? [...taus.values()].reduce((a, b) => a + b, 0) / taus.size : 0;
  for (const t of TILES) {
    const n = nat.get(t.label)!;
    if (n.height * s + 2 * NAME_EDGE_MARGIN > banner) { fails.push(t.label); continue; }
    if (t.anchor === 0) continue;
    const room = roomOf(t.anchor), limit = ppu / 2 + (t.anchor === 1 ? room.left - m : room.right - NAME_EDGE_MARGIN) - m, tau = trackingFor(s, n, limit);
    if (tau === null) fails.push(t.label);
    else if (t.anchor === 1 && t.label.length >= 3 && NAMES_FIRST_TILE_FILL) taus.set(t.label, tau); // fill the first tile: the ink from half a seam gap inside the banner edge to half a seam gap before the seam
    else taus.set(t.label, Math.min(mean, tau));
  }
  return fails.length ? { ok: false, fails } : { ok: true, m, taus };
}

const NAME_FACES = new WeakMap<LoadedFont, NameFace & { m: number }>();
/**
 * Names layout on the cubie faces (owner decision of 2026-11-11, "option 4"): one glyph size per font and per tile one
 * uniform extra tracking, solved from the font's real metrics. The seam between two tiles is in the middle of the ink gap
 * between their letters, and that gap is the same at every seam (`seamGap`). A middle tile fills its cubie between the two
 * half seam gaps; the outer tiles of a word take the mean tracking of the middle tiles, less if they would leave the texture.
 * No ink gap inside a tile is below `NAME_MIN_INK_GAP`. The size is the one that fills the middle tiles with the median
 * natural gap, at least the weekday size, and smaller only when a tile cannot fit; `blocked` then names it.
 */
export function nameFaceTable(font: LoadedFont): NameFace {
  const cached = NAME_FACES.get(font);
  if (cached) return cached;
  const ppu = namePxPerUnit(), nat = new Map(TILES.map(t => [t.label, natural(font, t.label)]));
  const all = [...nat.values()].flatMap(n => n.gaps).sort((a, b) => a - b);
  const c = all.length % 2 ? all[(all.length - 1) / 2] : (all[all.length / 2 - 1] + all[all.length / 2]) / 2;
  const middle = TILES.filter(t => t.anchor === 0);
  const ref = middle.reduce((sum, t) => { const n = nat.get(t.label)!; return sum + ppu / (n.glyphs + n.gaps.reduce((a, b) => a + b, 0) + c); }, 0) / middle.length;
  const weekday = Math.max(...WEEKDAY_LABELS.map(d => labelLayout(d, font)[0].size));
  let size = Math.max(Math.floor(ref * 4) / 4, weekday), fit = fitAt(font, size, c);
  while (!fit.ok && size > 10) { size -= 0.25; fit = fitAt(font, size, c); }
  if (!fit.ok) throw new Error("no name size fits");
  const blocked = size >= weekday ? [] : (() => {
    const at = fitAt(font, weekday, c);
    return at.ok ? [] : at.fails.map(label => ({ label, months: TILES.find(t => t.label === label)!.months }));
  })();
  const tiles = new Map<string, NameTileFit>();
  for (const t of TILES) {
    const n = nat.get(t.label)!, tracking = fit.taus.get(t.label) ?? 0, letters = [...t.label];
    const gaps = n.gaps.map(e => Math.max(NAME_MIN_INK_GAP, size * e + tracking));
    const raised = n.gaps.flatMap((e, i) => (size * e < NAME_MIN_INK_GAP ? [`${letters[i]}-${letters[i + 1]}`] : []));
    tiles.set(t.label, { label: t.label, anchor: t.anchor, tracking, gaps, raised, months: t.months });
  }
  const banner = monthBanner(), cap = Math.max(...TILES.map(t => nat.get(t.label)!.height)) * size / ppu;
  const face = { size, bannerHeight: banner.height, centerUp: nameCenterUp(cap), weekday, seamGap: 2 * fit.m, tiles, blocked, m: fit.m };
  NAME_FACES.set(font, face);
  return face;
}

/**
 * Names layout: the letters of a name tile in the frame of its unit cell (the content of every tile is one unit wide, a
 * thick outer cubie has a white band besides it). On the 3D face (`nameFaceTable`): the font's one size and per-tile
 * tracking, the ink of the first tile of a word flush to its right seam, of the last to its left seam, of a middle tile
 * centered, each half a seam gap away from the seam; vertically in the upper part of the red banner (`centerUp`). On the sheet (`surface` "sticker"): the letters of a three-slot grid at one size (the
 * cap height of a three-letter label, or smaller when the widest capital would not fit its slot); each ink is centered on its slot.
 */
export function nameLabelLayout(text: string, font: LoadedFont, surface: Surface = "face"): readonly { text: string; size: number; x: number; y: number; box: InkBox }[] {
  if (surface === "face") {
    const face = nameFaceTable(font) as NameFace & { m: number }, fit = face.tiles.get(text);
    if (fit) {
      const ppu = namePxPerUnit(), glyphs = [...text].map(c => font.glyphs[c]);
      const ink = glyphs.reduce((sum, g) => sum + (g.right - g.left) * face.size, 0) + fit.gaps.reduce((a, b) => a + b, 0);
      const y = TEXTURE / 2 - face.centerUp * ppu; // the unit cell frame: the name sits in the upper part of the red banner
      let x = fit.anchor === 1 ? TEXTURE / 2 + ppu / 2 - face.m - ink : fit.anchor === -1 ? TEXTURE / 2 - ppu / 2 + face.m : TEXTURE / 2 - ink / 2;
      return [...text].map((char, i) => {
        const p = numberLayout(char, font, face.size), cx = x + p.width / 2;
        x += p.width + (fit.gaps[i] ?? 0);
        return { text: char, size: face.size, x: cx, y, box: { x0: cx - p.width / 2, y0: y - p.height / 2, x1: cx + p.width / 2, y1: y + p.height / 2 } };
      });
    }
  }
  const slot = TEXT_SQUARE / NAME_SLOTS;
  const capHeight = Math.max(...[...NAME_LETTERS].map(c => font.glyphs[c].bottom - font.glyphs[c].top));
  const widest = Math.max(...[...NAME_LETTERS].map(c => numberLayout(c, font, 1).width));
  const size = Math.min(58 / capHeight, (slot * 0.95) / widest);
  return [...text].map((char, i) => {
    const p = numberLayout(char, font, size), x = nameLetterX(text, i, surface === "face");
    return { text: char, size, x, y: 96, box: { x0: x - p.width / 2, y0: 96 - p.height / 2, x1: x + p.width / 2, y1: 96 + p.height / 2 } };
  });
}
export function drawFontRun(ctx: CanvasRenderingContext2D, text: string, font: LoadedFont, size: number, x: number, y: number): void {
  ctx.font = `${font.style.weight} ${size}px "${font.family}"`;
  ctx.fontKerning = "none";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const run of numberLayout(text, font, size).runs) {
    ctx.save();
    ctx.translate(x + run.x, y);
    if (run.turn) ctx.rotate(run.turn);
    ctx.fillText(run.text, -(run.metric.left + run.metric.right) * size / 2, -(run.metric.top + run.metric.bottom) * size / 2);
    ctx.restore();
  }
}
/** Redraws existing canvases. The physical sticker identity and frame never change. */
export function drawFontSticker(ctx: CanvasRenderingContext2D, text: string, ink: string, font: LoadedFont, scheme: ColorScheme, surface: Surface = "sticker", sheetColors?: { readonly fill: string; readonly ink: string }, layout: Layout = "standard", tile?: FaceTile): void {
  const printed = tileRoles(scheme, text, ink, layout);
  // The HTML sheet retains its accessible page-theme palette; the cube retains its printed scheme.
  const roles = sheetColors ? { ...printed, fill: sheetColors.fill, ink: sheetColors.ink, inkSmall: sheetColors.ink } : printed;
  const t = layout === "names" && surface === "face" ? tile : undefined; // only the cubie faces of the names layout have tiles of other sizes
  if (t) paintTileGround(ctx, roles, scheme, t);
  else {
    ctx.fillStyle = roles.fill;
    const [W, H] = tileCanvasSize(t);
    ctx.fillRect(0, 0, W, H);
  }
  if (surface === "face") {
    const { cx, cy, kx, ky } = faceTransform(t);
    ctx.save();ctx.translate(cx, cy);ctx.scale(kx, ky);ctx.translate(-96, -96);
  }
  const parts = layout === "names" && printed.cls === "month" ? nameLabelLayout(text, font, surface) : labelLayout(text, font);
  if (text) for (const [index, part] of parts.entries()) {
    ctx.fillStyle = index === 1 ? roles.inkSmall : roles.ink;
    drawFontRun(ctx, part.text, font, part.size, part.x, part.y + (t ? weekdayShift(roles.cls) : 0)); // weekday words a little below the cell center
  }
  if (surface === "face") ctx.restore();
  if (roles.line) {
    const r = lineRect(roles.line, layout, surface === "face", t, isBannerClass(roles.cls));
    ctx.fillStyle = roles.line.color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}
