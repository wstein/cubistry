import { TimerController } from "../timer/controller.ts";
import { FIVE_SECOND_TIMER, TEN_SECOND_TIMER, type TimerProfile } from "../timer/clock.ts";
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
