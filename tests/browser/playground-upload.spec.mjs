import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";

// Small generated pictures: an asymmetric pattern per face, so every sticker has detail.
const FACES = ["F", "B", "L", "R", "U", "D"];
const HUES = { F: [220, 40, 40], B: [40, 200, 60], L: [50, 60, 230], R: [235, 200, 30], U: [200, 60, 200], D: [30, 190, 200] };
const pngOf = (w, h, paint) => {
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) p.data.set([...paint(x, y), 255], (y * w + x) * 4);
  return PNG.sync.write(p);
};
const pattern = (rgb, w, h) => (x, y) => {
  const stripe = (x * 3 + y) % 37 < 6,
    corner = x < w / 5 && y < h / 3;
  return corner ? [0, 0, 0] : stripe ? rgb.map((c) => 255 - c) : rgb.map((c, i) => (c + ((x * (i + 2)) ^ y)) % 256);
};
const faceFile = (f, size = 200) => ({ name: `${f}.png`, mimeType: "image/png", buffer: pngOf(size, size, pattern(HUES[f], size, size)) });
const six = (size) => FACES.map((f) => faceFile(f, size));
// A cross net: every cell filled with its face's flat color (center mark makes the order checkable).
const CELLS = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
const netFile = (cell = 100, name = "net.png") => ({
  name,
  mimeType: "image/png",
  buffer: pngOf(cell * 4, cell * 3, (x, y) => {
    const c = Math.floor(x / cell), r = Math.floor(y / cell);
    const f = Object.keys(CELLS).find((k) => CELLS[k][0] === c && CELLS[k][1] === r);
    return f ? pattern(HUES[f], cell, cell)(x % cell, y % cell) : [255, 255, 255];
  }),
});

// Every upload is decoded, sanitized and measured in the page. On the CI runners (software GL, shared CPU)
// a step takes 4 to 9 times its local time (run 42297733991: 3.7 s against 0.8 s, 31 s against 4.6 s), so
// the waits for a finished upload use a 30 s CI-load bound (runners are much slower than local), not a product
// limit from pictures.ts or upload-browser.ts, and a test gets the slow limit (3 x 30 s) like the timing group.
const UPLOAD_MS = 30000;
test.beforeEach(() => {
  test.slow();
});

