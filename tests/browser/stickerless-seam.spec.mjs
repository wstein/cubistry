import { test, expect } from "@playwright/test";
// Stickerless look (C): the picture continues across the seams. A line texture (red vertical lines, 1/64 of the face image
// apart) is projected on the stickerless 2x2, front view; the centroid of every line nearer than 0.2 pitch to the seam must
// lie where the perspective projection of the ideal cube puts it. Three's arc-length body UV shifted them by 2.4 px at 1200 px.
// Test hook: `window.__playgroundViewer` (browser-env.ts, the CubeViewer); the spec sets canvas size, view and the face textures.
const KEY = "cubistry-viewer-appearance-v1:/index.html";
// 400 px is left out: its two lines inside the bevel rim (under 2 px from the seam) have a detection bias of 0.7 px that the fix does not touch.
const SIZES = [800, 1200, 2000];

async function measure(page, size) {
  return await page.evaluate((size) => {
    const v = window.__playgroundViewer, N = 2, half = N / 2;
    v.renderer.setAnimationLoop(null);
    v.renderer.setPixelRatio(1); v.renderer.setSize(size, size, false);
    v.camera.aspect = 1; v.fitCamera();
    v.presentation.quaternion.identity(); v.presentation.updateMatrixWorld(true); v.camera.updateMatrixWorld(true);
    // Line textures of the face class of the page (one three instance).
    const Texture = v.pictureFaces.get("F").constructor;
    const S = 2048, P = S / 64, W = 6, c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, S, S); g.fillStyle = "#ff0000";
    for (let k = 0; k < 64; k++) g.fillRect(k * P + P / 2 - W / 2, 0, W, S);
    const texture = new Texture(c); texture.colorSpace = "srgb"; texture.anisotropy = 16; texture.needsUpdate = true;
    v.cube.setPictureProjection({ faces: new Map(["U", "R", "F", "D", "L", "B"].map((k) => [k, texture])) });
    v.renderer.render(v.scene, v.camera);
    const Vec = v.camera.position.constructor;
    const proj = (x, y, z) => { const q = new Vec(x, y, z); v.presentation.localToWorld(q); q.project(v.camera); return [(q.x * 0.5 + 0.5) * size, (1 - (q.y * 0.5 + 0.5)) * size]; };
    const pxPerPitch = proj(1, 0, half)[0] - proj(0, 0, half)[0], seam = proj(0, 0, half)[0], row = Math.round(proj(0, N / 4, half)[1]);
    const copy = document.createElement("canvas"); copy.width = copy.height = size;
    const cx = copy.getContext("2d"); cx.drawImage(v.renderer.domElement, 0, 0);
    const data = cx.getImageData(0, row, size, 1).data;
    const red = (x) => (data[x * 4 + 3] < 200 ? 0 : Math.max(0, data[x * 4] - Math.max(data[x * 4 + 1], data[x * 4 + 2]) - 40));
    const found = []; let x = 0;
    while (x < size) {
      if (red(x) > 0) { let s = 0, sx = 0; while (x < size && red(x) > 0) { s += red(x); sx += red(x) * x; x++; } found.push(sx / s + 0.5); } else x++;
    }
    const ideal = []; for (let k = 0; k < 64; k++) ideal.push(proj(((k + 0.5) / 64 - 0.5) * N, N / 4, half)[0]);
    const near = found.map((f) => { const e = ideal.reduce((a, b) => (Math.abs(b - f) < Math.abs(a - f) ? b : a)); return { dist: (e - seam) / pxPerPitch, delta: f - e }; })
      .filter((r) => Math.abs(r.dist) < 0.2);
    return { pxPerPitch, count: near.length, worst: Math.max(...near.map((r) => Math.abs(r.delta))) };
  }, size);
}

for (const size of SIZES) {
  test(`stickerless: the picture lines meet the ideal projection at the seam (${size} px canvas)`, async ({ page }) => {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ version: 1, frameColor: null, construction: "stickerless" })]);
    await page.goto("/index.html?app=playground");
    test.setTimeout(120000);
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
    await expect(page.locator("#playground-cube")).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
    const r = await measure(page, size);
    console.log(`seam ${size}px: ${r.count} lines near the seam, worst ${r.worst.toFixed(2)} px, ${r.pxPerPitch.toFixed(1)} px per pitch`);
    expect(r.count).toBeGreaterThanOrEqual(8);
    expect(r.worst).toBeLessThanOrEqual(0.5);
  });
}
