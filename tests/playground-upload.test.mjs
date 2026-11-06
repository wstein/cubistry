import test from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import {
  LOCAL_ASSET_LIMITS,
  LOCAL_ASSET_PREFIX,
  sanitizeSvg,
  sha256,
  validateAssets,
  verifyLocalSource,
} from "../packages/cube-assets/src/index.ts";
import {
  CROSS_CELLS,
  UPLOAD_LIMITS,
  assignFilesByName,
  buildUploadedFaceSet,
  checkSelection,
  crossRects,
  faceOfFileName,
  isCrossAspect,
  minFaceResolution,
  resolutionHint,
  sniffFormat,
  validatePngBytes,
} from "../src/apps/playground/upload.ts";
import { FACE_IDS, THEMES, sliceFaceSet } from "../src/apps/playground/themes.ts";
import { createDesign } from "../src/apps/playground/model.ts";

const png = (w, h, rgba = [255, 0, 0, 255]) => {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) p.data.set(rgba, i * 4);
  return new Uint8Array(PNG.sync.write(p));
};

test("file names F B L R U D (any case, png or svg) pick the face; nothing else does", () => {
  for (const [name, face] of [["F.png", "F"], ["b.PNG", "B"], ["L.svg", "L"], ["r.SVG", "R"], ["U.png", "U"], ["d.svg", "D"], [" F.png ", "F"]])
    assert.equal(faceOfFileName(name), face, name);
  for (const name of ["front.png", "FF.png", "F.jpg", "F.png.exe", "F", "x/F.png", ".png", "face-F.png", "F .png"])
    assert.equal(faceOfFileName(name), null, name);
});

test("assignFilesByName reports missing, unmatched and duplicate files", () => {
  const ok = assignFilesByName(["u.png", "D.svg", "F.png", "b.png", "L.PNG", "r.svg"]);
  assert.ok(ok.complete);
  assert.deepEqual(ok.byFace, { U: 0, D: 1, F: 2, B: 3, L: 4, R: 5 });
  const partial = assignFilesByName(["F.png", "notes.txt", "f.svg", "R.png"]);
  assert.ok(!partial.complete);
  assert.deepEqual(partial.unmatched, [1]);
  assert.deepEqual(partial.duplicates, ["F"]);
  assert.deepEqual(partial.missing, ["B", "L", "U", "D"].sort((a, b) => FACE_IDS.indexOf(a) - FACE_IDS.indexOf(b)));
  assert.equal(partial.byFace.F, 0);
});

test("selection limits: count, bytes per file and in total", () => {
  assert.doesNotThrow(() => checkSelection([{ name: "a.png", size: 1 }]));
  assert.throws(() => checkSelection([]), /at least one/);
  assert.throws(() => checkSelection(Array.from({ length: UPLOAD_LIMITS.files + 1 }, (_, i) => ({ name: `${i}.png`, size: 1 }))), /not 7 files/);
  assert.throws(() => checkSelection([{ name: "big.png", size: UPLOAD_LIMITS.fileBytes + 1 }]), /larger than 5 MB/);
  assert.throws(() => checkSelection([{ name: "e.png", size: 0 }]), /empty/);
  const each = UPLOAD_LIMITS.fileBytes;
  assert.throws(() => checkSelection(Array.from({ length: 5 }, (_, i) => ({ name: `${i}.png`, size: each }))), /together/);
  assert.equal(UPLOAD_LIMITS.totalBytes, 20 * 1024 * 1024);
});

test("PNG validation: signature, header, pixel dimensions", () => {
  assert.deepEqual([...validatePngBytes(png(7, 5))], [7, 5]);
  assert.deepEqual([...validatePngBytes(png(UPLOAD_LIMITS.pngSide, 1))], [UPLOAD_LIMITS.pngSide, 1]);
  assert.throws(() => validatePngBytes(png(UPLOAD_LIMITS.pngSide + 1, 1)), /at most 4096/);
  assert.throws(() => validatePngBytes(png(1, UPLOAD_LIMITS.pngSide + 1)), /at most 4096/);
  assert.throws(() => validatePngBytes(new Uint8Array(40)), /not a valid PNG/);
  assert.throws(() => validatePngBytes(new TextEncoder().encode("<svg/>".repeat(10))), /not a valid PNG/);
  const bad = png(4, 4);
  bad.set([0x58, 0x58, 0x58, 0x58], 12); // not IHDR
  assert.throws(() => validatePngBytes(bad), /not a valid PNG/);
  const zero = png(4, 4);
  zero.set([0, 0, 0, 0], 16);
  assert.throws(() => validatePngBytes(zero), /no pixels/);
});

