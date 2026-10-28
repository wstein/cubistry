import type { MoveProgress } from "./playback.ts";

/** UI numbering observes actual nonempty sequence starts, never queued requests. */
export class SequenceNumber {
  private number = 0;
  private lastStart: { target: number | null; sessionTotal: number } | null = null;

  observe(progress: MoveProgress): number {
    if (progress.status === "idle") {
      this.number = 0;
      this.lastStart = null;
    } else if (
      progress.status === "playing" &&
      progress.completed === 0 &&
      progress.total > 0 &&
      (!this.lastStart ||
        this.lastStart.target !== progress.target ||
        this.lastStart.sessionTotal !== progress.sessionTotal)
    ) {
      this.number++;
      this.lastStart = {
        target: progress.target,
        sessionTotal: progress.sessionTotal,
      };
    }
    return this.number;
  }
}
