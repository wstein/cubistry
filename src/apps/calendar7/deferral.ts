// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * English 7x7 calendar cube, deferred whole-cube rotations and the end alignment (research candidate, not certified).
 * A DISPLAY LAYER ONLY: the stored words (generators 1..21) and the engine alphabet do not change. Pure, DOM-free.
 *
 * Mode F of the research (research/calendar-7x7/wide-blocks, PR #346): a whole-cube rotation R followed by a layer move
 * m is the same as the conjugate move m' = R^-1 m R followed by R (m after R = R after m'). Pushing every rotation of a
 * word to the end this way gives a played word with NO rotation in it, and ONE net rotation, the alignment, at the end.
 * Between the start and the end of a step the cube may therefore be turned differently from the stored frame; the
 * alignment brings it back. The alignment is a free whole-cube rotation, not a move.
 *
 * Conjugation only renames layers: the single move (axis a, layer L, exponent q) becomes (axis k, layer s * L, exponent
 * s * q), where s = +1 or -1 is the only nonzero entry R[a][k] of row a of the accumulated rotation matrix R. No move is
 * merged, cancelled or added, so the number of layer moves is exactly that of the stored word.
 */
import { type Block, type BlockKind, groupBlocks, layerGenerator } from "./blocks.ts";
import {
  applyMoves,
  generatorAxis,
  generatorLayer,
  isRotation,
  type Move,
  type Pose,
  type Printing,
  stateDigest,
} from "./engine.ts";

/** A 3x3 integer rotation matrix, row-major; it acts on column vectors (positions). */
export type Mat = readonly number[];
export const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** One positive quarter turn about x, y, z (the engine convention: (x,y,z) to (x,-z,y), (z,y,-x), (-y,x,z)). */
const QUARTER: readonly Mat[] = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0],
  [0, 0, 1, 0, 1, 0, -1, 0, 0],
  [0, -1, 0, 1, 0, 0, 0, 0, 1],
];
/** a * b: b first, then a. */
export function matMul(a: Mat, b: Mat): Mat {
  const out: number[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) out.push(a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j]);
  return out;
}
export const sameMat = (a: Mat, b: Mat): boolean => a.every((v, i) => v === b[i]);
const mod4 = (q: number): number => ((q % 4) + 4) % 4;
/** The rotation about `axis` by `q` quarter turns. */
export function axisMatrix(axis: number, q: number): Mat {
  let m = IDENTITY;
  for (let i = 0; i < mod4(q); i++) m = matMul(QUARTER[axis], m);
  return m;
}
/** The net rotation of the rotation moves (generators 7, 14, 21) in a word; layer moves are ignored. */
export function rotationOfMoves(moves: readonly Move[]): Mat {
  let r = IDENTITY;
  for (const [g, q] of moves) if (isRotation(g)) r = matMul(axisMatrix(generatorAxis(g), q), r);
  return r;
}

/** Row `axis` of R has exactly one nonzero entry: the lab axis `k` and sign `s` the conjugated move uses. */
function rowOf(r: Mat, axis: number): { k: number; s: 1 | -1 } {
  for (let k = 0; k < 3; k++) if (r[3 * axis + k] !== 0) return { k, s: r[3 * axis + k] as 1 | -1 };
  throw new Error("not a rotation matrix");
}
const flip = (q: number): number => (q === 2 ? 2 : -q);

/**
 * The word with every whole-cube rotation moved to the end: `word` equals `word` (the result) followed by `rotation`.
 * Layer moves are conjugated by the rotations before them; their number is unchanged.
 */
export function deferRotations(word: readonly Move[]): { word: Move[]; rotation: Mat } {
  let r = IDENTITY;
  const out: Move[] = [];
  for (const [g, q] of word) {
    const a = generatorAxis(g);
    if (isRotation(g)) {
      r = matMul(axisMatrix(a, q), r);
      continue;
    }
    const { k, s } = rowOf(r, a);
    out.push([layerGenerator(k, s * generatorLayer(g)), s > 0 ? q : flip(q)]);
  }
  return { word: out, rotation: r };
}

/** The same for blocks: rotation blocks are removed, later blocks are conjugated (an interval lo..hi becomes -hi..-lo for s = -1). */
export function deferRotationBlocks(blocks: readonly Block[]): { blocks: Block[]; rotation: Mat } {
  let r = IDENTITY;
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.kind === "rotation") {
      r = matMul(axisMatrix(b.axis, b.angle), r);
      continue;
    }
    const { k, s } = rowOf(r, b.axis);
    out.push({
      axis: k,
      lo: s > 0 ? b.lo : -b.hi,
      hi: s > 0 ? b.hi : -b.lo,
      angle: (s > 0 ? b.angle : flip(b.angle)) as Block["angle"],
      kind: b.kind as BlockKind,
    });
  }
  return { blocks: out, rotation: r };
}

// ---- the 24 whole-cube orientations and their canonical (shortest, deterministic) rotation words ----

export interface Orientation {
  readonly matrix: Mat;
  /** One or two whole-cube rotation moves, applied in this order; empty for the identity. */
  readonly moves: readonly Move[];
}
const rotationMove = (axis: number, q: number): Move => [7 * axis + 7, q as Move[1]];
let orientations: Orientation[] | null = null;
/**
 * All 24, in a fixed order. Each matrix has the word with the fewest rotations (at most two), then the fewest quarter
 * turns (a half turn counts 2), then the first in the order x, y, z and exponent +1, -1, 2 (first move, then second).
 */
