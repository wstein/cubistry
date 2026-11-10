// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube, names layout data (window May 2026 to January 2028; research candidate,
// not certified): the three files under public/calendar7/names/ parse with the app parsers, replay with
// the app engine, and show the owner's layout. The shipped scheme A files stay frozen (see the last test).
// Set CALENDAR7_NAMES_RESEARCH=<checkout root of the research branch> to also run the exporter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMoves, clonePose, inverseMoves, metrics, stateDigest } from "../src/apps/calendar7/engine.ts";
import { frontFailure, imageNormal, monthCells } from "../src/apps/calendar7/display.ts";
import { displayIdOf, parseDisplays, parseGraph, parseState, verifyChain, verifyEdge } from "../src/apps/calendar7/graph.ts";

const DIR = "public/calendar7/names/";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const stateJson = json(DIR + "state.v1.json");
const start = parseState(stateJson);
const table = parseDisplays(json(DIR + "displays.v1.json"));
const graph = parseGraph(json(DIR + "graph.v1.json"));
const { printing, pose } = start;

// The owner's table of 2026-11-10 (independent of the exporter and of the research layout file).
const OWNER = [
  ["J", "ANU", "ARY"],
  ["FE", "BRU", "ARY"],
  ["MA", "RCH"],
  ["APR", "IL"],
  ["MA", "Y"],
  ["J", "UNE"],
  ["J", "ULY"],
  ["AUG", "UST"],
  ["SEP", "TEM", "BER"],
  ["OC", "TOB", "ER"],
  ["NOV", "EMB", "ER"],
  ["DEC", "EMB", "ER"],
];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WINDOW = [];
for (let k = 0; k < 21; k++) WINDOW.push([2026 + Math.floor((4 + k) / 12), ((4 + k) % 12) + 1]);

test("the names folder carries state, graph, displays, manifest and notice", () => {
  const manifest = readFileSync(DIR + "manifest.sha256", "utf8").trim().split("\n");
  const entries = Object.fromEntries(manifest.map((l) => l.split("  ").reverse()));
  assert.deepEqual(Object.keys(entries).sort(), ["NOTICE.txt", "displays.v1.json", "graph.v1.json", "state.v1.json"]);
  for (const [file, digest] of Object.entries(entries)) assert.equal(sha(readFileSync(DIR + file)), digest, file);
  const notice = readFileSync(DIR + "NOTICE.txt", "utf8");
  assert.match(notice, /research candidate, not certified/);
  assert.match(notice, /May 2026 to January 2028/);
  assert.match(notice, /English only/);
  for (const j of [stateJson, json(DIR + "graph.v1.json"), json(DIR + "displays.v1.json")])
    assert.equal(j.status, "research candidate, not certified");
});

test("the state file declares surface face and carries the band and blank classes", () => {
  assert.equal(stateJson.surface, "face");
  assert.equal(start.surface, "face");
  const count = {};
  for (const k of printing.ink) count[k] = (count[k] ?? 0) + 1;
  assert.deepEqual(count, { red: 68, month: 24, band: 12, dark: 153, blank: 32, weekday: 5 });
  printing.ink.forEach((k, i) => assert.equal(printing.text[i] === "", k === "blank" || k === "band"));
  assert.ok(printing.text.includes("EMB") && printing.text.includes("ANU") && printing.text.includes("MA"));
  assert.equal(start.node.year, 2026);
  assert.equal(start.node.month, 5);
});

test("the display table covers exactly the 21 window months", () => {
  assert.equal(table.months.length, 21);
  assert.equal(table.firstMonth, 5);
  WINDOW.forEach(([y, m], k) => assert.equal(displayIdOf(table, y, m), table.months[k]));
  for (const [y, m] of [[2026, 4], [2028, 2], [2025, 12], [2099, 12]])
    assert.throws(() => displayIdOf(table, y, m), RangeError, `${y}-${m}`);
});

test("every window display shows the owner's layout: names in row 1, bands, Sunday-first weekdays, dates", () => {
  WINDOW.forEach(([y, m]) => {
    const d = table.displays[displayIdOf(table, y, m) - 1];
    assert.deepEqual([d.year, d.month], [y, m]);
    assert.equal(d.cells.length, 49);
    const row1 = d.cells.slice(0, 7);
    row1.forEach((c, k) => {
      const label = OWNER[m - 1][k];
      assert.deepEqual(c, label ? { text: label, ink: "month" } : { text: "", ink: "band" }, `${y}-${m} row 1 col ${k + 1}`);
    });
    assert.deepEqual(
      d.cells.slice(7, 14),
      WEEKDAYS.map((text, c) => ({ text, ink: c === 0 || c === 6 ? "red" : "weekday" })),
    );
    // Rows 3-7: the app's own calendar (Sunday first, split labels 23/30 and 24/31, empty days are blank).
    assert.deepEqual(d.cells.slice(14), monthCells(y, m).slice(14), `${y}-${m} date rows`);
  });
});

