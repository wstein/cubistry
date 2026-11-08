import { test, expect } from "@playwright/test";

// English 7x7 calendar mode, stage 2 (research candidate, not certified): the 3D cube and the animated step between
// adjacent months. The project config emulates prefers-reduced-motion: reduce, so the animation tests switch it off per
// page. A step is played only for a few moves (software GL draws a frame in 100 to 200 ms); "Skip to end" finishes it.
// The page publishes the SHA-256 digest of the pose the cube shows (data-c7-digest, computed in the page) and the
// test compares it with the stored hash of the node in graph.v1.json.

const ROOT = "#calendar7-root";
const watch = (page) => {
  const seen = [];
  page.on("pageerror", (e) => seen.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") seen.push(`console.error: ${m.text()}`);
  });
  return seen;
};
const graph = async (page) => (await (await page.request.get("/calendar7/graph.v1.json")).json()).nodes;
const idle = (page, month) => expect(page.locator(`${ROOT}[data-c7-state="idle"][data-c7-month="${month}"]`)).toHaveCount(1, { timeout: 30000 });

test("the 3D cube shows the month of the URL in the pose of the stored node", async ({ page }) => {
  const seen = watch(page);
  const nodes = await graph(page);
  await page.goto("/index.html?app=calendar7&year=2028&month=3");
  await idle(page, "2028-03");
  const canvas = page.locator("#studio-scene canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(200);
  await expect(canvas).toHaveAttribute("aria-label", /7x7 calendar cube showing March 2028/);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[2].hash);
  await expect(page.locator(".c7-month")).toHaveText("March 2028");
  expect(seen).toEqual([]);
});

test("under reduced motion a step jumps: no animation, the state still equals the stored node", async ({ page }) => {
  const seen = watch(page);
  const nodes = await graph(page);
  await page.goto("/index.html?app=calendar7&year=2028&month=1");
  await idle(page, "2028-01");
  await expect(page.locator('[data-c7="note"]')).toBeVisible();
  await expect(page.locator('[data-c7="play"]')).toBeDisabled();
  await page.locator('a[data-nav="next"]').click();
  await idle(page, "2028-02");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[1].hash);
  await page.locator('a[data-nav="previous"]').click();
  await idle(page, "2028-01");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[0].hash);
  expect(seen).toEqual([]);
});

test("a step plays block by block; pause, play, speed and skip to the end reach the stored state, both ways", async ({ page }) => {
  test.slow();
  const seen = watch(page);
  const nodes = await graph(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/index.html?app=calendar7&year=2028&month=1");
  await idle(page, "2028-01");
  await expect(page.locator('[data-c7="note"]')).toBeHidden();
  const progress = page.locator('[data-c7="progress"]');
  await page.locator('a[data-nav="next"]').click();
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "playing");
  await expect(progress).toHaveText(/^Turning to February 2028: block \d+ of 103$/);
  // The heading, sheet and live region already name the new month; the digest is that of the pose being turned only at the end.
  await expect(page.locator(".c7-month")).toHaveText("February 2028");
  await page.locator('[data-c7="speed"]').selectOption("8");
  await page.locator('[data-c7="play"]').click(); // Pause
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "paused");
  await expect(page.locator('[data-c7="play"]')).toHaveText("Play");
  await expect(progress).toContainText("(paused)");
  await page.waitForTimeout(800); // the move in flight finishes first
  const frozen = await progress.textContent();
  await page.waitForTimeout(600);
  expect(await progress.textContent()).toBe(frozen);
  await page.locator('[data-c7="play"]').click(); // Play
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "playing");
  await page.locator('[data-c7="skip"]').click();
  await idle(page, "2028-02");
  // The button is inactive now but keeps the keyboard focus.
  await expect(page.locator('[data-c7="skip"]')).toBeFocused();
  await expect(page.locator('[data-c7="skip"]')).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[1].hash);
  await expect(page.locator(".c7-live")).toContainText("The cube has turned to February 2028");
  // Backward: the inverse of the previous edge; and Next during the step ends it at once.
  await page.locator('a[data-nav="previous"]').click();
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "playing");
  await page.locator('a[data-nav="next"]').click(); // back to February 2028 while January 2028 is still being turned to
  await expect(progress).toHaveText(/^Turning to February 2028/);
  await page.locator('[data-c7="skip"]').click();
  await idle(page, "2028-02");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[1].hash);
  await page.locator('a[data-nav="previous"]').click();
  await page.locator('[data-c7="skip"]').click();
  await idle(page, "2028-01");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[0].hash);
  expect(seen).toEqual([]);
});

