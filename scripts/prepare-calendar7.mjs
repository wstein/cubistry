// SPDX-License-Identifier: AGPL-3.0-or-later
// Pin, convert and verify the English 7x7 calendar data (pure split, month-letter scheme A)
// from the research branch. Research candidate, not certified. No hand-edited data: the
// files under data/calendar7 are pinned research/artifact copies or Julia-derived data,
// and the scheme A files in public/calendar7 are derived from them by this script alone (the names folder is
// derived by scripts/export-calendar7-names.mjs).
//
//   node scripts/prepare-calendar7.mjs --check [--require-commit]
//       Verify the pinned copies and Julia exports (SHA-256), that the runtime files equal
//       the converter output, and, when the pinned research commit is available locally,
//       that every pinned research file is byte-identical to it.
//   node scripts/prepare-calendar7.mjs --pin <commit> [--branch <branch>]
//       Re-pin: fetch the commit if missing, copy the research files at that commit,
//       rewrite the hashes and derive the runtime files.
//   node scripts/prepare-calendar7.mjs
//       Regenerate the runtime files from the copies and update their hashes.
//
// The two Julia exports (data/calendar7/julia) come from scripts/calendar7/export-julia.jl,
// which calls the research code; see docs/CALENDAR_7X7.md for the command.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MOVE_ALPHABET, encodeMoves } from "../src/apps/calendar7/graph.ts";
import { INKS } from "../src/apps/calendar7/display.ts";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
export const PIN = "calendar7-source.json";
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const R = "research/calendar-7x7/pure-split-states/";
const CHAIN = "data/calendar7/research/strict/chain-2026-2099.moves.tsv";
const PRINT = "research/calendar-7x7/upright-feasibility/evidence/print-strict-upright.tsv";
/** Immutable strict research inputs; artifact outputs are pinned separately. */
export const RESEARCH_FILES = {
  [`${R}flix/src/Chain.flix`]: null,
  [`${R}flix/src/Main.flix`]: null,
  [`${R}flix/src/Stacked.flix`]: null,
  [PRINT]: "data/calendar7/research/strict/print-strict-upright.tsv",
  "research/calendar-7x7/upright-moves/evidence/moves-strict.tsv": "data/calendar7/research/strict/moves-strict.tsv",
  [`${R}evidence/dag-all.tsv.gz`]: null,
  [`${R}pure_chain.jl`]: null,
  [`${R}pure_common.jl`]: null,
  [`${R}stacked_common.jl`]: null,
  "research/calendar-7x7/upright-flix/rule_select.jl": null,
  "research/calendar-7x7/upright-beam/verify_chain.jl": null,
  "research/calendar-7x7/upright-moves/verify_moves.jl": null,
};
/** Julia exports (scripts/calendar7/export-julia.jl) and the script that makes them. */
export const JULIA = {
  root: "data/calendar7/julia/root-state.tsv",
  displays: "data/calendar7/julia/displays.tsv",
  script: "scripts/calendar7/export-julia.jl",
};
export const RUNTIME = {
  state: "public/calendar7/state.v1.json",
  graph: "public/calendar7/graph.v1.json",
  displays: "public/calendar7/displays.v1.json",
};

const git = (...args) => execFileSync("git", args, { cwd: path("."), maxBuffer: 1 << 28 });
const hasCommit = (commit) => {
  try {
    git("cat-file", "-e", `${commit}^{commit}`);
    return true;
  } catch {
    return false;
  }
};
const readText = (p) => readFileSync(path(p), "utf8");

/** Strict TSV lines: valid text, newline terminated, no CR. */
function lines(text, what) {
  if (!text.endsWith("\n") || text.includes("\r")) throw Error(`${what}: not strict LF text`);
  return text.slice(0, -1).split("\n");
}
const int = (s, what) => {
  if (!/^(0|-?[1-9][0-9]*)$/.test(s)) throw Error(`${what}: noncanonical integer ${s}`);
  return Number(s);
};
const vec = (s, what) => {
  const v = s.split(",").map((x) => int(x, what));
  if (v.length !== 3) throw Error(`${what}: needs three components`);
  return v;
};

