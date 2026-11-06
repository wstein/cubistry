/** Sticker classification (pure, no I/O): how symmetric is each sticker, which stickers look the same, which look the
 * same when turned. This is INFORMATION, not a verdict: the owner accepts equal-looking stickers and orientations (the
 * cube then counts as visually solved), and symmetric centers of an odd-N cube need not be turned. The app solver and the
 * suitability display reuse this module; the JSON shape below is stable (bump `version` when it changes).
 *
 * Input: tiles [{id: "F_r_c", px}] where px is an RGBA array of probe x probe pixels (the sticker as the app shows it).
 * Distances are the share of pixels over PIXEL_DIFF on a copy downsampled by DOWNSAMPLE, which absorbs antialiasing.
 *
 * classifyTiles(tiles, { n, probe }) returns
 * {
 *   version: 1, n, stickers, probe,               // probe = side of the compared (downsampled) picture
 *   thresholds: { minDetail, symmetry, duplicate },
 *   tiles: [{ id, symmetry: "none" | "2-fold" | "4-fold", equivalentTurns: 1 | 2 | 4,
 *             detail, rotDiff: { r90, r180, r270 } }],
 *   counts: { stickers, symmetry: { none, twoFold, fourFold }, lackDetail,
 *             identicalGroups, identicalTiles, rotationTwinGroups, rotationTwinTiles },
 *   lackDetail: [id],                              // flat stickers (hard failure at strict N)
 *   identicalGroups: [[id]],                       // upright duplicates (the same picture twice)
 *   rotationTwinGroups: [[id]],                    // look alike only after a quarter turn
 *   centers: [{ id, face, symmetry, orientationNeeded }]   // odd N only: the fixed center sticker of each face
 * }
 * equivalentTurns = how many of the four quarter turns look alike (1 none, 2 two-fold, 4 four-fold).
 * orientationNeeded is false for a 2-fold or 4-fold symmetric center (owner rule: such a center need not be turned).
 */
import { MIN_DETAIL, MIN_ROT_DIFF, detailShare, rotationDiffs, rotateRgba, downsample, pixelDistance } from "./metrics.mjs";
import { FACE_NAMES, tileId } from "./geometry.mjs";

export const SYMMETRY_VERSION = 1;
export const DUPLICATE_TOL = 0.02; // share of pixels over PIXEL_DIFF below which two stickers count as the same picture
export const DOWNSAMPLE = 2;

/** "none" | "2-fold" | "4-fold" from the 90, 180 and 270 degree differences (shares of changed pixels). */
export function symmetryOf([d90, d180], tol = MIN_ROT_DIFF) {
  if (d90 < tol && d180 < tol) return "4-fold";
  if (d180 < tol) return "2-fold";
  return "none";
}
const TURNS = { none: 1, "2-fold": 2, "4-fold": 4 };

class Sets {
  constructor(n) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(i) { while (this.p[i] !== i) i = this.p[i] = this.p[this.p[i]]; return i; }
  union(a, b) { this.p[this.find(a)] = this.find(b); }
  groups() {
    const m = new Map();
    this.p.forEach((_, i) => { const r = this.find(i); m.set(r, [...(m.get(r) ?? []), i]); });
    return [...m.values()];
  }
}

export function classifyTiles(tiles, { n = null, probe = null, minDetail = MIN_DETAIL, symmetryTol = MIN_ROT_DIFF, duplicateTol = DUPLICATE_TOL } = {}) {
  const side = probe ?? Math.round(Math.sqrt((tiles[0]?.px.length ?? 0) / 4));
  const f = side % DOWNSAMPLE === 0 ? DOWNSAMPLE : 1, cmp = side / f;
  const rec = tiles.map((t) => {
    const small = downsample(t.px, side, f);
    const diffs = rotationDiffs(f === 1 ? t.px : small, cmp);
    const symmetry = symmetryOf(diffs, symmetryTol);
    return {
      id: t.id, symmetry, equivalentTurns: TURNS[symmetry], detail: +detailShare(t.px, side).toFixed(4),
      rotDiff: { r90: +diffs[0].toFixed(4), r180: +diffs[1].toFixed(4), r270: +diffs[2].toFixed(4) },
      rots: [0, 1, 2, 3].map((k) => rotateRgba(small, cmp, k)),
    };
  });
  const upright = new Sets(rec.length), anyTurn = new Sets(rec.length);
  for (let i = 0; i < rec.length; i++) for (let j = i + 1; j < rec.length; j++) {
    if (pixelDistance(rec[i].rots[0], rec[j].rots[0], cmp, { cutoff: duplicateTol }) <= duplicateTol) { upright.union(i, j); anyTurn.union(i, j); continue; }
    for (let k = 1; k < 4; k++) if (pixelDistance(rec[i].rots[0], rec[j].rots[k], cmp, { cutoff: duplicateTol }) <= duplicateTol) { anyTurn.union(i, j); break; }
  }
  const ids = (g) => g.map((i) => rec[i].id).sort();
  const identicalGroups = upright.groups().filter((g) => g.length > 1);
  const uprightRoot = (i) => upright.find(i);
  const rotationTwinGroups = anyTurn.groups().filter((g) => g.length > 1 && new Set(g.map(uprightRoot)).size > 1);
  const lackDetail = rec.filter((t) => t.detail < minDetail).map((t) => t.id);
  const count = (s) => rec.filter((t) => t.symmetry === s).length;
  const centers = [];
  if (n && n % 2 === 1) {
    const mid = (n - 1) / 2;
    for (const face of FACE_NAMES) {
      const t = rec.find((x) => x.id === tileId(face, mid, mid));
      if (t) centers.push({ id: t.id, face, symmetry: t.symmetry, orientationNeeded: t.symmetry === "none" });
    }
  }
  return {
    version: SYMMETRY_VERSION, n, stickers: rec.length, probe: cmp,
    thresholds: { minDetail, symmetry: symmetryTol, duplicate: duplicateTol },
    tiles: rec.map(({ rots, ...t }) => t),
    counts: {
      stickers: rec.length,
      symmetry: { none: count("none"), twoFold: count("2-fold"), fourFold: count("4-fold") },
      lackDetail: lackDetail.length,
      identicalGroups: identicalGroups.length, identicalTiles: identicalGroups.flat().length,
      rotationTwinGroups: rotationTwinGroups.length, rotationTwinTiles: rotationTwinGroups.flat().length,
    },
    lackDetail,
    identicalGroups: identicalGroups.map(ids).sort((a, b) => a[0].localeCompare(b[0])),
    rotationTwinGroups: rotationTwinGroups.map(ids).sort((a, b) => a[0].localeCompare(b[0])),
    centers,
  };
}

/** One-line human summary of a classification (used by the checker). */
export function summarize(c) {
  const s = c.counts.symmetry;
  let line = `symmetry none ${s.none} / 2-fold ${s.twoFold} / 4-fold ${s.fourFold}; ${c.counts.identicalGroups} identical group(s) (${c.counts.identicalTiles} stickers); ${c.counts.rotationTwinGroups} rotation-twin group(s) (${c.counts.rotationTwinTiles} stickers); ${c.counts.lackDetail} lack detail`;
  if (c.centers.length) {
    const free = c.centers.filter((x) => !x.orientationNeeded).length;
    line += `; centers: ${free} of ${c.centers.length} need no orientation`;
  }
  return line;
}
