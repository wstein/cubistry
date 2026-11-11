// SPDX-License-Identifier: AGPL-3.0-or-later
// Export the Calendar7 names layout "any date" data (research candidate, not certified): print B (the fixed print
// printing-S2.tsv of the skip-capacity study) and, for each of the 91 month-board configurations (month name, weekday of
// the 1st, month length), the front matching that shows the board on print B. Display only: no move sequence.
//
//   node scripts/export-calendar7-names-anydate.mjs <research-root> [--out public/calendar7/names-any]
//   node scripts/export-calendar7-names-anydate.mjs --check [<research-root>]
//       Without research files: manifest digests, app parsers and the front of every configuration
//       (npm run verify:calendar7-names-anydate). With <research-root>: also regenerate and compare byte for byte.
//
// <research-root> is a checkout (or archive) of research/cal7-skip-capacity that contains research/calendar-7x7/. Read:
//   row1-revision/layout.tsv                                        the owner's month-name table (same file as the names data)
//   row1-window-chain/evidence/window-skip/printing-S2.tsv          print B (294 surfaces)
//   row1-window-chain/evidence/window-skip/front-matches-S2.tsv     body and rotation of every front cell, 286 months 2026-01..2050-01
// Per configuration the earliest matched calendar month is used. A configuration that none of the 286 months has is
// matched here (anydate.ts `matchFront`, exhaustive for the front rule) and recorded as source "exporter-matching"; the
// exhaustive 91-configuration table of the research (Julia) replaces it when delivered. Every matching is checked with the
// app's own `frontFailure` and `checkPose`; the exporter's matcher must also find a matching for every configuration the
// research matched and none for February with 28 days starting on a Sunday (research scan-fixed-P2.tsv: NOMATCH).
// Output is byte-deterministic. Pins stop any changed input first; build(root, { testOnlySkipDigestPins: true }) reaches the
// checks behind them in tests/calendar7-names-anydate.test.mjs. The shipped names data and pins are not touched.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INKS_WITH_BAND, frontFailure } from "../src/apps/calendar7/display.ts";
import { checkPose, stateDigest } from "../src/apps/calendar7/engine.ts";
import { parseState } from "../src/apps/calendar7/graph.ts";
import {
  ROTATIONS,
  allConfigs,
  configOf,
  formatFront,
  matchFront,
  namesCells,
  parseAnyData,
  poseFromFront,
} from "../src/apps/calendar7/anydate.ts";
import { parsePrint } from "./prepare-calendar7.mjs";
import { parseLayout, windowCells } from "./export-calendar7-names.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ROOT = "research/calendar-7x7/";
const SKIP = `${ROOT}row1-window-chain/evidence/window-skip/`;
const INPUTS = {
  layout: `${ROOT}row1-revision/layout.tsv`,
  printing: `${SKIP}printing-S2.tsv`,
  fronts: `${SKIP}front-matches-S2.tsv`,
};
/** Digests of the research inputs (research/cal7-skip-capacity, commit b9e66f4dbdec7a721d13c7b522430f3482d40e39). */
export const PINNED = {
  layout: "c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db",
  printing: "5808fcac697ffc600d87b60f39f459de47d2aac05b4b2bd5be86bae9b0f6edd3",
  fronts: "08fa990d2c1929500f47fc7170f8d0599a5b148332c7e8c6dd412e4e6247b7b4",
};
const MONTHS = 286;
const STATUS = "research candidate, not certified, print B not frozen";
const LICENSE =
  "Created by Werner Stein with AI assistance (Codex and Claude, OpenAI and Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.";
/** The configuration the research reports as NOMATCH with print B: February, 28 days, starting on a Sunday (2026-02, 2037-02, 2043-02). */
export const IMPOSSIBLE_KEY = "2-0-28";
const REASON_IMPOSSIBLE =
  "February with 28 days starting on a Sunday has no front matching with print B (research scan-fixed-P2.tsv: NOMATCH; " +
  "two blank corner cells, corner demand 24; Julia only, so UNKNOWN until independently confirmed).";
