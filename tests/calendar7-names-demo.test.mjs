// SPDX-License-Identifier: AGPL-3.0-or-later
import { monthLabel } from "../src/apps/calendar7/month-view.ts";
// DEMO of the Calendar7 names layout on the print window-2029-12 with the beam chain (public/calendar7/names-demo):
// the demo data against the research evidence (PR 411), replay with the repo's simulator, the block-move counts the page
// shows, and the demo selection of the mount. The shipped names data is tested in calendar7-names-data.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, PINNED } from "../scripts/export-calendar7-names-demo.mjs";
import { parseDisplays, parseGraph, parseState, verifyChain } from "../src/apps/calendar7/graph.ts";
import { applyMoves, clonePose, metrics, stateDigest } from "../src/apps/calendar7/engine.ts";
import { DEFAULT_WORD_OPTIONS, stepNotation } from "../src/apps/calendar7/notation.ts";
import { buildModel, chainRange, chooseMonth, pageHtml, stepFrom } from "../src/apps/calendar7/month-view.ts";
import { parseLayout, parseLayoutMode } from "../src/apps/calendar7/layout.ts";
import { namesCells, wrongStickerIndices } from "../src/apps/calendar7/anydate.ts";
import { frontFailures } from "../src/apps/calendar7/display.ts";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";

const DIR = "public/calendar7/names-demo";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json(`${DIR}/graph.v1.json`));
const table = parseDisplays(json(`${DIR}/displays.v1.json`));
const start = parseState(json(`${DIR}/state.v1.json`));
const range = chainRange(graph);

// Evidence of PR 411 (research/calendar-7x7/row1-window-chain/README.md, evidence/beam-chain-2026-06/moves.tsv): Dec 2026 to Jun 2027.
const BEAM_HTM = [61, 96, 115, 34, 99, 121, 124];
const BEAM_QTM = [71, 125, 138, 49, 118, 148, 149];
const BEAM_ROT = [1, 1, 2, 0, 2, 1, 1];
const GREEDY_HTM = [485, 477, 430, 435, 442, 458]; // Jun to Nov 2026, the stored greedy prefix of the window-2029-12 chain
const ym = (k) => ({ year: 2026 + Math.floor((4 + k) / 12), month: ((4 + k) % 12) + 1 });

test("the demo graph is May 2026 to June 2027: 14 nodes, 13 edges, the stored greedy prefix then the 7 beam edges", () => {
  assert.deepEqual(range, { first: { year: 2026, month: 5 }, last: { year: 2027, month: 6 }, edges: 13 });
  assert.deepEqual(graph.edges.slice(0, 6).map((e) => e.htm), GREEDY_HTM);
  assert.deepEqual(graph.edges.slice(6).map((e) => e.htm), BEAM_HTM);
  assert.deepEqual(graph.edges.slice(6).map((e) => e.qtm), BEAM_QTM);
  assert.deepEqual(graph.edges.slice(6).map((e) => e.rot), BEAM_ROT);
  assert.equal(table.months.length, 14);
});

test("every edge word reproduces its declared metrics and the replay with the repo's simulator reaches the next node", () => {
  let pose = clonePose(start.pose);
  assert.equal(stateDigest(start.printing, pose), graph.nodes[0].hash);
  graph.edges.forEach((e, k) => {
    const got = metrics(e.moves);
    assert.deepEqual([got.htm, got.qtm, got.rot, got.rotq], [e.htm, e.qtm, e.rot, e.rotq], `edge ${k}`);
    pose = applyMoves(pose, e.moves);
    assert.equal(stateDigest(start.printing, pose), graph.nodes[k + 1].hash, `edge ${k} reaches node ${k + 1}`);
  });
  assert.equal(verifyChain(start.printing, start.pose, table, graph).edges.length, 13);
});

