import { demand, type CubeState, type LegalMove } from "@cubistry/cube-core";
import type { MovePresentation } from "@cubistry/cube-mechanics";
import { loadAssets, type AssetManifest } from "@cubistry/cube-assets";
import { routeTurnTiming } from "../shared/turn-timing.ts";
import { MsController } from "../ms/controller.ts";
import type { PhysicalView, MoveProgress } from "../shared/playback.ts";
import type { MsPrint, MsLetter } from "../ms/design.ts";
import {
  createCounterSolver,
  type CounterSolver,
} from "../../adapters/puzlwerk-2x2.ts";

/**
 * One cube of the M/S Timer: an `MsController` (same print, same saved period
 * words) enhanced with dual routing:
 * - Single-step counting (+1/-1 timer ticks) walks the verified period edges with
 *   precise turn timing against scheduling deadlines.
 * - Non-adjacent jumps (Set, Reset) use an optimal 2×2 solver (`CounterSolver`)
 *   directly to the target's canonical period node, eliminating multi-edge walks.
 */
export class MsTimerCube extends MsController {
  private timing: {
    target: number;
    endAt: number;
    durationMs: number;
    revision: number;
  } | null = null;
  private timingRevision = 0;
  private route: readonly LegalMove[] = [];
  private solver: CounterSolver | null = null;
  private readonly prepareSolver: typeof createCounterSolver;
  private isJump = false;
  private jumpMoves: readonly LegalMove[] | null = null;

  constructor(
    view: PhysicalView,
    msPrint: MsPrint,
    manifest: AssetManifest,
    letter: MsLetter,
    onState: (
      v: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
    resolveAssets: typeof loadAssets = loadAssets,
    prepareSolver: typeof createCounterSolver = createCounterSolver,
  ) {
    super(view, msPrint, manifest, letter, onState, resolveAssets);
    this.prepareSolver = prepareSolver;
  }

  override async configure(value = 0): Promise<void> {
    await super.configure(value);
    if (!this.solver) {
      try {
        this.solver = await this.prepareSolver(this.msPrint.print);
      } catch {
        // Fall back gracefully to period walking if solver table is unavailable.
      }
    }
  }

  /**
   * Jump directly to `value` using optimal solving to the canonical period node.
   */
  set(value: number): void {
    this.isJump = true;
    this.request(value);
  }

  /**
   * Update the active asset manifest (for live font / orientation switching) in place.
   */
  async updateManifest(manifest: AssetManifest): Promise<void> {
    if (!this.state) return;
    const assets = await this.resolveAssets(manifest, [this.msPrint.print]);
    while (this.busy || this.view.animating) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (!this.state) {
      assets.dispose();
      return;
    }
    this.install(this.msPrint.print, this.state, assets, this.currentValue);
  }

  /** The last turn of the route to `target` ends at `endAt`, `durationMs` per HTM turn. */
  setDeadline(target: number, endAt: number, durationMs: number): void {
    if (
      this.timing?.target === target &&
      this.timing.endAt === endAt &&
      this.timing.durationMs === durationMs
    )
      return;
    this.timing = {
      target,
      endAt,
      durationMs,
      revision: ++this.timingRevision,
    };
  }

  clearDeadline(): void {
    this.timing = null;
    this.timingRevision++;
  }

  protected override targetState(value: number): CubeState {
    demand(this.state, "M/S timer cube not configured");
    if (!this.solver) {
      this.jumpMoves = null;
      return super.targetState(value);
    }
    const route = this.period.route(this.state, value);
    const isAdjacent = route && route.edges === 1;
    const isJump = (this.isJump || !route || route.edges > 1) && !isAdjacent;
    this.isJump = false;
    if (!isJump) {
      this.jumpMoves = null;
      return super.targetState(value);
    }
    const target = this.period.poseFor(value);
    const moves = this.solver.solve(this.state, target, {
      coordinateFrames: true,
    });
    this.jumpMoves = moves;
    return target;
  }

  protected override targetMoves(): readonly LegalMove[] {
    if (this.jumpMoves) {
      const moves = this.jumpMoves;
      this.jumpMoves = null;
      return (this.route = moves);
    }
    return (this.route = super.targetMoves());
  }

  protected override animateMove(presentation: MovePresentation): Promise<void> {
    // Capture route and target now: a queued target must not lend this turn a deadline.
    const index = this.progress.completed,
      route = this.route,
      target = this.progress.target;
    return this.view.animate(presentation, () =>
      this.timing?.target === target
        ? routeTurnTiming(
            route,
            index,
            this.timing.endAt,
            this.timing.durationMs,
            this.timing.revision,
            "quarter",
          )
        : null,
    );
  }
}
