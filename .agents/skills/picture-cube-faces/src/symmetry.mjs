/** Sticker classification for the skill: a thin adapter over `packages/cube-appearance` (owner decision D8: ONE
 * classifier, in the package; this module only prepares tiles and keeps the version-1 JSON shape the checker writes).
 * This is INFORMATION, not a verdict: the owner accepts equal-looking stickers and orientations (the cube then counts
 * as visually solved), and symmetric centers of an odd-N cube need not be turned within their period (D10).
 *
 * What the package does (see docs/CUBE_APPEARANCE.md): loose level (pixel tolerance 24, share 3 percent by default),
 * order from the half and quarter turn, identical groups and rotation-twin groups by complete linkage (two stickers
 * merge only when every cross pair is within tolerance; the old single-linkage union could chain A~B~C).
 *
 * Input: tiles [{id: "F_r_c", px}] where px is an RGBA array of probe x probe pixels (the sticker as the app shows it).
 * The comparison runs on a copy downsampled by DOWNSAMPLE, which absorbs antialiasing and keeps N = 7 fast; flatness
 * ("detail") is measured on the full probe.
 *
 * classifyTiles(tiles, { n, probe }) returns the version-1 shape (unchanged by the migration)
 * {
 *   version: 1, n, stickers, probe,               // probe = side of the compared (downsampled) picture
 *   thresholds: { minDetail, symmetry, duplicate },   // symmetry and duplicate are both the package's loose share
 *   tiles: [{ id, symmetry: "none" | "2-fold" | "4-fold", equivalentTurns: 1 | 2 | 4,
 *             detail, rotDiff: { r90, r180, r270 } }],
 *   counts: { stickers, symmetry: { none, twoFold, fourFold }, lackDetail,
 *             identicalGroups, identicalTiles, rotationTwinGroups, rotationTwinTiles },
 *   lackDetail: [id],                              // flat stickers (hard failure at strict N)
 *   identicalGroups: [[id]],                       // upright duplicates (the same picture twice)
 *   rotationTwinGroups: [[id]],                    // look alike only after a quarter turn
 *   centers: [{ id, face, symmetry, orientationNeeded, period }]   // odd N only: the fixed center sticker of each face
 * }
 * equivalentTurns = how many of the four quarter turns look alike (1 none, 2 two-fold, 4 four-fold).
 * orientationNeeded is the version-1 flag, false for a 2-fold or 4-fold symmetric center (legacy meaning, unchanged);
 * owner decision D10: a center need not be turned only within its period (4-fold any turn, 2-fold modulo a half turn),
 * so read `period`. The flag is the package's `orientationExact` (v1 meaning kept). `period` (additive) is the package's: a center is
 * solved when its quarter-turn offset is right modulo `period` (4 for none, 2 for 2-fold, 1 for 4-fold). The package
 * flag `orientationNeeded` (order below 4) is stricter than the v1 flag for 2-fold centers; see docs/CUBE_APPEARANCE.md.
 * `appearanceOf` returns the package's own Classification (both levels, offsets) for callers that want cubistry.appearance@2.
 */
import {
  LOOSE_THRESHOLDS,
  analyzeCenters,
  classifyTiles as classifyAppearance,
  detailOf,
  toRgb,
} from "../../../../packages/cube-appearance/src/index.ts";
import { MIN_DETAIL, PIXEL_DIFF, downsample } from "./metrics.mjs";
import { FACE_NAMES, tileId } from "./geometry.mjs";

export const SYMMETRY_VERSION = 1;
/** Share of pixels over the pixel tolerance up to which two stickers count as the same picture (and as symmetric). */
export const LOOSE_SHARE = LOOSE_THRESHOLDS.share;
export const DOWNSAMPLE = 2;

const NAMES = { 1: "none", 2: "2-fold", 4: "4-fold" };

/** Package classification (cubistry.appearance classifier) of skill tiles, at the skill's probe and tolerance. */
export function appearanceOf(tiles, { probe = null, tol = LOOSE_SHARE } = {}) {
  const side = probe ?? Math.round(Math.sqrt((tiles[0]?.px.length ?? 0) / 4));
  const f = side % DOWNSAMPLE === 0 ? DOWNSAMPLE : 1;
  const loose = { pixelTolerance: PIXEL_DIFF, share: tol };
  const small = tiles.map((t) => ({ id: t.id, side: side / f, data: f === 1 ? t.px : downsample(t.px, side, f) }));
  return classifyAppearance(small, { loose });
}

