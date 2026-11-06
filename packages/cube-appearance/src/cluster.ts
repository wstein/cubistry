import type { Turn } from "./tiles.ts";

/** A cluster member with its quarter-turn offset: member == cluster frame turned counterclockwise by `offset`. */
export interface Member {
  readonly index: number;
  readonly offset: Turn;
}
export type Cluster = readonly Member[];

/**
 * Deterministic complete-linkage agglomeration. Two clusters merge only when EVERY cross pair is within
 * tolerance (with consistent quarter-turn offsets when `rotations` is set), so a chain A~B, B~C never
 * pulls in C when A and C differ. A tile that fits several clusters stays with the closest one (ties go to
 * the lowest indexes), which can split a looser grouping: a false split is harmless, a false merge is not.
 *
 * `share(a, b, k)` is the differing share between tile `a` turned by `k` quarter turns and tile `b`.
 * `ok(share)` says whether a share is within tolerance. `start` are initial clusters (default singletons).
 */
export function completeLinkage(
  count: number,
  share: (a: number, b: number, k: number) => number,
  ok: (share: number) => boolean,
  rotations: boolean,
  start?: readonly Cluster[],
): Cluster[] {
  let clusters: Member[][] = (start ?? Array.from({ length: count }, (_, i) => [{ index: i, offset: 0 as Turn }])).map(
    (c) => c.map((m) => ({ ...m })),
  );
  const memo = new Float64Array(count * count * 4).fill(Number.NaN);
  const cached = (a: number, b: number, k: number): number => {
    const key = (a * count + b) * 4 + k;
    if (Number.isNaN(memo[key])) memo[key] = share(a, b, k);
    return memo[key];
  };
  const link = (A: Member[], B: Member[], r: number): number => {
    let worst = 0;
    for (const a of A)
      for (const b of B) {
        const s = cached(a.index, b.index, (((b.offset + r - a.offset) % 4) + 4) % 4);
        if (s > worst) worst = s;
        if (!ok(worst)) return worst;
      }
    return worst;
  };
  for (;;) {
    let best: { value: number; i: number; j: number; r: number } | null = null;
    for (let i = 0; i < clusters.length; i++)
      for (let j = i + 1; j < clusters.length; j++)
        for (let r = 0; r < (rotations ? 4 : 1); r++) {
          const value = link(clusters[i], clusters[j], r);
          if (ok(value) && (best === null || value < best.value)) best = { value, i, j, r };
        }
    if (best === null) break;
    const { i, j, r } = best;
    const merged = [
      ...clusters[i],
      ...clusters[j].map((m) => ({ index: m.index, offset: ((m.offset + r) % 4) as Turn })),
    ].sort((x, y) => x.index - y.index);
    // Keep the lowest member as the frame: re-reference every offset to it.
    const base = merged[0].offset;
    const rebased = merged.map((m) => ({ index: m.index, offset: ((((m.offset - base) % 4) + 4) % 4) as Turn }));
    clusters = clusters.filter((_, x) => x !== i && x !== j);
    clusters.push(rebased);
    clusters.sort((x, y) => x[0].index - y[0].index);
  }
  return clusters;
}
