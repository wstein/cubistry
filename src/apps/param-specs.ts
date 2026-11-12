import { MODE_CATALOG } from "./mode-catalog.ts";
import type { ModeMeta } from "./registry.ts";
import { SPEED_CHOICES } from "./status/params.ts";

/** A parsed setup value: what the mode receives instead of a raw string. */
export type ParamValue = string | number | boolean;

/**
 * One typed setup parameter. `parse` returns `undefined` for an invalid value; the mode default then applies.
 * `default` is the value a mode uses when the key is absent, so it is not written back into a URL.
 */
export interface ParamSpec {
  /**
   * The URL name when it differs from the canonical key. Two apps can then use one URL name for different things:
   * `font` is an alias of `display` for the single-cube family and the font style of the 7x7 Calendar (`c7-font`).
   */
  name?: string;
  /**
   * Alternative names that parse to this canonical key. Serialization always writes the canonical key. When both names
   * are present the readers of the pages prefer the alias (presentation, font, rate); here the canonical key wins.
   */
  aliases?: readonly string[];
  parse(raw: string): ParamValue | undefined;
  default?: ParamValue;
  /**
   * A value of one mode (a counter value, a duration, a month) means something else in every other mode, so it never
   * survives a switch, not even between two modes that both own the key.
   */
  perMode?: true;
}

