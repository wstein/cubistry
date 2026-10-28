import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
async function choose(page, leadingZero = true) {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  if (!leadingZero) await page.locator("#format").uncheck();
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const configure = CubeViewer.prototype.configure,
      animate = CubeViewer.prototype.animate;
    window.fiveMoves = [];
    CubeViewer.prototype.configure = function (p, s, a) {
      window.fivePrint = p;
      window.fiveStart = s;
      return configure.call(this, p, s, a);
    };
    CubeViewer.prototype.animate = async function (p) {
      await animate.call(this, p);
      window.fiveMoves.push(p);
    };
  });
  await page.selectOption("#application", "five-second-timer");
  await settled(page, "30:00");
}
async function settled(page, value) {
  await expect(page.locator("#cube")).toHaveAttribute("data-value", value, {
    timeout: 20000,
  });
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
async function duration(page, value) {
  await page.fill("#timer-duration", value);
  await page.locator("#timer-duration").press("Enter");
  await settled(page, value);
}
function formatted(bucket) {
  const n = bucket * 5;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
async function replay(page, transitions, path) {
  const data = await page.evaluate(() => ({
    print: window.fivePrint,
    start: window.fiveStart,
  }));
  writeFileSync(
    path,
    JSON.stringify({ ...data, startValue: 360, transitions }),
  );
  const result = JSON.parse(
    execFileSync(
      "python3",
      [
        ".five-second-research/research/five-second-timer/verify_trace.py",
        path,
      ],
      { encoding: "utf8" },
    ),
  );
  expect(result.status).toBe("PASS");
  return result;
}
test("five-second option has exact cap, six rotation stops, independent print and preserved legacy defaults", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await choose(page);
  await expect(
    page.getByRole("heading", { name: "5-Second Timer", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#timer-bounds")).toHaveText(
    "00:00–39:55 · 5-second steps",
  );
  await expect(page.locator("#rotation-speed")).toHaveValue("3");
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  for (const stop of ["0", "1", "2", "3", "4", "5"])
    await page.locator("#rotation-speed").fill(stop);
  for (const invalid of ["40:00", "39:56", "00:01"]) {
    await page.fill("#timer-duration", invalid);
    await page.locator("#timer-duration").press("Enter");
    await expect(page.locator("#error")).not.toBeEmpty();
    await settled(page, "30:00");
  }
  await duration(page, "39:55");
  await duration(page, "00:05");
  await page.selectOption("#application", "timer");
  await settled(page, "15:00");
  await expect(page.locator("#rotation-speed")).toHaveValue("3");
  await page.selectOption("#application", "certified");
  await settled(page, "0");
  await expect(page.locator("#rotation-speed")).toHaveValue("4");
  await page.locator('[data-delta="1"]').click();
  await settled(page, "1");
});
test("full thirty-minute countdown visits all361 actual states and independently replays1681HTM", async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.clock.install();
  await choose(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.click("#timer-start");
  const epoch = await page.evaluate(() => performance.now());
  let offset = 0;
  const transitions = [];
  for (let value = 359; value >= 0; value--) {
    const now = await page.evaluate(() => performance.now());
    await page.clock.fastForward(
      Math.max(0, epoch + (360 - value) * 5000 - now),
    );
    await page.clock.runFor(100);
    await settled(page, formatted(value));
    const step = await page.evaluate((offset) => {
      const moves = window.fiveMoves.slice(offset);
      return {
        word: moves
          .map(
            (p) =>
              p.move.face +
              (p.move.turns === 2 ? "2" : p.move.turns === -1 ? "'" : ""),
          )
          .join(" "),
        state: moves.at(-1).to,
        count: window.fiveMoves.length,
      };
    }, offset);
    offset = step.count;
    transitions.push({ value, word: step.word, state: step.state });
  }
  expect(offset).toBe(1681);
  await expect(page.locator("#session-moves")).toHaveText("1681");
  await expect(page.locator("#status")).toHaveText("Countdown · Complete");
  expect(
    (await replay(page, transitions, "/tmp/cubistry-five-countdown.json"))
      .actualTransitions,
  ).toBe(360);
});
test("slow accelerated playback retains one latest target, pauses fractions, resumes and resets with legal commits", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await choose(page);
  await duration(page, "01:00");
  await page.locator("#rotation-speed").fill("0");
  await page.selectOption("#timer-speed", "100");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.click("#timer-start");
  await page.clock.runFor(400);
  await expect(page.locator("#timer-sync")).toBeVisible();
  await page.click("#timer-start");
  await expect(page.locator("#status")).toContainText("Paused");
  const frozen = await page.locator("#timer-logical").innerText();
  for (let i = 0; i < 45; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, frozen);
  await expect(page.locator("#timer-logical")).toHaveText(frozen);
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-queued",
    "",
  );
  await page.click("#timer-start");
  await page.clock.fastForward(500);
  await page.clock.runFor(20);
  await page.click("#timer-reset");
  for (let i = 0; i < 50; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, "01:00");
  await expect(page.locator("#status")).toHaveText("Countdown · Ready");
  const t = await page.evaluate(() => ({
    value: 12,
    word: window.fiveMoves
      .map(
        (p) =>
          p.move.face +
          (p.move.turns === 2 ? "2" : p.move.turns === -1 ? "'" : ""),
      )
      .join(" "),
    state: window.fiveMoves.at(-1).to,
  }));
  await replay(page, [t], "/tmp/cubistry-five-slow.json");
});
test("Stopwatch floors five-second fractions and terminates exactly39:55 at100x; reset and application return retain Counter formatting", async ({
  page,
}) => {
  await page.clock.install();
  await choose(page, false);
  await page.selectOption("#timer-mode", "stopwatch");
  await settled(page, "00:00");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.click("#timer-start");
  await page.clock.fastForward(4500);
  await expect(page.locator("#timer-logical")).toHaveText("00:00");
  await page.clock.runFor(3000);
  await settled(page, "00:05");
  await page.click("#timer-start");
  await page.clock.fastForward(50000);
  await expect(page.locator("#timer-logical")).toHaveText("00:05");
  await page.selectOption("#timer-speed", "100");
  await page.click("#timer-start");
  await page.clock.fastForward(24000);
  await page.clock.runFor(1000);
  await settled(page, "39:55");
  await expect(page.locator("#status")).toHaveText("Stopwatch · Limit reached");
  await expect(page.locator("#timer-start")).toBeDisabled();
  const t = await page.evaluate(() => ({
    value: 479,
    word: window.fiveMoves
      .map(
        (p) =>
          p.move.face +
          (p.move.turns === 2 ? "2" : p.move.turns === -1 ? "'" : ""),
      )
      .join(" "),
    state: window.fiveMoves.at(-1).to,
  }));
  await replay(page, [t], "/tmp/cubistry-five-stopwatch.json");
  await page.click("#timer-reset");
  await page.clock.runFor(1000);
  await settled(page, "00:00");
  await page.selectOption("#application", "certified");
  await settled(page, "0");
  await expect(page.locator("#format")).not.toBeChecked();
});
test("damaged five-second certificate leaves current Counter usable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await page.route("**/five-second-timer.v1.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.selectOption("#application", "five-second-timer");
  await expect(page.locator("#error")).toContainText("integrity");
  await expect(page.locator("#application")).toHaveValue("certified");
  await page.locator('[data-delta="1"]').click();
  await settled(page, "1");
});
