/** Playwright access (Chromium) for rasterizing svg. Resolution order for the module: the repo, CUBE_NODE_MODULES, /opt/node-tools.
 * Browser: CHROMIUM_PATH, else Playwright's default, else /opt/pw-browsers/chromium. */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

function loadPlaywright() {
  const roots = [import.meta.url, process.cwd() + "/", process.env.CUBE_NODE_MODULES && process.env.CUBE_NODE_MODULES.replace(/\/?$/, "/"), "/opt/node-tools/"].filter(Boolean);
  const errors = [];
  for (const root of roots) {
    const req = createRequire(root.startsWith("file:") || root.startsWith("/") ? root : import.meta.url);
    for (const name of ["@playwright/test", "playwright"]) {
      try { return req(name); } catch (e) { errors.push(`${name} from ${root}: ${e.code ?? e.message}`); }
    }
  }
  throw new Error(`Playwright not found (set CUBE_NODE_MODULES to a folder that contains node_modules/playwright):\n${errors.join("\n")}`);
}

/** Launches Chromium and returns {page, close}. */
export async function openBrowser(viewport = { width: 1200, height: 800 }) {
  const { chromium } = loadPlaywright();
  const args = process.getuid?.() === 0 || process.env.CUBE_NO_SANDBOX ? ["--no-sandbox"] : [];
  const candidates = [process.env.CHROMIUM_PATH, undefined, "/opt/pw-browsers/chromium"].filter((p, i) => i === 1 || (p && existsSync(p)));
  let lastError;
  for (const executablePath of candidates) {
    try {
      const browser = await chromium.launch({ args, ...(executablePath ? { executablePath } : {}) });
      const page = await browser.newPage({ viewport });
      return { page, close: () => browser.close() };
    } catch (e) { lastError = e; }
  }
  throw new Error(`could not launch Chromium: ${lastError?.message ?? "unknown error"}`);
}

export const dataUrl = (svg) => "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");

/** Rasterizes svg text to an n x n RGBA array (flat numbers). */
export async function rasterize(page, svg, n) {
  return page.evaluate(async ({ url, n }) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = new OffscreenCanvas(n, n);
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0, n, n);
    return Array.from(cx.getImageData(0, 0, n, n).data);
  }, { url: dataUrl(svg), n });
}

/**
 * Renders one face at S x S and returns (a) its four sides as bands of `band` outermost pixel lines (flat RGB arrays, outermost first) and (b) for every cube
 * size in `ns` the N x N tiles sliced from that rendering, each downsampled to probe x probe RGBA and base64 encoded.
 * Slicing the face render is exactly what the app does at runtime, so no tile files are needed.
 */
export async function probeFace(page, faceSvg, S, ns, probe = 80, band = 3) {
  return page.evaluate(async ({ url, S, ns, probe, band }) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = new OffscreenCanvas(S, S);
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0, S, S);
    const all = cx.getImageData(0, 0, S, S).data;
    const rgb = (x, y) => { const k = (y * S + x) * 4; return [all[k], all[k + 1], all[k + 2]]; };
    const strips = { top: [], bottom: [], left: [], right: [] };
    for (let d = 0; d < band; d++) {
      const t = [], bo = [], l = [], r = [];
      for (let i = 0; i < S; i++) { t.push(...rgb(i, d)); bo.push(...rgb(i, S - 1 - d)); l.push(...rgb(d, i)); r.push(...rgb(S - 1 - d, i)); }
      strips.top.push(t); strips.bottom.push(bo); strips.left.push(l); strips.right.push(r);
    }
    const pc = new OffscreenCanvas(probe, probe);
    const px = pc.getContext("2d", { willReadFrequently: true });
    const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s); };
    const tiles = {};
    for (const n of ns) {
      const t = S / n;
      tiles[n] = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        px.clearRect(0, 0, probe, probe);
        px.drawImage(cv, c * t, r * t, t, t, 0, 0, probe, probe);
        tiles[n].push({ r, c, b64: b64(px.getImageData(0, 0, probe, probe).data) });
      }
    }
    return { strips, tiles };
  }, { url: dataUrl(faceSvg), S, ns, probe, band });
}

/** Renders an html string and saves a full-page PNG. */
export async function screenshotHtml(page, html, path, width = 1700) {
  await page.setViewportSize({ width, height: 800 });
  await page.setContent(html);
  await page.waitForTimeout(200);
  await page.screenshot({ path, fullPage: true });
}

/**
 * Compares tile files with the same crop of the rendered face. items: [{svg, r, c, n}] (tile svg text, tile position,
 * cube size). Returns [{r, c, n, share}] where share is the fraction of pixels over `limit` (0 = identical rendering).
 */
export async function compareTiles(page, faceSvg, S, items, limit = 64) {
  return page.evaluate(async ({ face, S, items, limit, urls }) => {
    const load = async (url) => { const img = new Image(); img.src = url; await img.decode(); return img; };
    const fi = await load(face);
    const fc = new OffscreenCanvas(S, S), fx = fc.getContext("2d", { willReadFrequently: true });
    fx.drawImage(fi, 0, 0, S, S);
    const out = [];
    for (let k = 0; k < items.length; k++) {
      const { r, c, n } = items[k], t = Math.round(S / n);
      const ti = await load(urls[k]);
      const tc = new OffscreenCanvas(t, t), tx = tc.getContext("2d", { willReadFrequently: true });
      tx.drawImage(ti, 0, 0, t, t);
      const a = tx.getImageData(0, 0, t, t).data, b = fx.getImageData(Math.round(c * (S / n)), Math.round(r * (S / n)), t, t).data;
      let bad = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > limit || Math.abs(a[i + 1] - b[i + 1]) > limit || Math.abs(a[i + 2] - b[i + 2]) > limit) bad++;
      out.push({ r, c, n, share: bad / (t * t) });
    }
    return out;
  }, { face: dataUrl(faceSvg), S, items: items.map(({ r, c, n }) => ({ r, c, n })), limit, urls: items.map((it) => dataUrl(it.svg)) });
}
