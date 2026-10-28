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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.click("#timer-start");
  await page.clock.fastForward(9999);
  await expect(page.locator("#timer-logical")).toHaveText("00:00");
  await page.clock.runFor(2501);
  await settled(page, "00:10");
  await page.click("#timer-start");
  await expect(page.locator("#timer-start")).toHaveText("Resume");
  await page.clock.fastForward(50000);
  await expect(page.locator("#timer-logical")).toHaveText("00:10");
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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.click("#timer-start");
  for (const [rate, realMs, expected] of [
    ["1", 1000, "01:00"],
    ["10", 1000, "00:50"],
    ["20", 500, "00:40"],
    ["50", 200, "00:30"],
    ["100", 100, "00:20"],
  ]) {
    await page.selectOption("#timer-speed", rate);
    await page.clock.fastForward(realMs);
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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.locator("#rotation-speed").fill("0");
  await page.fill("#timer-duration", "00:30");
  await page.click("#timer-set");
  await page.clock.runFor(20);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
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
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
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
    await page.screenshot({ path: testInfo.outputPath("before.png"), fullPage: true });
    // DOM activation avoids scrolling away from the pointer on mobile; actual turns still animate.
    await page.evaluate(() => document.querySelector("#timer-start").click());
    await page.clock.fastForward(10000);
    await page.clock.runFor(40);
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
    await expect(sync).toHaveAttribute("data-state", "moving");
    await expect(sync).toHaveText("Moving", { useInnerText: true });
    await stable("Running / Moving");
    await page.screenshot({ path: testInfo.outputPath("moving.png"), fullPage: true });
    await page.mouse.move(initial.x + 8, initial.y + initial.height / 2);
    await page.mouse.down();
    await page.mouse.move(initial.x + initial.width * 0.8, initial.y + initial.height / 2, { steps: 5 });
    await expect(slider).not.toHaveValue("0");
    await page.clock.fastForward(10000);
    await page.clock.runFor(40);
    await expect(sync).toHaveAttribute("data-state", "synchronizing");
    await expect(sync).toContainText("Synchronizing · last settled 00:40");
    await stable("Running / Synchronizing with pointer held");
    await page.mouse.move(initial.x + initial.width * 0.4, initial.y + initial.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(slider).toHaveValue("2");
    await expect(page.locator("#timer-speed")).toHaveValue("1");
    await page.screenshot({ path: testInfo.outputPath("synchronizing.png"), fullPage: true });
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
    await page.screenshot({ path: testInfo.outputPath("after.png"), fullPage: true });
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
  await expect(page.locator("#rotation-speed")).toHaveAttribute("aria-valuetext", "10 ms per HTM move");
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
