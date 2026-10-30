import {
  demand,
  type CubeState,
  type LegalMove,
  type PrintDefinition,
  type Vec3,
} from "@cubistry/cube-core";
import {
  initialState,
  parseAlg,
  stickerPoses,
  turnVector,
  FACE_LAYERS,
} from "@cubistry/cube-mechanics";
import type { Letter } from "./design.ts";
import type { HsmPlanner } from "./planner.ts";

/** Recovery steps may use any word up to this length; the counting limit. */
export const RECOVERY_EDGE_LIMIT = 5;
/** Longest search; the research recovery table needs at most seven steps. */
export const RECOVERY_MAX_STEPS = 8;

const moves: readonly LegalMove[] = parseAlg(
  "R R2 R' L L2 L' U U2 U' D D2 D' F F2 F' B B2 B'",
);
type Frame = { p: Vec3; n: Vec3; up: Vec3 };
const turn = (f: Frame, m: LegalMove): Frame => {
  const [axis, layer] = FACE_LAYERS[m.face];
  return f.p[axis] === layer
    ? { p: turnVector(f.p, m), n: turnVector(f.n, m), up: turnVector(f.up, m) }
    : f;
};
const fullKey = (f: Frame) => JSON.stringify([f.p, f.n, f.up]);
const frameKey = (f: Frame) => JSON.stringify([f.p, f.n]);
/** Inverse of each move index in `moves`. */
const INVERSE = moves.map((_, m) =>
  m % 3 === 1 ? m : m % 3 === 0 ? m + 2 : m - 2,
);

interface Node {
  readonly pose: Uint8Array;
  readonly htm: number;
  /**
   * Forward: the previous node, and `word` (move indices) leads from it here.
   * Backward: the next node toward the target, and `word` leads from it here,
   * so the counting step from this node is `word` inverted.
   */
  readonly link: Node | null;
  readonly word: readonly number[];
}
export interface RecoveryPlan {
  /** Words of the recovery steps; step `i` shows value `from + (i + 1) * direction`. */
  readonly words: readonly (readonly LegalMove[])[];
  readonly htm: number;
}

/**
 * Exact return onto a closed counting period after a free jump, a catch-up or an
 * interrupted route.
 *
 * Each recovery step shows the next display, as ordinary counting does, and uses
 * any legal word of at most five HTM (not only shortest ones). A pose with no
 * such word to the next display takes its shortest (six-HTM) word first. The
 * search is bidirectional over settled full poses: forward from the actual pose,
 * backward from the period nodes, so it returns a plan with the fewest steps and,
 * among those, the fewest HTM. The research recovery table
 * (research/hsm-counter/seconds-first/modes/recovery.json) bounds the steps.
 */
