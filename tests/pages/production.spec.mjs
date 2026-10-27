import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { readFile } from "node:fs/promises";
const active = [
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
  const scale =
    image.height / (2 * Math.tan((36 * Math.PI) / 360) * (5.3 - 1.021));
  const blue = ([r, g, b]) => b > r * 1.25 && b > g * 1.05;
  const sample = (px, py) => {
    const x = Math.round(
        image.width / 2 + (centerX + (px / 256 - 0.5) * 0.87) * scale,
      ),
      y = Math.round(
        image.height / 2 - (-0.52 + (0.5 - py / 256) * 0.87) * scale,
      ),
      colors = [];
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

test("built Pages counter resolves immutable assets under project base and renders legal goal animations", async ({
  page,
}) => {
  const errors = [],
    requests = [],
    failures = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    const url = new URL(r.url());
    // Locally created immutable bitmap blob URLs are not HTTP asset requests.
    if (url.protocol === "http:" || url.protocol === "https:") requests.push(url.pathname);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(r.url());
  });
  await page.goto("./");
  await expect(
    page.getByText("Development Preview", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "15");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  for (const value of [42, 43, 7, 99]) {
    await page.locator("#value").fill(String(value));
    await page.locator("#jump-form button").click();
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-value",
      String(value),
    );
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#move-progress")).toHaveAttribute(
      "data-state",
      "completed",
    );
    if (value === 43)
      await expect(page.locator("#move-progress")).toHaveText("10 / 10 moves");
    const image = PNG.sync.read(
      await page.locator("#cube canvas").screenshot(),
    );
    for (const [digit, center] of [
      [Math.floor(value / 10), -0.52],
      [value % 10, 0.52],
    ]) {
      const actual = renderedDigit(image, center);
      expect(actual.segments).toBe(active[digit]);
      expect(actual.uprightBaseline, `upright baseline ${value}/${digit}`).toBe(true);
    }
  }
  expect(requests.filter((p) => !p.startsWith("/cubistry/"))).toEqual([]);
  expect(requests.some((p) => p === "/cubistry/counter-design.v2.json")).toBe(
    true,
  );
  expect(requests.some((p) => p.endsWith(".svg"))).toBe(true);
  expect(requests.some((p) => p.endsWith(".woff2"))).toBe(true);
  expect(requests.some((p) => p.endsWith(".js"))).toBe(true);
  expect(requests.some((p) => p.endsWith(".css"))).toBe(true);
  expect(requests.filter((p) => p.endsWith(".bin"))).toHaveLength(1);
  const source = await page.request.get("./licenses/puzlwerk/source.json");
  expect(source.ok()).toBe(true);
  expect((await source.json()).commit).toBe(JSON.parse(await readFile("puzlwerk-source.json", "utf8")).commit);
  const license = await page.request.get("./licenses/puzlwerk/COPYING");
  expect(license.ok()).toBe(true);
  expect(await license.text()).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "/tmp/cubistry-pages-preview.png",
    fullPage: true,
  });
});
test("built examples retain asset base and solver acceptance stays disabled", async ({
  page,
}) => {
  await page.goto("./solver-acceptance.html");
  await expect(page.locator("#status")).toContainText("development-only");
  await expect(page.locator("#solve")).toBeDisabled();
  await page.goto("./library-example.html");
  await expect(page.locator("#cube")).toHaveAttribute("data-ready", "true");
  await page.locator("#turn").click();
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-at-source",
    "false",
  );
  await page.locator("#inverse").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-at-source", "true");
});

test("published proof and design bytes retain canonical identity and missing paths really fail", async ({ request }) => {
  for (const path of ["counter-proof.json", "counter-design.v2.json"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/json");
    expect(Buffer.compare(await response.body(), await readFile(`public/${path}`))).toBe(0);
  }
  expect((await request.get("assets/missing.svg")).status()).toBe(404);
  expect((await request.get("/counter-design.v2.json")).status()).toBe(404);
});
