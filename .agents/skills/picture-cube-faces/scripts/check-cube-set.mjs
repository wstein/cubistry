#!/usr/bin/env node
/** Definition-of-Done checker for a picture-cube face set.
 *
 *   node check-cube-set.mjs <dir> [--n N | --n-range A-B] [options]
 *
 * <dir> holds the six faces U L F R B D (.svg, square, S x S px) and optionally net.svg. The cube size N is NOT part of a
 * theme: every face is sliced into N x N tiles exactly as the app does at runtime, for each N examined (default 2..7).
 *
 * HARD failures (exit 1): any file the app's SVG validator would reject (same allowlist, see src/svgcheck.mjs; faces,
 * net.svg and tile files), wrong face format or size, edge seams of the 12 shared edges (3 px band, mean, big-pixel
 * share and worst sticker segment), tile preview files that differ from the face crop, and flat stickers (lack of detail)
 * at a strict N. Everything else is a WARNING or INFORMATION.
 * INFORMATION (never a failure; the owner accepts equal-looking stickers and orientations, the cube then counts as
 * visually solved): per N the symmetry class of every sticker (none, 2-fold, 4-fold), groups of identical stickers,
 * groups of rotation twins, and for odd N which center stickers need no orientation. The classification is
 * packages/cube-appearance (loose level), reached through src/symmetry.mjs and is written to the json (key perN.<N>.classification).
 *
 * Options: --strict-n 2,3  --min-detail 0.08  --tol 0.03 (--sym-tol and --dup-tol are aliases)  --seam-mean 3  --seam-segment 9
 *          --max-face-kb 200  --max-tile-kb 30  --tile-tol 0.005
 *          --size-fail (budget overruns FAIL instead of warn)  --json <path> (default <dir>/tiles.json)
 * Exit code: 0 PASS, 1 FAIL, 2 usage or environment error (bad flag or number, unknown option, no browser).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { FACE_NAMES, EDGES, parseNSpec, parseTileId, stickerCount } from "../src/geometry.mjs";
import { findForbidden, styleAudit, checkSizes, checkTileFormat, faceRoot, DEFAULT_BUDGET } from "../src/rules.mjs";
import { MIN_DETAIL } from "../src/metrics.mjs";
import { classifyTiles, summarize, LOOSE_SHARE } from "../src/symmetry.mjs";
import { bandDiffs, edgeStats, seamVerdict, SEAM_MEAN_LIMIT, SEAM_SEGMENT_LIMIT, SEAM_BAND } from "../src/seams.mjs";

const PROBE = 80;
const TILE_TOL = 0.005; // share of pixels (channel difference > 64) allowed between a tile file and the face crop

/** Option table: type "num" (finite, > 0 unless min given), "int", "list" (comma separated integers), "str", "flag". */
const OPTIONS = {
  n: { type: "int" }, "n-range": { type: "str" }, "strict-n": { type: "list" }, json: { type: "str" },
  "min-detail": { type: "num", min: 0, max: 1 }, "tol": { type: "num", min: 0, max: 1 }, "sym-tol": { type: "num", min: 0, max: 1 }, "dup-tol": { type: "num", min: 0, max: 1 },
  "tile-tol": { type: "num", min: 0, max: 1 }, "seam-mean": { type: "num", min: 0, max: 255 }, "seam-segment": { type: "num", min: 0, max: 255 },
  "max-face-kb": { type: "num", min: 1 }, "max-tile-kb": { type: "num", min: 1 }, "size-fail": { type: "flag" },
};

/** Strict argv parser; throws Error(message) for unknown options, missing values and non-numeric numbers. */
function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { o._.push(a); continue; }
    const k = a.slice(2), spec = OPTIONS[k];
    if (!spec) throw new Error(`unknown option --${k}`);
    if (spec.type === "flag") { o[k] = true; continue; }
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) throw new Error(`option --${k} needs a value`);
    const num = (t) => { if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(t.trim())) throw new Error(`option --${k}: "${t}" is not a number`); return Number(t); };
    if (spec.type === "num") {
      const x = num(v);
      if (!Number.isFinite(x) || x < (spec.min ?? 0) || x > (spec.max ?? Infinity)) throw new Error(`option --${k}: ${v} is outside ${spec.min ?? 0}..${spec.max ?? "inf"}`);
      o[k] = x;
    } else if (spec.type === "int") {
      const x = num(v);
      if (!Number.isInteger(x)) throw new Error(`option --${k}: "${v}" is not an integer`);
      o[k] = String(x);
    } else if (spec.type === "list") {
      const xs = v.split(",").filter(Boolean).map(num);
      if (!xs.length || !xs.every((x) => Number.isInteger(x) && x >= 2 && x <= 7)) throw new Error(`option --${k}: "${v}" must be a comma separated list of integers from 2 to 7`);
      o[k] = xs;
    } else o[k] = v;
  }
  return o;
}

