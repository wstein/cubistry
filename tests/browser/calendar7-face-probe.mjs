// SPDX-License-Identifier: AGPL-3.0-or-later
// Real Calendar7 page probe (names layout): turns the cube of the running app to a view, renders it by hand and measures, per
// visible face, the share of clipped fill pixels (all channels >= 253 of the light, non-ink pixels) and the largest channel
// difference of the tile fills (most common color of the central 70% of each tile) from their scheme tokens. Shared by
// calendar7-names-faces.spec.mjs and the screenshot / table probes of the PR.

/** Opens the app page, waits for idle and returns nothing; `scheme`, `year`, `month` select the print. */
export async function openApp(page, { scheme, year = 2027, month = 2, production = true }) {
  if (production) { await page.goto("/licenses.html"); await page.evaluate(() => localStorage.removeItem("cubistry-lowfx")); } // production effects: shadow map on
  await page.goto(`/index.html?app=calendar7&year=${year}&month=${month}&scheme=${scheme}`);
  await page.waitForSelector(`#calendar7-root[data-c7-state="idle"]`, { timeout: 90000 });
  // Capture the app's own viewer instance: wrap syncExposure (same module instance as the app's), then provoke a frame.
  await page.evaluate(async () => {
    // The dev server may have put a ?t= stamp on the module URL the app imported: take the exact URL, or a second instance is patched.
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /\/src\/apps\/calendar7\/viewer\.ts(\?|$)/.test(n)) ?? "/src/apps/calendar7/viewer.ts";
    const { Calendar7Viewer } = await import(url);
    const P = Calendar7Viewer.prototype, orig = P.syncExposure;
    P.syncExposure = function () { window.__c7viewer = this; return orig.call(this); };
  });
  const box = await page.locator("#studio-scene canvas").boundingBox();
  for (let k = 0; k < 6 && !(await page.evaluate(() => !!window.__c7viewer)); k++) { // a drag turns the cube and draws a frame
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 5 + k, box.y + box.height / 2 + 5, { steps: 3 }); await page.mouse.up();
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() => !!window.__c7viewer, null, { timeout: 20000 });
}

