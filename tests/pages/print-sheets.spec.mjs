import { test, expect } from "@playwright/test";

test("built print downloads stay beneath the static deployment base", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("print.html?design=de-a");
  await expect(page.locator("#print-design")).toBeEnabled();
  await expect(page.locator("#print-size")).toHaveValue("16");
  const link = page.locator("#print-pdf");
  await expect(link).toHaveAttribute(
    "href",
    /\/cubistry\/print\/de-a-16mm-2sets\/print\.pdf$/,
  );
  const response = await page.request.get(await link.getAttribute("href"));
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
  await expect(page.locator("#print-preview")).toHaveJSProperty(
    "complete",
    true,
  );
  expect(errors).toEqual([]);
});