test("content sniffing does not trust names", () => {
  assert.equal(sniffFormat(png(2, 2)), "png");
  assert.equal(sniffFormat(new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>')), "svg");
  assert.equal(sniffFormat(new TextEncoder().encode('<svg viewBox="0 0 1 1"/>')), "svg");
  assert.equal(sniffFormat(new TextEncoder().encode("<html><script>alert(1)</script></html>")), null);
  assert.equal(sniffFormat(new TextEncoder().encode("GIF89a")), null);
});

test("cross layout: aspect detection and the six cutting rectangles", () => {
  assert.ok(isCrossAspect(400, 300) && isCrossAspect(2800, 2100) && isCrossAspect(1000, 749));
  assert.ok(!isCrossAspect(300, 400) && !isCrossAspect(1, 1) && !isCrossAspect(500, 300) && !isCrossAspect(0, 0));
  const r = crossRects(400, 300);
  assert.deepEqual(r.U, [100, 0, 100, 100]);
  assert.deepEqual(r.L, [0, 100, 100, 100]);
  assert.deepEqual(r.F, [100, 100, 100, 100]);
  assert.deepEqual(r.R, [200, 100, 100, 100]);
  assert.deepEqual(r.B, [300, 100, 100, 100]);
  assert.deepEqual(r.D, [100, 200, 100, 100]);
  assert.throws(() => crossRects(300, 400), /4:3/);
  // Rounded edges leave no gap and no overlap, and stay inside the image.
  for (const [w, h] of [[1001, 751], [4096, 3072], [403, 299]]) {
    const rects = crossRects(w, h, 5, 7);
    for (const f of FACE_IDS) {
      const [x, y, cw, ch] = rects[f];
      assert.ok(x >= 5 && y >= 7 && x + cw <= 5 + w && y + ch <= 7 + h && cw > 0 && ch > 0, f);
    }
    assert.equal(rects.L[0] + rects.L[2], rects.F[0]);
    assert.equal(rects.F[0] + rects.F[2], rects.R[0]);
    assert.equal(rects.R[0] + rects.R[2], rects.B[0]);
    assert.equal(rects.B[0] + rects.B[2], 5 + w);
    assert.equal(rects.U[1] + rects.U[3], rects.F[1]);
    assert.equal(rects.F[1] + rects.F[3], rects.D[1]);
    assert.equal(rects.D[1] + rects.D[3], 7 + h);
  }
  assert.deepEqual(Object.keys(CROSS_CELLS).sort(), [...FACE_IDS].sort());
});

test("cutting an SVG net: each face gets the sanitized content with its own viewBox", () => {
  const net = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect x="100" width="100" height="100" fill="red"/><rect x="300" y="100" width="100" height="100" fill="blue"/></svg>';
  const rects = crossRects(400, 300);
  const faces = Object.fromEntries(FACE_IDS.map((f) => [f, sanitizeSvg(net, { viewBox: rects[f], size: [1024, 1024] }).svg]));
  assert.match(faces.U, /viewBox="100 0 100 100" width="1024" height="1024"/);
  assert.match(faces.B, /viewBox="300 100 100 100"/);
  for (const svg of Object.values(faces)) assert.equal(sanitizeSvg(svg).svg, svg);
});

test("resolution hint: 100 px per sticker, only PNG faces count", () => {
  assert.deepEqual([2, 3, 5, 7].map(minFaceResolution), [200, 300, 500, 700]);
  const faces = (sizes, format = "png") => Object.fromEntries(FACE_IDS.map((f, i) => [f, { format, originalSize: sizes[i] }]));
  const small = resolutionHint(7, faces([700, 699, 1024, 100, 700, 800]));
  assert.equal(small.required, 700);
  assert.deepEqual(small.small, [{ face: "B", size: 699 }, { face: "L", size: 100 }]);
  assert.ok(!small.ok);
  assert.ok(resolutionHint(2, faces([200, 200, 200, 200, 200, 200])).ok);
  assert.ok(resolutionHint(7, faces([1, 1, 1, 1, 1, 1], "svg")).ok);
});

const prepared = (format = "png", size = 8) =>
  Object.fromEntries(
    FACE_IDS.map((f, i) => [
      f,
      { format, bytes: format === "png" ? png(size, size, [i * 40, 10, 10, 255]) : new TextEncoder().encode(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="${i + 1}" height="8"/></svg>`, { size: [size, size] }).svg), size, originalSize: size },
    ]),
  );

test("an upload becomes an ordinary FaceSet: hashed, sliceable and usable as a design", async () => {
  const up = await buildUploadedFaceSet(prepared());
  assert.equal(up.set.id, "upload");
  assert.deepEqual(Object.keys(up.set.faces).sort(), [...FACE_IDS].sort());
  for (const f of FACE_IDS) {
    const src = up.set.faces[f];
    assert.equal(src.url, `${LOCAL_ASSET_PREFIX}${f}.png`);
    assert.equal(src.sha256, await sha256(up.faces[f].bytes));
    assert.equal(up.local.get(src.url).bytes, up.faces[f].bytes);
  }
  // Same slicing as a built-in theme: no special case by source.
  for (const n of [2, 3, 7]) assert.equal(sliceFaceSet(up.set, n).length, 6 * n * n);
  assert.doesNotThrow(() => validateAssets(createDesign("upload", up.set).assets));
  const id = createDesign("upload", up.set).print.id;
  assert.match(id, /^playground_upload_[0-9a-f]{20}_v1$/);
  assert.equal(id, createDesign("upload", (await buildUploadedFaceSet(prepared())).set).print.id, "same pictures, same id");
  const other = prepared();
  other.F = { ...other.F, bytes: png(8, 8, [9, 9, 9, 255]) };
  assert.notEqual(id, createDesign("upload", (await buildUploadedFaceSet(other)).set).print.id, "different pictures, different id");
  assert.throws(() => createDesign("upload"), /face set/);
  assert.ok(!THEMES.some((t) => t.id === "upload"), "the upload id is reserved");
});

test("loader path for in-memory bytes: hash, format, size and sanitizer checks; built-in paths stay fetch-only", async () => {
  const up = await buildUploadedFaceSet(prepared());
  const asset = (f, over = {}) => ({ url: up.set.faces[f].url, format: "png", sha256: up.set.faces[f].sha256, ...over });
  const budget = () => ({ bytes: 0 });
  assert.equal(await verifyLocalSource(up.local, asset("F"), budget()), up.faces.F.bytes);
  // hash computed client side must match the manifest
  await assert.rejects(verifyLocalSource(up.local, asset("F", { sha256: "0".repeat(64) }), budget()), /integrity/);
  // swapping bytes after hashing is caught
  const tampered = new Map(up.local);
  tampered.set(asset("F").url, { format: "png", bytes: png(8, 8, [1, 2, 3, 255]) });
  await assert.rejects(verifyLocalSource(tampered, asset("F"), budget()), /integrity/);
  // a URL without a local source never falls back to the network
  await assert.rejects(verifyLocalSource(new Map(), asset("F"), budget()), /missing/);
  await assert.rejects(verifyLocalSource(undefined, asset("F"), budget()), /missing/);
  // only the reserved prefix is served from memory
  await assert.rejects(verifyLocalSource(up.local, asset("F", { url: "/playground-seasons/F.png" }), budget()), /in-memory/);
  await assert.rejects(verifyLocalSource(up.local, asset("F", { format: "svg" }), budget()), /format mismatch/);
  // limits
  const big = new Uint8Array(LOCAL_ASSET_LIMITS.bytesPerFile + 1);
  await assert.rejects(verifyLocalSource(new Map([["/uploaded/X.png", { format: "png", bytes: big }]]), { url: "/uploaded/X.png", format: "png", sha256: await sha256(big) }, budget()), /byte limit/);
  await assert.rejects(verifyLocalSource(up.local, asset("F"), { bytes: LOCAL_ASSET_LIMITS.totalBytes }), /byte limit/);
  const wide = png(LOCAL_ASSET_LIMITS.pixelsPerSide + 1, 1);
  await assert.rejects(verifyLocalSource(new Map([["/uploaded/W.png", { format: "png", bytes: wide }]]), { url: "/uploaded/W.png", format: "png", sha256: await sha256(wide) }, budget()), /dimensions/);
  const junk = new Uint8Array(64).fill(7);
  await assert.rejects(verifyLocalSource(new Map([["/uploaded/J.png", { format: "png", bytes: junk }]]), { url: "/uploaded/J.png", format: "png", sha256: await sha256(junk) }, budget()), /PNG/);
  // SVG: only the sanitizer's own canonical output is accepted
  const svgUp = await buildUploadedFaceSet(prepared("svg"));
  assert.ok(await verifyLocalSource(svgUp.local, { url: svgUp.set.faces.F.url, format: "svg", sha256: svgUp.set.faces.F.sha256 }, budget()));
  const evil = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"><script>alert(1)</script></svg>');
  await assert.rejects(verifyLocalSource(new Map([["/uploaded/E.svg", { format: "svg", bytes: evil }]]), { url: "/uploaded/E.svg", format: "svg", sha256: await sha256(evil) }, budget()), /sanitized/);
  const raw = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" onclick="x()"/></svg>');
  await assert.rejects(verifyLocalSource(new Map([["/uploaded/R.svg", { format: "svg", bytes: raw }]]), { url: "/uploaded/R.svg", format: "svg", sha256: await sha256(raw) }, budget()), /sanitized/);
});

import { cutSvgNet, prepareSvgFace } from "../src/apps/playground/svg-faces.ts";

const netSvg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="red"/></svg>`;
const boxOf = (svg) => /viewBox="([^"]+)"/.exec(svg)[1].split(" ").map(Number);

test("SVG nets are cut at the exact boundaries of the viewBox, with no rounding", () => {
  for (const [w, h] of [[4.8, 3.6], [297, 222.75], [1.3333, 1], [1000, 749.5]]) {
    const cut = cutSvgNet(netSvg(w, h));
    assert.equal(cut.kind, "faces", `${w}x${h}`);
    const rects = crossRects(w, h, 0, 0, false);
    for (const f of FACE_IDS) {
      const [x, y, cw, ch] = boxOf(cut.faces[f]);
      assert.ok(Math.abs(x - (CROSS_CELLS[f][0] * w) / 4) < 1e-9 && Math.abs(y - (CROSS_CELLS[f][1] * h) / 3) < 1e-9, `${f} origin at ${w}x${h}`);
      assert.ok(Math.abs(cw - w / 4) < 1e-9 && Math.abs(ch - h / 3) < 1e-9 && cw > 0 && ch > 0, f);
      assert.deepEqual([x, y, cw, ch], [...rects[f]]);
      assert.ok(x + cw <= w + 1e-9 && y + ch <= h + 1e-9, `${f} inside the image`);
      // each face is a square picture of the working edge, stretched like a PNG cell
      assert.match(cut.faces[f], /width="1024" height="1024" preserveAspectRatio="none"/);
    }
  }
  assert.equal(cutSvgNet(netSvg(300, 400)).kind, "not-a-cross");
  assert.deepEqual({ ...cutSvgNet(netSvg(300, 400)) }, { kind: "not-a-cross", width: 300, height: 400 });
});

test("SVG faces: square within one percent, stretched not letterboxed; otherwise reported", () => {
  assert.equal(prepareSvgFace(netSvg(100, 101)).kind, "face");
  assert.match(prepareSvgFace(netSvg(100, 101)).svg, /preserveAspectRatio="none"/);
  assert.deepEqual({ ...prepareSvgFace(netSvg(100, 103)) }, { kind: "not-square", width: 100, height: 103 });
  assert.throws(() => prepareSvgFace("<svg/>"), /needs a viewBox/);
});

test("kept faces are checked against the loader's byte limits when the set is built", async () => {
  const faces = prepared();
  faces.F = { ...faces.F, bytes: new Uint8Array(LOCAL_ASSET_LIMITS.bytesPerFile + 1) };
  await assert.rejects(buildUploadedFaceSet(faces), /Face F is too large after cleaning/);
  const six = Object.fromEntries(FACE_IDS.map((f) => [f, { ...prepared()[f], bytes: new Uint8Array(LOCAL_ASSET_LIMITS.bytesPerFile) }]));
  await assert.rejects(buildUploadedFaceSet(six), /too large together/);
});
