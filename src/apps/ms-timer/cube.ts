import type { LegalMove } from "@cubistry/cube-core";
import type { MovePresentation } from "@cubistry/cube-mechanics";
import { routeTurnTiming } from "../shared/turn-timing.ts";
import { MsController } from "../ms/controller.ts";

/**
 * One cube of the M/S Timer: an `MsController` (same print, same saved period
 * words, same route planning) that can also play its route against a
 * deadline. It adds only the timing of the turns, as `TimerController` does
 * for the one-cube timers; it plans no turn of its own.
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

  protected targetMoves(): readonly LegalMove[] {
    return (this.route = super.targetMoves());
  }

  protected animateMove(presentation: MovePresentation): Promise<void> {
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
            "htm",
          )
        : null,
    );
  }
}
