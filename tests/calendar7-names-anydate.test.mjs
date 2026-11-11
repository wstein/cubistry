// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout for ANY date (research candidate, not certified): the month-board configuration of a date, the data
// of public/calendar7/names-any (print B, 91 configurations), the pose that shows a date's board, the exporter checks and the
// mount (fake DOM, fake stage). Set CALENDAR7_ANYDATE_RESEARCH=<checkout root of research/cal7-skip-capacity> to also regenerate
// the data from the research evidence and compare byte for byte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, check, DEFAULTS, IMPOSSIBLE_KEY, parseFlags, parseFronts } from "../scripts/export-calendar7-names-anydate.mjs";
import {
  ANY_FIRST_YEAR, ANY_LAST_YEAR, ROTATIONS, allConfigs, assignPieces, bestEffortFront, bestEffortSentence, cellWhere, chooseAnyMonth, configOf, matchFront, namesCells, parseAnyData, parseFront, poseFromFront, rotationOf, stateForDate, wrongStickerIndices,
} from "../src/apps/calendar7/anydate.ts";
import { anyDatePageHtml, anyDateModel, HIDDEN_SHEET_CLASS, NO_STATE_LEAD } from "../src/apps/calendar7/anydate-view.ts";
import { checkPose, stateDigest } from "../src/apps/calendar7/engine.ts";
import { frontFailure, frontFailures } from "../src/apps/calendar7/display.ts";
import { drawWrongCell, HATCH_LINES, WRONG_CELL } from "../src/apps/calendar7/sticker-art.ts";
import { ANY_DISPLAY_ONLY_NOTICE, NAMES_ANY_LABEL, NAMES_ANY_LOAD_NOTICE, parseLayout, parseLayoutMode } from "../src/apps/calendar7/layout.ts";
import { parseDisplays, parseState } from "../src/apps/calendar7/graph.ts";
import { chainRange, monthLabel } from "../src/apps/calendar7/month-view.ts";
import { parseGraph } from "../src/apps/calendar7/graph.ts";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";

const DIR = "public/calendar7/names-any";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const stateJson = json(`${DIR}/state.v1.json`);
const configsJson = json(`${DIR}/configs.v1.json`);
const data = parseAnyData(stateJson, configsJson);
const { printing } = data.start;

// ---- the configuration of a date ----
// Known dates (calendar facts, independent of the code): [year, month, weekday of the 1st (Sunday = 0), days].
const KNOWN = [
  [1967, 9, 5, 30], // Friday 1 September 1967
  [2000, 2, 2, 29], // Tuesday, leap year (divisible by 400)
  [2100, 2, 1, 28], // Monday, not a leap year (divisible by 100)
  [2024, 2, 4, 29], // Thursday, leap year
  [2026, 2, 0, 28], // Sunday, the configuration without a state
  [1900, 2, 4, 28], // Thursday, not a leap year
  [1582, 10, 5, 31], // Friday: proleptic Gregorian, 15 October 1582 was the first Gregorian day (a Friday)
  [1, 1, 1, 31], // Monday 1 January 0001 (proleptic)
  [9999, 12, 3, 31], // Wednesday 1 December 9999
  [2026, 5, 5, 31], // Friday 1 May 2026
];
test("the configuration of a date: weekday of the 1st and month length for a table of known dates", () => {
  for (const [year, month, weekday, days] of KNOWN) {
    const c = configOf(year, month);
    assert.deepEqual([c.weekday, c.days], [weekday, days], `${year}-${month}`);
    assert.equal(c.key, `${month}-${weekday}-${days}`);
  }
});
test("the configuration agrees with the platform's proleptic Gregorian dates for every month of the years 1 to 9999", () => {
  for (let y = ANY_FIRST_YEAR; y <= ANY_LAST_YEAR; y++)
    for (let m = 1; m <= 12; m++) {
      const d = new Date(Date.UTC(2000, 0, 1));
      d.setUTCFullYear(y, m - 1, 1);
      const next = new Date(Date.UTC(2000, 0, 1));
      next.setUTCFullYear(y, m, 1);
      const c = configOf(y, m);
      assert.equal(c.weekday, d.getUTCDay(), `${y}-${m} weekday`);
      assert.equal(c.days, Math.round((next - d) / 86400000), `${y}-${m} days`);
    }
});
test("a date outside the accepted years or months has no configuration", () => {
  for (const [y, m] of [[0, 1], [10000, 1], [-5, 1], [2026, 0], [2026, 13], [2026.5, 1], [Number.NaN, 1]]) assert.throws(() => configOf(y, m), RangeError, `${y}-${m}`);
});
test("there are exactly 91 configurations and every month of the years 1 to 9999 falls into one of them, each of them occurs", () => {
  const all = allConfigs();
  assert.equal(all.length, 91);
  assert.equal(new Set(all.map((c) => c.key)).size, 91);
  const seen = new Set();
  for (let y = 1; y <= 9999; y++) for (let m = 1; m <= 12; m++) seen.add(configOf(y, m).key);
  assert.deepEqual([...seen].sort(), all.map((c) => c.key).sort());
});

