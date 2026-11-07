// SPDX-License-Identifier: AGPL-3.0-or-later
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
const FONT = '"Counter Sans", "Noto Sans", system-ui, sans-serif';

type Context = Pick<
  CanvasRenderingContext2D,
  "fillStyle" | "fillRect" | "fillText" | "font" | "measureText" | "textAlign" | "textBaseline"
>;

/** Draws one sticker: paper, then the text centered and fitted into the sticker. Blank text is plain blank paper. */
export function drawSticker(ctx: Context, text: string, ink: string): void {
  ctx.fillStyle = text === "" ? BLANK_PAPER : PAPER;
  ctx.fillRect(0, 0, TEXTURE, TEXTURE);
  if (text === "") return;
  ctx.fillStyle = INK_COLORS[ink] ?? INK_COLORS.dark;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const base = text.length === 1 ? 140 : text.length === 2 ? 110 : 80;
  ctx.font = `600 ${base}px ${FONT}`;
  const width = ctx.measureText(text).width;
  const size = Math.floor(Math.min(base, (base * TEXTURE * 0.86) / Math.max(width, 1)));
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.fillText(text, TEXTURE / 2, TEXTURE / 2 + size * 0.04);
}
