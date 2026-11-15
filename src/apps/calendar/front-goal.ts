/**
 * Adapter between the 3x3 calendar app and the front-goal solver
 * `@puzlwerk/solver-3x3-front`: the goal of a target, the pose in solver frame,
 * and the route back in the app frame. Pure functions on the app model; the
 * solver is passed in by the caller.
 *
 * Solver frame: the six centers are home (the solver does not move centers
 * apart from twisting them), the moves are U R F D L B, and the solver ends with
 * one whole-cube rotation `r` that brings the nine front cells into view.
 * Facelet numbers are URFDLB, 9 per face, row-major as seen from outside.
 */
import type { FrontRequest, FrontResult } from "@puzlwerk/solver-3x3-front";
import {
  apply,
  demand,
  eq,
  front,
  inverse,
  matches,
  simplify,
  tokens,
  type State,
  type Sticker,
  type Target,
  type V,
} from "./model.ts";

export interface FrontGoal {
  /** Per front cell (row-major, `front()` order): accepted home facelet numbers, ascending. */
  readonly accepted: readonly (readonly number[])[];
  /** The visible center must be upright (its cell is not blank). */
  readonly centerUp: boolean;
}

export interface FrontPose {
  /** Solver-frame facelet string (54 letters of the home face of the sticker at each facelet). */
  readonly facelets: string;
  /** Center twists U,R,F,D,L,B in quarter turns clockwise. */
  readonly twists: readonly number[];
  /** Whole-cube rotation word that was applied to the app pose to bring the centers home. */
  readonly normalizer: string;
}

const LETTERS = ["U", "R", "F", "D", "L", "B"] as const;
const BASE: Record<string, number> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };

const faceLetter = (n: V): string =>
  n[0] === 1
    ? "R"
    : n[0] === -1
      ? "L"
      : n[1] === 1
        ? "U"
        : n[1] === -1
          ? "D"
          : n[2] === 1
            ? "F"
            : "B";
const isCenter = (s: { p: V }): boolean =>
  Math.abs(s.p[0]) + Math.abs(s.p[1]) + Math.abs(s.p[2]) === 1;
const norm = (v: readonly number[]): V =>
  v.map((t) => (t === 0 ? 0 : t)) as unknown as V;

/** URFDLB facelet number of a sticker at cubie position `p` facing `n`. */
export function faceletNumber(p: V, n: V): number {
  const [x, y, z] = p;
  const f = faceLetter(n);
  const [row, col] = {
    U: [z + 1, x + 1],
    R: [1 - y, 1 - z],
    F: [1 - y, x + 1],
    D: [1 - z, x + 1],
    L: [1 - y, z + 1],
    B: [1 - y, 1 - x],
  }[f] as [number, number];
  return BASE[f] + row * 3 + col;
}

// The 24 proper rotations as integer matrices (rows), and the shortest x/y/z word of each.
type Matrix = readonly (readonly number[])[];
const ROTATIONS: { word: string; matrix: Matrix }[] = (() => {
  const probe = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const out: { word: string; matrix: Matrix }[] = [];
  const seen = new Set<string>();
  let layer = [""];
  seen.add(JSON.stringify(probe));
  out.push({ word: "", matrix: probe });
  while (layer.length) {
    const next: string[] = [];
    for (const w of layer)
      for (const t of ["x", "x2", "x'", "y", "y2", "y'", "z", "z2", "z'"]) {
        const word = (w + " " + t).trim();
        // images of the basis vectors under the word; stored as columns
        const cols = probe.map(
          (e) =>
            apply(
              [
                {
                  id: 0,
                  cubie: 0,
                  p: e as unknown as V,
                  n: e as unknown as V,
                  up: e as unknown as V,
                  image: "",
                  slot: 0,
                },
              ],
              word,
            )[0].p,
        );
        const matrix = [0, 1, 2].map((r) =>
          [cols[0][r], cols[1][r], cols[2][r]].map((v) => (v === 0 ? 0 : v)),
        );
        const key = JSON.stringify(matrix);
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ word, matrix });
          next.push(word);
        }
      }
    layer = next;
  }
  demand(out.length === 24, "Rotation group incomplete");
  return out;
})();
const mul = (m: Matrix, v: V): V =>
  norm([0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2]));

