import {
  demand,
  type CubeState,
  type LegalMove,
  type PrintDefinition,
  type Vec3,
} from "@cubistry/cube-core";
import {
  applyMoves,
  parseAlg,
  stickerPoses,
  turnVector,
  FACE_LAYERS,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { hsmTarget, positions, type Letter } from "./design.ts";
type Pose = { p: Vec3; n: Vec3; up: Vec3 };
const key = (p: Pose) => JSON.stringify([p.p, p.n, p.up]);
/** Position and normal identify one rigid corner frame; the blank ignores up. */
const frame = (p: Pose) => JSON.stringify([p.p, p.n]);
const encode = (a: readonly number[]) =>
  a[0] * 13824 + a[1] * 576 + a[2] * 24 + a[3];
const decode = (k: number) => [
  Math.floor(k / 13824),
  Math.floor(k / 576) % 24,
  Math.floor(k / 24) % 24,
  k % 24,
];
const moves: readonly LegalMove[] = parseAlg(
  "R R2 R' L L2 L' U U2 U' D D2 D' F F2 F' B B2 B'",
);
function turn(p: Pose, m: LegalMove): Pose {
  const [axis, layer] = FACE_LAYERS[m.face];
  return p.p[axis] === layer
    ? { p: turnVector(p.p, m), n: turnVector(p.n, m), up: turnVector(p.up, m) }
    : p;
}
/** Exact four-corner BFS; hidden poses remain in the authoritative full state. */
export class HsmPlanner {
  private readonly maps: Map<string, number>[] = [];
  private readonly frames: Map<string, number>[] = [];
  private readonly transitions: number[][][] = [];
  private readonly distances = new Uint8Array(24 ** 4).fill(255);
  constructor() {
    for (const p of positions) {
      const poses: Pose[] = [{ p, n: [0, 0, 1], up: [0, 1, 0] }],
        map = new Map([[key(poses[0]), 0]]);
      for (let i = 0; i < poses.length; i++)
        for (const m of moves) {
          const q = turn(poses[i], m),
            k = key(q);
          if (!map.has(k)) {
            map.set(k, poses.length);
            poses.push(q);
          }
        }
      demand(poses.length === 24, "Incomplete HSM sticker graph");
      this.maps.push(map);
      this.frames.push(new Map(poses.map((q, i) => [frame(q), i])));
      demand(this.frames.at(-1)!.size === 24, "Ambiguous HSM corner frame");
      this.transitions.push(
        moves.map((m) => poses.map((p) => map.get(key(turn(p, m)))!)),
      );
    }
    const queue = [0];
    this.distances[0] = 0;
    for (let i = 0; i < queue.length; i++)
      for (let m = 0; m < 18; m++) {
        const q = this.step(decode(queue[i]), m),
          k = encode(q);
        if (this.distances[k] === 255) {
          this.distances[k] = this.distances[queue[i]] + 1;
          queue.push(k);
        }
      }
    demand(queue.length === 136080, "Incomplete HSM corner graph");
  }
  private step(a: readonly number[], m: number): number[] {
    return a.map((p, s) => this.transitions[s][m][p]);
  }
  private goal(
    print: PrintDefinition,
    state: CubeState,
    letter: Letter,
    value: number,
  ): { chosen: number[]; distance: number } {
    const target = hsmTarget(letter, value),
      poses = stickerPoses(print, state);
    const index = (p: Pose, s: number) =>
      target.facelets[s].assetId === "blank"
        ? this.frames[s].get(frame(p))
        : this.maps[s].get(key(p));
    const lists = target.facelets.map((f, s) =>
      poses.filter((p) => p.assetId === f.assetId && index(p, s) !== undefined),
    );
    let chosen: number[] | undefined,
      distance = 255;
    for (const a of lists[0])
      for (const b of lists[1])
        for (const c of lists[2])
          for (const d of lists[3]) {
            if (new Set([a.cubie, b.cubie, c.cubie, d.cubie]).size !== 4)
              continue;
            const ids = [a, b, c, d].map((p, s) => index(p, s)!),
              cost = this.distances[encode(ids)];
            if (cost < distance) {
              distance = cost;
              chosen = ids;
            }
          }
    demand(chosen && distance < 255, "No reachable HSM display");
    return { chosen, distance };
  }
  /** Exact shortest HTM distance from the actual pose to a display, hidden state included. */
  distance(
    print: PrintDefinition,
    state: CubeState,
    letter: Letter,
    value: number,
  ): number {
    return this.goal(print, state, letter, value).distance;
  }
  plan(
    print: PrintDefinition,
    state: CubeState,
    letter: Letter,
    value: number,
    nextValue?: number,
    policy = 13,
  ): readonly LegalMove[] {
    const target = hsmTarget(letter, value);
    demand(
      matchesTarget(print, state, {
        ...target,
        facelets: [target.facelets[0], target.facelets[1]],
      }),
      "Set up the blank and upright letter before counting",
    );
    const result = this.planFromPose(
      print,
      state,
      letter,
      value,
      nextValue,
      policy,
    );
    demand(result.length <= 6, "No certified HSM route");
    return result;
  }
  /** Reuse the exact graph after a partially completed route has moved the unit.
   * The settled blank/unit six-move bound does not apply to this entry point.
   */
  planFromPose(
    print: PrintDefinition,
    state: CubeState,
    letter: Letter,
    value: number,
    nextValue?: number,
    policy = 13,
  ): readonly LegalMove[] {
    const target = hsmTarget(letter, value);
    let { chosen: a, distance } = this.goal(print, state, letter, value);
    const result: LegalMove[] = [];
    while (distance) {
      let m = -1,
        look = 256;
      for (let j = 0; j < 18; j++) {
        const candidate = (j + policy) % 18;
        if (this.distances[encode(this.step(a, candidate))] !== distance - 1)
          continue;
        const cost =
          nextValue === undefined
            ? 0
            : this.goal(
                print,
                applyMoves(state, [moves[candidate]]),
                letter,
                nextValue,
              ).distance;
        if (cost < look) {
          m = candidate;
          look = cost;
        }
      }
      demand(m >= 0, "HSM distance descent failed");
      result.push(moves[m]);
      a = this.step(a, m);
      distance--;
      state = applyMoves(state, [moves[m]]);
    }
    demand(matchesTarget(print, state, target), "HSM route missed its display");
    return result;
  }
}
