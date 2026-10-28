import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
for (const number of [52, 53])
  test(`PR${number} deep-base static preview renders real moves, noindex and reload without root asset leaks`, async ({
    page,
  }) => {
    const errors = [],
      bad = [],
      paths = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) bad.push(r.url());
    });
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.protocol === "http:") paths.push(u.pathname);
    });
    const prefix = `/cubistry/pr-preview/pr-${number}/`;
    await page.goto(`.${prefix.slice("/cubistry".length)}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
    await expect(
      page.getByText(`PR #${number} — non-production preview`, {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
    const before = PNG.sync.read(
      await page.locator("#cube canvas").screenshot(),
    );
    await page.locator('[data-delta="1"]').click();
    await expect(page.locator("#cube")).toHaveAttribute("data-value", "1");
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#move-progress")).toHaveText("5 / 5 moves");
    const after = PNG.sync.read(
      await page.locator("#cube canvas").screenshot(),
    );
    let changed = 0;
    for (let i = 0; i < before.data.length; i++)
      if (Math.abs(before.data[i] - after.data[i]) > 10) changed++;
    expect(changed).toBeGreaterThan(1000);
    await page.reload();
    await expect(page.locator("#cube")).toHaveAttribute("data-value", "1");
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
    expect(paths.every((p) => p.startsWith(prefix))).toBe(true);
    for (const suffix of [".js", ".css", ".svg", ".woff2", ".bin"])
      expect(paths.some((p) => p.endsWith(suffix))).toBe(true);
    expect(bad).toEqual([]);
    expect(errors).toEqual([]);
  });
test("production root remains present, indexable and interactive beside both previews", async ({
  page,
  request,
}) => {
  await page.goto("./");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(
    page.getByText("non-production preview", { exact: false }),
  ).toHaveCount(0);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  for (const number of [52, 53])
    expect(
      (await request.get(`pr-preview/pr-${number}/index.html`)).status(),
    ).toBe(200);
  expect((await request.get("pr-preview/pr-999/index.html")).status()).toBe(
    404,
  );
});
