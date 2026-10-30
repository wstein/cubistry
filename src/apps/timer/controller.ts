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
import type { MotionTiming } from "@cubistry/cube-viewer";
import { matchesTarget, type MovePresentation } from "@cubistry/cube-mechanics";
import {
  loadAssets,
  validateAssets,
  type LoadedAssets,
  type AssetManifest,
} from "@cubistry/cube-assets";
import {
  createCounterSolver,
  type CounterSolver,
} from "../../adapters/puzlwerk-2x2.ts";
import { routeTurnTiming } from "../shared/turn-timing.ts";
import { timerTarget, timerStep, type TimerRoute } from "./design.ts";
/** A separate physical print/application; it never reinterprets Counter stickers. */
export class TimerController extends PhysicalPlayback {
  private readonly route: TimerRoute;
  private readonly manifest: AssetManifest;
  private readonly resolveAssets: typeof loadAssets;
  private readonly prepareSolver: typeof createCounterSolver;
  private solver: CounterSolver | null = null;
  private timing: { target: number; motion: MotionTiming } | null = null;
  private timingRevision = 0;
  private planned: readonly LegalMove[] = [];
  setDeadline(target: number, endAt: number, durationMs: number): void {
    if (
      this.timing?.target === target &&
      this.timing.motion.endAt === endAt &&
      this.timing.motion.durationMs === durationMs
    )
      return;
    this.timing = {
      target,
      motion: { endAt, durationMs, revision: ++this.timingRevision },
    };
  }
  clearDeadline(): void {
    this.timing = null;
    this.timingRevision++;
  }
  protected animateMove(presentation: MovePresentation): Promise<void> {
    const index = this.playback.completed, route = this.planned, target = this.playback.target;
    // Every turn can acquire/revise/release timing after it has started.
    // Capture this route/target so a queued target cannot lend it a deadline.
    return this.view.animate(presentation, () =>
      this.timing?.target === target
        ? routeTurnTiming(route, index, this.timing.motion.endAt,
            this.timing.motion.durationMs, this.timing.motion.revision, "htm")
        : null,
    );
  }
  private prepared: {
    source: CubeState;
    value: number;
    moves: readonly LegalMove[];
  } | null = null;
  /** Prepare only from a committed idle source, including all hidden poses. */
  prepare(value: number): readonly LegalMove[] {
    demand(
      !this.busy && this.state && this.solver,
      "Timer must be settled before preparation",
    );
    demand(
      Number.isInteger(value) && value >= 0 && value <= this.maximumValue,
      "Invalid timer target",
    );
    if (
      this.prepared?.value === value &&
      stateEquals(this.prepared.source, this.state)
    )
      return this.prepared.moves;
    const moves =
      timerStep(this.route, this.state, this.current, value) ??
      this.solver.solve(this.state, this.route.states[value], {
        coordinateFrames: true,
      });
    this.prepared = { source: this.state, value, moves };
    return moves;
  }
  constructor(
    view: PhysicalView,
    route: TimerRoute,
    assets: AssetManifest,
    onState: (
      value: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
    resolveAssets: typeof loadAssets = loadAssets,
    prepareSolver: typeof createCounterSolver = createCounterSolver,
  ) {
    super(view, onState);
    this.route = route;
    this.resolveAssets = resolveAssets;
    this.prepareSolver = prepareSolver;
    this.manifest = validateAssets(
      {
        ...assets,
        fonts: [],
        documents: [],
        images: assets.images.filter((i) => /^[0-9]$/.test(i.id)),
      },
      [route.print],
    );
  }
  protected get maximumValue(): number {
    return this.route.states.length - 1;
  }
  protected targetState(value: number): CubeState {
    return this.route.states[value];
  }
  protected matchesDisplay(state: CubeState, value: number): boolean {
    return matchesTarget(
      this.route.print,
      state,
      timerTarget(value, this.route.profile),
    );
  }
  protected targetMoves(
    from: CubeState,
    target: CubeState,
    value: number,
  ): readonly LegalMove[] {
    demand(this.solver, "Timer is not configured");
    const prepared = this.prepared;
    this.prepared = null;
    if (prepared?.value === value && stateEquals(prepared.source, from))
      return this.planned = prepared.moves;
    return this.planned = (
      timerStep(this.route, from, this.current, value) ??
      this.solver.solve(from, target, { coordinateFrames: true })
    );
  }
  async configure(
    value = this.route.profile.defaultSeconds / this.route.profile.stepSeconds,
  ): Promise<void> {
    demand(
      !this.busy && !this.configuring,
      "Wait for the current timer sequence",
    );
    demand(
      Number.isInteger(value) && value >= 0 && value <= this.maximumValue,
      "Invalid timer duration",
    );
    this.configuring = true;
    let fresh: LoadedAssets | null = null;
    try {
      fresh = await this.resolveAssets(this.manifest, [this.route.print]);
      const solver = await this.prepareSolver(this.route.print);
      const state = this.route.states[value];
      demand(
        this.matchesDisplay(state, value),
        "Invalid initial timer display",
      );
      this.install(this.route.print, state, fresh, value);
      fresh = null;
      this.solver = solver;
    } finally {
      fresh?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
