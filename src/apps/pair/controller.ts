import { demand } from "@cubistry/cube-core";
import { ENDPOINT_TOLERANCE_MS } from "../timer/scheduler.ts";
import { carryStep, planCarryBudget, type CarryBudget } from "./carry.ts";

/**
 * One cube of a pair, as far as the pair needs it. `MsController` satisfies
 * this directly; an `HsmController` needs the counting-direction adapter in
 * `hsm-unit.ts`. The unit owns its turns: it only ever plays turns of a saved
 * period word or its inverse, replans from the pose after a newer `request`,
 * and reports `busy` through the state callback it was created with.
 */
export interface PairUnit {
  /** True from the first queued turn until the unit has settled on its target. */
  readonly busy: boolean;
  /** The value the cube shows when it last settled. */
  readonly currentValue: number;
  /** Install the settled pose that shows `value`. */
  configure(value: number): Promise<void>;
  /** Walk to `value`; a newer request replaces the pending one. */
  request(value: number): void;
  /** Release the display; only valid once the unit has settled. */
  dispose(): void;
  /**
   * Optional: switch the counting direction (+1 or -1) before the next
   * request. Units whose saved periods are direction specific (H/M/S) need it;
   * units that walk one period both ways (M/S) omit it.
   */
  setDirection?(direction: 1 | -1): void;
  /**
   * Optional: the moves the unit would play to reach `value` from its settled
   * pose, without playing them. Needed only for timed steps (`PairTiming`),
   * which plan each cube's budget from its word. `MsController` and
   * `HsmController` (through `hsmPairUnit`) provide it.
   */
  prepare?(value: number): readonly unknown[];
}

/** Deadline of one step, for a caller with wall-clock boundaries (a timer). */
export interface PairTiming {
  /** Time (on the pair's `now` clock) by which both cubes must show the target. */
  readonly deadline: number;
  /** Step interval for the scheduler budget (1000 ms for one-second steps at 1x). */
  readonly interval: number;
  /** Preferred duration per HTM move. */
  readonly preferred: number;
}
/** A timed step as planned: the owner applies each cube's `budget` duration. */
export interface PairTimedStep {
  readonly from: number;
  readonly to: number;
  readonly carry: boolean;
  readonly timing: PairTiming;
  /** Planned HTM per cube (major null without a carry); null when the step was issued while the pair still moved. */
  readonly moves: { readonly minor: number; readonly major: number | null } | null;
  readonly budget: CarryBudget | null;
}
/**
 * A timed step the display could not do in time. Never silent: each is
 * reported, and the cubes still finish their routes.
 * - `budget-infeasible`: the planned words do not fit the step budget.
 * - `late`: both cubes settled after the deadline plus the 20 ms endpoint
 *   tolerance. Not reported when a unit failed during that step: the failure
 *   (`error`, `onState`) is the report then.
 * - `missed`: the next timed step arrived while the pair still moved (the
 *   in-flight timed step, if any, is named); the new target replaces it.
 */
export type PairReport =
  | { readonly kind: "budget-infeasible"; readonly step: PairTimedStep }
  | { readonly kind: "late"; readonly step: PairTimedStep; readonly settledAt: number }
  | { readonly kind: "missed"; readonly step: PairTimedStep | null; readonly at: number };

/** The state callback every single-cube controller takes as its constructor argument. */
export type UnitStateHandler = (
  value: number,
  busy: boolean,
  error?: Error,
  progress?: unknown,
) => void;

/** Creates a unit that reports its changes through the given handler. */
export type UnitFactory<U extends PairUnit> = (onState: UnitStateHandler) => U;

export interface PairState {
  /** Last fully settled combined value (major * minorModulus + minor). */
  readonly value: number;
  /** The combined value the pair is moving to, or has reached. */
  readonly target: number;
  readonly busy: boolean;
  /** Set when a unit failed; the unit needs a new `configure`. */
  readonly error?: Error;
}

export interface PairOptions<Minor extends PairUnit, Major extends PairUnit> {
  /** Values per minor unit (60 for seconds or minutes). */
  readonly minorModulus: number;
  /** Values per major unit (60 for minutes, 24 for hours). */
  readonly majorModulus: number;
  readonly createMinor: UnitFactory<Minor>;
  readonly createMajor: UnitFactory<Major>;
  /** Called on every change of the pair state. */
  readonly onState?: (state: PairState) => void;
  /** Clock for timed steps (default `performance.now`). */
  readonly now?: () => number;
  /** Called for every report of a timed step. */
  readonly onReport?: (report: PairReport) => void;
}

/**
 * One combined counter over a minor and a major cube, with carry. The value
 * runs 0 .. majorModulus * minorModulus - 1 and wraps; the minor unit shows
 * `value % minorModulus` and the major unit `floor(value / minorModulus)`, so a
 * wrap of the minor unit changes the major unit in the same step (59:59 to
 * 00:00 for M/S, 23:59 to 00:00 for H/M). Both cubes turn in parallel and a
 * move ends only when both have settled. The class has no timers: the caller
 * decides when to step and the units do their own async playback. It reads its
 * clock (`now`) only to plan timed steps and check them against their deadlines.
 */
