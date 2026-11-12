// SPDX-License-Identifier: AGPL-3.0-or-later
// A mismatch preserves its actual printing and adds only translucent hatching over the whole flat face.
import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";

const ROOT = "#calendar7-root";
const MIN_COS = 0.35;
const at = (page, month) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", month, { timeout: 30000 });
const idle = (page) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "idle", { timeout: 30000 });
const canvas = (page) => page.locator("#studio-scene canvas");
const luminance = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const quantile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];

// Exact reference comparisons need one 2D readback backend; frequent reads must not trigger a GPU/CPU rounding switch.
// WebGL context creation and the renderer are untouched.
async function stableCanvasReadback(page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "2d") return original.call(this, type, { ...args[0], willReadFrequently: true });
      return original.apply(this, [type, ...args]);
    };
  });
}
const open = async (page, year, scheme = "paper-red") => {
  await page.goto(`/index.html?app=calendar7&year=${year}&month=2&scheme=${scheme}`);
  await at(page, `${year}-02`); await idle(page);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "best-effort");
  await expect(canvas(page)).toHaveAttribute("data-c7-wrong", /.+/);
};
async function captureViewer(page) {
  await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const original = Calendar7Viewer.prototype.setBannerStyle;
    Calendar7Viewer.prototype.setBannerStyle = function (style) {
      window.markerViewer = this;
      return original.call(this, style);
    };
  });
  await page.getByRole("combobox", { name: "Banner style", exact: true }).selectOption("theme");
}

async function rawStrip(page) {
  return page.evaluate(async () => {
    const v = window.markerViewer, i = [...v.wrongIds][0], id = i + 1;
    const { faceFlatShare } = await import("/src/apps/calendar7/geometry.ts");
    const { tileRoles, tileGrid } = await import("/src/apps/calendar7/sticker-art.ts");
    let actual;
    v.presentation.traverse((o) => {
      const ids = o.userData.sourceFaceStickerIds;
      if (!ids || !Array.isArray(o.material)) return;
      const face = ids.indexOf(id);
      if (face >= 0) actual = o.material[face].map.image;
    });
    const reference = document.createElement("canvas");
    reference.width = actual.width; reference.height = actual.height;
    const text = v.printing.text[i], ink = v.printing.ink[i], tile = v.tiles[i];
    v.draw(reference, text, ink, tile, false);
    const ctx = actual.getContext("2d"), original = reference.getContext("2d");
    const a = ctx.getImageData(0, 0, actual.width, actual.height).data;
    const b = original.getImageData(0, 0, actual.width, actual.height).data;
    const W = actual.width, H = actual.height;
    // This rectangle is independently derived from the physical flat-face contract, not from wrongCellRect().
    const flatW = W * faceFlatShare(tile?.w ?? 1), flatH = H * faceFlatShare(tile?.h ?? 1);
    const rect = { x: (W - flatW) / 2, y: (H - flatH) / 2, w: flatW, h: flatH };
    // The numeral box: the middle half of the flat face, where the printed label sits.
    const label = { x0: rect.x + rect.w / 4, x1: rect.x + rect.w * 3 / 4, y0: rect.y + rect.h / 4, y1: rect.y + rect.h * 3 / 4 };
    let labelPixels = 0, labelKept = 0;
    const role = tileRoles(v.scheme, text, ink, "names"), grid = tileGrid(tile);
    const color = [1, 3, 5].map((j) => parseInt(role.ink.slice(j, j + 2), 16));
    let inkKept = 0, outsideChanged = 0, lanePixels = 0, laneChanged = 0, originalInkPixels = 0, light = 0, dark = 0;
    const lightColors = [], darkColors = [], scan = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4, changed = [0, 1, 2, 3].some((k) => a[p + k] !== b[p + k]);
      // A single boundary pixel belongs to the clipped/antialiased edge, not to the unchanged upper region.
      const aroundLane = x >= Math.floor(rect.x) - 1 && x <= Math.ceil(rect.x + rect.w) + 1 && y >= Math.floor(rect.y) - 1 && y <= Math.ceil(rect.y + rect.h) + 1;
      const inLane = x >= Math.ceil(rect.x) && x < Math.floor(rect.x + rect.w) && y >= Math.ceil(rect.y) && y < Math.floor(rect.y + rect.h);
      if (!aroundLane && changed) outsideChanged++;
      if (x >= Math.ceil(grid.cell.x0) && x < Math.floor(grid.cell.x1) && color.every((c, k) => Math.abs(b[p + k] - c) < 16)) { originalInkPixels++; if (!changed) inkKept++; }
      if (x >= label.x0 && x < label.x1 && y >= label.y0 && y < label.y1) { labelPixels++; if (!changed) labelKept++; }
      if (inLane) {
        lanePixels++; if (changed) laneChanged++;
        if (changed && Math.min(a[p], a[p + 1], a[p + 2]) > 230) { light++; lightColors.push([a[p], a[p + 1], a[p + 2]]); }
        if (changed && Math.max(a[p], a[p + 1], a[p + 2]) < 125) { dark++; darkColors.push([a[p], a[p + 1], a[p + 2]]); }
      }
      if (y === Math.floor(rect.y + rect.h / 2) && x >= Math.ceil(rect.x) && x < Math.floor(rect.x + rect.w)) scan.push(changed);
    }
    let runs = 0; for (let k = 0; k < scan.length; k++) if (scan[k] && !scan[k - 1]) runs++;
    // Prove repeated transparent gaps instead of imposing an arbitrary unchanged-area percentage.
    const gaps = [];
    for (let start = 0; start < scan.length;) {
      if (scan[start]) { start++; continue; }
      let end = start; while (end < scan.length && !scan[end]) end++;
      if (start > 0 && end < scan.length && end - start >= 2) gaps.push(end - start);
      start = end;
    }
    window.markerCanvas = actual;
    window.markerArtwork = v.art.find((entry) => entry.canvas === actual);
    const row = 4 - v.pose.pos[3 * i + 1], column = v.pose.pos[3 * i] + 4;
    const desired = document.querySelectorAll(".c7-sheet tr")[row - 1].children[column - 1].textContent;
    return { id, text, desired, ink, W, H, rect, flatH, flatW, labelPixels, labelKept, inkKept, outsideChanged, lanePixels, laneChanged, originalInkPixels, light, dark, lightColors, darkColors, runs, gaps, expectedFill: role.fill, actualFill: v.cube.faceColorOf.get(id), stable: ctx.getContextAttributes().willReadFrequently && original.getContextAttributes().willReadFrequently };
  });
}

