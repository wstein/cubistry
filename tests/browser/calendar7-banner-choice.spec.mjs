// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";

const pickerTrigger = (page) => page.getByRole("button", { name: /^Choose month and year/ });
async function pickDate(page, year, month) {
  await pickerTrigger(page).click();
  await page.getByRole("button", { name: "Choose year", exact: true }).click();
  const jump = page.getByRole("spinbutton", { name: "Jump to year" });
  await jump.fill(String(year));
  await jump.press("Enter");
  await page.getByRole("gridcell", { name: String(year), exact: true }).click();
  const name = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  );
  await page.getByRole("gridcell", { name: name + " " + year, exact: true }).click();
}

const ROOT = "#calendar7-root";
const at = async (page, month) => {
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", month, { timeout: 30000 });
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "idle", { timeout: 30000 });
};

// Frequent byte reads otherwise migrate Chromium's 2D canvas backend and change edge rounding.
// Use one deterministic readback backend only for the texture-fingerprint cases; WebGL is unchanged.
async function stableCanvasReadback(page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "2d") return original.call(this, type, { ...args[0], willReadFrequently: true });
      return original.apply(this, [type, ...args]);
    };
  });
}

// Read the actual sticker canvases after a UI selection, rather than accepting only a selected option or URL change.
async function textureFingerprint(page) {
  return page.evaluate(() => {
    let hash = 2166136261,
      faces = 0,
      stable = true;
    window.c7BannerViewer.presentation.traverse((object) => {
      if (!object.userData.sourceFaceStickerIds || !Array.isArray(object.material)) return;
      object.userData.sourceFaceStickerIds.forEach((id, index) => {
        if (id === null) return;
        const canvas = object.material[index].map.image;
        const context = canvas.getContext("2d");
        stable &&= context.getContextAttributes().willReadFrequently === true;
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let offset = 0; offset < rgba.length; offset += 4) {
          hash = Math.imul(hash ^ rgba[offset], 16777619);
          hash = Math.imul(hash ^ rgba[offset + 1], 16777619);
          hash = Math.imul(hash ^ rgba[offset + 2], 16777619);
        }
        faces++;
      });
    });
    return { hash: hash >>> 0, faces, stable };
  });
}

test("the banner selector draws five distinct overrides, preserves the physical state, and restores the theme default", async ({
  page,
}) => {
  await stableCanvasReadback(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/index.html?app=calendar7&year=2026&month=11");
  await at(page, "2026-11");
  const select = page.getByRole("combobox", { name: "Banner style", exact: true });
  await expect(select).toHaveValue("theme");
  await expect(select.locator("option")).toHaveText([
    "Theme default",
    "Rounded",
    "Hard edges",
    "Underline",
    "Boxed",
    "Rounded box",
  ]);
  expect(new URL(page.url()).searchParams.has("banner")).toBe(false);
  await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const original = Calendar7Viewer.prototype.setBannerStyle;
    Calendar7Viewer.prototype.setBannerStyle = function (style) {
      window.c7BannerViewer = this;
      return original.call(this, style);
    };
  });
  const digest = await page.locator(ROOT).getAttribute("data-c7-digest"),
    fingerprints = [];
  for (const style of ["rounded", "square", "underline", "boxed", "rounded-box"]) {
    await select.selectOption(style);
    await expect(page.locator(ROOT)).toHaveAttribute("data-c7-banner", style);
    await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", digest);
    expect(new URL(page.url()).searchParams.get("banner")).toBe(style);
    const texture = await textureFingerprint(page);
    expect(texture.faces).toBe(294);
    expect(texture.stable).toBe(true);
    expect(await textureFingerprint(page)).toEqual(texture);
    fingerprints.push(texture.hash);
  }
  expect(new Set(fingerprints).size).toBe(5);
  await select.selectOption("theme");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-banner", "theme");
  expect(new URL(page.url()).searchParams.has("banner")).toBe(false);
  expect(errors).toEqual([]);
});

test("a manual banner survives scheme, instant date, reload and old-layout URL normalization", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "/index.html?app=calendar7&layout=standard&year=2026&month=2&banner=underline&scheme=paper-blue&font=quicksand&extra=keep",
  );
  await at(page, "2026-02");
  const select = page.getByRole("combobox", { name: "Banner style", exact: true });
  await expect(select).toHaveValue("underline");
  await page.getByRole("combobox", { name: "Cube color theme", exact: true }).selectOption("dracula");
  await expect(select).toHaveValue("underline");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-banner", "underline");
  await pickDate(page, 2026, 12);
  await at(page, "2026-12");
  await expect(pickerTrigger(page)).toBeFocused();
  await expect(page.getByRole("button", { name: "Show", exact: true })).toHaveCount(0);
  let query = new URL(page.url()).searchParams;
  for (const [key, value] of [
    ["app", "calendar7"],
    ["banner", "underline"],
    ["scheme", "dracula"],
    ["font", "quicksand"],
    ["extra", "keep"],
    ["year", "2026"],
    ["month", "12"],
  ])
    expect(query.get(key)).toBe(value);
  expect(query.has("layout")).toBe(false);
  await page.reload();
  await at(page, "2026-12");
  await expect(select).toHaveValue("underline");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-banner", "underline");
  expect(errors).toEqual([]);
});

