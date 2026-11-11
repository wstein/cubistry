// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 "Names layout" mode (research candidate, not certified): mode switch, notice outside the window, 390 px fit,
// band tile colors per scheme, class travel with the tiles after a scramble, URL round trip.
import { test, expect } from "@playwright/test";

const ROOT = "#calendar7-root";
const at = (page, month) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", month, { timeout: 30000 });
const row1 = (page) => page.locator(".c7-sheet tr:first-child td .c7-cell-text").allTextContents();
const NOTICE = "Display only: no move sequence for this date (print B).";

test("the layout control switches row 1 between the standard letters and the month name, and rebuilds the cube from the new print", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html?app=calendar7&year=2027&month=3");
  await at(page, "2027-03");
  const select = page.getByRole("combobox", { name: "Cube layout", exact: true });
  await expect(select).toHaveValue("standard");
  await expect(select.locator("option")).toHaveText(["Standard", "Names (preview, May 2026 - Jan 2028)"]);
  const standard = await row1(page);
  const digest = await page.locator(ROOT).getAttribute("data-c7-digest");
  await select.selectOption("names");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names", { timeout: 30000 });
  await expect(page.locator(ROOT)).not.toHaveAttribute("data-c7-digest", digest, { timeout: 30000 });
  await at(page, "2027-03");
  expect(await row1(page)).toEqual(["MA", "RCH", "", "", "", "", ""]);
  await expect(page.locator(".c7-sheet tr:first-child td.c7-ink-band")).toHaveCount(5);
  await expect(page.locator(".c7-layout-notice")).toBeHidden();
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "idle");
  await select.selectOption("standard");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "standard", { timeout: 30000 });
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", digest, { timeout: 30000 });
  expect(await row1(page)).toEqual(standard);
  expect(errors).toEqual([]);
});

test("outside the window the names layout shows the month from print B, display only, with the notice and no standard fallback; stepping into the window shows the chain", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html?app=calendar7&year=2030&month=5&layout=names");
  await at(page, "2030-05");
  const notice = page.getByRole("status").filter({ hasText: NOTICE });
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(NOTICE);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout-mode", "names");
  await expect(page.getByRole("combobox", { name: "Cube layout", exact: true })).toHaveValue("names");
  expect(await row1(page)).toEqual(["MA", "Y", "", "", "", "", ""]);
  // The date form moves into the window: January 2028 is on the chain (names layout, Previous and Next, no notice).
  await page.getByLabel("Year").fill("2028");
  await page.getByLabel("Month").selectOption("1");
  await page.getByRole("button", { name: "Show" }).click();
  await at(page, "2028-01");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "off", { timeout: 30000 });
  await expect(notice).toBeHidden();
  expect(await row1(page)).toEqual(["J", "ANU", "ARY", "", "", "", ""]);
  expect(errors).toEqual([]);
});

for (const width of [320, 360, 390]) test(`the three appearance selects share one touch-sized row at ${width} px and keep their names`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/index.html?app=calendar7&year=2026&month=11");
  await at(page, "2026-11");
  const boxes = [];
  for (const name of ["Font style", "Cube layout", "Cube color theme"]) boxes.push(await page.getByRole("combobox", { name, exact: true }).boundingBox());
  for (const b of boxes) {
    expect(Math.abs(b.y - boxes[0].y), "same row").toBeLessThan(1);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if (width === 390) {
    await page.getByRole("combobox", { name: "Cube layout", exact: true }).selectOption("names");
    await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names", { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: process.env.NAMES_SHOT ?? test.info().outputPath("names-390.png") });
  }
});

