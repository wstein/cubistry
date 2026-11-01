import type { HsmController } from "../hsm/controller.ts";
import type { PairUnit } from "./controller.ts";

/** An `HsmController` as a pair unit, plus the controller for the caller. */
export interface HsmPairUnit extends PairUnit {
  readonly controller: HsmController;
}

/**
 * Adapter: an `HsmController` counting 0..`range` (23 for hours, 59 for
 * minutes). It adds `setDirection`, which selects the saved
 * period of the counting direction through the controller's own `setMode`,
 * and passes `prepare` through for timed steps; it changes no behavior of the
 * controller.
 */
export const hsmPairUnit = (
  controller: HsmController,
  range: 11 | 23 | 59,
): HsmPairUnit => {
  controller.setMode(range, 1);
  return {
    controller,
    get busy() {
      return controller.busy;
    },
    get currentValue() {
      return controller.currentValue;
    },
    configure: (value) => controller.configure(value),
    request: (value) => controller.request(value),
    prepare: (value) => controller.prepare(value),
    dispose: () => controller.dispose(),
    setDirection: (direction) => controller.setMode(range, direction),
  };
};