export class PairController<
  Minor extends PairUnit = PairUnit,
  Major extends PairUnit = PairUnit,
> {
  readonly minor: Minor;
  readonly major: Major;
  readonly minorModulus: number;
  readonly majorModulus: number;
  /** Number of distinct values: majorModulus * minorModulus. */
  readonly size: number;
  private readonly onState: ((state: PairState) => void) | undefined;
  private pending = 0;
  private counting: 1 | -1 = 1;
  private failure: Error | undefined;
  private issuing = false;
  private configuring = false;
  private configured = false;
  private waiters: (() => void)[] = [];
  private readonly now: () => number;
  private readonly onReport: ((report: PairReport) => void) | undefined;
  /** The timed step in flight, checked against its deadline when both cubes settle. */
  private clocked: PairTimedStep | null = null;
  /** `failure` when the timed step in flight was issued, to tell a failure of that step from an older one. */
  private clockedFailure: Error | undefined;
  private latest: PairTimedStep | null = null;

  constructor(options: PairOptions<Minor, Major>) {
    const { minorModulus, majorModulus } = options;
    demand(
      Number.isInteger(minorModulus) &&
        Number.isInteger(majorModulus) &&
        minorModulus >= 2 &&
        majorModulus >= 2,
      "Invalid pair moduli",
    );
    this.minorModulus = minorModulus;
    this.majorModulus = majorModulus;
    this.size = minorModulus * majorModulus;
    this.onState = options.onState;
    this.now = options.now ?? (() => performance.now());
    this.onReport = options.onReport;
    this.minor = options.createMinor(this.handler);
    this.major = options.createMajor(this.handler);
  }

  /** Last fully settled combined value. */
  get value(): number {
    return (
      this.major.currentValue * this.minorModulus + this.minor.currentValue
    );
  }
  /** The combined value the pair is moving to, or has reached. */
  get target(): number {
    return this.pending;
  }
  /** True until both cubes have settled. */
  get busy(): boolean {
    return this.configuring || this.minor.busy || this.major.busy;
  }
  /** First failure of a unit since the last `configure`, if any. */
  get error(): Error | undefined {
    return this.failure;
  }
  /**
   * The latest timed step as planned (kept after it settles), so the owner can
   * apply each cube's budget; null before the first timed step.
   */
  get lastTimedStep(): PairTimedStep | null {
    return this.latest;
  }
  /** Counting direction of the latest step (+1 until a step goes down). */
  get direction(): 1 | -1 {
    return this.counting;
  }

  /** Install the settled poses for `value`; the pair must be idle. */
  async configure(value = 0, direction: 1 | -1 = 1): Promise<void> {
    demand(!this.busy, "Wait for the pair to settle");
    this.check(value);
    this.configuring = true;
    this.failure = undefined;
    try {
      this.direct(direction);
      await Promise.all([
        this.minor.configure(value % this.minorModulus),
        this.major.configure(Math.floor(value / this.minorModulus)),
      ]);
      this.pending = value;
      this.configured = true;
    } finally {
      this.configuring = false;
    }
    this.publish();
  }

  /**
   * Contract for `step`, `set` and `reset`: a call before `configure` (or
   * after `dispose`), while `configure` runs, or with an invalid argument
   * throws synchronously BEFORE any state change (no request, no target
   * change). Once accepted, the call never throws or rejects: if a unit fails
   * (it reports an error, or its request throws), the failure is recorded in
   * `error` and published through `onState`, a half-issued request is undone
   * (the target returns to its previous value and the units are asked for it),
   * and the returned promise resolves as soon as no cube is busy.
   *
   * Move the pending target by one and carry. Relative to the pending target,
   * so two calls in a row count twice. Resolves when the pair is idle, that is
   * when both cubes have settled on the latest target.
   *
   * With `timing` (a timer boundary) the step is planned first: each cube's
   * word comes from its `prepare` and gets its own budget (`planCarryBudget`).
   * An infeasible budget, a late settle and a step issued while the pair still
   * moves are reported through `onReport`. Invalid timing, or units without
   * `prepare`, throw before any state change; a `prepare` that throws is a unit
   * failure (recorded in `error`, nothing requested, the target unchanged).
   */
  step(direction: 1 | -1, timing: PairTiming | null = null): Promise<void> {
    demand(direction === 1 || direction === -1, "Invalid pair direction");
    this.ready();
    if (timing) {
      demand(
        Number.isFinite(timing.deadline) &&
          Number.isFinite(timing.interval) &&
          timing.interval > 0 &&
          Number.isFinite(timing.preferred) &&
          timing.preferred > 0,
        "Invalid pair timing",
      );
      demand(
        typeof this.minor.prepare === "function" &&
          typeof this.major.prepare === "function",
        "Timed steps need units that can prepare",
      );
    }
    const s = carryStep(this, this.pending, direction);
    if (!timing) {
      this.direct(direction);
      return this.go(s.to);
    }
    const from = this.pending,
      moving = this.busy;
    if (moving) this.report({ kind: "missed", step: this.clocked, at: this.now() });
    this.direct(direction);
    let moves: PairTimedStep["moves"] = null,
      budget: CarryBudget | null = null;
    if (!moving) {
      try {
        moves = {
          minor: this.minor.prepare!(s.minor).length,
          major: s.carry ? this.major.prepare!(s.major).length : null,
        };
        budget = planCarryBudget(moves, timing.preferred, timing.interval, timing.deadline - this.now());
      } catch (e) {
        // A unit cannot plan: report it like a refused request, request nothing.
        this.failure ??= e instanceof Error ? e : Error(String(e));
        this.publish();
        return Promise.resolve();
      }
    }
    const step: PairTimedStep = Object.freeze({ from, to: s.to, carry: s.carry, timing, moves, budget });
    this.clocked = this.latest = step;
    this.clockedFailure = this.failure;
    if (budget && !budget.feasible) this.report({ kind: "budget-infeasible", step });
    // A rolled-back step has no deadline left to miss: `release` reports late
    // only while the target is still this step's.
    return this.go(s.to);
  }

  /** Walk both cubes to `value`; the same settle and retarget rules as `step`. */
  set(value: number): Promise<void> {
    this.check(value);
    this.ready();
    return this.go(value);
  }

  /**
   * Walk to `value` (default 00:00): the same as `set`. Both cubes move in
   * parallel and each cube's own controller chooses its route: M/S walks its
   * saved period the cheaper way round; H/M follows its saved periods for the
   * next value and otherwise makes a least free jump that prefers period nodes
   * (`HsmController`), so a non-adjacent target is not a step-by-step walk.
   */
  reset(value = 0): Promise<void> {
    return this.set(value);
  }

  /**
   * Release both displays. Atomic: while any cube is busy (or `configure`
   * runs) it throws and neither cube is touched. Afterwards the pair needs a
   * new `configure` before it can step again.
   */
  dispose(): void {
    demand(!this.busy, "Wait for the pair to settle before releasing it");
    this.minor.dispose();
    this.major.dispose();
    this.configured = false;
  }

  private ready(): void {
    demand(this.configured && !this.configuring, "Configure the pair first");
  }

  private check(value: number): void {
    demand(
      Number.isInteger(value) && value >= 0 && value < this.size,
      "Invalid pair value",
    );
  }

  private direct(direction: 1 | -1): void {
    if (direction === this.counting) return;
    this.counting = direction;
    this.minor.setDirection?.(direction);
    this.major.setDirection?.(direction);
  }

  private go(value: number): Promise<void> {
    this.ready();
    const previous = this.pending;
    this.pending = value;
    const idle = new Promise<void>((resolve) => this.waiters.push(resolve));
    // Both requests go out before anything can count as settled.
    this.issuing = true;
    try {
      this.ask(this.minor, value % this.minorModulus);
      this.ask(this.major, Math.floor(value / this.minorModulus));
    } catch (e) {
      // A unit refused its request: record it, undo the half-issued carry.
      this.failure ??= e instanceof Error ? e : Error(String(e));
      this.pending = previous;
      for (const [unit, v] of [
        [this.minor, previous % this.minorModulus],
        [this.major, Math.floor(previous / this.minorModulus)],
      ] as const)
        try {
          this.ask(unit, v);
        } catch {
          // The unit is already failed; the error above is the report.
        }
    } finally {
      this.issuing = false;
    }
    this.publish();
    this.release();
    return idle;
  }

  /** Request `value` unless the unit already rests on it (a cube that does not carry stays still). */
  private ask(unit: PairUnit, value: number): void {
    if (!unit.busy && unit.currentValue === value) return;
    unit.request(value);
  }

  private readonly handler: UnitStateHandler = (_value, _busy, error) => {
    if (error && !this.failure) this.failure = error;
    if (this.issuing) return;
    this.publish();
    this.release();
  };

  private publish(): void {
    this.onState?.({
      value: this.value,
      target: this.pending,
      busy: this.busy,
      ...(this.failure ? { error: this.failure } : {}),
    });
  }

  private report(report: PairReport): void {
    this.onReport?.(report);
  }

  /** Resolve the waiting calls once both cubes are idle (or one has failed). */
  private release(): void {
    if (this.configuring || this.minor.busy || this.major.busy) return;
    const clocked = this.clocked;
    this.clocked = null;
    // A unit failure during this step is its report (`error`, `onState`); an
    // older failure, recorded before the step was issued, does not hide a late settle.
    if (clocked && clocked.to === this.pending && this.failure === this.clockedFailure) {
      const at = this.now();
      if (at > clocked.timing.deadline + ENDPOINT_TOLERANCE_MS)
        this.report({ kind: "late", step: clocked, settledAt: at });
    }
    const waiting = this.waiters;
    this.waiters = [];
    for (const resolve of waiting) resolve();
  }
}
