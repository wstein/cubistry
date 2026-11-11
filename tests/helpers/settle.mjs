// State gates for browser specs: wait for an application state, never for a duration.
//
// A bare `expect(...).toHaveAttribute()` with the default 5 s timeout fails with "expected false, got
// true" and says nothing about whether the app was slow, stuck, or waiting for a clock that nobody
// advanced. `until` polls an explicit probe against an explicit real-time budget and, on failure,
// reports what was awaited, the real time spent, how far the page clock moved meanwhile and the last
// observed value.
//
// The gate never advances the page clock. Use it for states produced by work the fake clock does not
// drive, for example a Web Worker search. Advancing a fake clock there would fire app deadline timers
// (the calendar planner has an 8 s one) before the real work is done and silently change the route.
// For states driven by fake-clock timers, advance the clock in the test itself (page.clock.runFor).
//
// Notes:
//  - The budget bounds real time only. A probe that itself blocks (page.evaluate on a hung page) is
//    bounded by the test timeout, not by `timeout`.
//  - A probe that throws (missing element, navigation in flight) is retried until the budget ends and
//    then reported as the last observation, so the helper's message wins. A closed page or browser
//    cannot recover, so that error is rethrown at once.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fakeNow = (page) => page.evaluate(() => Date.now()).catch(() => NaN);
const closed = (error) => /has been closed|browser has been closed/i.test(String(error));

/**
 * @param page Playwright page
 * @param what human-readable description of the awaited state, used in the failure message
 * @param probe async () => value observed from the page
 * @param options.accept value => boolean, default `value === true`
 * @param options.timeout real-time budget in ms; no default on purpose, state why it is enough
 * @returns the accepted value
 */
export async function until(
  page,
  what,
  probe,
  { accept = (value) => value === true, timeout, pollMs = 100 } = {},
) {
  if (!Number.isFinite(timeout) || timeout <= 0)
    throw Error(`until("${what}"): an explicit positive timeout is required`);
  const realStart = Date.now();
  const fakeStart = await fakeNow(page);
  let last;
  for (;;) {
    try {
      last = await probe();
      if (accept(last)) return last;
    } catch (error) {
      if (closed(error)) throw error;
      last = { probeError: String(error.message ?? error).split("\n")[0] };
    }
    if (Date.now() - realStart >= timeout) break;
    await sleep(pollMs);
  }
  const fakeSpent = (await fakeNow(page)) - fakeStart;
  throw Error(
    `State not reached: ${what}\n` +
      `  real time spent: ${Date.now() - realStart} ms of ${timeout} ms\n` +
      `  fake clock moved meanwhile: ${Number.isNaN(fakeSpent) ? "unknown" : fakeSpent + " ms"}\n` +
      `  last observed: ${JSON.stringify(last)}`,
  );
}

/** Wait until an element's aria-busy attribute equals `busy`. A missing element is reported, not awaited. */
export const ariaBusy = (page, selector, busy, options) =>
  until(
    page,
    `${selector} aria-busy="${busy}"`,
    () => page.locator(selector).getAttribute("aria-busy", { timeout: 1000 }),
    { accept: (value) => value === String(busy), ...options },
  );

/**
 * Wait until the Counter page has finished booting. The page starts with `#cube aria-busy="true"`, but the
 * controller publishes its first idle state (`aria-busy="false"`) from `configure()`, before `main.mjs` has
 * installed the final assets and set `ready`; only then do `#set` and the other controls leave `disabled`. So
 * `aria-busy="false"` alone is not "booted": it is the state the page passes through. Software-rendered CI
 * runners are slow to boot, so the gate must name the state instead of assuming it. The budget only bounds how long a
 * run that never boots waits before the diagnosis; a booting page returns at once. It is 15 s in the fast group, which
 * stays inside its 30 s test limit, and 20 s in the timing group (90 s test limit). A 5 s budget failed on loaded CI
 * runners whose boot took longer (move-progress.spec.mjs, run 43075040868).
 */
export const booted = (page, { timeout = process.env.CUBISTRY_E2E_GROUP === "timing" ? 20000 : 15000 } = {}) =>
  until(
    page,
    'the Counter page has booted (#set enabled, #cube aria-busy="false")',
    () =>
      page.evaluate(() => {
        const set = document.querySelector("#set");
        return !!set && !set.disabled && document.querySelector("#cube")?.getAttribute("aria-busy") === "false";
      }),
    { timeout },
  );
