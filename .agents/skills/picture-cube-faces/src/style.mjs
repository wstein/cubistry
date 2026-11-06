/** Pastel style kit: one ink color, three line weights, soft hues, friendly faces.
 * Flat vector only: no gradients, filters, clip paths, url() references, <text> or <image>.
 * Line weights are given for a 160 px sticker and scaled with k = tile / 160.
 */
export const INK = "#4a3a38";
export const LINE = { outline: 3, fine: 2, body: 6 }; // body = merged outline, half is covered so 3 shows
export const HUES = {
  butter: { bg: "#fdf1cf", light: "#fff4c2", mid: "#fbe08a", dark: "#f0c45a" },
  peach: { bg: "#fbe0c8", light: "#f8d5b8", mid: "#f6b98c", dark: "#e79c6c" },
  pink: { bg: "#fbdde4", light: "#f9c6d3", mid: "#f4a9bd", dark: "#e8788f" },
  green: { bg: "#e2efd9", light: "#bfe6d4", mid: "#9cc08a", dark: "#6f9f6b" },
  sky: { bg: "#d6ecf5", light: "#c9dcf2", mid: "#a9c1e6", dark: "#8fb0dd" },
  lilac: { bg: "#ece4f8", light: "#d8ccf2", mid: "#b9a8e2", dark: "#9a86d0" },
};
export const WHITE = "#fffaf1";

const r2 = (v) => +v.toFixed(2);

/** Style kit scaled to a sticker size; theme callbacks receive it as ctx.s. */
export function styleKit(k = 1, ink = INK) {
  const W = { outline: LINE.outline * k, fine: LINE.fine * k, body: LINE.body * k };
  const stroke = (w = W.outline, c = ink) =>
    `fill="none" stroke="${c}" stroke-width="${r2(w)}" stroke-linecap="round" stroke-linejoin="round"`;
  const g = (x, y, s, inner) => `<g transform="translate(${r2(x)} ${r2(y)}) scale(${+s.toFixed(3)})">${inner}</g>`;
  /** Outlines all shapes first, then fills them, so overlapping parts read as ONE flat body. */
  const merged = (shapes, fill) =>
    `<g stroke="${ink}" stroke-width="${r2(W.body)}" stroke-linejoin="round" fill="${ink}">${shapes}</g><g fill="${fill}">${shapes}</g>`;
  const dot = (x, y, r, c) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="${c}" stroke="${ink}" stroke-width="${r2(W.outline)}"/>`;
  const eye = (x, y, r = 4.5 * k) =>
    `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="${ink}"/><circle cx="${r2(x + r / 3)}" cy="${r2(y - r / 3)}" r="${r2(r * 0.3)}" fill="#fff"/>`;
  const smile = (x, y, w = 8 * k) => `<path d="M${r2(x - w)} ${r2(y)}Q${r2(x)} ${r2(y + w)} ${r2(x + w)} ${r2(y)}" ${stroke(W.fine)}/>`;
  const cheeks = (x, y, gap, c = HUES.pink.dark) =>
    `<ellipse cx="${r2(x - gap)}" cy="${r2(y)}" rx="${r2(7 * k)}" ry="${r2(4.5 * k)}" fill="${c}" opacity=".55"/><ellipse cx="${r2(x + gap)}" cy="${r2(y)}" rx="${r2(7 * k)}" ry="${r2(4.5 * k)}" fill="${c}" opacity=".55"/>`;
  /** Friendly face: two eyes, rosy cheeks, a smile; (x, y) is the eye line. */
  const happy = (x, y) => eye(x - 17 * k, y) + eye(x + 17 * k, y) + cheeks(x, y + 10 * k, 27 * k) + smile(x, y + 8 * k);
  return { ink, W, stroke, g, merged, dot, eye, smile, cheeks, happy };
}
