import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import { frontPoint } from "../helpers/front-projection.mjs";
async function chooseTimer(page) {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const configure = CubeViewer.prototype.configure,
      animate = CubeViewer.prototype.animate;
    window.timerMoves = [];
    window.timerTimes = [];
    CubeViewer.prototype.configure = function (p, s, a) {
      window.timerPrint = p;
      window.timerStart = s;
      return configure.call(this, p, s, a);
    };
    CubeViewer.prototype.animate = async function (p) {
      const before = performance.now();
      await animate.call(this, p);
      window.timerMoves.push(p);
      window.timerTimes.push(performance.now() - before);
    };
  });
  await page.selectOption("#application", "timer");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "15:00");
  await expect(page.locator("#application")).toBeEnabled();
}
const settled = async (page, value) => {
  await expect(page.locator("#cube")).toHaveAttribute("data-value", value, {
    timeout: 20000,
  });
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
};
async function duration(page, value) {
  await page.fill("#timer-duration", value);
  await page.click("#timer-set-duration");
  await settled(page, value);
}
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
function digit(image, cx, cy) {
  const sample = (px, py) => {
    const [x, y] = frontPoint(
      image,
      cx + (px / 256 - 0.5) * 0.87,
      cy + (0.5 - py / 256) * 0.87,
    );
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const i = ((y + dy) * image.width + x + dx) * 4;
        const [r, g, b] = image.data.slice(i, i + 3);
        if (b > r * 1.25 && b > g * 1.05) return true;
      }
    return false;
  };
  return {
    segments: [
      [128, 48],
      [192, 84],
      [192, 168],
      [128, 208],
      [64, 168],
      [64, 84],
      [128, 128],
    ]
      .map((p, i) => (sample(...p) ? "abcdefg"[i] : ""))
      .join(""),
    up: sample(128, 234),
  };
}
test("Workshop Timer is a separate upright MMSS print; invalid durations do not change it and Counter remains functional", async ({
  page,
}) => {
  await chooseTimer(page);
  await expect(page.locator("#counter-controls")).toBeHidden();
  await expect(page.locator("#timer-controls")).toBeVisible();
  const image = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  for (const [i, value] of [1, 5, 0, 0].entries()) {
    const d = digit(image, i % 2 ? 0.52 : -0.52, i < 2 ? 0.52 : -0.52);
    expect(d.segments).toBe(active[value]);
    expect(d.up).toBe(true);
  }
  for (const invalid of ["60:00", "00:15"]) {
    await page.fill("#timer-duration", invalid);
    await page.click("#timer-set-duration");
    await expect(page.locator("#error")).not.toBeEmpty();
    await settled(page, "15:00");
  }
  await page.selectOption("#application", "certified");
  await settled(page, "0");
  await expect(page.locator("#counter-controls")).toBeVisible();
  await page.locator('[data-delta="1"]').click();
  await settled(page, "1");
});
test("absolute fifteen-minute deadline visits all91 actual displays and independently replays331 committed HTM", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.clock.install();
  await chooseTimer(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.click("#timer-start");
  const epoch = await page.evaluate(() => performance.now());
  let offset = 0;
  const transitions = [];
  for (let value = 89; value >= 0; value--) {
    const goal = epoch + (90 - value) * 10000 + 300;
    const now = await page.evaluate(() => performance.now());
    await page.clock.fastForward(Math.max(0, goal - now - 300));
    await page.clock.runFor(300);
    const text =
      String(Math.floor(value / 6)).padStart(2, "0") +
      ":" +
      String((value % 6) * 10).padStart(2, "0");
    await settled(page, text);
    const step = await page.evaluate((offset) => {
      const moves = window.timerMoves.slice(offset);
      return {
        word: moves
          .map(
            (p) =>
              p.move.face +
              (p.move.turns === 2 ? "2" : p.move.turns === -1 ? "'" : ""),
          )
          .join(" "),
        state: moves.at(-1).to,
        count: window.timerMoves.length,
      };
    }, offset);
    offset = step.count;
    transitions.push({ value, word: step.word, state: step.state });
  }
  expect(offset).toBe(331);
  await expect(page.locator("#session-moves")).toHaveText("331");
  await expect(page.locator("#timer-status")).toHaveText(
    "Complete · Cube 00:00",
  );
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await expect(page.locator("#timer-start")).toBeDisabled();
  const source = await page.evaluate(() => ({
    print: window.timerPrint,
    start: window.timerStart,
  }));
  const path = "/tmp/cubistry-workshop-browser-commits.json";
  writeFileSync(
    path,
    JSON.stringify({
      ...source,
      kind: "countdown",
      startValue: 90,
      transitions,
    }),
  );
  const result = JSON.parse(
    execFileSync("python3", ["research/workshop-timer/verify.py", path], {
      encoding: "utf8",
    }),
  );
  expect(result.actualHTM).toBe(331);
  expect(result.actualTransitions).toBe(90);
});
test("pause freezes a lagged clock and settles one frozen bucket; reset never teleports an active legal sequence", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await chooseTimer(page);
  await duration(page, "00:40");
  await page.locator("#rotation-speed").fill("0");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.click("#timer-start");
  await page.clock.fastForward(10000);
  await page.clock.runFor(100);
  await page.clock.fastForward(10000);
  await page.clock.runFor(100);
  await expect(page.locator("#timer-logical")).toHaveText("00:20");
  await page.click("#timer-pause");
  await expect(page.locator("#timer-status")).toContainText("Paused");
  for (let i = 0; i < 35; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, "00:20");
  await expect(page.locator("#timer-logical")).toHaveText("00:20");
  await expect(page.locator("#timer-status")).toHaveText("Paused · 00:20");
  await page.click("#timer-start");
  await page.clock.fastForward(10000);
  await page.clock.runFor(100);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
  const before = Number(await page.locator("#session-moves").innerText());
  await page.click("#timer-reset");
  await expect(page.locator("#timer-logical")).toHaveText("00:40");
  for (let i = 0; i < 50; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, "00:40");
  expect(
    Number(await page.locator("#session-moves").innerText()),
  ).toBeGreaterThan(before);
  await expect(page.locator("#timer-status")).toHaveText("Ready · 00:40");
});
test("timer panel fits mobile and preserves all six inherited speed stops", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await chooseTimer(page);
  await expect(page.locator("#timer-start")).toBeVisible();
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  for (const stop of ["0", "1", "2", "3", "4", "5"]) {
    await page.locator("#rotation-speed").fill(stop);
    await expect(page.locator("#rotation-speed")).toHaveValue(stop);
  }
  await page.locator("#timer-start").click();
  await expect(page.locator("#timer-pause")).toBeEnabled();
  await page.locator("#timer-pause").click();
  await expect(page.locator("#timer-start")).toHaveText("Resume");
});

