import { frontStickerPoint } from "../helpers/front-projection.mjs";
import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const values = [0, 7, 42, 58, 99],
  active = [
    "abcdef",
    "bc",
    "abdeg",
    "abcdg",
    "bcfg",
    "acdfg",
    "acdefg",
    "abc",
    "abcdefg",
    "abcdfg",
  ];
function renderedDigit(image, centerX) {
  const blue = ([r, g, b]) => b > r * 1.25 && b > g * 1.05;
  const sample = (px, py) => {
    const [x, y] = frontStickerPoint(image, centerX, -.5, px, py), colors = [];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const at = ((y + dy) * image.width + x + dx) * 4;
        colors.push([...image.data.slice(at, at + 3)]);
      }
    return colors.some(blue);
  };
  const centers = [
    [128, 48],
    [192, 84],
    [192, 168],
    [128, 208],
    [64, 168],
    [64, 84],
    [128, 128],
  ];
  return {
    segments: centers
      .map((p, i) => (sample(...p) ? "abcdefg"[i] : ""))
      .join(""),
    uprightBaseline: sample(128, 234),
  };
}
test("live solver selection executes fresh paths and actual rendered digits match five targets", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/solver-acceptance.html");
  await expect(page.locator("#cube")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#solve")).toBeEnabled();
  const cases = [];
  for (const value of values) {
    await page.locator("#goal").selectOption(String(value));
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/m1/solve") && r.request().method() === "POST",
    );
    await page.locator("#solve").click();
    const result = await (await response).json();
    expect(result.value).toBe(value);
    expect(result.solverInvocations).toBe(2);
    expect(result.backend.id).toBe("cubing/experimentalSolve2x2x2");
    cases.push(result);
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-verified",
      "true",
    );
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-value",
      String(value),
    );
    const image = PNG.sync.read(
      await page.locator("#cube canvas").screenshot(),
    );
    for (const [digit, center] of [
      [Math.floor(value / 10), -0.5],
      [value % 10, 0.5],
    ]) {
      const actual = renderedDigit(image, center);
      expect(actual.segments, `visible digit ${digit} at ${value}`).toBe(
        active[digit],
      );
      expect(actual.uprightBaseline).toBe(true);
    }
  }
  expect(errors).toEqual([]);
  const raw = readFileSync("public/counter-design.v2.json"),
    directory = mkdtempSync(join(tmpdir(), "cubistry-http-replay-"));
  try {
    const path = join(directory, "response.json");
    writeFileSync(
      path,
      JSON.stringify({
        schema: "cubistry.live-solver-evidence",
        version: 1,
        puzzle: "2x2x2",
        startWord: "R U F2 L' D B",
        designSHA256: createHash("sha256").update(raw).digest("hex"),
        cases,
      }),
    );
    const independent = JSON.parse(
      execFileSync(
        "python3",
        ["research/m1-acceptance/verify_live_solver.py", path],
        { encoding: "utf8" },
      ),
    );
    expect(independent.fullPhysicalTargets).toBe(5);
    expect(independent.exactInverseRestorations).toBe(5);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  await page.screenshot({
    path: "/tmp/cubistry-live-solver-99.png",
    fullPage: true,
  });
});
test("local solver harness rejects invalid methods, origin, types and excessive requests", async ({
  request,
}) => {
  expect((await request.get("/api/m1/solve")).status()).toBe(405);
  expect(
    (
      await request.post("/api/m1/solve", {
        headers: { "Content-Type": "text/plain" },
        data: '{"value":42}',
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post("/api/m1/solve", {
        headers: { Origin: "https://external.invalid" },
        data: { value: 42 },
      })
    ).status(),
  ).toBe(403);
  for (const data of [
    { value: "42" },
    { value: [42] },
    { value: true },
    { value: 41 },
    { value: 42, source: "arbitrary" },
    { value: 42, padding: "x".repeat(80) },
  ])
    expect((await request.post("/api/m1/solve", { data })).status()).toBe(400);
});
test("independent library-only consumer loads its own assets and restores rendered frames by inverse", async ({
  page,
}) => {
  const loaded = [];
  page.on("request", (r) => loaded.push(r.url()));
  await page.goto("/library-example.html");
  await expect(page.locator("#cube")).toHaveAttribute("data-ready", "true");
  const before = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  await page.locator("#turn").click();
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-at-source",
    "false",
  );
  const after = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  expect(Buffer.compare(before.data, after.data)).not.toBe(0);
  await page.locator("#inverse").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-at-source", "true");
  const restored = PNG.sync.read(
    await page.locator("#cube canvas").screenshot(),
  );
  let changed = 0;
  for (let i = 0; i < before.data.length; i++)
    if (Math.abs(before.data[i] - restored.data[i]) > 3) changed++;
  expect(changed / before.data.length).toBeLessThan(0.001);
  expect(
    loaded.some(
      (u) =>
        u.includes("/src/apps/counter/") ||
        u.includes("/counter-design") ||
        u.includes("/cubing/"),
    ),
  ).toBe(false);
  expect(loaded.some((u) => u.endsWith("/examples/arrow.svg"))).toBe(true);
  await page.screenshot({
    path: "/tmp/cubistry-library-only.png",
    fullPage: true,
  });
});

test("missing independent image asset produces a diagnostic instead of enabling moves", async ({
  page,
}) => {
  await page.route("**/examples/arrow.svg", (route) =>
    route.fulfill({ status: 404, contentType: "text/plain", body: "missing" }),
  );
  await page.goto("/library-example.html");
  await expect(page.locator("#status")).toHaveText("Asset could not be loaded");
  await expect(page.locator("#turn")).toBeDisabled();
  await expect(page.locator("#inverse")).toBeDisabled();
  await expect(page.locator("#cube")).not.toHaveAttribute("data-ready", "true");
});