async function projectedStrip(page) {
  return page.evaluate(async () => {
    const v = window.markerViewer, mesh = v.wrongMeshes[0];
    const Vector3 = v.camera.position.constructor, Quaternion = v.camera.quaternion.constructor;
    const { NAMES_GAP, bevelRadius, outerLayerWidth, CALENDAR7_SIZE } = await import("/src/apps/calendar7/geometry.ts");
    const tile = v.tiles[mesh.userData.stickerId - 1], q = mesh.getWorldQuaternion(new Quaternion());
    const normal = new Vector3(0, 0, 1).applyQuaternion(q);
    const calendarQ = v.presentation.getWorldQuaternion(new Quaternion());
    const right = new Vector3(1, 0, 0).applyQuaternion(calendarQ), up = new Vector3(0, 1, 0).applyQuaternion(calendarQ);
    const center = mesh.parent.getWorldPosition(new Vector3()).addScaledVector(normal, (outerLayerWidth(CALENDAR7_SIZE) - NAMES_GAP) / 2);
    const flat = (width) => width - NAMES_GAP - 2 * bevelRadius(width - NAMES_GAP);
    const i = mesh.userData.stickerId - 1, quarterTurned = v.pose.up[3 * i] !== 0;
    const w = flat(quarterTurned ? tile.h : tile.w), h = flat(quarterTurned ? tile.w : tile.h), W = v.host.clientWidth, H = v.host.clientHeight;
    const point = (x, y) => { const p = center.clone().addScaledVector(right, x).addScaledVector(up, y).project(v.camera); return { x: (p.x + 1) * W / 2, y: (1 - p.y) * H / 2 }; };
    const cos = normal.dot(v.camera.position.clone().sub(center).normalize());
    return { cos, corners: [point(-w / 2, -h / 2), point(w / 2, -h / 2), point(w / 2, h / 2), point(-w / 2, h / 2)] };
  });
}
async function unmark(page, restore) {
  await page.evaluate(async (restore) => {
    const v = window.markerViewer, c = window.markerCanvas, a = window.markerArtwork, ctx = c.getContext("2d");
    if (restore) ctx.putImageData(window.savedMarkerPixels, 0, 0);
    else { window.savedMarkerPixels = ctx.getImageData(0, 0, c.width, c.height); v.draw(c, a.text, a.ink, a.tile, false); }
    a.texture.needsUpdate = true; v.dirty = true;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, restore);
}
const inPolygon = (x, y, vertices) => {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
async function photograph(page, geometry) {
  const marked = PNG.sync.read(await canvas(page).screenshot());
  await unmark(page, false);
  let plain;
  try { plain = PNG.sync.read(await canvas(page).screenshot()); } finally { await unmark(page, true); }
  const scale = marked.width / (await canvas(page).evaluate((el) => el.clientWidth));
  const corners = geometry.corners.map(({ x, y }) => ({ x: x * scale, y: y * scale }));
  const box = { x0: Math.min(...corners.map((p) => p.x)) - 2 * scale, x1: Math.max(...corners.map((p) => p.x)) + 2 * scale, y0: Math.min(...corners.map((p) => p.y)) - 2 * scale, y1: Math.max(...corners.map((p) => p.y)) + 2 * scale };
  let inside = 0, outside = 0; const levels = [];
  for (let y = 0; y < marked.height; y++) for (let x = 0; x < marked.width; x++) {
    const i = (y * marked.width + x) * 4;
    if (inPolygon(x + 0.5, y + 0.5, corners)) levels.push(luminance([...marked.data.slice(i, i + 3)]));
    if (Math.max(...[0, 1, 2].map((k) => Math.abs(marked.data[i + k] - plain.data[i + k]))) < 8) continue;
    if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) outside++;
    if (inPolygon(x + 0.5, y + 0.5, corners)) inside++;
  }
  return { inside, outside, contrast: levels.length ? contrast(quantile(levels, 0.9), quantile(levels, 0.1)) : 1 };
}
const drag = async (page, dx, dy) => {
  const box = await canvas(page).boundingBox(), x = box.x + box.width / 2, y = box.y + box.height * 0.85;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(600);
};

test("February 2037 and 2043 keep one mismatch sentence and the accessible intended calendar without proof claims", async ({ page }) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await open(page, 2037);
  const digest = await page.locator(ROOT).getAttribute("data-c7-digest");
  await expect(page.locator("[data-c7-best-effort]")).toHaveText("Preview mismatch: cell bottom right (row 7, column 7) differs.");
  const box = await page.locator("[data-c7-sheet-hidden]").boundingBox();
  expect(box.width).toBeLessThanOrEqual(1); expect(box.height).toBeLessThanOrEqual(1);
  await expect(page.locator("[data-c7-sheet-hidden] .c7-sheet")).toHaveAttribute("aria-label", "7x7 calendar sheet, February 2037");
  await expect(page.locator("[data-c7-any-range]")).toContainText("Move reachability is unverified");
  const text = await page.locator("body").innerText();
  for (const word of ["scan-fixed", "corner demand", "Julia", "NOMATCH", "No state for this date", "UNSAT"]) expect(text).not.toContain(word);
  expect(await page.locator(".c7-sheet tr:first-child td .c7-cell-text").allTextContents()).toEqual(["FE", "BRU", "ARY", "", "", "", ""]);
  await open(page, 2043); expect(await page.locator(ROOT).getAttribute("data-c7-digest")).toBe(digest);
  expect(errors).toEqual([]);
});

