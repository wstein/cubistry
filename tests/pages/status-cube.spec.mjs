import { test, expect } from "@playwright/test";
test("built status cube loads fixed assets below the deployment prefix and performs physical event playback", async ({
  page,
}) => {
  const errors = [],
    failed = [],
    paths = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol === "http:") paths.push(u.pathname);
  });
  await page.goto("./status.html");
  await expect(page.locator("#status-select")).toBeEnabled();
  await expect(page.locator("canvas")).toHaveCount(1);
  for (const [id, label] of [
    ["planning", "P L A N"],
    ["coding", "C O D E"],
    ["testing", "T E S T"],
    ["review", "R E V W"],
    ["done", "D O N E"],
  ]) {
    await page.selectOption("#status-select", id);
    await expect(page.locator("#status-viewer")).toHaveAttribute(
      "data-current",
      id,
    );
    await expect(page.locator("#status-viewer")).toHaveAttribute(
      "data-sync",
      "idle",
    );
    await expect(page.locator("#status-front")).toHaveText(label);
  }
  await page.click("#status-burst");
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-current",
    "done",
  );
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "idle",
  );
  expect(
    paths.some((p) => p.endsWith("/fonts/noto-sans-latin-800.woff2")),
  ).toBe(true);
  expect(paths.every((p) => p.startsWith("/cubistry/"))).toBe(true);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});
