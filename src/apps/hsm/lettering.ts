import { validatePrint, deepFreeze } from "@cubistry/cube-core";
import type { HsmDesign } from "./design.ts";
import symbols from "./images.json" with { type: "json" };
import words from "./images-words.json" with { type: "json" };
export type Lettering = "symbols" | "words";
export const parseLettering = (value: unknown): Lettering =>
  value === "words" ? "words" : "symbols";
/** The H, M and S units in their natural order. */
export const HSM_UNITS = ["H", "M", "S"] as const;
export type HsmUnit = (typeof HSM_UNITS)[number];
/** Visible Unit label: the large symbols keep H/M/S, the small words read hour/min/sec. */
export const hsmUnitLabel = (unit: HsmUnit, lettering: Lettering): string =>
  lettering === "words" ? { H: "hour", M: "min", S: "sec" }[unit] : unit;
export const hsmImagesFor = (value: Lettering): typeof symbols =>
  value === "words" ? words : symbols;
/** Selecting an artwork variant installs a different fixed print during setup. */
export function hsmDesignFor(design: HsmDesign, value: Lettering): HsmDesign {
  if (value === "symbols") return design;
  return deepFreeze({
    ...design,
    print: validatePrint({
      ...design.print,
      id: "hsm_counter_seconds_first_words",
    }),
  });
}
