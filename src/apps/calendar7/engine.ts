/**
 * English 7x7 calendar cube: scoped mechanics (research candidate, not certified).
 *
 * The cube has 218 rigid surface bodies (343 - 5^3 interior positions) carrying 294
 * stickers. A complete state is the pose (body position, sticker normal, sticker "up")
 * of every sticker; the printing (piece, text, ink) never changes. Pure functions only:
 * no DOM, no timers, no platform APIs.
 *
 * Conventions, from the research (GROUP-WITNESS.md "Action and frame information",
 * practical/verify.jl and continuous/verify.jl):
 *  - 21 generators g = 1..21 = 7 * axis + slot, axis 0..2 = x, y, z, slot 1..7;
 *  - slots 1..6 turn the layer -3, -2, -1, 1, 2, 3 of that axis, slot 7 turns the whole
 *    cube (a rotation, g = 7, 14, 21). There is no layer 0 generator;
 *  - one positive quarter turn maps (x,y,z) to (x,-z,y) about x, (z,y,-x) about y and
 *    (-y,x,z) about z. A layer is selected by the body position (pos[axis] === layer);
 *  - a move is (g, q) with q in {-1, 1, 2}; it applies q mod 4 positive quarter turns;
 *  - a half turn counts once; whole-cube rotations are counted separately (HTM, rot).
 */
import { sha256Text } from "./sha256.ts";

export const STICKERS = 294;
export const CUBIES = 218;
export const GENERATORS = 21;
export const FRONT_NORMAL = [0, 0, 1] as const;

export type Vec = readonly [number, number, number];
/** One move: generator 1..21 and quarter-turn exponent -1, 1 or 2. */
export type Move = readonly [generator: number, quarter: number];

/** The immutable printing; arrays are indexed by sticker index 0..293 (sticker id - 1). */
export interface Printing {
  readonly piece: readonly number[];
  readonly text: readonly string[];
  readonly ink: readonly string[];
}
/** Sticker poses, three entries per sticker. Treat as immutable outside this module. */
export interface Pose {
  readonly pos: Int8Array;
  readonly normal: Int8Array;
  readonly up: Int8Array;
}

export const clonePose = (s: Pose): Pose => ({
  pos: s.pos.slice(),
  normal: s.normal.slice(),
  up: s.up.slice(),
});
export const samePose = (a: Pose, b: Pose): boolean =>
  a.pos.every((v, i) => v === b.pos[i]) &&
  a.normal.every((v, i) => v === b.normal[i]) &&
  a.up.every((v, i) => v === b.up[i]);

/** Axis index 0..2 of generator 1..21. */
export const generatorAxis = (g: number): number => Math.floor((g - 1) / 7);
/** Layer -3, -2, -1, 1, 2, 3, or 99 for the whole-cube rotation. */
export const generatorLayer = (g: number): number =>
  [-3, -2, -1, 1, 2, 3, 99][(g - 1) % 7];
export const isRotation = (g: number): boolean => g % 7 === 0;

export function checkMove(move: Move): void {
  const [g, q] = move;
  if (!Number.isInteger(g) || g < 1 || g > GENERATORS)
    throw new RangeError(`generator ${g} outside 1..${GENERATORS}`);
  if (q !== -1 && q !== 1 && q !== 2)
    throw new RangeError(`quarter exponent ${q} is not -1, 1 or 2`);
}

/** One positive quarter turn of the vector stored at `a[o..o+2]` about `axis`. */
function turnAt(a: Int8Array, o: number, axis: number): void {
  const x = a[o],
    y = a[o + 1],
    z = a[o + 2];
  if (axis === 0) {
    a[o + 1] = -z;
    a[o + 2] = y;
  } else if (axis === 1) {
    a[o] = z;
    a[o + 2] = -x;
  } else {
    a[o] = -y;
    a[o + 1] = x;
  }
}

