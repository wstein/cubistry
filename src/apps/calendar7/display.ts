/**
 * English 7x7 calendar cube: display sheets and the front rule (research candidate, not
 * certified). Pure functions only.
 *
 * Layout, "pure split, month-letter scheme A" (research/calendar-7x7/pure-split-states):
 *  - row 1: the three month letters, columns 5-7 for January-September and columns 2-4
 *    for October-December, ink "month"; the other cells of the row are blank;
 *  - row 2: SUN MON TUE WED THU FRI SAT, ink "red" for SUN and SAT, else "weekday";
 *  - rows 3-7: the dates, Sunday first, ink "red" in columns 1 and 7, else "dark";
 *  - a month that needs six week rows folds its sixth week under the date seven days
 *    earlier as a stacked sticker "a/b" (only 23/30 and 24/31 exist); there are no
 *    overflow marks.
 *
 * `monthDisplay` is deliberately independent of the research code and of the Julia export
 * that is shipped in displays.v1.json; the tests require both to agree for all 888 months.
 */
import {
  FRONT_NORMAL,
  type Pose,
  type Printing,
  STICKERS,
} from "./engine.ts";

export const INKS = ["blank", "dark", "month", "red", "weekday"] as const;
export type Ink = (typeof INKS)[number];
export interface Cell {
  readonly text: string;
  readonly ink: Ink;
}
/** 49 cells in row-major order (row 1 first, column 1 first). */
export interface Display {
  readonly id: number;
  readonly year: number;
  readonly month: number;
  readonly cells: readonly Cell[];
}

export const BLANK_CELL: Cell = { text: "", ink: "blank" };
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export const isLeapYear = (y: number): boolean =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y: number, m: number): number =>
  m === 2 ? (isLeapYear(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
/** Weekday of the first of the month, Sunday = 0 (days from civil, proleptic Gregorian). */
export function firstWeekday(y: number, m: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5);
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  const days = era * 146097 + doe - 719468; // days since 1970-01-01 (a Thursday)
  return (((days + 4) % 7) + 7) % 7;
}
/** First column (1-based) of the month letters. */
export const monthLetterStart = (m: number): number => (m <= 9 ? 5 : 2);

/** The display sheet of one month, generated from the calendar alone. */
export function monthCells(year: number, month: number): Cell[] {
  const grid: Cell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 7 }, () => BLANK_CELL),
  );
  const start = monthLetterStart(month);
  for (let i = 0; i < 3; i++)
    grid[0][start - 1 + i] = { text: MONTH_NAMES[month - 1][i], ink: "month" };
  for (let c = 0; c < 7; c++)
    grid[1][c] = {
      text: WEEKDAYS[c],
      ink: c === 0 || c === 6 ? "red" : "weekday",
    };
  const offset = firstWeekday(year, month);
  const n = daysInMonth(year, month);
  const weeks = Math.floor((offset + n - 1) / 7) + 1;
  for (let d = 1; d <= n; d++) {
    const week = Math.floor((offset + d - 1) / 7);
    const c = (offset + d - 1) % 7;
    const ink: Ink = c === 0 || c === 6 ? "red" : "dark";
    if (weeks > 5 && week === 5) continue; // printed under the date seven days earlier
    const stacked = weeks > 5 && week === 4 && d + 7 <= n;
    grid[week + 2][c] = { text: stacked ? `${d}/${d + 7}` : String(d), ink };
  }
  return grid.flat();
}

/** Display id (1..91) for every month 2026-01..2099-12 in order: first occurrence order. */
export function displayIds(firstYear = 2026, lastYear = 2099): number[] {
  const seen = new Map<string, number>();
  const ids: number[] = [];
  for (let y = firstYear; y <= lastYear; y++)
    for (let m = 1; m <= 12; m++) {
      const key = monthCells(y, m)
        .map((c) => `${c.ink}:${c.text}`)
        .join("|");
      if (!seen.has(key)) seen.set(key, seen.size + 1);
      ids.push(seen.get(key) as number);
    }
  return ids;
}

// ---------------------------------------------------------------------------------------
// Front rule, ported 1:1 from the research (english/prepare_physical.jl image_normal,
// orientation_screen.jl HALF, pure-split-states/stacked_common.jl stacked_match and
// front_failure, strict mode). This is NOT "cube appearance": glyph equivalences O = 0,
// I = 1 and half-turn pairs are accepted, but a stacked "a/b" must be upright with exactly
// the same text and the same ink.