let opts;
try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); console.error("usage: check-cube-set.mjs <dir> [--n N | --n-range A-B] [--strict-n 2] [--json path] (see file header)"); process.exit(2); }
if (opts._.length !== 1) {
  console.error("usage: check-cube-set.mjs <dir> [--n N | --n-range A-B] [--strict-n 2] [--json path] (see file header)");
  process.exit(2);
}
const dir = resolve(opts._[0]);
if (!existsSync(dir) || !statSync(dir).isDirectory()) { console.error(`not a directory: ${dir}`); process.exit(2); }
let ns;
const strictN = opts["strict-n"] ?? [2];
try { ns = parseNSpec(opts.n, opts["n-range"]); } catch (e) { console.error(e.message); process.exit(2); }
const th = {
  minDetail: opts["min-detail"] ?? MIN_DETAIL,
  tol: opts.tol ?? opts["sym-tol"] ?? opts["dup-tol"] ?? LOOSE_SHARE,
  tileTol: opts["tile-tol"] ?? TILE_TOL,
  seamMean: opts["seam-mean"] ?? SEAM_MEAN_LIMIT,
  seamSegment: opts["seam-segment"] ?? SEAM_SEGMENT_LIMIT,
  budget: { faceKB: opts["max-face-kb"] ?? DEFAULT_BUDGET.faceKB, tileKB: opts["max-tile-kb"] ?? DEFAULT_BUDGET.tileKB },
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
const scan = (label, text, opt) => {
  for (const h of findForbidden(text, opt)) { forbiddenTotal++; forbiddenRows.push({ file: label, ...h }); fail(`${label}: ${h.id} x${h.count} (${h.why})`); }
};
for (const f of FACE_NAMES) scan(`${f}.svg`, faces[f]);
for (const t of tileFiles) scan(t.file, readFileSync(t.path, "utf8"));
const netPath = `${dir}/net.svg`;
if (existsSync(netPath)) scan("net.svg", readFileSync(netPath, "utf8"), { dimensions: false, size: false });
if (!forbiddenTotal) ok("every face, tile and the net pass the app's SVG allowlist (tags, attributes, decoded values, integer width/height <= 1024)");
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
  console.log(`     ${tileFiles.length} tile file(s) found (on-demand previews, or the shipped tiles of a 2x2 playground set): format-checked, compared with the face crop, never required`);
  for (const t of tileFiles) {
    const id = parseTileId(basename(t.file, ".svg"));
    for (const p of checkTileFormat(readFileSync(t.path, "utf8"), { r: id.r, c: id.c, tile: S / t.n })) fail(`${t.file}: ${p}`);
  }
}
if (!ns.some((n) => strictN.includes(n))) warn(`no strict N among the examined sizes (N = ${ns.join(",")}; strict = ${strictN.join(",")}): flat stickers are only warnings in this run. Add --strict-n ${ns[0]} to make them fail`);

