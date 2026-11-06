// Blank net template for painting: the standard cross (U above F; L F R B in a row; D below F) with the
// n x n sticker grid of every face and the face labels. One face edge is 100 pixels per sticker, the
// advised density, so the PNG version is n * 400 by n * 300 pixels. The SVG is generated from fixed
// numbers and stays inside the upload sanitizer's allowlist (the tests run it through the sanitizer);
// it is returned in the sanitizer's canonical form, so the template can be uploaded as it is.
import { sanitizeSvg } from "@cubistry/cube-assets";
import { MIN_CUBE_SIZE, MAX_CUBE_SIZE, FACE_IDS } from "./themes.ts";
import { CROSS_CELLS, MIN_PIXELS_PER_STICKER } from "./upload.ts";

/** Template size in pixels for a size-n cube. */
export function templateSize(n: number): { face: number; width: number; height: number } {
  if (!Number.isInteger(n) || n < MIN_CUBE_SIZE || n > MAX_CUBE_SIZE)
    throw Error(`Cube size must be an integer from ${MIN_CUBE_SIZE} to ${MAX_CUBE_SIZE}`);
  const face = n * MIN_PIXELS_PER_STICKER;
  return { face, width: 4 * face, height: 3 * face };
}

/** The template before sanitizing (exported so tests can prove it needs no stripping). */
export function netTemplateSource(n: number): string {
  const { face: s, width, height } = templateSize(n);
  const grid: string[] = [],
    labels: string[] = [],
    frames: string[] = [];
  for (const f of FACE_IDS) {
    const [c, r] = CROSS_CELLS[f],
      x0 = c * s,
      y0 = r * s;
    const d: string[] = [];
    for (let k = 1; k < n; k++) {
      const o = (k * s) / n;
      d.push(`M${x0 + o} ${y0}V${y0 + s}`, `M${x0} ${y0 + o}H${x0 + s}`);
    }
    grid.push(`<path d="${d.join("")}" fill="none" stroke="#b9c4cb" stroke-width="${Math.max(1, s / 200)}"/>`);
    frames.push(`<rect x="${x0}" y="${y0}" width="${s}" height="${s}" fill="none" stroke="#5b6b75" stroke-width="${Math.max(2, s / 100)}"/>`);
    labels.push(
      `<text x="${x0 + s / 20}" y="${y0 + s / 20}" font-family="sans-serif" font-size="${s / 8}" font-weight="700" fill="#8a98a0" dominant-baseline="hanging">${f}</text>`,
    );
  }
  const note = `<text x="${s / 20}" y="${s / 4}" font-family="sans-serif" font-size="${s / 16}" fill="#8a98a0">${n}x${n} net, ${s} px per face</text>
<text x="${s / 20}" y="${s / 4 + s / 12}" font-family="sans-serif" font-size="${s / 16}" fill="#8a98a0">Paint inside the faces</text>`;
  const bg = [0, 1, 2, 3, 4, 5].map((i) => {
    const f = FACE_IDS[i],
      [c, r] = CROSS_CELLS[f];
    return `<rect x="${c * s}" y="${r * s}" width="${s}" height="${s}" fill="#ffffff"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bg.join("")}${grid.join("")}${frames.join("")}${labels.join("")}${note}</svg>`;
}

export function netTemplateSvg(n: number): string {
  return sanitizeSvg(netTemplateSource(n)).svg;
}
