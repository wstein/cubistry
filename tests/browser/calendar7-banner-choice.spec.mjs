// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";
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
    let hash = 2166136261, faces = 0, stable = true;
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

test("the banner selector draws five distinct overrides, preserves the physical state, and restores the theme default", async ({ page }) => {
  await stableCanvasReadback(page);
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/index.html?app=calendar7&layout=names&year=2026&month=11"); await at(page, "2026-11");
  const select = page.getByRole("combobox", { name: "Month banner", exact: true });
  await expect(select).toHaveValue("theme");
  await expect(select.locator("option")).toHaveText(["Theme default", "Rounded", "Hard edges", "Underline", "Boxed", "Rounded box"]);
  expect(new URL(page.url()).searchParams.has("banner")).toBe(false);
  await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const original = Calendar7Viewer.prototype.setBannerStyle;
    Calendar7Viewer.prototype.setBannerStyle = function (style) {
      window.c7BannerViewer = this;
      return original.call(this, style);
    };
  });
  const digest = await page.locator(ROOT).getAttribute("data-c7-digest"), fingerprints = [];
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

test("a manual banner survives a scheme change and a reload", async ({ page }) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/index.html?app=calendar7&layout=names&year=2027&month=2&banner=underline&scheme=paper-blue&font=quicksand&extra=keep");
  await at(page, "2027-02");
  const select = page.getByRole("combobox", { name: "Month banner", exact: true });
  await expect(select).toHaveValue("underline");
  await page.getByRole("combobox", { name: "Cube color theme", exact: true }).selectOption("dracula");
  await expect(select).toHaveValue("underline");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-banner", "underline");
  const query = new URL(page.url()).searchParams;
  for (const [key, value] of [["app", "calendar7"], ["layout", "names"], ["banner", "underline"], ["scheme", "dracula"], ["font", "quicksand"], ["extra", "keep"]]) expect(query.get(key)).toBe(value);
  await page.reload(); await at(page, "2027-02");
  await expect(select).toHaveValue("underline");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-banner", "underline");
  expect(errors).toEqual([]);
});

test("the theme default follows representative scheme styles, including the hard-edged Classic banner", async ({ page }) => {
  await stableCanvasReadback(page);
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/index.html?app=calendar7&layout=names&year=2026&month=11"); await at(page, "2026-11");
  await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const original = Calendar7Viewer.prototype.setBannerStyle;
    Calendar7Viewer.prototype.setBannerStyle = function (style) {
      window.c7BannerViewer = this;
      return original.call(this, style);
    };
  });
  const banner = page.getByRole("combobox", { name: "Month banner", exact: true });
  const scheme = page.getByRole("combobox", { name: "Cube color theme", exact: true });
  const digest = await page.locator(ROOT).getAttribute("data-c7-digest");
  for (const [theme, shape] of [["paper-red", "rounded"], ["paper-blue", "underline"], ["classic", "square"], ["solarized-light", "boxed"], ["gruvbox-light", "rounded-box"]]) {
    await scheme.selectOption(theme);
    await expect(banner).toHaveValue("theme");
    await banner.selectOption("theme");
    const automatic = await textureFingerprint(page);
    expect(automatic.faces).toBe(294);
    expect(automatic.stable).toBe(true);
    await banner.selectOption(shape);
    expect(await textureFingerprint(page), `${theme}: Theme default equals ${shape}`).toEqual(automatic);
    await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", digest);
    await banner.selectOption("theme");
    expect(new URL(page.url()).searchParams.has("banner")).toBe(false);
  }
  expect(errors).toEqual([]);
});
