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
 *
 * Middle-slice blocks ("rule c", opt in with `groupBlocks(word, { slice: true })`). Physically the layers are -3..3, and
 * a block may be any interval of them that contains layer 0 (a `slice` block, the middle slice turns with it). There
 * is no generator for such a turn, but the slab turn of an interval I with exponent q equals the whole-cube rotation
 * with exponent q composed with the inverse turns (-q) of the layers outside I (at most two intervals, neither contains
 * layer 0). So `expandBlock` of a slice block is a word of generators 1..21 and the state is exactly that of the slab
 * turn. In this mode a run is a maximal sequence of moves about one axis INCLUDING the rotations of that axis (they
 * commute with its layers); the run is replaced by the minimum number of intervals (any exponent, nested allowed) whose
 * turns add up to the same net exponent per layer, a turn of all 7 layers being a free rotation. Exact: Dijkstra over
 * the 4^7 states of one axis. The result is state-identical to the run but not a permutation of its moves (opposite
 * turns of a layer cancel, a rotation may be absorbed), so only the state, not the multiset, is kept. A slice block
 * counts as one block move; whole-cube rotations stay free. Display only: nothing stored changes.
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

export type BlockKind = "single" | "outer-wide" | "inner-wide" | "slice" | "rotation";
export type Angle = -1 | 1 | 2;

export interface Block {
  /** 0, 1, 2 = x, y, z. */
  readonly axis: number;
  /** Lowest and highest layer of the block, -3..3 (a rotation: -3 and 3, the whole cube; a slice block contains 0). */
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
  if (lo <= 0 && hi >= 0) return "slice";
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

export interface GroupOptions {
  /** Rule c: blocks may contain the middle layer 0 (kind `slice`), exact minimum per run. Default false: the blocks above. */
  readonly slice?: boolean;
}

// ---- rule c: exact minimum cover of the net exponent per layer by intervals of the 7 physical layers ----

/** Index 0..6 of the physical layer -3..3. */
const SLOT = (layer: number): number => layer + 3;
const SLICE_STATES = 4 ** 7;
const FULL_WEIGHT = 0;

interface SliceTable {
  readonly parent: Int32Array;
  readonly move: Int32Array;
  /** Move m: interval lo..hi (slots) and exponent t in 1..3. */
  readonly lo: Uint8Array;
  readonly hi: Uint8Array;
  readonly t: Uint8Array;
}
let sliceTable: SliceTable | null = null;

/**
 * Dijkstra from the zero state over the states "exponent mod 4 per layer" (4^7): a move is an interval of layers with an
 * exponent 1..3. Weight 1000 + width (fewest blocks first, then the narrowest), the full interval (a whole-cube rotation)
 * is free. Deterministic: moves in a fixed order, a state keeps the first parent that reaches its distance.
 */
function buildSliceTable(): SliceTable {
  const lo: number[] = [], hi: number[] = [], t: number[] = [], weight: number[] = [];
  for (let a = 0; a < 7; a++)
    for (let b = a; b < 7; b++)
      for (let e = 1; e <= 3; e++) {
        lo.push(a);
        hi.push(b);
        t.push(e);
        weight.push(a === 0 && b === 6 ? FULL_WEIGHT : 1000 + (b - a + 1));
      }
  const INF = 0x7fffffff;
  const dist = new Int32Array(SLICE_STATES).fill(INF);
  const parent = new Int32Array(SLICE_STATES).fill(-1);
  const move = new Int32Array(SLICE_STATES).fill(-1);
  const buckets: number[][] = [[0]];
  dist[0] = 0;
  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d];
    if (!bucket) continue;
    for (let k = 0; k < bucket.length; k++) {
      const s = bucket[k];
      if (dist[s] !== d) continue;
      for (let m = 0; m < lo.length; m++) {
        let s2 = s;
        for (let i = lo[m]; i <= hi[m]; i++) {
          const digit = (s >> (2 * i)) & 3;
          s2 = (s2 & ~(3 << (2 * i))) | (((digit + t[m]) & 3) << (2 * i));
        }
        const d2 = d + weight[m];
        if (d2 < dist[s2]) {
          dist[s2] = d2;
          parent[s2] = s;
          move[s2] = m;
          (buckets[d2] ??= []).push(s2);
        }
      }
    }
  }
  return { parent, move, lo: Uint8Array.from(lo), hi: Uint8Array.from(hi), t: Uint8Array.from(t) };
}