/** Apply a move to `state` in place. */
export function applyMoveInPlace(state: Pose, move: Move): void {
  checkMove(move);
  const [g, q] = move;
  const axis = generatorAxis(g);
  const layer = generatorLayer(g);
  const turns = ((q % 4) + 4) % 4;
  for (let i = 0; i < STICKERS; i++) {
    const o = 3 * i;
    if (layer !== 99 && state.pos[o + axis] !== layer) continue;
    for (let t = 0; t < turns; t++) {
      turnAt(state.pos, o, axis);
      turnAt(state.normal, o, axis);
      turnAt(state.up, o, axis);
    }
  }
}

/** The state after `moves`; `state` is not modified. */
export function applyMoves(state: Pose, moves: readonly Move[]): Pose {
  const result = clonePose(state);
  for (const move of moves) applyMoveInPlace(result, move);
  return result;
}

/** The inverse word: reverse order, each exponent negated (a half turn stays). */
export const inverseMoves = (moves: readonly Move[]): Move[] =>
  moves.map(([g, q]): Move => [g, q === 2 ? 2 : -q]).reverse();

export interface Metrics {
  /** Layer moves (a half turn counts once). */
  readonly htm: number;
  /** Layer quarter turns (a half turn counts twice). */
  readonly qtm: number;
  /** Whole-cube rotation moves. */
  readonly rot: number;
  /** Whole-cube rotation quarter turns. */
  readonly rotq: number;
}
export function metrics(moves: readonly Move[]): Metrics {
  let htm = 0,
    qtm = 0,
    rot = 0,
    rotq = 0;
  for (const [g, q] of moves) {
    if (isRotation(g)) {
      rot++;
      rotq += Math.abs(q);
    } else {
      htm++;
      qtm += Math.abs(q);
    }
  }
  return { htm, qtm, rot, rotq };
}

/**
 * Text that is hashed for a complete state: one line per sticker,
 * `id piece pos normal up text ink` (tab separated, comma separated vectors). This is the
 * preimage of the research `state_digest`, so the SHA-256 equals the research receipts.
 */
export function stateText(printing: Printing, state: Pose): string {
  const lines: string[] = [];
  const v = (a: Int8Array, o: number) => `${a[o]},${a[o + 1]},${a[o + 2]}`;
  for (let i = 0; i < STICKERS; i++) {
    const o = 3 * i;
    lines.push(
      `${i + 1}\t${printing.piece[i]}\t${v(state.pos, o)}\t${v(state.normal, o)}\t${v(state.up, o)}\t${printing.text[i]}\t${printing.ink[i]}\n`,
    );
  }
  return lines.join("");
}
export const stateDigest = (printing: Printing, state: Pose): string =>
  sha256Text(stateText(printing, state));

/** Number of distinct bodies and (body position, normal) slots; a cheap sanity check. */
export function checkPose(printing: Printing, state: Pose): void {
  if (printing.piece.length !== STICKERS || state.pos.length !== 3 * STICKERS)
    throw new Error("a pose needs exactly 294 stickers");
  const slots = new Set<string>();
  const bodies = new Set<number>();
  for (let i = 0; i < STICKERS; i++) {
    const o = 3 * i;
    const pos = [state.pos[o], state.pos[o + 1], state.pos[o + 2]];
    const n = [state.normal[o], state.normal[o + 1], state.normal[o + 2]];
    const u = [state.up[o], state.up[o + 1], state.up[o + 2]];
    if (Math.max(...pos.map(Math.abs)) !== 3)
      throw new Error(`sticker ${i + 1} is not on a surface body`);
    const k = n.findIndex((x) => x !== 0);
    if (n.reduce((s, x) => s + Math.abs(x), 0) !== 1 || pos[k] !== 3 * n[k])
      throw new Error(`sticker ${i + 1} has an invalid normal`);
    if (u.reduce((s, x) => s + Math.abs(x), 0) !== 1 || n.reduce((s, x, j) => s + x * u[j], 0) !== 0)
      throw new Error(`sticker ${i + 1} has an invalid up vector`);
    slots.add(`${pos}|${n}`);
    bodies.add(pos[0] * 49 + pos[1] * 7 + pos[2]);
  }
  if (slots.size !== STICKERS || bodies.size !== CUBIES)
    throw new Error("poses do not cover 218 bodies and 294 distinct surfaces");
}
