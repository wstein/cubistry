// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout: the colors on screen are the scheme tokens. The real viewer renders the front face of the window
// print (WebGL, Chromium) head on or in the start view; every tile class is sampled and compared with the token it was drawn
// from. The names layout uses Linear tone mapping at the exposure that makes the face looking at the camera show its albedo
// (names-exposure.ts), times the gain that gives back what its shading takes (plasticity, names-plasticity.ts, default 0.6),
// so the mean color of a flat area is its token with the paper white (NAMES_WHITE) as the reference; single tiles differ a few
// levels by the shading. Both effect modes are measured: the repo's test mode (cubistry-lowfx=shadows from
// playwright.config.mjs: shadow map off) and the production effects (shadow map on, what users get).
import { test, expect } from "@playwright/test";

// Tolerance in 8-bit sRGB per channel. Fills are the median of the tile interior (shading and antialiasing do not matter);
// ink and line are the best matching pixel of the tile (thin strokes never cover whole pixels but the best one is a stroke core).
const FILL_TOL = 7, STROKE_TOL = 6; // at the default plasticity 0.6: it shades the faces (a tile can be a few levels off: Paper Red 6, Dracula 7), the median of all tiles is checked at 2
const SCHEMES = ["paper-red", "paper-blue", "classic", "solarized-light", "gruvbox-light", "dracula", "monokai", "gruvbox-dark", "catppuccin-mocha", "high-contrast", "rubik-tint"];

async function sample(page, scheme, tilted = false, production = false, plasticity = undefined) {
  await page.goto("/licenses.html");
  return page.evaluate(async ({ scheme, tilted, production, plasticity }) => {
    if (production) localStorage.removeItem("cubistry-lowfx"); // read by configurePresentationRenderer: no key = shadow map on
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { loadCalendarFont } = await import("/src/apps/calendar7/fonts.ts");
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const { schemeById, withBannerStyle } = await import("/src/apps/calendar7/schemes.ts");
    const { isBannerClass, tileClass, tileGrid, tileRoles } = await import("/src/apps/calendar7/sticker-art.ts");
    const { layerWidthsFor, unitGridTileOf } = await import("/src/apps/calendar7/geometry.ts");
    const { printing, pose } = parseState(await (await fetch("/calendar7/names/state.v1.json")).json());
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:800px;height:800px";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.setFont(await loadCalendarFont("noto", "/"));
    viewer.setScheme(scheme);
    viewer.setHomePose(pose); // home faces of the Rubik-Tint scheme (the identity pose of the print)
    if (plasticity !== undefined) viewer.setPlasticity(plasticity);
    viewer.configure(printing, pose, "face", "names");
    // Head on to the front face, or the default start view of the app (yaw 0.3, pitch 0.22: the cube as the page first shows it).
    if (tilted) viewer.presentation.rotation.set(tilted === true ? 0.22 : tilted, -0.3, 0); else viewer.presentation.rotation.set(0, 0, 0);
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
      const cls0 = tileClass(printing.text[i], printing.ink[i]);
      // Unit grid: the fill is on the unit cell (a month tile: the banner), not on the whole tile; the probe takes the middle of that rectangle.
      const tile = unitGridTileOf(pose.pos.subarray(3 * i, 3 * i + 3), pose.normal.subarray(3 * i, 3 * i + 3), pose.up.subarray(3 * i, 3 * i + 3), layerWidthsFor(7)), g = tileGrid(tile), rect = isBannerClass(cls0) ? g.banner : g.cell;
      const fx = (u) => box.min.x + (box.max.x - box.min.x) * u / g.W, fy = (v) => box.max.y - (box.max.y - box.min.y) * v / g.H;
      const lo = at(fx(rect.x0), fy(rect.y1)), hi = at(fx(rect.x1), fy(rect.y0)), mid = at(fx((rect.x0 + rect.x1) / 2), fy((rect.y0 + rect.y1) / 2));
      const W = Math.abs(hi.x - lo.x) * 0.5 * cv.width, H = Math.abs(hi.y - lo.y) * 0.5 * cv.height;
      const cx = (mid.x * 0.5 + 0.5) * cv.width, cy = (1 - (mid.y * 0.5 + 0.5)) * cv.height;
      const share = tilted ? 0.3 : 0.8, w = Math.round(W * share), h = Math.round(H * share), x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
      const d = ctx.getImageData(x0, y0, w, h).data, pix = [];
      for (let k = 0; k < w * h; k++) pix.push([d[4 * k], d[4 * k + 1], d[4 * k + 2]]);
      const cls = tileClass(printing.text[i], printing.ink[i]), roles = tileRoles(withBannerStyle(sch, "theme"), printing.text[i], printing.ink[i], "names");
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
  }, { scheme, tilted, production, plasticity });
}

