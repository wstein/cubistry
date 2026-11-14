// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, light per face: the top face is lit as the cube is turned to the viewer, and its tiles must not
// wash out. The exposure follows the face that looks at the camera (names-exposure.ts); the studio lights a cube from above,
// so with the front face at its token the top face got 2 to 4.5 times the irradiance and the pastels of the top face clipped to
// white (Rubik-Tint, Feb 2027, pitch 0.45: 93 % of the colored tiles and 95 % of the fill pixels white on the top face, 0 % and
// 20 % on the front). The real app page (production effects, shadow map on) is turned to four views and measured per face
// (calendar7-face-probe.mjs). The front-face fidelity to the tokens (tolerance 7 of 255) is calendar7-names-color.spec.mjs.
import { test, expect } from "@playwright/test";
import { measureFaces, openApp } from "./calendar7-face-probe.mjs";

// [pitch, rotation about y]: the start view of the app (0.22, -0.3), and the views of the washout report.
const VIEWS = [[0.22, -0.3], [0.3, -0.5], [0.45, -0.5], [0.95, -0.5]];

for (const scheme of ["rubik-tint", "solarized-light"]) test(`${scheme} (Feb 2027, production effects): the colored tiles of the top face do not render white at pitch 0.22, 0.3, 0.45 and 0.95`, async ({ page }) => {
  test.setTimeout(150000);
  await openApp(page, { scheme, year: 2027, month: 2 });
  for (const [pitch, rotY] of VIEWS) {
    const { faces } = await measureFaces(page, { pitch, rotY });
    const id = `${scheme} pitch ${pitch}`, { up, front } = faces;
    expect(up, `${id}: the top face is visible`).toBeTruthy();
    expect(up.coloredTiles, `${id}: colored top tiles`).toBeGreaterThanOrEqual(30);
    // Washed tile: its token has a channel at 245 or below (not the paper white; the pink weekend tint counts) and it renders (255, 255, 255). Before: 93 to 98 % (Rubik-Tint), 79 % (Solarized Light at 0.45).
    expect(up.washedShare, `${id}: washed share of the top tiles ${JSON.stringify(up.washedTiles)}`).toBeLessThanOrEqual(0.25);
    if (scheme === "rubik-tint") {
      // All fill pixels of the face: Rubik-Tint is pastel throughout (a scheme with white tiles, as Paper Red, clips them by design: not measured). Before: 95 %.
      expect(up.clipped, `${id}: clipped fill pixels of the top face`).toBeLessThanOrEqual(0.3);
      if (front) expect(up.clipped - front.clipped, `${id}: top minus front clipped share`).toBeLessThanOrEqual(0.15);
    }
    if (pitch <= 0.45 && front) { // the front face is the one the exposure follows: its tiles stay on their tokens
      expect(front.washedShare, `${id}: front washed`).toBe(0);
      expect(front.p90, `${id}: front token deviation p90 (max channel)`).toBeLessThanOrEqual(9);
      expect(up.medianDelta, `${id}: median token deviation of the top face (a brighter face, not white)`).toBeLessThanOrEqual(35);
    }
  }
});
