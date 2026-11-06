import { test, expect } from "@playwright/test";

// Layout of the unified shell on the Chronocube Studio page. Measures geometry only: no moves are awaited and the
// page is loaded once; frames and themes change through setViewportSize and emulateMedia.

const regions = ["header", "app-switcher", "stage", "reference-view", "hints", "dock", "status-zone", "primary-action",
  "readout", "presentation", "nerd-drawer", "view-controls", "present-action"];
const frames = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "390x844", width: 390, height: 844 },
  { name: "844x390", width: 844, height: 390 },
];
const themes = ["light", "dark"];

let context;
let page;
const errors = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: undefined });
  page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/chronocube.html");
  await page.locator('[data-region="header"]').waitFor();
  await page.locator("#studio-controls .hud-body").waitFor({ timeout: 25000 });
});

test.afterAll(async () => {
  await context?.close();
});

const boxOf = (p, region) => p.locator(`[data-region="${region}"]`).first().boundingBox();
const overlap = (a, b) => {
  if (!a || !b) return 0;
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

test("every region name and the five dock slots exist", async () => {
  for (const region of regions) await expect(page.locator(`[data-region="${region}"]`), region).toHaveCount(1);
  for (const slot of [1, 2, 3, 4, 5]) await expect(page.locator(`[data-slot="${slot}"]`), `slot ${slot}`).toHaveCount(1);
});

for (const theme of themes) {
  for (const frame of frames) {
    test(`${frame.name} ${theme}: no horizontal scroll, header above stage, no overlaps`, async () => {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.emulateMedia({ colorScheme: theme });
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(frame.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const [header, stage, dock, status, readout] = await Promise.all(
        ["header", "stage", "dock", "status-zone", "readout"].map(r => boxOf(page, r)));
      expect(header, "header is visible").not.toBeNull();
      expect(stage, "stage is visible").not.toBeNull();
      expect(dock, "dock is visible: controls are always visible").not.toBeNull();
      expect(header.y + header.height, "header sits above the stage").toBeLessThanOrEqual(stage.y + 0.5);
      expect(overlap(header, stage)).toBe(0);
      expect(overlap(header, dock)).toBe(0);
      expect(overlap(stage, dock)).toBe(0);
      expect(overlap(status, header)).toBe(0);
      // The readout is hidden until the dock-slot step fills it; once visible it must stay clear of these.
      for (const other of [dock, status, header]) expect(overlap(readout, other)).toBe(0);
      expect(stage.width).toBeGreaterThan(150);
      expect(stage.height).toBeGreaterThan(100);
      for (const box of [header, stage, dock]) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(frame.width + 0.5);
        expect(box.y + box.height).toBeLessThanOrEqual(frame.height + 0.5);
      }
    });
  }
}

test("390x844: header controls are at least 44 px", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const selector of ['[data-region="app-switcher"] select', '[data-region="present-action"]', ".shell-brand", "#print-stickers"]) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, selector).not.toBeNull();
    expect(box.width, `${selector} width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${selector} height`).toBeGreaterThanOrEqual(44);
  }
});

for (const theme of themes) {
  test(`${theme}: visible text in the header, dock and footer meets 4.5:1 against its background`, async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const failures = await page.evaluate(() => {
      const parse = value => {
        const m = value.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r, g, b, a };
      };
      const lum = ({ r, g, b }) => {
        const [x, y, z] = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * x + 0.7152 * y + 0.0722 * z;
      };
      const over = (top, bottom) => ({
        r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a),
        b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
      const backdrop = el => {
        const layers = [];
        for (let node = el; node; node = node.parentElement) {
          const c = parse(getComputedStyle(node).backgroundColor);
          if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
        }
        return layers.reverse().reduce((acc, c) => over(c, acc), { r: 255, g: 255, b: 255, a: 1 });
      };
      const out = [];
      const roots = document.querySelectorAll('[data-region="header"], [data-region="dock"], .shell-footer');
      for (const root of roots) {
        for (const el of root.querySelectorAll("*")) {
          const direct = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!direct || !el.checkVisibility()) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          const style = getComputedStyle(el);
          const bg = backdrop(el);
          const fg = over({ ...parse(style.color), a: parse(style.color).a * Number(style.opacity) }, bg);
          const [a, b] = [lum(fg), lum(bg)];
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (ratio < 4.5) out.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
        }
      }
      return out;
    });
    expect(failures).toEqual([]);
  });
}

test("presentation mode: the stage fills the window, the dock readout and the footer stay visible, the header hides", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#presentation-btn").click();
  await expect(page.locator("body")).toHaveClass(/presentation-mode/);
  const [stage, dock, footer] = await Promise.all([boxOf(page, "stage"), boxOf(page, "dock"), page.locator(".shell-footer").boundingBox()]);
  await expect(page.locator('[data-region="header"]')).toBeHidden();
  expect(stage.height).toBeCloseTo(900, 0);
  expect(stage.width).toBeCloseTo(1440, 0);
  expect(dock, "dock stays visible").not.toBeNull();
  expect(footer, "footer watermark stays visible").not.toBeNull();
  expect(dock.x + dock.width).toBeLessThanOrEqual(1440.5);
  expect(footer.y + footer.height).toBeLessThanOrEqual(900.5);
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
});

test("no page errors while measuring", () => {
  expect(errors).toEqual([]);
});
