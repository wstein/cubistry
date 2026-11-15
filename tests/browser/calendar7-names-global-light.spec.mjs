// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, global light (names-light.ts; owner decision 2026-11-15): the cube is lit by one global rig, with no light,
// material or weight per face. Two requirements are measured on the real app page (production effects, shadow map on, 1500 x 1500
// at device scale factor 2, November 2026), per scheme and in all:
// - front plasticity: the cubies read as cubes, the seams and bevels show. Bevel depth (calendar7-look-probe.mjs) is about 21 luma
//   levels; the per-face weight look it replaces had 3.7, a flat render 0.5;
// - colored top and side faces: side chroma, the share of near-white highlight pixels and the hue of the pastel tiles stay close to
//   their tokens.
// The front-face fidelity to the tokens is calendar7-names-color.spec.mjs.
import { test, expect } from "@playwright/test";
import { LOOK_VIEWS, lookMetrics, measureLook, sweepSteps } from "./calendar7-look-probe.mjs";
import { openApp } from "./calendar7-face-probe.mjs";

test.use({ viewport: { width: 1500, height: 1500 }, deviceScaleFactor: 2 }); // the size the thresholds were measured at (a smaller canvas samples the bevels and tiles with fewer pixels)
const SCHEMES = ["paper-red", "rubik-tint", "dracula", "paper-blue"];
const results = {}; // scheme -> lookMetrics, filled by the per-scheme tests, read by the overall test (serial)
test.describe.configure({ mode: "serial" });
const VIEW_NAMES = ["front", "shot", "iso", "p22", "p45", "below", "r1", "r2"];
const VIEWS = { ...LOOK_VIEWS, p22: [0.22, -0.3], below: [-0.3, -0.3], r1: [0.3, -0.9], r2: [-0.45, -0.6] }; // front, the owner's screenshot (pitch 0.4, yaw -0.45), iso, and five more
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

for (const scheme of SCHEMES) test(`${scheme} (Nov 2026, production effects): the seams and bevels show on the front, the top and side faces keep their colors, 8 views`, async ({ page }) => {
  test.setTimeout(240000);
  await openApp(page, { scheme, year: 2026, month: 11 });
  const looks = {}, flats = {};
  for (const name of VIEW_NAMES) {
    const [pitch, rotY] = VIEWS[name];
    looks[name] = await measureLook(page, { pitch, rotY });
    flats[name] = await measureLook(page, { pitch, rotY, flat: true, bevels: false });
  }
  const m = results[scheme] = lookMetrics(looks, flats);
  console.log(`LOOK ${scheme} ${JSON.stringify(m)}`);
  // Front plasticity. The per-face weight look had 3.7 luma levels of bevel depth, a flat render 0.5. Dracula's dark tokens leave a smaller luma range.
  expect(m.bevelDepth, `${scheme}: bevel depth (luma levels)`).toBeGreaterThanOrEqual(scheme === "dracula" ? 6 : 15);
  // No seam artifact: an edge profile stays within 6 luma levels of the range of its two faces (at most 2 of the 35 edges, worst 12).
  expect(m.bevelViolations, `${scheme}: bevel violations of ${m.edges} edges`).toBeLessThanOrEqual(2);
  expect(m.worstDeviation, `${scheme}: worst bevel deviation`).toBeLessThanOrEqual(12);
  if (m.sideTiles > 0) expect(m.hueError, `${scheme}: mean hue error of the side tiles (degrees)`).toBeLessThanOrEqual(15);
  else expect(scheme, "only the white-ground scheme without colored tokens has no side tiles").toBe("paper-blue");
});

test("overall over the schemes: side chroma, highlight excess and bevel depth", () => {
  const all = SCHEMES.map((s) => results[s]).filter(Boolean), side = all.filter((m) => m.sideTiles > 0);
  expect(all.length, "the per-scheme tests of this file ran before").toBe(SCHEMES.length);
  const chroma = mean(side.map((m) => m.sideChroma)), excess = mean(side.map((m) => m.highlightExcessPoints)), depth = mean(all.map((m) => m.bevelDepth));
  console.log(`LOOK overall bevel ${depth.toFixed(1)} sideChroma ${chroma.toFixed(2)} highlightExcess ${excess.toFixed(2)}`);
  expect(chroma, "side chroma, relative to the token").toBeGreaterThanOrEqual(0.65);
  expect(excess, "highlight share minus the flat render, in points").toBeLessThanOrEqual(0.5);
  expect(depth, "bevel depth over all schemes (luma levels; the per-face weight look: 3.7)").toBeGreaterThanOrEqual(17);
});

// Brightness while the cube turns about y in steps of 15 degrees (pitch 0.22, Paper Red): the exposure is the one global scalar that
// follows the faces that look at the camera. Measured: exposure step 17 % (the per-face weight look 5.4 %), largest mean luma step of a
// face 39 (9). The bounds guard against a jump, they are not a requirement of the look.
test("paper-red (production effects): the exposure and the face brightness change by at most 25 % and 45 luma levels per 15 degrees of yaw", async ({ page }) => {
  test.setTimeout(240000);
  await openApp(page, { scheme: "paper-red", year: 2026, month: 11 });
  const sweep = [];
  for (let yaw = 0; yaw < 360; yaw += 15) { const r = await measureLook(page, { pitch: 0.22, rotY: yaw * Math.PI / 180, bevels: false }); sweep.push({ exposure: r.exposure, tiles: r.tiles }); }
  const s = sweepSteps(sweep);
  console.log(`LOOK sweep ${JSON.stringify(s)}`);
  expect(s.exposureStepPercent, "largest exposure step per 15 degrees (%)").toBeLessThanOrEqual(25);
  expect(s.faceStepLuma, "largest mean luma step of a face per 15 degrees").toBeLessThanOrEqual(45);
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
