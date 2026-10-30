import {
  demand,
  type CubeState,
  type LegalMove,
  type PrintDefinition,
} from "@cubistry/cube-core";
import { applyMoves, initialState, parseAlg } from "@cubistry/cube-mechanics";
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
 * Closed counting periods of the pinned print, replayed on the caller's print,
 * one per counting mode (letter, range and direction).
 *
 * Counting follows each node's saved word. A pose that is not a node of the
 * mode's period (after a free jump, a catch-up or an interrupted route) has no
 * period route; the caller then recovers onto the period (recovery.ts) or, for
 * a jump, replans with the exact shortest-path planner.
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
      this.entries.set(
        HsmPeriods.id(spec.letter, spec.maximum, spec.direction),
        {
          spec,
          words,
          nodes,
          index,
        },
      );
    }
  }
  private static id(letter: Letter, maximum: number, direction: number) {
    return `${letter}/${maximum}/${direction}`;
  }
  private entry(letter: Letter, maximum: number, direction: number) {
    return this.entries.get(HsmPeriods.id(letter, maximum, direction));
  }
  has(letter: Letter, maximum: number, direction: number): boolean {
    return this.entries.has(HsmPeriods.id(letter, maximum, direction));
  }
  /** Value shown by node `i` of a period. */
  private static value(e: Entry, i: number): number {
    const n = e.spec.maximum + 1;
    return (((e.spec.direction * i) % n) + n) % n;
  }
  /** Settled pose of the first node showing `value`; null without a period or beyond the range. */
  poseFor(
    letter: Letter,
    maximum: number,
    direction: number,
    value: number,
  ): CubeState | null {
    const e = this.entry(letter, maximum, direction);
    if (!e || value < 0 || value > maximum) return null;
    return e.nodes.find((_, i) => HsmPeriods.value(e, i) === value) ?? null;
  }
  /** Every node of the period that shows `value` (one per lap). */
  nodesShowing(
    letter: Letter,
    maximum: number,
    direction: number,
    value: number,
  ): readonly CubeState[] {
    const e = this.entry(letter, maximum, direction);
    return e ? e.nodes.filter((_, i) => HsmPeriods.value(e, i) === value) : [];
  }
  /** Node of `state`, or -1 when the pose is not on the period. */
  nodeOf(
    letter: Letter,
    maximum: number,
    direction: number,
    state: CubeState,
  ): number {
    return (
      this.entry(letter, maximum, direction)?.index.get(poseKey(state)) ?? -1
    );
  }
  /** The period route to the next value, or null when `state` is off the period. */
  route(
    letter: Letter,
    maximum: number,
    direction: number,
    state: CubeState,
    value: number,
  ): PeriodRoute | null {
    const e = this.entry(letter, maximum, direction);
    if (!e) return null;
    const from = e.index.get(poseKey(state));
    if (from === undefined) return null;
    const node = (from + 1) % e.nodes.length;
    return HsmPeriods.value(e, node) === value
      ? { moves: e.words[from], node }
      : null;
  }
}
