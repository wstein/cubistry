// SPDX-License-Identifier: AGPL-3.0-or-later
// Export the verified Calendar7 long chain on Print C (January 2019 to January 2036, 205 states, 204 edges; research
// candidate, not certified) into the app's v1 data format, as a folder of its own: public/calendar7/chain-c.
// The shipped names data and the names demo are not touched.
//
//   node scripts/export-calendar7-chain-c.mjs <artifact-dir> <research-root> [--out public/calendar7/chain-c]
//   node scripts/export-calendar7-chain-c.mjs --check [<artifact-dir> <research-root>]
//       Without sources: manifest digests, source digests against the pins, app parsers and a full replay of the committed
//       files (npm run verify:calendar7-chain-c). With sources: also regenerate and compare byte for byte.
//
// <artifact-dir> is the unpacked chain artifact (workflow run 43307881914): edges.tsv, chain.moves.tsv, months.tsv,
// VERIFIED.txt, julia.tsv, flix.tsv, SHA256SUMS, states/state-NN.tsv. <research-root> is a checkout (or archive) of
// research/cube-display-feasibility at 549c07b0ee843d2e07eed2b71ad9b7418e965a8d; the script reads
// research/calendar-7x7/row1-window-chain/evidence/print-c/{layout,printing}.tsv.
//
// Format (documented in docs/CALENDAR7_CHAIN_C.md): the states are not stored one by one (205 snapshots are 2.9 MB). The
// root pose (state.v1.json) plus one move word per edge (graph.v1.json, 1 character per move) and the SHA-256 of every
// state (graph nodes) determine all of them by replay; the page replays them anyway.
//
// The script stops on any mismatch: input digests, the digest lines of the artifact's SHA256SUMS, month list, declared
// metrics, replay of every word against its snapshot and end hash, and the front of every state against its display.
// The one best-effort month must differ from its display in exactly the cell the research verdict names, and in no other.
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
const PRINT_C = "research/calendar-7x7/row1-window-chain/evidence/print-c/";
const RESEARCH_INPUTS = { layout: `${PRINT_C}layout.tsv`, printing: `${PRINT_C}printing.tsv` };
const ARTIFACT_INPUTS = ["chain.moves.tsv", "edges.tsv", "months.tsv", "VERIFIED.txt", "julia.tsv", "flix.tsv"];
const stateName = (k) => `state-${String(k + 1).padStart(2, "0")}.tsv`;
/** Digests of the sources: research ref 549c07b0ee843d2e07eed2b71ad9b7418e965a8d, workflow run 43307881914. */
export const PINNED = {
  layout: "e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a",
  printing: "0119ca3ba1266f9c3e4d7c27753801aca30eb4af514f491615666dcd9f92a8fc",
  "chain.moves.tsv": "b6cb3c525f12e8e2511cc04e5adc84e013e9f052ffd2ff8b454742ab44e5e2e6",
  "edges.tsv": "fde4a876d22fef628ea2fd8eed8171a30f9d210b6b79e987422ff06e4fe75cd0",
  "months.tsv": "91a3652a331bdbb908aa5145f2e4018ea1ff411e4a5f8c3276104dbbe6db1dd6",
  "VERIFIED.txt": "4cd55e320b60b5f16e126d4a693f328e31246a195356d95bca4598b589039afe",
  // julia.tsv and flix.tsv are byte-identical: both checkers wrote the same receipt.
  "julia.tsv": "37f190774f3367156941545603091db5a3b5886df1c68deba252075278931daf",
  "flix.tsv": "37f190774f3367156941545603091db5a3b5886df1c68deba252075278931daf",
  /** SHA-256 of the 205 lines `<sha256>  states/state-NN.tsv` (the digests of the snapshots, header included). */
  states: "c153a2d3df0fd46f0f0c71dce99a999e17cecc64f3b27a30488a2b51af090365",
};
export const FIRST = { year: 2019, month: 1 };
export const STATES = 205;
export const LAST = { year: 2036, month: 1 };
/** The one best-effort month: February 2026; the front differs in cell (row 7, column 1), which shows the red 29. */
export const BEST_EFFORT = { year: 2026, month: 2, wrong: [[7, 1]], text: "29", ink: "red", reason: "best_effort_edge_unconfirmed" };
const STATUS = "research candidate, not certified, not for release";
const TITLE = "Names (long chain, print C, January 2019 - January 2036)";
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

