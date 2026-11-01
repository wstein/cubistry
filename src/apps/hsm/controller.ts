import {
  PhysicalPlayback,
  type PhysicalView,
  type MoveProgress,
} from "../shared/playback.ts";
import {
  demand,
  stateEquals,
  type CubeState,
  type LegalMove,
} from "@cubistry/cube-core";
import type { MovePresentation } from "@cubistry/cube-mechanics";
import {
  applyMoves,
  initialState,
  parseAlg,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { loadAssets, type AssetManifest } from "@cubistry/cube-assets";
import { hsmTarget, type HsmDesign, type Letter } from "./design.ts";
import { HsmPlanner } from "./planner.ts";
import { HsmPeriods } from "./periods.ts";
import { HsmRecovery, type RecoveryPlan, type SearchTask } from "./recovery.ts";
import type { RecoveryExecutor, SearchJob } from "./recovery-executor.ts";
import { routeTurnTiming } from "../shared/turn-timing.ts";
/** A recovery search the controller needs: the inputs fully determine its result. */
type Need =
  | {
      readonly kind: "plan";
      readonly range: number;
      readonly direction: number;
      readonly state: CubeState;
      /** The value the cube shows now; the plan counts on from it. */
      readonly value: number;
    }
  | {
      readonly kind: "jump";
      readonly range: number;
      readonly direction: number;
      readonly state: CubeState;
      /** The value to jump to. */
      readonly value: number;
    };
const sameNeed = (a: Need, b: Need): boolean =>
  a.kind === b.kind &&
  a.range === b.range &&
  a.direction === b.direction &&
  a.value === b.value &&
  stateEquals(a.state, b.state);
/** Thrown only in probe mode, where a route would have to run a search inline. */
class NeedsSearch {
  readonly need: Need;
  constructor(need: Need) {
    this.need = need;
  }
}
export class HsmController extends PhysicalPlayback {
  private readonly design: HsmDesign;
  private readonly manifest: AssetManifest;
  private readonly resolveAssets: typeof loadAssets;
  private readonly planner = new HsmPlanner();
  private readonly periods: HsmPeriods;
  private recovery: HsmRecovery | null = null;
  /** Remaining recovery steps: valid while the cube is at `source` in this mode. */
  private recovering: {
    range: number;
    direction: number;
    source: CubeState;
    value: number;
    words: readonly (readonly LegalMove[])[];
  } | null = null;
  private planned: readonly LegalMove[] = [];
  /** Where recovery searches run; without one they run inline (Node, tests). */
  private readonly executor: RecoveryExecutor | null;
  /** The search in flight (at most one) and the finished result not yet used. */
  private pending: {
    readonly need: Need;
    readonly target: number;
    readonly job: SearchJob<unknown>;
    /** Settles when the search finishes or is dropped, whatever the executor does. */
    readonly settled: Promise<void>;
    readonly release: () => void;
  } | null = null;
  /**
   * Finished off-thread results, at most one per kind and kept (a null result
   * included) until replaced: one route may ask for a plan and then a jump for
   * the same pose, and neither may be searched twice.
   */
  private found: {
    readonly need: Need;
    readonly result: RecoveryPlan | readonly LegalMove[] | null;
  }[] = [];
  private searchError: Error | null = null;
  private probing = false;
  readonly letter: Letter;
  private range = 59;
  private direction = 1;
  private prepared: {
    source: CubeState;
    value: number;
    moves: readonly LegalMove[];
    target: CubeState;
  } | null = null;
  private timing: {
    target: number;
    endAt: number;
    quarterDurationMs: number;
    revision: number;
  } | null = null;
  private revision = 0;
  /** Clock-only angular schedule; standalone counting keeps its existing speed contract. */
  setDeadline(target: number, endAt: number, quarterDurationMs: number): void {
    demand(
      Number.isFinite(endAt) &&
        Number.isFinite(quarterDurationMs) &&
        quarterDurationMs >= 10,
      "Invalid HSM angular deadline",
    );
    if (
      this.timing?.target === target &&
      this.timing.endAt === endAt &&
      this.timing.quarterDurationMs === quarterDurationMs
    )
      return;
    this.timing = {
      target,
      endAt,
      quarterDurationMs,
      revision: ++this.revision,
    };
  }
  clearDeadline(): void {
    this.timing = null;
    this.revision++;
  }
  protected animateMove(presentation: MovePresentation): Promise<void> {
    const index = this.playback.completed;
    return this.view.animate(
      presentation,
      this.timing
        ? () =>
            this.timing?.target === this.playback.target
              ? routeTurnTiming(
                  this.planned,
                  index,
                  this.timing.endAt,
                  this.timing.quarterDurationMs,
                  this.timing.revision,
                )
              : null
        : undefined,
    );
  }
  prepare(value: number): readonly LegalMove[] {
    demand(!this.busy, "HSM must be settled before preparation");
    this.prepareTarget(value);
    return this.planned;
  }
  setMode(range: number, direction: number): void {
    demand(
      [11, 23, 59].includes(range) && [1, -1].includes(direction),
      "Invalid HSM counting mode",
    );
    if (this.range !== range || this.direction !== direction) {
      this.prepared = null;
      this.cancelSearch();
    }
    this.range = range;
    this.direction = direction;
  }
  constructor(
    view: PhysicalView,
    design: HsmDesign,
    manifest: AssetManifest,
    letter: Letter,
    onState: (
      v: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
    resolveAssets: typeof loadAssets = loadAssets,
    executor: RecoveryExecutor | null = null,
  ) {
    super(view, onState);
    this.executor = executor;
    this.design = design;
    this.manifest = manifest;
    this.letter = letter;
    this.resolveAssets = resolveAssets;
    this.periods = new HsmPeriods(design.print, design.periods);
  }
  protected get maximumValue(): number {
    return 59;
  }
  protected targetState(value: number): CubeState {
    return this.prepareTarget(value);
  }
  private prepareTarget(value: number): CubeState {
    demand(this.state, "HSM counter not configured");
    demand(
      Number.isInteger(value) && value >= 0 && value <= 59,
      "Invalid HSM target",
    );
    if (
      this.prepared?.value === value &&
      stateEquals(this.prepared.source, this.state)
    ) {
      this.planned = this.prepared.moves;
      return this.prepared.target;
    }
    // On a saved period the route is the pinned one. Counting on from a pose
    // off the period (after a free jump, a catch-up or an interrupted route)
    // follows a recovery plan back onto it, every step showing the next value.
    // A jump to a value that is not the next one takes a least route that
    // prefers a period node, else a pose with a next step of at most five HTM;
    // the exact planner remains the last fallback.
    const onPeriod = this.periods.route(
      this.letter,
      this.range,
      this.direction,
      this.state,
      value,
    );
    const routed =
      onPeriod?.moves ?? this.recoveryStep(value) ?? this.periodJump(value);
    if (routed) this.planned = routed;
    else {
      const next = (value + this.direction + this.range + 1) % (this.range + 1);
      const front = hsmTarget(this.letter, value),
        settledUnit = matchesTarget(this.design.print, this.state, {
          ...front,
          facelets: front.facelets.slice(0, 2),
        });
      this.planned = this.planner[settledUnit ? "plan" : "planFromPose"](
        this.design.print,
        this.state,
        this.letter,
        value,
        next,
      );
    }
    const target = applyMoves(this.state, this.planned);
    this.prepared = { source: this.state, value, moves: this.planned, target };
    return target;
  }
  /** Least free jump toward `value` that prefers period nodes; null without a period. */
  private periodJump(value: number): readonly LegalMove[] | null {
    if (
      value > this.range ||
      !this.periods.has(this.letter, this.range, this.direction)
    )
      return null;
    const state = this.state!,
      word = this.resolve(
        {
          kind: "jump",
          range: this.range,
          direction: this.direction,
          state,
          value,
        },
        () =>
          this.recoverer().jump(
            state,
            this.letter,
            this.range,
            this.direction,
            value,
            this.targetsOf(this.range, this.direction),
          ),
      ) as readonly LegalMove[] | null;
    return word?.length ? word : null;
  }
  /**
   * The next recovery step toward `value` when the cube settles on the previous
   * value of the current counting mode; null for a jump or without a period.
   */
  private recoveryStep(value: number): readonly LegalMove[] | null {
    const n = this.range + 1,
      previous = (value - this.direction + n) % n,
      state = this.state!;
    if (
      value > this.range ||
      !this.periods.has(this.letter, this.range, this.direction) ||
      !matchesTarget(this.design.print, state, hsmTarget(this.letter, previous))
    )
      return null;
    const r = this.recovering;
    if (
      !r ||
      r.range !== this.range ||
      r.direction !== this.direction ||
      r.value !== value ||
      !stateEquals(r.source, state)
    ) {
      const plan = this.resolve(
        {
          kind: "plan",
          range: this.range,
          direction: this.direction,
          state,
          value: previous,
        },
        () =>
          this.recoverer().plan(
            state,
            this.letter,
            this.range,
            this.direction,
            previous,
            this.targetsOf(this.range, this.direction),
          ),
      ) as RecoveryPlan | null;
      this.recovering = plan && {
        range: this.range,
        direction: this.direction,
        source: state,
        value,
        words: plan.words,
      };
    }
    const plan = this.recovering;
    if (!plan) return null;
    const [word, ...rest] = plan.words;
    this.recovering = rest.length
      ? {
          ...plan,
          source: applyMoves(state, word),
          value: (value + this.direction + n) % n,
          words: rest,
        }
      : null;
    return word;
  }
  private recoverer(): HsmRecovery {
    return (this.recovery ??= new HsmRecovery(this.design.print, this.planner));
  }
  private targetsOf(range: number, direction: number) {
    return (v: number) =>
      this.periods.nodesShowing(this.letter, range, direction, v);
  }
  /**
   * The result of a recovery search: a finished off-thread result for exactly
   * these inputs, else computed inline. In probe mode the inline case throws
   * instead, so the caller can start the search off the critical path.
   */
  private resolve(
    need: Need,
    compute: () => RecoveryPlan | readonly LegalMove[] | null,
  ): RecoveryPlan | readonly LegalMove[] | null {
    const hit = this.found.find((f) => sameNeed(f.need, need));
    if (hit) return hit.result;
    if (this.probing) throw new NeedsSearch(need);
    return compute();
  }
  private cancelSearch(): void {
    const p = this.pending;
    this.pending = null;
    p?.job.cancel();
    p?.release();
  }
  /** Start (or keep) the search for `need`, replacing any other one. */
  private search(need: Need, target: number): Promise<void> {
    const old = this.pending;
    if (old && sameNeed(old.need, need)) return old.settled;
    this.cancelSearch();
    const { range, direction, state, value } = need,
      recovery = this.recoverer(),
      targets = this.targetsOf(range, direction),
      task: SearchTask<unknown> =
        need.kind === "plan"
          ? recovery.planTask(
              state,
              this.letter,
              range,
              direction,
              value,
              targets,
            )
          : recovery.jumpTask(
              state,
              this.letter,
              range,
              direction,
              value,
              targets,
            ),
      job = this.executor!.start(task);
    let release!: () => void;
    const aborted = new Promise<void>((resolve) => (release = resolve));
    const handled = job.done.then(
        (outcome) => {
          if (this.pending === entry) this.pending = null;
          // Applied only to the very inputs it was computed for; a superseded,
          // cancelled or out-of-date search leaves nothing behind.
          if (
            !outcome.cancelled &&
            this.range === range &&
            this.direction === direction &&
            this.state &&
            stateEquals(this.state, state)
          )
            this.found = [
              ...this.found.filter((f) => f.need.kind !== need.kind),
              {
                need,
                result: outcome.value as
                  RecoveryPlan | readonly LegalMove[] | null,
              },
            ];
        },
        (e) => {
          if (this.pending === entry) this.pending = null;
          this.searchError = e instanceof Error ? e : Error(String(e));
        },
      ),
      entry = {
        need,
        target,
        job,
        settled: Promise.race([handled, aborted]),
        release,
      };
    this.pending = entry;
    return entry.settled;
  }
  /**
   * Make the route to `value` computable without blocking: null when it is (it
   * is then also planned and cached), else the promise of the started search.
   */
  private ensureRoute(value: number): Promise<void> | null {
    if (!this.executor) return null;
    if (this.searchError) {
      const e = this.searchError;
      this.searchError = null;
      throw e;
    }
    this.probing = true;
    try {
      this.prepareTarget(value);
      return null;
    } catch (e) {
      if (!(e instanceof NeedsSearch)) throw e;
      return this.search(e.need, value).then(() => {
        if (this.searchError) {
          const err = this.searchError;
          this.searchError = null;
          throw err;
        }
      });
    } finally {
      this.probing = false;
    }
  }
  /**
   * Non-blocking `prepare`: the route when it needs no search or the search has
   * finished, else null while a sliced search for it runs (polling again
   * continues it). Without an executor this is `prepare`.
   */
  tryPrepare(value: number): readonly LegalMove[] | null {
    demand(!this.busy, "HSM must be settled before preparation");
    if (!this.executor) return this.prepare(value);
    return this.ensureRoute(value) ? null : this.planned;
  }
  protected override beforeTarget(value: number): Promise<void> | null {
    return this.ensureRoute(value);
  }
  override request(value: number): void {
    // A retarget drops the search for the old value at once.
    if (this.pending && this.pending.target !== value) this.cancelSearch();
    super.request(value);
  }
  override dispose(): void {
    this.cancelSearch();
    super.dispose();
  }
  protected targetMoves(): readonly LegalMove[] {
    return this.planned;
  }
  protected matchesDisplay(state: CubeState, value: number): boolean {
    return matchesTarget(
      this.design.print,
      state,
      hsmTarget(this.letter, value),
    );
  }
  /**
   * Install the settled pose for `value`. When the current counting mode has a
   * saved period (every mode of the pinned print has one) the pose is that
   * period's node, so counting starts on the pinned routes; otherwise it is the
   * letter's setup followed by a routed jump.
   */
  async configure(value = 0): Promise<void> {
    demand(!this.busy && !this.configuring, "Wait for HSM motion");
    demand(
      Number.isInteger(value) && value >= 0 && value <= 59,
      "Invalid HSM initial value",
    );
    this.configuring = true;
    let assets;
    try {
      assets = await this.resolveAssets(this.manifest, [this.design.print]);
      let state =
        this.periods.poseFor(this.letter, this.range, this.direction, value) ??
        applyMoves(
          initialState(this.design.print),
          parseAlg(this.design.zeroWords[this.letter]),
        );
      if (
        !matchesTarget(this.design.print, state, hsmTarget(this.letter, value))
      )
        state = applyMoves(
          state,
          this.planner.plan(this.design.print, state, this.letter, value),
        );
      this.prepared = null;
      this.recovering = null;
      this.found = [];
      this.cancelSearch();
      this.clearDeadline();
      this.install(this.design.print, state, assets, value);
      assets = undefined;
    } finally {
      assets?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