const REASON_NO_MATCH =
  "This configuration has no front matching with print B (found by the exporter's exhaustive matching of the front rule; " +
  "not in the research months 2026-05 to 2050-01; UNKNOWN until the Julia table of all 91 configurations confirms it).";

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
const vec = (s, what) => {
  const v = s.split(",").map(Number);
  if (v.length !== 3 || v.some((x) => !Number.isInteger(x))) throw Error(`${what}: ${s}`);
  return v;
};

/** print B as the printing (piece, text, ink per sticker) and its identity pose (every body at home). */
function printState(text) {
  const rows = lines(text, "print");
  const print = parsePrint(text);
  const stickers = rows.slice(1).map((line, i) => {
    const f = line.split("\t");
    if (!INKS_WITH_BAND.includes(f[6])) throw Error(`unknown ink ${f[6]}`);
    return { id: i + 1, piece: print[i].piece, text: print[i].text, ink: print[i].ink, p: vec(f[2], "home"), n: vec(f[3], "normal"), up: vec(f[4], "up") };
  });
  return stickers;
}

/** front-matches-S2.tsv: Map "year-month" -> the 49 front bodies in row-major cell order. */
export function parseFronts(text) {
  const rows = lines(text, "front-matches");
  if (rows[0] !== "target\tyear\tmonth\trow\tcolumn\tpiece\tx-image\ty-image\tz-image") throw Error("front-matches header");
  const code = new Map(ROTATIONS.map((r) => [`${r.x}|${r.y}|${r.z}`, r.code]));
  const months = new Map();
  rows.slice(1).forEach((line, i) => {
    const f = line.split("\t");
    if (f.length !== 9) throw Error(`front-matches row ${i + 1}`);
    const [target, year, month, row, column, piece] = f.slice(0, 6).map(Number);
    const rot = code.get(`${vec(f[6], "x")}|${vec(f[7], "y")}|${vec(f[8], "z")}`);
    if (rot === undefined) throw Error(`front-matches row ${i + 1}: not a proper rotation`);
    const key = `${year}-${month}`;
    if (!months.has(key)) months.set(key, { target, year, month, front: [] });
    const m = months.get(key);
    if (m.target !== target) throw Error(`front-matches row ${i + 1}: target changes inside a month`);
    if ((row - 1) * 7 + column - 1 !== m.front.length) throw Error(`front-matches row ${i + 1}: cell order`);
    m.front.push({ piece, rot });
  });
  for (const m of months.values()) if (m.front.length !== 49) throw Error(`month ${m.year}-${m.month}: 49 cells required`);
  return [...months.values()];
}

const inputsText = () =>
  Object.entries(INPUTS)
    .map(([name, rel]) => `${PINNED[name]}  ${rel}\n`)
    .join("");