// ---- year and month choice ----
test("year 1 to 9999 and month 1 to 12 are accepted; anything else is invalid and never corrected", () => {
  const today = { year: 2026, month: 11 };
  const pick = (s) => chooseAnyMonth(new URLSearchParams(s), today);
  assert.deepEqual(pick("year=1967&month=9"), { kind: "ok", ym: { year: 1967, month: 9 }, source: "url" });
  assert.deepEqual(pick("year=1&month=1").ym, { year: 1, month: 1 });
  assert.deepEqual(pick("year=9999&month=12").ym, { year: 9999, month: 12 });
  assert.deepEqual(pick(""), { kind: "ok", ym: today, source: "today" });
  assert.match(pick("year=0&month=5").reason, /year must be from 1 to 9999/);
  assert.match(pick("year=10000&month=5").reason, /^year must be a number/); // five digits are not a year
  for (const bad of ["year=2026", "month=5", "year=x&month=1", "year=2026&month=0", "year=2026&month=13", "year=-1&month=1", "year=1.5&month=1"]) assert.equal(pick(bad).kind, "invalid", bad);
});

// ---- rotations and the names cells ----
test("there are 24 proper rotations, identity is 024, and a mirror or malformed code is refused", () => {
  assert.equal(ROTATIONS.length, 24);
  assert.deepEqual(rotationOf("024").x, [1, 0, 0]);
  for (const bad of ["042", "000", "135", "06", "abc"]) assert.throws(() => rotationOf(bad), /proper cube rotation/, bad);
});
test("the names cells are the month name and band tiles in row 1 then the calendar rows (all months of the shipped names window)", () => {
  const table = parseDisplays(json("public/calendar7/names/displays.v1.json"));
  for (const d of table.displays) assert.deepEqual(namesCells(d.year, d.month), d.cells, `${d.year}-${d.month}`);
  assert.deepEqual(namesCells(1967, 9).slice(0, 7).map((c) => c.text), ["SEP", "TEM", "BER", "", "", "", ""]);
});