const open = async (page) => {
  await page.goto("/playground.html");
  await expect(page.locator("#cube")).toHaveAttribute("data-ready", "true");
  await page.locator("#pictures > summary").click();
};
const loaded = async (page) => {
  await expect(page.locator("#cube")).toHaveAttribute("data-style", "upload", { timeout: 30000 });
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
};
// The average color of a slot preview, read back through a canvas.
const slotColor = (page, face) =>
  page.evaluate(async (f) => {
    const img = document.querySelector(`#upload-net [data-face="${f}"] img`);
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, face);

test("six PNG files named by face load as a new design and can be played", async ({ page }) => {
  const errors = [], requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await open(page);
  await expect(page.locator('#design option[value="upload"]')).toHaveJSProperty("disabled", true);
  const before = requests.length;
  await page.locator("#upload-input").setInputFiles(six());
  await loaded(page);
  await expect(page.locator("#upload-status")).toContainText("All six faces are ready", { timeout: UPLOAD_MS });
  await expect(page.locator("#design")).toHaveValue("upload");
  await expect(page.locator('#design option[value="upload"]')).toHaveJSProperty("disabled", false);
  for (const f of FACES) await expect(page.locator(`#upload-net [data-face="${f}"]`)).toHaveAttribute("data-filled", "true");
  await page.locator("#notation").fill("R U");
  await page.locator("#notation").press("Enter");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#cube")).toHaveAttribute("data-cursor", "2");
  // Nothing was sent anywhere: no request after the upload left this page's origin.
  const after = requests.slice(before).filter((u) => !u.startsWith("blob:") && !u.startsWith("data:"));
  expect(after.filter((u) => !u.startsWith("http://127.0.0.1"))).toEqual([]);
  expect(errors).toEqual([]);
  // Removing the pictures returns to a built-in design.
  await page.locator("#upload-clear").click();
  await expect(page.locator("#design")).toHaveValue("picture");
  await expect(page.locator("#cube")).toHaveAttribute("data-style", "picture");
  await expect(page.locator('#design option[value="upload"]')).toHaveJSProperty("disabled", true);
});

test("one net image in the cross layout is cut into the six faces", async ({ page }) => {
  await open(page);
  await page.locator("#upload-input").setInputFiles(netFile());
  await loaded(page);
  await expect(page.locator("#upload-status")).toContainText("All six faces are ready", { timeout: UPLOAD_MS });
  // Each slot holds its own cell of the net (checked through the preview colors).
  for (const f of FACES) {
    const [r, g, b] = await slotColor(page, f), [er, eg, eb] = HUES[f];
    const near = (a, e) => Math.abs(a - e) < 120;
    expect([f, near(r, er) || near(g, eg) || near(b, eb)]).toEqual([f, true]);
  }
  const colors = await Promise.all(FACES.map((f) => slotColor(page, f)));
  expect(new Set(colors.map((c) => c.join())).size).toBe(6);
});

test("a net that is not 4:3 falls back to the six slots without changing the design", async ({ page }) => {
  await open(page);
  const odd = { name: "odd.png", mimeType: "image/png", buffer: pngOf(300, 300, () => [10, 20, 30]) };
  await page.locator("#upload-input").setInputFiles(odd);
  await expect(page.locator("#upload-status")).toContainText("not a 4:3 cross", { timeout: UPLOAD_MS });
  await expect(page.locator("#cube")).toHaveAttribute("data-style", "picture");
  await expect(page.locator('#upload-net [data-face="U"]')).toBeFocused();
});

test("faces can be filled one at a time by drag and drop and by the keyboard", async ({ page }) => {
  await open(page);
  // keyboard: a slot opens the file chooser
  await page.locator('#upload-net [data-face="F"]').focus();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(faceFile("F"));
  await expect(page.locator("#upload-status")).toContainText("1 of 6 faces ready", { timeout: UPLOAD_MS });
  // drop on slots
  for (const f of FACES.filter((x) => x !== "F")) {
    const file = faceFile(f);
    await page.evaluate(
      ({ f, name, type, data }) => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(data)], name === `${f}.png` ? "photo.png" : name, { type })); // the name does not matter on a slot
        document.querySelector(`#upload-net [data-face="${f}"]`).dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
      },
      { f, name: file.name, type: file.mimeType, data: [...file.buffer] },
    );
    await expect(page.locator(`#upload-net [data-face="${f}"]`)).toHaveAttribute("data-filled", "true", { timeout: UPLOAD_MS });
  }
  await loaded(page);
});

