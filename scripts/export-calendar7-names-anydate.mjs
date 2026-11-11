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
// A configuration that no front matching can show exactly (February with 28 days from a Sunday on print B) gets a BEST-EFFORT
// state: a maximum matching (the fewest wrong cells, 48 of 49 matched), the unmatched cell filled with an unused body of its
// orbit, and the list `wrong` of the cells (row, column) whose front differs from the board. The check requires that the
// front fails exactly on those cells. The page shows the cell as a hatched, crossed-out field and says which cell differs.
// The research reason stays in this data file and in the docs; the page never shows it.
// Parameters (for a later print, e.g. print C with root January 1980): --print <path under the research root> --print-sha <sha256>,
// --fronts <path | none> --fronts-sha <sha256>, --root YYYY-MM (the month the identity pose of the print shows; default 2026-05).
// Without --fronts every configuration is matched by the exporter (matchFront). The defaults are print B.
// Output is byte-deterministic. Pins stop any changed input first; build(root, { testOnlySkipDigestPins: true }) reaches the
// checks behind them in tests/calendar7-names-anydate.test.mjs. The shipped names data and pins are not touched.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INKS_WITH_BAND, frontFailures } from "../src/apps/calendar7/display.ts";
import { checkPose, stateDigest } from "../src/apps/calendar7/engine.ts";
import { parseState } from "../src/apps/calendar7/graph.ts";
import {
  ROTATIONS,
  allConfigs,
  bestEffortFront,
  configOf,
  formatFront,
  matchFront,
  namesCells,
  parseAnyData,
  poseFromFront,
  wrongStickerIndices,
} from "../src/apps/calendar7/anydate.ts";
import { parsePrint } from "./prepare-calendar7.mjs";
import { RELABEL, parseLayout, windowCells } from "./export-calendar7-names.mjs";

/** April is "AP" + "RIL" in the app (RELABEL, owner decision of 2026-11-11); the research files keep the old labels, their digests are pinned, the bodies stay. */
const relabel = (text) => (Object.hasOwn(RELABEL, text) ? RELABEL[text] : text);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ROOT = "research/calendar-7x7/";
const SKIP = `${ROOT}row1-window-chain/evidence/window-skip/`;
const LAYOUT = `${ROOT}row1-revision/layout.tsv`;
const LAYOUT_SHA = "c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db";
/** Print B (research/cal7-skip-capacity, commit b9e66f4dbdec7a721d13c7b522430f3482d40e39): the defaults of the parameters. */
export const DEFAULTS = {
  printPath: `${SKIP}printing-S2.tsv`,
  printSha: "5808fcac697ffc600d87b60f39f459de47d2aac05b4b2bd5be86bae9b0f6edd3",
  frontsPath: `${SKIP}front-matches-S2.tsv`,
  frontsSha: "08fa990d2c1929500f47fc7170f8d0599a5b148332c7e8c6dd412e4e6247b7b4",
  root: { year: 2026, month: 5 },
};
/** Kept for the tests: the default pins by name. */
export const PINNED = { layout: LAYOUT_SHA, printing: DEFAULTS.printSha, fronts: DEFAULTS.frontsSha };
const DEFAULT_MONTHS = 286;
const STATUS = "research candidate, not certified, print B not frozen";
const LICENSE =
  "Created by Werner Stein with AI assistance (Codex and Claude, OpenAI and Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.";
/** The configuration the research reports as NOMATCH with print B: February, 28 days, starting on a Sunday (2026-02, 2037-02, 2043-02). */
export const IMPOSSIBLE_KEY = "2-0-28";
const REASON_IMPOSSIBLE =
  "February with 28 days starting on a Sunday has no exact front matching with the print (research scan-fixed-P2.tsv: NOMATCH; " +
  "two blank corner cells, corner demand 24; Julia only, so UNKNOWN until independently confirmed). Best effort: a maximum matching " +
  "of 48 of 49 cells (research config_table.jl match_config: one blank bottom corner differs).";
const REASON_NO_MATCH =
  "This configuration has no exact front matching with the print (found by the exporter's exhaustive matching of the front rule; " +
  "UNKNOWN until the Julia table of all 91 configurations confirms it). Best effort: a maximum matching.";

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
  return stickers.map((s) => ({ ...s, text: relabel(s.text) }));
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

const ymText = (r) => `${r.year}-${String(r.month).padStart(2, "0")}`;
const cfgDefaults = (o = {}) => ({ ...DEFAULTS, ...o, root: { ...DEFAULTS.root, ...(o.root ?? {}) } });
/** The pins of a build as the lines of research-inputs.sha256 (sha, two spaces, path). */
const inputsText = (p) =>
  [`${LAYOUT_SHA}  ${LAYOUT}\n`, `${p.printSha}  ${p.printPath}\n`].concat(p.frontsPath ? [`${p.frontsSha}  ${p.frontsPath}\n`] : []).join("");
