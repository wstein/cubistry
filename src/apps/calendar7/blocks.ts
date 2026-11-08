// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * English 7x7 calendar cube, block moves (research candidate, not certified). A DISPLAY LAYER ONLY: the stored data
 * stays words of single-layer moves (generators 1..21); this module regroups a word for the notation and the animation.
 * Pure functions, no DOM, no timers.
 *
 * Why it is safe: all moves about one axis commute (each layer turns about the same axis, the layers are disjoint).
 * So in a maximal run of consecutive single-layer moves about the same axis the moves may be reordered freely, and
 * moves with the same exponent on layers that are next to each other may turn as ONE block. The grouping keeps the
 * multiset of (axis, layer, exponent) of the run exactly, so `expand(groupBlocks(word))` is state-identical to `word`
 * (it is another order of the same moves within each run); no move is cancelled, added or rewritten.
 *
 * Blocks:
 *  - layers are -3, -2, -1, 1, 2, 3 (layer 0 exists physically but is never turned alone, there is no generator). Layers
 *    -1 and +1 are NOT neighbors: a block across the middle would have to turn layer 0 too, which no word does;
 *  - a block is a contiguous range of layers on one side, `lo..hi`, with one exponent (-1, 1 or 2) and one axis. The
 *    kind is `single` (one layer), `outer-wide` (several layers, includes the outer layer -3 or +3) or `inner-wide`
 *    (several layers, inner only: -2..-1 or +1..+2). A block of 7 layers would be a whole-cube rotation, which a word
 *    can only contain as its own generator (7, 14, 21): it stays a `rotation` block (free, as today);
 *  - a whole-cube rotation ends a run (conservative: nothing is merged across it).
 */
import {
  applyMoveInPlace,
  checkMove,
  generatorAxis,
  generatorLayer,
  isRotation,
  type Move,
  type Pose,
} from "./engine.ts";

export type BlockKind = "single" | "outer-wide" | "inner-wide" | "rotation";
export type Angle = -1 | 1 | 2;

export interface Block {
  /** 0, 1, 2 = x, y, z. */
  readonly axis: number;
  /** Lowest and highest layer of the block, -3..3 (a rotation: -3 and 3, the whole cube). */
  readonly lo: number;
  readonly hi: number;
  /** Quarter-turn exponent of every layer of the block, as in `Move`. */
  readonly angle: Angle;
  readonly kind: BlockKind;
}

const LAYERS = [-3, -2, -1, 1, 2, 3] as const;
const AXES = ["x", "y", "z"] as const;

/** Generator 1..21 of a layer move (layer -3..-1, 1..3) about `axis`; 7 * axis + 7 is the rotation. */
export const layerGenerator = (axis: number, layer: number): number => {
  const slot = LAYERS.indexOf(layer as (typeof LAYERS)[number]);
  if (slot < 0) throw new RangeError(`layer ${layer} is not a turnable layer`);
  return 7 * axis + slot + 1;
};

function kindOf(lo: number, hi: number): BlockKind {
  if (lo === hi) return "single";
  return lo === -3 || hi === 3 ? "outer-wide" : "inner-wide";
}

/** Blocks of one run: layer moves about `axis`, in any order (they commute). */
function groupRun(axis: number, run: readonly Move[], out: Block[]): void {
  // Per exponent (in order of first appearance): how often each layer turns by it.
  const byAngle = new Map<number, Map<number, number>>();
  for (const [g, q] of run) {
    const layer = generatorLayer(g);
    let counts = byAngle.get(q);
    if (!counts) byAngle.set(q, (counts = new Map()));
    counts.set(layer, (counts.get(layer) ?? 0) + 1);
  }
  for (const [angle, counts] of byAngle) {
    const most = Math.max(...counts.values());
    // Round r holds the layers that turn more than r times by this exponent: the minimum number of ranges.
    for (let r = 0; r < most; r++) {
      const layers = LAYERS.filter((l) => (counts.get(l) ?? 0) > r);
      let lo = layers[0];
      for (let i = 0; i < layers.length; i++) {
        const hi = layers[i];
        if (i + 1 < layers.length && layers[i + 1] === hi + 1) continue;
        out.push({ axis, lo, hi, angle: angle as Angle, kind: kindOf(lo, hi) });
        lo = layers[i + 1];
      }
    }
  }
}

/** Groups a move word into blocks (deterministic). Whole-cube rotations stay single blocks of kind `rotation`. */
export function groupBlocks(word: readonly Move[]): Block[] {
  const out: Block[] = [];
  let run: Move[] = [];
  let axis = -1;
  const flush = (): void => {
    if (run.length) groupRun(axis, run, out);
    run = [];
  };
  for (const move of word) {
    checkMove(move);
    const a = generatorAxis(move[0]);
    if (isRotation(move[0])) {
      flush();
      axis = -1;
      out.push({ axis: a, lo: -3, hi: 3, angle: move[1] as Angle, kind: "rotation" });
      continue;
    }
    if (a !== axis) flush();
    axis = a;
    run.push(move);
  }
  flush();
  return out;
}

/** The single-layer moves of one block, lowest layer first. */
export function expandBlock(block: Block): Move[] {
  if (block.kind === "rotation") return [[7 * block.axis + 7, block.angle]];
  const moves: Move[] = [];
  for (const layer of LAYERS) if (layer >= block.lo && layer <= block.hi) moves.push([layerGenerator(block.axis, layer), block.angle]);
  return moves;
}
/** The word of single-layer moves (generators 1..21) a block list stands for. */
export const expand = (blocks: readonly Block[]): Move[] => blocks.flatMap(expandBlock);

/** Applies a whole block to `pose` in place. */
export function applyBlockInPlace(pose: Pose, block: Block): void {
  for (const move of expandBlock(block)) applyMoveInPlace(pose, move);
}

/** Layer moves a block stands for (a rotation is not a layer move: 0). */
export const blockLayers = (block: Block): number => (block.kind === "rotation" ? 0 : block.hi - block.lo + 1);

export interface BlockCounts {
  /** Layer moves (HTM): one per layer of every block, a half turn once. Equals `metrics(word).htm`. */
  readonly layerMoves: number;
  /** Block moves: one per non-rotation block. */
  readonly blockMoves: number;
  /** Whole-cube rotations (free, counted separately as before). */
  readonly rotations: number;
}
export function blockCounts(blocks: readonly Block[]): BlockCounts {
  let layerMoves = 0,
    blockMoves = 0,
    rotations = 0;
  for (const b of blocks) {
    if (b.kind === "rotation") rotations++;
    else {
      blockMoves++;
      layerMoves += blockLayers(b);
    }
  }
  return { layerMoves, blockMoves, rotations };
}

const layerText = (l: number): string => `${l > 0 ? "+" : ""}${l}`;
const turnText = (angle: Angle): string => (angle === -1 ? "'" : angle === 2 ? "²" : "");

/**
 * Own notation of a block: axis, layers, turn. `x-3` one layer; `x-3..-2` a range of layers (wide when it includes the
 * outer layer, inner-wide otherwise); `xrot` the whole cube. Then `'` for a counter-clockwise quarter turn (negative
 * exponent) or `²` for a half turn. The single-layer and rotation tokens equal `moveToken`.
 */
export function blockToken(block: Block): string {
  const axis = AXES[block.axis];
  const where =
    block.kind === "rotation" ? "rot" : block.lo === block.hi ? layerText(block.lo) : `${layerText(block.lo)}..${layerText(block.hi)}`;
  return `${axis}${where}${turnText(block.angle)}`;
}
