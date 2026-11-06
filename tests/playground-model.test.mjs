import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { stateEquals, validateState } from "@cubistry/cube-core";
import {
  applyMoves,
  inverseMoves,
  parseAlg,
  serializeMove,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import {
  createDesign,
  classify,
  fullGoal,
  scramble,
} from "../src/apps/playground/model.ts";
import { THEMES, sliceFaceSet, tileEdges, FACE_IDS } from "../src/apps/playground/themes.ts";
import { validateAssets } from "../packages/cube-assets/src/index.ts";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
for (const style of ["classic", "picture", "pastel", ...THEMES.map((t) => t.id)]) {
  test(`${style}: permanent IDs, local frames, rotation classification and real provider exact solve`, async () => {
    const d = createDesign(style);
    assert.equal(d.print.stickers.length, 24);
    assert.equal(d.print.cubies.length, 8);
    assert.equal(new Set(d.print.stickers.map((s) => s.id)).size, 24);
    assert.equal(d.equivalents.length, 24);
    const original = JSON.stringify(d.print);
    for (const seed of [0, 1, 42, 4294967295]) {
      const word = scramble(seed, 20);
      assert.deepEqual(word, scramble(seed, 20));
      assert.deepEqual(parseAlg(word.map(serializeMove).join(" ")), word);
      const moved = applyMoves(d.target, word);
      validateState(moved, d.print);
      assert.deepEqual(
        stickerPoses(d.print, moved).map((s) => s.id),
        stickerPoses(d.print, d.target).map((s) => s.id),
      );
      assert.ok(fullGoal(d, applyMoves(moved, inverseMoves(word))));
    }
    const reoriented = applyMoves(d.target, parseAlg("R L'"));
    assert.deepEqual(classify(d, reoriented), {
      exact: false,
      rotationEquivalent: true,
    });
    const solver = await prepareTestSolver(d.print);
    for (const state of [
      reoriented,
      applyMoves(d.target, scramble(0, 17)),
      applyMoves(d.target, scramble(9, 20)),
    ]) {
      const result = solver.solve(state, d.target);
      assert.deepEqual(parseAlg(result.map(serializeMove).join(" ")), result);
      assert.ok(fullGoal(d, applyMoves(state, result)));
    }
    assert.equal(JSON.stringify(d.print), original);
  });
}
test("distinct print sessions and original image tile provenance", () => {
  const classic = createDesign("classic"),
    picture = createDesign("picture"),
    pastel = createDesign("pastel");
  assert.equal(new Set([classic, picture, pastel].map((d) => d.print.id)).size, 3);
  assert.ok(!stateEquals(classic.target, picture.target));
  assert.ok(!stateEquals(picture.target, pastel.target));
  for (const design of [picture, pastel])
    for (const image of design.assets.images) {
      const source = readFileSync(
        new URL(`../public${image.url}`, import.meta.url),
        "utf8",
      );
      assert.equal(
        createHash("sha256").update(source).digest("hex"),
        image.sha256,
      );
      assert.ok(!/<(?:text|clipPath|image|script)\b|href=/.test(source));
      assert.match(
        source,
        /width="160" height="160" viewBox="(?:0|160) (?:0|160) 160 160"/,
      );
    }
  assert.equal(pastel.assets.images.length, 24);
  assert.throws(() => scramble(-1, 20));
  assert.throws(() => scramble(0, 101));
  assert.throws(() => scramble(1.5, 20));
});
const pins = JSON.parse(readFileSync(new URL("./fixtures/playground-theme-pins.json", import.meta.url), "utf8"));
test("picture themes: unique prints, pinned size-independent faces and the vector subset", () => {
  const ids = THEMES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  const prints = new Set(["playground_classic_v1", "playground_picture_v1", "playground_pastel_v1"]);
  for (const theme of THEMES) {
    assert.match(theme.id, /^[a-z]+$/);
    assert.ok(theme.name.length > 0);
    const design = createDesign(theme.id);
    assert.ok(!prints.has(design.print.id));
    prints.add(design.print.id);
    assert.deepEqual(design.assets.images, sliceFaceSet(theme, 2));
    assert.deepEqual(Object.keys(theme.faces).sort(), [...FACE_IDS].sort());
    const dir = new URL(`../public/playground-${theme.id}/`, import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
    assert.equal(manifest.design, theme.id);
    assert.deepEqual(manifest.faces, Object.fromEntries(FACE_IDS.map((f) => [f, { sha256: theme.faces[f].sha256 }])));
    let total = 0;
    for (const face of FACE_IDS) {
      const { url, format, sha256, size } = theme.faces[face];
      assert.equal(url, `/playground-${theme.id}/${face}.svg`);
      assert.equal(format, "svg");
      assert.equal(size, 320);
      const bytes = readFileSync(new URL(`../public${url}`, import.meta.url)),
        source = bytes.toString("utf8");
      total += bytes.length;
      assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
      assert.ok(!/<(?:text|clipPath|image|script|style|use|filter|foreignObject|linearGradient|radialGradient|pattern|mask)\b|<!|href=|url\(|@import|data:|style=|stroke-dasharray/i.test(source));
      assert.ok(source.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">'));
      assert.ok(bytes.length <= 262144, `${face} exceeds the asset loader's per-file limit`);
    }
    assert.ok(total <= 4194304, `${theme.id} exceeds the asset loader's total byte budget`);
    // Art and print version go together: changing a face needs a new version and a new pin.
    const digest = createHash("sha256").update(FACE_IDS.map((f) => theme.faces[f].sha256).join("")).digest("hex");
    const version = theme.version ?? 1;
    assert.equal(design.print.id, `playground_${theme.id}_v${version}`);
    assert.equal(
      pins[theme.id]?.[String(version)],
      digest,
      `${theme.id}: faces changed without a new version; bump \`version\` in themes.ts and add the digest printed by build-playground-theme.mjs to tests/fixtures/playground-theme-pins.json`,
    );
  }
});
test("sliced face sets are valid loader manifests for every cube size 2..7", () => {
  const source = (f) => ({ url: `/x/${f}.svg`, format: "svg", sha256: "0".repeat(64), size: 320 });
  const set = { id: "demo", name: "Demo", faces: Object.fromEntries(FACE_IDS.map((f) => [f, source(f)])) };
  for (let n = 2; n <= 7; n++) {
    const manifest = { schema: "cubistry.assets", version: 1, fonts: [], documents: [], materials: [], images: sliceFaceSet(set, n) };
    assert.equal(validateAssets(manifest).images.length, 6 * n * n);
  }
});
test("face-set slicing returns n x n distinct stickers per face for every cube size 2..7", () => {
  assert.throws(() => tileEdges(1, 320));
  assert.throws(() => tileEdges(8, 320));
  assert.throws(() => tileEdges(2.5, 320));
  assert.throws(() => tileEdges(7, 6));
  const source = (f, size) => ({ url: `/x/${f}.png`, format: "png", sha256: "0".repeat(64), size });
  // Faces may differ in size and format: slicing depends on the FaceSet type only.
  const set = { id: "demo", name: "Demo", faces: Object.fromEntries(FACE_IDS.map((f, i) => [f, source(f, 320 + 100 * i)])) };
  for (let n = 2; n <= 7; n++) {
    const images = sliceFaceSet(set, n);
    assert.equal(images.length, 6 * n * n);
    assert.equal(new Set(images.map((i) => i.id)).size, 6 * n * n);
    for (const f of FACE_IDS) {
      const mine = images.filter((i) => i.id.startsWith(f + "_")),
        size = set.faces[f].size,
        edges = tileEdges(n, size);
      assert.equal(mine.length, n * n);
      assert.equal(edges[0], 0);
      assert.equal(edges[n], size);
      let area = 0;
      for (const i of mine) {
        const [x, y, w, h] = i.crop;
        assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= size && y + h <= size);
        area += w * h;
      }
      // The crops tile the face exactly: no gaps, no overlap.
      assert.equal(area, size * size);
      const widths = edges.slice(1).map((e, k) => e - edges[k]);
      assert.ok(Math.max(...widths) - Math.min(...widths) <= 1);
    }
  }
  assert.deepEqual(sliceFaceSet(set, 2).find((i) => i.id === "U_1_0").crop, [0, set.faces.U.size / 2, set.faces.U.size / 2, set.faces.U.size / 2]);
});
