// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * English 7x7 calendar cube, mode logic (research candidate, not certified). Pure functions only:
 * no DOM, no network, no timers. The mount in `mount.ts` feeds them the parsed data files.
 *
 * Scope of this stage: show the month sheet and the 3D cube of one month of the proven chain and
 * step to the adjacent month along it, playing the move word of that edge. There is no solver and
 * no jump between non-adjacent months: every such jump would be a walk along the chain.
 */
import { blockCounts } from "./blocks.ts";
import { playedBlocks } from "./deferral.ts";
import { DEFAULT_WORD_OPTIONS, expansionNote, notationHtml, notationLabel, orientationLabel, stepNotation, type WordOptions } from "./notation.ts";
export { moveToken, rawToken } from "./notation.ts";
import { type Move } from "./engine.ts";
import type { Cell } from "./display.ts";
import type { DisplayTable, Edge, Graph } from "./graph.ts";
import { type Layout, CHAIN_C_LABEL } from "./layout.ts";
import { bestEffortSentence } from "./anydate.ts";
import type { BestEffortMonth } from "./graph.ts";

/** Month table of a best-effort page: the cube is the display, so the table is text for screen readers only (visually hidden). */
export const HIDDEN_SHEET_CLASS = "c7-sr-only";

export interface YearMonth {
  readonly year: number;
  readonly month: number;
}

export const MODE_ID = "calendar7";
export const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const ymKey = ({ year, month }: YearMonth): string =>
  `${year}-${String(month).padStart(2, "0")}`;
export const monthLabel = ({ year, month }: YearMonth): string =>
  `${MONTH_NAMES_EN[month - 1]} ${year}`;

/** First and last month of the proven chain, and the number of its edges. */
export interface ChainRange {
  readonly first: YearMonth;
  readonly last: YearMonth;
  readonly edges: number;
}

/** Reads the range from the graph: node k is the month `first + k`; the check is strict. */
export function chainRange(graph: Graph): ChainRange {
  const { nodes, edges } = graph;
  if (nodes.length < 2 || edges.length !== nodes.length - 1)
    throw new Error("the graph is not a chain");
  const first = { year: nodes[0].year, month: nodes[0].month };
  nodes.forEach((n, k) => {
    const index = first.year * 12 + first.month - 1 + k;
    if (n.year * 12 + n.month - 1 !== index) throw new Error(`node ${k} breaks the month order`);
  });
  edges.forEach((e, k) => {
    if (e.from !== k || e.to !== k + 1) throw new Error(`edge ${k} breaks the chain order`);
  });
  const lastNode = nodes[nodes.length - 1];
  return { first, last: { year: lastNode.year, month: lastNode.month }, edges: edges.length };
}

const monthIndex = (ym: YearMonth): number => ym.year * 12 + ym.month - 1;

/** Chain node index of a month, or -1 when the month is outside the chain. */
export function nodeIndex(range: ChainRange, ym: YearMonth): number {
  const k = monthIndex(ym) - monthIndex(range.first);
  return k >= 0 && k <= range.edges ? k : -1;
}

export type MonthChoice =
  | { readonly kind: "ok"; readonly ym: YearMonth; readonly source: "url" | "today" }
  | { readonly kind: "outside"; readonly ym: YearMonth; readonly source: "url" | "today" }
  | { readonly kind: "invalid"; readonly reason: string };

const INT = /^[0-9]{1,4}$/;

/**
 * Chooses the month to show. `year` and `month` in the URL select it (both are required together);
 * without them the current month is used. A month outside the chain is reported as "outside", a
 * malformed value as "invalid". The URL is never silently corrected.
 */
export function chooseMonth(
  params: URLSearchParams,
  today: YearMonth,
  range: ChainRange,
): MonthChoice {
  const y = params.get("year");
  const m = params.get("month");
  let ym: YearMonth;
  let source: "url" | "today";
  if (y === null && m === null) {
    ym = today;
    source = "today";
  } else if (y === null || m === null) {
    return { kind: "invalid", reason: "year and month must be given together" };
  } else if (!INT.test(y) || !INT.test(m) || Number(m) < 1 || Number(m) > 12) {
    return { kind: "invalid", reason: "year must be a number and month a number from 1 to 12" };
  } else {
    ym = { year: Number(y), month: Number(m) };
    source = "url";
  }
  return { kind: nodeIndex(range, ym) >= 0 ? "ok" : "outside", ym, source };
}

