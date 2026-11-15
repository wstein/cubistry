// SPDX-License-Identifier: AGPL-3.0-or-later
// Restore the top-face washout and brightness-step guards from calendar7-names-faces.spec.mjs.
import { test, expect } from "@playwright/test";
import { measureFaces, openApp } from "./calendar7-face-probe.mjs";

const VIEWS = [[0.45, -0.5], [0.22, -0.3], [0.3, -0.5], [0.95, -0.5]];
for (const scheme of ["rubik-tint", "solarized-light"]) for (const [pitch, rotY] of VIEWS) test(`${scheme} pitch ${pitch} yaw ${rotY} (Feb 2027, production effects): colored top tiles do not render white`, async ({ page }) => {
  test.setTimeout(180000);
  await openApp(page, { scheme, year: 2027, month: 2 });
  const { faces } = await measureFaces(page, { pitch, rotY });
  const id = `${scheme} pitch ${pitch}`, { up, front } = faces;
  expect(up, `${id}: the top face is visible`).toBeTruthy();
  expect(up.coloredTiles, `${id}: colored top tiles`).toBeGreaterThanOrEqual(30);
  expect(up.washedShare, `${id}: washed share of the top tiles ${JSON.stringify(up.washedTiles)}`).toBeLessThanOrEqual(0.25);
  if (scheme === "rubik-tint") {
    expect(up.clipped, `${id}: clipped fill pixels of the top face`).toBeLessThanOrEqual(0.3);
    if (front) expect(up.clipped - front.clipped, `${id}: top minus front clipped share`).toBeLessThanOrEqual(0.15);
  }
  if (pitch <= 0.45 && front) {
    expect(front.washedShare, `${id}: front washed`).toBe(0);
    expect(front.p90, `${id}: front token deviation p90 (max channel)`).toBeLessThanOrEqual(9);
    expect(up.medianDelta, `${id}: median token deviation of the top face (a brighter face, not white)`).toBeLessThanOrEqual(35);
  }
});

for (const [name, bound, views] of [
  ["yaw", 6, Array.from({ length: 27 }, (_, i) => [0.3, -0.1 - 0.05 * i])],
  ["pitch", 20, Array.from({ length: 24 }, (_, i) => [0.05 + 0.05 * i, -0.5])],
]) test(`rubik-tint (production effects): face brightness has no step during ${name}`, async ({ page }) => {
  test.setTimeout(240000);
  await openApp(page, { scheme: "rubik-tint", year: 2027, month: 2 });
  const prev = {};
  let largest = { step: 0, face: "", pitch: 0, rotY: 0 };
  for (const [pitch, rotY] of views) {
    const { faces } = await measureFaces(page, { pitch, rotY, quick: true });
    for (const f of ["up", "front", "right", "left"]) {
      const lum = faces[f] ? faces[f].lum : null;
      if (lum !== null && prev[f] != null) {
        const step = Math.abs(lum - prev[f]);
        if (step > largest.step) largest = { step, face: f, pitch, rotY };
      }
      prev[f] = lum;
    }
  }
  expect(largest.step, `${name} sweep, ${largest.face} face at pitch ${largest.pitch} yaw ${largest.rotY}: step of the mean fill brightness`).toBeLessThanOrEqual(bound);
});
