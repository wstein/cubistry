import { centerKernelReference } from "@puzlwerk/solver-3x3-picture";
import { apply, inverse, sameState, tokens, FACE_FRAMES, type State, type Cube3Design } from "./model.ts";
const equal = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v,i) => v === b[i]);
export const centerSticker = (s: State[number]) => s.p.filter(Boolean).length === 1;
export const CENTER_ORDER = ["U", "L", "F", "R", "B", "D"] as const;
export const MAX_SOLUTION_MOVES = 400;
export function alignCenterFrame(design: Cube3Design, from: State): { aligned: State; word: string } {
  if (from.length !== 54 || from.some((s,i) => s.id !== design.printing[i].id || s.cubie !== design.printing[i].cubie || s.image !== design.printing[i].image))
    throw Error("Invalid immutable picture identities.");
  const queue: { centers: State; word: string }[] = [{ centers: from.filter(centerSticker), word: "" }];
  const seen = new Set<string>();
  for (let at = 0; at < queue.length; at++) {
    const row = queue[at], key = JSON.stringify(row.centers.map(s => s.p));
    if (seen.has(key)) continue; seen.add(key);
    if (seen.size > 24) throw Error("Invalid center frame.");
    if (row.centers.every(s => equal(s.p, design.printing.find(t => t.id === s.id)!.p)))
      return { aligned: apply(from, row.word), word: row.word };
    for (const move of ["x", "y", "z"]) queue.push({ centers: apply(row.centers, move), word: `${row.word} ${move}`.trim() });
  }
  throw Error("Center positions do not share a legal rigid frame.");
}
export function centerOrientations(design: Cube3Design, state: State): number[] {
  return CENTER_ORDER.map(face => {
    const normal = FACE_FRAMES.find(f => f.face === face)!.normal;
    const source = design.printing.find(s => centerSticker(s) && equal(s.n, normal))!;
    const actual = state.find(s => s.id === source.id);
    if (!actual || !equal(actual.p, source.p) || !equal(actual.n, source.n)) throw Error("Invalid center occupancy.");
    const amount = [0,1,2,3].find(q => equal(apply([source], q ? face + (q === 2 ? "2" : q === 3 ? "'" : "") : "")[0].up, actual.up));
    if (amount === undefined) throw Error("Invalid center orientation.");
    return amount;
  });
}
export function verifyExactWord(design: Cube3Design, from: State, word: unknown): string {
  if (typeof word !== "string" || word.length > 8192 || tokens(word).length > MAX_SOLUTION_MOVES || !sameState(apply(from, word), design.printing))
    throw Error("Solver route failed the full 54-tile exact replay.");
  return tokens(word).join(" ");
}
/** Existing ordinary-piece solver plus the inverse of the provider's center reference.
 * The reference constructs zero→residual; applying it forward would double twists. */
export async function solveExactPicture(design: Cube3Design, from: State,
  ordinarySolve: (aligned: State) => Promise<string>): Promise<string> {
  const { aligned, word: alignment } = alignCenterFrame(design, from);
  const ordinary = (await ordinarySolve(aligned)).replace(/([RLUDFBxyz])2'/g, "$12");
  if (tokens(ordinary).some(t => !/^[RLUDFB]/.test(t)) || tokens(ordinary).length > 80) throw Error("Unexpected ordinary solver route.");
  const residual = apply(aligned, ordinary);
  if (!sameState(residual.filter(s => !centerSticker(s)), design.printing.filter(s => !centerSticker(s))))
    throw Error("Ordinary solver did not restore every noncenter tile frame.");
  const reference = centerKernelReference(centerOrientations(design, residual));
  if (reference.status !== "reference" || reference.htm > 286) throw Error("No verified center correction is available.");
  const correction = inverse(reference.moves.join(" "));
  return verifyExactWord(design, from, [alignment, ordinary, correction].filter(Boolean).join(" "));
}