/** The adjacent month inside the chain, or null at the ends. */
export function stepMonth(range: ChainRange, ym: YearMonth, delta: 1 | -1): YearMonth | null {
  const k = nodeIndex(range, ym);
  if (k < 0) return null;
  const n = k + delta;
  if (n < 0 || n > range.edges) return null;
  const index = monthIndex(range.first) + n;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export interface Step {
  readonly direction: "forward" | "backward";
  readonly from: YearMonth;
  readonly to: YearMonth;
  /** The moves to turn the cube from `from` to `to`; backward steps are the inverse of the edge. */
  readonly moves: readonly Move[];
  readonly htm: number;
  readonly qtm: number;
  readonly rot: number;
}

const invert = (m: Move): Move => [m[0], m[1] === 2 ? 2 : -m[1]];

/** The move word from `ym` to the adjacent month; null at the ends of the chain. */
export function stepFrom(graph: Graph, range: ChainRange, ym: YearMonth, delta: 1 | -1): Step | null {
  const target = stepMonth(range, ym, delta);
  if (!target) return null;
  const k = nodeIndex(range, ym);
  const edge: Edge = graph.edges[delta === 1 ? k : k - 1];
  const moves = delta === 1 ? edge.moves : [...edge.moves].reverse().map(invert);
  return {
    direction: delta === 1 ? "forward" : "backward",
    from: ym,
    to: target,
    moves,
    htm: edge.htm,
    qtm: edge.qtm,
    rot: edge.rot,
  };
}

/** The 49 cells of the month sheet, from the display table of the data files. */
export function sheetCells(graph: Graph, table: DisplayTable, range: ChainRange, ym: YearMonth): readonly Cell[] {
  const k = nodeIndex(range, ym);
  if (k < 0) throw new RangeError(`${ymKey(ym)} is outside the chain`);
  return table.displays[graph.nodes[k].display - 1].cells;
}

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** The 7x7 sheet as an HTML table; the ink of a cell is a CSS class `c7-ink-<ink>`. */
export function sheetHtml(cells: readonly Cell[], label: string): string {
  if (cells.length !== 49) throw new Error("a display has 49 cells");
  const rows: string[] = [];
  for (let r = 0; r < 7; r++) {
    const tds = cells.slice(r * 7, r * 7 + 7).map((c) => `<td class="c7-ink-${c.ink}">${esc(c.text)}</td>`);
    rows.push(`<tr>${tds.join("")}</tr>`);
  }
  return `<table class="c7-sheet" aria-label="${esc(label)}"><tbody>${rows.join("")}</tbody></table>`;
}

export const href = (ym: YearMonth): string => `?app=${MODE_ID}&year=${ym.year}&month=${ym.month}`;

export interface PageModel {
  readonly choice: MonthChoice;
  readonly range: ChainRange;
  readonly today: YearMonth;
  /** The front layout of the data the page was built from; absent means standard. */
  readonly layout?: Layout;
  /** Present when the month is shown from print B without a move sequence (names layout for any date; see anydate-view.ts). */
  readonly anyDate?: { readonly kind: "state" | "best-effort" | "none" | "pending"; readonly key: string; readonly wrong?: readonly (readonly [number, number])[] };
  /** True for a page of the canonical long chain C data: the range line says so. */
  readonly longChain?: boolean;
  /** Present for an "ok" choice. */
  readonly cells?: readonly Cell[];
  readonly prev: Step | null;
  readonly next: Step | null;
}

const NOT_YET =
  "No solver and no jumps: only the step to the previous or next month along the chain is available. " +
  "A jump to a distant month would have to walk the chain, which can take thousands of moves.";

const LEGEND = "Layer: <code>x-3</code>. Block: <code>x-3..-1</code> (layers together). Whole cube: <code>xrot</code>. " +
  "<code>'</code> reverses a quarter turn; <code>²</code> is a half turn. Whole-cube rotations are free.";
const stepHtml = (step: Step | null, label: string, end: string, options: WordOptions): string => {
  const key = label.toLowerCase();
  if (!step) return `<div class="c7-step" data-step="${key}"><h3>${label}</h3><p>${esc(end)}</p></div>`;
  const plan = stepNotation(step.moves, options);
  const alternative = playedBlocks(step.moves, { ...options, slice: !options.slice });
  const alternativeMoves = blockCounts(alternative.blocks).blockMoves;
  const counts = alternativeMoves === plan.moves ?
    `${plan.moves} block moves with or without the middle slice.` :
    `${alternativeMoves} block moves ${options.slice ? "without" : "with"} the middle slice.`;
  return `<div class="c7-step" data-step="${key}"><h3>${label}</h3>` +
    `<p class="c7-step-summary"><a class="c7-nav" data-nav="${key}" href="${esc(href(step.to))}">${esc(monthLabel(step.to))}</a> · ${plan.moves} moves</p>` +
    `<details class="c7-word-panel"><summary>Moves · ${notationLabel(options.notation)}</summary>` +
    `<p class="c7-word-note">${expansionNote(options.notation)}</p>` +
    `<p class="c7-orientation">${orientationLabel(plan.played.alignment, options.orientation)}</p>` +
    `<p class="c7-word" data-notation-word="${key}">${notationHtml(plan)}</p></details>` +
    `<details class="c7-technical"><summary>Technical details</summary><p>Stored word: ${step.htm} layer moves (HTM), ${step.qtm} quarter turns (QTM), ${step.rot} stored rotation${step.rot === 1 ? "" : "s"}. ${counts} Equivalent expansion: ${plan.expandedLayerMoves} layer moves. Free rotations are excluded from move counts.</p></details></div>`;
};

/** Text announced in the live region after a navigation. */
export const announce = (model: PageModel): string =>
  model.choice.kind === "ok"
    ? `Showing ${monthLabel(model.choice.ym)}`
    : model.choice.kind === "outside"
      ? `${monthLabel(model.choice.ym)} is not available yet`
      : "Invalid month";

const SPEED_LABELS: readonly [number, string][] = [
  [100, "100 ms"],
  [250, "250 ms"],
  [500, "500 ms"],
  [1000, "1 s"],
];

/** The controls of the 3D view. They live outside the re-rendered page so that a button keeps its focus while a step plays. */
export function playerHtml(defaultSpeed: number): string {
  const options = SPEED_LABELS.map(
    ([v, label]) => `<option value="${v}"${v === defaultSpeed ? " selected" : ""}>${label}</option>`,
  ).join("");
  return (
    '<section class="c7-player" data-c7="player" aria-label="Cube animation controls" hidden>' +
    '<div class="c7-controls">' +
    '<button type="button" class="c7-btn" data-c7="play" aria-disabled="true">Play</button>' +
    '<button type="button" class="c7-btn" data-c7="skip" aria-disabled="true">Skip to end</button>' +
    `<label class="c7-speed">Speed <select data-c7="speed">${options}</select></label>` +
    `<label class="c7-slice"><input type="checkbox" data-c7="slice" checked> Middle slice counts as a move</label>` +
    '<label class="c7-orientation-select">Orientation <select data-c7="orientation"><option value="before" selected>Before moves</option><option value="after">After moves</option><option value="stored">Stored rotations</option></select></label>' +
    '<label class="c7-notation-select">Notation <select data-c7="notation"><option value="blocks" selected>Blocks</option><option value="layers">Layer moves (equivalent)</option><option value="raw">Raw generators (equivalent)</option></select></label>' +
    '<button type="button" class="c7-btn" data-c7="reset" aria-disabled="true">Reset view</button>' +
    "</div>" +
    '<p class="c7-word-note">Orientation, middle-slice and notation changes apply to the next step.</p>' +
    '<p class="c7-progress" data-c7="progress"></p>' +
    '<p class="c7-alignment" data-c7="alignment"></p>' +
    '<section class="c7-active-step" data-c7="active-step" hidden><h3 data-c7="active-title" tabindex="-1"></h3><p class="c7-word-note" data-c7="active-note"></p><p class="c7-word" data-c7="active-word"></p></section>' +
    '<p class="c7-note" data-c7="note" hidden>Reduced motion is on: a step jumps straight to the end state, without animation.</p>' +
    '<p class="c7-error" data-c7="error" role="alert" hidden></p>' +
    '<div class="c7-rotation" data-c7="rotation"></div>' +
    "</section>"
  );
}

/** The whole page body of the mode. */
export function pageHtml(model: PageModel, options: WordOptions = DEFAULT_WORD_OPTIONS): string {
  const { choice, range } = model;
  const rangeText = `${monthLabel(range.first)} to ${monthLabel(range.last)}`;
  const status =
    '<p class="c7-status">Research candidate, not certified. Stage 2: month display, 3D cube and animated adjacent steps only. ' +
    `${esc(NOT_YET)}</p>`;
  if (choice.kind === "invalid")
    return (
      `<div class="c7-page"><p class="c7-unavailable" role="alert" tabindex="-1" data-focus>Invalid month: ${esc(choice.reason)}.</p>` +
      `<p><a class="c7-nav" href="${esc(href(range.first))}">Open ${esc(monthLabel(range.first))}</a></p>${status}</div>`
    );
  if (choice.kind === "outside") {
    const what = choice.source === "today" ? `The current month, ${monthLabel(choice.ym)},` : `${monthLabel(choice.ym)}`;
    return (
      `<div class="c7-page"><p class="c7-unavailable" role="alert" tabindex="-1" data-focus>Not available yet. ${esc(what)} is outside ` +
      `the proven chain (${esc(rangeText)}).</p>` +
      `<p><a class="c7-nav" data-nav="start" href="${esc(href(range.first))}">Open ${esc(monthLabel(range.first))}</a> ` +
      `<a class="c7-nav" data-nav="end" href="${esc(href(range.last))}">Open ${esc(monthLabel(range.last))}</a></p>${status}</div>`
    );
  }
  return (
    `<div class="c7-page"><h2 class="c7-month" tabindex="-1" data-focus data-month="${ymKey(choice.ym)}">${esc(monthLabel(choice.ym))}</h2>` +
    (model.anyDate?.kind === "best-effort"
      ? `<p class="c7-best-effort" role="status" data-c7-best-effort>${esc(bestEffortSentence(model.anyDate.wrong ?? []))}</p>` +
        `<div class="${HIDDEN_SHEET_CLASS}" data-c7-sheet-hidden>${sheetHtml(model.cells as readonly Cell[], `7x7 calendar sheet, ${monthLabel(choice.ym)}`)}</div>`
      : sheetHtml(model.cells as readonly Cell[], `7x7 calendar sheet, ${monthLabel(choice.ym)}`)) +
    `<div class="c7-steps">${stepHtml(model.prev, "Previous", `No earlier month: ${monthLabel(range.first)} is the start of the chain.`, options)}` +
    `${stepHtml(model.next, "Next", `No later month: ${monthLabel(range.last)} is the end of the chain.`, options)}` +
    `<p class="c7-legend" data-c7-legend>${LEGEND}</p></div>` +
    (model.longChain
      ? `<p class="c7-range" data-c7-chain>${esc(CHAIN_C_LABEL)}. Chain: ${esc(rangeText)}, ${range.edges} steps. Research candidate, not certified; print D is not frozen.</p>`
      : model.layout === "names"
      ? `<p class="c7-range">Names layout window: ${esc(rangeText)}, ${range.edges} steps. Research candidate, not certified; not proven outside this window.</p>`
      : `<p class="c7-range">Proven chain: ${esc(rangeText)}, ${range.edges} steps.</p>`) + `${status}</div>`
  );
}

/** Builds the model for a month choice; null for anything but an "ok" choice has no sheet. */
export function buildModel(
  graph: Graph,
  table: DisplayTable,
  choice: MonthChoice,
  today: YearMonth,
  layout: Layout = "standard",
  longChain = false,
  bestEffort: readonly BestEffortMonth[] = [],
): PageModel {
  const range = chainRange(graph);
  if (choice.kind !== "ok") return { choice, range, today, layout, longChain, prev: null, next: null };
  const wrong = bestEffort.find((b) => b.year === choice.ym.year && b.month === choice.ym.month)?.wrong;
  return {
    choice,
    range,
    today,
    layout,
    longChain,
    ...(wrong ? { anyDate: { kind: "best-effort" as const, key: "", wrong } } : {}),
    cells: sheetCells(graph, table, range, choice.ym),
    prev: stepFrom(graph, range, choice.ym, -1),
    next: stepFrom(graph, range, choice.ym, 1),
  };
}
