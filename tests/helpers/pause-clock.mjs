// Pause the page's fake clock `leadMs` after the page's current fake time.
//
// Reading Date.now() in the page and calling clock.pauseAt() are two separate
// round trips. While the clock still runs in real time, a stall between them
// (CPU load) can carry the clock past the computed target, and Playwright then
// rejects pauseAt() with "Cannot fast-forward to the past". That rejection
// happens after the clock has already been paused and before any fake time is
// consumed, so reading the time again and retrying keeps the intended result:
// the clock pauses `leadMs` after the time it was paused at.
export async function pauseSoon(page, leadMs = 100) {
  for (let attempt = 1; ; attempt++) {
    const target = await page.evaluate((ms) => Date.now() + ms, leadMs);
    try {
      await page.clock.pauseAt(target);
      return target;
    } catch (error) {
      if (attempt >= 5 || !String(error).includes("Cannot fast-forward to the past")) throw error;
    }
  }
}
