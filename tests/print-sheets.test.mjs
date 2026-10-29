import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = "public/print/";
const read = (path) => JSON.parse(readFileSync(path));
const sha = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const faces = {
  U: { n: [0, 1, 0], up: [0, 0, -1] },
  L: { n: [-1, 0, 0], up: [0, 1, 0] },
  F: { n: [0, 0, 1], up: [0, 1, 0] },
  R: { n: [1, 0, 0], up: [0, 1, 0] },
  B: { n: [0, 0, -1], up: [0, 1, 0] },
  D: { n: [0, -1, 0], up: [0, 0, 1] },
};
const catalog = read(root + "catalog.json");

test("committed print presets retain every physical sticker and full source-face orientation", () => {
  assert.equal(catalog.schema, "cubistry.print-catalog");
  assert.equal(catalog.entries.length, 6);
  for (const entry of catalog.entries) {
    const dir = root + entry.directory,
      m = read(dir + "manifest.json");
    const source = read(m.source.path).printing;
    assert.equal(sha(m.source.path), m.source.sha256);
    assert.equal(m.stickersPerCube, source.length);
    assert.equal(m.stickerCount, source.length * m.copies);
    assert.equal(m.stickers.length, m.stickerCount);
    assert.equal(new Set(m.stickers.map((s) => s.uid)).size, m.stickerCount);
    for (let copy = 1; copy <= m.copies; copy++) {
      const set = m.stickers.filter((s) => s.copy === copy);
      assert.deepEqual(
        set.map((s) => s.id).sort((a, b) => a - b),
        source.map((s) => s.id).sort((a, b) => a - b),
      );
      for (const s of set) {
        const original = source.find((o) => o.id === s.id),
          face = faces[s.face],
          right = cross(face.up, face.n);
        assert.deepEqual(s.sourcePosition, original.p);
        assert.deepEqual(s.normal, original.n);
        assert.deepEqual(s.sourceUp, original.up);
        assert.equal(s.image, original.image);
        assert.equal(s.cubie, original.cubie);
        assert.deepEqual(s.normal, face.n);
        assert.deepEqual(s.faceUp, face.up);
        const levels = m.size === 3 ? [1, 0, -1] : [1, -1];
        assert.equal(s.row, levels.indexOf(dot(original.p, face.up)));
        assert.equal(
          s.column,
          levels.slice().reverse().indexOf(dot(original.p, right)),
        );
        assert([0, 90, 180, 270].includes(s.rotationDeg));
        const angle = (s.rotationDeg * Math.PI) / 180;
        const renderedUp = face.up.map((v, i) =>
          Math.round(Math.cos(angle) * v + Math.sin(angle) * right[i]),
        );
        const renderedRight = right.map((v, i) =>
          Math.round(Math.cos(angle) * v - Math.sin(angle) * face.up[i]),
        );
        assert(renderedUp.every((v, i) => v === original.up[i]));
        assert(
          renderedRight.every(
            (v, i) => v === cross(original.up, original.n)[i],
          ),
        );
      }
    }
    assert(
      m.stickers.some((s) => s.image === ""),
      "Unprinted stickers remain physical entries",
    );
    if (m.size === 3) assert.equal(m.stickersPerCube, 54);
    else assert.equal(m.stickersPerCube, 24);
  }
});

