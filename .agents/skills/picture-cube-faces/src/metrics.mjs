/** Pixel metrics for tile legibility (pure functions over RGBA arrays rendered at n x n; same thresholds as
 * scripts/check-pastel-garden-tiles.mjs). Symmetry classes and duplicate groups live in symmetry.mjs. */
export const MIN_DETAIL = 0.08; // share of pixels that are not the tile's dominant color
export const MIN_ROT_DIFF = 0.03; // share of pixels that change under the least-different rotation
export const PIXEL_DIFF = 24; // a pixel "changes" when any channel differs by more than this

const bin = (d, i) => (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);

/** 1 - share of the most common 4-bit color. */
export function detailShare(d, n) {
  const hist = new Map();
  for (let i = 0; i < n * n * 4; i += 4) hist.set(bin(d, i), (hist.get(bin(d, i)) ?? 0) + 1);
  return 1 - Math.max(...hist.values()) / (n * n);
}

const ROT = [
  (x, y, n) => [n - 1 - y, x],
  (x, y, n) => [n - 1 - x, n - 1 - y],
  (x, y, n) => [y, n - 1 - x],
];

/** Share of pixels that differ under each of the 90, 180 and 270 degree rotations. */
export function rotationDiffs(d, n, limit = PIXEL_DIFF) {
  return ROT.map((m) => {
    let k = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const [u, v] = m(x, y, n);
      const a = (y * n + x) * 4, b = (v * n + u) * 4;
      if (Math.abs(d[a] - d[b]) > limit || Math.abs(d[a + 1] - d[b + 1]) > limit || Math.abs(d[a + 2] - d[b + 2]) > limit) k++;
    }
    return k / (n * n);
  });
}

/** Picture turned by k quarter turns (k = 0..3; 1 = the 90 degree map of rotationDiffs). Returns a new RGBA array. */
export function rotateRgba(d, n, k) {
  if (k === 0) return Uint8ClampedArray.from(d);
  const m = ROT[k - 1], e = new Uint8ClampedArray(d.length);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const [u, v] = m(x, y, n), a = (v * n + u) * 4, b = (y * n + x) * 4;
    e[b] = d[a]; e[b + 1] = d[a + 1]; e[b + 2] = d[a + 2]; e[b + 3] = d[a + 3];
  }
  return e;
}

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

/** Share of pixels whose max channel difference exceeds `limit`. Stops early and returns > cutoff once cutoff is passed. */
export function pixelDistance(a, b, n, { limit = PIXEL_DIFF, cutoff = Infinity } = {}) {
  const total = n * n, max = cutoff * total;
  let k = 0;
  for (let i = 0; i < total * 4; i += 4) {
    if (Math.abs(a[i] - b[i]) > limit || Math.abs(a[i + 1] - b[i + 1]) > limit || Math.abs(a[i + 2] - b[i + 2]) > limit) {
      if (++k > max) return k / total;
    }
  }
  return k / total;
}
