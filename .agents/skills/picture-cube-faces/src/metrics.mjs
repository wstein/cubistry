/** Pixel constants and the downsampler for tile legibility. The classification itself (symmetry, identical groups,
 * rotation twins, detail) lives in packages/cube-appearance and is reached through symmetry.mjs. */
export const MIN_DETAIL = 0.08; // share of pixels that are not the tile's dominant color
export const PIXEL_DIFF = 24; // a pixel "changes" when any channel differs by more than this (the package's loose level)

/** Box-filter downsample by an integer factor (n must be divisible by it). Returns a new RGBA array of (n / f)^2 pixels. */
export function downsample(d, n, f) {
  const m = n / f, e = new Uint8ClampedArray(m * m * 4);
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) for (let ch = 0; ch < 4; ch++) {
    let sum = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) sum += d[((y * f + j) * n + x * f + i) * 4 + ch];
    e[(y * m + x) * 4 + ch] = Math.round(sum / (f * f));
  }
  return e;
}