test("replay: 21 nodes, 20 edges, 7338 HTM, 7514 QTM, 368 rotations; app and independent loop agree at every step", () => {
  assert.equal(graph.nodes.length, 21);
  assert.equal(graph.edges.length, 20);
  const result = verifyChain(printing, pose, table, graph);
  assert.equal(result.edges.length, 20);
  const sum = { htm: 0, qtm: 0, rot: 0, rotq: 0 };
  let state = clonePose(pose);
  const hashes = [stateDigest(printing, state)];
  graph.edges.forEach((e, i) => {
    assert.equal(hashes[i], graph.nodes[i].hash, `node ${i}`);
    state = applyMoves(state, e.moves);
    hashes.push(stateDigest(printing, state));
    assert.equal(hashes[i + 1], graph.nodes[i + 1].hash, `end hash of edge ${i}`);
    assert.equal(result.edges[i].endHash, hashes[i + 1]);
    const m = metrics(e.moves);
    for (const k of Object.keys(sum)) assert.equal(m[k], e[k], `edge ${i} ${k}`);
    for (const k of Object.keys(sum)) sum[k] += m[k];
    assert.equal(verifyEdge(printing, table, graph, i, applyMoves(state, inverseMoves(e.moves))).endHash, hashes[i + 1]);
  });
  assert.deepEqual(sum, { htm: 7338, qtm: 7514, rot: 368, rotq: 376 });
  // Receipt of the research Julia checker (row1-window-chain/evidence/julia.tsv): the 21 digests, newline joined.
  assert.equal(sha(hashes.join("\n") + "\n"), "af3b77a262395fe916803b6a213bfc88304784bd91cfe0547e420da07f2778bc");
  assert.equal(hashes[0], "a13bcb71837f548c826391ae75fa1ea881e74a60432e4b2c3f91adcb01edffaa");
  assert.equal(hashes[20], "ef2a9a8bf378cb236a895c434961c6d8cfe9b7140e3acf9bfe0d752c694fa1dc");
});

test("every edge target shows its display: months chain May 2026 to January 2028", () => {
  graph.nodes.forEach((n, k) => assert.deepEqual([n.year, n.month], WINDOW[k]));
  graph.nodes.forEach((n) => assert.equal(displayIdOf(table, n.year, n.month), n.display));
});

test("glyph rules: 6 and 9 share a half turn, 0 reads under any turn, O is upright and is not 0, band is not blank", () => {
  const six = (a) => imageNormal("6", a, "dark");
  assert.deepEqual(six(2), imageNormal("9", 0, "dark"));
  assert.deepEqual(six(0), imageNormal("9", 2, "dark"));
  assert.notDeepEqual(six(1), imageNormal("9", 0, "dark"));
  for (let a = 0; a < 4; a++) assert.deepEqual(imageNormal("0", a, "dark"), imageNormal("0", 0, "dark"));
  assert.notDeepEqual(imageNormal("O", 0, "month"), imageNormal("0", 0, "month"));
  for (const a of [1, 2, 3]) assert.notDeepEqual(imageNormal("O", a, "month"), imageNormal("O", 0, "month"));
  assert.notDeepEqual(imageNormal("", 0, "band"), imageNormal("", 0, "blank"));
  for (const a of [1, 2, 3]) assert.notDeepEqual(imageNormal("", a, "band"), imageNormal("", 0, "band"));
  for (const a of [1, 2, 3]) assert.deepEqual(imageNormal("", a, "blank"), imageNormal("", 0, "blank"));
  assert.equal(
    printing.text.filter((t) => t === "O" || t === "0").length,
    0,
    "no single-character O or 0 tile exists in this print",
  );
});

/** Front sticker index of cell k (row-major) of `state`. */
function frontIndex(state, k) {
  for (let i = 0; i < 294; i++) {
    const o = 3 * i;
    if (state.normal[o + 2] === 1 && state.pos[o + 2] === 3 && (4 - state.pos[o + 1] - 1) * 7 + state.pos[o] + 3 === k) return i;
  }
  throw new Error("no front sticker");
}
const turnUp = (state, i, up) => {
  const s = clonePose(state);
  s.up.set(up, 3 * i);
  return s;
};

/** The retained state at every node, replayed with the app engine. */
const states = [clonePose(pose)];
graph.edges.forEach((e, i) => states.push(applyMoves(states[i], e.moves)));
const half = (state, i) => turnUp(state, i, [-state.up[3 * i], -state.up[3 * i + 1], -state.up[3 * i + 2]]);

