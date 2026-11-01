import { demand } from "@cubistry/cube-core";
import { planSequence } from "../timer/scheduler.ts";

/** Moduli of a two-cube counter, in the names `PairController` takes. */
export interface PairModuli {
  /** Values per minor unit (right cube, changes on every step). */
  readonly minorModulus: number;
  /** Values per major unit (left cube, changes on the minor unit's wrap). */
  readonly majorModulus: number;
}
/** M/S: seconds 00–59 and minutes 00–59 (M/S Timer plan). */
export const MS_MODULI: PairModuli = Object.freeze({ minorModulus: 60, majorModulus: 60 });
/** H/M: minutes 00–59 and hours 00–23 (H/M Counter plan). */
export const HM_MODULI: PairModuli = Object.freeze({ minorModulus: 60, majorModulus: 24 });

/** One counting step and whether it carries into the major unit. */
export interface CarryStep {
  readonly to: number;
  readonly minor: number;
  readonly major: number;
  /** The minor unit wraps (59 -> 00 up, 00 -> 59 down): the major unit changes in the same step. */
  readonly carry: boolean;
}

/**
 * The carry rule of a pair: the combined value `major * minorModulus + minor`
 * moves by one and wraps at both ends (59:59 -> 00:00, 23:59 -> 00:00), so the
 * minor unit changes on every step and the major unit exactly when the minor
 * unit wraps. A caller that must stop at an end (a timer) does not ask for
 * that step.
 */
export function carryStep(moduli: PairModuli, value: number, direction: 1 | -1): CarryStep {
  const { minorModulus: m, majorModulus: M } = moduli;
  demand(Number.isInteger(m) && Number.isInteger(M) && m >= 2 && M >= 2, "Invalid pair moduli");
  demand(Number.isInteger(value) && value >= 0 && value < m * M, "Invalid pair value");
  demand(direction === 1 || direction === -1, "Invalid pair direction");
  const to = (value + direction + m * M) % (m * M),
    minor = value % m;
  return Object.freeze({
    to,
    minor: to % m,
    major: Math.floor(to / m),
    carry: direction === 1 ? minor === m - 1 : minor === 0,
  });
}

/**
 * Per-cube time budget of one step, both cubes turning in parallel. Each cube
 * gets the whole step budget of the predictive Timer scheduler
 * (`planSequence`, docs/WORKSHOP_TIMER.md) for its own word; the two words are
 * neither split nor chained (3 + 4 = 7 HTM is infeasible at 1x). The scheduler
 * overhead grows with the move count, so a step is feasible exactly when its
 * larger word fits: the step is planned for the larger word, for example the
 * 4-HTM S3 minutes edges 14->15, 35->36 and 55->56.
 */
export interface CarryBudget {
  readonly minor: ReturnType<typeof planSequence>;
  /** Null when the major cube does not turn in this step. */
  readonly major: ReturnType<typeof planSequence> | null;
  /** HTM of the larger word of the step. */
  readonly larger: number;
  readonly feasible: boolean;
  /** Longest planned cube duration; both cubes end at the same deadline. */
  readonly duration: number;
}
export function planCarryBudget(
  moves: { readonly minor: number; readonly major: number | null },
  preferred: number,
  interval: number,
  available = interval,
): CarryBudget {
  const counts = [moves.minor, moves.major ?? 0];
  demand(
    counts.every((n) => Number.isInteger(n) && n >= 0) &&
      Number.isFinite(preferred) &&
      preferred > 0 &&
      Number.isFinite(interval) &&
      interval > 0 &&
      Number.isFinite(available),
    "Invalid pair budget input",
  );
  const minor = planSequence(moves.minor, preferred, interval, available),
    major = moves.major === null ? null : planSequence(moves.major, preferred, interval, available);
  return Object.freeze({
    minor,
    major,
    larger: Math.max(...counts),
    feasible: minor.feasible && (major?.feasible ?? true),
    duration: Math.max(minor.duration, major?.duration ?? 0),
  });
}
