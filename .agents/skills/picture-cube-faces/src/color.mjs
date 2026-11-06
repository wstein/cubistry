/** Small color toolkit (pure). Colors are "#rrggbb" strings or [r, g, b] arrays (0..255). */
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export function parseHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb, got ${hex}`);
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

export function toHex(rgb) {
  return "#" + rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
}

/** Linear mix of two colors (hex in, hex out); t = 0 gives a, t = 1 gives b. */
export function mix(a, b, t) {
  const [x, y] = [parseHex(a), parseHex(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** Mixes float RGB arrays (no rounding), used inside samplers before quantizing. */
export const mixRgb = (x, y, t) => x.map((v, i) => v + (y[i] - v) * t);

/** Rounds every channel to a multiple of `step` (step 1 = no change). Identical input gives identical output. */
export function quantize(rgb, step = 1) {
  return rgb.map((v) => clamp(Math.round(v / step) * step, 0, 255));
}

/** Darkens a hex color (the Pastel "shade" used for offsets and shadows). */
export function shade(hex, k = 0.84) {
  const [r, g, b] = parseHex(hex);
  return toHex([r * k, g * k * 0.97, b * k]);
}

/** Largest per-channel absolute difference of two RGB triples. */
export const maxChannelDiff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

/** Evaluates vertical stops [[v, hex], ...] (v ascending in 0..1) at v; returns float RGB. */
export function stopsAt(stops, v) {
  if (v <= stops[0][0]) return parseHex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [v0, c0] = stops[i - 1];
      const [v1, c1] = stops[i];
      return mixRgb(parseHex(c0), parseHex(c1), v1 === v0 ? 0 : (v - v0) / (v1 - v0));
    }
  }
  return parseHex(stops[stops.length - 1][1]);
}
