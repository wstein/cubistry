// SPDX-License-Identifier: AGPL-3.0-or-later
// The long chain C (public/calendar7/chain-c, January 2019 to January 2036) is the one Calendar7 view. Historical layout parameters
// do not select another dataset. Acceptance of the root month 2019-01 in the real app: the solved cube, white front in Rubik-Tint.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { DEFAULT_WORD_OPTIONS, stepNotation } from "../../src/apps/calendar7/notation.ts";
import { chainRange, stepFrom } from "../../src/apps/calendar7/month-view.ts";
import { parseGraph } from "../../src/apps/calendar7/graph.ts";

const ROOT = "#calendar7-root";
const graph = parseGraph(JSON.parse(readFileSync("public/calendar7/chain-c/graph.v1.json", "utf8")));
const range = chainRange(graph);
const moves = (year, month, dir) => stepNotation(stepFrom(graph, range, { year, month }, dir).moves, DEFAULT_WORD_OPTIONS).moves;
const at = (page, month) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", month, { timeout: 30000 });
const idle = (page) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "idle", { timeout: 30000 });
const summary = (page, which) => page.locator(`.c7-step[data-step="${which}"] .c7-step-summary`);
const canvas = (page) => page.locator("#studio-scene canvas");

test("the canonical calendar plays the chain steps: the step counts on the page are those of the stored words", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html?app=calendar7&year=2026&month=11");
  await at(page, "2026-11");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout-mode", "names");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names");
  await expect(page.getByRole("combobox", { name: "Cube layout", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-c7-chain]")).toContainText("January 2019 to January 2036, 204 steps");
  await expect(page.locator("body")).not.toContainText("DEMO");
  await expect(summary(page, "next")).toContainText(`December 2026 · ${moves(2026, 11, 1)} moves`);
  await expect(summary(page, "previous")).toContainText(`October 2026 · ${moves(2026, 10, 1)} moves`);
  await page.locator('a[data-nav="next"]').click();
  await at(page, "2026-12");
  expect(await page.locator(".c7-sheet tr:first-child td .c7-cell-text").allTextContents()).toEqual(["DEC", "EMB", "ER", "", "", "", ""]);
  expect(errors).toEqual([]);
});

test("the chain ends in January 2036; February 2036 stays on the same print without a move sequence", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&year=2036&month=1");
  await at(page, "2036-01");
  await expect(page.locator('.c7-step[data-step="next"]')).toContainText("No later month");
  await expect(summary(page, "previous")).toContainText(`December 2035 · ${moves(2035, 12, -1)} moves`);
  await page.goto("/index.html?app=calendar7&year=2036&month=2");
  await at(page, "2036-02");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names");
  await expect(page.locator(".c7-step")).toHaveCount(0);
  await expect(page.locator("[data-c7-any-range]")).toContainText("Same print C");
  await expect(page.locator("[data-c7-any-range]")).toContainText("Move reachability is unverified");
  expect(new URL(page.url()).searchParams.has("layout")).toBe(false);
});

test("every former layout parameter selects the canonical chain C dataset, with no standard or print B fetch", async ({ page }) => {
  for (const layout of ["standard", "names", "names-demo", "names-any", "bogus"]) {
    const datasets = [];
    const record = (request) => { if (/\/calendar7\/(?:[^/]+\/)?(?:state|graph|displays|configs|best-effort)\.v1\.json/.test(request.url())) datasets.push(new URL(request.url()).pathname); };
    page.on("request", record);
    await page.goto(`/index.html?app=calendar7&year=2026&month=11&layout=${layout}&scheme=paper-blue&font=quicksand&extra=keep`);
    await at(page, "2026-11");
    await expect(summary(page, "next")).toContainText(`December 2026 · ${moves(2026, 11, 1)} moves`);
    const query = new URL(page.url()).searchParams;
    expect(query.has("layout")).toBe(false);
    for (const [key, value] of [["app", "calendar7"], ["scheme", "paper-blue"], ["font", "quicksand"], ["extra", "keep"]]) expect(query.get(key)).toBe(value);
    expect(datasets.sort()).toEqual(["best-effort", "displays", "graph", "state"].map((n) => `/calendar7/chain-c/${n}.v1.json`));
    page.off("request", record);
  }
});