const key = (state: State): string =>
  JSON.stringify(state.map((s) => [s.p, s.n, s.up]));

/**
 * The accepted home facelets of each front cell. A print sticker is accepted at
 * a front position when it shows the cell's image and, as a rigid cubie, can lie
 * there with its image upright (a blank cell needs no orientation); the cubie
 * class must fit the position (corner, edge, center). Same predicate as
 * `matches()` in model.ts, with the whole-cube rotation left to the solver.
 */
export function buildFrontGoal(
  printing: State,
  cells: readonly string[],
): FrontGoal {
  demand(cells.length === 9, "A front goal needs nine cells");
  const accepted: number[][] = [];
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) - 1;
    const y = 1 - Math.floor(i / 3);
    const cell = cells[i];
    const ids: number[] = [];
    for (const s of printing) {
      if (s.image !== cell) continue;
      const rank = Math.abs(s.p[0]) + Math.abs(s.p[1]) + Math.abs(s.p[2]);
      if (i === 4) {
        if (rank === 1) ids.push(faceletNumber(s.p, s.n));
        continue;
      }
      if (rank === 1 || (rank === 2) !== (i % 2 === 1)) continue;
      const m = ROTATIONS.find(
        (r) =>
          eq(mul(r.matrix, s.n), [0, 0, 1]) &&
          eq(mul(r.matrix, s.p), [x, y, 1]),
      );
      if (m && (!cell || eq(mul(m.matrix, s.up), [0, 1, 0])))
        ids.push(faceletNumber(s.p, s.n));
    }
    accepted.push(ids.sort((a, b) => a - b));
  }
  return { accepted, centerUp: cells[4] !== "" };
}

/**
 * Whether the front of `state` satisfies the goal as it is: each front cell holds
 * an accepted sticker, and the center is upright when required. Equals
 * `matches(state, cells)` for the cells the goal was built from.
 */
export function goalAccepts(
  printing: State,
  state: State,
  goal: FrontGoal,
): boolean {
  const home = new Map(printing.map((s) => [s.id, s]));
  const cells = front(state);
  return (
    cells.every((s, i) => {
      const h = home.get(s.id)!;
      return goal.accepted[i].includes(faceletNumber(h.p, h.n));
    }) &&
    (!goal.centerUp || eq(cells[4].up, [0, 1, 0]))
  );
}

/** The goal after the best whole-cube rotation, as the solver searches it. */
export const goalAcceptsAnyRotation = (
  printing: State,
  state: State,
  goal: FrontGoal,
): boolean =>
  ROTATIONS.some(({ word }) => goalAccepts(printing, apply(state, word), goal));

/** Shortest x/y/z word of the rotation that maps `from` onto `to` (states of the same pieces). */
export function rotationBetween(from: State, to: State): string {
  const target = key(to);
  const hit = ROTATIONS.find((r) => key(apply(from, r.word)) === target);
  demand(hit, "States differ by more than a whole-cube rotation");
  return hit.word;
}

