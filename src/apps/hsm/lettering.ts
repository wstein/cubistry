import { validatePrint, deepFreeze } from "@cubistry/cube-core";
import type { HsmDesign } from "./design.ts";
import symbols from "./images.json" with { type: "json" };
import words from "./images-words.json" with { type: "json" };
import wordsPascal from "./images-words-pascal.json" with { type: "json" };
import letterManifests from "./letter-manifests.json" with { type: "json" };

export type LetterFont =
  | "same"
  | "dseg7"
  | "dseg14"
  | "noto-sans"
  | "quicksand"
  | "outfit"
  | "classic";

export function resolveLetterFamily(
  letterFont: LetterFont | string = "same",
  digitDisplay: string = "dseg7",
): "dseg14" | "noto-sans" | "quicksand" | "outfit" | "classic" {
  if (letterFont && letterFont !== "same") {
    if (letterFont === "dseg7" || letterFont === "dseg14") return "dseg14";
    if (["noto-sans", "quicksand", "outfit", "classic"].includes(letterFont)) {
      return letterFont as "noto-sans" | "quicksand" | "outfit" | "classic";
    }
  }
  if (digitDisplay === "dseg7" || digitDisplay === "dseg14") return "dseg14";
  if (digitDisplay === "noto-sans") return "noto-sans";
  if (digitDisplay === "quicksand") return "quicksand";
  if (digitDisplay === "outfit") return "outfit";
  return "classic";
}

export type Lettering = "symbols" | "words" | "words-pascal";
export const parseLettering = (value: unknown): Lettering =>
  value === "words" ? "words" : value === "words-pascal" ? "words-pascal" : "symbols";
/** The H, M and S units in their natural order. */
export const HSM_UNITS = ["H", "M", "S"] as const;
export type HsmUnit = (typeof HSM_UNITS)[number];
/** Visible Unit label: the large symbols keep H/M/S, the small words read hour/min/sec or Hour/Min/Sec. */
export const hsmUnitLabel = (unit: HsmUnit, lettering: Lettering): string =>
  lettering === "words-pascal"
    ? { H: "Hour", M: "Min", S: "Sec" }[unit]
    : lettering === "words"
      ? { H: "hour", M: "min", S: "sec" }[unit]
      : unit;
export const hsmImagesFor = (value: Lettering): typeof symbols =>
  value === "words-pascal"
    ? wordsPascal
    : value === "words"
      ? words
      : symbols;

export function hsmImagesForFamily(
  lettering: Lettering,
  family: string,
): readonly (typeof symbols)[number][] {
  if (family === "classic" || !(family in letterManifests)) {
    return hsmImagesFor(lettering);
  }
  const manifest = (letterManifests as Record<string, Record<string, Record<string, (typeof symbols)[number]>>>)[family];
  const group = manifest?.[lettering];
  if (!group) return hsmImagesFor(lettering);
  return Object.values(group);
}
/** Selecting an artwork variant installs a different fixed print during setup. */
export function hsmDesignFor(design: HsmDesign, value: Lettering): HsmDesign {
  if (value === "symbols") return design;
  return deepFreeze({
    ...design,
    print: validatePrint({
      ...design.print,
      id:
        value === "words-pascal"
          ? "hsm_counter_seconds_first_words_pascal"
          : "hsm_counter_seconds_first_words",
    }),
  });
}
