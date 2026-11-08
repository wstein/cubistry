import { parseLettering, type Lettering } from "../hsm/lettering.ts";

/** The three cubes of the Live Clock, in the order hours, minutes, seconds. */
export const CLOCK_UNIT_NAMES = ["hours", "minutes", "seconds"] as const;
export type ClockUnitName = (typeof CLOCK_UNIT_NAMES)[number];

/** Preferred quarter-turn times offered per unit, in milliseconds. */
export const CLOCK_SPEED_CHOICES_MS = [2000, 1000, 500, 250, 100, 50, 10] as const;

export const DEFAULT_CLOCK_SPEEDS_MS: Readonly<Record<ClockUnitName, number>> = {
  hours: 500,
  minutes: 250,
  seconds: 100,
};

export interface ClockParams {
  readonly lettering: Lettering;
  /** Preferred quarter-turn time per unit, in the order of CLOCK_UNIT_NAMES. */
  readonly speeds: readonly [number, number, number];
}

function speedOf(params: URLSearchParams, name: ClockUnitName): number {
  const raw = params.get(name + "-speed");
  const listed = CLOCK_SPEED_CHOICES_MS.find((ms) => String(ms) === raw);
  return listed ?? DEFAULT_CLOCK_SPEEDS_MS[name];
}

/**
 * The URL rules of the former clock.html: `lettering` and `hours-speed`/`minutes-speed`/`seconds-speed`. The Nerd drawer
 * opens through the shell host (`nerd=1`), not here. `stored` is the lettering remembered from an earlier visit.
 */
export function parseClockParams(params: URLSearchParams, stored: { readonly lettering?: string | null } = {}): ClockParams {
  const speeds = CLOCK_UNIT_NAMES.map((name) => speedOf(params, name)) as unknown as ClockParams["speeds"];
  return {
    lettering: parseLettering(params.get("lettering") ?? stored.lettering ?? "words-pascal"),
    speeds,
  };
}

/** Print catalog design of the sticker set that is on the cubes. */
export function clockPrintDesign(lettering: Lettering): string {
  return lettering === "words-pascal" ? "hsm-words-pascal" : lettering === "words" ? "hsm-words" : "hsm-symbols";
}

/** Path, query and hash of `href` with `lettering` set, so a reload or a shared link keeps the choice. */
export function urlWithLettering(href: string, lettering: Lettering): string {
  const url = new URL(href);
  url.searchParams.set("lettering", lettering);
  return url.pathname + url.search + url.hash;
}
