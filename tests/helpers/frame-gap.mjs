// Software-rendered Chromium can need over 100 ms per frame, so a deadline can only be met to within about one
// frame. The 20 ms bound of the endpoint specs holds on real hardware; here it widens with the measured frame gap.
export const ENDPOINT_TOLERANCE_MS = 20;
export const FRAME_GAP_FACTOR = 3; // measured: 1-2 ms at 250/2000 ms, about 2.2 frames at 10 ms
/** Starts a requestAnimationFrame probe in the page; read it with `readFrameGap` and restart with `resetFrameGap`. */
export function startFrameGapProbe(page) {
  return page.evaluate(() => {
    if (window.frameGapProbe) return;
    const probe = (window.frameGapProbe = { max: 0, last: undefined });
    const tick = (now) => {
      if (probe.last !== undefined) probe.max = Math.max(probe.max, now - probe.last);
      probe.last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
export const resetFrameGap = (page) => page.evaluate(() => { if (window.frameGapProbe) window.frameGapProbe.max = 0; });
export const readFrameGap = (page) => page.evaluate(() => window.frameGapProbe?.max ?? 0);
/** Allowed |settled - deadline| in milliseconds for a measured largest frame gap. */
export const endpointToleranceMs = (frameGapMs) => Math.max(ENDPOINT_TOLERANCE_MS, FRAME_GAP_FACTOR * frameGapMs);
