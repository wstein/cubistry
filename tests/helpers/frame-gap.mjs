// requestAnimationFrame probe for specs that measure real time in software-rendered Chromium, where one frame can
// take 100 to 300 ms. It only records frame gaps (maximum and median); each spec decides what, if anything, to
// derive from them; the endpoint specs only record them as evidence.
/** Starts the probe in the page (idempotent); restart the statistics with `resetFrameGap`. */
export function startFrameGapProbe(page) {
  return page.evaluate(() => {
    if (window.frameGapProbe) return;
    const probe = (window.frameGapProbe = { gaps: [], last: undefined });
    const tick = (now) => {
      if (probe.last !== undefined) probe.gaps.push(now - probe.last);
      probe.last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
export const resetFrameGap = (page) => page.evaluate(() => { if (window.frameGapProbe) window.frameGapProbe.gaps = []; });
/** `{ max, median, count }` of the frame gaps in milliseconds since the last reset. */
export function readFrameGap(page) {
  return page.evaluate(() => {
    const gaps = [...(window.frameGapProbe?.gaps ?? [])].sort((a, b) => a - b);
    return { max: gaps.at(-1) ?? 0, median: gaps[Math.floor(gaps.length / 2)] ?? 0, count: gaps.length };
  });
}
/** Deadline bound of the endpoint specs. Deliberately not widened with the frame gap: measured in software GL at up to
 * 300 ms per frame, the 250 ms and 2000 ms cases settle within 0.6 to 3.7 ms of the deadline. */
export const ENDPOINT_TOLERANCE_MS = 20;
/** Preference at which the final turn is known to settle late (96 to 177 ms after the deadline in software GL, whatever
 * the frame time). The cause is not verified; see the known-issue tests. */
export const LATE_FINAL_TURN_PREFERENCE_MS = 10;
