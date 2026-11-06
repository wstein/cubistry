import { canonicalSha256 } from "./canonical.ts";
import { completeLinkage, type Cluster } from "./cluster.ts";
import {
  detailOf,
  differingShare,
  rotateRgb,
  tileHash,
  toRgb,
  within,
  type Rgb,
  type SymmetryOrder,
  type Thresholds,
  type Tile,
  type Turn,
} from "./tiles.ts";

/**
 * Strict thresholds decide what solvers and the "solved" badge may treat as equal: a false merge would
 * report an unsolved cube as solved. Roughly half a percent of the pixels may differ.
 * Vector themes should use {@link EXACT_THRESHOLDS}: their renders are bit-identical when the art is.
 */
export const STRICT_THRESHOLDS: Thresholds = Object.freeze({ pixelTolerance: 16, share: 0.005 });
/** Loose thresholds are for advice only (suitability display, skill report): they may over-merge. */
export const LOOSE_THRESHOLDS: Thresholds = Object.freeze({ pixelTolerance: 24, share: 0.03 });
/** Exact pixel equality, for vector themes (owner decision D3). */
export const EXACT_THRESHOLDS: Thresholds = Object.freeze({ pixelTolerance: 0, share: 0 });

export interface ClassifyOptions {
  readonly strict?: Thresholds;
  readonly loose?: Thresholds;
}

export type Level = "strict" | "loose";

export interface IdenticalGroup {
  /** `i0`, `i1`, ...: numbered by the smallest member id; singletons included. */
  readonly id: string;
  readonly members: readonly string[];
  readonly order: SymmetryOrder;
}
export interface TwinGroup {
  /** `t0`, `t1`, ...: rotation-twin class. Contains whole identical groups. */
  readonly id: string;
  /** `turn`: the tile equals the class representative (the smallest member id) turned this many quarter turns. */
  readonly members: readonly { readonly id: string; readonly turn: Turn }[];
  readonly identical: readonly string[];
  readonly order: SymmetryOrder;
}
export interface Nearest {
  readonly id: string;
  readonly share: number;
}
export interface TileReport {
  readonly id: string;
  /** Hash of the composited pixels; equal hashes are identical tiles. */
  readonly hash: string;
  /** Share of non-dominant pixels; low means mostly flat. */
  readonly detail: number;
  /** Differing shares against the tile turned by 1, 2 and 3 quarter turns (at the level's pixel tolerance). */
  readonly rotDiff: Readonly<Record<Level, readonly [number, number, number]>>;
  readonly order: Readonly<Record<Level, SymmetryOrder>>;
  /** Closest tile outside the own identical class (same orientation) and outside the own twin class (any turn), per level. */
  readonly nearestOther: Readonly<Record<Level, { readonly identical: Nearest | null; readonly twin: Nearest | null }>>;
}
export interface LevelAnalysis {
  readonly thresholds: Thresholds;
  readonly identical: readonly IdenticalGroup[];
  readonly twins: readonly TwinGroup[];
}
export interface Classification {
  readonly sample: number;
  readonly tiles: readonly TileReport[];
  /** Groups of two or more tiles with equal pixel hashes (independent of any threshold). */
  readonly exactGroups: readonly (readonly string[])[];
  readonly strict: LevelAnalysis;
  readonly loose: LevelAnalysis;
  /** Hash of the input pixels: ties the result (and any map derived from it) to the rendered tiles. */
  readonly inputSha256: string;
}

