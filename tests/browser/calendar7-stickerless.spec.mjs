import { test, expect } from "@playwright/test";

// The real Calendar7Viewer (WebGL, Chromium) on a hand-made layout fixture (tests/calendar7-fixture.mjs, not research data):
// the default surface keeps 294 sticker bodies; the "face" surface draws no sticker body and puts the label on the 218
// cubie faces, and the face art is the sticker art at the flat part of the face (ratio FACE_SCALE) with real Noto Sans.

test("stickerless surface: no sticker bodies, labels on the cubie faces, same art at the flat-face scale", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console.error: ${m.text()}`));
  await page.goto("/licenses.html");
  const r = await page.evaluate(async () => {
    const face = new FontFace("Counter Sans", "url(/fonts/noto-sans-latin-600.woff2)", { weight: "600" });
    document.fonts.add(await face.load());
    await document.fonts.load('600 80px "Counter Sans"');
    const { Calendar7Viewer } = await import("/src/apps/calendar7/viewer.ts");
    const { FACE_FLAT, FACE_SCALE } = await import("/src/apps/calendar7/sticker-art.ts");
    const { layoutFixture } = await import("/tests/calendar7-fixture.mjs");
    const { printing, pose } = layoutFixture();
    const host = document.createElement("div");
    host.style.cssText = "width:480px;height:480px;position:fixed;left:0;top:0";
    document.body.append(host);
    const panel = document.createElement("div");
    document.body.append(panel);
    const viewer = new Calendar7Viewer(host, panel);
    const mon = printing.text.indexOf("MON") + 1;
    const inkWidth = (canvas) => {
      const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = canvas.width, x1 = -1, y0 = canvas.height, y1 = -1;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          // Ink is much darker than the paper (#fffdf6) and the blank paper.
          if (d[i] + d[i + 1] + d[i + 2] < 450) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
        }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    const inspect = () => {
      const stickers = [], shells = [];
      viewer.presentation.traverse((o) => {
        if (o.userData.stickerId !== undefined) stickers.push(o);
        if (o.userData.sourceFaceStickerIds) shells.push(o);
      });
      const monSticker = stickers.find((s) => s.userData.stickerId === mon);
      const shell = shells.find((s) => s.userData.sourceFaceStickerIds.includes(mon));
      const material = Array.isArray(shell.material) ? shell.material[shell.userData.sourceFaceStickerIds.indexOf(mon)] : null;
      return {
        stickers: stickers.length,
        visible: stickers.filter((s) => s.visible).length,
        shells: shells.length,
        shellArrays: shells.filter((s) => Array.isArray(s.material)).length,
        faceHasMap: !!material?.map && material.map === monSticker.material.map,
        mon: inkWidth(monSticker.material.map.image),
      };
    };
    viewer.configure(printing, pose);
    const sticker = inspect();
    viewer.configure(printing, pose, "face");
    const faceMode = inspect();
    viewer.configure(printing, pose, "sticker");
    const again = inspect();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    viewer.destroy();
    return { sticker, faceMode, again, FACE_FLAT, FACE_SCALE };
  });
  expect(errors).toEqual([]);
  // Default and explicit "sticker": 294 sticker bodies on 218 bodies, as before.
  for (const s of [r.sticker, r.again]) {
    expect(s.stickers).toBe(294);
    expect(s.visible).toBe(294);
    expect(s.shells).toBe(218);
    expect(s.shellArrays).toBe(0);
  }
  // "face": the sticker meshes stay in the graph but are not drawn; the cubie faces carry the label textures.
  expect(r.faceMode.visible).toBe(0);
  expect(r.faceMode.shells).toBe(218);
  expect(r.faceMode.shellArrays).toBe(218);
  expect(r.faceMode.faceHasMap).toBe(true);
  // MON in real Noto Sans: the face art is the sticker art scaled by FACE_SCALE, centered on the texture.
  expect(r.sticker.mon.w).toBeGreaterThan(40);
  const ratio = r.faceMode.mon.w / r.sticker.mon.w;
  expect(Math.abs(ratio - r.FACE_SCALE), `ink width ratio ${ratio}`).toBeLessThan(0.03);
  expect(Math.abs(r.faceMode.mon.cx - 96)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(r.faceMode.mon.cy - 96)).toBeLessThanOrEqual(4); // MON is not digits: same middle-baseline drift as on the sticker, scaled
  // The label stays inside the flat part of the face (no ink on the bevel).
  expect(r.faceMode.mon.w).toBeLessThan(192 * r.FACE_FLAT * 0.92 + 2);
});

// Margins of the real ink to the edge of the flat face (the part before the bevel), as a share of the flat width.
const MIN_MARGIN = 0.04;
test("stickerless labels of 1 to 3 letters, two digits and split labels keep 4% of the flat face clear on every side", async ({ page }) => {
  await page.goto("/licenses.html");
  const r = await page.evaluate(async () => {
    const face = new FontFace("Counter Sans", "url(/fonts/noto-sans-latin-600.woff2)", { weight: "600" });
    document.fonts.add(await face.load());
    await document.fonts.load('600 80px "Counter Sans"');
    const { drawFace, FACE_FLAT, TEXTURE } = await import("/src/apps/calendar7/sticker-art.ts");
    const lo = (TEXTURE * (1 - FACE_FLAT)) / 2, flat = TEXTURE * FACE_FLAT;
    const out = {};
    for (const t of ["M", "NO", "VEM", "BER", "EMB", "MON", "WED", "SUN", "SEP", "WWW", "7", "28", "10", "6", "9", "23/30", "24/31"]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = TEXTURE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const proxy = new Proxy(ctx, {
        get(target, key) {
          if (key === "fillRect") return () => {};
          const v = target[key];
          return typeof v === "function" ? v.bind(target) : v;
        },
        set(target, key, value) {
          target[key] = value;
          return true;
        },
      });
      drawFace(proxy, t, "dark", "strict");
      const d = ctx.getImageData(0, 0, TEXTURE, TEXTURE).data;
      let x0 = TEXTURE, y0 = TEXTURE, x1 = -1, y1 = -1;
      for (let y = 0; y < TEXTURE; y++)
        for (let x = 0; x < TEXTURE; x++)
          if (d[(y * TEXTURE + x) * 4 + 3] > 127) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
      out[t] = [x0 - lo, lo + flat - x1, y0 - lo, lo + flat - y1].map((v) => v / flat);
    }
    return out;
  });
  for (const [t, sides] of Object.entries(r)) for (const m of sides) expect(m, `${t} margins ${sides.map((v) => v.toFixed(3))}`).toBeGreaterThanOrEqual(MIN_MARGIN);
});