test("the chain ends: the last month steps back, the first has no previous step", async ({ page }) => {
  const seen = watch(page);
  const nodes = await graph(page);
  await page.goto("/index.html?app=calendar7&year=2076&month=1");
  await idle(page, "2076-01");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[576].hash);
  await expect(page.locator('a[data-nav="next"]')).toHaveCount(0);
  await page.locator('a[data-nav="previous"]').click();
  await idle(page, "2075-12");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[575].hash);
  expect(seen).toEqual([]);
});

test("a month outside the chain hides the cube; leaving the mode releases the scene", async ({ page }) => {
  const seen = watch(page);
  await page.goto("/index.html?app=calendar7&year=2020&month=5");
  await expect(page.locator(".c7-unavailable")).toBeVisible();
  await expect(page.locator("#studio-scene")).toBeHidden();
  await page.locator('a[data-nav="start"]').click();
  await idle(page, "2028-01");
  await expect(page.locator("#studio-scene")).toBeVisible();
  await expect(page.locator("#studio-scene canvas")).toHaveCount(1);
  await page.evaluate(() => {
    const select = document.getElementById("studio-application");
    select.value = "counter";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "counter", { timeout: 30000 });
  await expect(page.locator("#studio-scene")).toBeVisible();
  await expect(page.locator("#studio-scene")).not.toHaveAttribute("hidden", /.*/);
  await expect(page.locator(".c7-root")).toHaveCount(0);
  expect(seen).toEqual([]);
});

test("at 375 px the page scrolls instead of clipping and the controls are reachable by keyboard", async ({ page }) => {
  const seen = watch(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/index.html?app=calendar7&year=2028&month=1");
  await idle(page, "2028-01");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const stageOverflow = await page.evaluate(() => {
    const s = document.getElementById("studio-stage");
    return { sw: s.scrollWidth - s.clientWidth, canScroll: getComputedStyle(s).overflowY === "auto" };
  });
  expect(stageOverflow.sw).toBeLessThanOrEqual(0);
  expect(stageOverflow.canScroll).toBe(true);
  for (const name of ["speed", "slice", "reset"]) {
    await page.locator(`[data-c7="${name}"]`).focus();
    await expect(page.locator(`[data-c7="${name}"]`)).toBeFocused();
  }
  await page.locator('[data-c7="reset"]').press("Enter");
  expect(seen).toEqual([]);
});

test("a focused control is never hidden behind the pinned cube (WCAG 2.4.11)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [width, height] of [[1280, 1000], [1280, 800], [900, 700]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/index.html?app=calendar7&year=2028&month=1");
    await idle(page, "2028-01");
    for (const name of ["speed", "reset"]) {
      await page.evaluate(() => {
        const s = document.getElementById("studio-stage");
        s.scrollTop = s.scrollHeight;
      });
      await page.locator(`[data-c7="${name}"]`).focus();
      const gap = await page.evaluate((n) => {
        const scene = document.getElementById("studio-scene").getBoundingClientRect();
        return document.querySelector(`[data-c7="${n}"]`).getBoundingClientRect().top - scene.bottom;
      }, name);
      expect(gap, `${name} at ${width}x${height}`).toBeGreaterThanOrEqual(-0.5);
    }
  }
});