const angleOf = (t: number): Angle => (t === 1 ? 1 : t === 2 ? 2 : -1);

/** The blocks of one run under rule c: layer moves and rotations about `axis`, in any order (they commute). */
function groupRunSlice(axis: number, run: readonly Move[], out: Block[]): void {
  sliceTable ??= buildSliceTable();
  const net = [0, 0, 0, 0, 0, 0, 0];
  let rotation = 0;
  for (const [g, q] of run) {
    const t = ((q % 4) + 4) % 4;
    if (isRotation(g)) rotation += t;
    else net[SLOT(generatorLayer(g))] += t;
  }
  let s = 0;
  for (let i = 0; i < 7; i++) s |= (net[i] & 3) << (2 * i);
  const found: { lo: number; hi: number; t: number }[] = [];
  while (s !== 0) {
    const m = sliceTable.move[s];
    const lo = sliceTable.lo[m], hi = sliceTable.hi[m], t = sliceTable.t[m];
    if (lo === 0 && hi === 6) rotation += t;
    else found.push({ lo: lo - 3, hi: hi - 3, t });
    s = sliceTable.parent[s];
  }
  found.sort((a, b) => a.lo - b.lo || a.hi - b.hi || a.t - b.t);
  for (const { lo, hi, t } of found) out.push({ axis, lo, hi, angle: angleOf(t), kind: kindOf(lo, hi) });
  if (rotation & 3) out.push({ axis, lo: -3, hi: 3, angle: angleOf(rotation & 3), kind: "rotation" });
}

function groupSlice(word: readonly Move[]): Block[] {
  const out: Block[] = [];
  let run: Move[] = [];
  let axis = -1;
  const flush = (): void => {
    if (run.length) groupRunSlice(axis, run, out);
    run = [];
  };
  for (const move of word) {
    checkMove(move);
    const a = generatorAxis(move[0]);
    if (a !== axis) flush();
    axis = a;
    run.push(move);
  }
  flush();
  return out;
}

/**
 * Groups a move word into blocks (deterministic). Default: blocks of one side of the middle, whole-cube rotations stay
 * single blocks of kind `rotation`. With `{ slice: true }`: rule c, blocks may contain layer 0 (see the module comment).
 */
export function groupBlocks(word: readonly Move[], options: GroupOptions = {}): Block[] {
  if (options.slice) return groupSlice(word);
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

/**
 * The moves of one block as generators 1..21, lowest layer first. A slice block (it contains layer 0, which has no
 * generator) is the whole-cube rotation by its exponent followed by the opposite turns of the layers outside it: the
 * same state as the slab turn of its interval.
 */
export function expandBlock(block: Block): Move[] {
  if (block.kind === "rotation") return [[7 * block.axis + 7, block.angle]];
  if (block.kind === "slice") {
    const back = (block.angle === 2 ? 2 : -block.angle) as Angle;
    const moves: Move[] = [[7 * block.axis + 7, block.angle]];
    for (const layer of LAYERS) if (layer < block.lo || layer > block.hi) moves.push([layerGenerator(block.axis, layer), back]);
    return moves;
  }
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

/** Physical layers a block turns together, layer 0 included (a rotation is not a layer move: 0). */
export const blockLayers = (block: Block): number => (block.kind === "rotation" ? 0 : block.hi - block.lo + 1);

export interface BlockCounts {
  /** Layers turned: one per layer of every block, a half turn once. For blocks without a middle slice this equals `metrics(word).htm`. */
  readonly layerMoves: number;
  /** Block moves: one per non-rotation block (a middle-slice block counts once). */
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
 * outer layer, inner-wide otherwise); `x-1..0`, `x0` and `x-2..+1` are slice blocks, they contain the middle layer 0;
 * `xrot` the whole cube. Then `'` for a counter-clockwise quarter turn (negative
 * exponent) or `²` for a half turn. The single-layer and rotation tokens equal `moveToken`.
 */
export function blockToken(block: Block): string {
  const axis = AXES[block.axis];
  const where =
    block.kind === "rotation" ? "rot" : block.lo === block.hi ? layerText(block.lo) : `${layerText(block.lo)}..${layerText(block.hi)}`;
  return `${axis}${where}${turnText(block.angle)}`;
}
