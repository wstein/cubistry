import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test.use({ timezoneId: "Europe/Berlin" });
async function ready(page, time) {
  // Install the fake clock slightly in the past: pauseAt() rejects a target
  // that real time has already overtaken, which happens under CPU load.
  const target = new Date(time);
  await page.clock.install({ time: new Date(target.getTime() - 10_000) });
  await page.clock.pauseAt(target);
  await page.goto("/clock.html");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
}
async function physical(page) {
  return page.evaluate(async () => {
    const { clockUnits } = await import("/src/clock.mjs");
    const { validateHsmDesign, hsmTarget } = await import(
      "/src/apps/hsm/design.ts"
    );
    const { matchesTarget } = await import(
      "/packages/cube-mechanics/src/index.ts"
    );
    // The live clock defaults to word lettering, which has its own print id.
    const { hsmDesignFor } = await import("/src/apps/hsm/lettering.ts");
    const d = hsmDesignFor(
      validateHsmDesign(await (await fetch("/hsm-counter.v3.json")).json()),
      "words",
    );
    return clockUnits.map((u, i) => ({
      value: u.controller.currentValue,
      valid: matchesTarget(
        d.print,
        u.controller.state,
        hsmTarget(["H", "M", "S"][i], u.controller.currentValue),
      ),
    }));
  });
}
test("live H M S clock initializes from one local instant with real blanks and independent speeds", async ({
  page,
}) => {
  await ready(page, "2026-10-28T11:34:56Z");
  await expect(page.locator("#clock-digital")).toHaveText("12:34:56");
  await expect(page.locator("#clock-zone")).toHaveText("Europe/Berlin");
  for (const [name, value, speed] of [
    ["hours", 12, "500"],
    ["minutes", 34, "250"],
    ["seconds", 56, "100"],
  ]) {
    await expect(page.locator("#clock-" + name)).toHaveAttribute(
      "data-value",
      String(value),
    );
    await expect(page.locator("#" + name + "-speed")).toHaveValue(speed);
  }
  expect(await physical(page)).toEqual([
    { value: 12, valid: true },
    { value: 34, valid: true },
    { value: 56, valid: true },
  ]);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(
    await page.evaluate(async () => {
      const { clockUnits, clockStage } = await import("/src/clock.mjs");
      const cubes = clockStage.presentation.children.filter((o) => o.type === "Group");
      return {
        roots: cubes.length,
        positions: cubes.map((c) => c.position.x),
        renderers: clockUnits.every(
          (u) => u.controller.view.renderer === clockStage.renderer,
        ),
        cameras: clockUnits.every(
          (u) => u.controller.view.camera === clockStage.camera,
        ),
        groups: clockUnits.every(
          (u) => u.controller.view.scene.parent === clockStage.presentation,
        ),
        bodies: cubes.map((c) => c.children.length),
      };
    }),
  ).toEqual({
    roots: 3,
    positions: [-2.8, 0, 2.8],
    renderers: true,
    cameras: true,
    groups: true,
    bodies: [9, 9, 9], // eight cubies plus the static core ball
  });
  await page.clock.runFor(100);
  const canvas = page.locator("#clock-scene canvas"),
    box = await canvas.boundingBox();
  const before = await page.evaluate(async () => {
    const { clockStage } = await import("/src/clock.mjs");
    return { camera: clockStage.camera.position.toArray(), presentation: clockStage.presentation.quaternion.toArray() };
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 8);
  await page.mouse.up();
  await page.clock.runFor(50);
  expect(
    await page.evaluate(async () => {
      const { clockStage } = await import("/src/clock.mjs");
      return clockStage.presentation.quaternion.toArray();
    }),
  ).not.toEqual(before.presentation);
  expect(await page.evaluate(async () => {
    const { clockStage } = await import("/src/clock.mjs");
    return clockStage.camera.position.toArray();
  })).toEqual(before.camera);
  expect((await physical(page)).every((u) => u.valid)).toBe(true);
  await page.screenshot({
    path: "test-results/live-clock-shared-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(100);
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/live-clock-mobile.png",
    fullPage: true,
  });
});
test("live clock selects the preferred quarter-turn defaults H 500 ms, M 250 ms, S 100 ms on load", async ({
  page,
}) => {
  await ready(page, "2026-10-28T11:34:56Z");
  for (const [name, speed] of [
    ["hours", "500"],
    ["minutes", "250"],
    ["seconds", "100"],
  ]) {
    const select = page.locator("#" + name + "-speed");
    await expect(select).toHaveValue(speed);
    // The HTML default and the effective unit setting agree.
    expect(
      await select.evaluate((e) => e.querySelector("option[selected]").value),
    ).toBe(speed);
  }
  expect(
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/clock.mjs");
      return clockUnits.map((u) => u.duration);
    }),
  ).toEqual([500, 250, 100]);
});
test("the previous preferred speeds stay selectable through query parameters", async ({
  page,
}) => {
  await page.goto(
    "/clock.html?hours-speed=250&minutes-speed=100&seconds-speed=50",
  );
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  for (const [name, speed] of [
    ["hours", "250"],
    ["minutes", "100"],
    ["seconds", "50"],
  ])
    await expect(page.locator("#" + name + "-speed")).toHaveValue(speed);
  expect(
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/clock.mjs");
      return clockUnits.map((u) => u.duration);
    }),
  ).toEqual([250, 100, 50]);
});
test("midnight wrap schedules all three final turns to the same target instant", async ({
  page,
}) => {
  await ready(page, "2026-12-31T22:59:56Z");
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const { clockUnits } = await import("/src/clock.mjs");
    const animate = CubeViewer.prototype.animate;
    window.clockEndpoints = [];
    CubeViewer.prototype.animate = async function (p, timing) {
      const end = timing?.();
      const controller = clockUnits.find(
        (u) => u.controller.view === this,
      ).controller;
      const final =
        controller.progress.completed + 1 === controller.progress.total &&
        controller.progress.target === 0;
      await animate.call(this, p, timing);
      if (end && final)
        window.clockEndpoints.push({
          unit: this.host.dataset.unit,
          endAt: end.endAt,
          settled: performance.now(),
        });
    };
  });
  await page.clock.runFor(4050);
  await expect(page.locator("#clock-digital")).toHaveText("00:00:00");
  expect(await physical(page)).toEqual([
    { value: 0, valid: true },
    { value: 0, valid: true },
    { value: 0, valid: true },
  ]);
  const final = await page.evaluate(() =>
    ["H", "M", "S"].map((unit) =>
      window.clockEndpoints.filter((e) => e.unit === unit).at(-1),
    ),
  );
  expect(final.every(Boolean)).toBe(true);
  expect(new Set(final.map((e) => e.endAt)).size).toBe(1);
  for (const e of final)
    expect(Math.abs(e.settled - e.endAt)).toBeLessThanOrEqual(30);
});
test("returning from suspension synchronizes to live seconds without a missed-tick backlog", async ({
  page,
}) => {
  await ready(page, "2026-10-28T11:34:56Z");
  await page.clock.fastForward(30000);
  await page.clock.runFor(100);
  await expect(page.locator("#clock-digital")).toHaveText("12:35:26");
  const values = await physical(page);
  expect(values.every((v) => v.valid)).toBe(true);
  expect(values[2].value).toBe(26);
  await page.selectOption(
    "#clock-application",
    "index.html?application=hsm-counter",
  );
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "hsm-counter",
  );
});
test("real animation ends all three midnight sequences at the shared live deadline", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const start = performance.now(),
      epoch = Date.parse("2026-12-31T22:59:54Z");
    Date.now = () => epoch + performance.now() - start;
  });
  await page.goto("/clock.html");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const { clockUnits } = await import("/src/clock.mjs");
    const animate = CubeViewer.prototype.animate;
    window.realClockEndpoints = [];
    window.realClockMoves = [];
    CubeViewer.prototype.animate = async function (p, timing) {
      const endpoint = timing?.();
      const controller = clockUnits.find(
        (u) => u.controller.view === this,
      ).controller;
      const final =
        controller.progress.completed + 1 === controller.progress.total &&
        controller.progress.target === 0;
      await animate.call(this, p, timing);
      window.realClockMoves.push({
        unit: this.host.dataset.unit,
        presentation: p,
      });
      if (endpoint && final)
        window.realClockEndpoints.push({
          unit: this.host.dataset.unit,
          endAt: endpoint.endAt,
          settled: performance.now(),
          state: p.to,
        });
    };
  });
  await expect(page.locator("#clock-digital")).toHaveText("00:00:00", {
    timeout: 12000,
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        ["H", "M", "S"].every((unit) =>
          window.realClockEndpoints.some((e) => e.unit === unit),
        ),
      ),
    )
    .toBe(true);
  const endpoints = await page.evaluate(() =>
    ["H", "M", "S"].map((unit) =>
      window.realClockEndpoints.filter((e) => e.unit === unit).at(-1),
    ),
  );
  expect(endpoints.every(Boolean)).toBe(true);
  expect(new Set(endpoints.map((e) => e.endAt)).size).toBe(1);
  for (const e of endpoints)
    expect(Math.abs(e.settled - e.endAt)).toBeLessThanOrEqual(150);
  // Inspect the exact committed endpoint, not a later instant when S may already
  // be moving toward01. The digital clock remains live throughout that motion.
  const proof = await page.evaluate(async () => {
    const { validateHsmDesign, hsmTarget } = await import(
      "/src/apps/hsm/design.ts"
    );
    const { matchesTarget } = await import(
      "/packages/cube-mechanics/src/index.ts"
    );
    const { hsmDesignFor } = await import("/src/apps/hsm/lettering.ts");
    const design = hsmDesignFor(
      validateHsmDesign(await (await fetch("/hsm-counter.v3.json")).json()),
      "words",
    );
    const endpoints = ["H", "M", "S"].map((unit) =>
      window.realClockEndpoints.filter((e) => e.unit === unit).at(-1),
    );
    return {
      print: design.print,
      endpoints,
      moves: window.realClockMoves,
      valid: endpoints.every((e) =>
        matchesTarget(design.print, e.state, hsmTarget(e.unit, 0)),
      ),
    };
  });
  expect(proof.valid).toBe(true);
  writeFileSync(
    "test-results/live-clock-real-endpoints.json",
    JSON.stringify(proof),
  );
});
test.describe("high-density shared clock viewport", () => {
  test.use({ deviceScaleFactor: 2 });
  test("one canvas fits all three cubes without overflowing into controls", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Date.now = () => Date.parse("2026-10-28T11:34:56Z");
    });
    await page.goto("/clock.html");
    await expect(page.locator("#seconds-speed")).toBeEnabled();
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const previous = await page.evaluate(async () => {
        const { clockStage } = await import("/src/clock.mjs");
        return clockStage.renderer.info.render.frame;
      });
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.evaluate(async (previous) => {
            const { clockStage } = await import("/src/clock.mjs");
            return (
              clockStage.renderer.info.render.frame > previous + 2 &&
              clockStage.renderer.domElement.width ===
                Math.floor(
                  document.getElementById("clock-scene").clientWidth *
                    clockStage.renderer.getPixelRatio(),
                )
            );
          }, previous),
        )
        .toBe(true);
      await expect(page.locator("canvas")).toHaveCount(1);
      const host = await page.locator("#clock-scene").boundingBox(),
        canvas = await page.locator("#clock-scene canvas").boundingBox(),
        controls = await page.locator(".clock-cubes").boundingBox();
      expect(Math.abs(host.width - canvas.width)).toBeLessThan(1);
      expect(Math.abs(host.height - canvas.height)).toBeLessThan(1);
      expect(canvas.y + canvas.height).toBeLessThanOrEqual(controls.y + 1);
      expect(
        await page.locator("html").evaluate((e) => e.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
      const points = await page.evaluate(async () => {
        const { clockStage } = await import("/src/clock.mjs");
        clockStage.camera.updateMatrixWorld();
        return clockStage.presentation.children
          .filter((o) => o.type === "Group")
          .flatMap((root) =>
            [-1.1, 1.1].flatMap((x) =>
              [-1.1, 1.1].flatMap((y) =>
                [-1.1, 1.1].map((z) =>
                  root.position
                    .clone()
                    .set(x, y, z)
                    .applyMatrix4(root.matrixWorld)
                    .project(clockStage.camera)
                    .toArray(),
                ),
              ),
            ),
          );
      });
      expect(
        points.every(
          (p) =>
            Math.abs(p[0]) < 0.95 &&
            Math.abs(p[1]) < 0.95 &&
            p[2] > -1 &&
            p[2] < 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/live-clock-shared-dpr2-${viewport.width}.png`,
        fullPage: true,
      });
    }
  });
});
test("slow preferences show fitted quarter and half durations without relabeling the selected speed", async ({
  page,
}) => {
  await ready(page, "2026-10-28T11:34:56Z");
  await page.selectOption("#seconds-speed", "2000");
  await expect(page.locator('label[for="seconds-speed"]')).toHaveText(
    "Preferred quarter-turn time",
  );
  await expect(page.locator("#seconds-timing")).toContainText(
    "fitted to live time",
  );
  await expect(page.locator("#seconds-speed")).toHaveValue("2000");
  const rate = await page.evaluate(async () => {
    const { clockUnits } = await import("/src/clock.mjs");
    return {
      preferred: clockUnits[2].duration,
      quarter: clockUnits[2].scheduledQuarterDuration,
    };
  });
  expect(rate.preferred).toBe(2000);
  expect(rate.quarter).toBeGreaterThanOrEqual(10);
  expect(rate.quarter).toBeLessThan(2000);
});
test("actual mixed quarter and half turns keep 2:1 durations without a final-turn dwell", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-10-28T11:34:56Z");
  });
  await page.goto("/clock.html");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { clockStage } = await import("/src/clock.mjs");
        return clockStage.renderer.info.render.frame;
      }),
    )
    .toBeGreaterThan(3);
  await page.evaluate(async () => {
    const { clockUnits, clockStage } = await import("/src/clock.mjs");
    const { LiveClockScheduler } = await import("/src/apps/clock/scheduler.ts");
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    // Freeze only automatic scheduling; RAF, physical motion and timers stay native.
    LiveClockScheduler.prototype.tick = () => ({
      values: [12, 34, 56],
      motion: ["idle", "idle", "idle"],
    });
    const unit = clockUnits[2];
    // The saved period's 56 to 57 edge is three quarter turns, so choose the
    // first nearby target whose shortest route mixes half and quarter turns.
    const target = [57, 58, 59, 0, 1, 2, 3, 4].find((value) => {
      const m = unit.controller.prepare(value);
      return m.some((m) => m.turns === 2) && m.some((m) => m.turns !== 2);
    });
    if (target === undefined) throw Error("Missing mixed turn fixture");
    const moves = unit.controller.prepare(target),
      work = moves.reduce((n, m) => n + Math.abs(m.turns), 0);
    // Software rendering on CI can miss an entire 120 ms turn. Choose a
    // feasible fixture period from native RAF cadence while preserving the
    // timing, angular-ratio and no-deliberate-dwell assertions below.
    const frames = [];
    for (let i = 0; i < 7; i++)
      frames.push(await new Promise((resolve) => requestAnimationFrame(resolve)));
    const frameGap = Math.max(...frames.slice(1).map((t, i) => t - frames[i]));
    const quarter = Math.max(120, Math.ceil(frameGap * 3));
    window.angularQuarter = quarter;
    window.angularFrameGap = frameGap;
    window.angularTrace = [];
    const active = new Map(),
      animate = CubeViewer.prototype.animate,
      render = clockStage.renderer.render.bind(clockStage.renderer);
    CubeViewer.prototype.animate = async function (p, timing) {
      const record = {
        move: p.move,
        presentation: p,
        started: performance.now(),
        timing: timing?.() ?? null,
        firstMotion: null,
        zeroFrames: 0,
        finished: null,
      };
      window.angularTrace.push(record);
      active.set(this, record);
      try {
        await animate.call(this, p, timing);
        record.finished = performance.now();
      } finally {
        active.delete(this);
      }
    };
    clockStage.renderer.render = function (scene, camera) {
      for (const [viewer, record] of active) {
        const pivot = viewer.presentation.children.find(
          // The static core ball is also a scene child; it is never the turning pivot.
          (o) => !o.userData.plasticCore && ![...viewer.cube.bodies.values()].includes(o),
        );
        if (pivot && record.firstMotion === null) {
          if (
            pivot.rotation
              .toArray()
              .slice(0, 3)
              .some((v) => Math.abs(v) > 1e-5)
          )
            record.firstMotion = performance.now();
          else record.zeroFrames++;
        }
      }
      return render(scene, camera);
    };
    unit.setDuration(quarter);
    window.angularEndAt = performance.now() + work * quarter;
    unit.controller.setDeadline(target, window.angularEndAt, quarter);
    unit.controller.request(target);
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { clockUnits } = await import("/src/clock.mjs");
        return clockUnits[2].controller.busy;
      }),
    )
    .toBe(false);
  const evidence = await page.evaluate(() => ({
    endAt: window.angularEndAt,
    quarter: window.angularQuarter,
    sampledFrameGap: window.angularFrameGap,
    turns: window.angularTrace,
  }));
  writeFileSync(
    "test-results/live-clock-angular-runtime.json",
    JSON.stringify(evidence),
  );
  expect(evidence.turns.some((t) => Math.abs(t.move.turns) === 2)).toBe(true);
  expect(evidence.turns.some((t) => Math.abs(t.move.turns) === 1)).toBe(true);
  for (const t of evidence.turns) {
    const weight = Math.abs(t.move.turns);
    expect(t.timing.durationMs).toBe(weight * evidence.quarter);
    expect(t.firstMotion).not.toBeNull();
    // Stage rendering can precede the progress RAF once, but no turn should
    // spend multiple rendered frames deliberately waiting in its start pose.
    expect(t.zeroFrames).toBeLessThanOrEqual(1);
    expect(
      Math.abs((t.finished - t.started) / weight - evidence.quarter),
    ).toBeLessThanOrEqual(45);
  }
  for (let i = 1; i < evidence.turns.length; i++)
    expect(
      evidence.turns[i].timing.endAt - evidence.turns[i].timing.durationMs,
    ).toBe(evidence.turns[i - 1].timing.endAt);
  expect(
    Math.abs(evidence.turns.at(-1).finished - evidence.endAt),
  ).toBeLessThanOrEqual(150);
  writeFileSync(
    "test-results/live-clock-angular-runtime.json",
    JSON.stringify(evidence),
  );
});
test("untimed recovery honors quarter-based clock speed while the default viewer metric stays unchanged", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-10-28T11:34:56Z");
  });
  await page.goto("/clock.html");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  const run = async (metric) =>
    page.evaluate(async (metric) => {
      const { clockUnits, clockStage } = await import("/src/clock.mjs"),
        { LiveClockScheduler } = await import("/src/apps/clock/scheduler.ts");
      LiveClockScheduler.prototype.tick = () => ({
        values: [12, 34, 56],
        motion: ["idle", "idle", "idle"],
      });
      const unit = clockUnits[2],
        viewer = unit.controller.view,
        base = 75,
        period = 180;
      viewer.setAnimationSpeed(base / period, metric);
      unit.controller.clearDeadline();
      const candidate = [57, 58, 59, 0, 1, 2, 3, 4].find((value) => {
        if (value === unit.controller.currentValue) return false;
        const m = unit.controller.prepare(value);
        return m.some((m) => m.turns === 2) && m.some((m) => m.turns !== 2);
      });
      if (candidate === undefined)
        throw Error("Missing mixed recovery fixture");
      const samples = [],
        animate = viewer.animate.bind(viewer);
      viewer.animate = async (p, timing) => {
        const at = performance.now();
        await animate(p, timing);
        samples.push({
          weight: Math.abs(p.move.turns),
          ms: performance.now() - at,
          timed: Boolean(timing),
        });
      };
      unit.controller.request(candidate);
      while (unit.controller.busy) await new Promise((r) => setTimeout(r, 10));
      viewer.animate = animate;
      return samples;
    }, metric);
  const weighted = await run("quarter-turn"),
    legacy = await run("move");
  const mean = (samples, weight) => {
    const a = samples.filter((t) => t.weight === weight);
    return a.reduce((n, t) => n + t.ms, 0) / a.length;
  };
  expect(weighted.every((t) => !t.timed)).toBe(true);
  expect(legacy.every((t) => !t.timed)).toBe(true);
  expect(mean(weighted, 2) / mean(weighted, 1)).toBeGreaterThan(1.4);
  expect(Math.abs(mean(legacy, 2) - mean(legacy, 1))).toBeLessThanOrEqual(90);
});
test("move statistics block is present, stable in layout and updates after clock ticks", async ({
  page,
}) => {
  await ready(page, "2026-10-28T11:34:56Z");
  const block = page.locator("#clock-stats");
  await expect(block).toHaveAttribute("role", "status");
  await expect(block).toHaveAttribute("aria-label", "Clock moves");
  await expect(page.locator("#total-session-moves")).toHaveText("0");
  await expect(page.locator("#total-last-moves")).toHaveText("—");
  for (const name of ["hours", "minutes", "seconds"])
    await expect(page.locator(`#${name}-mean-moves`)).toHaveText("—");
  await expect(page.locator("#total-mean-moves")).toHaveCount(0);
  await expect(page.locator(".clock-move-table thead th")).toHaveText([
    "Cube",
    "Total HTM",
    "Cube rotations",
    "Last tick",
    "Max / tick",
    "Average / tick",
  ]);
  const before = await page.locator(".clock-cubes").boundingBox();
  await page.clock.runFor(4000);
  await expect
    .poll(() => page.locator("#seconds-session-moves").textContent())
    .not.toBe("0");
  const read = (id) =>
    page.locator("#" + id).evaluate((e) => Number(e.dataset.value));
  const seconds = await read("seconds-session-moves");
  expect(await read("hours-session-moves")).toBe(0);
  expect(await read("total-session-moves")).toBe(
    seconds +
      (await read("minutes-session-moves")) +
      (await read("hours-session-moves")),
  );
  expect(await read("seconds-session-rotations")).toBe(0);
  await expect
    .poll(() => page.locator("#seconds-last-moves").textContent())
    .not.toBe("—");
  expect(await read("seconds-max-moves")).toBeGreaterThanOrEqual(
    await read("seconds-last-moves"),
  );
  expect(await page.locator(".clock-cubes").boundingBox()).toEqual(before);
  // The average appears with the first completed change and stays in range.
  await expect
    .poll(() => page.locator("#seconds-mean-moves").textContent())
    .toMatch(/^\d+\.\d\d$/);
  const average = await read("seconds-mean-moves");
  expect(average).toBeGreaterThanOrEqual(0);
  expect(average).toBeLessThanOrEqual(await read("seconds-max-moves"));
  await page.locator("#reset-clock-moves").click();
  await expect(page.locator("#total-session-moves")).toHaveText("0");
  await expect(page.locator("#seconds-last-moves")).toHaveText("—");
  await expect(page.locator("#seconds-mean-moves")).toHaveText("—");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const table = await page.locator(".clock-move-table").boundingBox();
  expect(table.x).toBeGreaterThanOrEqual(0);
  expect(table.x + table.width).toBeLessThanOrEqual(390);
});
