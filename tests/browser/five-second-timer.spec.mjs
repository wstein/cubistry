import { test, expect } from "@playwright/test";
import { startFrameGapProbe, resetFrameGap, readFrameGap, endpointToleranceMs } from "../helpers/frame-gap.mjs";
import { pauseSoon } from "../helpers/pause-clock.mjs";
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
    window.fiveTimes = [];
    CubeViewer.prototype.configure = function (p, s, a) {
      window.fivePrint = p;
      window.fiveStart = s;
      return configure.call(this, p, s, a);
    };
    CubeViewer.prototype.animate = async function (p, timing) {
      if (window.fiveHoldNext) {
        window.fiveHoldNext = false;
        window.fiveHeld = true;
        await new Promise((resolve) => {
          window.fiveRelease = resolve;
        });
      }
      const began = performance.now();
      const endpoint = timing?.();
      await animate.call(this, p, timing);
      window.fiveMoves.push(p);
      window.fiveTimes.push({
        began,
        settled: performance.now(),
        endAt: endpoint?.endAt ?? null,
      });
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
test("five-second option has exact cap, inherited rotation stops, independent print and preserved legacy defaults", async ({
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
  await expect(page.locator("#rotation-speed")).toHaveAttribute("max", "6");
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  for (const stop of ["0", "1", "2", "3", "4", "5", "6"])
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
  test.setTimeout(600000);
  await page.clock.install();
  await choose(page);
  await pauseSoon(page, 1000);
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
  // Register application intervals on an already paused clock. Setup moves still
  // commit legally; real animation is enabled before the intentional stall.
  await page.clock.install();
  await pauseSoon(page, 1000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await choose(page);
  await duration(page, "01:00");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("#rotation-speed").fill("0");
  await page.selectOption("#timer-speed", "100");
  // Simulate one stalled presentation; all moves still use the actual viewer.
  await page.evaluate(() => {
    window.fiveHoldNext = true;
  });
  await page.click("#timer-start");
  await page.clock.runFor(400);
  const backlog = await page.evaluate(() => ({
    held: window.fiveHeld,
    active: document.querySelector("#move-progress").dataset.target,
    queued: document.querySelector("#move-progress").dataset.queued,
    logical: document.querySelector("#timer-logical").textContent,
  }));
  expect(backlog.held).toBe(true);
  const [queuedMinutes, queuedSeconds] = backlog.logical.split(":").map(Number);
  expect(Number(backlog.queued)).toBe(
    Math.ceil((queuedMinutes * 60 + queuedSeconds) / 5),
  );
  expect(Number(backlog.queued)).toBeLessThan(11);
  expect(backlog.active).not.toBe(backlog.queued);
  await expect(page.locator("#timer-sync")).toHaveAttribute(
    "data-state",
    "synchronizing",
  );
  await expect(page.locator("#timer-last-settled")).toBeVisible();
  await page.click("#timer-start");
  await expect(page.locator("#status")).toContainText("Paused");
  const frozen = await page.locator("#timer-logical").innerText();
  const [minutes, seconds] = frozen.split(":").map(Number);
  const frozenPhysical = formatted(Math.ceil((minutes * 60 + seconds) / 5));
  await page.evaluate(() => window.fiveRelease());
  for (let i = 0; i < 45; i++) {
    await page.clock.fastForward(2100);
    await page.clock.runFor(20);
  }
  await settled(page, frozenPhysical);
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
  await expect(page.locator("#timer-bounds")).toHaveText("Cube: 5-second steps · limit 39:55");
  await pauseSoon(page, 1000);
  await page.click("#timer-start");
  await page.clock.fastForward(4500);
  await expect(page.locator("#timer-logical")).toHaveText("00:04");
  await page.clock.runFor(3000);
  await settled(page, "00:05");
  await page.click("#timer-start");
  const frozenLive = await page.locator("#timer-logical").innerText();
  await page.clock.fastForward(50000);
  await expect(page.locator("#timer-logical")).toHaveText(frozenLive);
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

for (const [stop, preferred] of [
  ["3", 250],
  ["0", 2000],
  ["6", 10],
])
  test(`five-second six-move sequence settles at its deadline at ${preferred}ms preference`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 800, height: 700 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await choose(page);
    await page.locator("#rotation-speed").fill("6");
    await duration(page, "00:05");
    await page.locator("#rotation-speed").fill(stop);
    await startFrameGapProbe(page);
    await resetFrameGap(page);
    const offset = await page.evaluate(() => window.fiveMoves.length);
    const epoch = await page.evaluate(() => {
      window.fiveMovingSample = null;
      const sample = () => {
        const cube = document.querySelector("#cube"),
          motion = document.querySelector("#timer-sync").dataset.state;
        if (cube.getAttribute("aria-busy") === "true" && motion === "moving") {
          window.fiveMovingSample = {
            at: performance.now(),
            physical: cube.dataset.value,
            logical: document.querySelector("#timer-logical").textContent,
            effective: Number(
              document
                .querySelector("#timer-effective")
                .textContent.match(/[\d.]+/)[0],
            ),
          };
        } else if (!window.fiveMovingSample) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      const at = performance.now();
      document.querySelector("#timer-start").click();
      return at;
    });
    await settled(page, "00:00");
    const frameGap = await readFrameGap(page);
    const moving = await page.evaluate(() => window.fiveMovingSample);
    expect(moving).not.toBeNull();
    expect(moving.physical).toBe("00:05");
    expect(moving.at).toBeLessThan(epoch + 5000);
    const effective = moving.effective;
    const trace = await page.evaluate(
      ({ offset, epoch, preferred, effective }) => {
        const moves = window.fiveMoves,
          times = window.fiveTimes.slice(offset);
        return {
          print: window.fivePrint,
          start: window.fiveStart,
          startValue: 360,
          transitions: [
            {
              value: 0,
              word: moves
                .map(
                  (p) =>
                    p.move.face +
                    (p.move.turns === 2 ? "2" : p.move.turns === -1 ? "'" : ""),
                )
                .join(" "),
              state: moves.at(-1).to,
              moves,
            },
          ],
          observation: {
            preferredMilliseconds: preferred,
            effectiveMilliseconds: effective,
            movingSample: window.fiveMovingSample,
            deadlineMilliseconds: times.at(-1).endAt,
            firstMoveMilliseconds: times[0].began,
            settledMilliseconds: times.at(-1).settled,
            actualHTM: times.length,
            intervalMilliseconds: 5000,
            viewport: [innerWidth, innerHeight],
            userAgent: navigator.userAgent,
            reducedMotion: false,
          },
        };
      },
      { offset, epoch, preferred, effective },
    );
    const path = testInfo.outputPath("deadline-observation.json");
    writeFileSync(path, JSON.stringify(trace, null, 2));
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
    expect(trace.observation.actualHTM).toBe(6);
    expect(effective).toBeLessThanOrEqual(preferred);
    expect(trace.observation.firstMoveMilliseconds).toBeGreaterThanOrEqual(
      epoch + 2500 - 50,
    );
    expect(trace.observation.deadlineMilliseconds).not.toBeNull();
    expect(
      Math.abs(
        trace.observation.settledMilliseconds -
          trace.observation.deadlineMilliseconds,
      ),
    ).toBeLessThanOrEqual(endpointToleranceMs(frameGap)); // 20 ms unless frames are slower than that
    expect(
      trace.observation.settledMilliseconds -
        trace.observation.firstMoveMilliseconds,
    ).toBeLessThanOrEqual(2500);
    await expect(page.locator("#rotation-speed")).toHaveValue(stop);
    await expect(page.locator("#speed-label")).toHaveText(
      `${preferred === 2000 ? "2 s" : preferred + " ms"} preferred`,
    );
    await expect(page.locator("#timer-sync")).not.toContainText("Late");
  });