// ---- the data ----
test("the data folder checks clean: 90 configurations are exact, February with 28 days from a Sunday is best effort with its wrong cell, sizes within budget", () => {
  check(DIR);
  const entries = [...data.entries.values()];
  assert.equal(entries.length, 91);
  assert.deepEqual(entries.filter((e) => e.status !== "match").map((e) => e.key), [IMPOSSIBLE_KEY]);
  const best = data.entries.get(IMPOSSIBLE_KEY);
  assert.equal(best.status, "best-effort");
  assert.deepEqual(best.wrong, [[7, 7]], "research match_config on print B: 48 of 49 cells, the solver reports (7,7)");
  assert.match(best.reason, /February with 28 days starting on a Sunday/); // the research reason lives in the data only
  const bytes = ["state.v1.json", "configs.v1.json", "NOTICE.txt", "manifest.sha256", "research-inputs.sha256"].reduce((a, n) => a + statSync(`${DIR}/${n}`).size, 0);
  assert.ok(bytes < 80000, `${bytes} bytes`);
  // 2-4-29 (February 2024) is not in the research months 2026-05 to 2050-01: the exporter's own matching supplies it.
  assert.equal(data.entries.get("2-4-29").source, "exporter-matching");
  assert.equal(data.entries.get("9-5-30").source.startsWith("research:"), true);
});
test("print B in the data is the one print: 294 stickers, 218 bodies, identity pose", () => {
  assert.equal(printing.piece.length, 294);
  assert.equal(new Set(printing.piece).size, 218);
  checkPose(printing, data.start.pose);
  assert.equal(stateDigest(printing, data.start.pose), stateJson.root.hash);
});
test("the pose of every configuration is a valid pose and shows its own board, and no other board of a different configuration", () => {
  let checked = 0;
  for (const c of allConfigs()) {
    const entry = data.entries.get(c.key);
    if (entry.status !== "match") continue;
    const year = Array.from({ length: 400 }, (_, i) => i + 1).find((y) => configOf(y, c.month).key === c.key);
    const pose = poseFromFront(printing, data.start.pose, entry.front);
    checkPose(printing, pose);
    assert.equal(frontFailure(printing, pose, namesCells(year, c.month)), null, c.key);
    checked++;
  }
  assert.equal(checked, 90);
  // The pose of one configuration does not show the board of another one.
  const sep = stateForDate(data, 1967, 9).pose;
  assert.notEqual(frontFailure(printing, sep, namesCells(1967, 10)), null);
  assert.notEqual(frontFailure(printing, sep, namesCells(1967, 8)), null);
  const feb2000 = stateForDate(data, 2000, 2).pose;
  assert.notEqual(frontFailure(printing, feb2000, namesCells(2100, 2)), null, "29 days against 28 days");
});
test("the boards of the named dates: September 1967, February 2000 (leap), 2100 (not leap), 2024 (leap), 1900 (not leap)", () => {
  const front = (year, month) => {
    const s = stateForDate(data, year, month);
    assert.equal(s.kind, "state", `${year}-${month}`);
    assert.equal(frontFailure(printing, s.pose, namesCells(year, month)), null, `${year}-${month}`);
    const texts = new Map();
    for (let i = 0; i < 294; i++) {
      const o = 3 * i;
      if (s.pose.normal[o + 2] === 1 && s.pose.pos[o + 2] === 3) texts.set(`${4 - s.pose.pos[o + 1]},${s.pose.pos[o] + 4}`, printing.text[i]);
    }
    return { cells: namesCells(year, month), texts, s };
  };
  const sep = front(1967, 9);
  assert.deepEqual([1, 2, 3].map((c) => sep.texts.get(`1,${c}`)), ["SEP", "TEM", "BER"]);
  assert.equal(sep.texts.get("3,6"), "1", "1 September 1967 is a Friday: column 6 of the first date row");
  for (const c of [1, 2, 3, 4, 5]) assert.equal(sep.texts.get(`3,${c}`), "", `blank before the 1st, column ${c}`);
  const has = (cells, t) => cells.some((c) => c.text === t || c.text.split("/").includes(t));
  assert.equal(has(front(2000, 2).cells, "29"), true);
  assert.equal(has(front(2100, 2).cells, "29"), false);
  assert.equal(has(front(2100, 2).cells, "28"), true);
  assert.equal(has(front(2024, 2).cells, "29"), true);
  assert.equal(has(front(1900, 2).cells, "29"), false);
  assert.deepEqual([1, 2, 3].map((c) => front(2100, 2).texts.get(`1,${c}`)), ["FE", "BRU", "ARY"]);
});
test("February 2026 (and every 28-day February from a Sunday) is a best-effort state that fails on exactly its listed cell; February 2024 is exact", () => {
  for (const [y, m] of [[2026, 2], [2037, 2], [2043, 2], [2015, 2]]) {
    const s = stateForDate(data, y, m);
    assert.equal(s.kind, "best-effort", `${y}-${m}`);
    checkPose(printing, s.pose);
    const failed = frontFailures(printing, s.pose, namesCells(y, m));
    assert.deepEqual(failed.map((f) => [f.row, f.column]), s.wrong.map((w) => [...w]), `${y}-${m}: the front differs on exactly the listed cells`);
    assert.equal(failed.length, 1, "48 of 49 cells: the fewest wrong cells");
  }
  assert.equal(stateForDate(data, 2024, 2).kind, "state");
  assert.equal(stateForDate(data, 2028, 2).kind, "state");
});
test("the exporter's own matching: it matches a research month, and finds none for the Sunday February (research NOMATCH)", () => {
  const sample = matchFront(printing, data.start.pose, namesCells(2027, 3));
  assert.notEqual(sample, null);
  assert.equal(frontFailure(printing, poseFromFront(printing, data.start.pose, sample), namesCells(2027, 3)), null);
  assert.equal(matchFront(printing, data.start.pose, namesCells(2026, 2)), null);
});
test("the best-effort front is a maximum matching: 48 of 49 cells on the Sunday February, and the filler of the wrong cell is an unused corner body", () => {
  const best = bestEffortFront(printing, data.start.pose, namesCells(2026, 2));
  assert.deepEqual(best.wrong, [[7, 7]]);
  assert.equal(new Set(best.front.map((f) => f.piece)).size, 49, "49 distinct bodies");
  assert.equal(frontFailures(printing, poseFromFront(printing, data.start.pose, best.front), namesCells(2026, 2)).length, 1);
  // An exact board has no wrong cell.
  assert.deepEqual(bestEffortFront(printing, data.start.pose, namesCells(2027, 3)).wrong, []);
});
test("the wrong cell has exactly one front sticker, on the corner cubie of that cell", () => {
  const s = stateForDate(data, 2026, 2);
  const [i] = wrongStickerIndices(s.pose, s.wrong);
  const o = 3 * i;
  assert.deepEqual([s.pose.pos[o], s.pose.pos[o + 1], s.pose.pos[o + 2]], [3, -3, 3], "front, bottom right: x 3, y -3, z 3");
  assert.deepEqual([s.pose.normal[o], s.pose.normal[o + 1], s.pose.normal[o + 2]], [0, 0, 1]);
  assert.throws(() => wrongStickerIndices(s.pose, [[8, 1]]), /has 0 stickers/);
  // Row and column are not interchangeable: row 7, column 1 is bottom left (x -3, y -3), row 1, column 7 top right (x 3, y 3).
  for (const [cell, want] of [[[7, 1], [-3, -3]], [[1, 7], [3, 3]], [[1, 1], [-3, 3]]]) {
    const [j] = wrongStickerIndices(s.pose, [cell]);
    assert.deepEqual([s.pose.pos[3 * j], s.pose.pos[3 * j + 1]], want, `cell ${cell}`);
  }
  const exact = stateForDate(data, 1967, 9).pose;
  assert.deepEqual(wrongStickerIndices(exact, [[7, 7]]).length, 1);
  assert.notEqual(wrongStickerIndices(exact, [[7, 7]])[0], wrongStickerIndices(exact, [[7, 1]])[0]);
});
test("where a cell is is derived from its coordinates: corners by name, the others by row and column; the sentence follows the list", () => {
  assert.equal(cellWhere(7, 7), "bottom right (row 7, column 7)");
  assert.equal(cellWhere(7, 1), "bottom left (row 7, column 1)");
  assert.equal(cellWhere(1, 1), "top left (row 1, column 1)");
  assert.equal(cellWhere(1, 7), "top right (row 1, column 7)");
  assert.equal(cellWhere(3, 4), "row 3, column 4");
  assert.equal(bestEffortSentence([[7, 7]]), "Not exactly possible with this print: cell bottom right (row 7, column 7) differs.");
  assert.equal(bestEffortSentence([[7, 1]]), "Not exactly possible with this print: cell bottom left (row 7, column 1) differs.");
  assert.equal(bestEffortSentence([[7, 1], [3, 4]]), "Not exactly possible with this print: cells bottom left (row 7, column 1) and row 3, column 4 differ.");
});
test("the data contract: a best-effort entry needs a list of distinct cells in 1..7, a front and a reason", () => {
  const entry = (patch) => { const c = structuredClone(configsJson); Object.assign(c.configs.find((e) => e.key === IMPOSSIBLE_KEY), patch); return c; };
  assert.doesNotThrow(() => parseAnyData(stateJson, entry({})));
  assert.throws(() => parseAnyData(stateJson, entry({ wrong: [] })), /wrong cells required/);
  assert.throws(() => parseAnyData(stateJson, entry({ wrong: undefined })), /wrong cells required/);
  assert.throws(() => parseAnyData(stateJson, entry({ wrong: [[8, 1]] })), /wrong cell/);
  assert.throws(() => parseAnyData(stateJson, entry({ wrong: [[7, 0]] })), /wrong cell/);
  assert.throws(() => parseAnyData(stateJson, entry({ wrong: [[7, 7], [7, 7]] })), /repeat/);
  assert.throws(() => parseAnyData(stateJson, entry({ reason: undefined })), /source, front and reason/);
});
test("a front with a wrong rotation, a repeated body or a cell the body cannot reach is refused", () => {
  const front = data.entries.get("9-5-30").front.map((f) => ({ ...f }));
  const bad = (edit) => { const f = front.map((x) => ({ ...x })); edit(f); return f; };
  assert.throws(() => poseFromFront(printing, data.start.pose, bad((f) => { f[0].rot = f[1].rot === f[0].rot ? "135" : f[1].rot; })), /does not take piece/);
  assert.throws(() => poseFromFront(printing, data.start.pose, bad((f) => { f[1] = { ...f[0], rot: f[1].rot }; })), /used twice|does not take piece/);
  assert.throws(() => poseFromFront(printing, data.start.pose, front.slice(1)), /49 bodies/);
  assert.throws(() => parseFront("1.024 2.024"), /49 bodies/);
});