for (const scheme of ["paper-red", "dracula"]) test(`${scheme}: the original printed face keeps only a translucent whole-face hatch through three views`, async ({ page }) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await stableCanvasReadback(page); await open(page, 2037, scheme); await captureViewer(page);
  const raw = await rawStrip(page);
  expect(raw.stable).toBe(true);
  expect(raw.text).not.toBe(raw.desired);
  expect(raw.outsideChanged, "no gray wash, frame or changed printing outside the flat face").toBe(0);
  expect(raw.inkKept, "pixels of the printed label stay exactly as printed between the hatch lines").toBeGreaterThan(30);
  expect(raw.inkKept / raw.originalInkPixels, "the hatch leaves at least 35 percent of the label ink untouched").toBeGreaterThan(0.35);
  expect(raw.labelKept / raw.labelPixels, "the hatch leaves at least 40 percent of the label area untouched").toBeGreaterThan(0.4);
  expect(raw.lanePixels, "the hatch covers the whole flat face").toBeGreaterThan(raw.flatW * raw.flatH * 0.9);
  expect(raw.actualFill, "the cut faces retain the original role fill").toBe(raw.expectedFill);
  expect(raw.laneChanged).toBeGreaterThan(raw.lanePixels * 0.05);
  expect(raw.gaps.length, "at least six internal transparent gaps each preserve two exact original pixels").toBeGreaterThanOrEqual(6);
  expect(raw.runs, "repeated hatch lines instead of one diagonal").toBeGreaterThanOrEqual(6);
  expect(raw.light).toBeGreaterThan(10); expect(raw.dark).toBeGreaterThan(10);
  expect(contrast(quantile(raw.lightColors.map(luminance), 0.5), quantile(raw.darkColors.map(luminance), 0.5))).toBeGreaterThan(4.5);
  const views = [];
  for (const [dx, dy] of [[0, 0], [-90, 20], [60, -30], [-120, -60]]) {
    if (dx || dy) await drag(page, dx, dy);
    const geometry = await projectedStrip(page);
    if (geometry.cos < MIN_COS) continue;
    const photo = await photograph(page, geometry); views.push(photo);
    expect(photo.inside, "the hatch is visible on the projected physical face").toBeGreaterThan(8);
    expect(photo.outside, "no marker outside the flat face").toBe(0);
    expect(photo.contrast, "light/dark hatch contrast after perspective and lighting").toBeGreaterThan(1.5);
  }
  expect(views.length).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test("an exact month removes the hatch and its mismatch metadata", async ({ page }) => {
  await open(page, 2037);
  await page.getByRole("button", { name: /^Choose month and year/ }).click();
  await page.getByRole("button", { name: "Choose year", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Jump to year" }).fill("2024");
  await page.getByRole("spinbutton", { name: "Jump to year" }).press("Enter");
  await page.getByRole("gridcell", { name: "2024", exact: true }).click();
  await page.getByRole("gridcell", { name: "February 2024", exact: true }).click();
  await at(page, "2024-02"); await idle(page);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await expect(canvas(page)).not.toHaveAttribute("data-c7-wrong", /.+/);
  await expect(page.locator("[data-c7-best-effort]")).toHaveCount(0);
  await expect(page.locator(".c7-sheet")).toBeVisible();
});
