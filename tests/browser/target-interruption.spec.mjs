import { test, expect } from "@playwright/test";
async function installGate(page) {
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const original = CubeViewer.prototype.animate;
    window.interruptStarts = [];
    window.interruptCommits = [];
    let first = true;
    CubeViewer.prototype.animate = async function (p, timing) {
      const record = {
        p,
        target: document.querySelector("#move-progress").dataset.target,
      };
      window.interruptStarts.push(record);
      if (first) {
        first = false;
        await new Promise((resolve) => {
          window.releaseInterruptedMove = resolve;
        });
      }
      await original.call(this, p, timing);
      window.interruptCommits.push(record);
    };
  });
}
async function verifyBoundary(page, value) {
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", value);
  const result = await page.evaluate(async () => {
    const { applyMove } = await import("/packages/cube-mechanics/src/index.ts");
    const { stateEquals } = await import("/packages/cube-core/src/index.ts");
    const a = window.interruptCommits;
    const legal = a.every(
      (r, i) =>
        stateEquals(applyMove(r.p.from, r.p.move), r.p.to) &&
        (!i || stateEquals(a[i - 1].p.to, r.p.from)),
    );
    return {
      legal,
      targets: window.interruptStarts.map((r) => r.target),
      committed: a.length,
      progress: {
        done: Number(
          document
            .querySelector("#move-progress")
            .getAttribute("aria-valuenow"),
        ),
        total: Number(
          document
            .querySelector("#move-progress")
            .getAttribute("aria-valuemax"),
        ),
      },
      // Every final physical front is also checked by the controller; these
      // targets ensure the interrupted old value was never completed first.
      firstFrom: a[0].p.from,
      final: a.at(-1).p.to,
    };
  });
  expect(result.legal).toBe(true);
  expect(result.targets.filter((t) => t === result.targets[0])).toHaveLength(1);
  expect(result.targets.slice(1).every((t) => t === result.targets[1])).toBe(
    true,
  );
  expect(result.progress.done).toBe(result.progress.total);
  expect(result.committed).toBe(result.progress.total + 1);
}
for (const style of ["symbols", "words"])
  test(`HSM ${style} target changes discard the old route after one legal turn`, async ({
    page,
  }) => {
    await page.goto(`/?application=hsm-counter&lettering=${style}`);
    await expect(page.locator("#hsm-value")).toBeEnabled();
    await expect(page.locator("#application")).toBeEnabled();
    await installGate(page);
    await page.fill("#hsm-value", "33");
    await page.locator("#hsm-value").press("Enter");
    await expect(page.locator("#move-progress")).toHaveAttribute(
      "data-target",
      "33",
    );
    await page.fill("#hsm-value", "17");
    await page.locator("#hsm-value").press("Enter");
    await expect(page.locator("#move-progress")).toHaveAttribute(
      "data-queued",
      "17",
    );
    await page.evaluate(() => window.releaseInterruptedMove());
    await verifyBoundary(page, "17");
    await expect(page.locator("#error")).toHaveText("");
  });
for (const application of ["timer", "five-second-timer"])
  test(`${application} retargeting restores the last complete display directly from the interrupted pose`, async ({
    page,
  }) => {
    await page.goto(`/?application=${application}`);
    await expect(page.locator("#application")).toBeEnabled();
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-application",
      application,
    );
    const initial = await page.locator("#cube").getAttribute("data-value");
    await installGate(page);
    await page.fill("#timer-duration", "01:00");
    await page.locator("#timer-duration").press("Enter");
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
    // Set a third target while the current real turn remains unresolved.
    await page.fill("#timer-duration", initial);
    await page.locator("#timer-duration").press("Enter");
    await page.evaluate(() => window.releaseInterruptedMove());
    await verifyBoundary(page, initial);
    const result = await page.evaluate(async () => {
      const { stateEquals } = await import("/packages/cube-core/src/index.ts");
      return {
        equal: stateEquals(
          window.interruptCommits[0].p.from,
          window.interruptCommits.at(-1).p.to,
        ),
        moves: window.interruptCommits.length,
      };
    });
    expect(result).toEqual({ equal: true, moves: 2 });
  });
for (const style of ["symbols", "words"])
  test(`one-view live clock ${style} replaces a suspended second target at the next committed move`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.liveEpoch = Date.parse("2026-10-28T11:34:56.100Z");
      Date.now = () => window.liveEpoch;
    });
    await page.goto(`/clock.html?lettering=${style}`);
    await expect(page.locator("#seconds-speed")).toBeEnabled();
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/clock.mjs");
      const c = clockUnits[2].controller,
        original = c.view.animate.bind(c.view);
      window.liveStarts = [];
      window.liveCommits = [];
      let first = true;
      c.view.animate = async (p, timing) => {
        const r = { p, target: c.progress.target };
        window.liveStarts.push(r);
        if (first) {
          first = false;
          await new Promise((resolve) => {
            window.releaseLiveTurn = resolve;
          });
        }
        await original(p, timing);
        window.liveCommits.push(r);
      };
      // The saved period's 56 to 57 edge is three quarter units (150 ms at the
      // preferred 50 ms), so it launches in the last 150 ms before the boundary.
      window.liveEpoch = Date.parse("2026-10-28T11:34:56.900Z");
    });
    await expect
      .poll(() => page.evaluate(() => typeof window.releaseLiveTurn))
      .toBe("function");
    await page.evaluate(() => {
      window.liveEpoch = Date.parse("2026-10-28T11:35:31.100Z");
    });
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { clockUnits } = await import("/src/clock.mjs");
          return clockUnits[2].controller.progress.queuedTarget;
        }),
      )
      .toBe(31);
    await page.evaluate(() => window.releaseLiveTurn());
    await expect(page.locator("#clock-seconds")).toHaveAttribute(
      "data-value",
      "31",
    );
    await expect(page.locator("#clock-seconds")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const result = await page.evaluate(async () => {
      const { clockUnits } = await import("/src/clock.mjs");
      const { stateEquals } = await import("/packages/cube-core/src/index.ts");
      const { matchesTarget } = await import(
        "/packages/cube-mechanics/src/index.ts"
      );
      const { hsmTarget } = await import("/src/apps/hsm/design.ts");
      const c = clockUnits[2].controller,
        moves = window.liveCommits;
      return {
        targets: window.liveStarts.map((r) => r.target),
        valid: matchesTarget(c.design.print, c.state, hsmTarget("S", 31)),
        continuous: moves.every(
          (r, i) => !i || stateEquals(moves[i - 1].p.to, r.p.from),
        ),
        session: c.progress.sessionTotal,
        count: moves.length,
      };
    });
    expect(result.targets[0]).toBe(57);
    expect(result.targets.slice(1).every((t) => t === 31)).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.continuous).toBe(true);
    expect(result.session).toBe(result.count);
    await expect(page.locator("#clock-scene canvas")).toHaveCount(1);
  });
