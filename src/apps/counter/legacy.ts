/** Legacy proof-only adapters. Runtime product logic uses typed CubeState. */
import { AXES, type Vec3 } from "@cubistry/cube-core";
import {
  POSITIONS,
  legacyMove,
  parseAlg,
  inverseMoves,
  serializeMove,
  eq,
} from "@cubistry/cube-mechanics";
export function solved() {
  return POSITIONS.flatMap((p, cubie) =>
    AXES.filter((n) => p.reduce((sum, v, i) => sum + v * n[i], 0) === 1).map(
      (n, j) => ({
        id: cubie * 3 + j,
        cubie,
        p: [...p],
        n: [...n],
        up: Math.abs(n[1]) === 1 ? [0, 0, -n[1]] : [0, 1, 0],
      }),
    ),
  );
}
export const move = legacyMove;
export function apply(state: any[], alg: string) {
  return parseAlg(alg).reduce((s, m) => legacyMove(s, serializeMove(m)), state);
}
export function inverse(alg: string) {
  return inverseMoves(parseAlg(alg)).map(serializeMove).join(" ");
}
export const FRONT: readonly Vec3[] = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
export function front(state: any[]) {
  return FRONT.map((p) => state.find((s) => eq(s.p, p) && eq(s.n, [0, 0, 1])));
}
export function assertDisplay(state: any[], value: number, padded = true) {
  const expected = [
    "title-left",
    "title-right",
    value < 10 && !padded ? " " : String(Math.floor(value / 10)),
    String(value % 10),
  ];
  if (
    front(state).some(
      (s, i) =>
        !s ||
        s.image !== expected[i] ||
        (s.image !== " " && !eq(s.up, [0, 1, 0])),
    )
  )
    throw Error("Incorrect physical display " + value);
  return true;
}
