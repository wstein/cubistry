// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Calendar7 names layout for ANY date (research candidate, not certified). DOM-free.
 *
 * A month board depends only on the month name, the weekday of the 1st and the month length: 91 configurations
 * (12 months x 7 weekdays, plus February with 28 and with 29 days). With the one fixed print (print B) each configuration
 * has a front matching: which body, turned by which rotation, sits on each of the 49 front cells. The matching gives a
 * state of the cube for every date of the configuration, in any year. The state is a DISPLAY only: there is no move
 * sequence to or from it. The 169 bodies that are not on the front are completed deterministically (`poseFromFront`).
 */
import { type Cell, cellFailure, daysInMonth, firstWeekday, IMAGE_UPS, monthCells } from "./display.ts";
import { type Pose, type Printing, STICKERS } from "./engine.ts";
import { parseState, type Start } from "./graph.ts";
import { NAME_WORDS, printNameWords, type NameWords } from "./layout.ts";

export const CONFIGS_SCHEMA = "cubistry.calendar7.configs";
/** Years accepted: 1 to 9999, proleptic Gregorian calendar (the rule of `firstWeekday` and `daysInMonth`). */
export const ANY_FIRST_YEAR = 1;
export const ANY_LAST_YEAR = 9999;
/** The Gregorian calendar starts on 15 October 1582; earlier months are shown by the same (proleptic) rules. */
export const GREGORIAN_FROM_YEAR = 1583;

export interface Config {
  readonly month: number;
  /** Weekday of the 1st, Sunday = 0. */
  readonly weekday: number;
  readonly days: number;
  readonly key: string;
}
export const configKey = (month: number, weekday: number, days: number): string => `${month}-${weekday}-${days}`;
export function configOf(year: number, month: number): Config {
  if (!Number.isInteger(year) || year < ANY_FIRST_YEAR || year > ANY_LAST_YEAR) throw new RangeError(`year ${year} outside ${ANY_FIRST_YEAR}..${ANY_LAST_YEAR}`);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`month ${month} outside 1..12`);
  const weekday = firstWeekday(year, month);
  const days = daysInMonth(year, month);
  return { month, weekday, days, key: configKey(month, weekday, days) };
}
/** The 91 configuration keys in canonical order (month, February 28 before 29, weekday). */
export function allConfigs(): Config[] {
  const out: Config[] = [];
  for (let month = 1; month <= 12; month++)
    for (const days of month === 2 ? [28, 29] : [daysInMonth(2001, month)])
      for (let weekday = 0; weekday < 7; weekday++) out.push({ month, weekday, days, key: configKey(month, weekday, days) });
  return out;
}

/** The 49 cells of the names layout of a month: the month name tiles and band tiles in row 1, then the calendar rows. */
export function namesCells(year: number, month: number, words: NameWords = NAME_WORDS): Cell[] {
  const row1: Cell[] = Array.from({ length: 7 }, (_, c) => {
    const text = words[month - 1][c] ?? "";
    return { text, ink: text === "" ? "band" : "month" };
  });
  return row1.concat(monthCells(year, month).slice(7));
}

// ---- rotations: images of the x, y and z unit vectors, one digit each (+x -x +y -y +z -z = 0..5) ----

type V3 = readonly [number, number, number];
const SIGNED_AXES: readonly V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const FRONT: V3 = [0, 0, 1];

export interface Rotation {
  readonly code: string;
  readonly x: V3;
  readonly y: V3;
  readonly z: V3;
}
/** All 24 proper rotations of the cube in the order of their codes. */
export const ROTATIONS: readonly Rotation[] = (() => {
  const out: Rotation[] = [];
  for (let a = 0; a < 6; a++)
    for (let b = 0; b < 6; b++)
      for (let c = 0; c < 6; c++) {
        const [x, y, z] = [SIGNED_AXES[a], SIGNED_AXES[b], SIGNED_AXES[c]];
        if (dot(x, cross(y, z)) === 1) out.push({ code: `${a}${b}${c}`, x, y, z });
      }
  return out;
})();
const ROTATION_BY_CODE = new Map(ROTATIONS.map((r) => [r.code, r]));
export const IDENTITY_CODE = "024";
export const rotationOf = (code: string): Rotation => {
  const r = ROTATION_BY_CODE.get(code);
  if (!r) throw new Error(`rotation ${code} is not a proper cube rotation`);
  return r;
};
const turn = (r: Rotation, v: V3): V3 => [
  v[0] * r.x[0] + v[1] * r.y[0] + v[2] * r.z[0],
  v[0] * r.x[1] + v[1] * r.y[1] + v[2] * r.z[1],
  v[0] * r.x[2] + v[1] * r.y[2] + v[2] * r.z[2],
];
const same = (a: V3, b: V3): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Position of the body on front cell k (0..48, row-major): x = column - 4, y = 4 - row, z = 3. */
export const cellPosition = (k: number): V3 => [(k % 7) - 3, 3 - Math.floor(k / 7), 3];