/** The printing: id, piece, text, ink per sticker. */
export function parsePrint(text) {
  const rows = lines(text, "print");
  if (rows[0] !== "sticker\tpiece\thome\tnormal\tup\ttext\tink") throw Error("print header");
  return rows.slice(1).map((line, i) => {
    const f = line.split("\t");
    if (f.length !== 7 || int(f[0], "sticker") !== i + 1) throw Error(`print row ${i + 1}`);
    return { id: i + 1, piece: int(f[1], "piece"), text: f[5], ink: f[6] };
  });
}
/** The root pose snapshot; each line is the research state-digest preimage line. */
export function parseRoot(text) {
  return lines(text, "root-state").map((line, i) => {
    const f = line.split("\t");
    if (f.length !== 7 || int(f[0], "id") !== i + 1) throw Error(`root-state row ${i + 1}`);
    return { id: i + 1, piece: int(f[1], "piece"), p: vec(f[2], "p"), n: vec(f[3], "n"), up: vec(f[4], "up"), text: f[5], ink: f[6] };
  });
}
/** Julia displays.tsv: 91 display rows and the 888 month rows. */
export function parseDisplaysTsv(text) {
  const rows = lines(text, "displays");
  if (rows[0] !== "cubistry.calendar7.displays.v1") throw Error("displays header");
  const displays = [],
    months = [];
  for (const line of rows.slice(1)) {
    const f = line.split("\t");
    if (f[0] === "display") {
      if (f.length !== 4 + 49 || int(f[1], "id") !== displays.length + 1) throw Error("display row");
      displays.push({ id: displays.length + 1, year: int(f[2], "year"), month: int(f[3], "month"), cells: f.slice(4) });
    } else if (f[0] === "month") {
      const index = months.length;
      if (f.length !== 4 || int(f[1], "year") !== 2026 + Math.floor(index / 12) || int(f[2], "month") !== (index % 12) + 1)
        throw Error("month row out of order");
      months.push(int(f[3], "display"));
    } else throw Error(`unknown displays record ${f[0]}`);
  }
  if (displays.length !== 91 || months.length !== 888) throw Error("91 displays and 888 months required");
  return { displays, months };
}
/** The research chain file (cubistry.calendar7.chain.v1). */
export function parseChain(text) {
  const rows = lines(text, "chain");
  if (rows[0] !== "cubistry.calendar7.chain.v1") throw Error("chain header");
  const f0 = rows[1].split("\t");
  if (f0.length !== 5 || f0[0] !== "source") throw Error("chain source line");
  const source = { root: int(f0[1], "root"), year: int(f0[2], "year"), month: int(f0[3], "month"), hash: f0[4] };
  const edges = [];
  let cursor = 2;
  while (rows[cursor] !== "finish") {
    const f = rows[cursor++].split("\t");
    if (f.length !== 9 || f[0] !== "edge") throw Error(`chain edge line ${cursor}`);
    const [year, month, htm, qtm, rot, rotq] = f.slice(1, 7).map((x) => int(x, "edge"));
    const moves = [];
    while (rows[cursor] !== "end") {
      const m = rows[cursor++].split("\t");
      if (m.length !== 3 || m[0] !== "move") throw Error(`chain move line ${cursor}`);
      moves.push([int(m[1], "g"), int(m[2], "q")]);
    }
    cursor++;
    edges.push({ year, month, htm, qtm, rot, rotq, sourceHash: f[7], endHash: f[8], moves });
  }
  if (cursor !== rows.length - 1) throw Error("chain trailing lines");
  return { source, edges };
}

const item = (value) => "  " + JSON.stringify(value);
/** JSON with one array element per line: reviewable diffs, stable bytes. */
function serialize(header, arrays) {
  const head = Object.entries(header)
    .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
    .join(",\n");
  const body = Object.entries(arrays)
    .map(([k, items]) => `${JSON.stringify(k)}:[\n${items.map(item).join(",\n")}\n]`)
    .join(",\n");
  return `{\n${head},\n${body}\n}\n`;
}

/** Derive the three runtime files from the pinned copies and Julia exports. */
export function build(pin) {
  const print = parsePrint(readText(pin.copies[PRINT]));
  const rootRaw = readText(JULIA.root);
  const root = parseRoot(rootRaw);
  const chain = parseChain(readText(CHAIN));
  const table = parseDisplaysTsv(readText(JULIA.displays));
  if (sha256(rootRaw) !== chain.source.hash) throw Error("root-state.tsv does not hash to the chain source hash");
  root.forEach((s, i) => {
    const p = print[i];
    if (s.piece !== p.piece || s.text !== p.text || s.ink !== p.ink) throw Error(`root sticker ${i + 1} differs from the print`);
    if (!INKS.includes(s.ink)) throw Error(`unknown ink ${s.ink}`);
  });
  const monthId = (y, m) => table.months[(y - 2026) * 12 + m - 1];
  if (monthId(chain.source.year, chain.source.month) !== chain.source.root) throw Error("chain root display differs from the display table");
  const nodes = [{ hash: chain.source.hash, display: chain.source.root, year: chain.source.year, month: chain.source.month }];
  const edges = [];
  chain.edges.forEach((e, i) => {
    if (e.sourceHash !== nodes[i].hash) throw Error(`chain edge ${i + 1}: source hash is not the previous end hash`);
    nodes.push({ hash: e.endHash, display: monthId(e.year, e.month), year: e.year, month: e.month });
    edges.push({ from: i, to: i + 1, metrics: [e.htm, e.qtm, e.rot, e.rotq], moves: encodeMoves(e.moves) });
  });
  const stateHeader = {
    schema: "cubistry.calendar7.state",
    version: 1,
    status: "research candidate, not certified",
    print: "strict upright, pure split, month-letter scheme A",
    license: pin.dataNotice,
    spdx: "CC-BY-SA-4.0",
    root: { display: chain.source.root, year: chain.source.year, month: chain.source.month, hash: chain.source.hash },
  };
  const state = serialize(stateHeader, { stickers: root.map((s) => ({ id: s.id, piece: s.piece, text: s.text, ink: s.ink, p: s.p, n: s.n, up: s.up })) });
  const graph = serialize(
    {
      schema: "cubistry.calendar7.graph",
      version: 1,
      status: "research candidate, not certified",
      license: pin.dataNotice,
      spdx: "CC-BY-SA-4.0",
      alphabet: MOVE_ALPHABET,
      encoding: "one character per move: index = (generator - 1) * 3 + {1: 0, -1: 1, 2: 2}",
    },
    { nodes, edges },
  );
  const displays = serialize(
    {
      schema: "cubistry.calendar7.displays",
      version: 1,
      status: "research candidate, not certified",
      license: pin.dataNotice,
      spdx: "CC-BY-SA-4.0",
      inks: INKS,
      cell: "ink:text",
      firstYear: 2026,
      months: table.months,
    },
    { displays: table.displays },
  );
  return { [RUNTIME.state]: state, [RUNTIME.graph]: graph, [RUNTIME.displays]: displays };
}

