import { test, expect } from "@playwright/test";
// Picture Cube looks: two checkboxes, Stickerless and Projected. Three valid looks (A stickered per sticker, B stickered
// projected = default, C stickerless = always projected). docs/PICTURE_PLAYGROUND.md, "Picture looks", has the table.
const KEY = "cubistry-viewer-appearance-v1:/index.html";
const cube = (page) => page.locator("#playground-cube");
async function open(page, search = "?app=playground", stored) {
  if (stored) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ version: 1, frameColor: null, ...stored })]);
  await page.goto(`/index.html${search}`);
  await expect(cube(page)).toHaveAttribute("data-ready", "true");
  await expect(cube(page)).toHaveAttribute("aria-busy", "false");
  await page.locator("#appearance-btn").click();
  return { stickerless: page.getByRole("checkbox", { name: "Stickerless", exact: true }), projected: page.getByRole("checkbox", { name: "Projected", exact: true }) };
}
const frame = async (page) => (await cube(page).screenshot()).toString("base64");

test("default: Stickered and Projected; no select for construction or mapping; the helper line is shown", async ({ page }) => {
  const { stickerless, projected } = await open(page);
  await expect(stickerless).not.toBeChecked();
  await expect(projected).toBeChecked();
  await expect(projected).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Cube construction" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Picture mapping" })).toHaveCount(0);
  await expect(page.locator(".cube-appearance-picture-hint")).toHaveText("Image projected across each face; only stickers carry it.");
});

test("Stickerless checks Projected and disables it; unchecking Stickerless enables it again, the choice is stored", async ({ page }) => {
  const { stickerless, projected } = await open(page);
  await stickerless.check();
  await expect(projected).toBeChecked();
  await expect(projected).toBeDisabled();
  expect(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY)).construction).toBe("stickerless");
  await stickerless.uncheck();
  await expect(projected).toBeEnabled();
  await expect(projected).toBeChecked();
  await projected.uncheck();
  expect(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY)).pictureMode).toBe("per-sticker");
});

test("migration: a stored per-sticker choice stays per-sticker on a stickered cube", async ({ page }) => {
  const boxes = await open(page, "?app=playground", { construction: "stickered", pictureMode: "per-sticker" });
  await expect(boxes.projected).not.toBeChecked();
  await expect(boxes.stickerless).not.toBeChecked();
});

test("migration: stickerless records and links are projected, with or without a stored per-sticker choice", async ({ browser }) => {
  for (const [stored, search] of [[{ construction: "stickerless" }, "?app=playground"], [{ construction: "stickerless", pictureMode: "per-sticker" }, "?app=playground&pictures=per-sticker"]]) {
    const context = await browser.newContext(), page = await context.newPage();
    const { stickerless, projected } = await open(page, search, stored);
    await expect(stickerless).toBeChecked();
    await expect(projected).toBeChecked();
    await expect(projected).toBeDisabled();
    await context.close();
  }
});

test("links: ?pictures=per-sticker is look A on a stickered cube, ?pictures=projected is look B; old links without it show B", async ({ browser }) => {
  for (const [search, checked] of [["?app=playground&pictures=per-sticker", false], ["?app=playground&pictures=projected", true], ["?app=playground", true]]) {
    const context = await browser.newContext(), page = await context.newPage();
    const { projected } = await open(page, search);
    if (checked) await expect(projected).toBeChecked(); else await expect(projected).not.toBeChecked();
    await context.close();
  }
});

test("the three looks render differently; the classic design offers no Projected choice", async ({ page }) => {
  const { stickerless, projected } = await open(page);
  const b = await frame(page);
  await projected.uncheck();
  await expect.poll(() => frame(page)).not.toBe(b); // A differs from B
  const a = await frame(page);
  await projected.check();
  await stickerless.check();
  await expect.poll(() => frame(page)).not.toBe(b); // C differs from B
  expect(await frame(page)).not.toBe(a);
  await page.locator("#playground-design").selectOption("classic");
  await expect(projected).toBeHidden();
  await expect(stickerless).toBeVisible();
});

test("Stickerless never writes the picture mode: from a stored per-sticker record, check and uncheck keep per-sticker", async ({ page }) => {
  const { stickerless, projected } = await open(page, "?app=playground", { construction: "stickered", pictureMode: "per-sticker" });
  const stored = async () => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY));
  await expect(projected).not.toBeChecked();
  await stickerless.check();
  await expect(projected).toBeChecked(); // locked on by Stickerless (look C), a display state only
  await expect(projected).toBeDisabled();
  expect((await stored()).pictureMode).toBe("per-sticker");
  await stickerless.uncheck();
  await expect(projected).toBeEnabled();
  await expect(projected).not.toBeChecked();
  const after = await stored();
  expect(after.construction).toBe("stickered");
  expect(after.pictureMode).toBe("per-sticker");
});

// The shared input rule (src/playground.css: input { width: 100% }) must not stretch the checkboxes of the appearance panel.
async function expectInlineCheckboxes(page, names) {
  for (const name of names) {
    const box = page.getByRole("checkbox", { name, exact: true });
    const check = await box.boundingBox();
    const text = await box.locator("xpath=following-sibling::span[1]").boundingBox();
    expect(check.width, `${name} checkbox width`).toBeLessThanOrEqual(20);
    expect(Math.abs((check.y + check.height / 2) - (text.y + text.height / 2)), `${name} on the line of its label`).toBeLessThanOrEqual(check.height);
    expect(text.x, `${name} label right of the box`).toBeGreaterThanOrEqual(check.x + check.width - 1);
  }
}

test("layout: the Stickerless and Projected checkboxes are small and on the line of their label (playground)", async ({ page }) => {
  await open(page);
  await expectInlineCheckboxes(page, ["Stickerless", "Projected"]);
});

test("layout: the Stickerless checkbox is small and on the line of its label (picture3.html)", async ({ page }) => {
  await page.goto("/picture3.html");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("checkbox", { name: "Stickerless", exact: true })).toBeVisible(); // the panel is open on this page
  await expectInlineCheckboxes(page, ["Stickerless"]);
});