/** One front cell: the body (print piece number) and the rotation that turns it from its home to the cell. */
export interface FrontBody {
  readonly piece: number;
  readonly rot: string;
}
export const formatFront = (front: readonly FrontBody[]): string => front.map((f) => `${f.piece}.${f.rot}`).join(" ");
export function parseFront(text: string): FrontBody[] {
  const parts = text.split(" ");
  if (parts.length !== 49) throw new Error("a front needs 49 bodies");
  return parts.map((p) => {
    const m = /^([1-9][0-9]{0,2})\.([0-5]{3})$/.exec(p);
    if (!m) throw new Error(`front entry ${p}`);
    rotationOf(m[2]);
    return { piece: Number(m[1]), rot: m[2] };
  });
}

interface Body {
  readonly piece: number;
  readonly home: V3;
  readonly stickers: readonly number[];
}
/** The bodies of a print: home position from the root pose (the identity pose of the print) and the sticker indices. */
function bodiesOf(printing: Printing, root: Pose): Map<number, Body> {
  const map = new Map<number, { piece: number; home: V3; stickers: number[] }>();
  for (let i = 0; i < STICKERS; i++) {
    const home: V3 = [root.pos[3 * i], root.pos[3 * i + 1], root.pos[3 * i + 2]];
    const seen = map.get(printing.piece[i]);
    if (!seen) map.set(printing.piece[i], { piece: printing.piece[i], home, stickers: [i] });
    else if (!same(seen.home, home)) throw new Error(`stickers of piece ${printing.piece[i]} have two homes`);
    else seen.stickers.push(i);
  }
  return map;
}
/** Orbit of a position under the 24 rotations (a body can only go to a position of its orbit): the smallest image, as text. */
const classOf = (v: V3): string => ROTATIONS.map((r) => turn(r, v).map((x) => x + 3).join("")).sort()[0];

/**
 * The complete pose of a front matching. The 49 front bodies are turned onto their cells (the rotation must take the
 * home of the body to the cell); every body that is not on the front and still has its home stays there; the others
 * (those whose home is a front cell) go, in piece order, to the free positions of their class in coordinate order, with
 * the first rotation of `ROTATIONS` that takes the home to the position. Deterministic; the result is a valid pose
 * (checkPose) that shows the front. `root` is the identity pose of the print.
 */
export function poseFromFront(printing: Printing, root: Pose, front: readonly FrontBody[]): Pose {
  if (front.length !== 49) throw new Error("a front needs 49 bodies");
  const bodies = bodiesOf(printing, root);
  const placed = new Map<number, Rotation>();
  const target = new Map<number, V3>();
  front.forEach((f, k) => {
    const body = bodies.get(f.piece);
    if (!body) throw new Error(`front cell ${k + 1}: unknown piece ${f.piece}`);
    if (placed.has(f.piece)) throw new Error(`front cell ${k + 1}: piece ${f.piece} is used twice`);
    const r = rotationOf(f.rot);
    if (!same(turn(r, body.home), cellPosition(k))) throw new Error(`front cell ${k + 1}: rotation ${f.rot} does not take piece ${f.piece} to the cell`);
    placed.set(f.piece, r);
    target.set(f.piece, cellPosition(k));
  });
  const frontCells = new Set(front.map((_, k) => cellPosition(k).join()));
  const taken = new Set<string>(frontCells);
  const displaced: Body[] = [];
  for (const body of [...bodies.values()].sort((a, b) => a.piece - b.piece)) {
    if (placed.has(body.piece)) continue;
    if (frontCells.has(body.home.join())) displaced.push(body);
    else {
      placed.set(body.piece, rotationOf(IDENTITY_CODE));
      target.set(body.piece, body.home);
      taken.add(body.home.join());
    }
  }
  const free = [...bodies.values()].map((b) => b.home).filter((h) => !taken.has(h.join())).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  if (free.length !== displaced.length) throw new Error("displaced bodies and free positions differ in number");
  for (const body of displaced) {
    const at = free.findIndex((p) => classOf(p) === classOf(body.home));
    if (at < 0) throw new Error(`no free position of the class of piece ${body.piece}`);
    const [position] = free.splice(at, 1);
    const r = ROTATIONS.find((c) => same(turn(c, body.home), position));
    if (!r) throw new Error(`no rotation takes piece ${body.piece} to ${position}`);
    placed.set(body.piece, r);
    target.set(body.piece, position);
  }
  const pose: Pose = { pos: new Int8Array(3 * STICKERS), normal: new Int8Array(3 * STICKERS), up: new Int8Array(3 * STICKERS) };
  for (let i = 0; i < STICKERS; i++) {
    const r = placed.get(printing.piece[i]) as Rotation;
    const o = 3 * i;
    const set = (a: Int8Array, v: V3): void => {
      a[o] = v[0];
      a[o + 1] = v[1];
      a[o + 2] = v[2];
    };
    set(pose.pos, turn(r, [root.pos[o], root.pos[o + 1], root.pos[o + 2]]));
    set(pose.normal, turn(r, [root.normal[o], root.normal[o + 1], root.normal[o + 2]]));
    set(pose.up, turn(r, [root.up[o], root.up[o + 1], root.up[o + 2]]));
  }
  return pose;
}

