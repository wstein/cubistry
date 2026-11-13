// SPDX-License-Identifier: AGPL-3.0-or-later
// Play mode, pure part 2: free angle tracking with magnet at every 90 degrees, release rounding.

export const MAGNET_DEG = 8;

/** Angle in degrees of a layer that follows the finger by progressPx; right-hand sense is positive. */
export function angleFromProgress(progressPx: number, pxPerQuarter: number): number {
  if (!Number.isFinite(pxPerQuarter) || pxPerQuarter <= 0) throw RangeError("pxPerQuarter must be a positive finite number");
  return (progressPx / pxPerQuarter) * 90;
}

/** Round half away from zero, never returning negative zero. */
function roundHalfAway(x: number): number {
  const r = Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
  return r === 0 ? 0 : r;
}

/** Net rotation in quarter turns after release: nearest multiple of 90 degrees, ties away from zero. */
export function netQuarters(rawDeg: number): number {
  return roundHalfAway(rawDeg / 90);
}

/** Displayed angle: exactly on a multiple of 90 within magnetDeg of it (inclusive), else the raw angle. */
export function displayAngle(rawDeg: number, magnetDeg = MAGNET_DEG): number {
  const m = netQuarters(rawDeg) * 90;
  return Math.abs(rawDeg - m) <= magnetDeg ? m : rawDeg;
}

/** Physical move for a net turn: 0 none (also a full turn), 1 quarter, 2 half, -1 reverse quarter. */
export function reduceQuarters(q: number): number {
  if (!Number.isInteger(q)) throw RangeError("quarters must be an integer");
  const m = ((q % 4) + 4) % 4;
  return m === 3 ? -1 : m;
}
