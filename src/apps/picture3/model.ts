import { deepFreeze } from "@cubistry/cube-core";
import { apply, sameState, tokens, type V, type State } from "../calendar/model.ts";
export { apply, sameState, tokens, inverse, moveInfo } from "../calendar/model.ts";
export type { State } from "../calendar/model.ts";
export type Face = "U" | "D" | "F" | "B" | "L" | "R";
export const FACE_FRAMES: readonly { face: Face; normal: V; up: V; color: string }[] = deepFreeze([
  { face: "U", normal: [0, 1, 0], up: [0, 0, -1], color: "#f7f6e9" },
  { face: "D", normal: [0, -1, 0], up: [0, 0, 1], color: "#ffd635" },
  { face: "F", normal: [0, 0, 1], up: [0, 1, 0], color: "#24ab72" },
  { face: "B", normal: [0, 0, -1], up: [0, 1, 0], color: "#3384e5" },
  { face: "L", normal: [-1, 0, 0], up: [0, 1, 0], color: "#ff922e" },
  { face: "R", normal: [1, 0, 0], up: [0, 1, 0], color: "#e94538" },
]);
export const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function facePosition(face: Face, row: number, col: number): V {
  const frame = FACE_FRAMES.find(f => f.face === face);
  if (!frame || ![row, col].every(n => Number.isInteger(n) && n >= 0 && n < 3)) throw Error("Invalid face tile");
  const right = cross(frame.up, frame.normal);
  return frame.normal.map((n, i) => n + right[i] * (col - 1) + frame.up[i] * (1 - row)) as unknown as V;
}
export function createCube3Design(style: "classic" | "picture" = "picture") {
  if (!["classic", "picture"].includes(style)) throw Error("Unsupported 3 by 3 design");
  const printing: State = FACE_FRAMES.flatMap((frame, f) => Array.from({ length: 9 }, (_, tile) => {
    const row = Math.floor(tile / 3), col = tile % 3, p = facePosition(frame.face, row, col);
    return { id: f * 9 + tile, cubie: (p[0] + 1) * 9 + (p[1] + 1) * 3 + p[2] + 1,
      p, n: frame.normal, up: frame.up, image: style === "picture" ? `${frame.face}_${row}_${col}` : frame.face, slot: tile };
  }));
  return deepFreeze({ id: `playground_3_${style}_v1`, style, printing });
}
export type Cube3Design = ReturnType<typeof createCube3Design>;
/** Includes every center up vector; color-only solved is intentionally insufficient. */
export function exactGoal(design: Cube3Design, state: State): boolean {
  return sameState(state, design.printing);
}
/** Recorded legal scrambles, reusing the existing seed policy; not uniform states. */
export function scrambleWord(moves: readonly { face: string; turns: number }[]): string {
  const word = moves.map(m => m.face + (m.turns === 2 ? "2" : m.turns === -1 ? "'" : "")).join(" ");
  tokens(word); return word;
}
export function checkedMove(from: State, token: string, target: State): void {
  if (tokens(token).length !== 1 || !sameState(apply(from, token), target)) throw Error("Invalid 3 by 3 move presentation");
}
