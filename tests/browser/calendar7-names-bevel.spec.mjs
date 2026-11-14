// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, the bevel of a cube edge: the brightness across the rounded edge between two faces has no stripe and no
// dark band. The owner saw a light streak on the bevel of the top front edge (dark scheme) and a dark band on the bevel of the lower
// edge (white faces), harder than the faces on both sides. The real app page (production effects, shadow map on) is turned to several
// views; the points of the quarter circle of the middle cubie of a cube edge are projected to the canvas and read from the frame.
// The neighbours are the two flat faces: the point NEIGHBOUR_OFFSET (cube units) beyond the start and the end of the arc, on the face (a face
// that is turned away is not read; the end of the visible arc stands in for it). Requirement, within TOLERANCE: along the visible part of the
// arc no sample is darker than the darker neighbour and none is brighter than the brighter one (no band, no intermediate maximum).
import { test, expect } from "@playwright/test";
import { openApp } from "./calendar7-face-probe.mjs";

test.use({ viewport: { width: 1500, height: 1500 }, deviceScaleFactor: 2 }); // the bevel arc is about 20 px long

const TOLERANCE = 6; // of 255
const NEIGHBOUR_OFFSET = 0.01; // 2.6 px at 2x: the flat face next to the bevel, before the art of the tile
const SCHEMES = ["dracula", "paper-red", "classic"];
// [pitch, rotation about y]: from above (0.22 start view, 0.45), from below (-0.3), head on and turned.
const VIEWS = [[0.22, 0], [0.45, 0], [0.22, 0.6], [0.45, 0.6], [-0.3, 0], [-0.3, 0.6]];
// The edge between the faces a and b (unit vectors), through the middle cubie of the edge (the coordinate along it is 0).
const EDGES = [["top front", [0, 1, 0], [0, 0, 1]], ["bottom front", [0, -1, 0], [0, 0, 1]], ["side front", [1, 0, 0], [0, 0, 1]]];

/** Brightness (0..255) at the visible points of the bevel arc of the edge between the faces a and b, from face a to face b. */
function arcProfile(page, { pitch, rotY, a, b }) {
  return page.evaluate(async ({ pitch, rotY, a, b, offset }) => {
    const v = window.__c7viewer;
    const { NAMES_CUBE_EDGE, NAMES_GAP, NAMES_BODY_RADIUS } = await import("/src/apps/calendar7/geometry.ts");
    const Vector3 = v.camera.position.constructor;
    v.presentation.rotation.set(pitch, rotY, 0);
    v.presentation.updateMatrixWorld(true);
    v.syncExposure();
    v.renderer.render(v.scene, v.camera);
    const cv = v.renderer.domElement, copy = document.createElement("canvas");
    copy.width = cv.width; copy.height = cv.height;
    const ctx = copy.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(cv, 0, 0);
    const R = NAMES_BODY_RADIUS, h = NAMES_CUBE_EDGE / 2 - NAMES_GAP / 2, samples = [];
    /** Brightness at the point p with the surface normal n; null when the point is turned away (or too near the silhouette). */
    const read = (p, n) => {
      const world = v.presentation.localToWorld(new Vector3(...p));
      const nw = new Vector3(...n).transformDirection(v.presentation.matrixWorld);
      if (nw.dot(v.camera.position.clone().sub(world).normalize()) < 0.3) return null;
      const ndc = world.clone().project(v.camera), x = Math.round((ndc.x * 0.5 + 0.5) * cv.width), y = Math.round((1 - (ndc.y * 0.5 + 0.5)) * cv.height);
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[3] < 250) return null; // the background (the silhouette)
      return Math.round(0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]);
    };
    for (let k = 1; k < 30; k++) {
      const phi = (k / 30) * Math.PI / 2, c = Math.cos(phi), s = Math.sin(phi);
      const n = a.map((x, i) => c * x + s * b[i]), luma = read(a.map((x, i) => (h - R) * (x + b[i]) + R * n[i]), n);
      if (luma !== null) samples.push({ phi: +(phi * 180 / Math.PI).toFixed(1), luma });
    }
    // The flat faces next to the bevel: face a at its start (moving into the face, direction -b), face b at its end (direction -a).
    const start = read(a.map((x, i) => (h - R) * (x + b[i]) + R * a[i] - offset * b[i]), a), end = read(a.map((x, i) => (h - R) * (x + b[i]) + R * b[i] - offset * a[i]), b);
    return { samples, start, end };
  }, { pitch, rotY, a, b, offset: NEIGHBOUR_OFFSET });
}

/** Violations of the requirement, as text (empty: fine). */
export function bevelViolations(luma, start, end, tolerance = TOLERANCE) {
  const ends = [start ?? luma[0], end ?? luma[luma.length - 1]], lo = Math.min(...ends), hi = Math.max(...ends), out = [];
  const min = Math.min(...luma), max = Math.max(...luma);
  if (min < lo - tolerance) out.push(`dark band: ${min} below the darker neighbour ${lo}`);
  if (max > hi + tolerance) out.push(`stripe: ${max} above the brighter neighbour ${hi}`);
  return out;
}

for (const scheme of SCHEMES) test(`${scheme} (Feb 2027, production effects): the bevel of a cube edge has no stripe and no dark band at pitch 0.22, 0.45 and -0.3, yaw 0 and 0.6`, async ({ page }) => {
  test.setTimeout(240000);
  await openApp(page, { scheme, year: 2027, month: 2 });
  const failures = [], table = [];
  for (const [pitch, rotY] of VIEWS) for (const [name, a, b] of EDGES) {
    const { samples, start, end } = await arcProfile(page, { pitch, rotY, a, b });
    if (samples.length < 8) continue; // the bevel is mostly turned away from the camera
    const luma = samples.map((s) => s.luma), bad = bevelViolations(luma, start, end);
    table.push(`${scheme} pitch ${pitch} yaw ${rotY} ${name}: [${start ?? "-"}] ${luma.join(" ")} [${end ?? "-"}]${bad.length ? "  <- " + bad.join("; ") : ""}`);
    if (bad.length) failures.push(`${name} pitch ${pitch} yaw ${rotY}: ${bad.join("; ")}`);
  }
  console.log(table.join("\n"));
  expect(table.length, "the views show the edges").toBeGreaterThanOrEqual(8);
  expect(failures, failures.join("\n")).toEqual([]);
});