/** Characters that read as another character (or themselves) after a half turn. */
const HALF: Readonly<Record<string, string>> = {
  "0": "0",
  "1": "1",
  "2": "2",
  "5": "5",
  "6": "9",
  "9": "6",
  "8": "8",
  H: "H",
  N: "N",
  S: "S",
  X: "X",
  Z: "Z",
};
/** Image "up" vectors for angles 0..3. */
export const IMAGE_UPS: readonly (readonly [number, number, number])[] = [
  [0, 1, 0],
  [-1, 0, 0],
  [0, -1, 0],
  [1, 0, 0],
];

type Image = readonly [text: string, angle: number, ink: string] | "blank";
const cmpImage = (a: readonly [string, number, string], b: typeof a): number =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);

/** Canonical image of text drawn at quarter-turn `angle`: O and I read as 0 and 1. */
export function imageNormal(text: string, angle: number, ink: string): Image {
  if (text === "") return "blank";
  const g = text.replaceAll("O", "0").replaceAll("I", "1");
  if (g === "0") return [g, 0, ink];
  const choices: (readonly [string, number, string])[] = [
    [g, ((angle % 4) + 4) % 4, ink],
  ];
  if ([...g].every((c) => c in HALF))
    choices.push([
      [...g].reverse().map((c) => HALF[c]).join(""),
      (((angle + 2) % 4) + 4) % 4,
      ink,
    ]);
  return choices.reduce((best, c) => (cmpImage(c, best) < 0 ? c : best));
}
const sameImage = (a: Image, b: Image): boolean =>
  a === b ||
  (a !== "blank" && b !== "blank" && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);

const STACKED = /^[1-9][0-9]?\/[1-9][0-9]?$/;

export interface FrontFailure {
  readonly row: number;
  readonly column: number;
  /** Sticker id (1-based) on the cell. */
  readonly sticker: number;
  readonly angle: number;
  readonly why: "plain-mismatch" | "stacked-not-upright" | "stacked-mismatch";
}

/** First cell (row-major) whose front sticker does not show the display, or null. */
export function frontFailure(
  printing: Printing,
  state: Pose,
  cells: readonly Cell[],
): FrontFailure | null {
  if (cells.length !== 49) throw new Error("a display has 49 cells");
  // Index the 49 front stickers by cell.
  const front: number[] = new Array(49).fill(-1);
  for (let i = 0; i < STICKERS; i++) {
    const o = 3 * i;
    if (
      state.normal[o] !== FRONT_NORMAL[0] ||
      state.normal[o + 1] !== FRONT_NORMAL[1] ||
      state.normal[o + 2] !== FRONT_NORMAL[2] ||
      state.pos[o + 2] !== 3
    )
      continue;
    const column = state.pos[o] + 4;
    const row = 4 - state.pos[o + 1];
    if (column < 1 || column > 7 || row < 1 || row > 7)
      throw new Error(`front sticker ${i + 1} outside the 7x7 front`);
    front[(row - 1) * 7 + column - 1] = i;
  }
  for (let k = 0; k < 49; k++) {
    const row = Math.floor(k / 7) + 1;
    const column = (k % 7) + 1;
    const i = front[k];
    if (i < 0) throw new Error(`no front sticker at ${row},${column}`);
    const o = 3 * i;
    const angle = IMAGE_UPS.findIndex(
      (u) => u[0] === state.up[o] && u[1] === state.up[o + 1] && u[2] === state.up[o + 2],
    );
    if (angle < 0) throw new Error(`front sticker ${i + 1} has no image orientation`);
    const text = printing.text[i];
    const ink = printing.ink[i];
    const want = cells[k];
    const fail = (why: FrontFailure["why"]): FrontFailure => ({
      row,
      column,
      sticker: i + 1,
      angle,
      why,
    });
    if (STACKED.test(text)) {
      if (angle === 0 && ink === want.ink && text === want.text) continue;
      return fail(
        angle !== 0 && ink === want.ink && text === want.text
          ? "stacked-not-upright"
          : "stacked-mismatch",
      );
    }
    if (!sameImage(imageNormal(text, angle, ink), imageNormal(want.text, 0, want.ink)))
      return fail("plain-mismatch");
  }
  return null;
}
