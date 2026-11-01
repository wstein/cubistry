import type { SearchTask } from "./recovery.ts";

/** How a started search ended: its value, or cancelled (the value is dropped). */
export type SearchOutcome<T> =
  | { readonly cancelled: false; readonly value: T }
  | { readonly cancelled: true };

export interface SearchJob<T> {
  /** Settles when the task returns or `cancel` is called, whichever is first. */
  readonly done: Promise<SearchOutcome<T>>;
  /** Idempotent; `done` settles as cancelled at once and the task is closed at its next safe point. */
  cancel(): void;
}

/**
 * Runs a suspendable search somewhere other than the caller's stack. The
 * controller only needs this seam, so tests inject a manual executor and a
 * Worker-based one could replace the sliced default without touching callers.
 */
export interface RecoveryExecutor {
  start<T>(task: SearchTask<T>): SearchJob<T>;
}

export interface SliceOptions {
  /** Work per slice before the task yields to the event loop (default 8 ms). */
  readonly budgetMs?: number;
  readonly now?: () => number;
  /** Gives the event loop a turn (rendering, input, timers). */
  readonly yieldNow?: () => Promise<void>;
}

/**
 * A MessageChannel hop: queued behind timers, input and rendering that are
 * already due, and without the timer clamp. `scheduler.yield()` is avoided on
 * purpose: its continuation is resumed ahead of other pending tasks, which
 * would starve the page's own polling (the live clock tick).
 */
export const yieldToEventLoop = (): Promise<void> => {
  const g = globalThis as { MessageChannel?: typeof MessageChannel };
  if (typeof g.MessageChannel === "function")
    return new Promise((resolve) => {
      const channel = new g.MessageChannel!();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(0);
    });
  return new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * Cooperative time slicing on the calling thread. A task runs for at most
 * `budgetMs` (plus the span between two of its safe points), then yields to the
 * event loop; a cancelled job is closed at the next wake-up. The task is the
 * same generator the synchronous search drains, so the result is identical.
 */
export class SlicedExecutor implements RecoveryExecutor {
  readonly stats = { jobs: 0, slices: 0, cancelled: 0, worstSliceMs: 0 };
  private readonly budget: number;
  private readonly now: () => number;
  private readonly yieldNow: () => Promise<void>;
  constructor(options: SliceOptions = {}) {
    this.budget = options.budgetMs ?? 8;
    this.now = options.now ?? (() => performance.now());
    this.yieldNow = options.yieldNow ?? yieldToEventLoop;
  }
  start<T>(task: SearchTask<T>): SearchJob<T> {
    this.stats.jobs++;
    let cancelled = false,
      settled = false;
    let resolve!: (o: SearchOutcome<T>) => void, reject!: (e: unknown) => void;
    const done = new Promise<SearchOutcome<T>>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const settle = (o: SearchOutcome<T>) => {
      if (settled) return;
      settled = true;
      resolve(o);
    };
    const run = async () => {
      try {
        // Never run the first slice inside the caller's turn.
        await this.yieldNow();
        for (;;) {
          if (cancelled) {
            task.return(undefined as never);
            return;
          }
          const t0 = this.now();
          let step = task.next();
          while (!step.done && this.now() - t0 < this.budget)
            step = task.next();
          this.stats.slices++;
          this.stats.worstSliceMs = Math.max(
            this.stats.worstSliceMs,
            this.now() - t0,
          );
          if (step.done) {
            settle({ cancelled: false, value: step.value });
            return;
          }
          await this.yieldNow();
        }
      } catch (e) {
        if (!settled) {
          settled = true;
          reject(e);
        }
      }
    };
    void run();
    return {
      done,
      cancel: () => {
        if (settled) return;
        cancelled = true;
        this.stats.cancelled++;
        settle({ cancelled: true });
      },
    };
  }
}
