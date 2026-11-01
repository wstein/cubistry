// State gates for browser specs: wait for an application state, never for a duration.
//
// A bare `expect(...).toHaveAttribute()` with the default 5 s timeout fails with "expected false, got
// true" and says nothing about whether the app was slow, stuck, or waiting for a clock that nobody
// advanced. `until` polls an explicit probe against an explicit real-time budget and, on failure,
// reports what was awaited, the real and fake time spent and the last observed value.
//
// Choosing between the two ways of making progress:
//  - No `clockStepMs` (default): the page clock is left alone and only real time passes. Use this when
//    the awaited state comes from real work the fake clock does not drive, for example a Web Worker
//    search. Advancing a fake clock there would fire app deadline timers (the calendar planner has an
//    8 s one) long before the real work is done and silently change which route the app takes.
//  - `clockStepMs`: the gate advances the fake clock in small steps between probes. Use this when the
//    state is produced by fake-clock timers (setTimeout, requestAnimationFrame), so the test cannot
//    stall on a clock that never moves. The total fake time spent is bounded by `timeout` as well.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fakeNow = (page) => page.evaluate(() => Date.now()).catch(() => NaN);

/**
 * @param page Playwright page
 * @param what human-readable description of the awaited state, used in the failure message
 * @param probe async () => value observed from the page
 * @param options.accept value => boolean, default `value === true`
 * @param options.timeout real-time budget in ms; has no default on purpose, state why it is enough
 * @param options.clockStepMs advance the fake clock by this much between probes (see above)
 * @returns the accepted value
 */
export async function until(
  page,
  what,
  probe,
  { accept = (value) => value === true, timeout, clockStepMs = 0, pollMs = 100 } = {},
) {
  if (!Number.isFinite(timeout) || timeout <= 0)
    throw Error(`until("${what}"): an explicit positive timeout is required`);
  const realStart = Date.now();
  const fakeStart = await fakeNow(page);
  let last;
  for (;;) {
    last = await probe();
    if (accept(last)) return last;
    if (Date.now() - realStart >= timeout) break;
    if (clockStepMs > 0) await page.clock.runFor(clockStepMs);
    else await sleep(pollMs);
  }
  const fakeSpent = (await fakeNow(page)) - fakeStart;
  throw Error(
    `State not reached: ${what}\n` +
      `  real time spent: ${Date.now() - realStart} ms of ${timeout} ms\n` +
      `  fake clock advanced: ${Number.isNaN(fakeSpent) ? "unknown" : fakeSpent + " ms"}` +
      `${clockStepMs > 0 ? ` (steps of ${clockStepMs} ms)` : " (not advanced by this gate)"}\n` +
      `  last observed: ${JSON.stringify(last)}`,
  );
}

/** Wait until an element's aria-busy attribute equals `busy` ("true" or "false"). */
export const ariaBusy = (page, selector, busy, options) =>
  until(
    page,
    `${selector} aria-busy="${busy}"`,
    () => page.locator(selector).getAttribute("aria-busy"),
    { accept: (value) => value === String(busy), ...options },
  );
