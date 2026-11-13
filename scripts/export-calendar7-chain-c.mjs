// SPDX-License-Identifier: AGPL-3.0-or-later
// Export the verified Calendar7 long chain on print D (January 1980 to January 2036, 673 states, 672 edges; research
// candidate, not certified) into the app's v1 data format, as a folder of its own: public/calendar7/chain-c.
// Print D is print C relabeled so that the solved cube shows the root month January 1980 (research: root_change.jl, README
// section "Root change"). The shipped names data and the names demo are not touched.
//
//   node scripts/export-calendar7-chain-c.mjs <states-dir> <research-root> [--out public/calendar7/chain-c]
//   node scripts/export-calendar7-chain-c.mjs --check [<states-dir> <research-root>]
//       Without sources: manifest digests, source digests against the pins, app parsers and a full replay of the committed
//       files (npm run verify:calendar7-chain-c). With sources: also regenerate and compare byte for byte.
//
// <research-root> is a checkout (or archive) of research/cube-display-feasibility that holds the research PR #470 evidence (CHAIN.source); the script reads
// research/calendar-7x7/row1-window-chain/evidence/{print-d,chain-1980-2036}/ (print, layout, chain, month list, best-effort list,
// receipts, state manifest). <states-dir> holds states/state-NN.tsv: the snapshots of the chain, reproduced by
//   julia --startup-file=no research/calendar-7x7/row1-window-chain/root_change.jl <print-c printing.tsv> <states-dir> --states <chain.moves.tsv of every stage in time order>
// (the stage artifacts are listed in provenance.tsv; they are not in the repository). Every snapshot is checked against the
// states.sha256 of the research evidence.
//
// Extending the chain (1900-01 backward, 2100-01 forward): run root_change.jl over all stage chains again, commit its output
// in research, and describe the new chain in CHAIN below (source, directories, first and last month, best-effort months and the pinned
// digests, PINNED); the format, the checks and the app need no other change except WINDOW_FIRST_YEAR in graph.ts.
//
// Format (documented in docs/CALENDAR7_CHAIN_C.md): the states are not stored one by one (673 snapshots are 8.9 MB). The
// root pose (state.v1.json) plus one move word per edge (graph.v1.json, 1 character per move) and the SHA-256 of every
// state (graph nodes) determine all of them by replay; the page replays them anyway.
//
// The script stops on any mismatch: input digests, the month list, declared metrics, replay of every word against its
// snapshot and end hash, and the front of every state against its display. A best-effort month must differ from its display
// in exactly the cell the research names, and in no other.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INKS_WITH_BAND, frontFailures } from "../src/apps/calendar7/display.ts";
import { BEST_EFFORT_SCHEMA, MOVE_ALPHABET, encodeMoves, parseBestEffort, parseDisplays, parseGraph, parseState, verifyChain } from "../src/apps/calendar7/graph.ts";
import { applyMoves, metrics, stateDigest, stateText } from "../src/apps/calendar7/engine.ts";
import { parseChain, parsePrint, parseRoot } from "./prepare-calendar7.mjs";
import { parseLayout, windowCells } from "./export-calendar7-names.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const EVIDENCE = "research/calendar-7x7/row1-window-chain/evidence/";
/** The chain: where it lives in research and what it is. Everything else is derived from the files or checked against them. */
export const CHAIN = {
  /** Informative: where the sources live (no commit is required; the files are pinned by content digest). */
  source: "research PR #470 (print D, root change), research/cube-display-feasibility",
  printDir: `${EVIDENCE}print-d/`,
  chainDir: `${EVIDENCE}chain-1980-2036/`,
  first: { year: 1980, month: 1 },
  last: { year: 2036, month: 1 },
  /** Stage artifacts the chain was composed from (workflow runs), in time order; the state files are reproduced from them. */
  segments: ["43414242499 (1980-01 .. 2019-01, backward, free start)", "43307881914 (2019-01 .. 2036-01)"],
  /** Months print D shows with the wrong cells below (February, Sunday, 28 days: the red 29 at row 7, column 1). */
  bestEffort: ["1981-02", "1987-02", "1998-02", "2009-02", "2015-02", "2026-02"],
  wrong: [[7, 1]],
  text: "29",
  ink: "red",
};
const RESEARCH_INPUTS = { layout: `${CHAIN.printDir}layout.tsv`, printing: `${CHAIN.printDir}printing.tsv` };
const CHAIN_FILES = ["chain.moves.tsv", "months.tsv", "best-effort.tsv", "VERIFIED.txt", "julia.tsv", "flix.tsv", "independent.tsv", "provenance.tsv", "states.sha256"];
const stateName = (k) => `state-${String(k + 1).padStart(2, "0")}.tsv`;
/** Digests of the sources (content digests of the research PR #470 evidence). */
export const PINNED = {
  layout: "e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a",
  printing: "48ff9c8bc60c10908762573c02429fc258c1afc54b431c8c5e3049f11b4b475c",
  "chain.moves.tsv": "399de6a13e21dd6e182fee0ae52964cc07826f32050d9718a134d0c627d47e46",
  "months.tsv": "e2fa147790d411eec602feba82ef41efefa07e35d5b5799467beda63ca7f1484",
  "best-effort.tsv": "2ffff92dbfc36f0a9ac677bd078e239241b5cf827453221e2e928e60f9e097c6",
  "VERIFIED.txt": "6f0636a344fe30e5b06b1a2a348f3b38d827fe3ed0ca49befa33caa5582c05ba",
  // julia.tsv and flix.tsv are byte-identical: both checkers wrote the same receipt.
  "julia.tsv": "5d2fc89c11bdb3b8cf130d3652bb66111c6dbc6a1a92bb2c2bf33ffe09d98872",
  "flix.tsv": "5d2fc89c11bdb3b8cf130d3652bb66111c6dbc6a1a92bb2c2bf33ffe09d98872",
  "independent.tsv": "fc5556f19717db71f0927c27abaf9ce7e549e167e0c6e8e886690847b63fe35f",
  "provenance.tsv": "76a08710f87db4747d42483dc761d5ca40b8bd7ab50bd3bbca18e7834dbe9e60",
  /** SHA-256 of states.sha256: the 673 lines `<sha256>  states/state-NN.tsv` (the digests of the snapshots, header included). */
  "states.sha256": "56d0daa860ee8892c0713daa34118482c92cfabb36e3cc5241e6c0e5b71b5be4",
};
export const FIRST = CHAIN.first;
export const LAST = CHAIN.last;
export const STATES = (LAST.year - FIRST.year) * 12 + LAST.month - FIRST.month + 1;
/** The best-effort months with the wrong cells and the text shown there. */
export const BEST_EFFORT = CHAIN.bestEffort.map((s) => ({ year: Number(s.slice(0, 4)), month: Number(s.slice(5)), wrong: CHAIN.wrong, text: CHAIN.text, ink: CHAIN.ink }));
const STATUS = "research candidate, not certified, not for release";
const TITLE = "Names (long chain, print D, January 1980 - January 2036)";
const LICENSE =
  "Created by Werner Stein with AI assistance (Codex and Claude, OpenAI and Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.";