// ---- 3. rendering: seams, tile previews and per-N classification ----------------------------------------------------
let browser;
try {
  const { openBrowser } = await import("../src/browser.mjs");
  browser = await openBrowser();
} catch (e) {
  console.error(`ERROR cannot start the browser: ${e.message}`);
  process.exit(2);
}
try {
  const { probeFace, compareTiles } = await import("../src/browser.mjs");
  const strips = {}, tilesByN = Object.fromEntries(ns.map((n) => [n, []]));
  for (const f of FACE_NAMES) {
    const probe = await probeFace(browser.page, faces[f], S, ns, PROBE, SEAM_BAND);
    strips[f] = probe.strips;
    for (const n of ns) for (const t of probe.tiles[n]) tilesByN[n].push({ id: `${f}_${t.r}_${t.c}`, px: new Uint8ClampedArray(Buffer.from(t.b64, "base64")) });
  }

  // tile files against the face crop (a bbox that culls visible art makes a tile differ from the face)
  result.tileCompare = { checked: 0, differing: [] };
  for (const f of FACE_NAMES) {
    const mine = tileFiles.filter((t) => basename(t.file).startsWith(`${f}_`) && Number.isInteger(S / t.n));
    if (!mine.length) continue;
    const items = mine.map((t) => { const id = parseTileId(basename(t.file, ".svg")); return { svg: readFileSync(t.path, "utf8"), r: id.r, c: id.c, n: t.n, file: t.file }; });
    const shares = await compareTiles(browser.page, faces[f], S, items);
    shares.forEach((x, k) => {
      result.tileCompare.checked++;
      if (x.share > th.tileTol) { result.tileCompare.differing.push({ file: items[k].file, share: +x.share.toFixed(4) }); fail(`${items[k].file}: differs from the ${f} face crop (${(x.share * 100).toFixed(2)}% of pixels, limit ${(th.tileTol * 100).toFixed(2)}%); check the {svg, bbox} of the art`); }
    });
  }
  if (result.tileCompare.checked && !result.tileCompare.differing.length) ok(`${result.tileCompare.checked} tile file(s) match the face crops`);

  // seams: 3 px band, mean, big-pixel share, worst sticker segment at the largest N examined
  const segN = Math.max(...ns);
  result.seams = [];
  let worst = 0;
  for (const e of EDGES) {
    const stats = edgeStats(bandDiffs(strips[e.a[0]][e.a[1]], strips[e.b[0]][e.b[1]], e.rev), segN);
    const good = seamVerdict(stats, { meanLimit: th.seamMean, segmentLimit: th.seamSegment });
    worst = Math.max(worst, stats.mean);
    result.seams.push({ edge: e.name, mean: +stats.mean.toFixed(2), max: +stats.max.toFixed(2), bigShare: +stats.bigShare.toFixed(4), worstSegment: +stats.worstSegment.toFixed(2), segmentMeans: stats.segmentMeans.map((v) => +v.toFixed(2)), segments: segN, band: SEAM_BAND, pass: good });
    if (!good) fail(`seam ${e.name}: mean diff ${stats.mean.toFixed(2)}/255 (limit ${th.seamMean}), worst sticker segment ${stats.worstSegment.toFixed(2)} (limit ${th.seamSegment}, ${segN} segments), ${(stats.bigShare * 100).toFixed(1)}% of pixels > 16`);
  }
  if (result.seams.every((x) => x.pass)) ok(`all 12 shared edges match over a ${SEAM_BAND} px band (worst mean difference ${worst.toFixed(2)}/255, limit ${th.seamMean}; worst segment limit ${th.seamSegment})`);
  console.log("     " + result.seams.map((x) => `${x.edge} ${x.mean}`).join("  "));

  // per N: classification (information) and flatness (hard at strict N)
  result.perN = {};
  for (const n of ns) {
    const c = classifyTiles(tilesByN[n], { n, probe: PROBE, minDetail: th.minDetail, tol: th.tol });
    const strict = strictN.includes(n);
    result.perN[n] = { stickers: stickerCount(n), strict, classification: c, pass: c.counts.lackDetail === 0 };
    const line = `N=${n} (${stickerCount(n)} stickers): ${summarize(c)}`;
    if (!c.counts.lackDetail) ok(line);
    else (strict ? fail : warn)(`${line}${strict ? "" : "  [warning: flat stickers at N >= 3: strictness is an owner decision]"}`);
    const show = (label, list) => list.length && console.log(`       ${label}: ${list.slice(0, 8).map((x) => (Array.isArray(x) ? `{${x.slice(0, 6).join(",")}${x.length > 6 ? ",..." : ""}}` : x)).join(" ")}${list.length > 8 ? ` ... (+${list.length - 8})` : ""}`);
    show("lack detail", c.lackDetail); show("identical (info)", c.identicalGroups); show("rotation twins (info)", c.rotationTwinGroups);
    if (c.centers.length) console.log(`       centers: ${c.centers.map((x) => `${x.face} ${x.symmetry}${x.orientationNeeded ? "" : " (no orientation needed)"}`).join(", ")}`);
  }
  await browser.close();
  browser = null;
} catch (e) {
  if (browser) await browser.close().catch(() => {});
  fail(`rendering failed: ${e.message}`);
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
