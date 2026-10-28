import { demand, type LegalMove } from "@cubistry/cube-core";
import type { MotionTiming } from "@cubistry/cube-viewer";
/** Angular work: a half turn covers twice the angle of a quarter turn. */
export const quarterTurnUnits = (moves: readonly LegalMove[]): number =>
  moves.reduce((total, move) => total + Math.abs(move.turns), 0);
/** Contiguous windows share one angular rate and end exactly at the route deadline. */
export function routeTurnTiming(
  moves: readonly LegalMove[],
  index: number,
  endAt: number,
  quarterDurationMs: number,
  revision: number,
): MotionTiming {
  demand(
    Number.isInteger(index) &&
      index >= 0 &&
      index < moves.length &&
      Number.isFinite(endAt) &&
      Number.isFinite(quarterDurationMs) &&
      quarterDurationMs >= 10,
    "Invalid angular route timing",
  );
  const weight = Math.abs(moves[index].turns);
  return {
    endAt: endAt - quarterTurnUnits(moves.slice(index + 1)) * quarterDurationMs,
    durationMs: weight * quarterDurationMs,
    // A missed window still has a legal incremental 2:1 half/quarter fallback.
    lateDurationMs: weight * 10,
    revision,
  };
}