// ---- the exporter checks ----
const copyDir = () => { const d = mkdtempSync(join(tmpdir(), "c7any-")); cpSync(DIR, d, { recursive: true }); return d; };
test("check stops on a tampered folder: changed front without the manifest, and with a forged manifest the front check catches the board of another configuration", () => {
  const dir = copyDir();
  check(dir);
  const cfg = json(join(dir, "configs.v1.json"));
  const e = cfg.configs.find((c) => c.key === "9-5-30");
  e.front = cfg.configs.find((c) => c.key === "9-4-30").front; // a valid front of another board
  const text = JSON.stringify(cfg);
  writeFileSync(join(dir, "configs.v1.json"), text);
  assert.throws(() => check(dir), /configs\.v1\.json does not match manifest/);
  // A forged manifest entry for the changed file: the front check of the configuration catches the swapped bodies.
  const manifest = readFileSync(join(dir, "manifest.sha256"), "utf8").split("\n").map((l) => (l.endsWith("  configs.v1.json") ? `${createHash("sha256").update(text).digest("hex")}  configs.v1.json` : l)).join("\n");
  writeFileSync(join(dir, "manifest.sha256"), manifest);
  assert.throws(() => check(dir), /configuration 9-5-30: front differs/);
});
test("check stops when the list of wrong cells does not match the front: another cell, a missing cell, an extra cell", () => {
  const forged = (patch) => {
    const dir = copyDir();
    const cfg = json(join(dir, "configs.v1.json"));
    patch(cfg.configs.find((c) => c.key === IMPOSSIBLE_KEY));
    const body = JSON.stringify(cfg);
    writeFileSync(join(dir, "configs.v1.json"), body);
    const manifest = readFileSync(join(dir, "manifest.sha256"), "utf8").split("\n").map((l) => (l.endsWith("  configs.v1.json") ? `${createHash("sha256").update(body).digest("hex")}  configs.v1.json` : l)).join("\n");
    writeFileSync(join(dir, "manifest.sha256"), manifest);
    return dir;
  };
  assert.throws(() => check(forged((e) => (e.wrong = [[7, 1]]))), /configuration 2-0-28: front differs at \[7,7\], the list of wrong cells is \[7,1\]/);
  assert.throws(() => check(forged((e) => (e.wrong = [[7, 7], [1, 1]]))), /the list of wrong cells is \[7,7 1,1\]/);
  const exact = forged((e) => { Object.assign(e, data.entries.get("2-1-28") && { status: "match", source: "x" }); delete e.wrong; delete e.reason; });
  assert.throws(() => check(exact), /configuration 2-0-28: front differs at \[7,7\], the list of wrong cells is \[\]/);
});
test("the exporter parameters: print, fronts and root are flags; a print needs its sha; the defaults are print B", () => {
  assert.deepEqual(parseFlags(["root"]).options, {});
  const p = parseFlags(["r", "--print", "x/printing-C.tsv", "--print-sha", "a".repeat(64), "--fronts", "none", "--root", "1980-01", "--out", "o"]);
  assert.deepEqual(p.options, { printPath: "x/printing-C.tsv", printSha: "a".repeat(64), frontsPath: undefined, root: { year: 1980, month: 1 } });
  assert.equal(p.out, "o");
  assert.throws(() => parseFlags(["r", "--print", "x"]), /--print needs --print-sha/);
  assert.throws(() => parseFlags(["r", "--fronts", "f.tsv"]), /--fronts needs --fronts-sha/);
  assert.throws(() => parseFlags(["r", "--root", "1980-13"]), /YYYY-MM/);
  assert.throws(() => parseFlags(["r", "--bogus", "1"]), /unknown flag/);
  assert.equal(DEFAULTS.printPath.endsWith("printing-S2.tsv"), true);
});
test("the root year of a state may be any year from 1 (a print whose identity shows January 1980)", () => {
  const j = structuredClone(stateJson);
  j.root.year = 1980;
  j.root.month = 1;
  assert.equal(parseAnyData(j, configsJson).start.node.year, 1980);
});
test("check refuses a folder whose configuration table lacks one of the 91 configurations", () => {
  const cfg = structuredClone(configsJson);
  cfg.configs.pop();
  assert.throws(() => parseAnyData(stateJson, cfg), /91 configurations/);
  const dup = structuredClone(configsJson);
  dup.configs[1] = dup.configs[0];
  assert.throws(() => parseAnyData(stateJson, dup), /config key/);
});
test("the research front-matches file is parsed strictly: header, cell order, proper rotations", () => {
  const head = "target\tyear\tmonth\trow\tcolumn\tpiece\tx-image\ty-image\tz-image\n";
  assert.throws(() => parseFronts("x\n"), /header/);
  assert.throws(() => parseFronts(`${head}1\t2026\t5\t1\t2\t5\t1,0,0\t0,1,0\t0,0,1\n`), /cell order/);
  assert.throws(() => parseFronts(`${head}1\t2026\t5\t1\t1\t5\t1,0,0\t0,1,0\t0,0,-1\n`), /proper rotation/);
});
test("with the research checkout the exporter regenerates the committed files byte for byte (CALENDAR7_ANYDATE_RESEARCH)", { skip: !process.env.CALENDAR7_ANYDATE_RESEARCH }, () => {
  const files = build(process.env.CALENDAR7_ANYDATE_RESEARCH);
  for (const [name, body] of Object.entries(files)) assert.equal(readFileSync(`${DIR}/${name}`, "utf8"), body, name);
  check(DIR, process.env.CALENDAR7_ANYDATE_RESEARCH);
});