/** Symmetry order of one tile at a level: 4 needs both the quarter and the half turn to look the same. */
export function symmetryOrder(rot: readonly [number, number, number], th: Thresholds): SymmetryOrder {
  if (within(rot[0], th) && within(rot[1], th)) return 4;
  return within(rot[1], th) ? 2 : 1;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function classifyTiles(input: readonly Tile[], options: ClassifyOptions = {}): Classification {
  if (input.length === 0) throw new Error("No tiles to classify");
  const tiles = [...input].sort((a, b) => compare(a.id, b.id));
  tiles.forEach((t, i) => {
    if (i > 0 && tiles[i - 1].id === t.id) throw new Error(`Duplicate tile id ${t.id}`);
    if (t.side !== tiles[0].side) throw new Error("All tiles must have the same side");
  });
  const thresholds = { strict: options.strict ?? STRICT_THRESHOLDS, loose: options.loose ?? LOOSE_THRESHOLDS };
  const rgb = tiles.map(toRgb);
  const hashes = rgb.map(tileHash);
  const turned: Rgb[][] = rgb.map((t) => [0, 1, 2, 3].map((k) => rotateRgb(t, k)));
  const n = tiles.length;

  const analysis = {} as Record<Level, LevelAnalysis>;
  const perTile = tiles.map(() => ({
    rotDiff: {} as Record<Level, readonly [number, number, number]>,
    order: {} as Record<Level, SymmetryOrder>,
    nearestOther: {} as Record<Level, { identical: Nearest | null; twin: Nearest | null }>,
  }));
  for (const level of ["strict", "loose"] as const) {
    const th = thresholds[level];
    const share = (a: number, b: number, k: number) => differingShare(turned[a][k], rgb[b], th.pixelTolerance);
    const ok = (s: number) => within(s, th);
    tiles.forEach((_, i) => {
      const rot: [number, number, number] = [1, 2, 3].map((k) =>
        differingShare(rgb[i], turned[i][k], th.pixelTolerance),
      ) as [number, number, number];
      perTile[i].rotDiff[level] = rot;
      perTile[i].order[level] = symmetryOrder(rot, th);
    });
    const identical = completeLinkage(n, share, ok, false);
    const twins = completeLinkage(n, share, ok, true, identical);
    const identicalClassOf = new Map<number, number>();
    identical.forEach((c, ci) => c.forEach((m) => identicalClassOf.set(m.index, ci)));
    const twinClassOf = new Map<number, number>();
    twins.forEach((c, ci) => c.forEach((m) => twinClassOf.set(m.index, ci)));
    const minOrder = (c: Cluster): SymmetryOrder =>
      Math.min(...c.map((m) => perTile[m.index].order[level])) as SymmetryOrder;
    analysis[level] = {
      thresholds: th,
      identical: identical.map((c, ci) => ({
        id: `i${ci}`,
        members: c.map((m) => tiles[m.index].id),
        order: minOrder(c),
      })),
      twins: twins.map((c, ci) => {
        const order = minOrder(c);
        const period = 4 / order;
        return {
          id: `t${ci}`,
          members: c.map((m) => ({ id: tiles[m.index].id, turn: (m.offset % period) as Turn })),
          identical: [...new Set(c.map((m) => `i${identicalClassOf.get(m.index)}`))].sort((a, b) =>
            Number(a.slice(1)) - Number(b.slice(1)),
          ),
          order,
        };
      }),
    };
    // Diagnostics: how close is the nearest tile that is NOT in the same class?
    tiles.forEach((_, i) => {
      let id: Nearest | null = null,
        tw: Nearest | null = null;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        if (identicalClassOf.get(j) !== identicalClassOf.get(i)) {
          const s = share(i, j, 0);
          if (id === null || s < id.share) id = { id: tiles[j].id, share: s };
        }
        if (twinClassOf.get(j) !== twinClassOf.get(i)) {
          const s = Math.min(...[0, 1, 2, 3].map((k) => share(i, j, k)));
          if (tw === null || s < tw.share) tw = { id: tiles[j].id, share: s };
        }
      }
      perTile[i].nearestOther[level] = { identical: id, twin: tw };
    });
  }

  const byHash = new Map<string, string[]>();
  tiles.forEach((t, i) => byHash.set(hashes[i], [...(byHash.get(hashes[i]) ?? []), t.id]));
  return {
    sample: tiles[0].side,
    tiles: tiles.map((t, i) => ({ id: t.id, hash: hashes[i], detail: detailOf(rgb[i]), ...perTile[i] })),
    exactGroups: [...byHash.values()].filter((g) => g.length > 1),
    strict: analysis.strict,
    loose: analysis.loose,
    inputSha256: canonicalSha256(tiles.map((t, i) => [t.id, t.side, hashes[i]])),
  };
}

export interface CenterReport {
  readonly id: string;
  readonly order: SymmetryOrder;
  /** Quarter turns that must match: 4 / order. A center is solved when its turn is correct modulo this. */
  readonly period: 1 | 2 | 4;
  /** The orientation of this center is visible (order below 4): it may need a quarter-turn correction. */
  readonly orientationNeeded: boolean;
  /** All four orientations look different (order 1): the PuzlWerk acceptance group with period 4. */
  readonly orientationExact: boolean;
}

/** Tile ids of the six centers of an odd-N cube, in the `F_row_col` form the skill uses (faces U R F D L B). */
export function centerTileIds(n: number): string[] {
  if (!Number.isInteger(n) || n < 3 || n % 2 === 0) throw new Error("Center tiles exist only for odd N >= 3");
  const m = (n - 1) / 2;
  return ["U", "R", "F", "D", "L", "B"].map((f) => `${f}_${m}_${m}`);
}

/** Center analysis for odd N: the middle sticker of every face, at the chosen level. */
export function analyzeCenters(c: Classification, ids: readonly string[], level: Level = "strict"): CenterReport[] {
  return ids.map((id) => {
    const t = c.tiles.find((v) => v.id === id);
    if (!t) throw new Error(`Unknown center tile ${id}`);
    const order = t.order[level];
    return {
      id,
      order,
      period: (4 / order) as 1 | 2 | 4,
      orientationNeeded: order !== 4,
      orientationExact: order === 1,
    };
  });
}