export class HsmRecovery {
  private readonly cubieOf: number[] = [];
  private readonly lead: number[] = [];
  private readonly poseIndex: Map<string, number>[] = [];
  /** trans[c][m][k]: pose of cubie c after move m from pose k. */
  private readonly trans: Uint8Array[][] = [];
  /** slot[sid][s][k]: four-corner table index of sticker sid in front slot s, or 255. */
  private readonly slot: Uint8Array[][] = [];
  private readonly options = new Map<string, number[][]>();
  private readonly table: HsmPlanner["tables"];
  private readonly print: PrintDefinition;
  constructor(print: PrintDefinition, planner: HsmPlanner) {
    this.print = print;
    this.table = planner.tables;
    const home = stickerPoses(print, initialState(print));
    const cubies = [...new Set(home.map((s) => s.cubie))].sort((a, b) => a - b);
    demand(cubies.length === 8, "HSM recovery needs eight corners");
    for (const s of home) this.cubieOf[s.id] = cubies.indexOf(s.cubie);
    for (const [c, cubie] of cubies.entries()) {
      const members = home
        .filter((s) => s.cubie === cubie)
        .sort((a, b) => a.id - b.id);
      this.lead[c] = members[0].id;
      const bodies: Frame[][] = [
        members.map((s) => ({ p: s.p, n: s.n, up: s.up })),
      ];
      const index = new Map([[fullKey(bodies[0][0]), 0]]);
      for (let i = 0; i < bodies.length; i++)
        for (const m of moves) {
          const next = bodies[i].map((f) => turn(f, m)),
            k = fullKey(next[0]);
          if (!index.has(k)) {
            index.set(k, bodies.length);
            bodies.push(next);
          }
        }
      demand(bodies.length === 24, "Incomplete HSM corner orbit");
      this.poseIndex[c] = index;
      this.trans[c] = moves.map(
        (m) =>
          new Uint8Array(bodies.map((b) => index.get(fullKey(turn(b[0], m)))!)),
      );
      members.forEach((s, j) => {
        this.slot[s.id] = [0, 1, 2, 3].map(
          (slot) =>
            new Uint8Array(
              bodies.map((b) => {
                const f = b[j],
                  v =
                    s.assetId === "blank"
                      ? this.table.frames[slot].get(frameKey(f))
                      : this.table.maps[slot].get(fullKey(f));
                return v ?? 255;
              }),
            ),
        );
      });
    }
  }
  /** Compact full pose: one of 24 rigid poses per corner. */
  encode(state: CubeState): Uint8Array {
    const poses = stickerPoses(this.print, state),
      out = new Uint8Array(8);
    for (const s of poses) {
      const c = this.cubieOf[s.id];
      if (this.lead[c] === s.id) {
        const k = this.poseIndex[c].get(fullKey(s));
        demand(k !== undefined, "Unknown HSM corner pose");
        out[c] = k;
      }
    }
    return out;
  }
  private static key(pose: Uint8Array): number {
    let k = 0;
    for (let c = 7; c >= 0; c--) k = k * 24 + pose[c];
    return k;
  }
  private optionsFor(letter: Letter, value: number): number[][] {
    const id = `${letter}${value}`;
    let list = this.options.get(id);
    if (!list) {
      const want = ["blank", letter, ...String(value).padStart(2, "0")];
      const home = stickerPoses(this.print, initialState(this.print));
      const by = want.map((a) =>
        home.filter((s) => s.assetId === a).map((s) => s.id),
      );
      list = [];
      for (const a of by[0])
        for (const b of by[1])
          for (const c of by[2])
            for (const d of by[3]) {
              const o = [a, b, c, d];
              if (new Set(o.map((s) => this.cubieOf[s])).size === 4)
                list.push(o);
            }
      this.options.set(id, list);
    }
    return list;
  }
  private dist(q: ArrayLike<number>, i: number): number {
    return this.table.distances[
      q[i] * 13824 + q[i + 1] * 576 + q[i + 2] * 24 + q[i + 3]
    ];
  }
  /** Least HTM to the display from `pose`. */
  private shortest(pose: Uint8Array, letter: Letter, value: number): number {
    let best = 255;
    for (const o of this.optionsFor(letter, value)) {
      const q = o.map((sid, s) => this.slot[sid][s][pose[this.cubieOf[sid]]]);
      if (q.every((v) => v !== 255)) best = Math.min(best, this.dist(q, 0));
    }
    return best;
  }
  /**
   * Every settled pose that shows the display within `limit` HTM of `pose`, with
   * one least word each (canonical words: no face twice in a row, opposite faces
   * in one order). `exact` keeps only words of exactly `limit` moves.
   */
  private reach(
    pose: Uint8Array,
    letter: Letter,
    value: number,
    limit: number,
    exact = false,
  ): Map<number, { pose: Uint8Array; word: number[] }> {
    const found = new Map<number, { pose: Uint8Array; word: number[] }>();
    const start: number[] = [];
    for (const o of this.optionsFor(letter, value)) {
      const q = o.map((sid, s) => this.slot[sid][s][pose[this.cubieOf[sid]]]);
      if (q.every((v) => v !== 255) && this.dist(q, 0) <= limit)
        start.push(...q);
    }
    const word: number[] = [];
    const dfs = (r: Uint8Array, q: number[], depth: number, last: number) => {
      if (depth && (!exact || depth === limit))
        for (let i = 0; i < q.length; i += 4)
          if (this.dist(q, i) === 0) {
            const k = HsmRecovery.key(r),
              seen = found.get(k);
            if (!seen || seen.word.length > depth)
              found.set(k, { pose: r, word: word.slice() });
            break;
          }
      if (depth === limit) return;
      const budget = limit - depth - 1,
        lf = last < 0 ? -1 : Math.floor(last / 3);
      for (let m = 0; m < 18; m++) {
        const f = Math.floor(m / 3);
        if (f === lf || (lf >= 0 && f === (lf ^ 1) && f < lf)) continue;
        const nq: number[] = [];
        const t = this.table.transitions;
        for (let i = 0; i < q.length; i += 4) {
          const a = t[0][m][q[i]],
            b = t[1][m][q[i + 1]],
            c = t[2][m][q[i + 2]],
            d = t[3][m][q[i + 3]];
          if (this.table.distances[a * 13824 + b * 576 + c * 24 + d] <= budget)
            nq.push(a, b, c, d);
        }
        if (!nq.length) continue;
        const r2 = new Uint8Array(8);
        for (let c = 0; c < 8; c++) r2[c] = this.trans[c][m][r[c]];
        word.push(m);
        dfs(r2, nq, depth + 1, m);
        word.pop();
      }
    };
    if (start.length) dfs(pose, start, 0, -1);
    return found;
  }
  /**
   * A free jump to `value` of the least HTM that lands where counting on is
   * cheapest: on a period node when one is reachable at that length, otherwise
   * on a pose with a route of at most five HTM to the next display. Only when
   * every least jump lands on a pose without such a route is one HTM more
   * spent, and never beyond the universal six. Null if the display is farther.
   */
  jump(
    state: CubeState,
    letter: Letter,
    maximum: number,
    direction: number,
    value: number,
    targets: (value: number) => readonly CubeState[],
  ): readonly LegalMove[] | null {
    const origin = this.encode(state),
      least = this.shortest(origin, letter, value);
    if (least > 6) return null;
    const n = maximum + 1,
      next = (value + direction + n) % n,
      period = new Set(
        targets(value).map((g) => HsmRecovery.key(this.encode(g))),
      );
    let fallback: number[] | null = null;
    for (let length = least; length <= Math.max(least, 6); length++) {
      let free: number[] | null = null;
      for (const [k, e] of this.reach(origin, letter, value, length, true)) {
        if (period.has(k)) return e.word.map((m) => moves[m]);
        if (!free && this.shortest(e.pose, letter, next) <= RECOVERY_EDGE_LIMIT)
          free = e.word;
        fallback ??= e.word;
      }
      if (free) return free.map((m) => moves[m]);
    }
    return fallback && fallback.map((m) => moves[m]);
  }
  /**
   * Fewest-step, then fewest-HTM plan from `state` (showing `from`) onto a node
   * of the period, counting by `direction`; `targets(v)` lists the period nodes
   * that show `v`. Null when no plan of at most `RECOVERY_MAX_STEPS` steps exists.
   */
  plan(
    state: CubeState,
    letter: Letter,
    maximum: number,
    direction: number,
    from: number,
    targets: (value: number) => readonly CubeState[],
  ): RecoveryPlan | null {
    const n = maximum + 1,
      at = (k: number) => (((from + k * direction) % n) + n) % n;
    const origin = this.encode(state);
    const forward: Map<number, Node>[] = [
      new Map([
        [
          HsmRecovery.key(origin),
          { pose: origin, htm: 0, link: null, word: [] },
        ],
      ]),
    ];
    const grow = (
      layers: Map<number, Node>[],
      depth: number,
      value: (j: number) => number,
      first: boolean,
    ) => {
      while (layers.length <= depth) {
        const j = layers.length,
          next = new Map<number, Node>();
        for (const node of layers[j - 1].values()) {
          let limit = RECOVERY_EDGE_LIMIT,
            exact = false;
          if (first && j === 1) {
            const d = this.shortest(node.pose, letter, value(j));
            if (d > RECOVERY_EDGE_LIMIT) [limit, exact] = [d, true];
          }
          for (const [k, e] of this.reach(
            node.pose,
            letter,
            value(j),
            limit,
            exact,
          )) {
            const htm = node.htm + e.word.length,
              old = next.get(k);
            if (!old || old.htm > htm)
              next.set(k, { pose: e.pose, htm, link: node, word: e.word });
          }
        }
        layers.push(next);
      }
    };
    for (let k = 1; k <= RECOVERY_MAX_STEPS; k++) {
      const goals = targets(at(k));
      if (!goals.length) continue;
      const a = Math.ceil(k / 2),
        b = k - a;
      grow(forward, a, at, true);
      const backward: Map<number, Node>[] = [
        new Map(
          goals.map((g) => {
            const pose = this.encode(g);
            return [
              HsmRecovery.key(pose),
              { pose, htm: 0, link: null, word: [] },
            ];
          }),
        ),
      ];
      // Backward layer j shows at(k - j): the predecessors of layer j - 1.
      grow(backward, b, (j) => at(k - j), false);
      let best: [Node, Node] | null = null;
      for (const [key, f] of forward[a]) {
        const g = backward[b].get(key);
        if (g && (!best || f.htm + g.htm < best[0].htm + best[1].htm))
          best = [f, g];
      }
      if (!best) continue;
      const words: number[][] = [];
      for (let f: Node | null = best[0]; f?.link; f = f.link)
        words.unshift([...f.word]);
      // A backward word leads from the target side; inverted it continues forward.
      for (let g: Node | null = best[1]; g?.link; g = g.link)
        words.push(
          g.word
            .slice()
            .reverse()
            .map((m) => INVERSE[m]),
        );
      return {
        words: words.map((w) => w.map((m) => moves[m])),
        htm: best[0].htm + best[1].htm,
      };
    }
    return null;
  }
}