/** The parameters recorded in research-inputs.sha256 of a folder (layout, print, optional fronts) and the root month of its state. */
function recordedParameters(dir) {
  const rows = lines(readFileSync(join(dir, "research-inputs.sha256"), "utf8"), "research-inputs").map((l) => {
    const m = /^([0-9a-f]{64}) {2}(\S+)$/.exec(l);
    if (!m) throw Error(`research-inputs.sha256 line ${l}`);
    return { sha: m[1], path: m[2] };
  });
  if (rows.length < 2 || rows.length > 3 || rows[0].path !== LAYOUT || rows[0].sha !== LAYOUT_SHA) throw Error("research-inputs.sha256: layout line");
  const state = JSON.parse(readFileSync(join(dir, "state.v1.json"), "utf8"));
  return cfgDefaults({
    printPath: rows[1].path,
    printSha: rows[1].sha,
    frontsPath: rows[2]?.path,
    frontsSha: rows[2]?.sha,
    root: { year: state.root.year, month: state.root.month },
  });
}

/**
 * `options` (see the parameters in the header): printPath, printSha, frontsPath (undefined: match every configuration here),
 * frontsSha, root. `options.testOnlySkipDigestPins` skips the digests so that tests reach the checks behind them. The command line never sets it.
 */
export function build(researchRoot, options = {}) {
  const p = cfgDefaults(options);
  const read = (rel) => readFileSync(join(researchRoot, rel));
  const raw = { layout: read(LAYOUT), printing: read(p.printPath) };
  const pins = [["layout", LAYOUT, LAYOUT_SHA], ["printing", p.printPath, p.printSha]];
  if (p.frontsPath) {
    raw.fronts = read(p.frontsPath);
    pins.push(["fronts", p.frontsPath, p.frontsSha]);
  }
  if (!options.testOnlySkipDigestPins) for (const [name, rel, sha] of pins) if (sha256(raw[name]) !== sha) throw Error(`${rel}: digest differs from the pinned digest`);
  const layout = parseLayout(raw.layout.toString("utf8")).map((row) => row.map(relabel));
  const stickers = printState(raw.printing.toString("utf8"));
  const printingRows = { piece: stickers.map((s) => s.piece), text: stickers.map((s) => s.text), ink: stickers.map((s) => s.ink) };
  const root = { pos: Int8Array.from(stickers.flatMap((s) => s.p)), normal: Int8Array.from(stickers.flatMap((s) => s.n)), up: Int8Array.from(stickers.flatMap((s) => s.up)) };
  checkPose(printingRows, root);
  const rootHash = stateDigest(printingRows, root);
  // The owner's name table (layout.tsv) is the source of the names cells of the app; the two must agree for every month.
  const cellsOf = (year, month) => {
    const cells = namesCells(year, month);
    const want = windowCells(layout, year, month);
    if (JSON.stringify(cells) !== JSON.stringify(want)) throw Error(`${year}-${month}: names cells differ from layout.tsv`);
    return cells;
  };
  // The identity pose of the print shows the root month.
  const rootFailures = frontFailures(printingRows, root, cellsOf(p.root.year, p.root.month));
  if (rootFailures.length) throw Error(`the identity pose does not show ${ymText(p.root)} (${rootFailures.length} cells differ)`);

  // Every research month is checked as a state of the print: the front shows the display, valid pose.
  const byConfig = new Map();
  if (p.frontsPath) {
    const fronts = parseFronts(raw.fronts.toString("utf8"));
    if (p.frontsPath === DEFAULTS.frontsPath && fronts.length !== DEFAULT_MONTHS) throw Error(`${DEFAULT_MONTHS} months required, got ${fronts.length}`);
    for (const m of fronts.sort((a, b) => a.year - b.year || a.month - b.month)) {
      const pose = poseFromFront(printingRows, root, m.front);
      checkPose(printingRows, pose);
      const miss = frontFailures(printingRows, pose, cellsOf(m.year, m.month))[0];
      if (miss) throw Error(`${m.year}-${m.month}: front differs at ${miss.row},${miss.column} (${miss.why})`);
      const { key } = configOf(m.year, m.month);
      if (!byConfig.has(key)) byConfig.set(key, m);
    }
    const first = fronts.find((m) => m.year === p.root.year && m.month === p.root.month);
    if (first && first.front.some((f) => f.rot !== "024")) throw Error(`${ymText(p.root)} must be the identity front of the print`);
  }

  const configs = allConfigs().map((c) => {
    const found = byConfig.get(c.key);
    const base = { key: c.key, month: c.month, weekday: c.weekday, days: c.days };
    // A representative date of the configuration: the matched month, else the first year from 1 with this configuration.
    const date = found ?? { year: Array.from({ length: 400 }, (_, i) => i + 1).find((y) => configOf(y, c.month).key === c.key), month: c.month };
    const cells = cellsOf(date.year, date.month);
    const matched = matchFront(printingRows, root, cells);
    if (found) {
      if (!matched) throw Error(`configuration ${c.key}: the exporter's matching finds none although the research matched ${found.year}-${found.month}`);
      return { ...base, status: "match", source: `research:${ymText(found)}`, front: formatFront(found.front) };
    }
    const isDefaultPrint = p.printPath === DEFAULTS.printPath;
    if (c.key === IMPOSSIBLE_KEY && isDefaultPrint && matched) throw Error(`configuration ${c.key}: the exporter's matching finds one although the research reports NOMATCH`);
    if (matched) {
      const pose = poseFromFront(printingRows, root, matched);
      checkPose(printingRows, pose);
      const miss = frontFailures(printingRows, pose, cells)[0];
      if (miss) throw Error(`configuration ${c.key}: matching does not show the front at ${miss.row},${miss.column}`);
      return { ...base, status: "match", source: "exporter-matching", front: formatFront(matched) };
    }
    // No exact matching: best effort, a maximum matching. The pose is complete (a valid pose); only the cells in `wrong` differ.
    const best = bestEffortFront(printingRows, root, cells);
    const pose = poseFromFront(printingRows, root, best.front);
    checkPose(printingRows, pose);
    const failed = frontFailures(printingRows, pose, cells).map((f) => `${f.row},${f.column}`);
    if (failed.join(";") !== best.wrong.map((w) => w.join(",")).join(";")) throw Error(`configuration ${c.key}: the front differs at ${failed} but the wrong cells are ${best.wrong}`);
    wrongStickerIndices(pose, best.wrong); // every wrong cell has exactly one front sticker
    // Research (config_table.jl match_config on print B): February, Sunday, 28 days matches 48 of 49 cells, one wrong cell.
    if (c.key === IMPOSSIBLE_KEY && isDefaultPrint && best.wrong.length !== 1) throw Error(`configuration ${c.key}: ${best.wrong.length} wrong cells, the research reports 1`);
    return {
      ...base,
      status: "best-effort",
      source: "exporter-matching",
      front: formatFront(best.front),
      wrong: best.wrong,
      reason: c.key === IMPOSSIBLE_KEY ? REASON_IMPOSSIBLE : REASON_NO_MATCH,
    };
  });

  const printName = p.printPath.split("/").pop();
  const files = {
    "state.v1.json": serialize(
      {
        schema: "cubistry.calendar7.state",
        version: 1,
        status: STATUS,
        print: `${printName}, names layout, ink classes band and blank, English only; the pose is the identity pose (${ymText(p.root)})`,
        surface: "face",
        license: LICENSE,
        spdx: "CC-BY-SA-4.0",
        root: { display: 1, year: p.root.year, month: p.root.month, hash: rootHash },
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
        statuses: "match: the front shows the board exactly; best-effort: a maximum matching, the cells in wrong ([row, column], 1-based) differ; none, pending: no state",
        wrong: "best-effort only: the fewest cells the print allows; the page shows them as a crossed-out field and names them; reason is for data and docs, never shown",
      },
      { configs },
    ),
  };
  const exact = configs.filter((c) => c.status === "match");
  const best = configs.filter((c) => c.status === "best-effort");
  files["NOTICE.txt"] =
    `English 7x7 calendar cube, names layout for any date (${STATUS})\n` +
    `Print ${printName} (research) and the front matching of each of the 91 month-board configurations. Display only: no move sequence.\n` +
    `${exact.length} configurations are exact, ${best.length} are best effort (wrong cells listed), ${configs.length - exact.length - best.length} have no state (see configs.v1.json). English only.\n` +
    `${LICENSE}\n\nSPDX-License-Identifier: CC-BY-SA-4.0\n\n` +
    `Source: research/calendar-7x7/row1-revision and ${p.printPath} (print sha256 ${p.printSha}).\n` +
    `Regenerate with scripts/export-calendar7-names-anydate.mjs.\n` +
    `The files are a work separate from the Cubistry program code (AGPL-3.0-or-later). The shipped files in\n` +
    `public/calendar7/ and public/calendar7/names/ are not changed by this folder.\n`;
  const hashes = (names) => names.map((n) => `${sha256(files[n])}  ${n}\n`).join("");
  files["manifest.sha256"] = hashes(["NOTICE.txt", "configs.v1.json", "state.v1.json"]);
  files["research-inputs.sha256"] = inputsText(p);
  return files;
}

