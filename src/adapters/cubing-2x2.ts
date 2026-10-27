/** Thin existing-solver adapter, extracted from research/counter/generate.mjs.
 * No search or physical rotation implementation lives here. Node/dev use only.
 */
import {
  validatePrint,
  validateState,
  stateEquals,
  eq,
  IDENTITY,
  type CubeState,
  type PrintDefinition,
  type Rotation,
  type Vec3,
} from "@cubistry/cube-core";
import {
  FACE_LAYERS,
  turnVector,
  parseMove,
  parseAlg,
  applyMoves,
  serializeMove,
  inverseMoves,
} from "@cubistry/cube-mechanics";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";
const key = (v: unknown) => JSON.stringify(v);
const faces = ["R", "L", "U", "D", "F", "B"] as const;
export const CUBING_BACKEND = Object.freeze({
  id: "cubing/experimentalSolve2x2x2",
  version: "0.66.1",
  license: "MPL-2.0 OR GPL-3.0-or-later",
  supportedSizes: [2],
  goal: "complete-corner-state",
  frame: "exact",
  optimality: "unknown",
});
export interface SolveResult {
  readonly schema: "cubistry.live-solver-result";
  readonly version: 1;
  readonly word: string;
  readonly backend: typeof CUBING_BACKEND;
  readonly solverInvocations: 2;
  readonly elapsedMs: number;
  readonly verified: boolean;
}
export async function createCubing2x2Adapter() {
  const { puzzles } = await import("cubing/puzzles");
  const { KPattern } = await import("cubing/kpuzzle");
  const { experimentalSolve2x2x2 } = await import("cubing/search");
  const kp: KPuzzle = await puzzles["2x2x2"].kpuzzle(),
    reference = kp.defaultPattern();
  // Infer cubing's position/frame convention from its actual move support.
  // This is the already-used generator correspondence, not an assumed URFDLB array.
  const positions = Array.from({ length: 8 }, () => [0, 0, 0]);
  for (const face of faces) {
    const [axis, layer] = FACE_LAYERS[face],
      p = reference.applyMove(face).patternData.CORNERS.pieces;
    for (let i = 0; i < 8; i++) if (p[i] !== i) positions[i][axis] = layer;
  }
  if (
    new Set(positions.map(key)).size !== 8 ||
    positions.some((p) => p.some((x) => !x))
  )
    throw Error("cubing position correspondence failed");
  const index = (p: Vec3) =>
    positions.findIndex((q) => eq(p, q as unknown as Vec3));
  const orientations = new Map<string, number>();
  for (let piece = 0; piece < 8; piece++) {
    const queue: { p: Vec3; r: Rotation; pattern: KPattern }[] = [
        {
          p: positions[piece] as unknown as Vec3,
          r: IDENTITY,
          pattern: reference,
        },
      ],
      seen = new Set<string>();
    for (let j = 0; j < queue.length; j++) {
      const { p, r, pattern } = queue[j],
        k = key([p, r]);
      if (seen.has(k)) continue;
      seen.add(k);
      orientations.set(
        key([piece, p, r]),
        pattern.patternData.CORNERS.orientation[index(p)],
      );
      for (const face of faces) {
        const [axis, layer] = FACE_LAYERS[face],
          move = parseMove(face),
          active = p[axis] === layer;
        queue.push({
          p: active ? turnVector(p, move) : p,
          r: active
            ? (r.map((v) => turnVector(v, move)) as unknown as Rotation)
            : r,
          pattern: pattern.applyMove(face),
        });
      }
    }
    if (seen.size !== 24)
      throw Error("Incomplete cubing corner frame correspondence");
  }
  const patternFor = (print: PrintDefinition, state: CubeState) => {
    const pieces = Array<number>(8),
      orientation = Array<number>(8);
    for (const c of state.cubies) {
      const source = print.cubies.find((s) => s.id === c.id)!,
        piece = index(source.position),
        position = index(c.position),
        twist = orientations.get(key([piece, c.position, c.orientation]));
      if (piece < 0 || position < 0 || twist === undefined)
        throw Error("Unsupported corner frame in cubing adapter");
      pieces[position] = piece;
      orientation[position] = twist;
    }
    return new KPattern(kp, { CORNERS: { pieces, orientation } });
  };
  return {
    backend: CUBING_BACKEND,
    async solveBetween(
      rawPrint: PrintDefinition,
      rawFrom: CubeState,
      rawTo: CubeState,
    ): Promise<SolveResult> {
      const started = performance.now(),
        print = validatePrint(rawPrint),
        from = validateState(rawFrom, print),
        to = validateState(rawTo, print),
        a = patternFor(print, from),
        b = patternFor(print, to);
      // Existing complete-state solver twice, through its reference state.
      // The target is a fixed known counter completion, not a partial-goal search.
      const toReference = await experimentalSolve2x2x2(a),
        goalToReference = await experimentalSolve2x2x2(b);
      if (
        !a.applyAlg(toReference).isIdentical(reference) ||
        !b.applyAlg(goalToReference).isIdentical(reference)
      )
        throw Error("Existing solver failed exact-frame verification");
      const normalize = (s: string) => s.replace(/([RLUDFB])2'/g, "$12");
      const moves = [
          ...parseAlg(normalize(toReference.toString())),
          ...inverseMoves(parseAlg(normalize(goalToReference.toString()))),
        ],
        word = moves.map(serializeMove).join(" ");
      if (
        moves.length > 128 ||
        !stateEquals(applyMoves(from, moves), to) ||
        !a.applyAlg(word).isIdentical(b)
      )
        throw Error("Solver adapter replay did not reach the complete target");
      return Object.freeze({
        schema: "cubistry.live-solver-result",
        version: 1,
        word,
        backend: CUBING_BACKEND,
        solverInvocations: 2,
        elapsedMs: performance.now() - started,
        verified: true,
      });
    },
  };
}
