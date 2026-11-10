// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube, names layout data (window May 2026 to January 2028; research candidate,
// not certified): the three files under public/calendar7/names/ parse with the app parsers, replay with
// the app engine, and show the owner's layout. The shipped scheme A files stay frozen (see the last test).
// Set CALENDAR7_NAMES_RESEARCH=<checkout root of the research branch> to also run the exporter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, check } from "../scripts/export-calendar7-names.mjs";
import { applyMoves, clonePose, inverseMoves, metrics, stateDigest } from "../src/apps/calendar7/engine.ts";
import { frontFailure, imageNormal, monthCells } from "../src/apps/calendar7/display.ts";
import { displayIdOf, namesWindowContains, parseDisplays, parseGraph, parseState, verifyChain, verifyEdge } from "../src/apps/calendar7/graph.ts";

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
  const last = structuredClone(graph);
  last.nodes[20] = { ...last.nodes[20], hash: "0".repeat(64) };
  assert.throws(() => verifyChain(printing, pose, table, last), /edge 19: end hash differs from node 20/);
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
  assert.throws(() => parseDisplays({ ...disp, months: disp.months.slice(1) }), /1 display per month at most/);
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

test("the repository check of the names data passes (npm run verify:calendar7-names)", () => {
  const out = execFileSync(process.execPath, ["scripts/export-calendar7-names.mjs", "--check"], { encoding: "utf8" });
  assert.match(out, /calendar7 names data OK \(21 states, 20 edges, 7338 HTM, 7514 QTM, 368 rotations\)/);
});

test("exporter: output is byte-identical to the committed files (needs CALENDAR7_NAMES_RESEARCH)", (t) => {
  const research = process.env.CALENDAR7_NAMES_RESEARCH;
  if (!research) return t.skip("CALENDAR7_NAMES_RESEARCH not set");
  const out = mkdtempSync(join(tmpdir(), "names-data-"));
  execFileSync(process.execPath, ["scripts/export-calendar7-names.mjs", research, "--out", out]);
  for (const f of ["state.v1.json", "graph.v1.json", "displays.v1.json", "NOTICE.txt", "manifest.sha256", "research-inputs.sha256"])
    assert.equal(readFileSync(join(out, f), "utf8"), readFileSync(DIR + f, "utf8"), f);
});

// ---------------------------------------------------------------------------------------------------------
// Negative tests of the exporter and of --check.

/** The committed names folder, copied to a fresh directory; `edit(dir)` tampers with it. */
function namesCopy(edit) {
  const dir = mkdtempSync(join(tmpdir(), "names-data-copy-"));
  cpSync(DIR, dir, { recursive: true });
  edit?.(dir);
  return dir;
}
/** Rewrite manifest.sha256 of `dir` so that it matches the (tampered) files. */
function remanifest(dir) {
  const out = ["NOTICE.txt", "displays.v1.json", "graph.v1.json", "state.v1.json"].map((n) => `${sha(readFileSync(join(dir, n)))}  ${n}\n`);
  writeFileSync(join(dir, "manifest.sha256"), out.join(""));
}

test("check(): the committed names folder passes; a changed file fails the manifest", () => {
  assert.doesNotThrow(() => check(namesCopy()));
  const dir = namesCopy((d) => writeFileSync(join(d, "NOTICE.txt"), readFileSync(join(d, "NOTICE.txt"), "utf8") + "x\n"));
  assert.throws(() => check(dir), /NOTICE\.txt does not match manifest\.sha256/);
});

test("check(): a consistent chain with 19 edges fails the totals", () => {
  const dir = namesCopy((d) => {
    const g = JSON.parse(readFileSync(join(d, "graph.v1.json"), "utf8"));
    g.nodes.pop();
    g.edges.pop();
    const text = readFileSync(join(d, "graph.v1.json"), "utf8");
    const head = text.slice(0, text.indexOf('"nodes":['));
    const item = (v) => "  " + JSON.stringify(v);
    writeFileSync(join(d, "graph.v1.json"), `${head}"nodes":[\n${g.nodes.map(item).join(",\n")}\n],\n"edges":[\n${g.edges.map(item).join(",\n")}\n]\n}\n`);
    remanifest(d);
  });
  assert.throws(() => check(dir), /totals differ/);
});

test("check(): research-inputs.sha256 holds the digests of experiment.json and is verified offline", () => {
  const file = readFileSync(DIR + "research-inputs.sha256", "utf8");
  assert.equal(
    file,
    [
      "c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db  research/calendar-7x7/row1-revision/layout.tsv",
      "0cb44a28c4bf84c25616fc248f9565df2e49e41feb479225e43166b1b8a2d127  research/calendar-7x7/row1-window-print/evidence/printing.tsv",
      "7db8c8a1073f79e73f1e59ab953e25fc47342d5659d5058d8ae9cf5eb8bbe1db  research/calendar-7x7/row1-window-chain/evidence/moves.tsv",
      "c1adcfff7488d3bcfb08dd2161cc3ba6158333fbe1e7fd1ea75805b65058679d  research/calendar-7x7/row1-window-chain/evidence/states.sha256",
      "",
    ].join("\n"),
  );
  const dir = namesCopy((d) => writeFileSync(join(d, "research-inputs.sha256"), file.replace("c5671d", "c5671e")));
  assert.throws(() => check(dir), /research-inputs\.sha256/);
});