test("A4 imposition keeps real cuts, bleed and conservative ink safety inside each rounded sticker", () => {
  for (const entry of catalog.entries) {
    const dir = root + entry.directory,
      m = read(dir + "manifest.json");
    assert.deepEqual(m.pageMm, [210, 297]);
    assert.equal(m.pages, 1);
    assert.deepEqual(m.cut.cmyk, [0, 1, 0, 0]);
    assert.equal(m.cut.spotColor, "kiss_cut");
    assert.equal(m.cut.overprint, true);
    const byPage = {};
    for (const s of m.stickers) {
      const b = s.bleedMm;
      assert(s.xMm - b >= 0 && s.yMm - b >= 0);
      assert(s.xMm + s.sizeMm + b <= 210 && s.yMm + s.sizeMm + b <= 297);
      assert(s.cutPathMm.startsWith("M") && s.cutPathMm.endsWith("Z"));
      assert.equal((s.cutPathMm.match(/C/g) ?? []).length, 4);
      if (s.sourceInkBounds) {
        const half = 128 - (s.safeMm * 256) / s.sizeMm;
        const r = (s.cornerRadiusMm * 256) / s.sizeMm,
          inner = Math.max(0, r - (s.safeMm * 256) / s.sizeMm);
        for (const x of [s.sourceInkBounds[0], s.sourceInkBounds[2]])
          for (const y of [s.sourceInkBounds[1], s.sourceInkBounds[3]]) {
            const a = Math.abs(x - 128) * s.artScale,
              c = Math.abs(y - 128) * s.artScale;
            assert(a <= half + 1e-7 && c <= half + 1e-7);
            if (inner)
              assert(
                Math.max(0, a - (128 - r)) ** 2 +
                  Math.max(0, c - (128 - r)) ** 2 <=
                  inner ** 2 + 1e-6,
              );
          }
      }
      (byPage[s.page] ??= []).push(s);
    }
    for (const stickers of Object.values(byPage))
      for (let i = 0; i < stickers.length; i++)
        for (let j = i + 1; j < stickers.length; j++) {
          const a = stickers[i],
            b = stickers[j];
          const overlap =
            Math.min(
              a.xMm + a.sizeMm + a.bleedMm,
              b.xMm + b.sizeMm + b.bleedMm,
            ) -
              Math.max(a.xMm - a.bleedMm, b.xMm - b.bleedMm) >
              1e-7 &&
            Math.min(
              a.yMm + a.sizeMm + a.bleedMm,
              b.yMm + b.sizeMm + b.bleedMm,
            ) -
              Math.max(a.yMm - a.bleedMm, b.yMm - b.bleedMm) >
              1e-7;
          assert.equal(overlap, false);
        }
    for (let page = 1; page <= m.pages; page++) {
      const art = readFileSync(dir + `artwork-${page}.svg`, "utf8"),
        cuts = readFileSync(dir + `cuts-${page}.svg`, "utf8");
      assert(art.includes('width="210mm" height="297mm"'));
      assert(
        !/<(?:text|image|foreignObject)\b|(?:href|src)\s*=|url\(/i.test(art),
      );
      assert(
        cuts.includes('id="kiss_cut"') &&
          cuts.includes('data-overprint="true"'),
      );
      for (const s of m.stickers.filter((s) => s.page === page)) {
        assert(art.includes(`id="${s.uid}"`));
        assert(cuts.includes(`id="cut-${s.uid}"`));
        assert(cuts.includes(`d="${s.cutPathMm}"`));
      }
    }
  }
});

test("print downloads are pinned, original geometric art and font-derived outlines have correct licenses", () => {
  for (const entry of catalog.entries) {
    const dir = root + entry.directory,
      m = read(dir + "manifest.json");
    for (const [file, hash] of Object.entries(entry.files)) {
      assert(
        !file.includes("..") && !file.includes("/") && !file.startsWith("."),
      );
      assert.equal(sha(dir + file), hash, file);
    }
    for (const [file, hash] of Object.entries(m.files))
      assert.equal(sha(dir + file), hash, file);
    for (const [file, hash] of Object.entries(m.artInputs))
      assert.equal(sha(file), hash, file);
    assert.equal(sha(m.generator.path), m.generator.sha256);
    assert.equal(sha("scripts/print/inputs.mjs"), m.generator.artInputAdapter);
    assert.equal(sha(dir + m.artworkLicense.file), sha("LICENSE"));
    if (entry.design === "hsm-symbols") assert.equal(m.font, null);
    else {
      assert.equal(m.font.family, "Noto Sans");
      assert.equal(m.font.license, "SIL-OFL-1.1");
      assert.equal(sha(dir + m.font.licenseFile), sha("public/fonts/OFL.txt"));
    }
    assert(
      readFileSync(dir + "print.pdf")
        .subarray(0, 4)
        .toString() === "%PDF",
    );
    assert(resolve(dir).startsWith(resolve(root)));
  }
});
