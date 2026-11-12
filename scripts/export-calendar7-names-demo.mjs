// SPDX-License-Identifier: AGPL-3.0-or-later
// DEMO export: the Calendar7 names layout on the print window-2029-12 with the beam chain (May 2026 to June 2027).
// A demo of a non-final print for the owner; it does not replace public/calendar7/names (shipped names data) or its pins.
//
//   node scripts/export-calendar7-names-demo.mjs <research-root> [--out public/calendar7/names-demo]
//   node scripts/export-calendar7-names-demo.mjs --check [<research-root>]
//       Without research files: manifest digests, app parsers and a full replay of the committed demo files
//       (npm run verify:calendar7-names-demo). With <research-root>: also regenerate and compare byte for byte.
//
// <research-root> is a checkout (or archive) of the research branch feat/cal7-beam-chain-2026-06 (PR 411) that
// contains research/calendar-7x7/. The script reads, and recomputes nothing heavy:
//   row1-revision/layout.tsv                                          the owner's month-name table (same file as the shipped names data)
//   row1-window-chain/evidence/window-2029-12/printing.tsv            the print (44-month window)
//   row1-window-chain/evidence/window-2029-12/moves.tsv               the stored greedy chain: its first 6 edges are the prefix
//   row1-window-chain/evidence/beam-chain-2026-06/moves.tsv           13 edges: 6 greedy prefix edges, then the 7 beam edges Dec 2026 to Jun 2027
//   row1-window-chain/evidence/beam-chain-2026-06/states/state-NN.tsv 14 state snapshots
// and writes state.v1.json, graph.v1.json, displays.v1.json, NOTICE.txt, manifest.sha256 and research-inputs.sha256.
// It stops on any mismatch: input digests (pinned below for this demo only), the prefix against the stored greedy chain,
// declared metrics, replay of every word against its snapshot and end hash, and the front of every state against its display.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INKS_WITH_BAND, frontFailure } from "../src/apps/calendar7/display.ts";
import { MOVE_ALPHABET, encodeMoves, parseDisplays, parseGraph, parseState, verifyChain } from "../src/apps/calendar7/graph.ts";
import { applyMoves, metrics, stateDigest, stateText } from "../src/apps/calendar7/engine.ts";
import { parseChain, parsePrint, parseRoot } from "./prepare-calendar7.mjs";
import { parseLayout, windowCells } from "./export-calendar7-names.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const CHAIN = "research/calendar-7x7/row1-window-chain/evidence/";
const INPUTS = {
  layout: "research/calendar-7x7/row1-revision/layout.tsv",
  printing: `${CHAIN}window-2029-12/printing.tsv`,
  greedy: `${CHAIN}window-2029-12/moves.tsv`,
  moves: `${CHAIN}beam-chain-2026-06/moves.tsv`,
};
const STATE_DIR = `${CHAIN}beam-chain-2026-06/states/`;
/** Digests of the research inputs (PR 411, head 4cab1524cc3220c4b8d2a35474a54da325217f40). Demo pins only; the shipped names pins are untouched. */
export const PINNED = {
  layout: "c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db",
  printing: "73e8e6394167759d284c07ce010ce726f9f5aefa522792323cacc9c1bd7c1192",
  greedy: "8b5a97726b8509fa84b6a3dbed92e1f3c82d9fae625a58ad3161d4b97c0935a6",
  moves: "2baa8561d015748b174f709c49a8f4a48de73c0ba60930a1fe97847bfe91bfa3",
  /** SHA-256 of the 14 lines `<sha256>  state-NN.tsv` of the snapshots. */
  states: "e2ac3b81125c54736ce8b8c123e4690cb2b459156347d32ba7f69c1fb5cf073e",
};
const FIRST = { year: 2026, month: 5 };
const STATES = 14;
const GREEDY_EDGES = 6;
const STATUS = "DEMO, research candidate, not certified, not for release";
const TITLE = "Names (demo, beam chain, print window-2029-12, May 2026 - Jun 2027)";
const WINDOW = "May 2026 to June 2027";
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
const stateName = (k) => `state-${String(k + 1).padStart(2, "0")}.tsv`;
const month = (k) => {
  const index = FIRST.month - 1 + k;
  return { year: FIRST.year + Math.floor(index / 12), month: (index % 12) + 1 };
};

