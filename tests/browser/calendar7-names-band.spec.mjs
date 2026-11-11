// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, month banner across the cubie edges (unit grid): the real viewer renders the front face (WebGL,
// Chromium) head on, in the start view and obliquely; across every joint between two cubies of the month row the red band
// stays red (the joint may be a darker red, never white or light) and the white strips above and below it stay white (no red
// line in a white area). The cut faces next to the banner take their color from the drawing along the edge (tileEdgeColors).
import { test, expect } from "@playwright/test";

const VIEWS = [
  ["head on", 0, 0],
  ["start view (yaw 0.3, pitch 0.22)", 0.22, -0.3],
  ["oblique (yaw 0.9)", 0.1, -0.9],
];

async function joints(page, pitch, yaw) {
  await page.goto("/licenses.html");
  return page.evaluate(async ({ pitch, yaw }) => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { loadCalendarFont } = await import("/src/apps/calendar7/fonts.ts");
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const { layerWidthsFor, NAMES_CUBE_EDGE } = await import("/src/apps/calendar7/geometry.ts");
    const { printing, pose } = parseState(await (await fetch("/calendar7/names/state.v1.json")).json());
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:900px;height:900px";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.setFont(await loadCalendarFont("noto", "/"));
    viewer.setScheme("paper-red");
    viewer.configure(printing, pose, "face", "names");
    viewer.presentation.rotation.set(pitch, yaw, 0);
    viewer.presentation.updateMatrixWorld(true);
    viewer.syncExposure();
    const cv = viewer.renderer.domElement;
    viewer.renderer.render(viewer.scene, viewer.camera);
    const copy = document.createElement("canvas");
    copy.width = cv.width; copy.height = cv.height;
    const ctx = copy.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(cv, 0, 0);
    const Vector3 = viewer.camera.position.constructor;
    const widths = layerWidthsFor(7), half = NAMES_CUBE_EDGE / 2, planes = [-half];
    for (const w of widths) planes.push(planes[planes.length - 1] + w);
    const at = (x, y) => { // the front face point (x, y) in canvas pixels
      const p = new Vector3(x, y, half).applyMatrix4(viewer.presentation.matrixWorld).project(viewer.camera);
      return [(p.x * 0.5 + 0.5) * cv.width, (1 - (p.y * 0.5 + 0.5)) * cv.height];
    };
    const px = (x, y) => { const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2]]; };
    // the banner is 3.0 .. 4.2 high (units, y up from the cube center); the strips 4.2 .. 4.3 and 2.5 .. 3.0
    const bands = { red: [3.15, 3.6, 4.05], white: [2.62, 2.85] };
    const rows = [];
    for (let j = 2; j <= 6; j++) { // the joints inside the banner: between columns 2 and 3 ... 6 and 7 (column 1 / 2 is inside the banner too: j = 1)
      for (const [kind, ys] of Object.entries(bands)) for (const y of ys) {
        const [cx, cy] = at(planes[j], y), [nx, ny] = at(planes[j] + 0.05, y), step = Math.hypot(nx - cx, ny - cy) / 0.05 / 20; // 1/20 unit in px
        const samples = [];
        for (let k = -6; k <= 6; k++) samples.push(px(cx + (nx - cx) / Math.hypot(nx - cx, ny - cy) * k * Math.max(0.5, step * 0.5), cy));
        rows.push({ joint: j, kind, y, samples });
      }
    }
    viewer.destroy();
    return rows;
  }, { pitch, yaw });
}

for (const [name, pitch, yaw] of VIEWS) test(`month banner joints, ${name}: red across every joint of the band, white across the white strips`, async ({ page }) => {
  test.setTimeout(120000);
  const rows = await joints(page, pitch, yaw);
  expect(rows.length).toBe(5 * 5);
  for (const r of rows) for (const [k, [R, G, B]] of r.samples.entries()) {
    if (r.kind === "red") expect(R - G, `joint ${r.joint} y ${r.y} sample ${k}: rgb(${R}, ${G}, ${B}) is red`).toBeGreaterThan(60);
    else expect(Math.abs(R - G), `joint ${r.joint} y ${r.y} sample ${k}: rgb(${R}, ${G}, ${B}) is not red`).toBeLessThan(45);
  }
});