// ---- artwork: the real viewer with the window print ----
async function bandProbe(page, scheme, scramble) {
  await page.goto("/licenses.html");
  return page.evaluate(async ({ scheme, scramble }) => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { loadCalendarFont } = await import("/src/apps/calendar7/fonts.ts");
    const { parseState, parseGraph } = await import("/src/apps/calendar7/graph.ts");
    const { applyMoves } = await import("/src/apps/calendar7/engine.ts");
    const { schemeById } = await import("/src/apps/calendar7/schemes.ts");
    const { tileClass, tileRoles } = await import("/src/apps/calendar7/sticker-art.ts");
    const { faceFlatShare } = await import("/src/apps/calendar7/geometry.ts");
    const get = async (p) => (await fetch(p)).json();
    const { printing, pose } = parseState(await get("/calendar7/names/state.v1.json"));
    const graph = parseGraph(await get("/calendar7/names/graph.v1.json"));
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:480px;height:480px";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.setFont(await loadCalendarFont("noto", "/"));
    viewer.setScheme(scheme);
    viewer.configure(printing, pose, "face", "names");
    let shown = pose;
    if (scramble) {
      for (let k = 0; k < 4; k++) shown = applyMoves(shown, graph.edges[k].moves);
      viewer.show(shown);
    }
    const moved = [...printing.ink].filter((ink, i) => ink === "band" && [0, 1, 2].some((a) => shown.pos[3 * i + a] !== pose.pos[3 * i + a])).length;
    const sch = schemeById(scheme);
    const hex = (d) => "#" + [...d].slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
    const rows = [];
    viewer.presentation.traverse((o) => {
      const ids = o.userData.sourceFaceStickerIds;
      if (!ids || !Array.isArray(o.material)) return;
      ids.forEach((id, face) => {
        if (id === null) return;
        const canvas = o.material[face].map.image, ctx = canvas.getContext("2d");
        const i = id - 1, cls = tileClass(printing.text[i], printing.ink[i]);
        const roles = tileRoles(sch, printing.text[i], printing.ink[i], "names");
        // Unit grid: the fill covers the unit cell (a blank tile) or the banner (month row), the rest of the tile is the white margin;
        // the share of the fill color and the number of line pixels are counted on a 4 px grid of the whole canvas.
        const W = canvas.width, H = canvas.height, data = ctx.getImageData(0, 0, W, H).data, count = (want) => {
          let n = 0, all = 0;
          for (let y = 2; y < H; y += 4) for (let x = 2; x < W; x += 4, all++) if (hex(data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)) === want) n++;
          return [n, all];
        };
        const [nf, all] = count(roles.fill), [nl] = roles.line ? count(roles.line.color) : [0];
        rows.push({ cls, text: printing.text[i], fillShare: Math.round(nf / all * 20) / 20, want: roles.fill, lines: nl > 0, lineWant: roles.line ? roles.line.color : null });
      });
    });
    viewer.destroy();
    return { rows, moved };
  }, { scheme, scramble });
}

for (const scheme of ["paper-red", "paper-blue", "dracula", "high-contrast"]) test(`${scheme}: band tiles take the band fill and the row 1 line, blank tiles the empty fill`, async ({ page }) => {
  const { rows } = await bandProbe(page, scheme, false);
  const W = "#fdfdfd"; // NAMES_WHITE: the names layout draws a neutral white ground as this token
  const sch = { "paper-red": { band: "#e0282c", empty: W, line: null }, "paper-blue": { band: W, empty: W, line: "#1558d8" }, dracula: { band: "#ff79c6", empty: "#1e1f29", line: null }, "high-contrast": { band: W, empty: "#2a2a2a", line: null } }[scheme];
  const by = (c) => rows.filter((r) => r.cls === c);
  expect(by("band")).toHaveLength(12);
  expect(by("month")).toHaveLength(24);
  expect(by("blank")).toHaveLength(32);
  for (const r of [...by("band"), ...by("month")]) { expect(r.want).toBe(sch.band); expect(r.lineWant).toBe(sch.line); expect(r.lines).toBe(sch.line !== null); }
  for (const r of by("blank")) { expect(r.want).toBe(sch.empty); expect(r.lines).toBe(false); }
  // The fill color covers at least a fifth of the canvas of every banner tile (the banner is 1.2 high of at most 1.8, minus the lettering); a white-fill scheme has the white ground as its fill.
  if (sch.band !== W) for (const r of [...by("band"), ...by("month")]) expect(r.fillShare, `${r.cls} ${r.text}`).toBeGreaterThanOrEqual(0.25);
  if (scheme === "paper-red") expect(by("band")[0].want).not.toBe(by("blank")[0].want);
});

test("after a scramble the band and month classes (fill and line) stay with their tiles, not with positions", async ({ page }) => {
  const plain = await bandProbe(page, "paper-blue", false);
  const scrambled = await bandProbe(page, "paper-blue", true);
  expect(scrambled.moved, "band stickers did move").toBeGreaterThan(0);
  const key = (rows) => rows.map((r) => `${r.cls}:${r.text}:${r.fillShare}:${r.lines}`).sort();
  expect(key(scrambled.rows)).toEqual(key(plain.rows));
  for (const r of scrambled.rows) {
    if (r.cls === "band" || r.cls === "month" || r.cls === "weekday") expect(r.lines, `${r.cls} ${r.text} line`).toBe(true);
    if (r.cls === "blank" || r.cls === "day") expect(r.lines, `${r.cls} ${r.text} no line`).toBe(false);
    if (r.cls === "band" || r.cls === "month" || r.cls === "blank") expect(r.fillShare, `${r.cls} ${r.text}`).toBeGreaterThan(0.2);
  }
});

