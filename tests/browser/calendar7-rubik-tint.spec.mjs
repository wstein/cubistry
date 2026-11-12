// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";

// Rubik-Tint in the real Calendar7Viewer (WebGL, Chromium), names layout, window print: every texture carries the ground of its
// home face (the face of the identity pose), the print is black, the month band is black; a change to another scheme and back
// rebuilds the cube per home face; a scheme chosen before the build is used by it.

test("textures carry the tint of the home face, black print and a black band; another scheme and back restores them", async ({ page }) => {
  test.setTimeout(240000); // software GL: building the 218-cubie scene three times is slow
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console.error: ${m.text()}`));
  await page.goto("/licenses.html");
  const r = await page.evaluate(async () => {
    const face = new FontFace("Counter Sans", "url(/fonts/noto-sans-latin-600.woff2)", { weight: "600" });
    document.fonts.add(await face.load());
    await document.fonts.load('600 80px "Counter Sans"');
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { parseState } = await import("/src/apps/calendar7/graph.ts");
    const { RUBIK_TINTS, homeFacesOf, weekendGroundOf } = await import("/src/apps/calendar7/home-tint.ts");
    const { namesGround } = await import("/src/apps/calendar7/schemes.ts");
    const { printing, pose } = parseState(await (await fetch("/calendar7/names/state.v1.json")).json());
    const host = document.createElement("div"), panel = document.createElement("div");
    host.style.cssText = "width:480px;height:480px;position:fixed;left:0;top:0";
    document.body.append(host, panel);
    const viewer = new Calendar7Viewer(host, panel);
    viewer.setScheme("rubik-tint");
    viewer.setHomePose(pose);
    viewer.configure(printing, pose, "face", "names");
    const homes = homeFacesOf(pose);
    const hex = (d, x, y, w) => "#" + [0, 1, 2].map((k) => d[(y * w + x) * 4 + k].toString(16).padStart(2, "0")).join("");
    const survey = () => {
      const stickers = new Map();
      viewer.presentation.traverse((o) => { if (o.userData.stickerId !== undefined) stickers.set(o.userData.stickerId, o); });
      let wrongGround = 0, weekendGround = 0, black = 0, bandBlack = 0, bands = 0, textures = new Set();
      for (let i = 0; i < 294; i++) {
        const c = stickers.get(i + 1).material.map.image;
        textures.add(c);
        const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
        const corner = hex(d, 3, 3, c.width), tint = namesGround(RUBIK_TINTS[homes[i]]), weekend = namesGround(weekendGroundOf(RUBIK_TINTS[homes[i]]));
        // A weekend (red class) tile is the darker ground on its unit cell; the margin of a thick outer tile stays the tint.
        if (printing.ink[i] === "red") { if (corner === weekend) weekendGround++; else if (corner !== tint) wrongGround++; } else if (corner !== tint) wrongGround++;
        let has = false;
        for (let k = 0; k < d.length; k += 4) if (d[k] === 0x11 && d[k + 1] === 0x11 && d[k + 2] === 0x11) { has = true; break; }
        if (printing.text[i] !== "" && has) black++;
        if (printing.ink[i] === "month") { bands++; if (has) bandBlack++; }
      }
      return { wrongGround, weekendGround, black, texts: printing.text.filter((t) => t !== "").length, bands, bandBlack, textures: textures.size };
    };
    const first = survey();
    viewer.setScheme("paper-red");
    const other = survey();
    viewer.setScheme("rubik-tint");
    const back = survey();
    return { first, other, back, homes: [...new Set(homes)].length };
  });
  expect(errors).toEqual([]);
  expect(r.homes).toBe(6);
  for (const s of [r.first, r.back]) {
    expect(s.wrongGround).toBe(0);
    expect(s.weekendGround).toBeGreaterThan(5); // weekend tiles carry the darker ground
    expect(s.black).toBe(s.texts); // every printed tile has black pixels (the print, or the black band)
    expect(s.bands).toBeGreaterThan(0);
    expect(s.bandBlack).toBe(s.bands);
  }
  expect(r.other.weekendGround).toBe(0);
  expect(r.other.wrongGround).toBeGreaterThan(0); // Paper Red has no tint of the home face
  expect(r.first.textures).toBeGreaterThan(r.other.textures); // one texture per home face only while the tints are in use
  expect(r.back.textures).toBe(r.first.textures);
});
