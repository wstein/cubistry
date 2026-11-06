import { test, expect } from "@playwright/test";
test("built playground resolves picture tiles and authenticated solver under project base", async ({
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
  // #238, cause UNKNOWN: after selecting the application Playwright could not read the URL within the
  // 5 s default (`Received string: ""`, "waiting for navigation to finish"). Whole-test durations: failing
  // runs 12.9-13.3 s, passing runs 9.2-14.8 s. This waits longer; it does not remove a cause.
  await expect(page).toHaveURL(/\/cubistry\/playground.html$/, {
    timeout: 15000,
  });
  await expect(page.locator("#cube")).toHaveAttribute("data-ready", "true");
  await page.locator("#notation").fill("R L'");
  await page.locator("#notation").press("Enter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-equivalent",
    "true",
  );
  await expect(page.locator("#cube")).toHaveAttribute("data-exact", "false");
  await page.locator("#solve").click();
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-solver",
    "Verified",
  );
  await expect(page.locator("#cube")).toHaveAttribute("data-exact", "true");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(requests.some((p) => p.startsWith("/cubistry/playground/F_"))).toBe(
    true,
  );
  expect(requests.some((p) => /optimal-2x2.*\.bin/.test(p))).toBe(true);
  expect(requests.every((p) => p.startsWith("/cubistry/"))).toBe(true);
  expect(errors).toEqual([]);
});
