// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * English 7x7 calendar cube: route graph data model, strict parsers and replay checks
 * (research candidate, not certified). Pure functions only; reused by the later engine.
 *
 * Data model (public/calendar7/*.v1.json):
 *  - node: a verified complete physical state, named by the SHA-256 of its 294-sticker
 *    state text, with the display it shows (display id, year, month);
 *  - edge: a move word between two nodes. The inverse edge is free (inverseMoves);
 *  - the shipped graph is a chain 2026-05 .. 2099-12, but the checks below are written
 *    for edges between arbitrary nodes so that shortcuts can be added without code change.
 */
import {
  applyMoves,
  checkMove,
  checkPose,
  CUBIES,
  GENERATORS,
  type Metrics,
  metrics,
  type Move,
  type Pose,
  type Printing,
  samePose,
  STICKERS,
  stateDigest,
  inverseMoves,
} from "./engine.ts";
import type { Surface } from "./sticker-art.ts";
import { type Cell, type Display, frontFailure, INKS, INKS_WITH_BAND, type Ink } from "./display.ts";

export const STATE_SCHEMA = "cubistry.calendar7.state";
export const GRAPH_SCHEMA = "cubistry.calendar7.graph";
export const DISPLAYS_SCHEMA = "cubistry.calendar7.displays";
/** One character per move: index = (generator - 1) * 3 + {1: 0, -1: 1, 2: 2}. */
export const MOVE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+";
const QUARTER_INDEX: Readonly<Record<number, number>> = { 1: 0, [-1]: 1, 2: 2 };
const QUARTERS = [1, -1, 2] as const;

export function encodeMoves(moves: readonly Move[]): string {
  return moves
    .map((move) => {
      checkMove(move);
      return MOVE_ALPHABET[(move[0] - 1) * 3 + QUARTER_INDEX[move[1]]];
    })
    .join("");
}
export function decodeMoves(word: string): Move[] {
  return [...word].map((ch): Move => {
    const index = MOVE_ALPHABET.indexOf(ch);
    if (index < 0 || index >= GENERATORS * 3)
      throw new RangeError(`character ${JSON.stringify(ch)} is not a move`);
    return [Math.floor(index / 3) + 1, QUARTERS[index % 3]];
  });
}

export interface Node {
  readonly hash: string;
  readonly display: number;
  readonly year: number;
  readonly month: number;
}
export interface Edge extends Metrics {
  readonly from: number;
  readonly to: number;
  readonly moves: readonly Move[];
}
export interface Graph {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
}
export interface Start {
  readonly printing: Printing;
  readonly pose: Pose;
  readonly node: Node;
  /** How the 3D view draws the labels: the optional state field "surface"; "sticker" when absent. */
  readonly surface?: Surface;
}
export interface DisplayTable {
  readonly displays: readonly Display[];
  /** Display id of each month from `first`, in calendar order. */
  readonly months: readonly number[];
  readonly firstYear: number;
  /** Month (1-12) of `months[0]`; absent means 1 (January). Only window tables (names layout) set it. */
  readonly firstMonth?: number;
}

type Json = Record<string, unknown>;
const obj = (v: unknown, what: string): Json => {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw new Error(`${what} must be an object`);
  return v as Json;
};
const arr = (v: unknown, what: string): unknown[] => {
  if (!Array.isArray(v)) throw new Error(`${what} must be an array`);
  return v;
};
const int = (v: unknown, what: string, lo: number, hi: number): number => {
  if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi)
    throw new Error(`${what} must be an integer in ${lo}..${hi}`);
  return v as number;
};
const str = (v: unknown, what: string): string => {
  if (typeof v !== "string") throw new Error(`${what} must be a string`);
  return v;
};
const hash = (v: unknown, what: string): string => {
  if (typeof v !== "string" || !/^[0-9a-f]{64}$/.test(v))
    throw new Error(`${what} must be a lowercase SHA-256`);
  return v;
};
const schema = (j: Json, name: string): void => {
  if (j.schema !== name || j.version !== 1)
    throw new Error(`expected ${name} version 1`);
};
const vec = (v: unknown, what: string): number[] => {
  const a = arr(v, what);
  if (a.length !== 3) throw new Error(`${what} needs three entries`);
  return a.map((x) => int(x, what, -3, 3));
};

