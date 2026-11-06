import type { Rotation, Vec3 } from "@cubistry/cube-core";
import { appearanceSha256, type AppearanceMap } from "./map.ts";
import type { SymmetryOrder } from "./tiles.ts";

/**
 * How "looks solved" is judged. Owner decisions: the default is visually solved (D4); a strict identity
 * mode exists; rotation twins (a tile that is another turned by a quarter turn, like 6 and 9) are a
 * per-print flag, on for pictures and off for date, time and counter displays (D2); a whole-cube rotation
 * counts for the display badge but not for solvers, which aim at the fixed frame (D1).
 */
export interface AppearancePolicy {
  /** `identity`: asset ids and exact frames, no appearance map (the `matchesTarget` semantics, plus sticker ids when a goal pins them). */
  readonly mode: "identity" | "visual";
  /** Visual mode only: tiles of one rotation-twin class count as equal when their turns agree. */
  readonly rotationTwins: boolean;
  /** Accept the goal in any of the 24 whole-cube frames (display badge); solvers keep this off. */
  readonly wholeCubeRotation: boolean;
}

export const makePolicy = (p: Partial<AppearancePolicy> = {}): AppearancePolicy =>
  Object.freeze({ mode: "visual", rotationTwins: false, wholeCubeRotation: false, ...p });

/** Strict physical identity: reproduces today's exact behavior. */
export const POLICY_IDENTITY: AppearancePolicy = makePolicy({ mode: "identity" });
/** Picture cubes: all six faces constrained, rotation twins equal, fixed frame. */
export const POLICY_PICTURE: AppearancePolicy = makePolicy({ rotationTwins: true });
/** Date, time and counter displays: digits 6 and 9 must stay different, so no rotation twins. */
export const POLICY_DISPLAY: AppearancePolicy = makePolicy({ rotationTwins: false });

/** How a sticker looks under a map and policy: class, twin offset and symmetry order. */
export interface Look {
  readonly cls: string;
  /** Quarter-turn offset of the asset's upright picture against its class representative. */
  readonly tau: number;
  readonly order: SymmetryOrder;
}

export interface StickerAsset {
  readonly assetId: string;
  readonly equivalentQuarterTurns: readonly number[];
}

export const orderOfTurns = (turns: readonly number[]): SymmetryOrder => {
  if (turns.length === 1) return 1;
  if (turns.length === 2) return 2;
  if (turns.length === 4) return 4;
  throw new Error("Invalid optical symmetry");
};

/**
 * Without a map (or in identity mode) each asset is its own class and the order comes from the sticker's
 * `equivalentQuarterTurns`: exactly what `matchesTarget` uses.
 */
export function lookOf(s: StickerAsset, map: AppearanceMap | null, policy: AppearancePolicy): Look {
  if (policy.mode === "identity" || map === null)
    return { cls: s.assetId, tau: 0, order: orderOfTurns(s.equivalentQuarterTurns) };
  const a = map.assets[s.assetId];
  if (!a) throw new Error(`Asset ${s.assetId} is not in the appearance map`);
  if (policy.rotationTwins) return { cls: a.twin, tau: a.turn, order: map.classes[a.twin].order };
  return { cls: a.identical, tau: 0, order: map.classes[a.identical].order };
}

/** Throws when a goal pins an appearance map that is not the one supplied. */
export function checkPinnedMap(pinned: string | null, map: AppearanceMap | null, policy: AppearancePolicy): void {
  if (policy.mode === "identity" || pinned === null) return;
  if (map === null) throw new Error("The goal pins an appearance map, but none was supplied");
  if (appearanceSha256(map) !== pinned) throw new Error("The supplied appearance map is not the one the goal pins");
}

export type { Rotation, Vec3 };
