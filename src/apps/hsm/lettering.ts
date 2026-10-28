import { validatePrint, deepFreeze } from "@cubistry/cube-core";
import type { HsmDesign } from "./design.ts";
import symbols from "./images.json" with { type: "json" };
import words from "./images-words.json" with { type: "json" };
export type Lettering = "symbols" | "words";
export const parseLettering = (value: unknown): Lettering =>
  value === "words" ? "words" : "symbols";
export const hsmImagesFor = (value: Lettering): typeof symbols =>
  value === "words" ? words : symbols;
/** Selecting an artwork variant installs a different fixed print during setup. */
export function hsmDesignFor(design: HsmDesign, value: Lettering): HsmDesign {
  if (value === "symbols") return design;
  return deepFreeze({
    ...design,
    print: validatePrint({ ...design.print, id: "hsm_counter_blank_words" }),
  });
}
