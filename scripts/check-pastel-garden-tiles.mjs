/** Checks the playground sticker tiles for puzzle legibility: Pastel Garden and every picture theme.
 * For each of the 24 tiles of a set: it must not be mostly one flat color (so it can be placed),
 * and it must differ from its own 90/180/270 degree rotations (so orientation is readable).
 * Run: node scripts/check-pastel-garden-tiles.mjs [--sizes] [pastel|<theme id>...]   (needs Playwright's Chromium)
 * Without set names it checks Pastel Garden (plus its Up/Down proposals) and every public/playground-<id>/ theme.
 * A theme stores six whole faces (SVG, or lossy WebP); its stickers are the n x n crops of each face (the run-time slicing).
 * Size 2 is checked tile by tile and gates the exit code. With --sizes the sizes 3..7 are also measured with the
 * same thresholds and reported as one summary line per size: stickers that are mostly flat, stickers that are
 * (nearly) rotation symmetric, and stickers that render identically to another sticker of the theme. Those
 * counts are information about the artwork, not failures.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { measureRgba, SAMPLE, MIN_DETAIL, MIN_ROT_DIFF } from "../src/apps/playground/suitability.ts";

const req = createRequire(import.meta.url);
let pw;
try { pw = req("@playwright/test"); } catch { pw = req("playwright"); }
const { chromium } = pw;

const faces = ["F", "B", "R", "L", "U", "D"];
const tiles = faces.flatMap((f) => [0, 1].flatMap((r) => [0, 1].map((c) => `${f}_${r}_${c}`)));

// CHROMIUM_PATH optionally selects a specific browser binary (e.g. a preinstalled Chromium).
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] } : {},
);
const page = await browser.newPage();
let failed = 0;

// The sticker is rendered in the page; the measures come from the shared pure module that the
// playground's live suitability display also uses (src/apps/playground/suitability.ts).
async function measure(svg) {
  const pixels = await page.evaluate(async ({ svg, n }) => {
    const img = new Image();
    img.src = "data:image/svg+xml;base64," + btoa(svg);
    await img.decode();
    const cv = new OffscreenCanvas(n, n);
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0, n, n);
    return Array.from(cx.getImageData(0, 0, n, n).data);
  }, { svg, n: SAMPLE });
  const { detail, minRot, hash } = measureRgba(pixels, SAMPLE);
  return { detail, minRot, hash };
}
// A sticker of a raster face: the pixel crop [x, y, w, h] of the whole face, drawn at the sample size.
async function measureCrop(bytes, crop) {
  const pixels = await page.evaluate(async ({ b64, crop, n }) => {
    const img = new Image();
    img.src = "data:image/webp;base64," + b64;
    await img.decode();
    const cv = new OffscreenCanvas(n, n);
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, ...crop, 0, 0, n, n);
    return Array.from(cx.getImageData(0, 0, n, n).data);
  }, { b64: bytes.toString("base64"), crop, n: SAMPLE });
  const { detail, minRot, hash } = measureRgba(pixels, SAMPLE);
  return { detail, minRot, hash };
}
function report(label, r) {
  const ok = r.detail >= MIN_DETAIL && r.minRot >= MIN_ROT_DIFF;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} detail=${(r.detail * 100).toFixed(1)}% rotation-diff=${(r.minRot * 100).toFixed(1)}%`);
}

async function checkTiles(dir, prefix) {
  const seen = new Map();
  for (const id of tiles) {
    const svg = readFileSync(new URL(`${id}.svg`, dir), "utf8");
    const hash = createHash("sha256").update(svg).digest("hex");
    if (seen.has(hash)) { console.log(`FAIL ${prefix}${id}: identical to ${seen.get(hash)}`); failed++; }
    seen.set(hash, id);
    report(`${prefix}${id}`, await measure(svg));
  }
}
// Stickers of a theme for cube size n: viewBox crops of its whole faces (same cut as the run-time slicing).
async function measureTheme(theme, n) {
  const dir = new URL(`../public/playground-${theme}/`, import.meta.url);
  const out = [];
  for (const f of faces) {
    if (existsSync(new URL(`${f}.webp`, dir))) {
      // Whole square raster face: same rounded edges as tileEdges() in themes.ts, on its pixel size.
      const bytes = readFileSync(new URL(`${f}.webp`, dir));
      const size = bytes.readUInt16LE(26) & 16383;
      const e = Array.from({ length: n + 1 }, (_, k) => Math.round((k * size) / n));
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
        out.push({ id: `${f}_${r}_${c}`, ...(await measureCrop(bytes, [e[c], e[r], e[c + 1] - e[c], e[r + 1] - e[r]])) });
      continue;
    }
    const face = readFileSync(new URL(`${f}.svg`, dir), "utf8");
    const edges = Array.from({ length: n + 1 }, (_, k) => Math.round((k * 320) / n));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const box = `${edges[c]} ${edges[r]} ${edges[c + 1] - edges[c]} ${edges[r + 1] - edges[r]}`;
      const svg = face.replace('width="320" height="320" viewBox="0 0 320 320"', `width="160" height="160" viewBox="${box}"`);
      if (svg === face) throw Error(`${theme}/${f}.svg: unexpected header`);
      out.push({ id: `${f}_${r}_${c}`, ...(await measure(svg)) });
    }
  }
  return out;
}
async function checkTheme(theme, sizes) {
  for (const n of sizes) {
    const tiles = await measureTheme(theme, n);
    const first = new Map();
    let identical = 0, flat = 0, symmetric = 0;
    for (const t of tiles) {
      if (first.has(t.hash)) { identical++; if (n === 2) { console.log(`FAIL ${theme}/${t.id}: identical to ${first.get(t.hash)}`); failed++; } }
      else first.set(t.hash, t.id);
      if (t.detail < MIN_DETAIL) flat++;
      if (t.minRot < MIN_ROT_DIFF) symmetric++;
      if (n === 2) report(`${theme}/${t.id}`, t);
    }
    if (sizes.length > 1 || n !== 2)
      console.log(`${theme} n=${n}: ${tiles.length} stickers, flat(detail<${MIN_DETAIL * 100}%) ${flat}, rotation-symmetric(diff<${MIN_ROT_DIFF * 100}%) ${symmetric}, identical-to-another ${identical}`);
  }
}
const themeIds = readdirSync(new URL("../public/", import.meta.url))
  .filter((d) => /^playground-[a-z]+$/.test(d) && d !== "playground-pastel")
  .map((d) => d.slice("playground-".length));
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const allSizes = process.argv.includes("--sizes");
for (const w of wanted) if (w !== "pastel" && !themeIds.includes(w)) { console.error(`FAIL unknown set: ${w}`); await browser.close(); process.exit(1); }
const runPastel = !wanted.length || wanted.includes("pastel");
const runThemes = wanted.length ? themeIds.filter((t) => wanted.includes(t)) : themeIds;
for (const theme of runThemes) await checkTheme(theme, allSizes ? [2, 3, 4, 5, 6, 7] : [2]);
if (runPastel) await checkTiles(new URL("../public/playground-pastel/", import.meta.url), "");
// Alternative Up/Down proposals (full 320x320 faces): check each of their four stickers.
// These are the proposals written by scripts/build-pastel-garden-art.mjs (U0 and D0 are the
// previous faces and are not checked). A missing file is an error, not a skip: an entry
// that is intentionally absent must be removed from this list.
for (const id of runPastel ? ["U1", "U2", "U3", "U4", "U5", "U5b", "D1", "D2", "D3", "D4", "D5"] : []) {
  const file = new URL(`../assets/playground-pastel-proposals/${id}.svg`, import.meta.url);
  let face;
  try { face = readFileSync(file, "utf8"); } catch (error) {
    console.error(`FAIL ${id}: expected proposal file is missing or unreadable: assets/playground-pastel-proposals/${id}.svg (${error.code ?? error.message})`);
    await browser.close();
    process.exit(1);
  }
  for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]])
    report(`${id}_${r}_${c}`, await measure(face.replace('width="320" height="320" viewBox="0 0 320 320"', `width="160" height="160" viewBox="${c * 160} ${r * 160} 160 160"`)));
}
await browser.close();
console.log(failed ? `${failed} tile check(s) failed` : "all tiles pass");
process.exit(failed ? 1 : 0);