// The HTML month sheet: every text/background pair that is drawn (measured from the computed styles) reads at 4.5:1 in
// both themes, and the weekend date cells are tinted while the labels and the empty cells are not.
for (const scheme of ["light", "dark"]) {
  test(`month sheet colors read at 4.5:1 (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/index.html?app=calendar7&year=2028&month=6");
    await idle(page, "2028-06");
    const cells = await page.evaluate(() => {
      const lum = (c) => {
        const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const out = [];
      document.querySelectorAll(".c7-sheet tr").forEach((tr, r) => tr.querySelectorAll("td").forEach((td, c) => {
        const s = getComputedStyle(td);
        const [x, y] = [lum(s.color), lum(s.backgroundColor)].sort((p, q) => q - p);
        out.push({ r, c, cls: td.className, text: td.textContent, bg: s.backgroundColor, color: s.color, ratio: (x + 0.05) / (y + 0.05) });
      }));
      return out;
    });
    expect(cells).toHaveLength(49);
    for (const t of cells) if (t.text) expect(t.ratio, `${t.cls} ${t.text} ${t.color} on ${t.bg}`).toBeGreaterThanOrEqual(4.5);
    const bgOf = (pred) => new Set(cells.filter(pred).map((t) => t.bg));
    const weekendDates = bgOf((t) => t.r >= 2 && t.cls.includes("c7-ink-red"));
    const weekdayDates = bgOf((t) => t.r >= 2 && t.cls.includes("c7-ink-dark"));
    const labels = bgOf((t) => t.r === 1);
    const empty = bgOf((t) => t.cls.includes("c7-ink-blank"));
    expect(weekendDates.size).toBe(1);
    expect(weekdayDates.size).toBe(1);
    expect([...weekendDates][0]).not.toBe([...weekdayDates][0]);
    expect(labels).toEqual(weekdayDates);
    expect([...empty][0]).not.toBe([...weekdayDates][0]);
    if (scheme === "light") {
      expect([...weekendDates][0]).toBe("rgb(241, 229, 223)");
      expect([...weekdayDates][0]).toBe("rgb(234, 231, 221)");
      expect([...empty][0]).toBe("rgb(243, 241, 233)");
      expect(cells.find((t) => t.text === "SUN").color).toBe("rgb(168, 61, 50)");
      expect(cells.find((t) => t.text === "MON").color).toBe("rgb(82, 101, 122)");
      expect(cells.find((t) => t.cls.includes("c7-ink-dark")).color).toBe("rgb(25, 63, 99)");
    }
  });
}

// Layout of the mode: no empty dock, and the move words are shown in full (block word, move word, raw generators).
for (const [width, height] of [[375, 800], [768, 900], [1000, 700], [1440, 900]]) {
  test(`layout at ${width} px: no empty dock, words fully visible, no horizontal scroll, notation legend`, async ({ page }) => {
    const seen = watch(page);
    await page.setViewportSize({ width, height });
    await page.goto("/index.html?app=calendar7&year=2028&month=2");
    await idle(page, "2028-02");
    // The mode puts nothing into the dock, so the dock is collapsed and the stage takes its width.
    await expect(page.locator(".shell-dock")).toBeHidden();
    await expect(page.locator("[data-c7-legend]")).toBeVisible();
    for (const [kind, label] of [["blocks-slice", "Block word with middle slice"], ["blocks", "Block word"], ["word", "Move word"], ["raw", "Raw generators"]]) {
      await page.locator(`.c7-step[data-step="next"] summary:text-is("${label}")`).click();
      const box = page.locator(`[data-${kind}="next"]`);
      await expect(box).toBeVisible();
      // Not clipped: the box grows to its text, nothing scrolls inside it, and no token is wider than the box.
      const m = await box.evaluate((el) => ({
        sh: el.scrollHeight - el.clientHeight,
        sw: el.scrollWidth - el.clientWidth,
        right: el.getBoundingClientRect().right,
        tokenRight: Math.max(...[...el.querySelectorAll(".c7-tok")].map((t) => t.getBoundingClientRect().right)),
        tokens: el.querySelectorAll(".c7-tok").length,
        overflowY: getComputedStyle(el).overflowY,
      }));
      expect(m.sh).toBeLessThanOrEqual(1);
      expect(m.sw).toBeLessThanOrEqual(0);
      expect(m.tokenRight).toBeLessThanOrEqual(m.right + 0.5);
      expect(m.tokens).toBeGreaterThan(20);
      expect(m.overflowY).toBe("visible");
    }
    // 16px gutter on the left of the content and no page-wide horizontal scroll.
    const g = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - window.innerWidth,
      left: document.querySelector(".c7-step").getBoundingClientRect().left,
      right: window.innerWidth - document.querySelector(".c7-step").getBoundingClientRect().right,
    }));
    expect(g.over).toBeLessThanOrEqual(0);
    expect(g.left).toBeGreaterThanOrEqual(16);
    expect(g.right).toBeGreaterThanOrEqual(16);
    expect(seen).toEqual([]);
  });
}
