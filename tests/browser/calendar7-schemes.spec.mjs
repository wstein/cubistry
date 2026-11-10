// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";

// Color schemes in the real Calendar7Viewer (WebGL, Chromium) on the hand-made layout fixture (tests/calendar7-fixture.mjs):
// the textures of the stickers carry the ground, the ink and the weekday-row line of the chosen scheme; a scheme change
// redraws the same textures in place (no new textures, no leak); the URL parameter picks the scheme.

const hex = (d, x, y, w) => "#" + [0, 1, 2].map((k) => d[(y * w + x) * 4 + k].toString(16).padStart(2, "0")).join("");

test("the viewer draws the grounds, inks and weekday line of the chosen scheme, and redraws in place", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console.error: ${m.text()}`));
  await page.goto("/licenses.html");
  const r = await page.evaluate(async () => {
    const face = new FontFace("Counter Sans", "url(/fonts/noto-sans-latin-600.woff2)", { weight: "600" });
    document.fonts.add(await face.load());
    await document.fonts.load('600 80px "Counter Sans"');
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { layoutFixture } = await import("/tests/calendar7-fixture.mjs");
    const { printing, pose } = layoutFixture();
    const host = document.createElement("div");
    host.style.cssText = "width:480px;height:480px;position:fixed;left:0;top:0";
    document.body.append(host);
    const panel = document.createElement("div");
    document.body.append(panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.configure(printing, pose);
    const stickers = new Map();
    viewer.presentation.traverse((o) => { if (o.userData.stickerId !== undefined) stickers.set(o.userData.stickerId, o); });
    const canvasOf = (text, ink) => {
      const i = printing.text.findIndex((t, k) => t === text && printing.ink[k] === ink);
      return stickers.get(i + 1).material.map.image;
    };
    // Per tile: the pixel at the top left corner (ground), whether the ink color occurs, the pixel in the middle of the bottom edge.
    const probe = (text, ink, inkColor) => {
      const c = canvasOf(text, ink);
      const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
      const px = (x, y) => [0, 1, 2].map((k) => d[(y * c.width + x) * 4 + k]);
      const want = [1, 3, 5].map((i) => parseInt(inkColor.slice(i, i + 2), 16));
      let inks = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] === want[0] && d[i + 1] === want[1] && d[i + 2] === want[2]) inks++;
      return { ground: px(4, 4), inks, bottom: px(96, Math.floor(c.height * (1 + FACE_FLAT) / 2) - 2) };
    };
    const weekendText = printing.text.find((t, k) => printing.ink[k] === "red" && /^[0-9]+$/.test(t));
    const tiles = { day: ["7", "dark", "dayInk"], weekend: [weekendText, "red", "weekendInk"], mon: ["MON", "weekday", "weekdayInk"], sun: ["SUN", "red", "sunSatInk"], month: ["VEM", "month", "monthInk"] };
    const { SCHEMES } = await import("/src/apps/calendar7/schemes.ts");
    const { FACE_FLAT } = await import("/src/apps/calendar7/sticker-art.ts");
    const missing = Object.entries(tiles).filter(([, [t, i]]) => !printing.text.some((x, k) => x === t && printing.ink[k] === i)).map(([k]) => k);
    const take = (id) => {
      viewer.setScheme(id);
      const s = SCHEMES.find((x) => x.id === id);
      const out = {};
      for (const [k, [t, i, role]] of Object.entries(tiles)) if (!missing.includes(k)) out[k] = probe(t, i, s[role]);
      return out;
    };
    const counts = () => ({ textures: viewer.renderer.info.memory.textures, resources: viewer.resources.length });
    const uuids = () => [...new Set([...stickers.values()].map((s) => s.material.map.uuid))].sort().join();
    const before = { ...counts(), uuids: uuids() };
    const mapOf = (text, ink) => stickers.get(printing.text.findIndex((t, k) => t === text && printing.ink[k] === ink) + 1).material.map;
    const red = take("paper-red"); // the default scheme: nothing to redraw
    const v0 = mapOf("MON", "weekday").version;
    const blue = take("paper-blue");
    const uploads = mapOf("MON", "weekday").version - v0; // the texture is flagged for upload again
    const drac = take("dracula");
    for (let i = 0; i < 20; i++) { viewer.setScheme("monokai"); viewer.setScheme("classic"); }
    const rt = take("paper-blue");
    const unknown = (() => { viewer.setScheme("nope"); return viewer.currentScheme.id; })();
    viewer.setScheme(null);
    const nullId = viewer.currentScheme.id;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = { ...counts(), uuids: uuids() };
    // Stickerless: the bare body (the faces without a label texture) is the day fill of the scheme, also after a scheme change.
    const bare = () => {
      const colors = new Set();
      viewer.presentation.traverse((o) => {
        if (!o.userData.sourceFaceStickerIds || !Array.isArray(o.material)) return;
        for (const m of o.material) if (!m.map) colors.add("#" + m.color.getHexString());
      });
      return [...colors].sort();
    };
    viewer.setScheme(null);
    viewer.configure(printing, pose, "face");
    const bodyRed = bare();
    viewer.setScheme("dracula");
    const bodyDracula = bare();
    const stickerBody = (() => { viewer.configure(printing, pose, "sticker"); return viewer.currentScheme.id; })();
    // A legacy sticker hint cannot restore a plastic frame: cut faces still follow the scheme day fill.
    const frame = () => {
      const colors = new Set();
      viewer.presentation.traverse((o) => {
        if (o.userData.sourceFaceStickerIds && !Array.isArray(o.material)) colors.add("#" + o.material.color.getHexString());
      });
      // The shown frame is the plastic; the cut-face materials the scene keeps for the stickerless mode carry the body color.
      for (const { stickerless } of viewer.cube.shells.values()) for (const m of stickerless) if (!m.map) colors.add("#" + m.color.getHexString());
      return [...colors].sort();
    };
    viewer.setScheme("paper-blue");
    const frameLight = frame();
    viewer.setScheme("dracula");
    const frameDark = frame();
    viewer.destroy();
    return { frameLight, frameDark, bodyRed, bodyDracula, stickerBody, uploads, missing, red, blue, drac, rt, unknown, nullId, before, after };
  });
  expect(errors).toEqual([]);
  expect(r.missing).toEqual([]);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  // Paper Red: white day tile, tint under weekend numerals, gray weekday row with the red line; month letters on the red band.
  expect(r.red.day.ground).toEqual(rgb("#ffffff"));
  expect(r.red.weekend.ground).toEqual(rgb("#fdeeee"));
  expect(r.red.mon.ground).toEqual(rgb("#ececec"));
  expect(r.red.sun.ground).toEqual(rgb("#ececec"));
  expect(r.red.month.ground).toEqual(rgb("#e0282c"));
  expect(r.red.mon.bottom).toEqual(rgb("#e0282c"));
  expect(r.red.sun.bottom).toEqual(rgb("#e0282c"));
  expect(r.red.day.bottom).toEqual(rgb("#ffffff"));
  expect(r.red.weekend.bottom).toEqual(rgb("#fdeeee"));
  expect(r.red.month.bottom).toEqual(rgb("#e0282c"));
  // Paper Blue: tint behind weekend numerals and SUN, month name on white, blue line under weekday names.
  expect(r.blue.weekend.ground).toEqual(rgb("#e3ebfa"));
  expect(r.blue.sun.ground).toEqual(rgb("#e3ebfa"));
  expect(r.blue.mon.ground).toEqual(rgb("#ffffff"));
  expect(r.blue.month.ground).toEqual(rgb("#ffffff"));
  expect(r.blue.mon.bottom).toEqual(rgb("#1558d8"));
  expect(r.blue.day.bottom).toEqual(rgb("#ffffff"));
  // Dracula: dark tiles, purple weekend fill, magenta band, no line.
  expect(r.drac.day.ground).toEqual(rgb("#282a36"));
  expect(r.drac.weekend.ground).toEqual(rgb("#bd93f9"));
  expect(r.drac.sun.ground).toEqual(rgb("#bd93f9"));
  expect(r.drac.month.ground).toEqual(rgb("#ff79c6"));
  expect(r.drac.mon.bottom).toEqual(rgb("#282a36"));
  // The ink of each class occurs in its texture (real Noto Sans, solid glyph interior).
  for (const set of [r.red, r.blue, r.drac]) for (const t of Object.values(set)) expect(t.inks).toBeGreaterThan(100);
  // Going to other schemes and back gives the same pixels; the number of textures and of owned resources does not change.
  for (const [k, t] of Object.entries(r.blue)) {
    expect(r.rt[k].ground).toEqual(t.ground);
    expect(r.rt[k].bottom).toEqual(t.bottom);
    expect(Math.abs(r.rt[k].inks - t.inks) / t.inks, `${k} ink pixels ${t.inks} vs ${r.rt[k].inks}`).toBeLessThan(0.02); // antialiasing may differ by a few pixels
  }
  expect(r.after).toEqual(r.before);
  expect(r.uploads).toBeGreaterThan(0);
  expect(r.bodyRed).toEqual(["#ffffff"]);
  expect(r.bodyDracula).toEqual(["#282a36"]);
  expect(r.stickerBody).toBe("dracula");
  expect(r.frameLight).toEqual(["#ffffff"]);
  expect(r.frameDark).toEqual(["#282a36"]);
  expect(r.unknown).toBe("paper-red");
  expect(r.nullId).toBe("paper-red");
});

test("stickerless: a scheme chosen during a move reaches the body when the move ends", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console.error: ${m.text()}`));
  await page.goto("/licenses.html");
  const r = await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { layoutFixture } = await import("/tests/calendar7-fixture.mjs");
    const { printing, pose } = layoutFixture();
    const host = document.createElement("div");
    host.style.cssText = "width:480px;height:480px;position:fixed;left:0;top:0";
    document.body.append(host);
    const panel = document.createElement("div");
    document.body.append(panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.configure(printing, pose, "face");
    const bare = () => {
      const colors = new Set();
      viewer.presentation.traverse((o) => {
        if (!o.userData.sourceFaceStickerIds || !Array.isArray(o.material)) return;
        for (const m of o.material) if (!m.map) colors.add("#" + m.color.getHexString());
      });
      return [...colors].sort();
    };
    const first = bare();
    const done = viewer.turn({ axis: 2, lo: 3, hi: 3, angle: 1, kind: "layer" }, pose, 60);
    viewer.setScheme("dracula"); // the move is running
    await done;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = bare();
    const id = viewer.currentScheme.id;
    viewer.destroy();
    return { first, after, id };
  });
  expect(errors).toEqual([]);
  expect(r.first).toEqual(["#ffffff"]);
  expect(r.id).toBe("dracula");
  expect(r.after).toEqual(["#282a36"]);
});

for (const [query, id] of [["", "paper-red"], ["&scheme=paper-blue", "paper-blue"], ["&scheme=dracula", "dracula"], ["&scheme=nope", "paper-red"]]) {
  test(`the page uses scheme "${id}" for ?${query || "no scheme parameter"}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`console.error: ${m.text()}`));
    await page.goto(`/index.html?app=calendar7&year=2028&month=3${query}`);
    await expect(page.locator(`#calendar7-root[data-c7-state="idle"][data-c7-month="2028-03"]`)).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator("#calendar7-root")).toHaveAttribute("data-c7-scheme", id);
    expect(errors).toEqual([]);
  });
}
