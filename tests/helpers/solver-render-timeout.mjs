// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseAlg } from "@cubistry/cube-mechanics";
import { DEFAULT_QUARTER_TURN_MS } from "@cubistry/cube-viewer";

/** Actual animation work plus the existing five-second render/readiness reserve. */
export function solverRenderTimeout(word) {
  const moves = parseAlg(word);
  // Match the acceptance page's response bound, rather than accepting an unbounded wait.
  if (moves.length > 128) throw new RangeError("Solver word exceeds the 128-move contract");
  const quarterTurns = moves.reduce((total, move) => total + Math.abs(move.turns), 0);
  return quarterTurns * DEFAULT_QUARTER_TURN_MS + 5000;
}
