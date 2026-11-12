// SPDX-License-Identifier: AGPL-3.0-or-later
// The beam print is the one Calendar7 view. Historical layout parameters do not select another dataset.
import { test, expect } from "@playwright/test";

const ROOT = "#calendar7-root";
const at = (page, month) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", month, { timeout: 30000 });
const summary = (page, which) => page.locator(`.c7-step[data-step="${which}"] .c7-step-summary`);

test("the canonical calendar plays the beam steps: December 2026 is 51 moves and January 2027 is 81", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html?app=calendar7&year=2026&month=11");
  await at(page, "2026-11");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout-mode", "names");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names");
  await expect(page.getByRole("combobox", { name: "Cube layout", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-c7-demo]")).toContainText("not a final print");
  await expect(summary(page, "next")).toContainText("December 2026 · 51 moves");
  await expect(summary(page, "previous")).toContainText("October 2026 · 345 moves");
  await page.locator('a[data-nav="next"]').click();
  await at(page, "2026-12");
  await expect(summary(page, "previous")).toContainText("November 2026 · 51 moves");
  await expect(summary(page, "next")).toContainText("January 2027 · 81 moves");
  expect(await page.locator(".c7-sheet tr:first-child td .c7-cell-text").allTextContents()).toEqual(["DEC", "EMB", "ER", "", "", "", ""]);
  await page.locator('a[data-nav="next"]').click();
  await at(page, "2027-01");
  await expect(summary(page, "next")).toContainText("February 2027 · 90 moves");
  expect(errors).toEqual([]);
});

test("the chain ends in June 2027; July stays on the same print without a move sequence", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&year=2027&month=6&layout=names-demo");
  await at(page, "2027-06");
  await expect(page.locator('.c7-step[data-step="next"]')).toContainText("No later month");
  await expect(summary(page, "previous")).toContainText("May 2027 · 101 moves");
  await page.goto("/index.html?app=calendar7&year=2027&month=7&layout=names-demo");
  await at(page, "2027-07");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names");
  await expect(page.locator(".c7-step")).toHaveCount(0);
  await expect(page.locator("[data-c7-any-range]")).toContainText("Same beam preview print");
  await expect(page.locator("[data-c7-any-range]")).toContainText("Move reachability is unverified");
  expect(new URL(page.url()).searchParams.has("layout")).toBe(false);
});

test("every former layout parameter selects the canonical beam dataset, with no standard or print B fetch", async ({ page }) => {
  for (const layout of ["standard", "names", "names-demo", "names-any", "bogus"]) {
    const datasets = [];
    const record = (request) => { if (/\/calendar7\/(?:[^/]+\/)?(?:state|graph|displays|configs)\.v1\.json/.test(request.url())) datasets.push(new URL(request.url()).pathname); };
    page.on("request", record);
    await page.goto(`/index.html?app=calendar7&year=2026&month=11&layout=${layout}&scheme=paper-blue&font=quicksand&extra=keep`);
    await at(page, "2026-11");
    await expect(summary(page, "next")).toContainText("December 2026 · 51 moves");
    await expect(page.getByRole("combobox", { name: "Cube layout", exact: true })).toHaveCount(0);
    const query = new URL(page.url()).searchParams;
    expect(query.has("layout")).toBe(false);
    for (const [key, value] of [["app", "calendar7"], ["scheme", "paper-blue"], ["font", "quicksand"], ["extra", "keep"]]) expect(query.get(key)).toBe(value);
    expect(datasets).toEqual(expect.arrayContaining(["/calendar7/names-demo/state.v1.json", "/calendar7/names-demo/graph.v1.json", "/calendar7/names-demo/displays.v1.json"]));
    expect(datasets.every((path) => path.startsWith("/calendar7/names-demo/"))).toBe(true);
    page.off("request", record);
  }
});
