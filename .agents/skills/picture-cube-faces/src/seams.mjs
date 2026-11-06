/** Seam math (pure): compares the outermost pixel line of two faces along a shared edge.
 * Strips are flat RGB arrays [r, g, b, r, g, b, ...] in canonical order (see geometry.mjs EDGES).
 */
import { edgeSegments } from "./geometry.mjs";

export const SEAM_MEAN_LIMIT = 3; // mean max-channel difference, of 255
export const SEAM_BIG = 16; // a single pixel pair counts as "big" above this
export const SEAM_BIG_SHARE = 0.1; // more than this share of big pixel pairs fails the edge

/** Per-position max-channel difference of two equal-length RGB strips; b is read backwards when rev. */
export function stripDiffs(a, b, rev = false) {
  const len = a.length / 3;
  if (b.length !== a.length) throw new Error("strip length mismatch");
  const out = new Array(len);
  for (let i = 0; i < len; i++) {
    const j = rev ? len - 1 - i : i;
    out[i] = Math.max(Math.abs(a[i * 3] - b[j * 3]), Math.abs(a[i * 3 + 1] - b[j * 3 + 1]), Math.abs(a[i * 3 + 2] - b[j * 3 + 2]));
  }
  return out;
}

/** Summary of one edge: overall mean/max, share above SEAM_BIG, and the worst sticker segment mean (N segments). */
export function edgeStats(diffs, n = 7) {
  const mean = (xs) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
  const segs = edgeSegments(diffs.length, n).map(([s, e]) => mean(diffs.slice(s, e)));
  return {
    mean: mean(diffs),
    max: Math.max(...diffs),
    bigShare: diffs.filter((v) => v > SEAM_BIG).length / diffs.length,
    segmentMeans: segs,
    worstSegment: Math.max(...segs),
  };
}

/** PASS/FAIL for an edge. Hard fail on mean difference or on too many big pixel pairs. */
export function seamVerdict(stats, { meanLimit = SEAM_MEAN_LIMIT, bigShare = SEAM_BIG_SHARE } = {}) {
  return stats.mean <= meanLimit && stats.bigShare <= bigShare;
}