// ---- layout selection ----
test("names-any is only selected by ?layout=names-any: parseLayout never returns it", () => {
  assert.equal(parseLayout("names-any"), "standard");
  assert.equal(parseLayoutMode("names-any"), "names-any");
  assert.equal(parseLayoutMode("names"), "names");
  for (const bad of [null, undefined, "", "Names-any", "names-any ", "any"]) assert.equal(parseLayoutMode(bad), "standard", String(bad));
});

// ---- the page ----
const graphRange = chainRange(parseGraph(json("public/calendar7/graph.v1.json")));
const today = { year: 2026, month: 11 };
const page = (year, month) => {
  const choice = chooseAnyMonth(new URLSearchParams(`year=${year}&month=${month}`), today);
  return anyDatePageHtml(anyDateModel(choice, stateForDate(data, year, month), today, graphRange));
};
test("the any-date page shows the sheet, the display-only line and the date form, with no step links and no chain text", () => {
  const html = page(1967, 9);
  assert.match(html, /data-month="1967-09">September 1967<\/h2>/);
  assert.match(html, />SEP<\/td>|>SEP</);
  assert.ok(html.includes(ANY_DISPLAY_ONLY_NOTICE));
  assert.match(html, /Board configuration: September, the 1st on a Friday, 30 days\./);
  assert.match(html, /name="year" min="1" max="9999"/);
  assert.match(html, /<option value="9" selected>September<\/option>/);
  assert.doesNotMatch(html, /data-step=|outside the proven chain|Open May 2026|c7-nav/);
  assert.doesNotMatch(html, /data-c7-no-state/);
  assert.doesNotMatch(html, /proleptic/, "1967 is later than 1582: no proleptic note");
});
test("the Gregorian note appears only for years before 1583", () => {
  assert.match(page(1582, 10), /proleptic Gregorian calendar/);
  assert.doesNotMatch(page(1583, 1), /proleptic/);
});
test("February 2026 shows the one sentence, no technical reason, and the month table only as visually hidden text", () => {
  const html = page(2026, 2);
  assert.ok(html.includes('<p class="c7-best-effort" role="status" data-c7-best-effort>Not exactly possible with this print: cell bottom right (row 7, column 7) differs.</p>'));
  assert.doesNotMatch(html, /scan-fixed|corner demand|Julia|NOMATCH|\.tsv|Reason:|data-c7-no-state/);
  assert.ok(html.includes(`<div class="${HIDDEN_SHEET_CLASS}" data-c7-sheet-hidden><table class="c7-sheet"`), "the table is inside the hidden wrapper");
  assert.match(html, /aria-label="7x7 calendar sheet, February 2026"/, "the table keeps its accessible name");
  // An exact month shows its table as before.
  assert.doesNotMatch(page(1967, 9), /c7-sr-only|data-c7-best-effort/);
});
test("a configuration without any state shows the short line without a reason", () => {
  const html = anyDatePageHtml({ ...anyDateModel(chooseAnyMonth(new URLSearchParams("year=2026&month=2"), today), null, today, graphRange), anyDate: { kind: "none", key: "2-0-28" } });
  assert.ok(html.includes(`${NO_STATE_LEAD}</p>`));
  assert.doesNotMatch(html, /Reason/);
});
test("the differing cell is drawn as a gray hatched field with a strike-through and a red frame crossed out", () => {
  const log = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => log.push([String(k), ...a, t.strokeStyle, t.fillStyle])), set: (t, k, v) => { t[k] = v; log.push(["set", k, v]); return true; } });
  drawWrongCell(ctx, 346, 346);
  const calls = (name) => log.filter((l) => l[0] === name);
  assert.deepEqual(calls("fillRect")[0].slice(1, 5), [0, 0, 346, 346]);
  assert.equal(log.find((l) => l[0] === "set" && l[1] === "fillStyle")[2], WRONG_CELL.field);
  assert.ok(calls("moveTo").length >= HATCH_LINES, "hatching: one line per step");
  const strokes = log.filter((l) => l[0] === "set" && l[1] === "strokeStyle").map((l) => l[2]);
  assert.deepEqual(strokes, [WRONG_CELL.hatch, WRONG_CELL.strike, WRONG_CELL.halo, WRONG_CELL.frame]);
  assert.equal(calls("strokeRect").length, 2, "the frame, with its halo");
  assert.equal(calls("stroke").length, 4, "hatching, strike-through, and the cross-out of the frame with its halo");
});
test("an invalid month shows the reason and keeps the date form", () => {
  const html = anyDatePageHtml(anyDateModel(chooseAnyMonth(new URLSearchParams("year=0&month=5"), today), null, today, graphRange));
  assert.match(html, /Invalid month: year must be from 1 to 9999\./);
  assert.match(html, /data-c7-date-form/);
});