/** A copy of the research inputs the exporter reads; `edit(root)` tampers with it. */
function researchCopy(root, edit) {
  const out = mkdtempSync(join(tmpdir(), "names-data-research-"));
  const cal = "research/calendar-7x7/";
  for (const rel of ["row1-revision/layout.tsv", "row1-window-print/evidence/printing.tsv", "row1-window-chain/evidence/moves.tsv", "row1-window-chain/evidence/states.sha256"]) {
    mkdirSync(join(out, cal, rel, ".."), { recursive: true });
    cpSync(join(root, cal, rel), join(out, cal, rel));
  }
  cpSync(join(root, cal, "row1-window-chain/evidence/states"), join(out, cal, "row1-window-chain/evidence/states"), { recursive: true });
  edit?.(out);
  return out;
}
const research = process.env.CALENDAR7_NAMES_RESEARCH;
const edit = (root, rel, fn) => {
  const f = join(root, "research/calendar-7x7/", rel);
  writeFileSync(f, fn(readFileSync(f, "utf8")));
};
const rows = (root, rel) => readFileSync(join(root, "research/calendar-7x7/", rel), "utf8");

test("exporter guards (need CALENDAR7_NAMES_RESEARCH): digest pin and, behind it, metrics, snapshot and front", (t) => {
  if (!research) return t.skip("CALENDAR7_NAMES_RESEARCH not set");
  assert.doesNotThrow(() => build(researchCopy(research)));
  const L = "row1-revision/layout.tsv";
  const M = "row1-window-chain/evidence/moves.tsv";
  const S = "row1-window-chain/evidence/states/state-05.tsv";
  // The digest pin stops any changed input.
  for (const rel of [L, M, "row1-window-print/evidence/printing.tsv", "row1-window-chain/evidence/states.sha256"]) {
    const root = researchCopy(research, (r) => edit(r, rel, (x) => x.replace(/\n/, "\n\n")));
    assert.throws(() => build(root), /digest differs from experiment\.json/, rel);
  }
  // The checks behind the pin are reached with the test-only option (not available from the command line).
  const unpinned = (root) => build(root, { testOnlySkipDigestPins: true });
  assert.doesNotThrow(() => unpinned(researchCopy(research)));
  const metrics = researchCopy(research, (r) => edit(r, M, (x) => x.replace(/^(edge\t2026\t6\t)450/m, "$1451")));
  assert.throws(() => unpinned(metrics), /edge 1: declared metrics differ from the words/);
  const snapshot = researchCopy(research, (r) => {
    edit(r, S, (x) => x.replace(/\t[A-Z]{3}\tweekday\n/, "\tXXX\tweekday\n"));
    const sum = createHash("sha256").update(readFileSync(join(r, "research/calendar-7x7/", S))).digest("hex");
    edit(r, "row1-window-chain/evidence/states.sha256", (x) => x.replace(/^[0-9a-f]{64}( {2}state-05\.tsv)$/m, `${sum}$1`));
  });
  assert.throws(() => unpinned(snapshot), /edge 4: replay differs from state-5\.tsv/);
  const front = researchCopy(research, (r) => edit(r, L, (x) => x.replace("5\tMA\tY", "5\tMA\tZ")));
  assert.throws(() => unpinned(front), /front differs from its display/);
  const order = researchCopy(research, (r) => edit(r, M, (x) => x.replace(/^edge\t2026\t6\t/m, "edge\t2026\t7\t")));
  assert.throws(() => unpinned(order), /edge 1: month out of order/);
  assert.equal(rows(research, L).includes("5\tMA\tY"), true);
});

// ---------------------------------------------------------------------------------------------------------
// Window table guards of parseDisplays and namesWindowContains.

test("window tables: month/display consistency, month count bound and the ink-table branches", () => {
  const disp = json(DIR + "displays.v1.json");
  const swapped = [...disp.months];
  [swapped[3], swapped[4]] = [swapped[4], swapped[3]];
  assert.throws(() => parseDisplays({ ...disp, months: swapped }), /names display \d+ of another month/);
  assert.throws(() => parseDisplays({ ...disp, firstMonth: 6 }), /another month/);
  assert.throws(() => parseDisplays({ ...disp, months: [] }), /1 to 1201 months/);
  assert.throws(() => parseDisplays({ ...disp, months: new Array(1202).fill(1) }), /1 to 1201 months/);
  // Ink tables: 5 entries are the shipped table (band cells are then unknown), 6 are the names table, others fail.
  assert.throws(() => parseDisplays({ ...disp, inks: disp.inks.slice(0, 5) }), /bad cell band:/);
  const plain = { ...disp, inks: disp.inks.slice(0, 5), displays: disp.displays.map((d) => ({ ...d, cells: d.cells.map((c) => c.replace(/^band:/, "blank:")) })) };
  assert.equal(parseDisplays(plain).months.length, 21);
  assert.throws(() => parseDisplays({ ...disp, inks: [...disp.inks, "x"] }), /ink table differs/);
  assert.throws(() => parseDisplays({ ...disp, inks: disp.inks.slice(0, 4) }), /ink table differs/);
  assert.throws(() => parseDisplays({ ...disp, inks: [...disp.inks.slice(1), "blank"] }), /ink table differs/);
});

test("namesWindowContains answers without throwing: only the 21 window months are inside", () => {
  WINDOW.forEach(([y, m]) => assert.equal(namesWindowContains(table, y, m), true, `${y}-${m}`));
  for (const [y, m] of [[2026, 4], [2028, 2], [1999, 12], [2100, 1], [2027, 0], [2027, 13], [2027, 5.5], [2027.5, 5], [NaN, 5], [2027, NaN], ["2027", 5]])
    assert.equal(namesWindowContains(table, y, m), false, `${y}-${m}`);
  const shipped = parseDisplays(json("public/calendar7/displays.v1.json"));
  assert.equal(namesWindowContains(shipped, 2026, 1), true);
  assert.equal(namesWindowContains(shipped, 2099, 12), true);
  assert.equal(namesWindowContains(shipped, 2100, 1), false);
});