test("the layout survives a reload through the URL and unknown values give the standard layout", async ({ page }) => {
  await page.goto("/index.html?app=calendar7&year=2027&month=3&extra=keep");
  await at(page, "2027-03");
  const select = page.getByRole("combobox", { name: "Cube layout", exact: true });
  await select.selectOption("names");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names", { timeout: 30000 });
  let query = new URL(page.url()).searchParams;
  expect(query.get("layout")).toBe("names");
  for (const [k, v] of [["year", "2027"], ["month", "3"], ["extra", "keep"]]) expect(query.get(k)).toBe(v);
  await page.reload();
  await at(page, "2027-03");
  await expect(select).toHaveValue("names");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "names", { timeout: 30000 });
  await select.selectOption("standard");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "standard", { timeout: 30000 });
  query = new URL(page.url()).searchParams;
  expect(query.get("layout")).toBe("standard");
  await page.goto("/index.html?app=calendar7&year=2027&month=3&layout=bogus");
  await at(page, "2027-03");
  await expect(select).toHaveValue("standard");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-layout", "standard");
});

test("the renderer uses Linear tone mapping at the face-following exposure in the names layout only and is the shared Neutral at 1 in the standard layout, also after switching back", async ({ page }) => {
  await page.goto("/licenses.html");
  const seen = await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const get = async (p) => (await fetch(p)).json();
    const names = parseState(await get("/calendar7/names/state.v1.json"));
    const standard = parseState(await get("/calendar7/state.v1.json"));
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:200px;height:200px";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.setPlasticity(0); // the flat look: the exposure is exactly the lights' (names-plasticity.ts adds a gain for the shading)
    const out = { fresh: viewer.renderer.toneMappingExposure, freshMap: viewer.renderer.toneMapping };
    viewer.configure(standard.printing, standard.pose, "face", "standard");
    out.standard = viewer.renderer.toneMappingExposure;
    out.standardMap = viewer.renderer.toneMapping;
    viewer.configure(names.printing, names.pose, "face", "names");
    out.names = viewer.renderer.toneMappingExposure;
    out.namesMap = viewer.renderer.toneMapping;
    viewer.presentation.rotation.set(0, 0, 0); // head on: pi / front face irradiance of the studio lights = 1.217
    viewer.syncExposure();
    out.namesHeadOn = viewer.renderer.toneMappingExposure;
    viewer.configure(standard.printing, standard.pose, "face", "standard");
    out.back = viewer.renderer.toneMappingExposure;
    out.backMap = viewer.renderer.toneMapping;
    viewer.destroy();
    return out;
  });
  const NEUTRAL = 7, LINEAR = 1; // THREE.NeutralToneMapping, THREE.LinearToneMapping
  expect(seen.names, "the turned start view lights the front face less than head on").toBeGreaterThan(seen.namesHeadOn + 0.1);
  expect(seen.namesHeadOn).toBeCloseTo(1.217, 2);
  expect({ ...seen, names: 0, namesHeadOn: 0 }).toEqual({ fresh: 1, freshMap: NEUTRAL, standard: 1, standardMap: NEUTRAL, names: 0, namesMap: LINEAR, namesHeadOn: 0, back: 1, backMap: NEUTRAL });
});

