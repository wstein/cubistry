import { test, expect } from "@playwright/test";
test("built Quality Cube loads certificate and20 vector assets below Pages prefix and performs category events", async ({
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
  await expect(page.locator("#status-build")).toBeEnabled();
  await expect(page.locator("canvas")).toHaveCount(1);
  for (const state of ["running", "ok", "error", "blocked", "open"]) {
    await page.selectOption("#status-build", state);
    await expect(page.locator("#status-viewer")).toHaveAttribute(
      "data-current",
      `${state},open,open,open`,
    );
    await expect(page.locator("#status-viewer")).toHaveAttribute(
      "data-sync",
      "idle",
    );
  }
  await page.click("#status-burst");
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-current",
    "ok,ok,ok,ok",
  );
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "idle",
  );
  expect(paths.some((p) => p.endsWith("/assets/quality/distances.u8"))).toBe(
    true,
  );
  expect(
    new Set(paths.filter((p) => p.endsWith(".svg") && p.includes("/quality/")))
      .size,
  ).toBe(20);
  expect(paths.every((p) => p.startsWith("/cubistry/"))).toBe(true);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});