function writeOutputs(pin) {
  const outputs = build(pin);
  pin.runtime = {};
  for (const [file, text] of Object.entries(outputs)) {
    mkdirSync(dirname(path(file)), { recursive: true });
    writeFileSync(path(file), text);
    pin.runtime[file] = sha256(text);
    console.log("Wrote", file, pin.runtime[file]);
  }
  writeFileSync(path(PIN), JSON.stringify(pin, null, 2) + "\n");
}

export function check(pin, { requireCommit = false } = {}) {
  for (const [file, digest] of Object.entries(pin.generatedSources ?? {}))
    if (sha256(readFileSync(path(file))) !== digest) throw Error(`${file} does not match its generated pin`);
  for (const artifact of pin.artifacts ?? [])
    for (const [file, digest] of Object.entries(artifact.files))
      if (sha256(readFileSync(path(file))) !== digest) throw Error(`${file} does not match its artifact pin`);
  for (const [research, copy] of Object.entries(pin.copies))
    if (sha256(readFileSync(path(copy))) !== pin.sources[research]) throw Error(`${copy} does not match its pin`);
  for (const [name, file] of Object.entries({ root: JULIA.root, displays: JULIA.displays, script: JULIA.script }))
    if (sha256(readFileSync(path(file))) !== pin.julia[file]) throw Error(`${file} (${name}) does not match its pin`);
  if (hasCommit(pin.commit)) {
    for (const [research, digest] of Object.entries(pin.sources))
      if (sha256(git("show", `${pin.commit}:${research}`)) !== digest) throw Error(`${research} at ${pin.commit} does not match its pin`);
    console.log("Research files match commit", pin.commit);
  } else if (requireCommit) throw Error(`Commit ${pin.commit} is not available`);
  else console.log(`Commit ${pin.commit} not available locally; checked the copies only`);
  for (const [file, text] of Object.entries(build(pin))) {
    if (readText(file) !== text) throw Error(`${file} is stale; run without --check`);
    if (sha256(text) !== pin.runtime[file]) throw Error(`${file} does not match its pin`);
  }
  console.log("calendar7 data OK");
}

function pinCommit(commit, branch) {
  const pin = JSON.parse(readText(PIN));
  if (!hasCommit(commit)) {
    if (!branch) throw Error("commit is not available locally; pass --branch");
    execFileSync("git", ["fetch", "--no-tags", "origin", branch], { cwd: path("."), stdio: "inherit" });
    if (!hasCommit(commit)) throw Error(`commit ${commit} is not on branch ${branch}`);
  }
  pin.commit = commit;
  if (branch) pin.branch = branch;
  pin.sources = {};
  for (const [research, copy] of Object.entries(RESEARCH_FILES)) {
    const bytes = git("show", `${commit}:${research}`);
    pin.sources[research] = sha256(bytes);
    if (copy) {
      mkdirSync(dirname(path(copy)), { recursive: true });
      writeFileSync(path(copy), bytes);
    }
  }
  pin.copies = Object.fromEntries(Object.entries(RESEARCH_FILES).filter(([, c]) => c));
  pin.julia = Object.fromEntries(Object.values(JULIA).map((f) => [f, sha256(readFileSync(path(f)))]));
  writeOutputs(pin);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  if (args.includes("--pin")) pinCommit(option("--pin"), option("--branch"));
  else {
    const pin = JSON.parse(readText(PIN));
    if (args.includes("--check")) check(pin, { requireCommit: args.includes("--require-commit") });
    else {
      pin.julia = Object.fromEntries(Object.values(JULIA).map((f) => [f, sha256(readFileSync(path(f)))]));
      writeOutputs(pin);
    }
  }
}
