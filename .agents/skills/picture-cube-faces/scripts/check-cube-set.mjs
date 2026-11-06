#!/usr/bin/env node
/** Definition-of-Done checker for a picture-cube face set.
 *
 *   node check-cube-set.mjs <dir> [--n N | --n-range A-B] [options]
 *
 * <dir> holds the six faces U L F R B D (.svg, square, S x S px). The cube size N is NOT part of a theme: every face is
 * sliced into N x N tiles exactly as the app does at runtime, for each N examined (default 2..7).
 *
 * Checks: forbidden constructs, style audit (advisory), file-size budget, face format, edge seams of all 12 shared
 * edges, and per N: tiles lacking detail, rotation-ambiguous tiles, identical tiles (and rotation twins).
 * Strictness: N listed in --strict-n (default 2) must be clean or the run FAILs; other N are reported as warnings
 * (strictness for N >= 3 is an open owner decision). Tile files, if present (legacy F_r_c.svg or tiles/nN/), are
 * format- and size-checked but are never required.
 *
 * Options: --strict-n 2,3  --min-detail 0.08  --min-rot 0.03  --seam-mean 3  --max-face-kb 200  --max-tile-kb 30
 *          --size-fail (budget overruns FAIL instead of warn)  --json <path> (default <dir>/tiles.json)
 * Exit code: 0 PASS, 1 FAIL, 2 usage or environment error.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { FACE_NAMES, EDGES, parseNSpec, parseTileId, stickerCount } from "../src/geometry.mjs";
import { findForbidden, styleAudit, checkSizes, checkTileFormat, faceRoot, DEFAULT_BUDGET } from "../src/rules.mjs";
import { MIN_DETAIL, MIN_ROT_DIFF, detailShare, rotationDiffs, rotatedSignatures, evaluateTiles } from "../src/metrics.mjs";
import { stripDiffs, edgeStats, seamVerdict, SEAM_MEAN_LIMIT } from "../src/seams.mjs";

const PROBE = 80;
const flags = new Set(["size-fail"]);

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      o[k] = flags.has(k) ? true : argv[++i];
    } else o._.push(argv[i]);
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts._[0]) {
  console.error("usage: check-cube-set.mjs <dir> [--n N | --n-range A-B] [--strict-n 2] [--json path] (see file header)");
  process.exit(2);
}
const dir = resolve(opts._[0]);
let ns, strictN;
try {
  ns = parseNSpec(opts.n, opts["n-range"]);
  strictN = (opts["strict-n"] ?? "2").split(",").filter(Boolean).map(Number);
} catch (e) { console.error(e.message); process.exit(2); }
const th = {
  minDetail: Number(opts["min-detail"] ?? MIN_DETAIL),
  minRot: Number(opts["min-rot"] ?? MIN_ROT_DIFF),
  seamMean: Number(opts["seam-mean"] ?? SEAM_MEAN_LIMIT),
  budget: { faceKB: Number(opts["max-face-kb"] ?? DEFAULT_BUDGET.faceKB), tileKB: Number(opts["max-tile-kb"] ?? DEFAULT_BUDGET.tileKB) },
};
const sizeFail = Boolean(opts["size-fail"]);

const fails = [], warns = [];
const fail = (m) => { fails.push(m); console.log(`FAIL ${m}`); };
const warn = (m) => { warns.push(m); console.log(`WARN ${m}`); };
const ok = (m) => console.log(`ok   ${m}`);
const kb = (b) => (b / 1024).toFixed(1) + " KB";
const result = { dir, thresholds: th, strictN, ns };

// ---- 1. files and face format --------------------------------------------------------------------------
const faces = {};
for (const f of FACE_NAMES) {
  const p = `${dir}/${f}.svg`;
  if (!existsSync(p)) { fail(`missing face file ${f}.svg`); continue; }
  faces[f] = readFileSync(p, "utf8");
}
if (Object.keys(faces).length < 6) finish();
let S = null;
for (const f of FACE_NAMES) {
  const root = faceRoot(faces[f]);
  if (!root || root.width !== root.height || !Number.isFinite(root.width) || root.viewBox?.trim() !== `0 0 ${root.width} ${root.height}`) {
    fail(`${f}.svg: root must be a square svg whose viewBox is "0 0 S S" (got ${JSON.stringify(root)})`);
  } else if (S === null) S = root.width;
  else if (root.width !== S) fail(`${f}.svg: face size ${root.width} differs from ${S}`);
}
if (S === null) finish();
result.faceSize = S;
const notDivisible = ns.filter((n) => S % n !== 0);
if (notDivisible.length) warn(`face size ${S}px is not divisible by N = ${notDivisible.join(", ")}: tiles are fractional pixels (420 divides 2..7)`);
else ok(`six faces, ${S} x ${S} px, divisible by every N examined`);

// ---- 2. forbidden constructs, style audit, size budget ----------------------------------------------------------
const tileFiles = [];
const addTileDir = (d, n) => {
  if (!existsSync(d)) return;
  const ids = readdirSync(d).filter((x) => /^[ULFRBD]_\d+_\d+\.svg$/.test(x));
  if (!ids.length) return;
  const maxIdx = Math.max(...ids.map((x) => parseTileId(x.replace(".svg", "")).r)) + 1;
  for (const x of ids) tileFiles.push({ file: `${d.slice(dir.length + 1) || "."}/${x}`.replace(/^\.\//, ""), path: `${d}/${x}`, n: n ?? maxIdx });
};
addTileDir(dir, null);
if (existsSync(`${dir}/tiles`)) for (const x of readdirSync(`${dir}/tiles`)) { const m = /^n(\d+)$/.exec(x); if (m) addTileDir(`${dir}/tiles/${x}`, Number(m[1])); }

let forbiddenTotal = 0;
const forbiddenRows = [];
const scan = (label, text) => {
  for (const h of findForbidden(text)) { forbiddenTotal++; forbiddenRows.push({ file: label, ...h }); fail(`${label}: forbidden <${h.id}> x${h.count} (${h.why})`); }
};
for (const f of FACE_NAMES) scan(`${f}.svg`, faces[f]);
for (const t of tileFiles) scan(t.file, readFileSync(t.path, "utf8"));
if (!forbiddenTotal) ok("no forbidden constructs (gradient, filter, clipPath, url(), text, image, script, ...)");
result.forbidden = forbiddenRows;

const audit = styleAudit(FACE_NAMES.map((f) => faces[f]).join(""));
result.styleAudit = audit;
if (audit.strokeColors.length > 1) warn(`style: ${audit.strokeColors.length} stroke colors (${audit.strokeColors.slice(0, 5).join(" ")}...); the style is ONE ink color`);
if (audit.strokeWidths.length > 3) warn(`style: ${audit.strokeWidths.length} stroke weights (${audit.strokeWidths.join(", ")}); the style is three line weights`);

const sizeEntries = FACE_NAMES.map((f) => ({ file: `${f}.svg`, bytes: Buffer.byteLength(faces[f]), kind: "face" }));
for (const t of tileFiles) sizeEntries.push({ file: t.file, bytes: Buffer.byteLength(readFileSync(t.path, "utf8")), kind: "tile" });
const sizes = checkSizes(sizeEntries, th.budget);
result.sizes = { budget: th.budget, faces: sizes.rows.filter((r) => r.kind === "face"), tileFiles: tileFiles.length, over: sizes.over.map((r) => ({ file: r.file, bytes: r.bytes, limit: r.limit })) };
const faceBytes = sizes.rows.filter((r) => r.kind === "face").map((r) => r.bytes);
console.log(`     face sizes: max ${kb(Math.max(...faceBytes))}, mean ${kb(faceBytes.reduce((a, b) => a + b, 0) / 6)} (budget ${th.budget.faceKB} KB per face, ${th.budget.tileKB} KB per tile file)`);
for (const r of sizes.over.slice(0, 8)) (sizeFail ? fail : warn)(`size: ${r.file} is ${kb(r.bytes)} > ${r.limit / 1024} KB budget`);
if (sizes.over.length > 8) (sizeFail ? fail : warn)(`size: ... and ${sizes.over.length - 8} more over budget`);
if (!sizes.over.length) ok("file sizes within budget");

if (tileFiles.length) {
  warn(`${tileFiles.length} tile file(s) found; tile files are not part of a theme (generated on demand), format-checked only`);
  for (const t of tileFiles) {
    const id = parseTileId(basename(t.file, ".svg"));
    for (const p of checkTileFormat(readFileSync(t.path, "utf8"), { r: id.r, c: id.c, tile: S / t.n })) fail(`${t.file}: ${p}`);
  }
}

// ---- 3. rendering: seams and per-N tile metrics -------------------------------------------------------------------
let browser;
try {
  const { openBrowser, probeFace } = await import("../src/browser.mjs");
  browser = await openBrowser();
  const strips = {}, tilesByN = Object.fromEntries(ns.map((n) => [n, []]));
  for (const f of FACE_NAMES) {
    const probe = await probeFace(browser.page, faces[f], S, ns, PROBE);
    strips[f] = probe.strips;
    for (const n of ns) for (const t of probe.tiles[n]) tilesByN[n].push({ id: `${f}_${t.r}_${t.c}`, px: new Uint8ClampedArray(Buffer.from(t.b64, "base64")) });
  }
  await browser.close();
  browser = null;

  // seams
  result.seams = [];
  let worst = 0;
  for (const e of EDGES) {
    const a = strips[e.a[0]][e.a[1]], b = strips[e.b[0]][e.b[1]];
    const stats = edgeStats(stripDiffs(a, b, e.rev));
    const good = seamVerdict(stats, { meanLimit: th.seamMean });
    worst = Math.max(worst, stats.mean);
    result.seams.push({ edge: e.name, mean: +stats.mean.toFixed(2), max: stats.max, bigShare: +stats.bigShare.toFixed(4), worstSegment: +stats.worstSegment.toFixed(2), pass: good });
    if (!good) fail(`seam ${e.name}: mean diff ${stats.mean.toFixed(2)}/255 (limit ${th.seamMean}), ${(stats.bigShare * 100).toFixed(1)}% of pixels > 16`);
  }
  if (result.seams.every((s) => s.pass)) ok(`all 12 shared edges match (worst mean difference ${worst.toFixed(2)}/255, limit ${th.seamMean})`);
  console.log("     " + result.seams.map((s) => `${s.edge} ${s.mean}`).join("  "));

  // tiles per N
  result.perN = {};
  for (const n of ns) {
    const measured = tilesByN[n].map((t) => ({
      id: t.id,
      detail: detailShare(t.px, PROBE),
      minRot: Math.min(...rotationDiffs(t.px, PROBE)),
      sigs: rotatedSignatures(t.px, PROBE),
    }));
    const ev = evaluateTiles(measured, th);
    const strict = strictN.includes(n);
    const problems = ev.lackDetail.length + ev.rotAmbiguous.length + ev.identical.length;
    result.perN[n] = {
      stickers: stickerCount(n), strict,
      counts: { lackDetail: ev.lackDetail.length, rotationAmbiguous: ev.rotAmbiguous.length, identicalGroups: ev.identical.length, rotationTwinGroups: ev.rotationTwins.length },
      lackDetail: ev.lackDetail, rotationAmbiguous: ev.rotAmbiguous, identical: ev.identical, rotationTwins: ev.rotationTwins,
      tiles: measured.map((t) => ({ id: t.id, detail: +t.detail.toFixed(3), rotDiff: +t.minRot.toFixed(3) })),
      pass: problems === 0,
    };
    const line = `N=${n} (${stickerCount(n)} stickers): ${ev.lackDetail.length} lack detail, ${ev.rotAmbiguous.length} rotation-ambiguous, ${ev.identical.length} identical group(s), ${ev.rotationTwins.length} rotation-twin group(s)`;
    if (!problems) ok(line);
    else (strict ? fail : warn)(`${line}${strict ? "" : "  [warning: strictness for N >= 3 is an owner decision]"}`);
    if (problems) {
      const show = (label, list) => list.length && console.log(`       ${label}: ${list.slice(0, 12).map((x) => (Array.isArray(x) ? `{${x.join(",")}}` : x)).join(" ")}${list.length > 12 ? ` ... (+${list.length - 12})` : ""}`);
      show("lack detail", ev.lackDetail); show("rotation-ambiguous", ev.rotAmbiguous); show("identical", ev.identical);
    }
  }
} catch (e) {
  if (browser) await browser.close().catch(() => {});
  console.error(`ERROR rendering failed: ${e.message}`);
  process.exit(2);
}
finish();

function finish() {
  result.fails = fails; result.warns = warns;
  result.verdict = fails.length ? "FAIL" : "PASS";
  const jsonPath = resolve(opts.json ?? `${dir}/tiles.json`);
  writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`\nRESULT: ${result.verdict} (${fails.length} fail, ${warns.length} warn; strict N = ${strictN.join(",") || "none"}; N examined = ${ns.join(",")})`);
  console.log(`json: ${jsonPath}`);
  process.exit(fails.length ? 1 : 0);
}