/**
 * Check the committed folder: manifest, pins, app parsers, and for every configuration the pose and its front: an exact
 * configuration shows the whole board; a best-effort one fails on exactly the cells of its list `wrong` (no more, no fewer),
 * and each wrong cell has one front sticker. Optionally regenerates from the research files with the recorded parameters.
 */
export function check(dir, researchRoot) {
  const text = (n) => readFileSync(join(dir, n), "utf8");
  for (const line of lines(text("manifest.sha256"), "manifest")) {
    const [digest, name] = line.split("  ");
    if (sha256(readFileSync(join(dir, name))) !== digest) throw Error(`${name} does not match manifest.sha256`);
  }
  const recorded = recordedParameters(dir);
  if (recorded.printPath === DEFAULTS.printPath && (recorded.printSha !== DEFAULTS.printSha || (recorded.frontsPath && recorded.frontsSha !== DEFAULTS.frontsSha))) throw Error("research-inputs.sha256 differs from the pinned digests");
  const stateJson = JSON.parse(text("state.v1.json"));
  const start = parseState(stateJson);
  if (start.surface !== "face") throw Error('state surface must be "face"');
  if (stateDigest(start.printing, start.pose) !== start.node.hash) throw Error("root hash differs from the identity pose");
  const data = parseAnyData(stateJson, JSON.parse(text("configs.v1.json")));
  let exact = 0;
  let best = 0;
  for (const c of allConfigs()) {
    const entry = data.entries.get(c.key);
    if (entry.status !== "match" && entry.status !== "best-effort") continue;
    const year = Array.from({ length: 400 }, (_, i) => i + 1).find((y) => configOf(y, c.month).key === c.key);
    const pose = poseFromFront(start.printing, start.pose, entry.front);
    checkPose(start.printing, pose);
    const failed = frontFailures(start.printing, pose, namesCells(year, c.month)).map((f) => `${f.row},${f.column}`);
    const listed = entry.status === "best-effort" ? entry.wrong.map((w) => w.join(",")) : [];
    if (failed.join(";") !== listed.join(";")) throw Error(`configuration ${c.key}: front differs at [${failed.join(" ")}], the list of wrong cells is [${listed.join(" ")}]`);
    if (entry.status === "best-effort") {
      wrongStickerIndices(pose, entry.wrong);
      best++;
    } else exact++;
  }
  if (researchRoot) {
    for (const [name, body] of Object.entries(build(researchRoot, recorded))) if (text(name) !== body) throw Error(`${name} differs from the export`);
  }
  console.log(`calendar7 names-any data OK (${exact} exact, ${best} best effort, ${91 - exact - best} without a state, of 91 configurations)`);
}

