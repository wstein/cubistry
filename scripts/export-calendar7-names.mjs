// SPDX-License-Identifier: AGPL-3.0-or-later
// Export the Calendar7 "names layout" window data (May 2026 to January 2028, English only; research
// candidate, not certified) from the research folders row1-revision, row1-window-print and
// row1-window-chain into the app's v1 data format. Node standard library plus the app's own engine.
//
//   node scripts/export-calendar7-names.mjs <research-root> [--out public/calendar7/names]
//   node scripts/export-calendar7-names.mjs --check [<research-root>]
//       Without research files: manifest digests, app parsers and a full replay of the committed files
//       (npm run verify:calendar7-names). With <research-root>: also regenerate and compare byte for byte.
//
// <research-root> is a checkout (or archive) of research/cube-display-feasibility that contains
// research/calendar-7x7/. The script reads:
//   row1-revision/layout.tsv                        the owner's month-name table
//   row1-window-print/evidence/printing.tsv         the fixed print (294 surfaces)
//   row1-window-chain/evidence/moves.tsv            the 20 edges with moves and state hashes
//   row1-window-chain/evidence/states/state-NN.tsv and states.sha256   the 21 state snapshots
// and writes state.v1.json, graph.v1.json, displays.v1.json, NOTICE.txt, manifest.sha256 and
// research-inputs.sha256 (new folder, new files only; the shipped scheme A files are never touched).
// It stops on any mismatch: input digests, snapshots against the replay of the stored words, declared
// metrics, and the front of every state against its display sheet. The output is byte-deterministic.
// The digest pin stops any changed input first, so the later checks are defence in depth on the command line;
// build(root, { testOnlySkipDigestPins: true }) reaches each of them in tests/calendar7-names-data.test.mjs.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INKS_WITH_BAND, frontFailure, monthCells } from "../src/apps/calendar7/display.ts";
import { MOVE_ALPHABET, encodeMoves, parseDisplays, parseGraph, parseState, verifyChain } from "../src/apps/calendar7/graph.ts";
import { applyMoves, metrics, stateDigest, stateText } from "../src/apps/calendar7/engine.ts";
import { parseChain, parsePrint, parseRoot } from "./prepare-calendar7.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ROOT = "research/calendar-7x7/";
const INPUTS = {
  layout: `${ROOT}row1-revision/layout.tsv`,
  printing: `${ROOT}row1-window-print/evidence/printing.tsv`,
  moves: `${ROOT}row1-window-chain/evidence/moves.tsv`,
  manifest: `${ROOT}row1-window-chain/evidence/states.sha256`,
};
/** Digests recorded in research/calendar-7x7/row1-window-chain/experiment.json (research cc50eba). */
const PINNED = {
  layout: "c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db",
  printing: "0cb44a28c4bf84c25616fc248f9565df2e49e41feb479225e43166b1b8a2d127",
  moves: "7db8c8a1073f79e73f1e59ab953e25fc47342d5659d5058d8ae9cf5eb8bbe1db",
  manifest: "c1adcfff7488d3bcfb08dd2161cc3ba6158333fbe1e7fd1ea75805b65058679d",
};
const FIRST = { year: 2026, month: 5 };
const STATES = 21;
const STATUS = "research candidate, not certified";
const WINDOW = "May 2026 to January 2028";
const LICENSE =
  "Created by Werner Stein with AI assistance (Codex, OpenAI). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.";

const lines = (text, what) => {
  if (!text.endsWith("\n") || text.includes("\r")) throw Error(`${what}: not strict LF text`);
  return text.slice(0, -1).split("\n");
};

/** layout.tsv: header, 12 rows `month col1..col7`; the empty cells of row 1 are band tiles. */
export function parseLayout(text) {
  const rows = lines(text, "layout");
  if (rows[0] !== "month\tcol1\tcol2\tcol3\tcol4\tcol5\tcol6\tcol7") throw Error("layout header");
  if (rows.length !== 13) throw Error("layout needs 12 month rows");
  return rows.slice(1).map((line, i) => {
    const f = line.split("\t");
    if (f.length !== 8 || f[0] !== String(i + 1)) throw Error(`layout row ${i + 1}`);
    if (f.slice(4).some((x) => x !== "")) throw Error(`layout row ${i + 1}: columns 4 to 7 must stay empty`);
    const labels = f.slice(1, 4);
    if (!/^[A-Z]+$/.test(labels[0]) || labels.some((x) => x !== "" && !/^[A-Z]+$/.test(x))) throw Error(`layout row ${i + 1}: labels`);
    return labels.concat(["", "", "", ""]);
  });
}

/** The 49 cells of one window month: names (ink month) and band tiles in row 1, then the app's calendar rows. */
export function windowCells(layout, year, month) {
  const row1 = layout[month - 1].map((text) => ({ text, ink: text === "" ? "band" : "month" }));
  return row1.concat(monthCells(year, month).slice(7));
}

const inputsText = () =>
  Object.entries(INPUTS)
    .map(([name, rel]) => `${PINNED[name]}  ${rel}\n`)
    .join("");

const serialize = (header, arrays) => {
  const head = Object.entries(header)
    .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
    .join(",\n");
  const body = Object.entries(arrays)
    .map(([k, items]) => `${JSON.stringify(k)}:[\n${items.map((v) => "  " + JSON.stringify(v)).join(",\n")}\n]`)
    .join(",\n");
  return `{\n${head},\n${body}\n}\n`;
};

/**
 * `options.testOnlySkipDigestPins` skips the pinned input digests so that tests can reach the checks behind
 * them (declared metrics, snapshots, front). The command line never sets it.
 */