interface Matching {
  readonly front: (FrontBody | null)[];
  /** Cells (row, column, 1-based) no body could be matched to, in row-major order. */
  readonly unmatched: [number, number][];
}
/**
 * Maximum bipartite matching by augmenting paths: `options[k]` lists the pieces cell `k` accepts; the result is the index
 * into `options[k]` chosen for each cell, or -1 when the cell stays unmatched. A later cell can move an earlier one to another piece.
 */
export function assignPieces(options: readonly { piece: number }[][]): number[] {
  const owner = new Map<number, number>();
  const choice: number[] = new Array(options.length).fill(-1);
  const augment = (k: number, seen: Set<number>): boolean => {
    for (let n = 0; n < options[k].length; n++) {
      const piece = options[k][n].piece;
      if (seen.has(piece)) continue;
      seen.add(piece);
      const other = owner.get(piece);
      if (other === undefined || augment(other, seen)) {
        owner.set(piece, k);
        choice[k] = n;
        return true;
      }
    }
    return false;
  };
  for (let k = 0; k < options.length; k++) augment(k, new Set());
  return choice;
}

/**
 * Maximum front matching of a display with the fixed print: one distinct body and rotation per front cell such that the
 * sticker on the front shows the cell (`cellFailure`, the rule of `frontFailure`). Bipartite matching by augmenting paths,
 * cells and bodies in index order (deterministic); a cell that cannot be matched stays `null` and the others keep a maximum matching.
 */
function maximumMatching(printing: Printing, root: Pose, cells: readonly Cell[]): Matching {
  if (cells.length !== 49) throw new Error("a display has 49 cells");
  const bodies = [...bodiesOf(printing, root).values()].sort((a, b) => a.piece - b.piece);
  const options: { piece: number; rot: string }[][] = [];
  for (let k = 0; k < 49; k++) {
    const want = cellPosition(k);
    const list: { piece: number; rot: string }[] = [];
    for (const body of bodies) {
      if (classOf(body.home) !== classOf(want)) continue;
      for (const r of ROTATIONS) {
        if (!same(turn(r, body.home), want)) continue;
        const ok = body.stickers.some((i) => {
          const o = 3 * i;
          if (!same(turn(r, [root.normal[o], root.normal[o + 1], root.normal[o + 2]]), FRONT)) return false;
          const up = turn(r, [root.up[o], root.up[o + 1], root.up[o + 2]]);
          const angle = IMAGE_UPS.findIndex((u) => same(u as V3, up));
          return angle >= 0 && cellFailure(printing.text[i], printing.ink[i], angle, cells[k]) === null;
        });
        if (ok) {
          list.push({ piece: body.piece, rot: r.code });
          break; // the first rotation of a body that works; the others are the stabilizer of the position
        }
      }
    }
    options.push(list);
  }
  const choice = assignPieces(options);
  const unmatched: [number, number][] = [];
  for (let k = 0; k < 49; k++) if (choice[k] < 0) unmatched.push([Math.floor(k / 7) + 1, (k % 7) + 1]);
  // A later augmentation can move an earlier cell to another body: the body of a cell is the one its last choice names.
  const front = choice.map((n, k) => (n < 0 ? null : options[k][n]));
  return { front, unmatched };
}

/** Exact front matching, or null when some cell cannot be matched (exhaustive for this rule). */
export function matchFront(printing: Printing, root: Pose, cells: readonly Cell[]): FrontBody[] | null {
  const m = maximumMatching(printing, root, cells);
  return m.unmatched.length === 0 ? (m.front as FrontBody[]) : null;
}