/** Renders the view (pitch, rotation y) and measures the faces. Returns { exposure, faces: { up, front, right, left }: { clipped (pixel share), washedShare (share of tiles with a colored token that render white), delta (max), medianDelta, p90 }, png }. */
export function measureFaces(page, { pitch, rotY, png = false }) {
  return page.evaluate(async ({ pitch, rotY, png }) => {
    const v = window.__c7viewer;
    const { schemeForHome, usesHomeTints } = await import("/src/apps/calendar7/home-tint.ts");
    const { isBannerClass, tileClass, tileRoles } = await import("/src/apps/calendar7/sticker-art.ts");
    const { withBannerStyle } = await import("/src/apps/calendar7/schemes.ts");
    const Vector3 = v.camera.position.constructor;
    v.presentation.rotation.set(pitch, rotY, 0);
    v.presentation.updateMatrixWorld(true);
    v.syncExposure();
    v.renderer.render(v.scene, v.camera);
    const cv = v.renderer.domElement, copy = document.createElement("canvas");
    copy.width = cv.width; copy.height = cv.height;
    const ctx = copy.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(cv, 0, 0);
    const proj = (p) => { const w = v.presentation.localToWorld(new Vector3(...p)); w.project(v.camera); return [(w.x * 0.5 + 0.5) * cv.width, (1 - (w.y * 0.5 + 0.5)) * cv.height]; };
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
    const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    const px = (x, y) => { const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2]]; };
    // quad of a face (presentation-local corners) -> bilinear pixel sample
    const e = v.extent;
    const NORMALS = { up: [0, 1, 0], front: [0, 0, 1], right: [1, 0, 0], left: [-1, 0, 0] };
    const LOCAL = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; // sourceFaceStickerIds: +x -x +y -y +z -z of the cubie mesh
    const QUADS = {
      up: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], front: [[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1]],
      right: [[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1]], left: [[-1, 1, -1], [-1, 1, 1], [-1, -1, 1], [-1, -1, -1]],
    };
    const bil = (q, i, j) => { const a = [q[0][0] + (q[1][0] - q[0][0]) * i, q[0][1] + (q[1][1] - q[0][1]) * i], b = [q[3][0] + (q[2][0] - q[3][0]) * i, q[3][1] + (q[2][1] - q[3][1]) * i]; return [a[0] + (b[0] - a[0]) * j, a[1] + (b[1] - a[1]) * j]; };
    const faces = {}, toCam = v.camera.position.clone().normalize(), rotQ = v.presentation.quaternion;
    for (const [f, corners] of Object.entries(QUADS)) {
      if (new Vector3(...NORMALS[f]).applyQuaternion(rotQ).dot(toCam) < 0.2) { faces[f] = null; continue; } // a face that looks away is not measured
      const q = corners.map((c) => proj(c.map((x) => x * e)));
      const fillsPx = [];
      for (let i = 0.05; i < 1; i += 0.04) for (let j = 0.05; j < 1; j += 0.04) { const [x, y] = bil(q, i, j); fillsPx.push(px(x, y)); }
      const light = fillsPx.filter((p) => lum(p) > 150);
      faces[f] = { fills: light.length, clipped: light.length ? light.filter((p) => p[0] >= 253 && p[1] >= 253 && p[2] >= 253).length / light.length : null, delta: 0, medianDelta: 0, tiles: 0 };
    }
    // token deviation per sticker: median of the central 30% of the projected tile
    const sch0 = v.currentScheme, deltas = { up: [], front: [], right: [], left: [] };
    const washed = Object.fromEntries(Object.keys(deltas).map((f) => [f, { tiles: 0, washed: 0 }]));
    v.presentation.traverse((o) => {
      const ids = o.userData.sourceFaceStickerIds;
      if (!ids || !Array.isArray(o.material)) return;
      for (let fi = 0; fi < 6; fi++) {
        if (ids[fi] == null) continue;
        const i = ids[fi] - 1;
        o.geometry.computeBoundingBox();
        const m = v.presentation.matrixWorld.clone().invert().multiply(o.matrixWorld);
        const bb = o.geometry.boundingBox.clone().applyMatrix4(m), n = new Vector3(...LOCAL[fi]).transformDirection(m).toArray().map(Math.round);
        const f = Object.keys(NORMALS).find((k) => NORMALS[k].every((x, k2) => x === n[k2]));
        if (!f) continue;
        const ax = [0, 1, 2].filter((k) => n[k] === 0), pl = n.findIndex((x) => x !== 0), plane = n[pl] > 0 ? bb.max.getComponent(pl) : bb.min.getComponent(pl);
        const corner = (a, b) => { const p = [0, 0, 0]; p[pl] = plane; p[ax[0]] = a; p[ax[1]] = b; return p; };
        const lo = [bb.min.getComponent(ax[0]), bb.min.getComponent(ax[1])], hi = [bb.max.getComponent(ax[0]), bb.max.getComponent(ax[1])], c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], s = [(hi[0] - lo[0]) * 0.35, (hi[1] - lo[1]) * 0.35];
        const q = [corner(c[0] - s[0], c[1] - s[1]), corner(c[0] + s[0], c[1] - s[1]), corner(c[0] + s[0], c[1] + s[1]), corner(c[0] - s[0], c[1] + s[1])].map((p) => proj(p));
        const pix = [];
        for (let a = 0.03; a < 1; a += 0.1) for (let b = 0.03; b < 1; b += 0.1) { const [x, y] = bil(q, a, b); pix.push(px(x, y)); }
        let sch = withBannerStyle(sch0, "theme");
        if (usesHomeTints(v.baseScheme)) sch = withBannerStyle(schemeForHome(v.baseScheme, v.homes[i]), "theme");
        const roles = tileRoles(sch, v.printing.text[i], v.printing.ink[i], "names");
        const bins = new Map(); for (const p of pix) { const key = p.map((x) => x >> 4).join(); (bins.get(key) ?? bins.set(key, []).get(key)).push(p); }
        const main = [...bins.values()].sort((a, b) => b.length - a.length)[0]; // the fill covers more of the window than the ink: the most common color bin
        const fill = [0, 1, 2].map((k) => med(main.map((p) => p[k]))), want = rgb(roles.fill);
        deltas[f].push(Math.max(...fill.map((x, k) => Math.abs(x - want[k]))));
        if (Math.min(...want) <= 235 && !isBannerClass(tileClass(v.printing.text[i], v.printing.ink[i]))) { // a banner tile (month name) is white around its colored band: its tile center is not the fill
           washed[f].tiles++; if (fill.every((x) => x >= 253)) { washed[f].washed++; (washed[f].list ??= []).push(`${v.printing.text[i]} want ${roles.fill} got ${fill}`); } } // a tile whose token is not (near) white and that renders white
      }
    });
    for (const f of Object.keys(deltas)) { if (!faces[f]) continue; const d = deltas[f].sort((a, b) => a - b); faces[f].washedTiles = washed[f].list ?? []; faces[f].washedShare = washed[f].tiles ? washed[f].washed / washed[f].tiles : null; faces[f].coloredTiles = washed[f].tiles; faces[f].tiles = d.length; faces[f].delta = d.length ? d[d.length - 1] : 0; faces[f].medianDelta = d.length ? d[d.length >> 1] : 0; faces[f].p90 = d.length ? d[Math.floor(d.length * 0.9)] : 0; }
    return { exposure: v.renderer.toneMappingExposure, toneMapping: v.renderer.toneMapping, faces, png: png ? cv.toDataURL("image/png") : undefined };
  }, { pitch, rotY, png });
}