/** Parse state.v1.json: the immutable printing and the pose snapshot of the chain root. */
export function parseState(json: unknown): Start {
  const j = obj(json, "state");
  schema(j, STATE_SCHEMA);
  const stickers = arr(j.stickers, "stickers");
  if (stickers.length !== STICKERS) throw new Error("294 stickers required");
  const piece: number[] = [],
    text: string[] = [],
    ink: string[] = [];
  const pose = {
    pos: new Int8Array(3 * STICKERS),
    normal: new Int8Array(3 * STICKERS),
    up: new Int8Array(3 * STICKERS),
  };
  stickers.forEach((raw, i) => {
    const s = obj(raw, `sticker ${i + 1}`);
    if (s.id !== i + 1) throw new Error(`sticker ids must be 1..294 in order (at ${i + 1})`);
    piece.push(int(s.piece, "piece", 1, CUBIES));
    text.push(str(s.text, "text"));
    const k = str(s.ink, "ink");
    if (!INKS_WITH_BAND.includes(k as Ink)) throw new Error(`unknown ink ${k}`);
    if ((text[i] === "") !== (k === "blank" || k === "band"))
      throw new Error(`sticker ${i + 1}: blank text and blank ink must coincide`);
    ink.push(k);
    pose.pos.set(vec(s.p, "p"), 3 * i);
    pose.normal.set(vec(s.n, "n"), 3 * i);
    pose.up.set(vec(s.up, "up"), 3 * i);
  });
  const printing = { piece, text, ink };
  checkPose(printing, pose);
  const r = obj(j.root, "root");
  const node: Node = {
    hash: hash(r.hash, "root hash"),
    display: int(r.display, "root display", 1, 91),
    year: int(r.year, "root year", 2026, 2099),
    month: int(r.month, "root month", 1, 12),
  };
  const surface = j.surface === undefined ? "sticker" : j.surface;
  if (surface !== "sticker" && surface !== "face") throw new Error('state surface must be "sticker" or "face"');
  return { printing, pose, node, surface };
}

/**
 * Parse displays.v1.json. Two shapes: the shipped table (no `firstMonth`: the five inks, 91 displays,
 * the 888 months 2026-2099) and a window table (`firstMonth` present, the names layout: the five inks or
 * the six with `band`, one to 1201 months from `firstYear`/`firstMonth`, at most one display per month).
 */
export function parseDisplays(json: unknown): DisplayTable {
  const j = obj(json, "displays");
  schema(j, DISPLAYS_SCHEMA);
  const window = j.firstMonth !== undefined;
  const inks = arr(j.inks, "inks");
  const table: readonly string[] = window && inks.length === INKS_WITH_BAND.length ? INKS_WITH_BAND : INKS;
  if (inks.join() !== table.join()) throw new Error("ink table differs from the engine");
  const displays = arr(j.displays, "displays").map((raw, i): Display => {
    const d = obj(raw, `display ${i + 1}`);
    if (d.id !== i + 1) throw new Error(`display ids must be 1..${window ? "N" : "91"} in order`);
    const cells = arr(d.cells, "cells").map((c, k): Cell => {
      const s = str(c, `cell ${k}`);
      const colon = s.indexOf(":");
      const ink = s.slice(0, colon);
      if (colon < 0 || !table.includes(ink)) throw new Error(`bad cell ${s}`);
      return { ink: ink as Ink, text: s.slice(colon + 1) };
    });
    if (cells.length !== 49) throw new Error("49 cells per display");
    return {
      id: i + 1,
      year: int(d.year, "year", 2026, 2099),
      month: int(d.month, "month", 1, 12),
      cells,
    };
  });
  if (!window) {
    if (displays.length !== 91) throw new Error("91 displays required");
    const months = arr(j.months, "months").map((x) => int(x, "month id", 1, 91));
    const firstYear = int(j.firstYear, "firstYear", 2026, 2026);
    if (months.length !== 888) throw new Error("888 months required");
    return { displays, months, firstYear };
  }
  const firstMonth = int(j.firstMonth, "firstMonth", 1, 12);
  const firstYear = int(j.firstYear, "firstYear", 2026, 2099);
  const months = arr(j.months, "months").map((x) => int(x, "month id", 1, displays.length));
  if (months.length < 1 || months.length > 1201) throw new Error("a window has 1 to 1201 months");
  if (displays.length < 1 || displays.length > months.length) throw new Error("a window has 1 display per month at most");
  months.forEach((id, k) => {
    const index = firstMonth - 1 + k;
    const d = displays[id - 1];
    if (d.year !== firstYear + Math.floor(index / 12) || d.month !== (index % 12) + 1)
      throw new Error(`month ${k} names display ${id} of another month`);
  });
  return { displays, months, firstYear, firstMonth };
}