const lines = (text, what) => {
  if (!text.endsWith("\n") || text.includes("\r")) throw Error(`${what}: not strict LF text`);
  return text.slice(0, -1).split("\n");
};
const serialize = (header, arrays) => {
  const head = Object.entries(header)
    .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
    .join(",\n");
  const body = Object.entries(arrays)
    .map(([k, items]) => `${JSON.stringify(k)}:[\n${items.map((v) => "  " + JSON.stringify(v)).join(",\n")}\n]`)
    .join(",\n");
  return `{\n${head},\n${body}\n}\n`;
};
const month = (k) => {
  const index = FIRST.month - 1 + k;
  return { year: FIRST.year + Math.floor(index / 12), month: (index % 12) + 1 };
};
const ymKey = (m) => `${m.year}-${String(m.month).padStart(2, "0")}`;

const BEST_KEYS = new Set(CHAIN.bestEffort);

/** `options.testOnlySkipDigestPins` skips the pinned digests so that tests reach the checks behind them. */
export function build(statesDir, researchRoot, options = {}) {
  const pins = !options.testOnlySkipDigestPins;
  const raw = {};
  for (const [name, rel] of Object.entries(RESEARCH_INPUTS)) {
    raw[name] = readFileSync(join(researchRoot, rel));
    if (pins && sha256(raw[name]) !== PINNED[name]) throw Error(`${rel}: digest differs from the pin`);
  }
  for (const name of CHAIN_FILES) {
    raw[name] = readFileSync(join(researchRoot, CHAIN.chainDir, name));
    if (pins && sha256(raw[name]) !== PINNED[name]) throw Error(`${name}: digest differs from the pin`);
  }
  if (!raw["julia.tsv"].equals(raw["flix.tsv"])) throw Error("julia.tsv and flix.tsv differ");
  // The state manifest of the research evidence lists every snapshot; the snapshots reproduced by root_change.jl must match it.
  const manifest = lines(raw["states.sha256"].toString("utf8"), "states.sha256");
  if (manifest.length !== STATES) throw Error(`states.sha256 lists ${manifest.length} snapshots, ${STATES} required`);
  const snapshots = Array.from({ length: STATES }, (_, k) => readFileSync(join(statesDir, "states", stateName(k))));
  snapshots.forEach((b, k) => { if (manifest[k] !== `${sha256(b)}  states/${stateName(k)}`) throw Error(`${stateName(k)} differs from states.sha256`); });

  const verified = Object.fromEntries(lines(raw["VERIFIED.txt"].toString("utf8"), "VERIFIED.txt").map((l) => l.split(/=(.*)/s).slice(0, 2)));
  if (verified.print_d_sha256 !== PINNED.printing || verified.layout_sha256 !== PINNED.layout || verified.chain_sha256 !== PINNED["chain.moves.tsv"] || verified.months_sha256 !== PINNED["months.tsv"] ||
      !verified.chain.startsWith(`${ymKey(FIRST)} .. ${ymKey(LAST)} (${STATES} months, ${STATES - 1} edges)`) || verified.best_effort_edges?.split(" ")[0] !== String(CHAIN.bestEffort.length))
    throw Error("VERIFIED.txt does not state the complete chain on print D");

  const layout = parseLayout(raw.layout.toString("utf8"));
  const print = parsePrint(raw.printing.toString("utf8"));
  const chain = parseChain(raw["chain.moves.tsv"].toString("utf8"));
  if (chain.edges.length !== STATES - 1) throw Error(`${STATES} states and ${STATES - 1} edges required`);
  if (chain.source.year !== FIRST.year || chain.source.month !== FIRST.month) throw Error(`chain must start in ${ymKey(FIRST)}`);

  // months.tsv: one month per line, consecutive from the first month. best-effort.tsv: the months of the wrong cells.
  const monthRows = lines(raw["months.tsv"].toString("utf8"), "months.tsv");
  if (monthRows.length !== STATES) throw Error("months.tsv: row count");
  monthRows.forEach((row, k) => { if (row !== ymKey(month(k))) throw Error(`months.tsv row ${k + 1}: month out of order`); });
  const bestRows = lines(raw["best-effort.tsv"].toString("utf8"), "best-effort.tsv");
  const wrongText = CHAIN.wrong.map(([r, c]) => `${r},${c}`).join(";");
  if (bestRows[0] !== "month\tstatus\twrong_cells\tevidence" || JSON.stringify(bestRows.slice(1).map((r) => r.split("\t").slice(0, 3).join("\t"))) !== JSON.stringify(CHAIN.bestEffort.map((m) => `${m}\tbest_effort_unverified\t${wrongText}`)))
    throw Error("best-effort.tsv: exactly the six February months must be best effort");

  const snapshot = (k) => {
    const text = snapshots[k].toString("utf8");
    const nl = text.indexOf("\n") + 1;
    if (text.slice(0, nl) !== "sticker\tpiece\tposition\tnormal\tup\ttext\tink\n") throw Error(`${stateName(k)}: header`);
    return text.slice(nl);
  };
  const rootRaw = snapshot(0);
  const root = parseRoot(rootRaw);
  if (sha256(rootRaw) !== chain.source.hash) throw Error("root snapshot does not hash to the chain source hash");
  root.forEach((s, i) => {
    const p = print[i];
    if (s.piece !== p.piece || s.text !== p.text || s.ink !== p.ink) throw Error(`root sticker ${i + 1} differs from the print`);
    if (!INKS_WITH_BAND.includes(s.ink)) throw Error(`unknown ink ${s.ink}`);
  });
  const printing = { piece: root.map((s) => s.piece), text: root.map((s) => s.text), ink: root.map((s) => s.ink) };
  const pose = {
    pos: Int8Array.from(root.flatMap((s) => s.p)),
    normal: Int8Array.from(root.flatMap((s) => s.n)),
    up: Int8Array.from(root.flatMap((s) => s.up)),
  };

  const displays = Array.from({ length: STATES }, (_, k) => ({ id: k + 1, ...month(k), cells: windowCells(layout, month(k).year, month(k).month) }));
  const nodes = [{ hash: chain.source.hash, display: 1, ...month(0) }];
  const edges = [];
  let state = pose;
  const front = (k) => {
    const miss = frontFailures(printing, state, displays[k].cells);
    const best = BEST_KEYS.has(ymKey(month(k)));
    if (!best && miss.length) throw Error(`state ${k + 1}: front differs from its display at ${miss[0].row},${miss[0].column} (${miss[0].why})`);
    if (best) {
      if (miss.map((m) => `${m.row},${m.column}`).join(" ") !== CHAIN.wrong.map(([r, c]) => `${r},${c}`).join(" ")) throw Error(`state ${k + 1}: the best-effort month must differ in exactly the cell ${CHAIN.wrong}`);
      const i = miss[0].sticker - 1;
      if (print[i].text !== CHAIN.text || print[i].ink !== CHAIN.ink) throw Error("the wrong cell must show the red 29");
    }
  };
  front(0);
  chain.edges.forEach((e, i) => {
    const m = month(i + 1);
    if (e.year !== m.year || e.month !== m.month) throw Error(`edge ${i + 1}: month out of order`);
    if (e.sourceHash !== nodes[i].hash) throw Error(`edge ${i + 1}: source hash is not the previous end hash`);
    const got = metrics(e.moves);
    if (got.htm !== e.htm || got.qtm !== e.qtm || got.rot !== e.rot || got.rotq !== e.rotq) throw Error(`edge ${i + 1}: declared metrics differ from the words`);
    state = applyMoves(state, e.moves);
    if (stateDigest(printing, state) !== e.endHash) throw Error(`edge ${i + 1}: replay does not reach the stored end hash`);
    if (stateText(printing, state) !== snapshot(i + 1)) throw Error(`edge ${i + 1}: replay differs from ${stateName(i + 1)}`);
    front(i + 1);
    nodes.push({ hash: e.endHash, display: i + 2, ...m });
    edges.push({ from: i, to: i + 1, metrics: [e.htm, e.qtm, e.rot, e.rotq], moves: encodeMoves(e.moves) });
  });
  // The chain file itself records the best-effort edges: the cells that differ (wrong) and the Hall violation (hall).
  const flaggedEdges = chain.edges.flatMap((e, i) => (e.wrong ? [i] : []));
  if (JSON.stringify(flaggedEdges.map((i) => ymKey(month(i + 1)))) !== JSON.stringify(CHAIN.bestEffort) || flaggedEdges.some((i) => JSON.stringify(chain.edges[i].wrong) !== JSON.stringify(CHAIN.wrong)))
    throw Error("chain.moves.tsv: exactly the six February edges must carry the wrong cell 7,1");

  const files = {
    "state.v1.json": serialize(
      {
        schema: "cubistry.calendar7.state",
        version: 1,
        status: STATUS,
        print: `${TITLE}; names layout, print D (print C relabeled to the root January 1980; printing-C1980 with the April tiles AP and RIL), ink classes band and blank, English only`,
        surface: "face",
        license: LICENSE,
        spdx: "CC-BY-SA-4.0",
        root: { display: 1, year: FIRST.year, month: FIRST.month, hash: chain.source.hash },
      },
      { stickers: root.map((s) => ({ id: s.id, piece: s.piece, text: s.text, ink: s.ink, p: s.p, n: s.n, up: s.up })) },
    ),
    "graph.v1.json": serialize(
      {
        schema: "cubistry.calendar7.graph",
        version: 1,
        status: STATUS,
        license: LICENSE,
        spdx: "CC-BY-SA-4.0",
        alphabet: MOVE_ALPHABET,
        encoding: "one character per move: index = (generator - 1) * 3 + {1: 0, -1: 1, 2: 2}",
      },
      { nodes, edges },
    ),
    "displays.v1.json": serialize(
      {
        schema: "cubistry.calendar7.displays",
        version: 1,
        status: STATUS,
        license: LICENSE,
        spdx: "CC-BY-SA-4.0",
        inks: INKS_WITH_BAND,
        cell: "ink:text",
        firstYear: FIRST.year,
        firstMonth: FIRST.month,
        months: displays.map((d) => d.id),
      },
      { displays: displays.map((d) => ({ id: d.id, year: d.year, month: d.month, cells: d.cells.map((c) => `${c.ink}:${c.text}`) })) },
    ),
    "best-effort.v1.json": serialize(
      {
        schema: BEST_EFFORT_SCHEMA,
        version: 1,
        status: STATUS,
        license: LICENSE,
        spdx: "CC-BY-SA-4.0",
        wrong: "[row, column], 1-based, row-major: the front cells that differ from the display of the month (the fewest the print allows); the red digit shown there is the sticker text",
        evidence: "best-effort.tsv of the research evidence chain-1980-2036: February, Sunday, 28 days (the edge is replay-checked here; the Julia and Flix chain checkers report these edges as best effort, not as confirmed exact edges)",
      },
      { months: BEST_EFFORT.map((b) => ({ year: b.year, month: b.month, wrong: b.wrong, text: b.text, ink: b.ink })) },
    ),
  };
  files["NOTICE.txt"] =
    `${TITLE}\n` +
    `Long chain from the solved cube (January 1980, "Magic Date") to January 2036: ${STATES} states, ${STATES - 1} edges, ${edges.reduce((a, e) => a + e.metrics[0], 0)} HTM, ${edges.reduce((a, e) => a + e.metrics[1], 0)} QTM. Six best-effort months (${CHAIN.bestEffort.join(", ")}): the front differs from its display in row 7, column 1 (the red 29).\n` +
    `Status: ${STATUS}. Print D (print C relabeled to the root January 1980) is not frozen. The best-effort edges are not confirmed as exact by the checkers. No shortest-route, global-print or build-certification claim.\n` +
    `${LICENSE}\n\nSPDX-License-Identifier: CC-BY-SA-4.0\n\n` +
    `Source: research/calendar-7x7/row1-window-chain evidence/print-d and evidence/chain-1980-2036 (${CHAIN.source}); stage artifacts of workflow runs ${CHAIN.segments.join("; ")}.\n` +
    `Regenerate with scripts/export-calendar7-chain-c.mjs. The shipped files public/calendar7/names/*, names-demo/*, state.v1.json, graph.v1.json and displays.v1.json are not changed by this folder.\n`;
  const hashes = (names) => names.map((n) => `${sha256(files[n])}  ${n}\n`).join("");
  files["manifest.sha256"] = hashes(["NOTICE.txt", "best-effort.v1.json", "displays.v1.json", "graph.v1.json", "state.v1.json"]);
  files["source.sha256"] =
    Object.entries(RESEARCH_INPUTS).map(([name, rel]) => `${sha256(raw[name])}  ${rel}\n`).join("") +
    CHAIN_FILES.map((n) => `${sha256(raw[n])}  ${CHAIN.chainDir}${n}\n`).join("") +
    manifest.map((l) => l + "\n").join("");
  return files;
}