const BOOL_TRUE = ["1", "true", "on", "yes"];
const BOOL_FALSE = ["0", "false", "off", "no"];
const bool = (raw: string) => {
  const v = raw.toLowerCase();
  return BOOL_TRUE.includes(v) ? true : BOOL_FALSE.includes(v) ? false : undefined;
};
const int = (min: number, max: number) => (raw: string) => {
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined;
};
const num = (min: number, max: number) => (raw: string) => {
  const n = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const oneOf = (values: readonly string[]) => (raw: string) => {
  const v = raw.toLowerCase();
  return values.includes(v) ? v : undefined;
};
const oneOfNumbers = (values: readonly number[]) => (raw: string) => {
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return values.includes(n) ? n : undefined;
};
// Exact ids, as src/apps/status/params.ts reads them (no lowercasing).
const state = (raw: string) => (["open", "running", "ok", "error", "blocked"].includes(raw) ? raw : undefined);
const word = (raw: string) => (/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(raw) ? raw : undefined);
const isoDate = (raw: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return undefined;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === raw ? raw : undefined;
};

/**
 * Every setup parameter of the studio by canonical key, in serialization order. The key names and aliases are the ones
 * of the appendix in knowledge/plans/unified-application.md; a new key needs a row there and in the inventory test.
 */
export const PARAM_SPECS: Readonly<Record<string, ParamSpec>> = {
  val: { aliases: ["value"], parse: int(0, 999_999), perMode: true },
  duration: { parse: (raw) => (/^\d+(:\d{2}){0,2}$/.test(raw) ? raw : undefined), perMode: true },
  mode: { parse: oneOf(["countdown", "stopwatch"]) },
  unit: { aliases: ["letter"], parse: (raw) => oneOf(["h", "m", "s"])(raw)?.toUpperCase() },
  dir: {
    aliases: ["direction"],
    parse: (raw) => ({ up: "up", "1": "up", down: "down", "-1": "down" })[raw.toLowerCase()],
    default: "up",
  },
  range: { parse: oneOfNumbers([59, 23, 11]), default: 59 },
  // Canonical decimal spelling only, as src/apps/status/params.ts reads it.
  speed: { parse: (raw) => SPEED_CHOICES.find((choice) => String(choice) === raw) },
  "timer-speed": { aliases: ["rate"], parse: oneOfNumbers([1, 10, 20, 50, 100]) },
  lettering: { parse: word },
  display: { aliases: ["font"], parse: oneOf(["dseg7", "dseg14", "noto-sans", "quicksand", "outfit", "classic"]) },
  marker: { parse: oneOf(["off", "auto", "all", "line-auto", "line-all"]) },
  pad: { aliases: ["padding"], parse: bool, default: true },
  print: { parse: word },
  // src/main.mjs starts on `run=1|true` or `autoplay=1`; a value such as `autoplay=true` is valid here but not read there.
  autoplay: { aliases: ["run"], parse: bool, default: false },
  "hours-speed": { parse: num(0.001, 100_000) },
  "minutes-speed": { parse: num(0.001, 100_000) },
  "seconds-speed": { parse: num(0.001, 100_000) },
  date: { parse: isoDate },
  lang: { aliases: ["language"], parse: (raw) => (/^[A-Za-z]{2,3}(-[A-Za-z0-9]+)*$/.test(raw) ? raw.toLowerCase() : undefined) },
  // Calendar and Print both own `design`, and a design id of one is not valid in the other.
  design: { parse: word, perMode: true },
  year: { parse: int(1, 9999), perMode: true },
  month: { parse: int(1, 12), perMode: true },
  outer: { parse: num(1.2, 2.4) },
  // 7x7 Calendar look (src/apps/calendar7/mount.ts, layout.ts). `banner` is the banner style.
  "c7-font": { name: "font", parse: word },
  layout: { parse: oneOf(["standard", "names", "names-any"]) },
  scheme: { parse: word },
  plasticity: { parse: num(0, 1) },
  banner: { parse: oneOf(["theme", "rounded", "square", "underline", "boxed", "rounded-box"]) },
  size: { parse: int(2, 7) },
  // CI Quality Cube (src/apps/status/params.ts): the quarter-turn time is `speed`; the category states are a one-time request.
  build: { parse: state, perMode: true },
  test: { parse: state, perMode: true },
  analyze: { parse: state, perMode: true },
  review: { parse: state, perMode: true },
  // Global flags: every app reads them, so they are never owned by one mode and survive a switch.
  // `speed` is in `GLOBAL_PARAMS` too: no app switch drops it.
  // The shell opens the Nerd drawer for `nerd=1` only; every other value leaves it closed.
  nerd: { parse: (raw) => raw === "1", default: false },
  kiosk: { aliases: ["presentation"], parse: bool, default: false },
};

/**
 * Global keys: deliberately retained on an app switch; no mode owns them. `speed` (turn duration for the single-cube
 * family and the CI Quality Cube, owner decision 2026-11-12) is parsed for every app and ignored by those that have
 * no turn speed.
 */
export const GLOBAL_PARAMS: readonly string[] = ["nerd", "kiosk", "speed"];

/**
 * Setup parameters of applications that are not registered modes yet (stage 4 ports them). They are listed so a
 * parameter of Print cannot flow into another app before that app is a mode. An entry moves
 * into the `params` of its mode when the mode is registered.
 */
export const PENDING_APP_PARAMS: Readonly<Record<string, readonly string[]>> = {
  print: ["design"],
};

export const names = (key: string): string[] => [PARAM_SPECS[key]?.name ?? key, ...(PARAM_SPECS[key]?.aliases ?? [])];

/** Canonical keys an app owns: the `params` of its mode, or the pending entry; `undefined` for an unknown id. */
export function appKeys(id: string, modes: readonly ModeMeta[] = MODE_CATALOG): readonly string[] | undefined {
  return modes.find((m) => m.id === id)?.params ?? PENDING_APP_PARAMS[id];
}

/** Every name (canonical key and aliases) the app owns; empty for an unknown id. */
export function ownedParams(id: string, modes: readonly ModeMeta[] = MODE_CATALOG): string[] {
  return (appKeys(id, modes) ?? []).flatMap(names);
}

/** Names that survive a switch from `from` to `to`: owned by both apps and not a per-mode value. */
export function sharedParams(from: string, to: string, modes: readonly ModeMeta[] = MODE_CATALOG): string[] {
  const owned = new Set(appKeys(from, modes));
  return (appKeys(to, modes) ?? []).filter((k) => owned.has(k) && !PARAM_SPECS[k].perMode).flatMap(names);
}

/** Every name that some app owns, global flags excluded: the keys an app switch may have to drop. */
export function scopedParams(modes: readonly ModeMeta[] = MODE_CATALOG): string[] {
  const keys = new Set([...modes.flatMap((m) => m.params ?? []), ...Object.values(PENDING_APP_PARAMS).flat()]);
  return [...new Set([...keys].filter((k) => !GLOBAL_PARAMS.includes(k)).flatMap(names))];
}
