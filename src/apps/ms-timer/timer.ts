import {
  WorkshopClock,
  ONE_SECOND_TIMER,
  formatTimer,
  formatMsTimer,
  parseMsDuration,
  type TimerMode,
} from "../timer/clock.ts";
import type { PairController } from "../pair/controller.ts";
import { MsTimerScheduler, type TimerWarning } from "./scheduler.ts";
import type { MsTimerCube } from "./cube.ts";
import { TENTH_MOVE_MS, type MsTimerTenthCube } from "./tenth.ts";

/** Default rotation preference: 100 ms per HTM move (the scheduler may shorten it). */
export const MS_TIMER_PREFERRED_MS = 100;

export interface MsTimerOptions {
  readonly pair: PairController<MsTimerCube, MsTimerCube>;
  readonly tenth?: MsTimerTenthCube;
  /** Monotonic milliseconds; the page uses `performance.now`, tests a virtual clock. */
  readonly now?: () => number;
  /** Preferred time per HTM move; read on every tick. */
  readonly preferred?: () => number;
  /** Set the animation time per turn of one cube. */
  readonly setDuration?: {
    minor(ms: number): void;
    major(ms: number): void;
    tenth?(ms: number): void;
  };
  readonly refresh?: () => void;
}

/**
 * The M/S Timer without a page: one monotonic clock, the minutes/seconds pair
 * plus the 1/10-second cube, and one scheduler per cube. Start/Pause/Resume,
 * Reset, Set and the mode switch work as in the existing timers; Set and Reset
 * walk the saved periods turn by turn and never jump. Timer speed is fixed at 1x.
 */
export class MsTimer {
  readonly clock: WorkshopClock;
  readonly pair: PairController<MsTimerCube, MsTimerCube>;
  readonly tenth: MsTimerTenthCube | null;
  readonly scheduler: MsTimerScheduler;
  private readonly preferred: () => number;
  private readonly setDuration: {
    minor(ms: number): void;
    major(ms: number): void;
    tenth(ms: number): void;
  };
  private configured: number = ONE_SECOND_TIMER.defaultSeconds;
  private begun = false;
  /** Effective time per turn last chosen for each cube. */
  readonly effective = {
    minor: MS_TIMER_PREFERRED_MS,
    major: MS_TIMER_PREFERRED_MS,
    tenth: TENTH_MOVE_MS,
  };

  constructor(options: MsTimerOptions) {
    this.pair = options.pair;
    this.tenth = options.tenth ?? null;
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
      tenth: (ms) => {
        this.effective.tenth = ms;
        forward?.tenth?.(ms);
      },
    };
  }

  get mode(): TimerMode {
    return this.clock.mode;
  }
  get running(): boolean {
    return this.clock.running;
  }
  get busy(): boolean {
    return this.pair.busy || Boolean(this.tenth?.busy);
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
  /** The value the clock shows now, as MM:SS.d, from one monotonic sample. */
  get text(): string {
    return formatMsTimer(
      this.clock.tenthBucket,
      ONE_SECOND_TIMER.maxSeconds * 10,
    );
  }

  /** The value the cubes show, as MM:SS.d. */
  get shown(): string {
    return `${formatTimer(this.pair.value, ONE_SECOND_TIMER)}.${this.tenth?.currentValue ?? 0}`;
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

  /** Back to the configured duration (Countdown) or 00:00.0 (Stopwatch), by the shortest route. */
  reset(): Promise<void> {
    this.clock.reset();
    this.begun = false;
    return this.reconcile();
  }

  /** Set the Countdown duration from "MM:SS" or "MM:SS.d"; invalid input throws and changes nothing. */
  set(text: string): Promise<void> {
    const maxTenths = ONE_SECOND_TIMER.maxSeconds * 10;
    const tenths = parseMsDuration(text, maxTenths);
    this.clock.configureTenths(tenths, maxTenths);
    this.configured = tenths / 10;
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
    const snap = this.clock.snapshot();
    const tenthSnap = this.tenth ? this.clock.tenthSnapshot(snap.at) : undefined;
    this.scheduler.tick(
      snap,
      this.tenth
        ? {
            minor: this.pair.minor,
            major: this.pair.major,
            minorModulus: this.pair.minorModulus,
            tenth: this.tenth,
          }
        : this.pair,
      this.preferred(),
      this.setDuration,
      tenthSnap,
    );
  }

  /** Cancel plans and walk all cubes to the clock's value, turn by turn. */
  private async reconcile(): Promise<void> {
    this.scheduler.invalidate();
    this.setDuration.minor(this.preferred());
    this.setDuration.major(this.preferred());
    this.setDuration.tenth(TENTH_MOVE_MS);
    const tenths = this.clock.tenthBucket;
    const secTarget =
      tenths % 10 === 0 ? this.clock.bucket : Math.floor(tenths / 10);
    const tenthTarget = ((tenths % 10) + 10) % 10;
    await Promise.all([
      this.pair.set(secTarget),
      this.tenth ? this.tenth.set(tenthTarget) : Promise.resolve(),
    ]);
  }
}
