// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, light per face (names-face-light.ts): the face that looks at the camera is lit as the studio lights it, the
// faces that look away keep 8 % of the directional lights, so the top face is not washed out. The exposure follows the face that
// looks at the camera (names-exposure.ts); the studio lights a cube from above, so with the front face at its token the top face
// got 2 to 4.5 times its irradiance and the pastels of the top face clipped to white (Rubik-Tint, Feb 2027, pitch 0.45: 100 % of
// the colored tiles and 95 % of the fill pixels white on the top face, 0 % and 18 % on the front). The real app page (production
// effects, shadow map on) is turned to several views and measured per face (calendar7-face-probe.mjs). The front-face fidelity to
// the tokens (tolerance 7 of 255) is calendar7-names-color.spec.mjs.
import { test, expect } from "@playwright/test";
import { cameraFaceDiff, measureFaces, openApp } from "./calendar7-face-probe.mjs";

// [pitch, rotation about y]: the start view of the app (0.22, -0.3), and the views of the washout report.
const VIEWS = [[0.22, -0.3], [0.3, -0.5], [0.45, -0.5], [0.95, -0.5]];

for (const scheme of ["rubik-tint", "solarized-light"]) test(`${scheme} (Feb 2027, production effects): the colored tiles of the top face do not render white at pitch 0.22, 0.3, 0.45 and 0.95, the face that looks at the camera is lit as before`, async ({ page }) => {
  test.setTimeout(180000);
  await openApp(page, { scheme, year: 2027, month: 2 });
  for (const [pitch, rotY] of [[0, 0], ...VIEWS]) {
    const { faces, toneMapping } = await measureFaces(page, { pitch, rotY });
    expect(toneMapping, `${scheme}: the names layout renders with the soft shoulder (THREE.CustomToneMapping, names-tone.ts)`).toBe(5);
    const id = `${scheme} pitch ${pitch}`, { up, front } = faces;
    // The face that looks at the camera, against the studio's light on every face (share 1: what the layout rendered before the face
    // light), central 70% of its tiles: W = 1 there, so the pixels are the same (a few pixels of a shadow edge differ by up to 7).
    const diff = await cameraFaceDiff(page, { pitch, rotY });
    expect(diff.meanAbs, `${id}: ${diff.face} face against the studio's light ${JSON.stringify(diff)}`).toBeLessThanOrEqual(0.2);
    expect(diff.shareOver7, `${id}: share of pixels of the ${diff.face} face that differ by more than 7`).toBeLessThanOrEqual(0.005);
    if (pitch === 0) continue; // head on: the top face is edge on
    expect(up, `${id}: the top face is visible`).toBeTruthy();
    expect(up.coloredTiles, `${id}: colored top tiles`).toBeGreaterThanOrEqual(30);
    // Washed tile: its token has a channel at 235 or below (not the paper white or the pink weekend tint of Paper Red) and it renders (255, 255, 255). Before: 98 to 100 % (Rubik-Tint, Solarized Light at 0.45).
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

// The mean fill brightness of each face while the cube turns in steps of 0.05 rad: the weight of the face light is smooth, so no face
// jumps. Measured: yaw 4.0 (0 to 255), pitch 17.1 (the exposure itself follows the face that looks at the camera quickly: with the
// studio's light on every face the same sweep gives 28.7 at pitch); a hard switch front / not front gives a multiple of the bounds.
test("rubik-tint (production effects): the face brightness has no step while the cube turns about y and about x", async ({ page }) => {
  test.setTimeout(240000);
  await openApp(page, { scheme: "rubik-tint", year: 2027, month: 2 });
  const sweeps = {
    yaw: [6, Array.from({ length: 27 }, (_, i) => [0.3, -0.1 - 0.05 * i])],
    pitch: [20, Array.from({ length: 24 }, (_, i) => [0.05 + 0.05 * i, -0.5])],
  };
  for (const [name, [bound, views]] of Object.entries(sweeps)) {
    const prev = {};
    for (const [pitch, rotY] of views) {
      const { faces } = await measureFaces(page, { pitch, rotY, quick: true });
      for (const f of ["up", "front", "right", "left"]) {
        const lum = faces[f] ? faces[f].lum : null;
        if (lum !== null && prev[f] != null) expect(Math.abs(lum - prev[f]), `${name} sweep, ${f} face at pitch ${pitch} yaw ${rotY}: step of the mean fill brightness`).toBeLessThanOrEqual(bound);
        prev[f] = lum;
      }
    }
  }
});

// The shader of the soft shoulder (names-tone.ts) is rendered: a flat color of linear value x through the CustomToneMapping chunk
// must come out as the curve says. (An identity chunk renders 1.0 as 255; the curve renders it as 253.)
test("the soft shoulder shader rolls off above 0.95 as the reference curve says", async ({ page }) => {
  test.setTimeout(90000);
  await openApp(page, { scheme: "rubik-tint", year: 2027, month: 2 });
  const rows = await page.evaluate(async () => {
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /\/deps\/three\.js/.test(n)); // the app's own copy of three.js (the chunk is patched there)
    window.__c7viewer.destroy(); // one WebGL context at a time: the software renderer crashes with two big scenes
    const THREE = await import(url), { shoulder } = await import("/src/apps/calendar7/names-tone.ts");
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(4, 4, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.CustomToneMapping; renderer.toneMappingExposure = 1;
    const out = [];
    for (const x of [0.5, 0.9, 0.97, 1, 1.5]) {
      const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(x, x, x, THREE.LinearSRGBColorSpace) })));
      renderer.render(scene, cam);
      const c = document.createElement("canvas"); c.width = c.height = 4; const g = c.getContext("2d"); g.drawImage(renderer.domElement, 0, 0);
      const srgb = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
      out.push({ x, got: g.getImageData(2, 2, 1, 1).data[0], want: srgb(shoulder(x)) });
    }
    renderer.dispose();
    return out;
  });
  for (const r of rows) expect(Math.abs(r.got - r.want), `linear ${r.x}: rendered ${r.got}, curve ${r.want.toFixed(1)}`).toBeLessThanOrEqual(1);
});
