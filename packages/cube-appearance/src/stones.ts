import type { Rotation, Vec3 } from "@cubistry/cube-core";
import { eq, rotate } from "@cubistry/cube-core";
import { CUBE_ROTATIONS, inverse, quarterIndex, then } from "./geometry.ts";
import type { AppearanceMap } from "./map.ts";
import { lookOf, type AppearancePolicy, type StickerAsset } from "./policy.ts";

/** Structural slice of a `PrintDefinition`: also accepts prints of sizes the validator does not support yet. */
export interface StonePrint {
  readonly cubies: readonly { readonly id: number; readonly position: Vec3 }[];
  readonly stickers: readonly (StickerAsset & {
    readonly id: number;
    readonly cubie: number;
    readonly normal: Vec3;
    readonly up: Vec3;
  })[];
}

/** One generator of the appearance-automorphism group H, acting on states by relabeling stones. */
export type Automorphism =
  | { readonly kind: "swap"; readonly a: number; readonly b: number; readonly forward: Rotation; readonly backward: Rotation }
  | { readonly kind: "turn"; readonly cubie: number; readonly frame: Rotation };

export interface StoneModel {
  /** Groups of interchangeable stones (cubie ids, ascending), ordered by smallest id; singletons included. */
  readonly classes: readonly (readonly number[])[];
  readonly classOf: ReadonlyMap<number, number>;
  /**
   * All rigid frames g with `g * home(from) = home(to)` under which every sticker of `from` lands on a
   * sticker of `to` that looks the same (same class, equal turn modulo the symmetry period).
   * `frames(p, p)` is the stone's own symmetry group: identity plus its look-alike twists.
   */
  frames(from: number, to: number): readonly Rotation[];
  /** Generators of H: one swap per further class member, plus every non-identity own symmetry. */
  readonly generators: readonly Automorphism[];
}

/**
 * Derives interchangeable stones (pieces) from stickers plus geometry. It works on any print whose cubies
 * carry their home position and stickers, so it covers 2x2 corners and odd-N centers (one sticker, own
 * symmetry = the center's period) alike. For N >= 4 the same rule is the natural reading of "identical
 * stones with induced rotation" (owner decision D6), but no engine moves such pieces yet: unverified.
 */
export function deriveStones(print: StonePrint, map: AppearanceMap | null, policy: AppearancePolicy): StoneModel {
  const ids = [...new Set(print.stickers.map((s) => s.cubie))].sort((a, b) => a - b);
  const position = new Map(print.cubies.map((c) => [c.id, c.position] as const));
  const stickersOf = new Map(ids.map((id) => [id, print.stickers.filter((s) => s.cubie === id)] as const));
  const cache = new Map<string, Rotation[]>();
  const frames = (from: number, to: number): readonly Rotation[] => {
    const k = `${from}>${to}`;
    const hit = cache.get(k);
    if (hit) return hit;
    const pf = position.get(from),
      pt = position.get(to);
    const out: Rotation[] = [];
    if (pf && pt) {
      const src = stickersOf.get(from) ?? [],
        dst = stickersOf.get(to) ?? [];
      for (const g of CUBE_ROTATIONS) {
        if (!eq(rotate(pf, g), pt) || src.length !== dst.length) continue;
        const ok = src.every((s) => {
          const n = rotate(s.normal, g);
          const t = dst.find((d) => eq(d.normal, n));
          if (!t) return false;
          const ls = lookOf(s, map, policy),
            lt = lookOf(t, map, policy);
          if (ls.cls !== lt.cls) return false;
          const turn = ls.tau + quarterIndex(n, rotate(s.up, g)) - lt.tau - quarterIndex(t.normal, t.up);
          return (((turn % (4 / lt.order)) + 4 / lt.order) % (4 / lt.order)) === 0;
        });
        if (ok) out.push(g);
      }
    }
    cache.set(k, out);
    return out;
  };
  // The relation is an equivalence (frames compose and invert), so a first-fit scan is exact.
  const classes: number[][] = [];
  for (const id of ids) {
    const home = classes.find((c) => frames(c[0], id).length > 0);
    if (home) home.push(id);
    else classes.push([id]);
  }
  const classOf = new Map<number, number>();
  classes.forEach((c, i) => c.forEach((id) => classOf.set(id, i)));
  const generators: Automorphism[] = [];
  for (const c of classes) {
    for (const b of c.slice(1)) {
      const forward = frames(c[0], b)[0];
      generators.push({ kind: "swap", a: c[0], b, forward, backward: inverse(forward) });
    }
  }
  for (const id of ids)
    for (const frame of frames(id, id)) {
      const isIdentity = CUBE_ROTATIONS[0].every((row, i) => eq(row, frame[i]));
      if (!isIdentity) generators.push({ kind: "turn", cubie: id, frame });
    }
  return { classes, classOf, frames, generators };
}

export interface PlacedStone {
  readonly id: number;
  readonly position: Vec3;
  readonly orientation: Rotation;
}

/**
 * Applies one generator of H to a state: the stones are relabeled (a swap moves each stone into the other's
 * slot, with the induced frame) or turned in place. The picture does not change; the physical state does.
 */
export function applyAutomorphism<S extends { readonly cubies: readonly PlacedStone[] }>(state: S, h: Automorphism): S {
  const find = (id: number) => state.cubies.find((c) => c.id === id);
  const cubies = state.cubies.map((c): PlacedStone => {
    if (h.kind === "turn") return c.id === h.cubie ? { ...c, orientation: then(h.frame, c.orientation) } : c;
    if (c.id === h.a) {
      const other = find(h.b);
      if (!other) throw new Error("State lacks the swapped stone");
      return { id: c.id, position: other.position, orientation: then(h.forward, other.orientation) };
    }
    if (c.id === h.b) {
      const other = find(h.a);
      if (!other) throw new Error("State lacks the swapped stone");
      return { id: c.id, position: other.position, orientation: then(h.backward, other.orientation) };
    }
    return c;
  });
  return { ...state, cubies };
}
