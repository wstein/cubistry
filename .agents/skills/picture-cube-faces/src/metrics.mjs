/** Pixel metrics for tile legibility (pure functions over RGBA arrays rendered at n x n; same thresholds as
 * scripts/check-pastel-garden-tiles.mjs). */
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

/** Quantized fingerprint string of a pixel buffer (4 bits per channel); equal pictures give equal strings. */
export function signature(d, n) {
  const out = new Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = bin(d, i * 4).toString(36);
  return out.join(",");
}

/** Fingerprints of the picture turned by 0, 90, 180 and 270 degrees. */
export function rotatedSignatures(d, n) {
  const sigs = [signature(d, n)];
  for (const m of ROT) {
    const e = new Uint8ClampedArray(d.length);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const [u, v] = m(x, y, n);
      e.set(d.subarray ? d.subarray((v * n + u) * 4, (v * n + u) * 4 + 4) : d.slice((v * n + u) * 4, (v * n + u) * 4 + 4), (y * n + x) * 4);
    }
    sigs.push(signature(e, n));
  }
  return sigs;
}

/**
 * Per-N evaluation of tile measurements. tiles: [{id, detail, minRot, sigs}] where sigs are the four rotated
 * fingerprints (see rotatedSignatures; sigs[0] is the upright one).
 * Returns the tiles lacking detail, the rotation-ambiguous tiles, groups of identical tiles and groups of
 * tiles that are identical up to a quarter turn ("rotation twins": legal on a physical cube only if the owner accepts it).
 */
export function evaluateTiles(tiles, { minDetail = MIN_DETAIL, minRot = MIN_ROT_DIFF } = {}) {
  const lackDetail = tiles.filter((t) => t.detail < minDetail).map((t) => t.id);
  const rotAmbiguous = tiles.filter((t) => t.minRot < minRot).map((t) => t.id);
  const bySig = new Map();
  for (const t of tiles) bySig.set(t.sigs[0], [...(bySig.get(t.sigs[0]) ?? []), t.id]);
  const identical = [...bySig.values()].filter((g) => g.length > 1);
  const twins = [];
  const seen = new Set(identical.flat());
  for (const t of tiles) {
    if (seen.has(t.id)) continue;
    const group = tiles.filter((o) => o.id !== t.id && o.sigs.slice(1).includes(t.sigs[0])).map((o) => o.id);
    if (group.length) { twins.push([t.id, ...group].sort()); }
  }
  const uniq = [...new Map(twins.map((g) => [g.join("|"), g])).values()];
  return { lackDetail, rotAmbiguous, identical, rotationTwins: uniq };
}
