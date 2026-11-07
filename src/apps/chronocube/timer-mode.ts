import { TimerController } from "../timer/controller.ts";
import { FIVE_SECOND_TIMER, TEN_SECOND_TIMER, formatTimer, type TimerProfile } from "../timer/clock.ts";
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
export function studioTimerReadout(bucket: number, profile: TimerProfile): string {
  return formatTimer(bucket, profile);
}