export function classifyTiles(tiles, { n = null, probe = null, minDetail = MIN_DETAIL, tol = LOOSE_SHARE, symmetryTol, duplicateTol } = {}) {
  if (symmetryTol !== undefined && duplicateTol !== undefined && symmetryTol !== duplicateTol) throw new Error("symmetryTol and duplicateTol are one threshold now (the package's loose share): pass `tol` or equal values");
  const share = symmetryTol ?? duplicateTol ?? tol;
  const side = probe ?? Math.round(Math.sqrt((tiles[0]?.px.length ?? 0) / 4));
  const cmp = side % DOWNSAMPLE === 0 ? side / DOWNSAMPLE : side;
  const empty = tiles.length === 0;
  const c = empty ? null : appearanceOf(tiles, { probe: side, tol: share });
  const input = new Map(tiles.map((t) => [t.id, t]));
  const rec = new Map((c?.tiles ?? []).map((t) => [t.id, t]));
  const rows = tiles.map((t) => {
    const r = rec.get(t.id), order = r.order.loose;
    const detail = detailOf(toRgb({ id: t.id, side, data: t.px }));
    return {
      id: t.id, symmetry: NAMES[order], equivalentTurns: order, detail: +detail.toFixed(4),
      rotDiff: { r90: +r.rotDiff.loose[0].toFixed(4), r180: +r.rotDiff.loose[1].toFixed(4), r270: +r.rotDiff.loose[2].toFixed(4) },
    };
  });
  const byGroup = (g) => g.sort((a, b) => a[0].localeCompare(b[0]));
  const identicalGroups = byGroup((c?.loose.identical ?? []).filter((g) => g.members.length > 1).map((g) => [...g.members].sort()));
  const rotationTwinGroups = byGroup((c?.loose.twins ?? []).filter((g) => g.identical.length > 1).map((g) => g.members.map((m) => m.id).sort()));
  const lackDetail = rows.filter((t) => t.detail < minDetail).map((t) => t.id);
  const count = (s) => rows.filter((t) => t.symmetry === s).length;
  const centers = [];
  if (c && n && n % 2 === 1) {
    const mid = (n - 1) / 2;
    const ids = FACE_NAMES.map((f) => tileId(f, mid, mid)).filter((id) => input.has(id));
    for (const r of analyzeCenters(c, ids, "loose")) {
      centers.push({ id: r.id, face: r.id.split("_")[0], symmetry: NAMES[r.order], orientationNeeded: r.orientationExact, period: r.period });
    }
  }
  return {
    version: SYMMETRY_VERSION, n, stickers: rows.length, probe: cmp,
    thresholds: { minDetail, symmetry: share, duplicate: share },
    tiles: rows,
    counts: {
      stickers: rows.length,
      symmetry: { none: count("none"), twoFold: count("2-fold"), fourFold: count("4-fold") },
      lackDetail: lackDetail.length,
      identicalGroups: identicalGroups.length, identicalTiles: identicalGroups.flat().length,
      rotationTwinGroups: rotationTwinGroups.length, rotationTwinTiles: rotationTwinGroups.flat().length,
    },
    lackDetail, identicalGroups, rotationTwinGroups, centers,
  };
}

/** One-line human summary of a classification (used by the checker). */
export function summarize(c) {
  const s = c.counts.symmetry;
  let line = `symmetry none ${s.none} / 2-fold ${s.twoFold} / 4-fold ${s.fourFold}; ${c.counts.identicalGroups} identical group(s) (${c.counts.identicalTiles} stickers); ${c.counts.rotationTwinGroups} rotation-twin group(s) (${c.counts.rotationTwinTiles} stickers); ${c.counts.lackDetail} lack detail`;
  if (c.centers.length) {
    const free = c.centers.filter((x) => !x.orientationNeeded).length;
    line += `; centers: ${free} of ${c.centers.length} need no orientation within their period`;
  }
  return line;
}
