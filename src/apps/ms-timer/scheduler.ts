import type { ClockSnapshot } from "../timer/clock.ts";
import { TimerScheduler, type TimerCube } from "../timer/scheduler.ts";

export type TimerWarning = "" | "Budget infeasible" | "Late";

/** The two cubes of the timer: the minor one shows seconds, the major one minutes. */
export interface TimerPair {
  readonly minor: TimerCube;
  readonly major: TimerCube;
  readonly minorModulus: number;
}

/**
 * The clock sample as one cube sees it: the combined value (seconds since
 * 00:00) split into the cube's own value. Boundary times are those of the
 * combined clock, so a cube that does not change at a boundary has nothing to
 * schedule and a carry gives the minutes cube the same deadline as the seconds.
 */
export function cubeSnapshot(
  snapshot: ClockSnapshot,
  unit: "minor" | "major",
  minorModulus: number,
): ClockSnapshot {
  const part = (value: number) =>
    unit === "minor" ? value % minorModulus : Math.floor(value / minorModulus);
  return {
    ...snapshot,
    bucket: part(snapshot.bucket),
    next: snapshot.next && {
      ...snapshot.next,
      target: part(snapshot.next.target),
    },
  };
}

/**
 * Predictive scheduling per cube. Each cube owns a `TimerScheduler`, so each
 * has its own plan, time budget, effective turn time and deadline: the last
 * turn of each cube ends at the same one-second boundary and both cubes turn
 * in parallel. Nothing is shown late silently: an infeasible budget or a
 * missed boundary of either cube is reported through `warning`.
 */
export class MsTimerScheduler {
  readonly minor: TimerScheduler;
  readonly major: TimerScheduler;

  private readonly modulus: number;

  constructor(
    modulus: number,
    refresh: () => void = () => {},
    readClock?: () => ClockSnapshot,
  ) {
    this.modulus = modulus;
    const fresh = (unit: "minor" | "major") =>
      readClock && (() => cubeSnapshot(readClock(), unit, modulus));
    this.minor = new TimerScheduler(refresh, fresh("minor"));
    this.major = new TimerScheduler(refresh, fresh("major"));
  }

  /** "Late" wins over "Budget infeasible"; empty when both cubes are on time. */
  get warning(): TimerWarning {
    const warnings = [this.minor.warning, this.major.warning];
    return warnings.includes("Late")
      ? "Late"
      : warnings.includes("Budget infeasible")
        ? "Budget infeasible"
        : "";
  }

  invalidate(): void {
    this.minor.invalidate();
    this.major.invalidate();
  }

  /** The combined target a cube is deliberately heading for, or null. */
  presentationTarget(snapshot: ClockSnapshot): number | null {
    const minor = this.minor.presentationTarget(
        cubeSnapshot(snapshot, "minor", this.modulus),
      ),
      major = this.major.presentationTarget(
        cubeSnapshot(snapshot, "major", this.modulus),
      );
    if (minor === null && major === null) return null;
    return snapshot.next?.target ?? null;
  }

  tick(
    snapshot: ClockSnapshot,
    pair: TimerPair,
    preferred: number,
    setDuration: {
      minor(ms: number): void;
      major(ms: number): void;
    },
  ): void {
    for (const unit of ["minor", "major"] as const)
      this[unit].tick(
        cubeSnapshot(snapshot, unit, this.modulus),
        pair[unit],
        preferred,
        setDuration[unit],
      );
  }
}