test("untrusted files are refused with a reason and never change the design", async ({ page }) => {
  await open(page);
  const input = page.locator("#upload-input");
  const svg = (inner) => ({ name: "F.svg", mimeType: "image/svg+xml", buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`) });
  for (const [file, reason] of [
    [svg("<script>alert(1)</script>"), /rejected/],
    [svg('<foreignObject width="1" height="1"><iframe src="https://evil.example"/></foreignObject>'), /rejected/],
    [svg('<image href="https://evil.example/x.png" width="1" height="1"/>'), /rejected/],
    [{ name: "F.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") }, /neither a PNG nor an SVG/],
    [{ name: "F.png", mimeType: "image/png", buffer: pngOf(4097, 1, () => [0, 0, 0]) }, /at most 4096/],
    [{ name: "F.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }, /larger than 5 MB/],
    [{ name: "F.png", mimeType: "image/png", buffer: pngOf(30, 20, () => [0, 0, 0]) }, /must be square/],
  ]) {
    await input.setInputFiles(file);
    await expect(page.locator("#upload-status")).toContainText(reason, { timeout: UPLOAD_MS });
    await expect(page.locator("#upload-status")).toHaveAttribute("data-tone", "error");
    await expect(page.locator('#upload-net [data-face="F"]')).toHaveAttribute("data-filled", "false");
  }
  await input.setInputFiles(Array.from({ length: 7 }, (_, i) => faceFile("F", 8)).map((f, i) => ({ ...f, name: `${i}.png` })));
  await expect(page.locator("#upload-status")).toContainText("not 7 files", { timeout: UPLOAD_MS });
  await expect(page.locator("#cube")).toHaveAttribute("data-style", "picture");
  await expect(page.locator("#upload-status")).toHaveAttribute("data-tone", "error");
});

test("SVG faces: sanitized, loaded, and active content in them is gone", async ({ page }) => {
  await open(page);
  const files = FACES.map((f, i) => ({
    name: `${f.toLowerCase()}.svg`,
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="rgb(${HUES[f]})" onclick="window.__pwned=1"/><circle cx="${20 + i * 10}" cy="30" r="12" fill="#fff"/><path d="M10 90L90 60" stroke="#000" stroke-width="5"/><metadata>x</metadata></svg>`,
    ),
  }));
  await page.locator("#upload-input").setInputFiles(files);
  await loaded(page);
  await expect(page.locator("#upload-resolution")).toContainText("SVG faces scale without limit");
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  // the kept preview is the sanitizer's output, shown as an image, never inlined
  expect(await page.locator("#upload-net svg").count()).toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll("script:not([src])").length)).toBeLessThanOrEqual(1);
});

test("resolution hint warns about small PNG faces for the chosen cube size", async ({ page }) => {
  await open(page);
  await page.locator("#upload-input").setInputFiles(six(120));
  await loaded(page);
  await page.locator("#picture-size").selectOption("2");
  await expect(page.locator("#upload-resolution")).toContainText("Too small");
  await page.locator("#picture-size").selectOption("7");
  await expect(page.locator("#upload-resolution")).toContainText("at least 700 px per face");
  await expect(page.locator("#upload-resolution")).toContainText("F is 120 px");
  await expect(page.locator("#upload-resolution")).toHaveAttribute("data-tone", "warn");
  await page.locator("#picture-size").selectOption("3");
  await page.locator("#upload-clear").click();
  await expect(page.locator("#upload-resolution")).toContainText("200 px for 2×2 up to 700 px for 7×7");
});

test("suitability display: built-in set at N=2 and N=5, and an uploaded set", async ({ page }) => {
  test.slow();
  await open(page);
  await page.locator("#design").selectOption("seasons");
  // Loading a picture set takes a while under software GL: wait for the condition, not for a time.
  await expect(page.locator("#cube")).toHaveAttribute("data-style", "seasons", { timeout: 60000 });
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
  await expect(page.locator("#fit")).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
  await expect(page.locator("#fit-summary")).toContainText(/Good fit\. 0 stickers flat, 0 identical groups, 0 rotation-ambiguous/, { timeout: UPLOAD_MS });
  await expect(page.locator("#fit")).toHaveAttribute("data-light", "green");
  await expect(page.locator("#fit-note")).not.toContainText("not playable");
  await page.locator("#picture-size").selectOption("5");
  await expect(page.locator("#fit-summary")).toContainText(/\d+ stickers? flat, \d+ identical groups?, \d+ rotation-ambiguous/, { timeout: UPLOAD_MS });
  await expect(page.locator("#fit-note")).toContainText("not playable yet");
  await expect(page.locator("#fit-note")).toContainText("2×2 only");
  expect(await page.locator("#fit-thumbs li canvas").count()).toBeGreaterThan(0);
  // The kinds are visible text and a full sentence for screen readers, not a tooltip.
  await expect(page.locator("#fit-thumbs li .marks").first()).not.toBeEmpty();
  await expect(page.locator("#fit-thumbs li .sr-only").first()).toContainText(/Face \w, row \d, column \d: /);
  await expect(page.locator("#fit-symmetry")).toContainText(/Rotation symmetry of the detailed stickers: \d+ none, \d+ 2-fold, \d+ 4-fold/, { timeout: UPLOAD_MS });
  // one live region for the whole panel
  await expect(page.locator("#pictures [role=status]")).toHaveCount(1);
  // advice never blocks: the puzzle can still be played at N=5 in the display
  await expect(page.locator("#design")).toBeEnabled();
  // An uploaded set made of flat faces is a poor fit and shows thumbnails of its stickers.
  await page.locator("#picture-size").selectOption("2");
  const flat = FACES.map((f) => ({ name: `${f}.png`, mimeType: "image/png", buffer: pngOf(200, 200, () => HUES[f]) }));
  await page.locator("#upload-input").setInputFiles(flat);
  await loaded(page);
  await expect(page.locator("#fit")).toHaveAttribute("data-light", "red", { timeout: 30000 });
  await expect(page.locator("#fit-summary")).toContainText("24 stickers flat, 6 identical groups", { timeout: UPLOAD_MS });
  await expect(page.locator("#fit-thumbs li canvas")).toHaveCount(24);
});