/** Median over all tiles of the largest channel difference: the shading must not move the mean color of the flat areas. */
const medianFill = (rows) => [...rows.map((r) => r.fill)].sort((a, b) => a - b)[rows.length >> 1];

/** Median bound per scheme: 2, except High Contrast (5) and Gruvbox Light (4), measured at 0.6: there the shading shows more, partly shadow variance (Gruvbox Light: day tiles 2 to 5 darker, band and month tiles 6 brighter, the dark weekend token 4 to 5 lighter) and partly the specular white on near-black and dark tokens. At plasticity 0 both are exact. */
const MEDIAN_TOL = { "high-contrast": 5, "gruvbox-light": 4 };
/**
 * Production effects (shadow map on): the probe samples the unit cell of the tile, which on the outer-layer cubies lies 0.4 unit
 * nearer the cube interior than the middle of the tile, where the shadow-map shading of the faces is stronger (the render is
 * unchanged; the tile middle gives the former medians). Owner decision 2026-11-11: the median limits of the four schemes that
 * measured above 2 are raised to the cell values (paper-red 4, paper-blue 3, classic 4, solarized-light 4); the limits of the
 * single fills stay.
 */
const PRODUCTION_MEDIAN_TOL = { "paper-red": 4, "paper-blue": 3, classic: 4, "solarized-light": 4, "rubik-tint": 4 };
const medianTol = (scheme, production = false) => (production ? PRODUCTION_MEDIAN_TOL[scheme] : undefined) ?? MEDIAN_TOL[scheme] ?? 2;

const MODES = [["test mode", false], ["production effects", true]];

for (const [mode, production] of MODES) {
  for (const scheme of SCHEMES) test(`${scheme} (${mode}): the names layout renders its fills, inks and lines as the scheme tokens (within ${FILL_TOL} / ${STROKE_TOL} of 255)`, async ({ page }) => {
    test.setTimeout(90000); // software GL: the first frame of a 218-cubie scene is slow
    const rows = await sample(page, scheme, false, production);
    expect(rows.length).toBeGreaterThan(40); // the 7x7 front face
    const classes = new Set(rows.map((r) => r.cls));
    for (const c of ["blank", "day", "weekday", "weekend", "sunsat"]) expect(classes, c).toContain(c);
    if (process.env.C7_COLOR_TABLE) console.log(`${scheme} ${mode}\n` + JSON.stringify(rows));
    expect(medianFill(rows), `${scheme} median fill delta`).toBeLessThanOrEqual(medianTol(scheme, production));
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
    expect(medianFill(rows), `${scheme} median fill delta`).toBeLessThanOrEqual(2);
    for (const r of rows) expect(r.fill, `${scheme} ${r.cls} "${r.text}" fill ${r.got} vs ${r.want}`).toBeLessThanOrEqual(FILL_TOL);
  });
}

// The plasticity parameter (names-plasticity.ts), production effects: 0 is flat and exact; 1 shades more, the mean stays on the token.
for (const [plasticity, tol] of [[0, 4], [1, 10]]) for (const scheme of ["paper-red", "dracula"]) test(`${scheme} (production effects): plasticity ${plasticity} keeps the median fill on the token and every fill within ${tol}`, async ({ page }) => {
  test.setTimeout(90000);
  const rows = await sample(page, scheme, false, true, plasticity);
  expect(medianFill(rows), `${scheme} ${plasticity} median`).toBeLessThanOrEqual(plasticity === 0 ? 1 : plasticity === 1 && scheme === "paper-red" ? 5 : 3); // paper-red at 1: 5 on the unit cell of the outer cubies (see PRODUCTION_MEDIAN_TOL)
  for (const r of rows) expect(r.fill, `${scheme} ${plasticity} ${r.cls} "${r.text}" fill ${r.got} vs ${r.want}`).toBeLessThanOrEqual(tol);
});

// A steeper start than the app's: pitch 0.4, yaw 0.3. The face that looks at the camera is still the face the exposure follows
// (weighting exponent 8); with a flatter weighting (exponent 4) the brighter top face pulls the exposure down and white renders darker.
test("paper-red (production effects): at pitch 0.4 the fills are the tokens too (the exposure follows the face that looks at the camera)", async ({ page }) => {
  test.setTimeout(90000);
  const rows = await sample(page, "paper-red", 0.4, true);
  expect(rows.length).toBeGreaterThan(40);
  expect(medianFill(rows), "median fill delta").toBeLessThanOrEqual(3);
  if (process.env.C7_COLOR_TABLE) console.log("pitch 0.4 " + JSON.stringify(rows.slice(0, 12)));
  for (const r of rows) expect(r.fill, `${r.cls} "${r.text}" fill ${r.got} vs ${r.want}`).toBeLessThanOrEqual(9); // 9 off at most: the weekend tint of an outer cubie on the unit cell renders a little lighter than its token (#fff5f7 vs #fdeeee; see PRODUCTION_MEDIAN_TOL), exponent 4 gives 13 or more
});