/** `options.testOnlySkipDigestPins` skips the pinned digests so that tests reach the checks behind them. */
export function build(researchRoot, options = {}) {
  const read = (rel) => readFileSync(join(researchRoot, rel));
  const raw = {};
  for (const [name, rel] of Object.entries(INPUTS)) {
    raw[name] = read(rel);
    if (!options.testOnlySkipDigestPins && sha256(raw[name]) !== PINNED[name]) throw Error(`${rel}: digest differs from the demo pin`);
  }
  const snapshots = Array.from({ length: STATES }, (_, k) => read(`${STATE_DIR}${stateName(k)}`));
  const statesManifest = snapshots.map((b, k) => `${sha256(b)}  ${stateName(k)}\n`).join("");
  if (!options.testOnlySkipDigestPins && sha256(statesManifest) !== PINNED.states) throw Error("state snapshots differ from the demo pin");

  const layout = parseLayout(raw.layout.toString("utf8"));
  const print = parsePrint(raw.printing.toString("utf8"));
  const chain = parseChain(raw.moves.toString("utf8"));
  const greedy = parseChain(raw.greedy.toString("utf8"));
  if (chain.edges.length !== STATES - 1) throw Error("14 states and 13 edges required");
  if (chain.source.year !== FIRST.year || chain.source.month !== FIRST.month) throw Error("chain must start in May 2026");
  // The first 6 edges are the stored greedy edges of the window-2029-12 chain, byte for byte.
  if (greedy.source.hash !== chain.source.hash) throw Error("beam chain and stored chain start at different roots");
  chain.edges.slice(0, GREEDY_EDGES).forEach((e, i) => {
    if (JSON.stringify(e) !== JSON.stringify(greedy.edges[i])) throw Error(`edge ${i + 1} differs from the stored window-2029-12 chain`);
  });

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
    const miss = frontFailure(printing, state, displays[k].cells);
    if (miss) throw Error(`state ${k + 1}: front differs from its display at ${miss.row},${miss.column} (${miss.why})`);
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

  const files = {
    "state.v1.json": serialize(
      {
        schema: "cubistry.calendar7.state",
        version: 1,
        status: STATUS,
        print: `${TITLE}; names layout, print window-2029-12, ink classes band and blank, English only`,
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
  };
  files["NOTICE.txt"] =
    `${TITLE}\n` +
    `DEMO of a non-final print for the owner, not meant for main. Window ${WINDOW} (14 months, 13 edges): 6 stored greedy edges (May to Nov 2026), then the 7 beam edges Dec 2026 to Jun 2027.\n` +
    `Status: ${STATUS}. No shortest-route, global-print or build-certification claim.\n` +
    `${LICENSE}\n\nSPDX-License-Identifier: CC-BY-SA-4.0\n\n` +
    `Source: research/calendar-7x7/row1-window-chain evidence window-2029-12 and beam-chain-2026-06 on feat/cal7-beam-chain-2026-06 (PR 411, head 4cab1524cc3220c4b8d2a35474a54da325217f40).\n` +
    `Regenerate with scripts/export-calendar7-names-demo.mjs. The shipped files public/calendar7/names/*, state.v1.json, graph.v1.json and displays.v1.json are not changed by this folder.\n`;
  const hashes = (names) => names.map((n) => `${sha256(files[n])}  ${n}\n`).join("");
  files["manifest.sha256"] = hashes(["NOTICE.txt", "displays.v1.json", "graph.v1.json", "state.v1.json"]);
  files["research-inputs.sha256"] = Object.entries(INPUTS).map(([name, rel]) => `${sha256(raw[name])}  ${rel}\n`).join("") + statesManifest.split("\n").filter(Boolean).map((l) => l.replace("  ", `  ${STATE_DIR}`) + "\n").join("");
  return files;
}

/** Check the committed demo folder: manifest, app parsers, replay with totals; optionally against the research files. */
export function check(dir, researchRoot) {
  const text = (n) => readFileSync(join(dir, n), "utf8");
  for (const line of lines(text("manifest.sha256"), "manifest")) {
    const [digest, name] = line.split("  ");
    if (sha256(readFileSync(join(dir, name))) !== digest) throw Error(`${name} does not match manifest.sha256`);
  }
  const pins = text("research-inputs.sha256");
  for (const name of ["layout", "printing", "greedy", "moves"]) if (!pins.includes(`${PINNED[name]}  ${INPUTS[name]}\n`)) throw Error(`research-inputs.sha256 differs from the demo pin of ${name}`);
  const start = parseState(JSON.parse(text("state.v1.json")));
  if (start.surface !== "face") throw Error('state surface must be "face"');
  const table = parseDisplays(JSON.parse(text("displays.v1.json")));
  const graph = parseGraph(JSON.parse(text("graph.v1.json")));
  const result = verifyChain(start.printing, start.pose, table, graph);
  const sum = graph.edges.reduce((a, e) => [a[0] + e.htm, a[1] + e.qtm, a[2] + e.rot], [0, 0, 0]);
  if (graph.nodes.length !== STATES || result.edges.length !== STATES - 1) throw Error("14 nodes and 13 edges required");
  if (graph.edges.slice(GREEDY_EDGES).map((e) => e.htm).join() !== "61,96,115,34,99,121,124") throw Error("beam edges differ from the committed evidence");
  if (researchRoot) for (const [name, body] of Object.entries(build(researchRoot))) if (text(name) !== body) throw Error(`${name} differs from the export`);
  console.log(`calendar7 names demo data OK (${graph.nodes.length} states, ${graph.edges.length} edges, ${sum[0]} HTM, ${sum[1]} QTM, ${sum[2]} rotations)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = fileURLToPath(new URL("../public/calendar7/names-demo", import.meta.url));
  if (args[0] === "--check") check(dir, args[1]);
  else {
    const o = args.indexOf("--out");
    const out = o >= 0 ? args[o + 1] : dir;
    const rest = o >= 0 ? args.filter((_, i) => i !== o && i !== o + 1) : args;
    if (rest.length !== 1 || !out) throw Error("usage: export-calendar7-names-demo.mjs <research-root> [--out <dir>] | --check [<research-root>]");
    const files = build(rest[0], {});
    mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(out, name), text);
      console.log("Wrote", join(out, name), sha256(text));
    }
  }
}
