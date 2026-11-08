// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * One timed move animation, driven by the caller's frame loop (no timers, no requestAnimationFrame of its own, so
 * there is nothing to cancel but the loop itself). DOM-free.
 */
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

interface Active {
  readonly ms: number;
  readonly update: (progress: number) => void;
  readonly end: (completed: boolean) => void;
  readonly resolve: () => void;
  readonly start: number;
  readonly ease: (p: number) => number;
}

export class MoveTween {
  private active: Active | null = null;

  get running(): boolean {
    return this.active !== null;
  }

  /**
   * Starts a tween. `update` receives the eased progress 0..1 on every tick; `end(true)` runs once at the end of the
   * time, `end(false)` if the tween is cancelled; the returned promise resolves after `end`. The clock starts at
   * `startAt` (the caller's frame-time base, milliseconds), so a move shorter than a frame ends on the next frame.
   */
  begin(
    ms: number,
    update: (progress: number) => void,
    end: (completed: boolean) => void,
    startAt: number,
    ease: (p: number) => number = smoothstep,
  ): Promise<void> {
    this.cancel();
    return new Promise<void>((resolve) => {
      this.active = { ms: Math.max(1, ms), update, end, resolve, start: startAt, ease };
    });
  }

  /** Advances to the frame time `now` (milliseconds); true while a frame must be drawn. */
  tick(now: number): boolean {
    const a = this.active;
    if (!a) return false;
    const p = Math.min(1, Math.max(0, (now - a.start) / a.ms));
    a.update(a.ease(p));
    if (p >= 1) this.finish(a, true);
    return true;
  }

  /** Ends the tween at once without reaching the end of its time; its promise resolves. */
  cancel(): void {
    const a = this.active;
    if (a) this.finish(a, false);
  }

  private finish(a: Active, completed: boolean): void {
    this.active = null;
    try {
      a.end(completed);
    } finally {
      a.resolve();
    }
  }
}