/**
 * Best effort for a display the print cannot show exactly: a maximum matching, so the fewest wrong cells; each unmatched
 * cell gets the lowest unused body of its position orbit with the first rotation that takes it there (its front sticker is
 * the wrong one). The front is a complete matching of 49 bodies: `poseFromFront` completes the pose like an exact month.
 * `wrong` lists the cells (row, column) whose front differs from the display, in row-major order.
 */
export interface BestEffort {
  readonly front: FrontBody[];
  readonly wrong: [number, number][];
}
export function bestEffortFront(printing: Printing, root: Pose, cells: readonly Cell[]): BestEffort {
  const { front, unmatched } = maximumMatching(printing, root, cells);
  const bodies = bodiesOf(printing, root);
  const used = new Set(front.filter((f): f is FrontBody => f !== null).map((f) => f.piece));
  for (const [row, column] of unmatched) {
    const k = (row - 1) * 7 + column - 1;
    const want = cellPosition(k);
    const body = [...bodies.values()].sort((a, b) => a.piece - b.piece).find((c) => !used.has(c.piece) && classOf(c.home) === classOf(want));
    const rot = body && ROTATIONS.find((r) => same(turn(r, body.home), want));
    if (!body || !rot) throw new Error(`no unused body for front cell ${row},${column}`);
    used.add(body.piece);
    front[k] = { piece: body.piece, rot: rot.code };
  }
  return { front: front as FrontBody[], wrong: unmatched };
}

/** Sticker indices (0-based) on the front cells `wrong` of `pose`: the stickers the viewer draws as the differing cell. */
export function wrongStickerIndices(pose: Pose, wrong: readonly (readonly [number, number])[]): number[] {
  return wrong.map(([row, column]) => {
    const hits: number[] = [];
    for (let i = 0; i < STICKERS; i++) {
      const o = 3 * i;
      if (pose.normal[o + 2] === 1 && pose.pos[o + 2] === 3 && pose.pos[o] + 4 === column && 4 - pose.pos[o + 1] === row) hits.push(i);
    }
    if (hits.length !== 1) throw new Error(`front cell ${row},${column} has ${hits.length} stickers`);
    return hits[0];
  });
}

const CORNER_NAMES: Record<string, string> = { "1,1": "top left", "1,7": "top right", "7,1": "bottom left", "7,7": "bottom right" };
/** Where a cell is, from its coordinates: a corner by name with its row and column, any other cell by row and column. */
export function cellWhere(row: number, column: number): string {
  const corner = CORNER_NAMES[`${row},${column}`];
  return corner ? `${corner} (row ${row}, column ${column})` : `row ${row}, column ${column}`;
}
/** The one sentence of a best-effort page, derived from the list of wrong cells. */
export function bestEffortSentence(wrong: readonly (readonly [number, number])[]): string {
  const where = wrong.map(([r, c]) => cellWhere(r, c));
  return `Not exactly possible with this print: cell${where.length > 1 ? "s" : ""} ${where.join(" and ")} differ${where.length > 1 ? "" : "s"}.`;
}

// ---- data files ----

export type AnyEntry =
  | { readonly key: string; readonly status: "match"; readonly source: string; readonly front: readonly FrontBody[] }
  | {
      readonly key: string;
      readonly status: "best-effort";
      readonly source: string;
      readonly front: readonly FrontBody[];
      /** Cells (row, column) whose front differs from the board: the fewest the print allows. */
      readonly wrong: readonly (readonly [number, number])[];
      /** The research reason (data and docs only, never shown on the page). */
      readonly reason: string;
    }
  | { readonly key: string; readonly status: "none" | "pending"; readonly reason: string };
export interface AnyData {
  readonly start: Start;
  readonly entries: ReadonlyMap<string, AnyEntry>;
}
/** One requested board on an existing print; application matching only, no move reachability claim or stored corpus. */
export function previewForDate(start: Start, year: number, month: number): AnyData {
  const config = configOf(year, month);
  const matching = bestEffortFront(start.printing, start.pose, namesCells(year, month, printNameWords(start.printing)));
  const entry: AnyEntry = matching.wrong.length
    ? { key: config.key, status: "best-effort", source: "application-matching", front: matching.front, wrong: matching.wrong, reason: "Application front matching only; move reachability is unverified." }
    : { key: config.key, status: "match", source: "application-matching", front: matching.front };
  return { start, entries: new Map([[config.key, entry]]) };
}

type Json = Record<string, unknown>;

