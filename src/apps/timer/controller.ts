import {
  PhysicalPlayback,
  type PhysicalView,
  type MoveProgress,
} from "../shared/playback.ts";
import { demand, type CubeState, type LegalMove } from "@cubistry/cube-core";
import { matchesTarget } from "@cubistry/cube-mechanics";
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
import { timerTarget, timerStep, type TimerRoute } from "./design.ts";
/** A separate physical print/application; it never reinterprets Counter stickers. */
export class TimerController extends PhysicalPlayback {
  private readonly route: TimerRoute;
  private readonly manifest: AssetManifest;
  private readonly resolveAssets: typeof loadAssets;
  private readonly prepareSolver: typeof createCounterSolver;
  private solver: CounterSolver | null = null;
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
    return 359;
  }
  protected targetState(value: number): CubeState {
    return this.route.states[value];
  }
  protected matchesDisplay(state: CubeState, value: number): boolean {
    return matchesTarget(this.route.print, state, timerTarget(value));
  }
  protected targetMoves(
    from: CubeState,
    target: CubeState,
    value: number,
  ): readonly LegalMove[] {
    demand(this.solver, "Timer is not configured");
    return (
      timerStep(this.route, from, this.current, value) ??
      this.solver.solve(from, target, { coordinateFrames: true })
    );
  }
  async configure(value = 90): Promise<void> {
    demand(
      !this.busy && !this.configuring,
      "Wait for the current timer sequence",
    );
    demand(
      Number.isInteger(value) && value >= 0 && value <= 359,
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