/** `options.testOnlySkipDigestPins` skips the pinned digests so that tests reach the checks behind them. */
export function build(artifactDir, researchRoot, options = {}) {
  const pins = !options.testOnlySkipDigestPins;
  const raw = {};
  for (const [name, rel] of Object.entries(RESEARCH_INPUTS)) {
    raw[name] = readFileSync(join(researchRoot, rel));
    if (pins && sha256(raw[name]) !== PINNED[name]) throw Error(`${rel}: digest differs from the pin`);
  }
  const artifact = (rel) => readFileSync(join(artifactDir, rel));
  for (const name of ARTIFACT_INPUTS) {
    raw[name] = artifact(name);
    if (pins && sha256(raw[name]) !== PINNED[name]) throw Error(`${name}: digest differs from the pin`);
  }
  if (!raw["julia.tsv"].equals(raw["flix.tsv"])) throw Error("julia.tsv and flix.tsv differ");
  const snapshots = Array.from({ length: STATES }, (_, k) => artifact(`states/${stateName(k)}`));
  const statesManifest = snapshots.map((b, k) => `${sha256(b)}  states/${stateName(k)}\n`).join("");
  if (pins && sha256(statesManifest) !== PINNED.states) throw Error("state snapshots differ from the pin");
  // The artifact's own SHA256SUMS must list exactly these digests.
  const sums = new Map(lines(artifact("SHA256SUMS").toString("utf8"), "SHA256SUMS").map((l) => { const [d, n] = l.split("  "); return [n.replace(/^\.\//, ""), d]; }));
  for (const name of ARTIFACT_INPUTS) if (sums.get(name) !== sha256(raw[name])) throw Error(`SHA256SUMS: ${name} differs`);
  snapshots.forEach((b, k) => { if (sums.get(`states/${stateName(k)}`) !== sha256(b)) throw Error(`SHA256SUMS: ${stateName(k)} differs`); });

  const verified = Object.fromEntries(lines(raw["VERIFIED.txt"].toString("utf8"), "VERIFIED.txt").map((l) => l.split(/=(.*)/s).slice(0, 2)));
  if (verified.complete !== "true" || verified.edges_total !== String(STATES - 1) || verified.chain_end !== ymKey(LAST) || verified.print_sha256 !== PINNED.printing || verified.layout_sha256 !== PINNED.layout || verified.best_effort_29 !== "true")
    throw Error("VERIFIED.txt does not state the complete long chain on print C");

  const layout = parseLayout(raw.layout.toString("utf8"));
  const print = parsePrint(raw.printing.toString("utf8"));
  const chain = parseChain(raw["chain.moves.tsv"].toString("utf8"));
  if (chain.edges.length !== STATES - 1) throw Error("205 states and 204 edges required");
  if (chain.source.year !== FIRST.year || chain.source.month !== FIRST.month) throw Error("chain must start in January 2019");

  // months.tsv: one row per month, all valid except the one best-effort month.
  const monthRows = lines(raw["months.tsv"].toString("utf8"), "months.tsv");
  if (monthRows[0] !== "month\tstatus\treason\tedge\tmethod\tevidence" || monthRows.length !== STATES + 1) throw Error("months.tsv: header or row count");
  const flagged = [];
  monthRows.slice(1).forEach((row, k) => {
    const f = row.split("\t");
    if (f[0] !== ymKey(month(k)) || f[3] !== String(k)) throw Error(`months.tsv row ${k + 1}: month or edge out of order`);
    if (f[1] !== "valid") flagged.push({ k, status: f[1], reason: f[2] });
  });
  if (flagged.length !== 1 || ymKey(month(flagged[0].k)) !== ymKey(BEST_EFFORT) || flagged[0].status !== "unknown" || flagged[0].reason !== BEST_EFFORT.reason)
    throw Error("months.tsv: exactly February 2026 must be best effort");

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
    const best = ymKey(month(k)) === ymKey(BEST_EFFORT);
    if (!best && miss.length) throw Error(`state ${k + 1}: front differs from its display at ${miss[0].row},${miss[0].column} (${miss[0].why})`);
    if (best) {
      if (miss.map((m) => `${m.row},${m.column}`).join(" ") !== BEST_EFFORT.wrong.map(([r, c]) => `${r},${c}`).join(" ")) throw Error(`state ${k + 1}: the best-effort month must differ in exactly the cell ${BEST_EFFORT.wrong}`);
      const i = miss[0].sticker - 1;
      if (print[i].text !== BEST_EFFORT.text || print[i].ink !== BEST_EFFORT.ink) throw Error("the wrong cell must show the red 29");
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
  // The chain file itself records the best-effort edge: the cells that differ (wrong) and the Hall violation (hall).
  const flaggedEdges = chain.edges.flatMap((e, i) => (e.wrong ? [i] : []));
  if (flaggedEdges.length !== 1 || ymKey(month(flaggedEdges[0] + 1)) !== ymKey(BEST_EFFORT) || JSON.stringify(chain.edges[flaggedEdges[0]].wrong) !== JSON.stringify(BEST_EFFORT.wrong))
    throw Error("chain.moves.tsv: exactly the February 2026 edge must carry the wrong cell 7,1");
  if (nodes.at(-1).hash !== lines(raw["edges.tsv"].toString("utf8"), "edges.tsv").at(-1).split("\t")[8]) throw Error("end hash differs from edges.tsv");

  const files = {
    "state.v1.json": serialize(
      {
        schema: "cubistry.calendar7.state",
        version: 1,
        status: STATUS,
        print: `${TITLE}; names layout, print C (printing-C1980 with the April tiles AP and RIL), ink classes band and blank, English only`,
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
        evidence: "months.tsv of the artifact: status unknown, reason best_effort_edge_unconfirmed (the edge is replay-checked here; the Julia and Flix chain checkers report it as best effort, not as a confirmed edge)",
      },
      { months: [{ year: BEST_EFFORT.year, month: BEST_EFFORT.month, wrong: BEST_EFFORT.wrong, text: BEST_EFFORT.text, ink: BEST_EFFORT.ink }] },
    ),
  };
  files["NOTICE.txt"] =
    `${TITLE}\n` +
    `Long chain from the solved cube (January 2019, "Magic Date") to January 2036: 205 states, 204 edges, ${edges.reduce((a, e) => a + e.metrics[0], 0)} HTM, ${edges.reduce((a, e) => a + e.metrics[1], 0)} QTM. One best-effort month, February 2026: the front differs from its display in row 7, column 1 (the red 29).\n` +
    `Status: ${STATUS}. Print C is not frozen. The best-effort edge is not confirmed by the checkers (months.tsv: unknown). No shortest-route, global-print or build-certification claim.\n` +
    `${LICENSE}\n\nSPDX-License-Identifier: CC-BY-SA-4.0\n\n` +
    `Source: research/calendar-7x7/row1-window-chain evidence/print-c on research/cube-display-feasibility (549c07b0ee843d2e07eed2b71ad9b7418e965a8d); chain artifact of workflow run 43307881914.\n` +
    `Regenerate with scripts/export-calendar7-chain-c.mjs. The shipped files public/calendar7/names/*, names-demo/*, state.v1.json, graph.v1.json and displays.v1.json are not changed by this folder.\n`;
  const hashes = (names) => names.map((n) => `${sha256(files[n])}  ${n}\n`).join("");
  files["manifest.sha256"] = hashes(["NOTICE.txt", "best-effort.v1.json", "displays.v1.json", "graph.v1.json", "state.v1.json"]);
  files["source.sha256"] =
    Object.entries(RESEARCH_INPUTS).map(([name, rel]) => `${sha256(raw[name])}  ${rel}\n`).join("") +
    ARTIFACT_INPUTS.map((n) => `${sha256(raw[n])}  artifact/${n}\n`).join("") +
    statesManifest.split("\n").filter(Boolean).map((l) => l.replace("  ", "  artifact/") + "\n").join("");
  return files;
}

/** Check the committed folder: manifest, source digests against the pins, app parsers, replay; optionally against the sources. */
export function check(dir, artifactDir, researchRoot) {
  const text = (n) => readFileSync(join(dir, n), "utf8");
  for (const line of lines(text("manifest.sha256"), "manifest")) {
    const [digest, name] = line.split("  ");
    if (sha256(readFileSync(join(dir, name))) !== digest) throw Error(`${name} does not match manifest.sha256`);
  }
  const src = new Map(lines(text("source.sha256"), "source.sha256").map((l) => { const [d, n] = l.split("  "); return [n, d]; }));
  if (src.size !== 2 + ARTIFACT_INPUTS.length + STATES) throw Error("source.sha256 has the wrong number of entries");
  for (const [name, rel] of Object.entries(RESEARCH_INPUTS)) if (src.get(rel) !== PINNED[name]) throw Error(`source.sha256 differs from the pin of ${name}`);
  for (const name of ARTIFACT_INPUTS) if (src.get(`artifact/${name}`) !== PINNED[name]) throw Error(`source.sha256 differs from the pin of ${name}`);
  const states = Array.from({ length: STATES }, (_, k) => `${src.get(`artifact/states/${stateName(k)}`)}  states/${stateName(k)}\n`).join("");
  if (sha256(states) !== PINNED.states) throw Error("source.sha256 differs from the pin of the state snapshots");
  const start = parseState(JSON.parse(text("state.v1.json")));
  if (start.surface !== "face") throw Error('state surface must be "face"');
  const table = parseDisplays(JSON.parse(text("displays.v1.json")));
  const graph = parseGraph(JSON.parse(text("graph.v1.json")));
  const best = parseBestEffort(JSON.parse(text("best-effort.v1.json")));
  if (JSON.stringify(best) !== JSON.stringify([{ year: BEST_EFFORT.year, month: BEST_EFFORT.month, wrong: BEST_EFFORT.wrong }])) throw Error("best-effort.v1.json names another month or cell");
  const result = verifyChain(start.printing, start.pose, table, graph, best);
  if (graph.nodes.length !== STATES || result.edges.length !== STATES - 1) throw Error("205 nodes and 204 edges required");
  const sum = graph.edges.reduce((a, e) => [a[0] + e.htm, a[1] + e.qtm, a[2] + e.rot], [0, 0, 0]);
  if (artifactDir && researchRoot) for (const [name, body] of Object.entries(build(artifactDir, researchRoot))) if (text(name) !== body) throw Error(`${name} differs from the export`);
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
    if (rest.length !== 2 || !out) throw Error("usage: export-calendar7-chain-c.mjs <artifact-dir> <research-root> [--out <dir>] | --check [<artifact-dir> <research-root>]");
    const files = build(rest[0], rest[1], {});
    mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(out, name), text);
      console.log("Wrote", join(out, name), sha256(text));
    }
  }
}
