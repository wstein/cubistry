/** Seam math (pure): compares a thin band of pixel lines of two faces along a shared edge.
 * A strip is a flat RGB array [r, g, b, r, g, b, ...] in canonical order (see geometry.mjs EDGES); a band is the
 * SEAM_BAND outermost lines of a side, outermost first. Line d of one face is compared with line d of the other, so a
 * block of art that stops one or two pixels short of the edge is seen (a single outer line would miss it).
 */
import { edgeSegments } from "./geometry.mjs";

export const SEAM_MEAN_LIMIT = 3; // mean max-channel difference, of 255
export const SEAM_BAND = 3; // pixel lines per side that are compared
export const SEAM_SEGMENT_LIMIT = 9; // worst mean difference of one sticker segment of an edge (3 x the mean limit)
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

/** Per-position difference of two bands (arrays of strips): the mean over the band lines of the max-channel difference. */
export function bandDiffs(bandA, bandB, rev = false) {
  if (bandA.length !== bandB.length) throw new Error("band depth mismatch");
  const per = bandA.map((a, d) => stripDiffs(a, bandB[d], rev));
  return per[0].map((_, i) => per.reduce((s, p) => s + p[i], 0) / per.length);
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

/** PASS/FAIL for an edge. Hard fail on the mean difference, on too many big pixel pairs, or on one bad sticker segment. */
export function seamVerdict(stats, { meanLimit = SEAM_MEAN_LIMIT, bigShare = SEAM_BIG_SHARE, segmentLimit = SEAM_SEGMENT_LIMIT } = {}) {
  return stats.mean <= meanLimit && stats.bigShare <= bigShare && stats.worstSegment <= segmentLimit;
}
