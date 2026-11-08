// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The soft-start critically damped response of the Smart Rubber Band return (docs/SMART_ROTATION.md,
 * packages/cube-viewer/src/smart-rotation.ts), as pure functions: the offset left to turn decays as
 * x(t) = x0 e^(-rt) (1 + rt + (rt)^2 / 2) with r = 9 / s. Speed and acceleration are zero at the start, there is no overshoot
 * and no fixed duration; the motion ends when less than `SOFT_START_EPSILON` radians remain. The cube viewer exports no
 * pure function for it (the formula lives inside the camera controller, which stays untouched), so it is repeated here;
 * a test compares the rate with `ROTATION_TUNING.returnRate`. DOM-free.
 */
export const SOFT_START_RATE = 9;
export const SOFT_START_EPSILON = 1e-3;
/** Fraction of the offset still left after `u = r t`. */
export const softStartRemaining = (u: number): number => Math.exp(-u) * (1 + u + (u * u) / 2);

/** Seconds until the response to a turn of `angle` radians (> 0) has less than the end offset left. */
export function softStartSeconds(angle: number): number {
  const goal = SOFT_START_EPSILON / Math.abs(angle);
  if (!(goal < 1)) return 0;
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (softStartRemaining(SOFT_START_RATE * mid) > goal) lo = mid;
    else hi = mid;
  }
  return hi;
}
/** Duration in milliseconds of a turn by `quarters` quarter turns (1, 2 or 3 in size) at 1x. */
export const softStartMs = (quarters: number): number => 1000 * softStartSeconds((Math.abs(quarters) * Math.PI) / 2);

/**
 * Easing for a turn of `quarters` quarter turns that lasts exactly `softStartMs(quarters)` (scaled by the speed outside):
 * progress p in 0..1 of the time gives the fraction turned, 1 - remaining; at p = 1 the rest is snapped (below 1 mrad).
 */
export function softStartEase(quarters: number): (p: number) => number {
  const U = SOFT_START_RATE * softStartSeconds((Math.abs(quarters) * Math.PI) / 2);
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - softStartRemaining(U * p));
}