/** `options.testOnlySkipDigestPins` skips the pinned digests so that tests reach the checks behind them. The command line never sets it. */
export function build(researchRoot, options = {}) {
  const read = (rel) => readFileSync(join(researchRoot, rel));
  const raw = {};
  for (const [name, rel] of Object.entries(INPUTS)) {
    raw[name] = read(rel);
    if (!options.testOnlySkipDigestPins && sha256(raw[name]) !== PINNED[name]) throw Error(`${rel}: digest differs from the pinned digest`);
  }
  const layout = parseLayout(raw.layout.toString("utf8"));
  const stickers = printState(raw.printing.toString("utf8"));
  const printingRows = { piece: stickers.map((s) => s.piece), text: stickers.map((s) => s.text), ink: stickers.map((s) => s.ink) };
  const root = { pos: Int8Array.from(stickers.flatMap((s) => s.p)), normal: Int8Array.from(stickers.flatMap((s) => s.n)), up: Int8Array.from(stickers.flatMap((s) => s.up)) };
  checkPose(printingRows, root);
  const rootHash = stateDigest(printingRows, root);

  const fronts = parseFronts(raw.fronts.toString("utf8"));
  if (fronts.length !== MONTHS) throw Error(`${MONTHS} months required, got ${fronts.length}`);
  // The owner's name table (layout.tsv) is the source of the names cells of the app; the two must agree for every month.
  const cellsOf = (year, month) => {
    const cells = namesCells(year, month);
    const want = windowCells(layout, year, month);
    if (JSON.stringify(cells) !== JSON.stringify(want)) throw Error(`${year}-${month}: names cells differ from layout.tsv`);
    return cells;
  };
  // Every research month is checked as a state of print B: front shows the display, valid pose.
  const byConfig = new Map();
  for (const m of fronts.sort((a, b) => a.year - b.year || a.month - b.month)) {
    const cells = cellsOf(m.year, m.month);
    const pose = poseFromFront(printingRows, root, m.front);
    checkPose(printingRows, pose);
    const miss = frontFailure(printingRows, pose, cells);
    if (miss) throw Error(`${m.year}-${m.month}: front differs at ${miss.row},${miss.column} (${miss.why})`);
    const { key } = configOf(m.year, m.month);
    if (!byConfig.has(key)) byConfig.set(key, m);
  }
  const first = fronts.find((m) => m.year === 2026 && m.month === 5);
  if (!first || first.front.some((f) => f.rot !== "024")) throw Error("2026-05 must be the identity front of print B");

  const configs = allConfigs().map((c) => {
    const found = byConfig.get(c.key);
    const base = { key: c.key, month: c.month, weekday: c.weekday, days: c.days };
    // A representative date of the configuration: the matched month, else the first year from 1 with this configuration.
    const date = found ?? { year: Array.from({ length: 400 }, (_, i) => i + 1).find((y) => configOf(y, c.month).key === c.key), month: c.month };
    const matched = matchFront(printingRows, root, cellsOf(date.year, date.month));
    if (found) {
      if (!matched) throw Error(`configuration ${c.key}: the exporter's matching finds none although the research matched ${found.year}-${found.month}`);
      return { ...base, status: "match", source: `research:${found.year}-${String(found.month).padStart(2, "0")}`, front: formatFront(found.front) };
    }
    if (c.key === IMPOSSIBLE_KEY) {
      if (matched) throw Error(`configuration ${c.key}: the exporter's matching finds one although the research reports NOMATCH`);
      return { ...base, status: "none", reason: REASON_IMPOSSIBLE };
    }
    if (!matched) return { ...base, status: "none", reason: REASON_NO_MATCH };
    const pose = poseFromFront(printingRows, root, matched);
    checkPose(printingRows, pose);
    const miss = frontFailure(printingRows, pose, cellsOf(date.year, date.month));
    if (miss) throw Error(`configuration ${c.key}: matching does not show the front at ${miss.row},${miss.column}`);
    return { ...base, status: "match", source: "exporter-matching", front: formatFront(matched) };
  });

  const files = {
    "state.v1.json": serialize(
      {
        schema: "cubistry.calendar7.state",
        version: 1,
        status: STATUS,
        print: "print B (printing-S2), names layout, ink classes band and blank, English only; the pose is the identity pose (May 2026)",
        surface: "face",
        license: LICENSE,
        spdx: "CC-BY-SA-4.0",
        root: { display: 1, year: 2026, month: 5, hash: rootHash },
      },
      { stickers },
    ),
    "configs.v1.json": serialize(
      {
        schema: "cubistry.calendar7.configs",
        version: 1,
        status: STATUS,
        license: LICENSE,
        spdx: "CC-BY-SA-4.0",
        weekday: "Sunday = 0",
        front: "49 cells row-major, each piece.rotation; rotation = digits of the images of x, y, z (+x -x +y -y +z -z = 0..5), identity 024",
      },
      { configs },
    ),
  };
  const matches = configs.filter((c) => c.status === "match");
  files["NOTICE.txt"] =
    `English 7x7 calendar cube, names layout for any date (${STATUS})\n` +
    `Print B (research printing-S2.tsv) and the front matching of each of the 91 month-board configurations. Display only: no move sequence.\n` +
    `${matches.length} configurations have a state, ${configs.length - matches.length} have none (see configs.v1.json). English only.\n` +
    `${LICENSE}\n\nSPDX-License-Identifier: CC-BY-SA-4.0\n\n` +
    `Source: research/calendar-7x7/row1-revision and row1-window-chain/evidence/window-skip on research/cal7-skip-capacity\n` +
    `(research commit b9e66f4dbdec7a721d13c7b522430f3482d40e39). Regenerate with scripts/export-calendar7-names-anydate.mjs.\n` +
    `The files are a work separate from the Cubistry program code (AGPL-3.0-or-later). The shipped files in\n` +
    `public/calendar7/ and public/calendar7/names/ are not changed by this folder.\n`;
  const hashes = (names) => names.map((n) => `${sha256(files[n])}  ${n}\n`).join("");
  files["manifest.sha256"] = hashes(["NOTICE.txt", "configs.v1.json", "state.v1.json"]);
  files["research-inputs.sha256"] = inputsText();
  return files;
}