/** Display id of a calendar month in 2026-2099. */
export function displayIdOf(table: DisplayTable, year: number, month: number): number {
  const index = (year - table.firstYear) * 12 + month - (table.firstMonth ?? 1);
  if (!(index >= 0 && index < table.months.length)) throw new RangeError("month outside the display table");
  return table.months[index];
}

/**
 * True when the table has an entry for the calendar month: integer year, integer month 1..12 and inside the
 * table's range. Never throws; callers (the names mode falls back to the shipped layout outside its window)
 * need no try/catch. `displayIdOf` is unchanged.
 */
export function namesWindowContains(table: DisplayTable, year: number, month: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return false;
  const index = (year - table.firstYear) * 12 + month - (table.firstMonth ?? 1);
  return index >= 0 && index < table.months.length;
}

/** Parse graph.v1.json. */
export function parseGraph(json: unknown): Graph {
  const j = obj(json, "graph");
  schema(j, GRAPH_SCHEMA);
  if (j.alphabet !== MOVE_ALPHABET) throw new Error("move alphabet differs from the engine");
  const nodes = arr(j.nodes, "nodes").map((raw, i): Node => {
    const n = obj(raw, `node ${i}`);
    return {
      hash: hash(n.hash, "node hash"),
      display: int(n.display, "display", 1, 91),
      year: int(n.year, "year", 2026, 2099),
      month: int(n.month, "month", 1, 12),
    };
  });
  const edges = arr(j.edges, "edges").map((raw, i): Edge => {
    const e = obj(raw, `edge ${i}`);
    const m = arr(e.metrics, "metrics");
    if (m.length !== 4) throw new Error("metrics are [htm, qtm, rot, rotq]");
    const [htm, qtm, rot, rotq] = m.map((x) => int(x, "metric", 0, 200000));
    return {
      from: int(e.from, "from", 0, nodes.length - 1),
      to: int(e.to, "to", 0, nodes.length - 1),
      htm,
      qtm,
      rot,
      rotq,
      moves: decodeMoves(str(e.moves, "moves")),
    };
  });
  return { nodes, edges };
}

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}
const fail = (message: string): never => {
  throw new ReplayError(message);
};
const sameMetrics = (a: Metrics, b: Metrics): boolean =>
  a.htm === b.htm && a.qtm === b.qtm && a.rot === b.rot && a.rotq === b.rotq;

export interface EdgeResult {
  readonly state: Pose;
  readonly sourceHash: string;
  readonly endHash: string;
  readonly metrics: Metrics;
}

/**
 * Replay one edge from the retained state `from` and check everything the research chain
 * verifier checks: source hash, declared metrics, end hash, end front against the display
 * of the target node, and exact inverse restoration of the edge.
 */