/** Parses names-any/state.v1.json (print B and its identity pose) and configs.v1.json; all 91 configurations must be present once. */
export function parseAnyData(stateJson: unknown, configsJson: unknown): AnyData {
  const start = parseState(stateJson);
  const j = configsJson as Json;
  if (typeof j !== "object" || j === null || j.schema !== CONFIGS_SCHEMA || j.version !== 1) throw new Error(`expected ${CONFIGS_SCHEMA} version 1`);
  const list = j.configs;
  if (!Array.isArray(list)) throw new Error("configs must be an array");
  const entries = new Map<string, AnyEntry>();
  for (const raw of list as Json[]) {
    const key = raw.key;
    if (typeof key !== "string" || entries.has(key)) throw new Error(`config key ${String(key)}`);
    if (raw.status === "match") {
      if (typeof raw.source !== "string" || typeof raw.front !== "string") throw new Error(`config ${key}: source and front`);
      entries.set(key, { key, status: "match", source: raw.source, front: parseFront(raw.front) });
    } else if (raw.status === "best-effort") {
      if (typeof raw.source !== "string" || typeof raw.front !== "string" || typeof raw.reason !== "string") throw new Error(`config ${key}: source, front and reason`);
      const wrongRaw = raw.wrong;
      if (!Array.isArray(wrongRaw) || wrongRaw.length === 0) throw new Error(`config ${key}: wrong cells required`);
      const wrong = wrongRaw.map((w): [number, number] => {
        if (!Array.isArray(w) || w.length !== 2 || !w.every((x) => Number.isInteger(x) && x >= 1 && x <= 7)) throw new Error(`config ${key}: wrong cell`);
        return [w[0], w[1]];
      });
      if (new Set(wrong.map((w) => w.join())).size !== wrong.length) throw new Error(`config ${key}: wrong cells repeat`);
      entries.set(key, { key, status: "best-effort", source: raw.source, front: parseFront(raw.front), wrong, reason: raw.reason });
    } else if (raw.status === "none" || raw.status === "pending") {
      if (typeof raw.reason !== "string" || raw.reason === "") throw new Error(`config ${key}: reason`);
      entries.set(key, { key, status: raw.status, reason: raw.reason });
    } else throw new Error(`config ${key}: status`);
  }
  const want = allConfigs().map((c) => c.key);
  if (entries.size !== want.length || want.some((k) => !entries.has(k))) throw new Error("the 91 configurations are required, each once");
  return { start, entries };
}

export type AnyState =
  | { readonly kind: "state"; readonly config: Config; readonly entry: AnyEntry; readonly pose: Pose }
  | { readonly kind: "best-effort"; readonly config: Config; readonly entry: AnyEntry; readonly pose: Pose; readonly wrong: readonly (readonly [number, number])[] }
  | { readonly kind: "none" | "pending"; readonly config: Config; readonly reason: string };

/** The state of a date: the pose of its configuration, or the reason there is none. */
export function stateForDate(data: AnyData, year: number, month: number): AnyState {
  const config = configOf(year, month);
  const entry = data.entries.get(config.key);
  if (!entry) throw new Error(`no entry for configuration ${config.key}`);
  if (entry.status !== "match" && entry.status !== "best-effort") return { kind: entry.status, config, reason: entry.reason };
  if (entry.status === "best-effort") return { kind: "best-effort", config, entry, pose: poseFromFront(data.start.printing, data.start.pose, entry.front), wrong: entry.wrong };
  return { kind: "state", config, entry, pose: poseFromFront(data.start.printing, data.start.pose, entry.front) };
}

/** Month choice of the any-date page: year 1 to 9999 and month 1 to 12, both together; without them the current month. */
export type AnyChoice =
  | { readonly kind: "ok"; readonly ym: { readonly year: number; readonly month: number }; readonly source: "url" | "today" }
  | { readonly kind: "invalid"; readonly reason: string };
const INT = /^[0-9]{1,4}$/;
export function chooseAnyMonth(params: URLSearchParams, today: { year: number; month: number }): AnyChoice {
  const y = params.get("year");
  const m = params.get("month");
  if (y === null && m === null) return { kind: "ok", ym: today, source: "today" };
  if (y === null || m === null) return { kind: "invalid", reason: "year and month must be given together" };
  if (!INT.test(y) || !INT.test(m) || Number(m) < 1 || Number(m) > 12) return { kind: "invalid", reason: "year must be a number and month a number from 1 to 12" };
  if (Number(y) < ANY_FIRST_YEAR || Number(y) > ANY_LAST_YEAR) return { kind: "invalid", reason: `year must be from ${ANY_FIRST_YEAR} to ${ANY_LAST_YEAR}` };
  return { kind: "ok", ym: { year: Number(y), month: Number(m) }, source: "url" };
}