test("real animation budgets measure committed five-move edges at default100ms, optional250ms and slow2s", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await chooseTimer(page);
  await expect(page.locator("#rotation-speed")).toHaveValue("4");
  // Configure zero using the actual shared solver; exclude this reset from edge timings.
  await page.locator("#rotation-speed").fill("5");
  await duration(page, "00:00");
  const measurements = [];
  for (const [stop, ms, target] of [
    ["4", 100, "00:10"],
    ["3", 250, "00:20"],
    ["0", 2000, "00:10"],
  ]) {
    await page.locator("#rotation-speed").fill(stop);
    const offset = await page.evaluate(() => window.timerTimes.length);
    const start = Date.now();
    await duration(page, target);
    const durations = await page.evaluate(
      (i) => window.timerTimes.slice(i),
      offset,
    );
    expect(durations).toHaveLength(5);
    for (const elapsed of durations)
      expect(elapsed).toBeGreaterThanOrEqual(ms - 25);
    const total = durations.reduce((a, b) => a + b, 0);
    if (ms < 2000) expect(total).toBeLessThan(10000);
    else expect(total).toBeGreaterThanOrEqual(10000);
    measurements.push({
      durationPerMove: ms,
      committedHTM: durations.length,
      animationMilliseconds: total,
      wallMilliseconds: Date.now() - start,
    });
  }
  writeFileSync(
    "/tmp/cubistry-workshop-real-animation-budgets.json",
    JSON.stringify(measurements, null, 2),
  );
});

