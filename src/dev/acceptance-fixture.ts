/** Product acceptance fixture, separate from the reusable solver adapter. */
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { targetFor, validateCounterDesign } from "../apps/counter/design.ts";
export const START_WORD = "R U F2 L' D B";
export const GOAL_VALUES = [0, 7, 42, 58, 99] as const;
export function acceptanceFixture(raw: unknown) {
  const design = validateCounterDesign(raw),
    print = design.prints.padded,
    start = applyMoves(initialState(print), parseAlg(START_WORD));
  const goal = (value: number) => {
    if (!GOAL_VALUES.some((v) => v === value))
      throw Error("Choose one of the documented acceptance values");
    const state = applyMoves(
      initialState(print),
      parseAlg(design.witnesses[value].word),
    );
    if (!matchesTarget(print, state, targetFor(value, true)))
      throw Error("Frozen goal fixture does not display its value");
    return state;
  };
  return { design, print, start, goal };
}