export function verifyEdge(
  printing: Printing,
  table: DisplayTable,
  graph: Graph,
  edgeIndex: number,
  from: Pose,
): EdgeResult {
  const edge = graph.edges[edgeIndex] ?? fail(`no edge ${edgeIndex}`);
  const source = graph.nodes[edge.from];
  const target = graph.nodes[edge.to];
  const sourceHash = stateDigest(printing, from);
  if (sourceHash !== source.hash)
    fail(`edge ${edgeIndex}: retained source differs from node ${edge.from}`);
  const m = metrics(edge.moves);
  if (!sameMetrics(m, edge))
    fail(`edge ${edgeIndex}: declared metrics differ from the moves`);
  const end = applyMoves(from, edge.moves);
  const display = table.displays[target.display - 1];
  if (displayIdOf(table, target.year, target.month) !== target.display)
    fail(`edge ${edgeIndex}: node ${edge.to} names the wrong display for its month`);
  const miss = frontFailure(printing, end, display.cells);
  if (miss)
    fail(`edge ${edgeIndex}: front differs from display ${display.id} at ${miss.row},${miss.column} (${miss.why})`);
  const endHash = stateDigest(printing, end);
  if (endHash !== target.hash)
    fail(`edge ${edgeIndex}: end hash differs from node ${edge.to}`);
  const back = applyMoves(end, inverseMoves(edge.moves));
  if (!samePose(back, from) || stateDigest(printing, back) !== sourceHash)
    fail(`edge ${edgeIndex}: inverse does not restore the source`);
  return { state: end, sourceHash, endHash, metrics: m };
}

export interface ChainResult {
  readonly source: string;
  readonly endpoint: string;
  readonly edges: readonly (EdgeResult & { index: number; year: number; month: number })[];
}

const nextMonth = (y: number, m: number): [number, number] => (m === 12 ? [y + 1, 1] : [y, m + 1]);

/**
 * Replay the whole chain nodes[0] -> nodes[1] -> ... from the root pose, keeping one state
 * throughout (no reset, no substitution), then restore the root from the end by the
 * inverse of the complete word.
 */
export function verifyChain(
  printing: Printing,
  root: Pose,
  table: DisplayTable,
  graph: Graph,
): ChainResult {
  const { nodes, edges } = graph;
  if (nodes.length !== edges.length + 1 || edges.length < 1) fail("a chain has one edge fewer than nodes");
  checkPose(printing, root);
  const source = stateDigest(printing, root);
  if (source !== nodes[0].hash) fail("root digest differs from node 0");
  const first = table.displays[nodes[0].display - 1];
  if (displayIdOf(table, nodes[0].year, nodes[0].month) !== nodes[0].display)
    fail("node 0 names the wrong display for its month");
  const miss = frontFailure(printing, root, first.cells);
  if (miss) fail(`root front differs from display ${first.id} at ${miss.row},${miss.column}`);
  let state = root;
  const results: (EdgeResult & { index: number; year: number; month: number })[] = [];
  const all: Move[] = [];
  edges.forEach((edge, i) => {
    if (edge.from !== i || edge.to !== i + 1) fail(`edge ${i} is not chain edge ${i} -> ${i + 1}`);
    const [y, m] = nextMonth(nodes[i].year, nodes[i].month);
    if (nodes[i + 1].year !== y || nodes[i + 1].month !== m)
      fail(`edge ${i}: chronological adjacency required`);
    const r = verifyEdge(printing, table, graph, i, state);
    results.push({ ...r, index: i + 1, year: nodes[i + 1].year, month: nodes[i + 1].month });
    state = r.state;
    for (const move of edge.moves) all.push(move);
  });
  const endpoint = stateDigest(printing, state);
  const home = applyMoves(state, inverseMoves(all));
  if (!samePose(home, root) || stateDigest(printing, home) !== source)
    fail("inverse of the whole chain does not restore the root");
  return { source, endpoint, edges: results };
}

/** The result in the research receipt format (tab separated, newline terminated). */
export function chainReceipt(result: ChainResult): string {
  const out = [`source-sha256\t${result.source}`];
  for (const e of result.edges) {
    out.push(`edge\t${e.index}\t${e.year}\t${e.month}\t${e.sourceHash}\t${e.endHash}`);
    const m = e.metrics;
    out.push(`metrics\t${e.index}\t${m.htm}\t${m.qtm}\t${m.rot}\t${m.rotq}\t${m.htm + m.rot}`);
  }
  out.push(`endpoint-sha256\t${result.endpoint}`);
  out.push(`status\tVALID_CONTINUOUS_CHAIN\t${result.edges.length}\t${CUBIES}\t${STICKERS}\t49`);
  return out.join("\n") + "\n";
}