test("Timer preserves global speed on reload without overwriting Counter state, including a missing saved record", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await page.fill("#value", "42");
  await page.click("#set");
  await settled(page, "42");
  await page.selectOption("#application", "timer");
  await settled(page, "15:00");
  await page.locator("#rotation-speed").fill("5");
  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cubistry-counter-v2")),
  );
  expect(saved.value).toBe(42);
  expect(saved.padded).toBe(true);
  expect(saved.moveDuration).toBe(50);
  await page.reload();
  await expect(page.locator("#application")).toBeEnabled();
  await settled(page, "42");
  await expect(page.locator("#rotation-speed")).toHaveValue("5");
  await page.selectOption("#application", "timer");
  await settled(page, "15:00");
  await page.evaluate(() => localStorage.removeItem("cubistry-counter-v2"));
  await page.locator("#rotation-speed").fill("4");
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cubistry-counter-v2")),
  );
  expect(saved.value).toBe(42);
  expect(saved.moveDuration).toBe(100);
  await page.reload();
  await expect(page.locator("#rotation-speed")).toHaveValue("4");
  await settled(page, "42");
});

test("tab-resume catch-up reads the monotonic deadline, ignores wall-clock jumps and retains one latest target", async ({
  page,
}) => {
  await page.clock.install();
  await chooseTimer(page);
  await duration(page, "01:00");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.click("#timer-start");
  await page.clock.fastForward(35500);
  await page.clock.runFor(1000);
  await settled(page, "00:30");
  await expect(page.locator("#timer-logical")).toHaveText("00:30");
  await page.clock.setSystemTime(new Date("2040-01-01T00:00:00Z"));
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await expect(page.locator("#timer-logical")).toHaveText("00:30");
  await page.clock.fastForward(30000);
  await page.clock.runFor(1000);
  await settled(page, "00:00");
  await expect(page.locator("#timer-status")).toHaveText(
    "Complete · Cube 00:00",
  );
  expect(await page.locator("#move-progress").getAttribute("data-queued")).toBe(
    "",
  );
});

test("a rejected Timer certificate leaves the existing Counter and its physical state usable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await page.fill("#value", "42");
  await page.click("#set");
  await settled(page, "42");
  await page.route("**/workshop-timer.v1.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.selectOption("#application", "timer");
  await expect(page.locator("#error")).toContainText("integrity");
  await expect(page.locator("#application")).toHaveValue("certified");
  await settled(page, "42");
  await page.locator('[data-delta="1"]').click();
  await settled(page, "43");
});

test("Counter's presentation-only blank tens never masks any Timer zero and survives application return", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await page.locator("#format").uncheck();
  await page.selectOption("#application", "timer");
  await settled(page, "15:00");
  await duration(page, "00:00");
  const image = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  for (const [cx, cy] of [
    [-0.52, 0.52],
    [0.52, 0.52],
    [-0.52, -0.52],
    [0.52, -0.52],
  ]) {
    const d = digit(image, cx, cy);
    expect(d.segments).toBe(active[0]);
    expect(d.up).toBe(true);
  }
  await page.selectOption("#application", "certified");
  await settled(page, "0");
  await expect(page.locator("#format")).not.toBeChecked();
  await page.locator('[data-delta="1"]').click();
  await settled(page, "1");
  await expect(page.locator("#session-moves")).toHaveText("5");
});