test("a dropped move or a wrong edge word does not reach the next node", () => {
  const e = graph.edges[6];
  const from = applyMoves(clonePose(start.pose), graph.edges.slice(0, 6).flatMap((x) => x.moves));
  assert.equal(stateDigest(start.printing, applyMoves(from, e.moves)), graph.nodes[7].hash);
  assert.notEqual(stateDigest(start.printing, applyMoves(from, e.moves.slice(1))), graph.nodes[7].hash);
  assert.notEqual(stateDigest(start.printing, applyMoves(from, graph.edges[7].moves)), graph.nodes[7].hash);
});

test("the page shows the block-move count of the edge; Nov 2026 to Dec 2026 is 51 moves for 61 HTM", () => {
  const counts = graph.edges.map((_, k) => stepNotation(stepFrom(graph, range, ym(k), 1).moves, DEFAULT_WORD_OPTIONS).moves);
  assert.deepEqual(counts, [361, 375, 326, 325, 340, 345, 51, 81, 90, 24, 79, 96, 101]);
  const nov = { year: 2026, month: 11 };
  const page = (y, m) => pageHtml(buildModel(graph, table, chooseMonth(new URLSearchParams(`year=${y}&month=${m}`), nov, range), nov, "names"));
  const html = page(2026, 11);
  assert.match(html, /data-step="next"><h3>Next<\/h3><p class="c7-step-summary"><a [^>]*>December 2026<\/a> · 51 moves<\/p>/);
  assert.match(html, /Stored word: 61 layer moves \(HTM\), 71 quarter turns \(QTM\), 1 stored rotation\./);
  assert.match(html, /data-step="previous"><h3>Previous<\/h3><p class="c7-step-summary"><a [^>]*>October 2026<\/a> · 345 moves/);
  const dec = page(2026, 12);
  assert.match(dec, /data-step="previous"><h3>Previous<\/h3><p class="c7-step-summary"><a [^>]*>November 2026<\/a> · 51 moves/); // backward step: the inverse word, same count
  assert.match(dec, /Names layout window: May 2026 to June 2027, 13 steps/);
});

test("months outside May 2026 to June 2027 are outside the chain; the end months have no further step", () => {
  for (const [y, m] of [[2026, 4], [2027, 7], [2028, 1], [2030, 5]]) assert.equal(chooseMonth(new URLSearchParams(`year=${y}&month=${m}`), { year: 2026, month: 11 }, range).kind, "outside", `${y}-${m}`);
  assert.equal(stepFrom(graph, range, { year: 2027, month: 6 }, 1), null);
  assert.equal(stepFrom(graph, range, { year: 2026, month: 5 }, -1), null);
});

test("the demo folder checks clean, its own pins hold, and the shipped names pins are untouched", () => {
  check(DIR);
  assert.equal(PINNED.printing, "73e8e6394167759d284c07ce010ce726f9f5aefa522792323cacc9c1bd7c1192");
  const shipped = readFileSync("public/calendar7/names/research-inputs.sha256", "utf8");
  assert.match(shipped, /^c5671d75/);
  assert.equal(shipped.includes(PINNED.printing), false);
});

test("check stops on a tampered demo folder (edge word without the manifest, edge word with a forged manifest entry)", () => {
  const dir = mkdtempSync(join(tmpdir(), "c7demo-"));
  cpSync(DIR, dir, { recursive: true });
  check(dir);
  const g = json(join(dir, "graph.v1.json"));
  g.edges[6].moves = g.edges[6].moves.slice(1);
  writeFileSync(join(dir, "graph.v1.json"), JSON.stringify(g));
  assert.throws(() => check(dir), /graph\.v1\.json does not match manifest/);
});

test("the demo is only selected by ?layout=names-demo: parseLayout never returns it", () => {
  assert.equal(parseLayout("names-demo"), "standard");
  assert.equal(parseLayoutMode("names-demo"), "names-demo");
  assert.equal(parseLayoutMode("names"), "names");
  for (const bad of [null, undefined, "", "Names-demo", "names-demo ", "demo"]) assert.equal(parseLayoutMode(bad), "standard", String(bad));
});