/** Normalize an app pose to the solver frame (centers home) and describe it. */
export function normalizePose(printing: State, pose: State): FrontPose {
  const home = new Map(printing.map((s) => [s.id, s]));
  const hit = ROTATIONS.find(({ word }) =>
    apply(pose, word).every((s) => !isCenter(s) || eq(s.p, home.get(s.id)!.p)),
  );
  demand(hit, "Centers cannot be brought home by a rotation");
  const q = apply(pose, hit.word);
  const at: string[] = new Array(54);
  for (const s of q)
    at[faceletNumber(s.p, s.n)] = faceLetter(home.get(s.id)!.n);
  const twists = LETTERS.map((g) => {
    const c = q.find((s) => isCenter(s) && faceLetter(s.n) === g) as Sticker;
    const h = home.get(c.id)!;
    let v = h.up;
    for (let k = 0; k < 4; k++) {
      if (eq(v, c.up)) return k;
      const n = h.n;
      v = norm([
        v[1] * n[2] - v[2] * n[1],
        v[2] * n[0] - v[0] * n[2],
        v[0] * n[1] - v[1] * n[0],
      ]);
    }
    throw Error("Center twist not found");
  });
  return { facelets: at.join(""), twists, normalizer: hit.word };
}

const FACE_VECTOR: Record<string, V> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

/**
 * The route in the app frame. The solver turned faces of the normalized pose
 * `apply(pose, normalizer)` and then rotated the cube by `rotation`. The app
 * word turns the same layers of the original pose first (face letters
 * conjugated by the normalizer) and appends one combined whole-cube rotation.
 */
export function routeInAppFrame(
  pose: State,
  normalizer: string,
  moves: string,
  rotation: string,
): string {
  const mapped = tokens(moves)
    .map((t) => {
      const probe: Sticker = {
        id: 0,
        cubie: 0,
        p: FACE_VECTOR[t[0]],
        n: FACE_VECTOR[t[0]],
        up: [0, 1, 0],
        image: "",
        slot: 0,
      };
      const g = faceLetter(
        apply([probe], normalizer ? inverse(normalizer) : "")[0].n,
      );
      return g + t.slice(1);
    })
    .join(" ");
  const solverEnd = apply(apply(apply(pose, normalizer), moves), rotation);
  const turned = apply(pose, mapped);
  const spin = rotationBetween(turned, solverEnd);
  return simplify([mapped, spin].filter(Boolean).join(" "));
}

/** The goal for a calendar target from its design printing. */
export const frontGoalFor = (
  printing: State,
  target: Pick<Target, "cells">,
): FrontGoal => buildFrontGoal(printing, target.cells);

/** Verify an app-frame route against the app's own predicate. */
export const routeReachesTarget = (
  pose: State,
  word: string,
  cells: readonly string[],
): boolean => matches(apply(pose, word), cells);

/** The solver entry the adapter calls; `solveFront3x3` of `@puzlwerk/solver-3x3-front` fits. */
export type FrontSolve = (request: FrontRequest) => FrontResult;

export type FrontPlan =
  | {
      readonly status: "ok";
      /** The route in the app frame: layer turns, then at most two whole-cube rotation tokens. */
      readonly word: string;
      readonly nodes: number;
      readonly tablesMs: number;
    }
  | {
      readonly status: Exclude<FrontResult["status"], "ok">;
      readonly detail: string;
    };

/**
 * One route for a target: goal from the print, pose in the solver frame, solver
 * call, route back in the app frame. The caller verifies the word with
 * `apply` and `matches` (the controller does so for every route).
 */
export function planFrontRoute(
  printing: State,
  pose: State,
  target: Pick<Target, "cells">,
  solve: FrontSolve,
  limits: Pick<
    FrontRequest,
    "tableMs" | "searchMs" | "maxNodes" | "maxMoves" | "onProgress" | "cancel"
  > = {},
): FrontPlan {
  const goal = frontGoalFor(printing, target);
  const solverPose = normalizePose(printing, pose);
  const result = solve({
    facelets: solverPose.facelets,
    centerTwists: [...solverPose.twists],
    accepted: goal.accepted.map((list) => [...list]),
    centerUp: goal.centerUp,
    ...limits,
  });
  if (result.status !== "ok")
    return { status: result.status, detail: JSON.stringify(result) };
  const word = routeInAppFrame(
    pose,
    solverPose.normalizer,
    result.moves.join(" "),
    result.rotation,
  );
  return { status: "ok", word, nodes: result.nodes, tablesMs: result.tablesMs };
}