test("viewer wiring: names layout colors the cut faces per adjacent tile (flat colors and miter textures), the rest near-white, with thick outer layers (bodies, tiles, core, camera) and follows a scheme switch; the standard layout has none of it", async ({ page }) => {
  await page.goto("/licenses.html");
  const seen = await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const { NAMES_GAP } = await import("/src/apps/calendar7/geometry.ts");
    const get = async (p) => (await fetch(p)).json();
    const names = parseState(await get("/calendar7/names/state.v1.json"));
    const standard = parseState(await get("/calendar7/state.v1.json"));
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:200px;height:200px";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    const probe = () => {
      const cut = new Map(), widths = new Set(), canvases = new Set();
      let center = 0;
      const recv = new Set(), spec = new Set(), coat = new Set(), shadowLights = [];
      viewer.presentation.traverse((o) => {
        if (o.isMesh) { recv.add(o.receiveShadow); for (const m of [].concat(o.material)) if (m.isMeshPhysicalMaterial) { spec.add(m.specularIntensity); coat.add(Math.round(m.clearcoat * 1e6) / 1e6); } }
        const ids = o.userData.sourceFaceStickerIds;
        if (!ids || !Array.isArray(o.material)) return;
        o.geometry.computeBoundingBox();
        widths.add(Math.round((o.geometry.boundingBox.max.x - o.geometry.boundingBox.min.x) * 1e6) / 1e6);
        center = Math.max(center, Math.abs(o.parent.position.x), Math.abs(o.parent.position.y), Math.abs(o.parent.position.z));
        ids.forEach((id, i) => {
          if (id === null) { const k = o.material[i].map ? "mapped" : o.material[i].color.getHexString(); cut.set(k, (cut.get(k) ?? 0) + 1); }
          else { const im = o.material[i].map.image; canvases.add(im.width + "x" + im.height); }
        });
      });
      viewer.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) shadowLights.push(Math.round(o.shadow.intensity * 1e6) / 1e6); if (o.name === "studio-shadow-receiver") shadowLights.push("floor", Math.round(o.material.opacity * 1e6) / 1e6); });
      return { shade: { recv: [...recv], spec: [...spec].sort(), coat: [...coat].sort(), shadowLights }, cut: Object.fromEntries(cut), widths: [...widths].sort(), canvases: [...canvases].sort(), center: Math.round(center * 1e6) / 1e6, cameraZ: viewer.camera.position.z, core: viewer.presentation.children.find((c) => c.userData.plasticCore).scale.x };
    };
    viewer.configure(standard.printing, standard.pose, "face", "standard");
    const std = probe();
    viewer.configure(names.printing, names.pose, "face", "names");
    const red = probe();
    viewer.setPlasticity(0);
    const flat = probe();
    viewer.setPlasticity(0.9);
    const half = probe();
    viewer.setScheme("dracula");
    const dracula = probe();
    viewer.setScheme("paper-red");
    viewer.configure(standard.printing, standard.pose, "face", "standard");
    const back = probe();
    viewer.destroy();
    return { std, red, flat, half, dracula, back, gap: NAMES_GAP };
  });
  // Shading (names-plasticity.ts): the standard layout keeps the shared plastic (specular 1, clearcoat 0.18), faces that receive shadows and
  // the preset's shadow strength (key 1, shadow fill 0.55, floor opacity 0.3); the names layout has its own, plasticity 0 is flat.
  expect(seen.std.shade).toEqual({ recv: [true], spec: [1], coat: [0.12, 0.18], shadowLights: [1, 0.55, "floor", 0.3] });
  expect(seen.back.shade).toEqual(seen.std.shade); // switching back restores it
  expect(seen.red.shade).toEqual({ recv: [true], spec: [0.12], coat: [0.036], shadowLights: [0.6, 0.33, "floor", 0.5] }); // the default plasticity 0.6
  expect(seen.flat.shade).toEqual({ recv: [false], spec: [0], coat: [0], shadowLights: [0.3, 0.165, "floor", 1] });
  expect(seen.half.shade.recv).toEqual([true]);
  expect(seen.half.shade.spec[0]).toBeGreaterThan(seen.red.shade.spec[0]);
  expect(Object.keys(seen.std.cut)).toEqual(["ffffff"]); // standard: one body color, the raw day fill
  expect(seen.std.widths).toEqual([0.99]);
  // The layer-width profile is on in the names layout only: 1.8 outer layers (bodies 1.8 - gap and 1 - gap wide), centers up to 3.4, a larger core and camera.
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  expect(seen.red.widths).toEqual([r6(1 - seen.gap), r6(1.8 - seen.gap)]);
  expect(seen.std.center).toBe(3);
  expect(seen.red.center).toBe(3.4);
  expect(seen.std.canvases).toEqual(["192x192"]);
  expect(seen.red.canvases).toEqual(["192x192", "192x346", "346x192", "346x346"]);
  expect(seen.red.core / seen.std.core).toBeCloseTo(4.3 / 3.5, 6);
  expect(seen.red.cameraZ / seen.std.cameraZ).toBeCloseTo((4.3 + 0.001) / (3.5 + 0.001), 6); // framing follows the total edge (N - 2) + 2 f
  expect(seen.back.widths).toEqual([0.99]); // switching back restores the unit pitch, the textures and the framing
  expect(seen.back.center).toBe(3);
  expect(seen.back.canvases).toEqual(["192x192"]);
  expect(seen.back.cameraZ).toBeCloseTo(seen.std.cameraZ, 9);
  expect(Object.keys(seen.red.cut).sort()).toEqual(["fdeeee", "fdfdfd", "mapped"]); // weekend-tint and near-white sides (and body), miter textures (the red banner sides are edge-colored textures: red and white along one edge); no raw ffffff
  expect(seen.red.cut.mapped).toBeGreaterThan(0);
  expect(Object.keys(seen.dracula.cut)).not.toContain("e0282c"); // the cut colors follow the scheme switch
  expect(Object.keys(seen.dracula.cut)).toContain("282a36"); // the dracula ground (the band sides are edge-colored textures)
});

