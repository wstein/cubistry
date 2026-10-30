import { demand, type LegalMove } from "@cubistry/cube-core";
import type { MotionTiming } from "@cubistry/cube-viewer";
/** Angular work: a half turn covers twice the angle of a quarter turn. */
export const quarterTurnUnits = (moves: readonly LegalMove[]): number =>
  moves.reduce((total, move) => total + Math.abs(move.turns), 0);
/** Contiguous windows end at the route deadline. HSM defaults to angular units;
 * Timer explicitly uses one HTM unit per legal token, including half turns. */
export function routeTurnTiming(
  moves: readonly LegalMove[],
  index: number,
  endAt: number,
  unitDurationMs: number,
  revision: number,
  metric: "quarter" | "htm" = "quarter",
): MotionTiming {
  demand(
    Number.isInteger(index) &&
      index >= 0 &&
      index < moves.length &&
      Number.isFinite(endAt) &&
      Number.isFinite(unitDurationMs) &&
      unitDurationMs >= 10 &&
      (metric === "quarter" || metric === "htm"),
    "Invalid route timing",
  );
  const weight = metric === "htm" ? 1 : Math.abs(moves[index].turns);
  const remaining = metric === "htm" ? moves.length - index - 1 : quarterTurnUnits(moves.slice(index + 1));
  return {
    endAt: endAt - remaining * unitDurationMs,
    durationMs: weight * unitDurationMs,
    // Missed windows remain incremental and retain the selected speed metric.
    lateDurationMs: weight * 10,
    revision,
  };
}