test("the blank net template downloads as PNG and SVG for the chosen size", async ({ page }) => {
  await open(page);
  await page.locator("#picture-size").selectOption("3");
  await expect(page.locator("#template-note")).toContainText("1200 × 900 px");
  const png = page.waitForEvent("download");
  await page.locator("#template-png").click();
  const dl = await png;
  expect(dl.suggestedFilename()).toBe("cubistry-net-template-3x3.png");
  const bytes = await (await import("node:fs/promises")).readFile(await dl.path());
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 900]);
  const svgDownload = page.waitForEvent("download");
  await page.locator("#template-svg").click();
  const svgFile = await svgDownload;
  expect(svgFile.suggestedFilename()).toBe("cubistry-net-template-3x3.svg");
  const text = (await (await import("node:fs/promises")).readFile(await svgFile.path())).toString();
  for (const f of ["U", "L", "F", "R", "B", "D"]) expect(text).toContain(`>${f}</text>`);
  expect(text).not.toMatch(/<script|onload|href=/);
  // The template round-trips: uploading the PNG as a net gives a (flat, therefore poor) design.
  await page.locator("#upload-input").setInputFiles({ name: "t.png", mimeType: "image/png", buffer: bytes });
  await loaded(page);
});

test("faces of 1024 px load at size 2 and are measured at size 5 within the shared pixel budget", async ({ page }) => {
  test.slow();
  await open(page);
  const big = FACES.map((f) => faceFile(f, 1024));
  await page.locator("#upload-input").setInputFiles(big);
  await loaded(page);
  await expect(page.locator("#upload-status")).toContainText("All six faces are ready", { timeout: UPLOAD_MS });
  await expect(page.locator("#upload-resolution")).toContainText("large enough");
  await page.locator("#picture-size").selectOption("5");
  await expect(page.locator("#fit-summary")).toContainText(/stickers? flat, \d+ identical groups?, \d+ rotation-ambiguous/, { timeout: 60000 });
  await page.locator("#picture-size").selectOption("7");
  await expect(page.locator("#fit-summary")).toContainText(/stickers? flat/, { timeout: 60000 });
  await expect(page.locator("#fit-summary")).not.toContainText("could not be measured");
});