/** Check the committed folder: manifest, app parsers, front and pose of every configuration; optionally against the research files. */
export function check(dir, researchRoot) {
  const text = (n) => readFileSync(join(dir, n), "utf8");
  for (const line of lines(text("manifest.sha256"), "manifest")) {
    const [digest, name] = line.split("  ");
    if (sha256(readFileSync(join(dir, name))) !== digest) throw Error(`${name} does not match manifest.sha256`);
  }
  if (text("research-inputs.sha256") !== inputsText()) throw Error("research-inputs.sha256 differs from the pinned digests");
  const stateJson = JSON.parse(text("state.v1.json"));
  const start = parseState(stateJson);
  if (start.surface !== "face") throw Error('state surface must be "face"');
  if (stateDigest(start.printing, start.pose) !== start.node.hash) throw Error("root hash differs from the identity pose");
  const data = parseAnyData(stateJson, JSON.parse(text("configs.v1.json")));
  let states = 0;
  for (const c of allConfigs()) {
    const entry = data.entries.get(c.key);
    if (entry.status !== "match") continue;
    const year = Array.from({ length: 400 }, (_, i) => i + 1).find((y) => configOf(y, c.month).key === c.key);
    const pose = poseFromFront(start.printing, start.pose, entry.front);
    checkPose(start.printing, pose);
    const miss = frontFailure(start.printing, pose, namesCells(year, c.month));
    if (miss) throw Error(`configuration ${c.key}: front differs at ${miss.row},${miss.column} (${miss.why})`);
    states++;
  }
  if (researchRoot) for (const [name, body] of Object.entries(build(researchRoot))) if (text(name) !== body) throw Error(`${name} differs from the export`);
  console.log(`calendar7 names-any data OK (${states} of 91 configurations with a state, ${91 - states} without)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = fileURLToPath(new URL("../public/calendar7/names-any", import.meta.url));
  if (args[0] === "--check") check(dir, args[1]);
  else {
    const o = args.indexOf("--out");
    const out = o >= 0 ? args[o + 1] : dir;
    const rest = o >= 0 ? args.filter((_, i) => i !== o && i !== o + 1) : args;
    if (rest.length !== 1 || !out) throw Error("usage: export-calendar7-names-anydate.mjs <research-root> [--out <dir>] | --check [<research-root>]");
    const files = build(rest[0]);
    mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(out, name), text);
      console.log("Wrote", join(out, name), sha256(text));
    }
  }
}
