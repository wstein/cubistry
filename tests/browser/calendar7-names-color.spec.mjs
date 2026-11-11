// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout: the colors on screen are the scheme tokens. The real viewer renders the front face of the window
// print (WebGL, Chromium) head on or in the start view; every tile class is sampled and compared with the token it was drawn
// from. The names layout uses Linear tone mapping at the exposure that makes the face looking at the camera show its albedo
// (names-exposure.ts), no specular, and cube faces that do not receive shadows, so a token renders as itself with the paper
// white (NAMES_WHITE) as the reference. Both effect modes are measured: the repo's test mode (cubistry-lowfx=shadows from
// playwright.config.mjs: shadow map off) and the production effects (shadow map on, what users get).
import { test, expect } from "@playwright/test";

// Tolerance in 8-bit sRGB per channel. Fills are the median of the tile interior (shading and antialiasing do not matter);
// ink and line are the best matching pixel of the tile (thin strokes never cover whole pixels but the best one is a stroke core).
const FILL_TOL = 4, STROKE_TOL = 6;
const SCHEMES = ["paper-red", "paper-blue", "classic", "solarized-light", "gruvbox-light", "dracula", "monokai", "gruvbox-dark", "catppuccin-mocha", "high-contrast"];

async function sample(page, scheme, tilted = false, production = false) {
  await page.goto("/licenses.html");
  return page.evaluate(async ({ scheme, tilted, production }) => {
    if (production) localStorage.removeItem("cubistry-lowfx"); // read by configurePresentationRenderer: no key = shadow map on
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { loadCalendarFont } = await import("/src/apps/calendar7/fonts.ts");
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const { schemeById } = await import("/src/apps/calendar7/schemes.ts");
    const { tileClass, tileRoles } = await import("/src/apps/calendar7/sticker-art.ts");
    const { printing, pose } = parseState(await (await fetch("/calendar7/names/state.v1.json")).json());
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:800px;height:800px";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.setFont(await loadCalendarFont("noto", "/"));
    viewer.setScheme(scheme);
    viewer.configure(printing, pose, "face", "names");
    // Head on to the front face, or the default start view of the app (yaw 0.3, pitch 0.22: the cube as the page first shows it).
    if (tilted) viewer.presentation.rotation.set(0.22, -0.3, 0); else viewer.presentation.rotation.set(0, 0, 0);
    viewer.presentation.updateMatrixWorld(true);
    viewer.syncExposure(); // the render loop does it before a frame; this probe renders by hand
    const cv = viewer.renderer.domElement;
    viewer.renderer.render(viewer.scene, viewer.camera);
    const copy = document.createElement("canvas");
    copy.width = cv.width; copy.height = cv.height;
    const ctx = copy.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(cv, 0, 0); // in the task of the render: the drawing buffer is not preserved
    const sch = schemeById(scheme);
    const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    const hex = (p) => "#" + p.map((v) => v.toString(16).padStart(2, "0")).join("");
    const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
    const diff = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const out = [], Vector3 = viewer.camera.position.constructor; // the viewer's own three.js classes (a second import would load a second copy)
    viewer.presentation.traverse((o) => {
      const ids = o.userData.sourceFaceStickerIds;
      if (!ids || !Array.isArray(o.material) || ids[4] == null) return; // +Z: the front face
      o.geometry.computeBoundingBox();
      const i = ids[4] - 1, box = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const at = (x, y) => new Vector3(x, y, box.max.z).project(viewer.camera);
      const lo = at(box.min.x, box.min.y), hi = at(box.max.x, box.max.y), mid = at((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2);
      const W = Math.abs(hi.x - lo.x) * 0.5 * cv.width, H = Math.abs(hi.y - lo.y) * 0.5 * cv.height;
      const cx = (mid.x * 0.5 + 0.5) * cv.width, cy = (1 - (mid.y * 0.5 + 0.5)) * cv.height;
      const share = tilted ? 0.3 : 0.8, w = Math.round(W * share), h = Math.round(H * share), x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
      const d = ctx.getImageData(x0, y0, w, h).data, pix = [];
      for (let k = 0; k < w * h; k++) pix.push([d[4 * k], d[4 * k + 1], d[4 * k + 2]]);
      const cls = tileClass(printing.text[i], printing.ink[i]), roles = tileRoles(sch, printing.text[i], printing.ink[i], "names");
      const fill = [0, 1, 2].map((c) => med(pix.map((p) => p[c])));
      const best = (px, want) => px.reduce((m, p) => Math.min(m, diff(p, want)), 255);
      const row = { cls, text: printing.text[i], want: roles.fill, got: hex(fill), fill: diff(fill, rgb(roles.fill)) };
      if (!tilted && printing.text[i] !== "" && cls !== "month" && !printing.text[i].includes("/")) { row.inkWant = roles.ink; row.ink = best(pix, rgb(roles.ink)); }
      if (!tilted && roles.line) { // the line sits just above the bottom edge of the flat part: the lowest 30% of the tile
        const sh = Math.round(H * 0.3), sd = ctx.getImageData(x0, Math.round(cy + H * 0.5) - sh, w, sh).data, strip = [];
        for (let k = 0; k < w * sh; k++) strip.push([sd[4 * k], sd[4 * k + 1], sd[4 * k + 2]]);
        row.lineWant = roles.line.color; row.line = best(strip, rgb(roles.line.color));
      }
      out.push(row);
    });
    viewer.destroy();
    return out;
  }, { scheme, tilted, production });
}

const MODES = [["test mode", false], ["production effects", true]];

for (const [mode, production] of MODES) {
  for (const scheme of SCHEMES) test(`${scheme} (${mode}): the names layout renders its fills, inks and lines as the scheme tokens (within ${FILL_TOL} / ${STROKE_TOL} of 255)`, async ({ page }) => {
    test.setTimeout(90000); // software GL: the first frame of a 218-cubie scene is slow
    const rows = await sample(page, scheme, false, production);
    expect(rows.length).toBeGreaterThan(40); // the 7x7 front face
    const classes = new Set(rows.map((r) => r.cls));
    for (const c of ["blank", "day", "weekday", "weekend", "sunsat"]) expect(classes, c).toContain(c);
    if (process.env.C7_COLOR_TABLE) console.log(`${scheme} ${mode}\n` + JSON.stringify(rows));
    for (const r of rows) {
      const id = `${scheme} ${r.cls} "${r.text}"`;
      expect(r.fill, `${id} fill ${r.got} vs ${r.want}`).toBeLessThanOrEqual(FILL_TOL);
      if (r.ink !== undefined) expect(r.ink, `${id} ink vs ${r.inkWant}`).toBeLessThanOrEqual(STROKE_TOL);
      if (r.line !== undefined) expect(r.line, `${id} line vs ${r.lineWant}`).toBeLessThanOrEqual(STROKE_TOL);
    }
  });

  // The default start view is turned (yaw 0.3, pitch 0.22): the exposure follows the face that looks at the camera, so the paper
  // white and the red are the tokens there too (fills only: the digits of a turned face are thin parallelograms).
  for (const scheme of ["paper-red", "paper-blue", "dracula"]) test(`${scheme} (${mode}): the start view of the app (turned cube) renders the fills as the tokens too`, async ({ page }) => {
    test.setTimeout(90000);
    const rows = await sample(page, scheme, true, production);
    expect(rows.length).toBeGreaterThan(40);
    for (const r of rows) expect(r.fill, `${scheme} ${r.cls} "${r.text}" fill ${r.got} vs ${r.want}`).toBeLessThanOrEqual(FILL_TOL);
  });
}
