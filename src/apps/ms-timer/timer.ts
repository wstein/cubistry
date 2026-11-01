import {
  WorkshopClock,
  ONE_SECOND_TIMER,
  formatTimer,
  parseDuration,
  type TimerMode,
} from "../timer/clock.ts";
import type { PairController } from "../pair/controller.ts";
import { MsTimerScheduler, type TimerWarning } from "./scheduler.ts";
import type { MsTimerCube } from "./cube.ts";

/** Default rotation preference: 100 ms per HTM move (the scheduler may shorten it). */
export const MS_TIMER_PREFERRED_MS = 100;

export interface MsTimerOptions {
  readonly pair: PairController<MsTimerCube, MsTimerCube>;
  /** Monotonic milliseconds; the page uses `performance.now`, tests a virtual clock. */
  readonly now?: () => number;
  /** Preferred time per HTM move; read on every tick. */
  readonly preferred?: () => number;
  /** Set the animation time per turn of one cube. */
  readonly setDuration?: { minor(ms: number): void; major(ms: number): void };
  readonly refresh?: () => void;
}

/**
 * The M/S Timer without a page: one monotonic clock, one pair of cubes and one
 * scheduler per cube. Start/Pause/Resume, Reset, Set and the mode switch work
 * as in the existing timers; Set and Reset walk the saved periods through the
 * pair and never jump. Timer speed is fixed at 1x.
 */
export class MsTimer {
  readonly clock: WorkshopClock;
  readonly pair: PairController<MsTimerCube, MsTimerCube>;
  readonly scheduler: MsTimerScheduler;
  private readonly preferred: () => number;
  private readonly setDuration: {
    minor(ms: number): void;
    major(ms: number): void;
  };
  private configured: number = ONE_SECOND_TIMER.defaultSeconds;
  private begun = false;
  /** Effective time per HTM turn last chosen for each cube. */
  readonly effective = {
    minor: MS_TIMER_PREFERRED_MS,
    major: MS_TIMER_PREFERRED_MS,
  };

  constructor(options: MsTimerOptions) {
    this.pair = options.pair;
    this.clock = new WorkshopClock(options.now, ONE_SECOND_TIMER);
    this.scheduler = new MsTimerScheduler(
      this.pair.minorModulus,
      options.refresh,
      () => this.clock.snapshot(),
    );
    this.preferred = options.preferred ?? (() => MS_TIMER_PREFERRED_MS);
    const forward = options.setDuration;
    this.setDuration = {
      minor: (ms) => {
        this.effective.minor = ms;
        forward?.minor(ms);
      },
      major: (ms) => {
        this.effective.major = ms;
        forward?.major(ms);
      },
    };
  }

  get mode(): TimerMode {
    return this.clock.mode;
  }
  get running(): boolean {
    return this.clock.running;
  }
  /** True once Start was pressed since the last Set, Reset or mode change. */
  get started(): boolean {
    return this.begun;
  }
  get configuredSeconds(): number {
    return this.configured;
  }
  get warning(): TimerWarning {
    return this.scheduler.warning;
  }
  /** The value the clock shows now, as MM:SS, from one monotonic sample. */
  get text(): string {
    return formatTimer(this.clock.snapshot().liveSeconds, ONE_SECOND_TIMER);
  }

  /** The value the cubes show, as MM:SS. */
  get shown(): string {
    return formatTimer(this.pair.value, ONE_SECOND_TIMER);
  }

  /** Start, or resume after Pause. A finished timer stays finished until Reset. */
  start(): void {
    if (this.clock.running) return;
    this.begun = true;
    this.clock.start();
    this.tick();
  }

  pause(): void {
    this.clock.pause();
    this.begun = true;
    void this.reconcile();
  }

  /** Back to the configured duration (Countdown) or 00:00 (Stopwatch), by the shortest route. */
  reset(): Promise<void> {
    this.clock.reset();
    this.begun = false;
    return this.reconcile();
  }

  /** Set the Countdown duration from "MM:SS"; invalid input throws and changes nothing. */
  set(text: string): Promise<void> {
    const seconds = parseDuration(text, ONE_SECOND_TIMER);
    this.clock.configure(seconds);
    this.configured = seconds;
    this.begun = false;
    return this.reconcile();
  }

  setMode(mode: TimerMode): Promise<void> {
    this.clock.setMode(mode);
    this.begun = false;
    return this.reconcile();
  }

  /** One scheduling step; the page calls it every 50 ms and at each wake. */
  tick(): void {
    this.scheduler.tick(
      this.clock.snapshot(),
      this.pair,
      this.preferred(),
      this.setDuration,
    );
  }

  /** Cancel plans and walk both cubes to the clock's value, turn by turn. */
  private reconcile(): Promise<void> {
    this.scheduler.invalidate();
    this.setDuration.minor(this.preferred());
    this.setDuration.major(this.preferred());
    return this.pair.set(this.clock.bucket);
  }
}
