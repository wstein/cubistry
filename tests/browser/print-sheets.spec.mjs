import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("calendar print downloads preserve the selected physical print and exact preset bytes", async ({
  page,
}) => {
  await page.goto("/calendar.html");
  await expect(page.locator("#calendar-design")).toBeEnabled();
  await page.selectOption("#calendar-design", "en-3");
  await page.locator("#print-stickers").click();
  await expect(page.locator("#print-design")).toBeEnabled();
  await expect(page.locator("#print-design")).toHaveValue("en-3");
  await expect(page.locator("#print-size")).toHaveValue("16");
  await expect(page.locator("#print-summary")).toHaveText(
    "2 complete cubes · 108 stickers · 1 A4 sheet",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#print-pdf").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("en-3-16mm-2sets-print.pdf");
  const bytes = readFileSync(await download.path());
  const catalog = JSON.parse(readFileSync("public/print/catalog.json"));
  const entry = catalog.entries.find((e) => e.id === "en-3-16mm-2sets");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    entry.files["print.pdf"],
  );
  await page.selectOption("#print-size", "15");
  await expect(page.locator("#print-pdf")).toHaveAttribute(
    "href",
    /en-3-15mm-2sets\/print\.pdf$/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.locator("html").evaluate((el) => el.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(page.locator("#print-pdf")).toBeVisible();
  await page.screenshot({
    path: "test-results/print-page-mobile.png",
    fullPage: true,
  });
});

test("HSM word lettering opens the corresponding whole-cube sheet, including all unit words", async ({
  page,
}) => {
  await page.goto("/clock.html?lettering=words");
  await expect(page.locator("#clock-lettering")).toBeEnabled();
  await page.locator("#print-stickers").click();
  await expect(page.locator("#print-design")).toHaveValue("hsm-words");
  await expect(page.locator("#print-summary")).toHaveText(
    "3 complete cubes · 72 stickers · 1 A4 sheet",
  );
  await expect(page.locator("#print-pdf")).toHaveAttribute(
    "href",
    /hsm-words-20mm-3sets\/print\.pdf$/,
  );
  await page.goto("/?application=hsm-counter&lettering=words");
  await expect(page.locator("#hsm-lettering")).toBeEnabled();
  await page.locator("#print-stickers").click();
  await expect(page.locator("#print-design")).toHaveValue("hsm-words");
  await page.selectOption("#print-design", "hsm-symbols");
  await expect(page.locator("#print-bundle")).toHaveAttribute(
    "href",
    /hsm-symbols-20mm-3sets\/bundle\.zip$/,
  );
});

test("a rejected print catalog leaves no clickable manufacturing downloads", async ({
  page,
}) => {
  await page.route("**/print/catalog.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: '{"schema":"bad","entries":[]}',
    }),
  );
  await page.goto("/print.html");
  await expect(page.locator("#print-error")).toHaveText(
    "Invalid print catalog",
  );
  await expect(page.locator("#print-pdf")).toBeHidden();
  await expect(page.locator("#print-design")).toBeDisabled();
  await expect(page.locator("#print-summary")).toHaveText(
    "No print files are available.",
  );
  await expect(page.locator("#print-preview")).toBeHidden();
});