/** Command line flags (see the header) to build options; an unknown flag is an error. */
export function parseFlags(args) {
  const flags = new Map();
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      if (i + 1 >= args.length) throw Error(`${args[i]} needs a value`);
      flags.set(args[i], args[++i]);
    } else rest.push(args[i]);
  }
  const known = ["--out", "--print", "--print-sha", "--fronts", "--fronts-sha", "--root"];
  for (const k of flags.keys()) if (!known.includes(k)) throw Error(`unknown flag ${k}`);
  const options = {};
  if (flags.has("--print")) options.printPath = flags.get("--print");
  if (flags.has("--print-sha")) options.printSha = flags.get("--print-sha");
  if (flags.has("--fronts")) options.frontsPath = flags.get("--fronts") === "none" ? undefined : flags.get("--fronts");
  if (flags.has("--fronts-sha")) options.frontsSha = flags.get("--fronts-sha");
  if (flags.has("--root")) {
    const m = /^([0-9]{1,4})-(0[1-9]|1[0-2])$/.exec(flags.get("--root"));
    if (!m) throw Error("--root must be YYYY-MM");
    options.root = { year: Number(m[1]), month: Number(m[2]) };
  }
  if (options.printPath && !options.printSha) throw Error("--print needs --print-sha");
  if (options.frontsPath && options.frontsPath !== DEFAULTS.frontsPath && !options.frontsSha) throw Error("--fronts needs --fronts-sha");
  return { options, out: flags.get("--out"), rest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = fileURLToPath(new URL("../public/calendar7/names-any", import.meta.url));
  if (args[0] === "--check") check(dir, args[1]);
  else {
    const { options, out = dir, rest } = parseFlags(args);
    if (rest.length !== 1) throw Error("usage: export-calendar7-names-anydate.mjs <research-root> [--out <dir>] [--print <path> --print-sha <sha>] [--fronts <path|none> --fronts-sha <sha>] [--root YYYY-MM] | --check [<research-root>]");
    const files = build(rest[0], options);
    mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(out, name), text);
      console.log("Wrote", join(out, name), sha256(text));
    }
  }
}