export function allOrientations(): readonly Orientation[] {
  if (orientations) return orientations;
  const singles: Move[] = [];
  for (let axis = 0; axis < 3; axis++) for (const q of [1, -1, 2]) singles.push(rotationMove(axis, q));
  const words: Move[][] = [[]];
  for (const a of singles) words.push([a]);
  for (const a of singles) for (const b of singles) words.push([a, b]);
  const cost = (w: readonly Move[]): number => w.reduce((n, [, q]) => n + Math.abs(q), 0);
  const best = new Map<string, { w: Move[]; i: number }>();
  words.forEach((w, i) => {
    const key = rotationOfMoves(w).join(",");
    const cur = best.get(key);
    if (!cur || w.length < cur.w.length || (w.length === cur.w.length && cost(w) < cost(cur.w))) best.set(key, { w, i });
  });
  orientations = [...best.values()]
    .sort((x, y) => x.i - y.i)
    .map(({ w }) => ({ matrix: rotationOfMoves(w), moves: w }));
  return orientations;
}
/** The canonical rotation word of an orientation matrix; throws for a matrix that is not one of the 24. */
export function alignmentMoves(matrix: Mat): readonly Move[] {
  const o = allOrientations().find((x) => sameMat(x.matrix, matrix));
  if (!o) throw new RangeError("not a whole-cube orientation");
  return o.moves;
}

/**
 * Every orientation R with digest(pose after R) === `hash`. The stickers are all distinct, so a state that is the stored
 * target turned by a whole-cube rotation matches exactly one; an empty list means the state is not the target in any
 * orientation.
 */
export function findAlignments(printing: Printing, pose: Pose, hash: string): Orientation[] {
  return allOrientations().filter((o) => stateDigest(printing, applyMoves(pose, o.moves)) === hash);
}

const AXES = ["x", "y", "z"] as const;
/** `x+, y2`, or `none` for no rotation. `+` is a clockwise quarter turn of the engine convention, `-` the opposite, `2` a half turn. */
export function alignmentText(moves: readonly Move[]): string {
  return moves.length === 0
    ? "none"
    : moves.map(([g, q]) => `${AXES[generatorAxis(g)]}${q === 1 ? "+" : q === -1 ? "-" : "2"}`).join(", ");
}
export const rotationBlock = ([g, q]: Move): Block => ({ axis: generatorAxis(g), lo: -3, hi: 3, angle: q as Block["angle"], kind: "rotation" });

export interface PlayedWord {
  /** The blocks to play. With `defer`, none of them is a rotation. */
  readonly blocks: Block[];
  /** The factored net rotation (identity in stored mode). */
  readonly rotation: Mat;
  /** The canonical rotation word: at most three x/y moves before, at most two after. */
  readonly alignment: readonly Move[];
}
export type RotationPlacement = "before" | "after" | "stored";

export interface PlayOptions {
  /** Before: orient first and conjugate the layer blocks into that frame. */
  readonly orientation?: RotationPlacement;
  readonly slice?: boolean;
  /** Move the whole-cube rotations to the end (mode F). Default false: `groupBlocks` as it is. */
  readonly defer?: boolean;
}
/**
 * The blocks a step plays. Without `defer` exactly `groupBlocks(word, { slice })`. With it: the stored rotations are
 * deferred by conjugation, the word is grouped (rule c if `slice`), and the rotations that rule c still forms (a free
 * rotation next to a block) are deferred as well; all of them add up to the single `rotation`, the end alignment.
 */
export function playedBlocks(word: readonly Move[], options: PlayOptions = {}): PlayedWord {
  const slice = options.slice ?? false;
  const placement = options.orientation ?? (options.defer ? "after" : "stored");
  if (placement === "stored") return { blocks: groupBlocks(word, { slice }), rotation: IDENTITY, alignment: [] };
  const first = deferRotations(word);
  const second = deferRotationBlocks(groupBlocks(first.word, { slice }));
  const rotation = matMul(first.rotation, second.rotation);
  if (placement === "before") {
    // B then R equals R then (R B R^-1). rowOf expects the inverse
    // frame, so transpose the orthogonal integer rotation matrix.
    const inverse = [0, 1, 2].flatMap((i) => [rotation[i], rotation[3 + i], rotation[6 + i]]);
    const blocks = second.blocks.map((b): Block => {
      const { k, s } = rowOf(inverse, b.axis);
      return { ...b, axis: k, lo: s > 0 ? b.lo : -b.hi, hi: s > 0 ? b.hi : -b.lo, angle: (s > 0 ? b.angle : flip(b.angle)) as Block["angle"] };
    });
    return { blocks, rotation, alignment: beforeAlignmentMoves(rotation) };
  }
  return { blocks: second.blocks, rotation, alignment: alignmentMoves(rotation) };
}

/** Canonical x/y-only orientation: fewest rotations, then fixed x/y/exponent order. */
export function beforeAlignmentMoves(matrix: Mat): readonly Move[] {
  const queue: { matrix: Mat; moves: Move[] }[] = [{ matrix: IDENTITY, moves: [] }];
  const seen = new Set([IDENTITY.join(",")]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (sameMat(current.matrix, matrix)) return current.moves;
    for (const axis of [0, 1]) for (const q of [1, -1, 2]) {
      const next = matMul(axisMatrix(axis, q), current.matrix);
      const key = next.join(",");
      if (!seen.has(key)) { seen.add(key); queue.push({ matrix: next, moves: [...current.moves, rotationMove(axis, q)] }); }
    }
  }
  throw new RangeError("not a whole-cube orientation");
}
