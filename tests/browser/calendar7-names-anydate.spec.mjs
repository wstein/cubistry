// SPDX-License-Identifier: AGPL-3.0-or-later
// Dates outside the stored chain use the same physical print. Front matching is display only, not a reachability proof.
import { test, expect } from "@playwright/test";


const pickerTrigger = (page) => page.getByRole("button", { name: /^Choose month and year/ });
async function pickDate(page, year, month) {
  await pickerTrigger(page).click();
  await page.getByRole("button", { name: "Choose year", exact: true }).click();
  const jump = page.getByRole("spinbutton", { name: "Jump to year" });
  await jump.fill(String(year)); await jump.press("Enter");
  await page.getByRole("gridcell", { name: String(year), exact: true }).click();
  const name = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, month - 1, 1)));
  await page.getByRole("gridcell", { name: name + " " + year, exact: true }).click();
}

const ROOT = "#calendar7-root";
const at = (page, month) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", month, { timeout: 30000 });
const idle = (page) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "idle", { timeout: 30000 });
const NOTICE = "Display only: no move sequence for this date (print D).";

/** Recompute the displayed front from the canonical physical print, not from a second any-date dataset. */
const faceOf = (page, year, month) => page.evaluate(async ([y, m]) => {
  const { previewForDate, stateForDate } = await import("/src/apps/calendar7/anydate.ts");
  const { parseState } = await import("/src/apps/calendar7/graph.ts");
  const { stateDigest } = await import("/src/apps/calendar7/engine.ts");
  const start = parseState(await (await fetch("/calendar7/chain-c/state.v1.json")).json());
  const state = stateForDate(previewForDate(start, y, m), y, m);
  if (state.kind !== "state" && state.kind !== "best-effort") return { kind: state.kind };
  const front = new Map();
  for (let i = 0; i < 294; i++) if (state.pose.normal[3 * i + 2] === 1 && state.pose.pos[3 * i + 2] === 3)
    front.set(`${4 - state.pose.pos[3 * i + 1]},${state.pose.pos[3 * i] + 4}`, start.printing.text[i]);
  return { kind: state.kind, digest: stateDigest(start.printing, state.pose), row1: [1, 2, 3, 4, 5, 6, 7].map((c) => front.get(`1,${c}`)), first: [1, 2, 3, 4, 5, 6, 7].map((c) => front.get(`3,${c}`)) };
}, [year, month]);

test("September 1967 shows SEPTEMBER and a Friday start on the canonical print, display only", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html?app=calendar7&layout=names&year=1967&month=9");
  await at(page, "1967-09"); await idle(page);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names");
  await expect(page.locator("body")).not.toContainText("Showing the standard layout");
  await expect(page.getByRole("status").filter({ hasText: NOTICE })).toBeVisible();
  await expect(page.locator("[data-c7-any-range]")).toContainText("Move reachability is unverified");
  await expect(page.locator("body")).not.toContainText("Print B");
  await expect(page.locator(".c7-month")).toHaveText("September 1967");
  await expect(page.locator(".c7-step")).toHaveCount(0);
  await expect(page.locator("#studio-scene canvas")).toHaveAttribute("aria-label", /September 1967, display only/);
  expect(await page.locator(".c7-sheet tr:first-child td .c7-cell-text").allTextContents()).toEqual(["SEP", "TEM", "BER", "", "", "", ""]);
  const face = await faceOf(page, 1967, 9);
  expect(face.row1.slice(0, 3)).toEqual(["SEP", "TEM", "BER"]);
  expect(face.first).toEqual(["", "", "", "", "", "1", "2"]);
  expect(await page.locator(ROOT).getAttribute("data-c7-digest")).toBe(face.digest);
  expect(errors).toEqual([]);
});

