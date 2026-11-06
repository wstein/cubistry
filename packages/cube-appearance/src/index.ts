/**
 * Pure, DOM-free appearance classification and "looks solved" judging.
 * Terminology: `order` is the rotational symmetry order of a sticker (1 none, 2 half turn, 4 quarter turn);
 * `period = 4 / order` is the number of quarter-turn steps that stay distinguishable. Do not confuse the
 * C1/C2/C4 group names with PuzlWerk ADR 0008 item 6, which names periods (its "C1" is period 4, "C4" period 1).
 */
export * from "./sha256.ts";
export * from "./canonical.ts";
export * from "./tiles.ts";
export * from "./classify.ts";
export * from "./map.ts";
export * from "./geometry.ts";
export * from "./policy.ts";
export * from "./stones.ts";
export * from "./goal.ts";
