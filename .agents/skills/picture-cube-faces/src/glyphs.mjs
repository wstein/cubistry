/** Compact block alphabet and digits as stroke paths (no <text>, no fonts). Ported from the Pastel letter-cube helpers.
 * Every glyph is a center line in a 58 x 88 box; strokes are drawn round-capped. Glyph asymmetry gives
 * letter and number stickers an unambiguous orientation (a lone "O", "0", "I", "X" or "H" would not).
 */
import { shade } from "./color.mjs";

export const GLYPH_W = 58;
export const GLYPH_H = 88;
export const GLYPHS = {
  A: "M4 88 L29 6 L54 88 M14 60 H44",
  B: "M6 4 V84 M6 4 H32 Q50 4 50 22 Q50 42 30 42 H6 M30 42 Q54 42 54 63 Q54 84 32 84 H6",
  C: "M52 22 Q46 4 29 4 Q6 4 6 44 Q6 84 29 84 Q46 84 52 66",
  D: "M6 4 H24 Q54 4 54 44 Q54 84 24 84 H6 Z",
  E: "M52 4 H6 V84 H52 M6 44 H44",
  F: "M52 4 H6 V84 M6 44 H44",
  G: "M52 22 Q46 4 29 4 Q6 4 6 44 Q6 84 29 84 Q52 84 52 52 H32",
  H: "M6 4 V84 M52 4 V84 M6 44 H52",
  I: "M29 4 V84 M12 4 H46 M12 84 H46",
  J: "M48 4 V58 Q48 84 27 84 Q8 84 6 62",
  K: "M6 4 V84 M52 4 L8 50 M24 36 L54 84",
  L: "M6 4 V84 H50",
  M: "M6 84 V4 L29 50 L52 4 V84",
  N: "M6 84 V4 L52 84 V4",
  O: "M29 4 Q54 4 54 44 Q54 84 29 84 Q4 84 4 44 Q4 4 29 4 Z",
  P: "M6 84 V4 H30 Q52 4 52 28 Q52 52 30 52 H6",
  Q: "M29 4 Q54 4 54 44 Q54 84 29 84 Q4 84 4 44 Q4 4 29 4 Z M32 64 L54 88",
  R: "M6 84 V4 H30 Q52 4 52 28 Q52 52 30 52 H6 M28 52 L52 84",
  S: "M50 20 Q44 4 28 4 Q8 4 8 22 Q8 38 29 44 Q50 50 50 66 Q50 84 29 84 Q12 84 6 68",
  T: "M4 4 H54 M29 4 V84",
  U: "M6 4 V56 Q6 84 29 84 Q52 84 52 56 V4",
  V: "M4 4 L29 84 L54 4",
  W: "M2 4 L15 84 L29 30 L43 84 L56 4",
  X: "M6 4 L52 84 M52 4 L6 84",
  Y: "M4 4 L29 44 L54 4 M29 44 V84",
  Z: "M6 4 H52 L6 84 H52",
  0: "M29 4 Q54 4 54 44 Q54 84 29 84 Q4 84 4 44 Q4 4 29 4 Z",
  1: "M14 22 L32 4 V84 M14 84 H50",
  2: "M8 24 Q10 4 29 4 Q50 4 50 24 Q50 40 8 84 H52",
  3: "M8 14 Q16 4 29 4 Q50 4 50 24 Q50 42 24 42 M24 42 Q54 42 54 64 Q54 84 29 84 Q12 84 6 72",
  4: "M42 84 V4 L4 60 H56",
  5: "M50 4 H12 L8 40 Q18 34 30 34 Q52 34 52 60 Q52 84 28 84 Q12 84 6 72",
  6: "M46 10 Q38 4 29 4 Q6 4 6 50 Q6 84 29 84 Q52 84 52 60 Q52 38 29 38 Q10 38 7 56",
  7: "M4 4 H54 L22 84",
  8: "M29 44 Q8 44 8 24 Q8 4 29 4 Q50 4 50 24 Q50 44 29 44 Q4 44 4 64 Q4 84 29 84 Q54 84 54 64 Q54 44 29 44 Z",
  9: "M12 78 Q20 84 29 84 Q52 84 52 38 Q52 4 29 4 Q6 4 6 28 Q6 50 29 50 Q48 50 51 32",
};

/** Glyphs that look the same after a 180 degree turn; avoid them as the only orientation hint. */
export const SYMMETRIC_GLYPHS = new Set(["H", "I", "N", "O", "S", "X", "Z", "0", "8"]);

const f1 = (v) => +v.toFixed(1);
const xform = (d, ox, oy, s) =>
  [...d.matchAll(/([MLQHVZ])([^MLQHVZ]*)/g)].map(([, c, a]) => {
    const n = a.trim() ? a.trim().split(/[\s,]+/).map(Number) : [];
    if (c === "Z") return "Z";
    if (c === "H") return "H" + f1(ox + n[0] * s);
    if (c === "V") return "V" + f1(oy + n[0] * s);
    return c + n.map((v, i) => f1(i % 2 ? oy + v * s : ox + v * s)).join(" ");
  }).join(" ");

/** Path data of `str` centered at (cx, cy), scaled to fit maxW x maxH (stroke width sw included). */
export function glyphPath(str, cx, cy, maxW, maxH, sw, maxScale = 2) {
  const chars = [...String(str).toUpperCase()];
  for (const ch of chars) if (!GLYPHS[ch]) throw new Error(`no glyph for "${ch}"`);
  const n = chars.length, gap = sw * 0.45 + 4;
  const s = Math.min(maxScale, (maxW - sw - (n - 1) * gap) / (n * GLYPH_W), (maxH - sw) / GLYPH_H);
  const totalW = n * GLYPH_W * s + (n - 1) * gap + sw;
  const x0 = cx - totalW / 2 + sw / 2;
  const y0 = cy - (GLYPH_H * s) / 2;
  return chars.map((ch, i) => xform(GLYPHS[ch], x0 + i * (GLYPH_W * s + gap), y0, s)).join(" ");
}

/** Chunky white raised glyphs with an ink outline and an offset darker-tint shadow. */
export function blockText(str, cx, cy, maxW, maxH, sw, field, { ink = "#4a3b3b", maxScale = 2 } = {}) {
  const d = glyphPath(str, cx, cy, maxW, maxH, sw, maxScale);
  const st = (w, c, tr = "") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="round"${tr}/>`;
  return st(sw + 4, shade(field, 0.8), ' transform="translate(7 8)"') + st(sw + 4, ink) + st(sw, "#fff");
}