test("names layout: every face texture is the size of its own tile (192 px per unit of width and height), for all 294 faces; the standard layout has 192 x 192 everywhere", async ({ page }) => {
  await page.goto("/licenses.html");
  const seen = await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const { faceTileOf, layerWidthsFor } = await import("/src/apps/calendar7/geometry.ts");
    const { tileCanvasSize } = await import("/src/apps/calendar7/sticker-art.ts");
    const get = async (p) => (await fetch(p)).json();
    const names = parseState(await get("/calendar7/names/state.v1.json"));
    const standard = parseState(await get("/calendar7/state.v1.json"));
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:200px;height:200px";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    const check = (state, layout) => {
      viewer.configure(state.printing, state.pose, "face", layout);
      const byId = new Map();
      viewer.presentation.traverse((o) => {
        const ids = o.userData.sourceFaceStickerIds;
        if (!ids || !Array.isArray(o.material)) return;
        ids.forEach((id, face) => { if (id !== null) byId.set(id, o.material[face].map.image); });
      });
      let wrong = 0, kinds = new Set();
      for (const [id, image] of byId) {
        const i = id - 1, p = state.pose;
        const tile = layout === "names" ? faceTileOf(p.pos.subarray(3 * i, 3 * i + 3), p.normal.subarray(3 * i, 3 * i + 3), p.up.subarray(3 * i, 3 * i + 3), layerWidthsFor(7)) : undefined;
        const [W, H] = tileCanvasSize(tile);
        kinds.add(image.width + "x" + image.height);
        if (image.width !== W || image.height !== H) wrong++;
      }
      return { faces: byId.size, wrong, kinds: [...kinds].sort() };
    };
    const out = { names: check(names, "names"), standard: check(standard, "standard") };
    viewer.destroy();
    return out;
  });
  expect(seen.names.faces).toBe(294);
  expect(seen.names.wrong).toBe(0);
  expect(seen.names.kinds).toEqual(["192x192", "192x346", "346x192", "346x346"]);
  expect(seen.standard).toEqual({ faces: 294, wrong: 0, kinds: ["192x192"] });
});

test("turning the cube changes the names exposure through the render loop (no manual sync), the standard layout keeps 1", async ({ page }) => {
  await page.goto("/licenses.html");
  const seen = await page.evaluate(async () => {
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const get = async (p) => (await fetch(p)).json();
    const names = parseState(await get("/calendar7/names/state.v1.json"));
    const standard = parseState(await get("/calendar7/state.v1.json"));
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:200px;height:200px";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.setPlasticity(0); // the flat look: the exposure is exactly the lights' (names-plasticity.ts adds a gain for the shading)
    const frames = (n) => new Promise((done) => { const tick = () => (n-- > 0 ? requestAnimationFrame(tick) : done()); tick(); });
    // The smart rotation copies its own quaternion onto the presentation every frame: turn the cube through it, as a drag would.
    const turn = (pitch, yaw) => viewer.rotation.controller.quaternion.setFromEuler(new viewer.presentation.rotation.constructor(pitch, yaw, 0, "XYZ"));
    const out = {};
    viewer.configure(names.printing, names.pose, "face", "names");
    await frames(4);
    out.start = viewer.renderer.toneMappingExposure;
    turn(0, 0); // head on: the front face is lit more, the exposure falls
    await frames(4);
    out.headOn = viewer.renderer.toneMappingExposure;
    turn(0.9, -0.3);
    await frames(4);
    out.steep = viewer.renderer.toneMappingExposure;
    viewer.configure(standard.printing, standard.pose, "face", "standard");
    turn(0, 0);
    await frames(4);
    out.standard = viewer.renderer.toneMappingExposure;
    viewer.destroy();
    return out;
  });
  expect(seen.headOn).toBeCloseTo(1.217, 2);
  expect(seen.start).toBeGreaterThan(seen.headOn + 0.1);
  expect(Math.abs(seen.steep - seen.headOn)).toBeGreaterThan(0.05);
  expect(seen.standard).toBe(1);
});
