import { deepFreeze } from "@cubistry/cube-core";
import {
  loadHsmDesign,
  type HsmDesign,
  type HsmVariant,
} from "../hsm/design.ts";
import symbols from "../hsm/images.json" with { type: "json" };

/**
 * The H/M counter: print m3-SH from research PR #133, hours and minutes only,
 * with a genuinely blank upper-left sticker. It runs on the H/M/S controller,
 * planner, periods and recovery, parameterized by this variant.
 *
 * - Ranges: M 00–59; H 00–23 and 00–11 (the 12-hour cycle with its 11→00 step).
 * - Edge limit 4: the owner's limit for every saved period step (the minutes
 *   period in fact stays within 3; tests assert each period's own maximum).
 * - Free jumps from a settled pose are capped by the four-corner graph radius,
 *   7 HTM: no tighter universal bound is established for this print.
 */
export const HM_VARIANT: HsmVariant = deepFreeze({
  id: "hm",
  letters: ["H", "M"],
  ranges: { M: [59], H: [23, 11] },
  printId: "hm_counter_m3_sh",
  edgeLimit: 4,
  jumpBound: 7,
  runtimeFile: "hm-counter.v1.json",
  extended: true,
});
/** The large H and M symbols; the same artwork as the H/M/S counter. */
export const hmImages = symbols.filter((i) =>
  (HM_VARIANT.letters as readonly string[]).includes(i.id),
);
export const loadHmDesign = (
  basePath: string,
  expectedHash: string,
): Promise<HsmDesign> => loadHsmDesign(basePath, expectedHash, HM_VARIANT);