// ---- the mount ----
class El {
  constructor(attrs = {}) { this.attrs = { ...attrs }; this.textContent = ""; this.hidden = false; this.disabled = false; this.value = ""; this.innerHTML = ""; }
  querySelector() { return { focus() {} }; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "hidden") this.hidden = true; if (k === "disabled") this.disabled = true; }
  removeAttribute(k) { delete this.attrs[k]; if (k === "hidden") this.hidden = false; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  focus() {}
}
function fakeRoot() {
  const listeners = { click: new Set(), change: new Set(), submit: new Set() };
  const els = new Map();
  const view = new El();
  const get = (name) => { if (!els.has(name)) els.set(name, new El({ "data-c7": name })); return els.get(name); };
  return {
    attrs: {}, html: "", view, el: get, listeners,
    set innerHTML(h) { this.html = h; },
    querySelector(sel) {
      if (sel === ".c7-view") return view;
      if (sel === ".c7-live") return new El();
      const m = sel.match(/^\[data-c7="([a-z-]+)"\]$/);
      return m ? get(m[1]) : null;
    },
    contains: () => true,
    addEventListener: (t, l) => listeners[t].add(l),
    removeEventListener: (t, l) => listeners[t].delete(l),
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    choose(name, value) {
      const el = get(name);
      el.value = value;
      for (const l of [...listeners.change]) l({ type: "change", target: { closest: () => el } });
    },
    submit(year, month) {
      const form = { querySelector: (sel) => ({ value: sel.includes("year") ? String(year) : String(month) }) };
      let prevented = false;
      for (const l of [...listeners.submit]) l({ type: "submit", target: { closest: () => form }, preventDefault: () => (prevented = true) });
      return prevented;
    },
  };
}
const fakeStage = () => {
  const stage = { configs: [], shows: [], show: (pose) => stage.shows.push(pose), turn: () => Promise.resolve(), setScheme() {}, setLabel: (t) => (stage.label = t), resetView() {}, destroy() {}, configure(printing, pose, surface, layout, wrong) { stage.configs.push({ printing, layout, wrong }); } };
  return stage;
};
const settle = async (root, want) => {
  for (let i = 0; i < 200000; i++) {
    if (root.getAttribute("data-c7-state") === "idle" && root.getAttribute("data-c7-month") === want) return;
    await Promise.resolve();
  }
  throw new Error(`not idle at ${want}: ${root.getAttribute("data-c7-state")} ${root.getAttribute("data-c7-month")}`);
};
const attr = async (root, name, want) => {
  for (let i = 0; i < 200000 && root.getAttribute(name) !== want; i++) await Promise.resolve();
  assert.equal(root.getAttribute(name), want);
};
const setup = ({ failAny = false } = {}) => {
  const stage = fakeStage();
  const host = { hidden: false };
  const calls = { fetched: [], query: [] };
  let search = "";
  const env = {
    base: "/",
    fetchJson: async (url) => {
      calls.fetched.push(url);
      if (failAny && url.includes("/names-any/")) throw new Error("HTTP 404");
      const dir = url.includes("/names-any/") ? "public/calendar7/names-any/" : url.includes("/names/") ? "public/calendar7/names/" : "public/calendar7/";
      return json(dir + url.split("/").pop());
    },
    now: () => new Date(2026, 10, 10),
    search: () => search,
    replaceQuery: (s) => { search = s; calls.query.push(s); },
    isCurrent: () => true,
    sceneHost: () => host,
    createStage: async () => stage,
    reducedMotion: () => false,
  };
  return { env, stage, host, calls };
};
const names = { graph: parseGraph(json("public/calendar7/names/graph.v1.json")) };

