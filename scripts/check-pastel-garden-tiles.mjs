/** Checks the Pastel Garden sticker tiles for puzzle legibility.
 * For each of the 24 tiles: it must not be mostly one flat color (so it can be placed),
 * and it must differ from its own 90/180/270 degree rotations (so orientation is readable).
 * Run: node scripts/check-pastel-garden-tiles.mjs   (needs Playwright's Chromium)
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
let pw;
try { pw = req("@playwright/test"); } catch { pw = req("playwright"); }
const { chromium } = pw;

const dir = new URL("../public/playground-pastel/", import.meta.url);
const MIN_DETAIL = 0.08; // share of pixels that are not the tile's dominant color
const MIN_ROT_DIFF = 0.03; // share of pixels that change under the least-different rotation
const faces = ["F", "B", "R", "L", "U", "D"];
const tiles = faces.flatMap((f) => [0, 1].flatMap((r) => [0, 1].map((c) => `${f}_${r}_${c}`)));

const browser = await chromium.launch();
const page = await browser.newPage();
let failed = 0;
const seen = new Map();
for (const id of tiles) {
  const svg = readFileSync(new URL(`${id}.svg`, dir), "utf8");
  const hash = createHash("sha256").update(svg).digest("hex");
  if (seen.has(hash)) { console.log(`FAIL ${id}: identical to ${seen.get(hash)}`); failed++; }
  seen.set(hash, id);
  const r = await page.evaluate(async ({ svg }) => {
    const img = new Image();
    img.src = "data:image/svg+xml;base64," + btoa(svg);
    await img.decode();
    const n = 80;
    const cv = new OffscreenCanvas(n, n);
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0, n, n);
    const d = cx.getImageData(0, 0, n, n).data;
    const q = (i) => [d[i] >> 4, d[i + 1] >> 4, d[i + 2] >> 4].join(",");
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4) hist.set(q(i), (hist.get(q(i)) ?? 0) + 1);
    const detail = 1 - Math.max(...hist.values()) / (n * n);
    const px = (x, y) => (y * n + x) * 4;
    const diff = (a, b) => {
      let k = 0;
      for (let c = 0; c < 3; c++) if (Math.abs(d[a + c] - d[b + c]) > 24) { k = 1; break; }
      return k;
    };
    const rots = [
      (x, y) => [n - 1 - y, x],
      (x, y) => [n - 1 - x, n - 1 - y],
      (x, y) => [y, n - 1 - x],
    ].map((m) => {
      let k = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const [u, v] = m(x, y); k += diff(px(x, y), px(u, v)); }
      return k / (n * n);
    });
    return { detail, minRot: Math.min(...rots) };
  }, { svg });
  const ok = r.detail >= MIN_DETAIL && r.minRot >= MIN_ROT_DIFF;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${id} detail=${(r.detail * 100).toFixed(1)}% rotation-diff=${(r.minRot * 100).toFixed(1)}%`);
}
await browser.close();
console.log(failed ? `${failed} tile check(s) failed` : "all 24 tiles pass");
process.exit(failed ? 1 : 0);