test("February 2026 is the best-effort chain month: the wrong cell is marked on the cube, the page says it, steps stay animated", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html?app=calendar7&year=2026&month=2");
  await at(page, "2026-02"); await idle(page);
  await expect(page.locator("[data-c7-best-effort]")).toHaveText("Not exactly possible with this print: cell bottom left (row 7, column 1) differs.");
  await expect(canvas(page)).toHaveAttribute("data-c7-wrong", /.+/);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "off");
  await expect(page.locator('a[data-nav="next"]')).toHaveCount(1);
  await expect(page.locator("[data-c7-sheet-hidden]")).toHaveCount(1);
  await page.locator('a[data-nav="next"]').click();
  await at(page, "2026-03"); await idle(page);
  await expect(canvas(page)).not.toHaveAttribute("data-c7-wrong", /.+/);
  await expect(page.locator("[data-c7-best-effort]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("root month 2019-01 in the real app: all 6 faces one color (the solved cube), the front face white in Rubik-Tint", async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html?app=calendar7&year=2019&month=1&scheme=rubik-tint");
  await at(page, "2019-01"); await idle(page);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-scheme", "rubik-tint");
  const graphJson = JSON.parse(readFileSync("public/calendar7/chain-c/graph.v1.json", "utf8"));
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", graphJson.nodes[0].hash);
  // Capture the live viewer of the page (the banner select calls setBannerStyle on it), then read the textures it drew.
  await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const original = Calendar7Viewer.prototype.setBannerStyle;
    Calendar7Viewer.prototype.setBannerStyle = function (style) { window.markerViewer = this; return original.call(this, style); };
  });
  await page.getByRole("combobox", { name: "Banner style", exact: true }).selectOption("rounded");
  const faces = await page.evaluate(async () => {
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const { RUBIK_TINTS, homeFacesOf, weekendGroundOf } = await import("/src/apps/calendar7/home-tint.ts");
    const { namesGround } = await import("/src/apps/calendar7/schemes.ts");
    const { printing, pose } = parseState(await (await fetch("/calendar7/chain-c/state.v1.json")).json());
    const homes = homeFacesOf(pose);
    const stickers = new Map();
    window.markerViewer.presentation.traverse((o) => { if (o.userData.stickerId !== undefined) stickers.set(o.userData.stickerId, o); });
    const hex = (d, w) => "#" + [0, 1, 2].map((k) => d[(3 * w + 3) * 4 + k].toString(16).padStart(2, "0")).join("");
    const out = {};
    for (let i = 0; i < 294; i++) {
      const o = 3 * i, key = `${pose.normal[o]},${pose.normal[o + 1]},${pose.normal[o + 2]}`;
      const c = stickers.get(i + 1).material.map.image;
      const corner = hex(c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data, c.width);
      const tint = namesGround(RUBIK_TINTS[homes[i]]), weekend = namesGround(weekendGroundOf(RUBIK_TINTS[homes[i]]));
      const face = (out[key] ??= { count: 0, homes: new Set(), off: 0, tint: null });
      face.count++;
      face.homes.add(homes[i]);
      face.tint = RUBIK_TINTS[homes[i]];
      if (corner !== tint && !(printing.ink[i] === "red" && corner === weekend)) face.off++;
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { count: v.count, homes: [...v.homes], off: v.off, tint: v.tint }]));
  });
  expect(Object.keys(faces)).toHaveLength(6);
  for (const [key, face] of Object.entries(faces)) {
    expect(face.count, key).toBe(49);
    expect(face.homes, `face ${key} shows one home color`).toHaveLength(1);
    expect(face.off, `face ${key}: every drawn tile has the tint of its face or its weekend ground`).toBe(0);
  }
  expect(new Set(Object.values(faces).map((f) => f.tint)).size).toBe(6);
  expect(faces["0,0,1"]).toMatchObject({ homes: ["white"], tint: "#ffffff" });
  expect(errors).toEqual([]);
});