test("mount with layout=names-any shows September 1967 from print B: one cube build, the pose of its configuration, notice, no player, no chain files", async () => {
  const root = fakeRoot();
  const { env, stage, host, calls } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=1967&month=9&layout=names-any"), env);
  await settle(root, "1967-09");
  assert.deepEqual(calls.fetched.filter((u) => u.includes("names-any")).map((u) => u.split("/").pop()).sort(), ["configs.v1.json", "state.v1.json"]);
  assert.equal(calls.fetched.filter((u) => u.includes("/names/")).length, 0, "the chain data is not read");
  assert.equal(stage.configs.length, 1);
  assert.equal(stage.configs[0].layout, "names");
  assert.deepEqual([...stage.configs[0].printing.text], [...printing.text]);
  const want = stateForDate(data, 1967, 9).pose;
  assert.equal(stage.shows.length, 1);
  assert.deepEqual([...stage.shows[0].pos], [...want.pos]);
  assert.equal(root.getAttribute("data-c7-digest"), stateDigest(printing, want));
  assert.equal(root.getAttribute("data-c7-any"), "state");
  assert.equal(root.getAttribute("data-c7-layout"), "names");
  assert.equal(root.getAttribute("data-c7-layout-mode"), "names-any");
  assert.equal(root.el("layout-notice").textContent, ANY_DISPLAY_ONLY_NOTICE);
  assert.equal(root.el("layout-notice").hidden, false);
  assert.equal(root.el("player").hidden, true, "no move controls");
  assert.equal(host.hidden, false);
  assert.match(stage.label, /September 1967, display only/);
  assert.ok(root.html.includes(`<option value="names-any" selected>${NAMES_ANY_LABEL}</option>`));
  assert.doesNotMatch(root.view.innerHTML, /outside the proven chain|data-step=/);
  inst.dispose();
});

test("February 2026 builds the best-effort cube with the wrong cell marked, shows one sentence and keeps the notice", async () => {
  const root = fakeRoot();
  const { env, stage, host } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=2026&month=2&layout=names-any"), env);
  await settle(root, "2026-02");
  assert.equal(root.getAttribute("data-c7-any"), "best-effort");
  assert.equal(stage.configs.length, 1);
  const s = stateForDate(data, 2026, 2);
  assert.deepEqual(stage.configs[0].wrong, wrongStickerIndices(s.pose, s.wrong), "the sticker on the wrong cell is the one marked");
  assert.equal(stage.configs[0].wrong.length, 1);
  assert.equal(host.hidden, false);
  assert.equal(root.getAttribute("data-c7-digest"), stateDigest(printing, s.pose));
  assert.match(root.view.innerHTML, /Not exactly possible with this print: cell bottom right \(row 7, column 7\) differs\./);
  assert.doesNotMatch(root.view.innerHTML, /scan-fixed|corner demand|Julia/);
  assert.equal(root.el("layout-notice").textContent, ANY_DISPLAY_ONLY_NOTICE);
  assert.equal(root.el("player").hidden, true, "no move controls");
  inst.dispose();
});

