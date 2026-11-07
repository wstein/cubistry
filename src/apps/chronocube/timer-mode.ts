import { TimerController } from "../timer/controller.ts";
import { TimerScheduler } from "../timer/scheduler.ts";
import type { WorkshopClock } from "../timer/clock.ts";
import {
  FIVE_SECOND_TIMER,
  TEN_SECOND_TIMER,
  formatTimer,
  type TimerProfile,
} from "../timer/clock.ts";
import type { TimerRoute } from "../timer/design.ts";
import type { AssetManifest, loadAssets } from "@cubistry/cube-assets";

/** Mode profile: "timer" uses the 10-second route, "five-second-timer" the 5-second route. */
export function studioTimerProfile(fiveSecond: boolean): TimerProfile {
  return fiveSecond ? FIVE_SECOND_TIMER : TEN_SECOND_TIMER;
}

/** Builds the controller for the Studio "timer" and "five-second-timer" modes. */
export function createStudioTimerController(
  view: ConstructorParameters<typeof TimerController>[0],
  route: TimerRoute,
  manifest: AssetManifest,
  onState: (value: number, busy: boolean) => void,
  resolveAssets?: typeof loadAssets,
): TimerController {
  return new TimerController(view, route, manifest, onState, resolveAssets);
}

/** Controller value (a step bucket, not seconds) the mode starts at: 90 for 15:00 in 10 s steps, 360 for 30:00 in 5 s steps. */
export function studioTimerDefaultBucket(profile: TimerProfile): number {
  return profile.defaultSeconds / profile.stepSeconds;
}

/** mm:ss readout of a clock bucket for the mode's profile. */
export function studioTimerReadout(
  bucket: number,
  profile: TimerProfile,
): string {
  return formatTimer(bucket, profile);
}

/** What the Studio timer drives: a clock and one cube controller. */
export interface StudioTimerParts {
  clock: WorkshopClock;
  controller: TimerController;
  /** Move duration in ms for the next turns. */
  setDuration: (durationMs: number) => void;
}

/** Preferred move duration (ms) of the Studio timer cube; the scheduler shortens it when a deadline needs it. */
export const STUDIO_TIMER_MOVE_MS = 100;

/** Start, Pause, Reset and the periodic tick of the Studio timer modes. */
export class StudioTimerDriver {
  private readonly parts: StudioTimerParts;
  private readonly scheduler: TimerScheduler;
  constructor(parts: StudioTimerParts) {
    this.parts = parts;
    this.scheduler = new TimerScheduler(
      () => this.tick(),
      () => parts.clock.snapshot(),
    );
  }
  start(): void {
    this.parts.clock.start();
    this.tick();
  }
  pause(): void {
    this.parts.clock.pause();
    this.reconcile();
  }
  reset(): void {
    this.parts.clock.reset();
    this.reconcile();
  }
  /** Called every 50 ms while the mode is shown: moves the cube toward the clock's bucket and next boundary. */
  tick(): void {
    const { clock, controller, setDuration } = this.parts;
    this.scheduler.tick(
      clock.snapshot(),
      controller,
      STUDIO_TIMER_MOVE_MS,
      setDuration,
    );
  }
  /** Drops any planned boundary move and requests the clock's current bucket. */
  private reconcile(): void {
    this.scheduler.invalidate();
    this.parts.controller.request(this.parts.clock.snapshot().bucket);
  }
  dispose(): void {
    this.scheduler.invalidate();
  }
}