test("a failed load is reported, changes nothing and leaves nothing selectable", async ({ page }) => {
  await open(page);
  // Passes the upload checks (1.4 MB), but cleaning escapes the text and every face grows past 5 MB.
  const filler = "&gt;".repeat(350000);
  const huge = { name: "net.svg", mimeType: "image/svg+xml", buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><text x="1" y="1">${filler}</text></svg>`) };
  expect(huge.buffer.length).toBeLessThan(5 * 1024 * 1024);
  await page.locator("#upload-input").setInputFiles(huge);
  await expect(page.locator("#upload-status")).toContainText(/too large|could not be loaded|rejected/, { timeout: 30000 });
  await expect(page.locator("#upload-status")).toHaveAttribute("data-tone", "error");
  await expect(page.locator('#design option[value="upload"]')).toHaveJSProperty("disabled", true);
  await expect(page.locator("#design")).toHaveValue("picture");
  for (const f of FACES) await expect(page.locator(`#upload-net [data-face="${f}"]`)).toHaveAttribute("data-filled", "false");
});

test("replacing pictures is atomic, and removing them is queued behind a running upload", async ({ page }) => {
  await open(page);
  await page.locator("#upload-input").setInputFiles(six());
  await loaded(page);
  const before = await page.locator('#upload-net [data-face="F"] img').getAttribute("src");
  // One good new face and one bad file: nothing is replaced.
  await page.locator("#upload-input").setInputFiles([faceFile("F", 150), { name: "B.png", mimeType: "image/png", buffer: Buffer.from("not an image") }]);
  await expect(page.locator("#upload-status")).toHaveAttribute("data-tone", "error", { timeout: UPLOAD_MS });
  expect(await page.locator('#upload-net [data-face="F"] img').getAttribute("src")).toBe(before);
  // Remove right behind a new upload: the removal runs last and wins.
  await page.locator("#upload-input").setInputFiles(six(160));
  await page.locator("#upload-clear").click();
  await expect(page.locator("#upload-status")).toContainText("Your pictures were removed", { timeout: 30000 });
  await expect(page.locator("#design")).toHaveValue("picture");
  for (const f of FACES) await expect(page.locator(`#upload-net [data-face="${f}"]`)).toHaveAttribute("data-filled", "false");
});

test("hostile SVG is refused quickly (worker), with the file name in the message", async ({ page }) => {
  await open(page);
  const slow = { name: "F.svg", mimeType: "image/svg+xml", buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g transform="scale(1)${" ".repeat(80)}!"/></svg>`) };
  const start = Date.now();
  await page.locator("#upload-input").setInputFiles(slow);
  await expect(page.locator("#upload-status")).toContainText("F.svg was rejected", { timeout: UPLOAD_MS });
  expect(Date.now() - start).toBeLessThan(6000);
  const flat = { name: "F.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 10"/>') };
  await page.locator("#upload-input").setInputFiles(flat);
  await expect(page.locator("#upload-status")).toContainText("F.svg was rejected: Invalid viewBox", { timeout: UPLOAD_MS });
  // a net with fractional user units is cut exactly: every face gets its own cell
  const cell = (c, r, color) => `<rect x="${c * 1.2}" y="${r * 1.2}" width="1.2" height="1.2" fill="${color}"/>`;
  const net = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.8 3.6">${cell(1, 0, "#e00")}${cell(0, 1, "#0a0")}${cell(1, 1, "#00e")}${cell(2, 1, "#ee0")}${cell(3, 1, "#0ee")}${cell(1, 2, "#e0e")}</svg>`;
  await page.locator("#upload-input").setInputFiles({ name: "fraction.svg", mimeType: "image/svg+xml", buffer: Buffer.from(net) });
  await loaded(page);
  const want = { U: [238, 0, 0], L: [0, 170, 0], F: [0, 0, 238], R: [238, 238, 0], B: [0, 238, 238], D: [238, 0, 238] };
  for (const f of FACES) {
    const [r, g, b] = await page.evaluate(async (f) => {
      const img = document.querySelector(`#upload-net [data-face="${f}"] img`);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, 64, 64);
      const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
      // corners and center all show this face's color (no neighbor bleeding)
      return [px(1, 1), px(62, 1), px(1, 62), px(62, 62), px(32, 32)].reduce((a, p) => a.map((v, i) => v + p[i] / 5), [0, 0, 0]);
    }, f);
    expect([f, Math.abs(r - want[f][0]) < 25, Math.abs(g - want[f][1]) < 25, Math.abs(b - want[f][2]) < 25]).toEqual([f, true, true, true]);
  }
});
