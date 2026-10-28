/** Optional timing for one legal presentation; it never commits cube state. */
export interface MotionTiming {
  readonly endAt: number;
  readonly durationMs: number;
  readonly revision: number;
  /** Optional incremental duration when the absolute window has already expired. */
  readonly lateDurationMs?: number;
}
export type MotionTimingSource = () => MotionTiming | null;
export interface MotionRuntime {
  now(): number;
  frame(callback: (at: number) => void): number;
  cancelFrame(id: number): void;
  timer(callback: () => void, delay: number): number;
  cancelTimer(id: number): void;
}
const browserRuntime: MotionRuntime = {
  now: () => performance.now(),
  frame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  timer: (callback, delay) => window.setTimeout(callback, delay),
  cancelTimer: (id) => window.clearTimeout(id),
};
/** Hold before this turn, then reach its endpoint at the absolute deadline.
 * A timer and RAF race safely; clearing timing resumes normal incremental motion.
 */
export function animateTimedProgress(
  timing: MotionTimingSource,
  duration: () => number,
  present: (progress: number) => void,
  runtime: MotionRuntime = browserRuntime,
): Promise<void> {
  return new Promise((resolve) => {
    let progress = 0, previous = runtime.now(), done = false;
    let frame: number | null = null, timer: number | null = null;
    let revision: number | null = null;
    let window: { start: number; end: number; from: number } | null = null;
    const cancelTimer = () => {
      if (timer !== null) runtime.cancelTimer(timer);
      timer = null;
    };
    const finish = () => {
      if (done) return;
      done = true;
      if (frame !== null) runtime.cancelFrame(frame);
      cancelTimer();
      present(1);
      resolve();
    };
    const advance = (at: number) => {
      if (done) return;
      const current = timing();
      if ((current?.revision ?? null) !== revision) {
        cancelTimer();
        revision = current?.revision ?? null;
        window = null;
        previous = at;
        // An already missed/too-short endpoint must not snap an unplayed turn.
        const remainingMs = current ? current.durationMs * (1 - progress) : 0;
        if (current && Number.isFinite(current.endAt) && Number.isFinite(current.durationMs) && current.durationMs >= 10 &&
          current.endAt - at >= Math.min(10, remainingMs)) {
          window = { start: Math.max(at, current.endAt - remainingMs),
            end: current.endAt, from: progress };
        }
      }
      if (window) {
        if (at >= window.end) progress = 1;
        else if (at >= window.start)
          progress = Math.max(progress, window.from + (1 - window.from) *
            Math.min(1, (at - window.start) / (window.end - window.start)));
      } else {
        const late = current?.lateDurationMs;
        const incrementalDuration = current
          ? late !== undefined && Number.isFinite(late) && late >= 10 ? late : 10
          : duration();
        progress = Math.min(1, progress + Math.max(0, at - previous) / incrementalDuration);
      }
      previous = at;
      if (progress >= 1) { finish(); return; }
      present(progress);
      if (window && timer === null) {
        timer = runtime.timer(() => { timer = null; advance(runtime.now()); },
          Math.max(0, Math.ceil(window.end - at)));
      }
    };
    const tick = (at: number) => {
      frame = null;
      // Earlier RAF callbacks (for example a shared WebGL render) can overrun
      // this frame. Absolute deadlines use the current monotonic clock, never
      // a stale frame-start timestamp from before the turn was created.
      advance(Math.max(at, runtime.now()));
      if (!done) frame = runtime.frame(tick);
    };
    advance(previous);
    if (!done) frame = runtime.frame(tick);
  });
}
