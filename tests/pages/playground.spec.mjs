import { test, expect } from "@playwright/test";
test("built playground mode resolves picture tiles and authenticated solver under project base", async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  page.on("request", (r) => {
    if (r.url().startsWith("http")) requests.push(new URL(r.url()).pathname);
  });
  await page.goto("./counter.html");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.locator("#application").selectOption("playground");
  // Selecting the application starts a full page navigation to the host mode. In three Pages runs this URL check
  // failed at the 5 s default with `Received string: ""` while the log showed "waiting for navigation
  // to finish". Those runs took 12.9-13.3 s for the whole test; five passing runs took 10.3-14.8 s.
  // The cause is unknown (no trace was uploaded), so 15 s is a bounded allowance, not a diagnosis.
  await expect(page).toHaveURL(/\/cubistry\/index\.html\?app=playground$/, {
    timeout: 15000,
  });
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-ready", "true");
  await page.locator("#playground-notation").fill("R L'");
  await page.locator("#playground-notation").press("Enter");
  await expect(page.locator("#playground-cube")).toHaveAttribute(
    "data-equivalent",
    "true",
  );
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "false");
  await page.locator('[data-region="primary-action"] button').click();
  await expect(page.locator("#playground-cube")).toHaveAttribute(
    "data-solver",
    "Verified",
  );
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(requests.some((p) => p.startsWith("/cubistry/playground/F_"))).toBe(
    true,
  );
  expect(requests.some((p) => /optimal-2x2.*\.bin/.test(p))).toBe(true);
  expect(requests.every((p) => p.startsWith("/cubistry/"))).toBe(true);
  expect(errors).toEqual([]);
});

test("the retired page playground.html is not built: its URL answers 404 and the host mode answers 200", async ({
  request,
}) => {
  const old = await request.get("/cubistry/playground.html");
  expect(old.status()).toBe(404);
  const host = await request.get("/cubistry/index.html?app=playground");
  expect(host.status()).toBe(200);
});