test("February 2037 (off the chain) marks its actual mismatch without claiming UNSAT or exposing technical diagnostics", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&layout=names&year=2037&month=2");
  await at(page, "2037-02"); await idle(page);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "best-effort");
  await expect(page.locator("[data-c7-best-effort]")).toHaveText("Preview mismatch: cell bottom right (row 7, column 7) differs.");
  await expect(page.locator("#studio-scene")).toBeVisible();
  await expect(page.locator("#studio-scene canvas")).toHaveAttribute("data-c7-wrong", /.+/);
  await expect(page.locator(".c7-step")).toHaveCount(0);
  const text = await page.locator("body").innerText();
  for (const word of ["No state for this date", "UNSAT", "Not exactly possible", "NOMATCH", "Print B"]) expect(text).not.toContain(word);
  await expect(page.getByRole("status").filter({ hasText: NOTICE })).toBeVisible();
});

test("February 2000, 2040 and 2100 keep their leap-year boards; the date picker commits without Show", async ({ page }) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/index.html?app=calendar7&layout=names&year=2100&month=2&scheme=paper-blue&font=quicksand&extra=keep");
  await at(page, "2100-02"); await idle(page);
  const days = () => page.locator(".c7-sheet td .c7-cell-text").allTextContents();
  let cells = await days(); expect(cells).toContain("28"); expect(cells).not.toContain("29");
  await expect(page.getByRole("button", { name: "Show", exact: true })).toHaveCount(0);
  const digests = new Set([await page.locator(ROOT).getAttribute("data-c7-digest")]);
  expect(digests.has((await faceOf(page, 2100, 2)).digest)).toBe(true);
  for (const year of [2000, 2040]) {
    await pickDate(page, year, 2);
    await at(page, `${year}-02`); await idle(page);
    await expect(pickerTrigger(page)).toBeFocused();
    cells = await days(); expect(cells).toContain("29");
    const digest = await page.locator(ROOT).getAttribute("data-c7-digest");
    expect(digest).toBe((await faceOf(page, year, 2)).digest); digests.add(digest);
    const query = new URL(page.url()).searchParams;
    for (const [key, value] of [["app", "calendar7"], ["year", String(year)], ["month", "2"], ["scheme", "paper-blue"], ["font", "quicksand"], ["extra", "keep"]]) expect(query.get(key)).toBe(value);
  }
  expect(digests.size).toBe(3);
  expect(errors).toEqual([]);
});

test("every old layout URL uses the same stored chain inside its window", async ({ page }) => {
  const digests = [];
  for (const layout of ["names", "names-any", "names-demo", "standard"]) {
    await page.goto(`/index.html?app=calendar7&layout=${layout}&year=2027&month=3`);
    await at(page, "2027-03"); await idle(page);
    await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "off");
    await expect(page.locator('.c7-step[data-step="next"] .c7-nav')).toContainText("April 2027");
    await expect(page.getByRole("combobox", { name: "Cube layout", exact: true })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("layout")).toBe(false);
    digests.push(await page.locator(ROOT).getAttribute("data-c7-digest"));
  }
  expect(new Set(digests).size).toBe(1);
});

test("an invalid URL year shows the reason and no cube; incomplete picker edits do not navigate", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&layout=names&year=0&month=5");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "invalid", { timeout: 30000 });
  await expect(page.locator(".c7-unavailable")).toContainText("year must be from 1 to 9999");
  await expect(page.locator("#studio-scene")).toBeHidden();
  await expect(pickerTrigger(page)).toBeVisible();
  await pickDate(page, 2099, 12);
  await at(page, "2099-12"); await idle(page);
  expect(await page.locator(".c7-sheet tr:first-child td .c7-cell-text").allTextContents()).toEqual(["DEC", "EMB", "ER", "", "", "", ""]);
  await expect(page.locator(".c7-step")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Cube layout", exact: true })).toHaveCount(0);
  const url = page.url(), digest = await page.locator(ROOT).getAttribute("data-c7-digest");
  await pickerTrigger(page).click();
  await page.getByRole("button", { name: "Choose year", exact: true }).click();
  for (const value of ["", "0", "10000"]) {
    const jump = page.getByRole("spinbutton", { name: "Jump to year" });
    await jump.fill(value); await jump.press("Enter");
    await expect(jump).toHaveAttribute("aria-invalid", "true");
    expect(page.url()).toBe(url);
    await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", digest);
  }
});
