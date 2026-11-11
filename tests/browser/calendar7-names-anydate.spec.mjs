// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout for any date, display only (print B). The 3D scene is WebGL, so the front of the cube is read from the
// pose the page shows: the page publishes the digest of that pose (data-c7-digest); the spec recomputes the pose of the date's
// configuration from the data files in the page and reads the front stickers (month name tiles, weekday of the 1st).
import { test, expect } from "@playwright/test";

const ROOT = "#calendar7-root";
const at = (page, month) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", month, { timeout: 30000 });
const idle = (page) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "idle", { timeout: 30000 });
const NOTICE = "Display only: no move sequence for this date (print B).";

/** In the page: the front of the cube for a date by the repo's own modules: digest, row 1 texts and the text at (row, column). */
const faceOf = (page, year, month) =>
  page.evaluate(async ([y, m]) => {
    const { parseAnyData, stateForDate } = await import("/src/apps/calendar7/anydate.ts");
    const { stateDigest } = await import("/src/apps/calendar7/engine.ts");
    const get = (n) => fetch(`/calendar7/names-any/${n}`).then((r) => r.json());
    const data = parseAnyData(await get("state.v1.json"), await get("configs.v1.json"));
    const s = stateForDate(data, y, m);
    if (s.kind !== "state") return { kind: s.kind };
    const { printing } = data.start;
    const front = new Map();
    for (let i = 0; i < 294; i++)
      if (s.pose.normal[3 * i + 2] === 1 && s.pose.pos[3 * i + 2] === 3) front.set(`${4 - s.pose.pos[3 * i + 1]},${s.pose.pos[3 * i] + 4}`, printing.text[i]);
    return { kind: "state", digest: stateDigest(printing, s.pose), row1: [1, 2, 3, 4, 5, 6, 7].map((c) => front.get(`1,${c}`)), first: [1, 2, 3, 4, 5, 6, 7].map((c) => front.get(`3,${c}`)) };
  }, [year, month]);

test("September 1967 in the names layout: no chain notice, the 3D face shows SEPTEMBER and a Friday start, display only", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html?app=calendar7&layout=names&year=1967&month=9");
  await at(page, "1967-09");
  await idle(page);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names");
  await expect(page.locator("body")).not.toContainText("outside the proven chain");
  await expect(page.locator("body")).not.toContainText("Showing the standard layout");
  await expect(page.getByRole("status").filter({ hasText: NOTICE })).toBeVisible();
  await expect(page.locator(".c7-month")).toHaveText("September 1967");
  await expect(page.locator(".c7-step")).toHaveCount(0);
  await expect(page.locator("#studio-scene canvas")).toHaveAttribute("aria-label", /September 1967, display only/);
  expect(await page.locator(".c7-sheet tr:first-child td .c7-cell-text").allTextContents()).toEqual(["SEP", "TEM", "BER", "", "", "", ""]);
  const face = await faceOf(page, 1967, 9);
  expect(face.row1.slice(0, 3)).toEqual(["SEP", "TEM", "BER"]);
  expect(face.first).toEqual(["", "", "", "", "", "1", "2"]); // 1 September 1967 is a Friday, the 2nd a Saturday
  expect(await page.locator(ROOT).getAttribute("data-c7-digest")).toBe(face.digest);
  expect(errors).toEqual([]);
});

test("February 2026 is a best-effort cube with one sentence; the technical reason is not on the page", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&layout=names&year=2026&month=2");
  await at(page, "2026-02");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "best-effort");
  await expect(page.locator("[data-c7-best-effort]")).toHaveText("Not exactly possible with this print: cell bottom right (row 7, column 7) differs.");
  await expect(page.locator("#studio-scene")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("No state for this date");
  await expect(page.getByRole("status").filter({ hasText: NOTICE })).toBeVisible();
});

test("February 2000, 2024 (leap) and 2100 (not leap) show their own boards; the date form changes the date", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&layout=names&year=2100&month=2");
  await at(page, "2100-02");
  await idle(page);
  const days = () => page.locator(".c7-sheet td .c7-cell-text").allTextContents();
  let cells = await days();
  expect(cells).toContain("28");
  expect(cells).not.toContain("29");
  const digests = new Set([await page.locator(ROOT).getAttribute("data-c7-digest")]);
  expect(digests.has((await faceOf(page, 2100, 2)).digest)).toBe(true);
  for (const [year, label] of [[2000, "2000"], [2024, "2024"]]) {
    await page.getByLabel("Year").fill(label);
    await page.getByLabel("Month").selectOption("2");
    await page.getByRole("button", { name: "Show" }).click();
    await at(page, `${year}-02`);
    await idle(page);
    await expect(page).toHaveURL(new RegExp(`year=${year}&month=2`));
    cells = await days();
    expect(cells).toContain("29");
    const digest = await page.locator(ROOT).getAttribute("data-c7-digest");
    expect(digest).toBe((await faceOf(page, year, 2)).digest);
    digests.add(digest);
  }
  expect(digests.size).toBe(3);
});

test("the shipped window keeps its chain: May 2026 to January 2028 show Previous and Next in the names layout, and names-any shows the same dates display only", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&layout=names&year=2027&month=3");
  await at(page, "2027-03");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "off");
  await expect(page.locator('.c7-step[data-step="next"] .c7-nav')).toContainText("April 2027");
  await page.goto("/index.html?app=calendar7&layout=names-any&year=2027&month=3");
  await at(page, "2027-03");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await expect(page.locator(".c7-step")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Cube layout", exact: true })).toHaveValue("names-any");
});

test("an invalid year shows the reason and no cube", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&layout=names&year=0&month=5");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "invalid", { timeout: 30000 });
  await expect(page.locator(".c7-unavailable")).toContainText("year must be from 1 to 9999");
  await expect(page.locator("#studio-scene")).toBeHidden();
});
