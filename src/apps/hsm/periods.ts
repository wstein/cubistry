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
import type { HsmPeriod, Letter } from "./design.ts";

/** Full physical identity of a settled pose: every cubie, hidden ones included. */
export const poseKey = (state: CubeState): string =>
  JSON.stringify(state.cubies.map((c) => [c.id, c.position, c.orientation]));

interface Entry {
  readonly spec: HsmPeriod;
  readonly words: readonly (readonly LegalMove[])[];
  readonly nodes: readonly CubeState[];
  readonly index: ReadonlyMap<string, number>;
}
export interface PeriodRoute {
  readonly moves: readonly LegalMove[];
  /** Node index inside the closed period after the route. */
  readonly node: number;
}

/**
 * Closed counting periods of the pinned print, replayed on the caller's print.
 *
 * Counting up follows each node's saved word. Counting down walks the same
 * period backward with every word inverted: it closes the same full poses and
 * costs the same HTM, but is not necessarily a shortest word toward the lower
 * display. A pose that is not a period node (after a free jump, an interrupted
 * route or a counting mode without a period) has no period route; the caller
 * then replans with the exact shortest-path planner.
 */
export class HsmPeriods {
  private readonly entries = new Map<string, Entry>();
  constructor(print: PrintDefinition, periods: readonly HsmPeriod[]) {
    for (const spec of periods) {
      const words = spec.words.map((w) => parseAlg(w));
      let state = applyMoves(initialState(print), parseAlg(spec.setup));
      const nodes = [state];
      for (const word of words.slice(0, -1)) {
        state = applyMoves(state, word);
        nodes.push(state);
      }
      const index = new Map(nodes.map((n, i) => [poseKey(n), i]));
      demand(index.size === nodes.length, "HSM period revisits a pose");
      this.entries.set(`${spec.letter}/${spec.maximum}`, {
        spec,
        words,
        nodes,
        index,
      });
    }
  }
  private entry(letter: Letter, maximum: number): Entry | undefined {
    return this.entries.get(`${letter}/${maximum}`);
  }
  has(letter: Letter, maximum: number): boolean {
    return this.entries.has(`${letter}/${maximum}`);
  }
  /** Settled pose of node `value` (first lap); null without a period or beyond the range. */
  poseFor(letter: Letter, maximum: number, value: number): CubeState | null {
    const e = this.entry(letter, maximum);
    return e && value >= 0 && value <= maximum ? e.nodes[value] : null;
  }
  /** Node of `state`, or -1 when the pose is not on the period. */
  nodeOf(letter: Letter, maximum: number, state: CubeState): number {
    return this.entry(letter, maximum)?.index.get(poseKey(state)) ?? -1;
  }
  /** The period route to the next value, or null when `state` is off the period. */
  route(
    letter: Letter,
    maximum: number,
    direction: number,
    state: CubeState,
    value: number,
  ): PeriodRoute | null {
    const e = this.entry(letter, maximum);
    if (!e) return null;
    const from = e.index.get(poseKey(state));
    if (from === undefined) return null;
    const n = e.nodes.length,
      modulus = maximum + 1;
    if (direction === 1) {
      const node = (from + 1) % n;
      return node % modulus === value ? { moves: e.words[from], node } : null;
    }
    const node = (from - 1 + n) % n;
    return node % modulus === value
      ? { moves: inverseMoves(e.words[node]), node }
      : null;
  }
}
