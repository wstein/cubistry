import { test, expect } from "@playwright/test";
import { startFrameGapProbe, resetFrameGap, readFrameGap, endpointToleranceMs } from "../helpers/frame-gap.mjs";
import { pauseSoon } from "../helpers/pause-clock.mjs";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import { frontStickerPoint } from "../helpers/front-projection.mjs";
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
    CubeViewer.prototype.animate = async function (p, ...options) {
      const before = performance.now();
      await animate.call(this, p, ...options);
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
  await page.locator("#timer-duration").press("Enter");
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
    const [x, y] = frontStickerPoint(image, cx, cy, px, py);
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
    const d = digit(image, i % 2 ? 0.5 : -0.5, i < 2 ? 0.5 : -0.5);
    expect(d.segments).toBe(active[value]);
    expect(d.up).toBe(true);
  }
  for (const invalid of ["60:00", "00:15"]) {
    await page.fill("#timer-duration", invalid);
    await page.locator("#timer-duration").press("Enter");
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
  await pauseSoon(page);
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
  await expect(page.locator("#status")).toHaveText("Countdown · Complete");
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
  await pauseSoon(page);
  await page.click("#timer-start");
  await page.clock.fastForward(10000);
  await page.clock.runFor(100);
  await page.clock.fastForward(10000);
  await page.clock.runFor(100);
  await expect(page.locator("#timer-logical")).toHaveText("00:20");
  await page.click("#timer-start");
  await expect(page.locator("#status")).toContainText("Paused");
  for (let i = 0; i < 35; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, "00:20");
  await expect(page.locator("#timer-logical")).toHaveText("00:20");
  await expect(page.locator("#status")).toHaveText("Countdown · Paused");
  await page.click("#timer-start");
  await page.clock.fastForward(10000);
  await page.clock.runFor(1);
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
  await expect(page.locator("#status")).toHaveText("Countdown · Ready");
});
test("timer panel fits mobile and preserves six inherited speed stops plus 10ms", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await chooseTimer(page);
  await expect(page.locator("#timer-start")).toBeVisible();
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  for (const stop of ["0", "1", "2", "3", "4", "5", "6"]) {
    await page.locator("#rotation-speed").fill(stop);
    await expect(page.locator("#rotation-speed")).toHaveValue(stop);
  }
  await page.locator("#timer-start").click();
  await expect(page.locator("#timer-start")).toBeEnabled();
  await page.locator("#timer-start").click();
  await expect(page.locator("#timer-start")).toHaveText("Resume");
});