/** Check the committed folder: manifest, source digests against the pins, app parsers, replay; optionally against the sources. */
export function check(dir, statesDir, researchRoot) {
  const text = (n) => readFileSync(join(dir, n), "utf8");
  for (const line of lines(text("manifest.sha256"), "manifest")) {
    const [digest, name] = line.split("  ");
    if (sha256(readFileSync(join(dir, name))) !== digest) throw Error(`${name} does not match manifest.sha256`);
  }
  const src = new Map(lines(text("source.sha256"), "source.sha256").map((l) => { const [d, n] = l.split("  "); return [n, d]; }));
  if (src.size !== 2 + CHAIN_FILES.length + STATES) throw Error("source.sha256 has the wrong number of entries");
  for (const [name, rel] of Object.entries(RESEARCH_INPUTS)) if (src.get(rel) !== PINNED[name]) throw Error(`source.sha256 differs from the pin of ${name}`);
  for (const name of CHAIN_FILES) if (src.get(`${CHAIN.chainDir}${name}`) !== PINNED[name]) throw Error(`source.sha256 differs from the pin of ${name}`);
  const states = Array.from({ length: STATES }, (_, k) => `${src.get(`states/${stateName(k)}`)}  states/${stateName(k)}\n`).join("");
  if (sha256(states) !== PINNED["states.sha256"]) throw Error("source.sha256 differs from the pin of the state snapshots");
  const start = parseState(JSON.parse(text("state.v1.json")));
  if (start.surface !== "face") throw Error('state surface must be "face"');
  const table = parseDisplays(JSON.parse(text("displays.v1.json")));
  const graph = parseGraph(JSON.parse(text("graph.v1.json")));
  const best = parseBestEffort(JSON.parse(text("best-effort.v1.json")));
  if (JSON.stringify(best) !== JSON.stringify(BEST_EFFORT.map((b) => ({ year: b.year, month: b.month, wrong: b.wrong })))) throw Error("best-effort.v1.json names other months or cells");
  const result = verifyChain(start.printing, start.pose, table, graph, best);
  if (graph.nodes.length !== STATES || result.edges.length !== STATES - 1) throw Error(`${STATES} nodes and ${STATES - 1} edges required`);
  const sum = graph.edges.reduce((a, e) => [a[0] + e.htm, a[1] + e.qtm, a[2] + e.rot], [0, 0, 0]);
  if (statesDir && researchRoot) for (const [name, body] of Object.entries(build(statesDir, researchRoot))) if (text(name) !== body) throw Error(`${name} differs from the export`);
  console.log(`calendar7 chain C data OK (${graph.nodes.length} states, ${graph.edges.length} edges, ${sum[0]} HTM, ${sum[1]} QTM, ${sum[2]} rotations)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = fileURLToPath(new URL("../public/calendar7/chain-c", import.meta.url));
  if (args[0] === "--check") check(dir, args[1], args[2]);
  else {
    const o = args.indexOf("--out");
    const out = o >= 0 ? args[o + 1] : dir;
    const rest = o >= 0 ? args.filter((_, i) => i !== o && i !== o + 1) : args;
    if (rest.length !== 2 || !out) throw Error("usage: export-calendar7-chain-c.mjs <states-dir> <research-root> [--out <dir>] | --check [<states-dir> <research-root>]");
    const files = build(rest[0], rest[1], {});
    mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(out, name), text);
      console.log("Wrote", join(out, name), sha256(text));
    }
  }
}