test("front rule on the real data: 6 and 9 by half turn, strict art of 23/30 and 24/31, band orientation", () => {
  const d = table.displays[displayIdOf(table, 2026, 5) - 1];
  // 6 and 9: a printed 6 shown by a half turn reads as 9, and not as 6.
  const k6 = d.cells.findIndex((c, k) => k >= 14 && c.text === "6");
  assert.ok(k6 >= 14);
  const i6 = frontIndex(pose, k6);
  assert.equal(printing.text[i6], "6");
  assert.equal(frontFailure(printing, pose, d.cells), null);
  const nine = d.cells.map((c, k) => (k === k6 ? { text: "9", ink: c.ink } : c));
  assert.equal(frontFailure(printing, pose, nine)?.why, "plain-mismatch");
  assert.equal(frontFailure(printing, half(pose, i6), nine), null);
  assert.equal(frontFailure(printing, half(pose, i6), d.cells)?.why, "plain-mismatch");
  // Strict art: a stacked label must be upright; a half turn is rejected for every stacked cell of the window.
  const seen = new Set();
  graph.nodes.forEach((n, node) => {
    const cells = table.displays[n.display - 1].cells;
    cells.forEach((c, k) => {
      if (!/^\d+\/\d+$/.test(c.text)) return;
      seen.add(c.text);
      const i = frontIndex(states[node], k);
      assert.equal(printing.text[i], c.text);
      assert.equal(frontFailure(printing, states[node], cells), null);
      assert.equal(frontFailure(printing, half(states[node], i), cells)?.why, "stacked-not-upright", `${n.year}-${n.month} ${c.text}`);
    });
  });
  assert.deepEqual([...seen].sort(), ["23/30", "24/31"]);
  // Band: an empty band tile must be upright and must not be a blank tile.
  const ib = frontIndex(pose, 3);
  assert.equal(printing.ink[ib], "band");
  const quarter = turnUp(pose, ib, [-pose.up[3 * ib + 1], pose.up[3 * ib], 0]);
  assert.equal(frontFailure(printing, quarter, d.cells)?.why, "plain-mismatch");
  const blankWanted = d.cells.map((c, k) => (k === 3 ? { text: "", ink: "blank" } : c));
  assert.equal(frontFailure(printing, pose, blankWanted)?.why, "plain-mismatch");
});

test("negative controls: wrong order, wrong hash, wrong label, wrong class are rejected", () => {
  const swap = structuredClone(graph);
  swap.edges[3] = { ...swap.edges[3], moves: [...swap.edges[3].moves].reverse() };
  assert.throws(() => verifyChain(printing, pose, table, swap), /edge 3/);
  const hash = structuredClone(graph);
  hash.nodes[7] = { ...hash.nodes[7], hash: "0".repeat(64) };
  assert.throws(() => verifyChain(printing, pose, table, hash), /edge (6|7)/);
  const label = structuredClone(table);
  const d = label.displays[displayIdOf(label, 2027, 11) - 1];
  d.cells[1] = { text: "EMX", ink: "month" };
  assert.throws(() => verifyChain(printing, pose, label, graph), /front differs/);
  const ink = structuredClone(table);
  ink.displays[displayIdOf(ink, 2026, 9) - 1].cells[4] = { text: "", ink: "blank" };
  assert.throws(() => verifyChain(printing, pose, ink, graph), /front differs/);
});

test("parsers: band needs empty text, window displays need consistent counts", () => {
  const bad = structuredClone(stateJson);
  const ib = bad.stickers.findIndex((s) => s.ink === "band");
  bad.stickers[ib].text = "X";
  assert.throws(() => parseState(bad), /blank text and blank ink must coincide|band/);
  const disp = json(DIR + "displays.v1.json");
  assert.throws(() => parseDisplays({ ...disp, months: disp.months.slice(1) }), /months/);
  assert.throws(() => parseDisplays({ ...disp, firstMonth: 13 }), /firstMonth/);
  assert.throws(() => parseDisplays({ ...disp, inks: ["blank", "dark", "month", "red", "weekday", "x"] }), /ink table/);
});

test("the shipped scheme A files are frozen and the repository check still passes", () => {
  const pin = json("calendar7-source.json");
  for (const f of ["state", "graph", "displays"]) {
    const file = `public/calendar7/${f}.v1.json`;
    assert.equal(sha(readFileSync(file)), pin.runtime[file], file);
  }
  const out = execFileSync(process.execPath, ["scripts/prepare-calendar7.mjs", "--check"], { encoding: "utf8" });
  assert.match(out, /calendar7 data OK/);
});

test("exporter: output is byte-identical to the committed files (needs CALENDAR7_NAMES_RESEARCH)", (t) => {
  const research = process.env.CALENDAR7_NAMES_RESEARCH;
  if (!research) return t.skip("CALENDAR7_NAMES_RESEARCH not set");
  const out = mkdtempSync(join(tmpdir(), "names-data-"));
  execFileSync(process.execPath, ["scripts/export-calendar7-names.mjs", research, "--out", out]);
  for (const f of ["state.v1.json", "graph.v1.json", "displays.v1.json", "NOTICE.txt", "manifest.sha256"])
    assert.equal(readFileSync(join(out, f), "utf8"), readFileSync(DIR + f, "utf8"), f);
});