test("real animation budgets measure committed five-move edges at default250ms, optional100ms and slow2s", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await chooseTimer(page);
  await expect(page.locator("#rotation-speed")).toHaveValue("3");
  // Configure zero using the actual shared solver; exclude this reset from edge timings.
  await page.locator("#rotation-speed").fill("5");
  await duration(page, "00:00");
  const measurements = [];
  for (const [stop, ms, target] of [
    ["3", 250, "00:10"],
    ["4", 100, "00:20"],
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

test("application switches apply Timer250 and Counter100 defaults while preserving Counter state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await page.locator("#rotation-speed").fill("5");
  await page.fill("#value", "42");
  await page.click("#set");
  await settled(page, "42");
  await page.locator("#format").uncheck();
  await page.selectOption("#application", "timer");
  await settled(page, "15:00");
  await expect(page.locator("#rotation-speed")).toHaveValue("3");
  await page.locator("#rotation-speed").fill("0");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cubistry-counter-v2")),
  );
  expect(saved.value).toBe(42);
  expect(saved.moveDuration).toBe(50);
  expect(saved.padded).toBe(false);
  await page.selectOption("#application", "certified");
  await settled(page, "42");
  await expect(page.locator("#rotation-speed")).toHaveValue("4");
  await expect(page.locator("#format")).not.toBeChecked();
  await page.selectOption("#application", "timer");
  await settled(page, "15:00");
  await expect(page.locator("#rotation-speed")).toHaveValue("3");
});

test("tab-resume catch-up reads the monotonic deadline, ignores wall-clock jumps and retains one latest target", async ({
  page,
}) => {
  await page.clock.install();
  await chooseTimer(page);
  await duration(page, "01:00");
  await pauseSoon(page);
  await page.click("#timer-start");
  await page.clock.fastForward(35500);
  await page.clock.runFor(1000);
  await settled(page, "00:30");
  await expect(page.locator("#timer-logical")).toHaveText("00:24");
  await page.clock.setSystemTime(new Date("2040-01-01T00:00:00Z"));
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await expect(page.locator("#timer-logical")).toHaveText("00:24");
  await page.clock.fastForward(30000);
  await page.clock.runFor(1000);
  await settled(page, "00:00");
  await expect(page.locator("#status")).toHaveText("Countdown · Complete");
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
    [-0.5, 0.5],
    [0.5, 0.5],
    [-0.5, -0.5],
    [0.5, -0.5],
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

async function verifyActualTimerMoves(page, startValue, finalValue, path) {
  const data = await page.evaluate(() => ({
    print: window.timerPrint,
    start: window.timerStart,
    moves: window.timerMoves,
  }));
  const word = data.moves
    .map(
      (p) =>
        p.move.face +
        (p.move.turns === 2 ? "2" : p.move.turns === -1 ? "'" : ""),
    )
    .join(" ");
  writeFileSync(
    path,
    JSON.stringify({
      kind: "jumps",
      print: data.print,
      start: data.start,
      startValue,
      transitions: [
        { value: finalValue, word, state: data.moves.at(-1)?.to ?? data.start },
      ],
    }),
  );
  const result = JSON.parse(
    execFileSync("python3", ["research/workshop-timer/verify.py", path], {
      encoding: "utf8",
    }),
  );
  expect(result.actualHTM).toBe(data.moves.length);
  expect(Number(await page.locator("#session-moves").innerText())).toBe(
    data.moves.length,
  );
  return data.moves.length;
}
test("exact Timer name, single focused action, dirty duration and independent speed controls", async ({
  page,
}) => {
  await chooseTimer(page);
  await expect(page.locator("#application option:checked")).toHaveText(
    "60-Minute Timer",
  );
  await expect(
    page.getByRole("heading", { name: "60-Minute Timer", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#timer-pause")).toHaveCount(0);
  await expect(page.locator(".timer-actions button")).toHaveCount(2);
  await expect(page.locator("#timer-speed option")).toHaveText([
    "1×",
    "10×",
    "20×",
    "50×",
    "100×",
  ]);
  await expect(page.locator("#rotation-speed")).toHaveValue("3");
  await page.fill("#timer-duration", "00:20");
  await page.locator("#timer-start").focus();
  await page.locator("#timer-start").press("Space");
  await expect(page.locator("#timer-logical")).toHaveText("00:20");
  await expect(page.locator("#timer-start")).toHaveText("Pause");
  await expect(page.locator("#timer-sync")).not.toContainText("Late");
  await expect(page.locator("#timer-start")).toBeFocused();
  await page.locator("#timer-start").press("Space");
  await expect(page.locator("#timer-start")).toHaveText("Resume");
  await expect(page.locator("#timer-start")).toBeFocused();
  await page.selectOption("#timer-speed", "20");
  await expect(page.locator("#rotation-speed")).toHaveValue("3");
  await page.locator("#rotation-speed").fill("4");
  await expect(page.locator("#timer-speed")).toHaveValue("20");
  await page.click("#timer-reset");
  await settled(page, "00:20");
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await page.fill("#timer-duration", "60:00");
  await page.click("#timer-start");
  await expect(page.locator("#error")).not.toBeEmpty();
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await settled(page, "00:20");
});
test("Stopwatch floors partial intervals, resumes fractions and stops at exact59:50 with actual full-state replay", async ({
  page,
}) => {
  await page.clock.install();
  await chooseTimer(page);
  await page.selectOption("#timer-mode", "stopwatch");
  await settled(page, "00:00");
  await expect(page.locator("#timer-duration-setting")).toBeHidden();
  await pauseSoon(page);
  await page.click("#timer-start");
  await page.clock.fastForward(9999);
  await expect(page.locator("#timer-logical")).toHaveText("00:09");
  await page.clock.runFor(2501);
  await settled(page, "00:10");
  await page.click("#timer-start");
  await expect(page.locator("#timer-start")).toHaveText("Resume");
  await page.clock.fastForward(50000);
  await expect(page.locator("#timer-logical")).toHaveText("00:12");
  await page.selectOption("#timer-speed", "100");
  await page.click("#timer-start");
  await page.clock.fastForward(36000);
  await page.clock.runFor(1000);
  await settled(page, "59:50");
  await expect(page.locator("#status")).toHaveText("Stopwatch · Limit reached");
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await expect(page.locator("#timer-start")).toBeDisabled();
  await verifyActualTimerMoves(
    page,
    90,
    359,
    "/tmp/cubistry-stopwatch-browser-commits.json",
  );
  await page.click("#timer-reset");
  await page.clock.runFor(1000);
  await settled(page, "00:00");
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await expect(page.locator("#timer-start")).toBeEnabled();
});
test("switching modes during slow accelerated playback stops and resets through one bounded legal catch-up", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await chooseTimer(page);
  await page.locator("#rotation-speed").fill("0");
  await page.selectOption("#timer-speed", "100");
  await pauseSoon(page);
  await page.click("#timer-start");
  await page.clock.fastForward(200);
  await page.clock.runFor(20);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
  await page.selectOption("#timer-mode", "stopwatch");
  await expect(page.locator("#timer-logical")).toHaveText("00:00");
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await expect(page.locator("#timer-speed")).toHaveValue("100");
  await expect(page.locator("#rotation-speed")).toHaveValue("0");
  for (let i = 0; i < 45; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, "00:00");
  await expect(page.locator("#status")).toHaveText("Stopwatch · Ready");
  await verifyActualTimerMoves(
    page,
    90,
    0,
    "/tmp/cubistry-mode-switch-browser-commits.json",
  );
});
test("interactive100x full-range countdown visibly lags slow-enough rotations and eventually verifies physical zero", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await chooseTimer(page);
  await duration(page, "59:50");
  await page.click("#reset-session-moves");
  await page.evaluate(() => {
    window.timerStart = window.timerMoves.at(-1).to;
    window.timerMoves = [];
    window.timerTimes = [];
  });
  await page.selectOption("#timer-speed", "100");
  const start = Date.now();
  await page.click("#timer-start");
  await expect(page.locator("#timer-sync")).toHaveAttribute("data-state", "synchronizing", { timeout: 5000 });
  await expect(page.locator("#timer-logical")).toHaveText("00:00", {
    timeout: 45000,
  });
  await expect(page.locator("#status")).toHaveText("Countdown · Complete", {
    timeout: 45000,
  });
  await settled(page, "00:00");
  const moves = await verifyActualTimerMoves(
    page,
    359,
    0,
    "/tmp/cubistry-timelapse-browser-commits.json",
  );
  writeFileSync(
    "/tmp/cubistry-timer-interactive-observation.json",
    JSON.stringify(
      {
        timerSpeed: 100,
        rotationMilliseconds: 250,
        virtualSeconds: 3590,
        wallMilliseconds: Date.now() - start,
        committedHTM: moves,
        observedLag: true,
        allIntermediateDisplaysPromised: false,
        physicalEnd: "00:00",
      },
      null,
      2,
    ),
  );
});

test("all five Timer rates integrate continuously while running and remain independent of rotation speed", async ({
  page,
}) => {
  await page.clock.install();
  await chooseTimer(page);
  await duration(page, "01:00");
  await pauseSoon(page);
  await page.click("#timer-start");
  for (const [rate, realMs, expected] of [
    ["1", 1000, "00:59"],
    ["10", 1000, "00:49"],
    ["20", 500, "00:39"],
    ["50", 200, "00:29"],
    ["100", 100, "00:19"],
  ]) {
    await page.selectOption("#timer-speed", rate);
    await page.clock.fastForward(realMs);
    await page.clock.runFor(1); // Sample beyond the exact floating-point second boundary.
    // A paused fake clock needs an explicit UI sample, independent of poll phase.
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await expect(page.locator("#timer-logical")).toHaveText(expected);
    await expect(page.locator("#timer-start")).toHaveText("Pause");
    await expect(page.locator("#rotation-speed")).toHaveValue("3");
  }
  await page.click("#timer-start");
  await page.clock.runFor(1000);
  await settled(page, "00:20");
  await expect(page.locator("#timer-start")).toHaveText("Resume");
  await verifyActualTimerMoves(
    page,
    90,
    2,
    "/tmp/cubistry-rate-change-browser-commits.json",
  );
});

test("visible Set and Enter apply the same duration without starting; Reset retains the configured duration", async ({ page }) => {
  await page.clock.install();
  await chooseTimer(page);
  await pauseSoon(page);
  const set = page.getByRole("button", { name: "Set", exact: true });
  await expect(set).toBeVisible();
  await page.fill("#timer-duration", "00:40");
  await set.click();
  await page.clock.runFor(1000);
  await settled(page, "00:40");
  const expected = await page.evaluate(() => window.timerMoves.at(-1).to);
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await expect(page.locator("#status")).toHaveText("Countdown · Ready");
  await page.clock.fastForward(30000);
  await expect(page.locator("#timer-logical")).toHaveText("00:40");
  await duration(page, "00:20");
  await page.fill("#timer-duration", "00:40");
  await page.locator("#timer-duration").press("Enter");
  await page.clock.runFor(1000);
  await settled(page, "00:40");
  expect(await page.evaluate(() => window.timerMoves.at(-1).to)).toEqual(expected);
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await page.click("#timer-start");
  await expect(set).toBeDisabled();
  await page.clock.fastForward(10000);
  await page.clock.runFor(1000);
  await page.click("#timer-start");
  await page.click("#timer-reset");
  await page.clock.runFor(1000);
  await settled(page, "00:40");
  await expect(page.locator("#status")).toHaveText("Countdown · Ready");
});

test("Set replaces a pending duration safely during an active legal animation without starting", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await chooseTimer(page);
  await duration(page, "00:40");
  await pauseSoon(page);
  await page.locator("#rotation-speed").fill("0");
  await page.fill("#timer-duration", "00:30");
  await page.click("#timer-set");
  await page.clock.runFor(20);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#timer-sync")).not.toContainText("Late");
  await page.clock.runFor(100);
  await expect(page.locator("#timer-sync")).not.toContainText("Late");
  await page.fill("#timer-duration", "00:20");
  await page.click("#timer-set");
  await expect(page.locator("#timer-start")).toHaveText("Start");
  for (let i = 0; i < 40; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, "00:20");
  await expect(page.locator("#timer-logical")).toHaveText("00:20");
  await expect(page.locator("#status")).toHaveText("Countdown · Ready");
  await verifyActualTimerMoves(page, 90, 2, "/tmp/cubistry-set-browser-commits.json");
});

for (const viewport of [{ width: 1280, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
  test(`Timer status distinguishes movement from backlog and keeps the active slider stable at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install();
    await chooseTimer(page);
    await duration(page, "00:40");
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#rotation-speed").fill("0");
    await pauseSoon(page);
    const slider = page.locator("#rotation-speed");
    await slider.scrollIntoViewIfNeeded();
    const initial = await slider.boundingBox();
    const sync = page.locator("#timer-sync");
    await expect(sync).toHaveAttribute("data-state", "idle");
    await expect(sync).toHaveText("", { useInnerText: true });
    await expect(page.locator("#timer-last-settled")).toBeHidden();
    await expect(page.getByText("Sequence", { exact: true })).toBeVisible();
    await expect(page.getByText("Current sequence", { exact: true })).toHaveCount(0);
    expect(await page.locator("html").evaluate(e => e.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const positions = [];
    const stable = async (phase) => {
      const box = await slider.boundingBox();
      positions.push({ phase, ...box });
      expect(Math.abs(box.y - initial.y), phase).toBeLessThan(0.5);
      expect(Math.abs(box.x - initial.x), phase).toBeLessThan(0.5);
      expect(box.width, phase).toBe(initial.width);
    };
    const capture = async (phase) => {
      const path = testInfo.outputPath(`${phase}.png`);
      if (viewport.width < 760) {
        await page.locator(".cube-footer").screenshot({ path });
      } else {
        await page.screenshot({ path, fullPage: true });
      }
    };
    await page.evaluate(() => {
      window.sliderSamples = [];
      window.sampleSlider = true;
      const sample = () => {
        if (!window.sampleSlider) return;
        window.sliderSamples.push(document.querySelector("#rotation-speed").getBoundingClientRect().y);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await capture("before");
    // DOM activation avoids scrolling away from the pointer on mobile; actual turns still animate.
    await page.evaluate(() => document.querySelector("#timer-start").click());
    await page.clock.runFor(5500);
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
    await expect(sync).toHaveAttribute("data-state", "moving");
    await expect(sync).toContainText("Moving");
    await expect(sync).toContainText("ms effective");
    await stable("Running / Moving");
    await capture("moving");
    await page.mouse.move(initial.x + 8, initial.y + initial.height / 2);
    await page.mouse.down();
    await page.mouse.move(initial.x + initial.width * 0.8, initial.y + initial.height / 2, { steps: 5 });
    await expect(slider).not.toHaveValue("0");
    await page.selectOption("#timer-speed", "100");
    await page.clock.fastForward(200);
    await expect(sync).toHaveAttribute("data-state", "synchronizing");
    await expect(sync).toContainText("Synchronizing");
    await stable("Running / Synchronizing with pointer held");
    await page.mouse.move(initial.x + initial.width * 0.4, initial.y + initial.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(slider).toHaveValue("2");
    await expect(page.locator("#timer-speed")).toHaveValue("100");
    await capture("synchronizing");
    await page.evaluate(() => document.querySelector("#timer-start").click());
    await expect(page.locator("#status")).toHaveText("Countdown · Paused");
    await stable("Paused / Synchronizing");
    await page.evaluate(() => document.querySelector("#timer-reset").click());
    await stable("Ready / Settling");
    for (let i = 0; i < 40; i++) {
      await page.clock.fastForward(2100);
      await page.clock.runFor(20);
    }
    await settled(page, "00:40");
    await expect(sync).toHaveAttribute("data-state", "idle");
    await expect(sync).toHaveText("", { useInnerText: true });
    await expect(page.locator("#timer-last-settled")).toBeHidden();
    await stable("Ready / Idle");
    await capture("after");
    const samples = await page.evaluate(() => {
      window.sampleSlider = false;
      return window.sliderSamples;
    });
    expect(samples.length).toBeGreaterThan(20);
    expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(0.5);
    const evidence = testInfo.outputPath("slider-positions.json");
    writeFileSync(evidence, JSON.stringify({ viewport, positions, samples }, null, 2));
    await testInfo.attach("slider-positions", { path: evidence, contentType: "application/json" });
  });
}

test("10ms is a seventh independent rotation preset and commits verified physical moves", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await chooseTimer(page);
  await page.locator("#rotation-speed").fill("6");
  await expect(page.locator("#rotation-speed")).toHaveAttribute("aria-valuetext", "10 ms preferred");
  await expect(page.locator("#timer-speed")).toHaveValue("1");
  const boundaries = await page.evaluate(async () => {
    const { CubeViewer, MAX_ANIMATION_SPEED } = await import("/packages/cube-viewer/src/index.ts");
    const receiver = {};
    CubeViewer.prototype.setAnimationSpeed.call(receiver, 7.5);
    let rejected = 0;
    for (const speed of [7.51, Infinity, NaN, 0]) {
      try { CubeViewer.prototype.setAnimationSpeed.call(receiver, speed); }
      catch { rejected++; }
    }
    return { maximum: MAX_ANIMATION_SPEED, accepted: receiver.animationSpeed, rejected };
  });
  expect(boundaries).toEqual({ maximum: 7.5, accepted: 7.5, rejected: 4 });
  await page.fill("#timer-duration", "00:30");
  await page.click("#timer-set");
  await settled(page, "00:30");
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await verifyActualTimerMoves(page, 90, 3, "/tmp/cubistry-10ms-browser-commits.json");
});

test("Sequence numbers identify actual starts, retain the finished number and ignore coalesced targets or move-stat resets", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await chooseTimer(page);
  const number = page.locator("#sequence-number");
  await expect(number).toHaveText("—");
  await duration(page, "00:40");
  await expect(number).toHaveText("1");
  await page.click("#timer-set");
  await expect(number).toHaveText("1");
  await page.locator("#rotation-speed").fill("0");
  await pauseSoon(page);
  await page.fill("#timer-duration", "00:30");
  await page.click("#timer-set");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
  await expect(number).toHaveText("2");
  for (const value of ["00:20", "00:10"]) {
    await page.fill("#timer-duration", value);
    await page.click("#timer-set");
    await expect(number).toHaveText("2");
  }
  for (let i = 0; i < 40; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, "00:10");
  await expect(number).toHaveText("3");
  await page.click("#reset-session-moves");
  await expect(page.locator("#session-moves")).toHaveText("0");
  await expect(number).toHaveText("3");
  await page.click("#timer-reset");
  await expect(number).toHaveText("3");
  await page.selectOption("#application", "certified");
  await expect(page.locator("#application")).toBeEnabled();
  await expect(number).toHaveText("—");
  await page.locator("#value").fill("1");
  await page.click("#set");
  await page.clock.runFor(1000);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "1");
  await expect(number).toHaveText("1");
});

async function observeEndpoints(page) {
  await startFrameGapProbe(page);
  await page.evaluate(async () => {
    const { WorkshopClock } = await import("/src/apps/timer/clock.ts");
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const { stateEquals } = await import("/packages/cube-core/src/index.ts");
    const start = WorkshopClock.prototype.start;
    WorkshopClock.prototype.start = function (...args) {
      const result = start.apply(this, args);
      window.actualDeadline = this.snapshot().next?.deadline;
      return result;
    };
    const cube = document.querySelector("#cube");
    new MutationObserver(() => {
      if (cube.getAttribute("aria-busy") === "false") window.deadlineCommits.push({
        at: performance.now(), value: cube.dataset.value,
        live: document.querySelector("#timer-logical").textContent });
    }).observe(cube, { attributes: true });
    const animate = CubeViewer.prototype.animate;
    CubeViewer.prototype.animate = async function (p, ...options) {
      window.timerViewer=this;window.timerPresentation=p;
      window.sequenceStartedAt ??= performance.now();
      window.nominalDurations.push(75 / this.animationSpeed);
      const motionWindow=options[0]?.();if(motionWindow)(window.motionWindows??=[]).push(motionWindow);
      const render = this.renderer.render, viewer = this;
      if (options[0]) this.renderer.render = function (...args) {
        const result = render.apply(this, args);
        const pivot = viewer.presentation.children.find(o => !o.userData.plasticCore && ![...viewer.cube.bodies.values()].includes(o)); // the static core ball is not the pivot
        if (pivot) window.endpointAngles.push({ at: performance.now(),
          angle: Math.max(Math.abs(pivot.rotation.x), Math.abs(pivot.rotation.y), Math.abs(pivot.rotation.z)),
          fullAngle: Math.abs(p.move.turns) * Math.PI / 2 });
        if (stateEquals(viewer.presented, p.to))
          window.endpointRenders.push({ at: performance.now(), state: viewer.presented });
        return result;
      };
      try { await animate.call(this, p, ...options); window.finalPhysicalState = p.to; }
      finally { this.renderer.render = render; }
    };
  });
}
async function clearEndpointObservation(page) {
  await resetFrameGap(page);
  await page.evaluate(() => {
    window.sequenceStartedAt = null; window.deadlineCommits = []; window.timerTimes = [];
    window.nominalDurations = []; window.motionWindows = []; window.endpointRenders = []; window.endpointAngles = [];
  });
}
async function endpointObservation(page, value = 1) {
  const frameGap = await readFrameGap(page);
  return { frameGap, ...(await page.evaluate(async (value) => {
    const { validateTimerRoute } = await import("/src/apps/timer/design.ts");
    const { stateEquals } = await import("/packages/cube-core/src/index.ts");
    const route = validateTimerRoute(await (await fetch("/workshop-timer.v1.json")).json());
    const { formatTimer } = await import("/src/apps/timer/clock.ts");
    const target = formatTimer(value);
    const committed = window.deadlineCommits.find(e => e.value === target);
    const rendered = window.endpointRenders.find(e => stateEquals(e.state, route.states[value]));
    return { target, deadline: window.actualDeadline, startedAt: window.sequenceStartedAt,
      settledAt: committed.at, liveAtCommit: committed.live, renderedAt: rendered?.at,
      exactFullState: stateEquals(window.finalPhysicalState, route.states[value]),
      motionWindows: window.motionWindows, nominalDurations: window.nominalDurations, actualMoveDurations: window.timerTimes,
      intermediateAngles: window.endpointAngles.filter(s => s.angle > .001 && s.angle < s.fullAngle - .001),
      samples: window.endpointAngles };
  }, value)) };
}
function expectEndpoint(observation, preferred) {
  expect(observation.exactFullState).toBe(true);
  expect(observation.actualMoveDurations).toHaveLength(5);
  expect(observation.motionWindows).toHaveLength(5);
  for(let i=1;i<5;i++)expect(Math.abs(observation.motionWindows[i].endAt-observation.motionWindows[i].durationMs-observation.motionWindows[i-1].endAt)).toBeLessThan(1e-6);
  expect(observation.motionWindows.at(-1).endAt).toBe(observation.deadline);
  if (preferred <= 250) expect(observation.nominalDurations).toEqual(Array(5).fill(preferred));
  else expect(Math.max(...observation.nominalDurations)).toBeLessThan(preferred);
  const tolerance = endpointToleranceMs(observation.frameGap); // 20 ms unless frames are slower than that
  expect(Math.abs(observation.settledAt - observation.deadline)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(observation.renderedAt - observation.deadline)).toBeLessThanOrEqual(tolerance);
  expect(observation.renderedAt).toBeLessThanOrEqual(observation.settledAt);
  expect(observation.liveAtCommit).toBe(observation.target);
  expect(observation.settledAt - observation.startedAt).toBeLessThanOrEqual(5000);
  if (preferred > 10) expect(observation.intermediateAngles.length).toBeGreaterThan(1);
}
test("real Timer final turn meets the actual clock endpoint within20ms at250ms, adaptive2s and10ms", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await chooseTimer(page);
  await page.locator("#rotation-speed").fill("6"); await duration(page, "00:20");
  await observeEndpoints(page);
  const observations = [];
  for (const [stop, preferred] of [["3", 250], ["0", 2000], ["6", 10]]) {
    await page.locator("#rotation-speed").fill("6"); await duration(page, "00:20");
    await page.locator("#rotation-speed").fill(stop); await clearEndpointObservation(page);
    await page.click("#timer-start"); await settled(page, "00:10");
    const observation = await endpointObservation(page); expectEndpoint(observation, preferred);
    await expect(page.locator("#rotation-speed")).toHaveValue(stop);
    observations.push({ preferredMilliseconds: preferred, ...observation });
    await page.click("#timer-start");
  }
  const path = testInfo.outputPath("endpoint-observations.json");
  writeFileSync(path, JSON.stringify({ kind: "foreground-real-clock-endpoint", toleranceMs: 20, // base bound; each observation carries its measured frameGap
    implementationHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    observedAt: new Date().toISOString(), observations }, null, 2));
  await testInfo.attach("endpoint-observations", { path, contentType: "application/json" });
});
test("real Stopwatch final physical state and live clock share the target endpoint within20ms", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await chooseTimer(page);
  await page.locator("#rotation-speed").fill("6"); await page.selectOption("#timer-mode", "stopwatch");
  await settled(page, "00:00"); await page.locator("#rotation-speed").fill("3");
  await observeEndpoints(page); await clearEndpointObservation(page);
  await page.click("#timer-start"); await settled(page, "00:10");
  const observation = await endpointObservation(page); expectEndpoint(observation, 250);
  const path = testInfo.outputPath("stopwatch-endpoint.json");
  writeFileSync(path, JSON.stringify({ implementationHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), observedAt: new Date().toISOString(), ...observation }, null, 2));
  await testInfo.attach("stopwatch-endpoint", { path, contentType: "application/json" });
});

test("100x10ms reports infeasible budget honestly and still commits a full legal final state", async ({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await chooseTimer(page);
  await page.locator("#rotation-speed").fill("6");
  await duration(page,"00:20");
  await page.selectOption("#timer-speed","100");
  await page.click("#timer-start");
  await expect(page.locator("#timer-sync")).toContainText(/Budget infeasible|Late/);
  await settled(page,"00:00");
  await verifyActualTimerMoves(page,90,0,"/tmp/cubistry-adaptive-infeasible-commits.json");
  await expect(page.locator("#status")).toHaveText("Countdown · Complete");
  await expect(page.locator("#rotation-speed")).toHaveValue("6");
});

test("pause reconciles active sequences and a active final turn through legal moves; Resume keeps fractions", async({page})=>{
  test.setTimeout(60000);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.clock.install();
  await chooseTimer(page);
  await pauseSoon(page);
  for(const [stop,advance] of [["0",5500],["3",9800]]) {
    await page.locator("#rotation-speed").fill("6");
    await page.fill("#timer-duration","00:20");
    await page.locator("#timer-duration").press("Enter");
    await page.clock.runFor(1000);
    await settled(page,"00:20");
    await page.locator("#rotation-speed").fill(stop);
    await page.click("#timer-start");
    // Skip idle preroll, then animate the entire scheduled active window.
    const idle = advance===5500 ? 4900 : 8000;
    await page.clock.fastForward(idle);
    await page.clock.runFor(advance-idle);
    await expect(page.locator("#timer-logical")).toHaveText(advance===5500 ? "00:15" : "00:11");
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy","true");
    await expect(page.locator("#timer-sync")).toHaveAttribute("data-state","moving");
    if(advance===9800) await expect(page.locator("#move-progress")).toHaveAttribute("aria-valuenow","4");
    const before=Number(await page.locator("#session-moves").innerText());
    await page.click("#timer-start");
    await expect(page.locator("#timer-sync")).not.toContainText("Late");
    if(advance===5500) {
      for(let i=0;i<12;i++) { await page.clock.fastForward(2100); await page.clock.runFor(20); }
    } else await page.clock.runFor(2000);
    await settled(page,"00:20");
    expect(Number(await page.locator("#session-moves").innerText())).toBeGreaterThan(before);
    await expect(page.locator("#timer-logical")).toHaveText(advance===5500 ? "00:15" : "00:11");
    await page.click("#timer-start");
    await page.clock.runFor(10000-advance+1000);
    await settled(page,"00:10");
    await page.clock.runFor(1);
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await expect(page.locator("#timer-logical")).toHaveText("00:09");
    await page.click("#timer-start");
  }
  await verifyActualTimerMoves(page,90,1,"/tmp/cubistry-predictive-pause-commits.json");
});

test("live readout advances each second while cube keeps ten-second buckets, including fractional Stopwatch pause",async({page})=>{
  await page.clock.install();await chooseTimer(page);await duration(page,"00:20");
  await pauseSoon(page);
  const moves=await page.locator("#session-moves").innerText();
  await page.click("#timer-start");
  for(const [elapsed,live] of [[1050,"00:19"],[1000,"00:18"]]) {
    await page.clock.runFor(elapsed);
    await expect(page.locator("#timer-logical")).toHaveText(live);
    await settled(page,"00:20");
    await expect(page.locator("#session-moves")).toHaveText(moves);
  }
  await page.clock.runFor(250);await page.click("#timer-start");
  await page.clock.fastForward(50000);
  await expect(page.locator("#timer-logical")).toHaveText("00:18");
  await page.click("#timer-reset");
  await expect(page.locator("#timer-logical")).toHaveText("00:20");
  await page.selectOption("#timer-mode","stopwatch");await page.clock.runFor(1000);await settled(page,"00:00");
  await page.click("#timer-start");
  await page.clock.fastForward(11000);await page.clock.runFor(1500);await settled(page,"00:10");
  await expect(page.locator("#timer-logical")).toHaveText("00:12");
  await page.click("#timer-start");await page.clock.fastForward(50000);
  await expect(page.locator("#timer-logical")).toHaveText("00:12");await settled(page,"00:10");
  await page.click("#timer-start");await page.clock.runFor(550);
  await expect(page.locator("#timer-logical")).toHaveText("00:13");await settled(page,"00:10");
  await page.click("#timer-reset");await page.clock.runFor(1000);
  await expect(page.locator("#timer-logical")).toHaveText("00:00");await settled(page,"00:00");
});

test("automatic terminal tick preserves the real final turn endpoint and commits zero within20ms",async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await chooseTimer(page);
  await page.locator("#rotation-speed").fill("6");await duration(page,"00:10");
  await page.locator("#rotation-speed").fill("3");await observeEndpoints(page);await clearEndpointObservation(page);
  await page.click("#timer-start");await settled(page,"00:00");
  const observation=await endpointObservation(page,0);expectEndpoint(observation,250);
  await expect(page.locator("#status")).toHaveText("Countdown · Complete");
  const path=testInfo.outputPath("terminal-endpoint.json");writeFileSync(path,JSON.stringify({implementationHead:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),observedAt:new Date().toISOString(),...observation},null,2));
  await testInfo.attach("terminal-endpoint",{path,contentType:"application/json"});
});

test("an active final turn without an interior hold cancels on Reset and a rate extension rebases active motion without reversing or stale completion",async({page})=>{
  test.setTimeout(60000);await page.emulateMedia({reducedMotion:"no-preference"});
  await page.clock.install();await chooseTimer(page);await page.locator("#rotation-speed").fill("6");
  await duration(page,"00:20");await observeEndpoints(page);await clearEndpointObservation(page);
  await pauseSoon(page);
  await page.locator("#rotation-speed").fill("3");await page.click("#timer-start");
  await page.clock.fastForward(8000);await page.clock.runFor(1800);
  await expect(page.locator("#move-progress")).toHaveAttribute("aria-valuenow","4");
  const active=await page.evaluate(async()=>{
    const {stateEquals}=await import("/packages/cube-core/src/index.ts");
    const viewer=window.timerViewer,event=window.timerPresentation,bodies=new Set(viewer.cube.bodies.values());
    const pivot=viewer.presentation.children.find(o=>!o.userData.plasticCore&&!bodies.has(o));
    return {busy:viewer.busy,fromMatches:stateEquals(viewer.presented,event.from),
      angle:pivot?Math.max(Math.abs(pivot.rotation.x),Math.abs(pivot.rotation.y),Math.abs(pivot.rotation.z)):null,
      fullAngle:Math.abs(event.move.turns)*Math.PI/2};
  });
  expect(active.busy).toBe(true);expect(active.fromMatches).toBe(true);
  expect(active.angle).toBeGreaterThan(0);expect(active.angle).toBeLessThan(active.fullAngle);
  await page.click("#timer-reset");await page.clock.runFor(2200);await settled(page,"00:20");
  await expect(page.locator("#status")).toHaveText("Countdown · Ready");
  // This immutable adjacent edge has exactly one legal move, allowing a visible
  // 250 ms final turn at 10x before extending its deadline by returning to 1x.
  await page.locator("#rotation-speed").fill("6");await page.fill("#timer-duration","20:10");
  await page.click("#timer-set");await page.clock.runFor(1000);await settled(page,"20:10");
  await page.locator("#rotation-speed").fill("3");await page.selectOption("#timer-speed","10");
  await clearEndpointObservation(page);await page.click("#timer-start");await page.clock.runFor(900);
  const before=await page.evaluate(()=>window.endpointAngles.at(-1).angle);expect(before).toBeGreaterThan(0);
  await page.selectOption("#timer-speed","1");await page.clock.runFor(200);
  await expect(page.locator("#cube")).toHaveAttribute("data-value","20:10");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy","true");
  const after=await page.evaluate(()=>window.endpointAngles.at(-1).angle);expect(after).toBeGreaterThanOrEqual(before);
  await page.clock.runFor(1000);await settled(page,"20:00");
  const samples=await page.evaluate(()=>window.endpointAngles.map(s=>s.angle));
  expect(samples.every((a,i)=>i===0||a>=samples[i-1]-1e-9)).toBe(true);
  await verifyActualTimerMoves(page,90,120,"/tmp/cubistry-endpoint-lifecycle-commits.json");
});

test("an initially infeasible final turn accepts a later feasible endpoint when rate slows",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.clock.install();await chooseTimer(page);
  await page.locator("#rotation-speed").fill("6");await duration(page,"20:10");
  await pauseSoon(page);
  await page.locator("#rotation-speed").fill("3");await page.selectOption("#timer-speed","100");
  await page.click("#timer-start");await page.clock.runFor(8);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy","true");
  await page.selectOption("#timer-speed","1");await page.clock.runFor(200);
  await expect(page.locator("#cube")).toHaveAttribute("data-value","20:10");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy","true");
  await page.clock.fastForward(8000);await page.clock.runFor(1100);await settled(page,"20:00");
  await verifyActualTimerMoves(page,90,120,"/tmp/cubistry-attachable-endpoint-commits.json");
});

test("a reduced-motion preference change cannot run an active presentation twice",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.clock.install();await chooseTimer(page);
  await duration(page,"00:20");await pauseSoon(page);
  await page.evaluate(async()=>{
    const originalMedia=window.matchMedia.bind(window);window.mediaQueries=0;
    window.matchMedia=(query)=>{if(query==="(prefers-reduced-motion: reduce)")window.mediaQueries++;return originalMedia(query);};
    const {CubeViewer}=await import("/packages/cube-viewer/src/index.ts"),animate=CubeViewer.prototype.animate;
    CubeViewer.prototype.animate=async function(p,...args){
      const before=window.mediaQueries;try{return await animate.call(this,p,...args);}
      finally{if(args[0])window.finalMediaQueries=window.mediaQueries-before;}
    };
  });
  await page.click("#timer-start");await page.clock.fastForward(8000);await page.clock.runFor(1800);
  await expect(page.locator("#move-progress")).toHaveAttribute("aria-valuenow","4");
  const before=Number(await page.locator("#session-moves").innerText());
  await page.emulateMedia({reducedMotion:"reduce"});await page.clock.runFor(520);
  await settled(page,"00:10");expect(Number(await page.locator("#session-moves").innerText())).toBe(before+1);
  await page.clock.runFor(100);await settled(page,"00:10");
  expect(Number(await page.locator("#session-moves").innerText())).toBe(before+1);
  expect(await page.evaluate(()=>window.finalMediaQueries)).toBe(1);
});
