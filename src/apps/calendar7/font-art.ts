// SPDX-License-Identifier: AGPL-3.0-or-later
/** Shared 2D/3D artwork: original glyphs, with one source for each 6/9 pair. */
import { numberLayout, type LoadedFont } from "./fonts.ts";
import { type Layout, NAME_SLOTS } from "./layout.ts";
import { faceTransform, type FaceTile, lineRect, nameLetterX, TEXT_SQUARE, TEXTURE, tileCanvasSize, tileRoles, type Surface } from "./sticker-art.ts";
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
/** Letters of the name labels: the one font size of the names layout is fitted to them. */
const NAME_LETTERS = "JANUARYFEBRUCHMPILTSGOVDE";
/**
 * Names layout: the letters of a name tile on the uniform letter grid of the whole name row (a third of a cubie pitch
 * between two letters, across tile boundaries too, see layout.ts), one size for every name tile (the cap height of a
 * three-letter label, or smaller when the widest capital would not fit its slot). Each letter's ink is centered on its slot.
 */
export function nameLabelLayout(text: string, font: LoadedFont, surface: Surface = "face", tileWidth = 1): readonly { text: string; size: number; x: number; y: number; box: InkBox }[] {
  const slot = TEXT_SQUARE / NAME_SLOTS;
  const capHeight = Math.max(...[...NAME_LETTERS].map(c => font.glyphs[c].bottom - font.glyphs[c].top));
  const widest = Math.max(...[...NAME_LETTERS].map(c => numberLayout(c, font, 1).width));
  const size = Math.min(58 / capHeight, (slot * 0.95) / widest);
  return [...text].map((char, i) => {
    const p = numberLayout(char, font, size), x = nameLetterX(text, i, surface === "face", tileWidth);
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
  const [W, H] = tileCanvasSize(t);
  ctx.fillStyle = roles.fill;
  ctx.fillRect(0, 0, W, H);
  if (surface === "face") {
    const { cx, cy, kx, ky } = faceTransform(t);
    ctx.save();ctx.translate(cx, cy);ctx.scale(kx, ky);ctx.translate(-96, -96);
  }
  const parts = layout === "names" && printed.cls === "month" ? nameLabelLayout(text, font, surface, t ? t.w : 1) : labelLayout(text, font);
  if (text) for (const [index, part] of parts.entries()) {
    ctx.fillStyle = index === 1 ? roles.inkSmall : roles.ink;
    drawFontRun(ctx, part.text, font, part.size, part.x, part.y);
  }
  if (surface === "face") ctx.restore();
  if (roles.line) {
    const r = lineRect(roles.line, layout, surface === "face", t);
    ctx.fillStyle = roles.line.color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}
