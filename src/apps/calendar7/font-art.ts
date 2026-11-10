// SPDX-License-Identifier: AGPL-3.0-or-later
/** Shared 2D/3D artwork: original glyphs, with one source for each 6/9 pair. */
import { numberLayout, type LoadedFont } from "./fonts.ts";
import { FACE_FLAT, FACE_SCALE, LINE_SCALE, TEXTURE, tileRoles, type Surface } from "./sticker-art.ts";
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
export function drawFontSticker(ctx: CanvasRenderingContext2D, text: string, ink: string, font: LoadedFont, scheme: ColorScheme, surface: Surface = "sticker"): void {
  const roles = tileRoles(scheme, text, ink);
  ctx.fillStyle = roles.fill;
  ctx.fillRect(0, 0, TEXTURE, TEXTURE);
  if (surface === "face") {
    ctx.save();ctx.translate(96, 96);ctx.scale(FACE_SCALE, FACE_SCALE);ctx.translate(-96, -96);
  }
  if (text) for (const [index, part] of labelLayout(text, font).entries()) {
    ctx.fillStyle = index === 1 ? roles.inkSmall : roles.ink;
    drawFontRun(ctx, part.text, font, part.size, part.x, part.y);
  }
  if (surface === "face") ctx.restore();
  if (roles.line) {
    const h = roles.line.px * LINE_SCALE;
    ctx.fillStyle = roles.line.color;
    if (surface === "face") ctx.fillRect(TEXTURE * (1 - FACE_FLAT) / 2, TEXTURE * (1 + FACE_FLAT) / 2 - h, TEXTURE * FACE_FLAT, h);
    else ctx.fillRect(0, TEXTURE - h, TEXTURE, h);
  }
}