test("an invalid year builds no cube and says so", async () => {
  for (const q of ["year=0&month=5", "year=10000&month=5", "year=2026&month=13"]) {
    const root = fakeRoot();
    const { env, stage } = setup();
    const inst = await mountCalendar7(root, new URLSearchParams(`${q}&layout=names-any`), env);
    for (let i = 0; i < 2000; i++) await Promise.resolve();
    assert.equal(root.getAttribute("data-c7-any"), "invalid", q);
    assert.match(root.view.innerHTML, /Invalid month/, q);
    assert.equal(stage.configs.length, 0);
    inst.dispose();
  }
});

test("the date form changes the month without rebuilding the cube, updates the address bar and keeps other parameters", async () => {
  const root = fakeRoot();
  const { env, stage, calls } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=1967&month=9&layout=names-any&kiosk=1"), env);
  await settle(root, "1967-09");
  const before = root.getAttribute("data-c7-digest");
  assert.equal(root.submit(2100, 2), true);
  await settle(root, "2100-02");
  assert.equal(stage.configs.length, 1, "same print: the cube is not rebuilt");
  assert.equal(stage.shows.length, 2);
  assert.notEqual(root.getAttribute("data-c7-digest"), before);
  assert.equal(root.getAttribute("data-c7-digest"), stateDigest(printing, stateForDate(data, 2100, 2).pose));
  assert.deepEqual(calls.query, ["?year=2100&month=2"]);
  assert.equal(root.submit(2026, 2), true);
  await settle(root, "2026-02");
  assert.equal(root.getAttribute("data-c7-any"), "best-effort");
  assert.equal(stage.configs.length, 2, "a different set of wrong stickers is another build");
  assert.equal(stage.configs[1].wrong.length, 1);
  assert.equal(root.submit(2028, 2), true);
  await settle(root, "2028-02");
  assert.equal(root.getAttribute("data-c7-any"), "state");
  assert.equal(stage.configs.length, 3);
  assert.deepEqual(stage.configs[2].wrong, []);
  inst.dispose();
  assert.equal(root.listeners.submit.size, 0);
});

test("names inside the window keeps the chain (no print B file is read); leaving it shows print B and coming back rebuilds the chain cube", async () => {
  const root = fakeRoot();
  const { env, stage, calls } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=2027&month=3&layout=names"), env);
  await settle(root, "2027-03");
  assert.equal(calls.fetched.filter((u) => u.includes("names-any")).length, 0);
  assert.equal(root.getAttribute("data-c7-any"), "off");
  assert.equal(root.getAttribute("data-c7-digest"), names.graph.nodes[10].hash);
  assert.match(root.view.innerHTML, /data-step="next"/);
  root.choose("layout", "names-any");
  await attr(root, "data-c7-any", "state");
  await settle(root, "2027-03");
  assert.equal(stage.configs.length, 2);
  assert.deepEqual([...stage.configs[1].printing.text], [...printing.text]);
  assert.doesNotMatch(root.view.innerHTML, /data-step=/);
  root.choose("layout", "names");
  await attr(root, "data-c7-any", "off");
  await settle(root, "2027-03");
  assert.equal(stage.configs.length, 3, "the chain cube is rebuilt from the chain print");
  assert.equal(root.getAttribute("data-c7-digest"), names.graph.nodes[10].hash);
  inst.dispose();
});

test("a failed print B download falls back to the standard layout with a notice and no thrown error", async () => {
  const root = fakeRoot();
  const { env, stage } = setup({ failAny: true });
  const inst = await mountCalendar7(root, new URLSearchParams("year=1967&month=9&layout=names-any"), env);
  for (let i = 0; i < 5000; i++) await Promise.resolve();
  assert.equal(root.el("layout-notice").textContent, NAMES_ANY_LOAD_NOTICE);
  assert.equal(root.el("layout-notice").hidden, false);
  assert.equal(root.getAttribute("data-c7-layout"), "standard");
  assert.equal(stage.configs.length, 0, "no cube for a month outside the standard chain");
  assert.notEqual(root.getAttribute("data-c7-state"), "failed");
  inst.dispose();
});

test("the standard layout never reads print B", async () => {
  const root = fakeRoot();
  const { env, calls } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=2027&month=3"), env);
  await settle(root, "2027-03");
  assert.equal(calls.fetched.filter((u) => u.includes("names-any")).length, 0);
  assert.equal(monthLabel({ year: 1967, month: 9 }), "September 1967");
  inst.dispose();
});

test("assignPieces moves an earlier cell to another piece when a later cell needs its first choice (augmenting path)", () => {
  // Cell 0 takes piece 1 first; cell 1 accepts only piece 1, so cell 0 must move to piece 2. Greedy matching leaves cell 1 unmatched.
  assert.deepEqual(assignPieces([[{ piece: 1 }, { piece: 2 }], [{ piece: 1 }]]), [1, 0]);
  // A chain of two moves, and a cell no piece can serve stays unmatched next to a maximum matching of the others.
  assert.deepEqual(assignPieces([[{ piece: 1 }, { piece: 2 }], [{ piece: 2 }, { piece: 3 }], [{ piece: 1 }], [{ piece: 1 }]]), [1, 1, 0, -1]);
});