export function build(researchRoot, options = {}) {
  const read = (rel) => readFileSync(join(researchRoot, rel));
  const raw = {};
  for (const [name, rel] of Object.entries(INPUTS)) {
    raw[name] = read(rel);
    if (!options.testOnlySkipDigestPins && sha256(raw[name]) !== PINNED[name]) throw Error(`${rel}: digest differs from experiment.json`);
  }
  const layout = parseLayout(raw.layout.toString("utf8"));
  const print = parsePrint(raw.printing.toString("utf8"));
  const chain = parseChain(raw.moves.toString("utf8"));
  const manifest = new Map(
    lines(raw.manifest.toString("utf8"), "states.sha256").map((l) => {
      const m = /^([0-9a-f]{64}) {2}(state-\d\d\.tsv)$/.exec(l);
      if (!m) throw Error(`states.sha256 line ${l}`);
      return [m[2], m[1]];
    }),
  );
  if (manifest.size !== STATES || chain.edges.length !== STATES - 1) throw Error("21 states and 20 edges required");
  if (chain.source.year !== FIRST.year || chain.source.month !== FIRST.month) throw Error("chain must start in May 2026");

  // The 21 snapshots: file digest, parse, and the replay of the stored words must reproduce each one.
  const snapshot = (k) => {
    const name = `state-${String(k + 1).padStart(2, "0")}.tsv`;
    const bytes = read(`${ROOT}row1-window-chain/evidence/states/${name}`);
    if (sha256(bytes) !== manifest.get(name)) throw Error(`${name}: digest differs from states.sha256`);
    const text = bytes.toString("utf8");
    const nl = text.indexOf("\n") + 1;
    if (text.slice(0, nl) !== "sticker\tpiece\tposition\tnormal\tup\ttext\tink\n") throw Error(`${name}: header`);
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

  const month = (k) => {
    const index = FIRST.month - 1 + k;
    return { year: FIRST.year + Math.floor(index / 12), month: (index % 12) + 1 };
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
    if (stateText(printing, state) !== snapshot(i + 1)) throw Error(`edge ${i + 1}: replay differs from state-${i + 2}.tsv`);
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
        print: `names layout, window ${WINDOW}, ink classes band and blank, English only`,
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
    `English 7x7 calendar cube, names layout data (${STATUS})\n` +
    `Window ${WINDOW} only (21 months, 20 edges). English only. The app mode that reads this folder, with scheme A as the planned fallback outside the window, is a later change.\n` +
    `Status: ${STATUS}. No shortest-route, global-print or build-certification claim.\n` +
    `${LICENSE}\n\nSPDX-License-Identifier: CC-BY-SA-4.0\n\n` +
    `Source: research/calendar-7x7/row1-revision, row1-window-print and row1-window-chain on research/cube-display-feasibility\n` +
    `(research commit cc50ebaad0e0fe66d654121a67088f3d6c78c6a8). Regenerate with scripts/export-calendar7-names.mjs.\n` +
    `The files are a work separate from the Cubistry program code (AGPL-3.0-or-later). The shipped files\n` +
    `public/calendar7/state.v1.json, graph.v1.json and displays.v1.json are not changed by this folder.\n`;
  const hashes = (names) => names.map((n) => `${sha256(files[n])}  ${n}\n`).join("");
  files["manifest.sha256"] = hashes(["NOTICE.txt", "displays.v1.json", "graph.v1.json", "state.v1.json"]);
  files["research-inputs.sha256"] = inputsText();
  return files;
}

/** Check the committed folder: manifest, app parsers, replay with totals; optionally against the research files. */
export function check(dir, researchRoot) {
  const text = (n) => readFileSync(join(dir, n), "utf8");
  for (const line of lines(text("manifest.sha256"), "manifest")) {
    const [digest, name] = line.split("  ");
    if (sha256(readFileSync(join(dir, name))) !== digest) throw Error(`${name} does not match manifest.sha256`);
  }
  if (text("research-inputs.sha256") !== inputsText()) throw Error("research-inputs.sha256 differs from the pinned digests");
  const start = parseState(JSON.parse(text("state.v1.json")));
  if (start.surface !== "face") throw Error('state surface must be "face"');
  const table = parseDisplays(JSON.parse(text("displays.v1.json")));
  const graph = parseGraph(JSON.parse(text("graph.v1.json")));
  const result = verifyChain(start.printing, start.pose, table, graph);
  const sum = graph.edges.reduce((a, e) => [a[0] + e.htm, a[1] + e.qtm, a[2] + e.rot], [0, 0, 0]);
  if (graph.nodes.length !== 21 || result.edges.length !== 20 || sum.join() !== "7338,7514,368") throw Error(`totals differ: ${sum}`);
  if (researchRoot) for (const [name, body] of Object.entries(build(researchRoot))) if (text(name) !== body) throw Error(`${name} differs from the export`);
  console.log(`calendar7 names data OK (21 states, 20 edges, ${sum[0]} HTM, ${sum[1]} QTM, ${sum[2]} rotations)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = fileURLToPath(new URL("../public/calendar7/names", import.meta.url));
  if (args[0] === "--check") check(dir, args[1]);
  else {
    const o = args.indexOf("--out");
    const out = o >= 0 ? args[o + 1] : dir;
    const rest = o >= 0 ? args.filter((_, i) => i !== o && i !== o + 1) : args;
    if (rest.length !== 1 || !out) throw Error("usage: export-calendar7-names.mjs <research-root> [--out <dir>] | --check [<research-root>]");
    const files = build(rest[0]);
    mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(out, name), text);
      console.log("Wrote", join(out, name), sha256(text));
    }
  }
}