test("the theme default follows representative scheme styles, including the hard-edged Classic banner", async ({
  page,
}) => {
  await stableCanvasReadback(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/index.html?app=calendar7&year=2026&month=11");
  await at(page, "2026-11");
  await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const original = Calendar7Viewer.prototype.setBannerStyle;
    Calendar7Viewer.prototype.setBannerStyle = function (style) {
      window.c7BannerViewer = this;
      return original.call(this, style);
    };
  });
  const banner = page.getByRole("combobox", { name: "Banner style", exact: true });
  const scheme = page.getByRole("combobox", { name: "Cube color theme", exact: true });
  const digest = await page.locator(ROOT).getAttribute("data-c7-digest");
  for (const [theme, shape] of [
    ["paper-red", "rounded"],
    ["paper-blue", "underline"],
    ["classic", "square"],
    ["solarized-light", "boxed"],
    ["gruvbox-light", "rounded-box"],
  ]) {
    await scheme.selectOption(theme);
    await expect(banner).toHaveValue("theme");
    await banner.selectOption("theme");
    const automatic = await textureFingerprint(page);
    expect(automatic.faces).toBe(294);
    expect(automatic.stable).toBe(true);
    await banner.selectOption(shape);
    expect(await textureFingerprint(page), `${theme}: Theme default equals ${shape}`).toEqual(
      automatic,
    );
    await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", digest);
    await banner.selectOption("theme");
    expect(new URL(page.url()).searchParams.has("banner")).toBe(false);
  }
  expect(errors).toEqual([]);
});

test("April uses the active print's APR and IL at banner height before and after restyling, also off-chain", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/index.html?app=calendar7&year=2027&month=4&scheme=classic");
  await at(page, "2027-04");
  await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const original = Calendar7Viewer.prototype.setBannerStyle;
    Calendar7Viewer.prototype.setBannerStyle = function (style) {
      window.c7BannerViewer = this;
      return original.call(this, style);
    };
  });
  const banner = page.getByRole("combobox", { name: "Banner style", exact: true });
  const measure = () =>
    page.evaluate(async () => {
      const viewer = window.c7BannerViewer;
      const { tileGrid, tileRoles } = await import("/src/apps/calendar7/sticker-art.ts");
      const rows = [];
      viewer.presentation.traverse((object) => {
        const ids = object.userData.sourceFaceStickerIds;
        if (!ids || !Array.isArray(object.material)) return;
        ids.forEach((id, face) => {
          if (id === null) return;
          const i = id - 1;
          if (
            viewer.printing.ink[i] !== "month" ||
            viewer.pose.pos[3 * i + 2] !== 3 ||
            viewer.pose.normal[3 * i + 2] !== 1 ||
            viewer.pose.pos[3 * i + 1] !== 3
          )
            return;
          const text = viewer.printing.text[i],
            canvas = object.material[face].map.image;
          const grid = tileGrid(viewer.tiles[i]),
            role = tileRoles(viewer.scheme, text, "month", "names");
          const color = [1, 3, 5].map((j) => parseInt(role.ink.slice(j, j + 2), 16));
          const rgba = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          let x0 = canvas.width,
            x1 = -1,
            y0 = canvas.height,
            y1 = -1;
          for (let y = Math.ceil(grid.banner.y0); y < Math.floor(grid.banner.y1); y++)
            for (let x = Math.ceil(grid.banner.x0); x < Math.floor(grid.banner.x1); x++) {
              const offset = (y * canvas.width + x) * 4;
              if (color.every((value, channel) => Math.abs(value - rgba[offset + channel]) < 40)) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
              }
            }
          rows.push({ text, column: viewer.pose.pos[3 * i] + 4, banner: grid.banner, bbox: { x0, x1, y0, y1 } });
        });
      });
      return rows.sort((a, b) => a.column - b.column);
    });
  await banner.selectOption("theme");
  const before = await measure();
  expect(before.map((row) => row.text)).toEqual(["APR", "IL"]);
  for (const row of before) {
    const height = row.banner.y1 - row.banner.y0;
    expect(row.bbox.y1 - row.bbox.y0 + 1, `${row.text}: visible cap height`).toBeGreaterThan(
      height * 0.25,
    );
    expect(row.bbox.y0 - row.banner.y0, `${row.text}: top margin`).toBeGreaterThan(height * 0.08);
    expect(row.banner.y1 - row.bbox.y1, `${row.text}: bottom margin`).toBeGreaterThan(height * 0.08);
    expect(row.bbox.x0).toBeGreaterThanOrEqual(Math.floor(row.banner.x0));
    expect(row.bbox.x1).toBeLessThanOrEqual(Math.ceil(row.banner.x1));
  }
  await banner.selectOption("square");
  const after = await measure();
  expect(after).toEqual(before);
  await test.info().attach("april-banner-bounds", {
    body: JSON.stringify({ before, after }, null, 2),
    contentType: "application/json",
  });
  await pickDate(page, 2099, 4);
  await at(page, "2099-04");
  expect(await page.locator(".c7-sheet tr:first-child td .c7-cell-text").allTextContents()).toEqual([
    "APR",
    "IL",
    "",
    "",
    "",
    "",
    "",
  ]);
  await expect(page.locator("[data-c7-best-effort]")).not.toContainText("row 1");
  await expect(page.locator(".c7-step")).toHaveCount(0);
  expect(errors).toEqual([]);
});
