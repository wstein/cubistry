import {
  demand,
  type CubeState,
  type LegalMove,
  type PrintDefinition,
} from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  inverseMoves,
  parseAlg,
} from "@cubistry/cube-mechanics";
import { poseKey } from "../hsm/periods.ts";
import { MS_MODULUS, type MsRun } from "./design.ts";

export interface MsRoute {
  readonly moves: readonly LegalMove[];
  /** Period node reached by the route. */
  readonly node: number;
  /** Period edges crossed, a partly turned edge counting as one. */
  readonly edges: number;
}
/** Where a pose lies on the period: node `edge` followed by `offset` moves of its word. */
interface Place {
  readonly edge: number;
  readonly offset: number;
}

/**
 * The closed counting period of one letter of one print, replayed on the
 * caller's print.
 *
 * Every pose the counter can reach is a node of the period or lies inside one
 * of its edges: an increment plays the node's research word, a decrement plays
 * the previous word inverted (the exact inverse traversal), and a route that a
 * newer target interrupts stops between two turns of such a word. A route to
 * any value therefore walks the period, edge by edge, in the direction with the
 * fewest HTM; it never plays a move that is not part of a period edge.
 *
 * Research words often cancel across edge boundaries, so one pose can lie
 * inside several edges, or be a node and lie inside an edge. Every such place
 * is recorded, and a route starts from whichever place gives the least HTM.
 */
export class MsPeriod {
  readonly run: MsRun;
  readonly modulus: number;
  readonly nodes: readonly CubeState[];
  readonly words: readonly (readonly LegalMove[])[];
  private readonly inverses: readonly (readonly LegalMove[])[];
  /** prefix[i]: HTM of words 0..i-1. */
  private readonly prefix: readonly number[];
  /** Every place of each reachable pose: nodes (offset 0) and edge interiors. */
  private readonly places = new Map<string, Place[]>();
  constructor(
    print: PrintDefinition,
    run: MsRun,
    modulus: number = MS_MODULUS,
  ) {
    this.run = run;
    this.modulus = modulus;
    this.words = run.words.map((w) => parseAlg(w));
    this.inverses = this.words.map((w) => inverseMoves(w));
    let state = applyMoves(initialState(print), parseAlg(run.setup));
    const nodes: CubeState[] = [];
    const prefix = [0];
    this.words.forEach((word, i) => {
      nodes.push(state);
      demand(
        !(this.places.get(poseKey(state)) ?? []).some((p) => p.offset === 0),
        "M/S period revisits a pose",
      );
      for (let offset = 0; offset < word.length; offset++) {
        const key = poseKey(state);
        this.places.set(key, [
          ...(this.places.get(key) ?? []),
          { edge: i, offset },
        ]);
        state = applyMoves(state, [word[offset]]);
      }
      prefix.push(prefix[i] + word.length);
    });
    demand(poseKey(state) === poseKey(nodes[0]), "M/S period does not close");
    this.nodes = nodes;
    this.prefix = prefix;
  }
  get length(): number {
    return this.nodes.length;
  }
  /** Value shown by node `i`. */
  static value(i: number): number {
    return i % MS_MODULUS;
  }
  /** Node of `state`, or -1 when the pose is not a period node. */
  nodeOf(state: CubeState): number {
    const node = this.places.get(poseKey(state))?.find((p) => p.offset === 0);
    return node ? node.edge : -1;
  }
  /** First node (lap 1) that shows `value`. */
  poseFor(value: number): CubeState {
    demand(
      Number.isInteger(value) && value >= 0 && value < this.modulus,
      "Invalid M/S value",
    );
    return this.nodes[value];
  }
  /** HTM of the forward walk over `count` edges from node `from`. */
  private forwardHTM(from: number, count: number): number {
    const n = this.length,
      total = this.prefix[n],
      to = from + count;
    return to <= n
      ? this.prefix[to] - this.prefix[from]
      : total - this.prefix[from] + this.prefix[to - n];
  }
  private walk(from: number, count: number, direction: 1 | -1): LegalMove[] {
    const n = this.length,
      out: LegalMove[] = [];
    for (let k = 0; k < count; k++)
      out.push(
        ...(direction === 1
          ? this.words[(from + k) % n]
          : this.inverses[(((from - k - 1) % n) + n) % n]),
      );
    return out;
  }
  /** The single counting step from node `node`: +1 plays its word, -1 the previous word inverted. */
  step(node: number, direction: 1 | -1): MsRoute {
    const n = this.length;
    demand(Number.isInteger(node) && node >= 0 && node < n, "Invalid node");
    return {
      moves: this.walk(node, 1, direction),
      node: (node + direction + n) % n,
      edges: 1,
    };
  }
  /**
   * The least-HTM route from `state` to a node showing `value` among all
   * routes of this form: from any place of `state` (a node, or an offset inside
   * an edge, which is first undone or completed), walk whole edges either way
   * round. Null when `state` is not on the period. Every turn is a turn of a
   * saved word or of its inverse.
   */
  route(state: CubeState, value: number): MsRoute | null {
    const places = this.places.get(poseKey(state));
    if (!places) return null;
    demand(
      Number.isInteger(value) && value >= 0 && value < this.modulus,
      "Invalid M/S value",
    );
    const n = this.length;
    const starts: {
      node: number;
      moves: readonly LegalMove[];
      edges: number;
    }[] = places.flatMap(({ edge, offset }) => {
      const word = this.words[edge];
      return offset === 0
        ? [{ node: edge, moves: [], edges: 0 }]
        : [
            {
              node: edge,
              moves: inverseMoves(word.slice(0, offset)),
              edges: 1,
            },
            { node: (edge + 1) % n, moves: word.slice(offset), edges: 1 },
          ];
    });
    let best: { htm: number; edges: number; build: () => MsRoute } | null =
      null;
    for (const start of starts)
      for (let target = value; target < n; target += this.modulus) {
        const ahead = (target - start.node + n) % n,
          behind = (n - ahead) % n;
        for (const [count, direction] of [
          [ahead, 1],
          [behind, -1],
        ] as const) {
          const htm =
            start.moves.length +
            (direction === 1
              ? this.forwardHTM(start.node, count)
              : this.forwardHTM((start.node - count + n) % n, count));
          const edges = start.edges + count;
          if (
            !best ||
            htm < best.htm ||
            (htm === best.htm && edges < best.edges)
          )
            best = {
              htm,
              edges,
              build: () => ({
                moves: [
                  ...start.moves,
                  ...this.walk(start.node, count, direction),
                ],
                node: target,
                edges,
              }),
            };
        }
      }
    return best!.build();
  }
}
