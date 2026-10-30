import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createCube3Design, FACE_FRAMES, facePosition, exactGoal, apply, inverse, cross } from "../src/apps/picture3/model.ts";
import { apply as independentApply } from "../src/apps/calendar/transition/geometry.mjs";
import { PRESETS, presetSvg } from "../src/apps/picture3/presets.ts";
import { CalendarViewer } from "../src/apps/calendar/viewer.ts";
import { DEFAULT_APPEARANCE } from "@cubistry/cube-viewer";

test("all six picture grids have independent outside-looking-in coordinates, normal/up and unique tile identities", () => {
  const design = createCube3Design();
  assert.equal(design.printing.length, 54);
  assert.equal(new Set(design.printing.map(s => s.id)).size, 54);
  assert.equal(new Set(design.printing.map(s => s.cubie)).size, 26);
  assert.equal(new Set(design.printing.map(s => s.image)).size, 54);
  const upperLeft = { U: [-1, 1, -1], D: [-1, -1, 1], F: [-1, 1, 1], B: [1, 1, -1], L: [-1, 1, -1], R: [1, 1, 1] };
  const lowerRight = { U: [1, 1, 1], D: [1, -1, -1], F: [1, -1, 1], B: [-1, -1, -1], L: [-1, -1, 1], R: [1, -1, -1] };
  FACE_FRAMES.forEach((f, faceIndex) => {
    assert.deepEqual(facePosition(f.face, 0, 0), upperLeft[f.face]);
    assert.deepEqual(facePosition(f.face, 2, 2), lowerRight[f.face]);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const s = design.printing[faceIndex * 9 + row * 3 + col];
      assert.equal(s.image, `${f.face}_${row}_${col}`);
      assert.deepEqual(s.n, f.normal); assert.deepEqual(s.up, f.up);
      const right = cross(f.up, f.normal);
      assert.equal(s.p.reduce((sum, v, i) => sum + v * right[i], 0), col - 1);
      assert.equal(s.p.reduce((sum, v, i) => sum + v * f.up[i], 0), 1 - row);
    }
  });
});
test("exact picture goal rejects center twists and identity changes and legal moves replay independently", () => {
  for (const style of ["classic", "picture"]) {
    const d = createCube3Design(style), original = JSON.stringify(d);
    assert(exactGoal(d, d.printing));
    const twist = d.printing.map(s => s.slot === 4 ? { ...s, up: cross(s.up, s.n) } : s);
    assert(!exactGoal(d, twist));
    assert(!exactGoal(d, d.printing.map((s, i) => i ? s : { ...s, id: 999 })));
    const word = "R U' F2 L D B' x y2 z' R2 U F'";
    const state = apply(d.printing, word);
    assert.deepEqual(state, independentApply(d.printing, word));
    assert(!exactGoal(d, state)); assert(exactGoal(d, apply(state, inverse(word))));
    assert.equal(JSON.stringify(d), original);
  }
});
test("three usable original vector sets cover all faces without external assets or font dependencies", () => {
  assert.equal(PRESETS.length, 3);
  const images = PRESETS.flatMap(p => FACE_FRAMES.map(f => presetSvg(p.id, f.face)));
  assert.equal(new Set(images).size, 18);
  for (const image of images) {
    assert.match(image, /width="768" height="768" viewBox="0 0 768 768"/);
    assert(!/href|url\(|<image|<text|<script|foreignObject/i.test(image));
    assert.match(image, /M350 390L384 330/); // Asymmetric center-up landmark.
  }
});
test("existing size-3 renderer accepts per-tile art and refreshes pixels without changing state, source frames or layer pivots", () => {
  const design = createCube3Design(), state = apply(design.printing, "R U' F2");
  const viewer = Object.assign(Object.create(CalendarViewer.prototype), {
    presentation: new THREE.Group(), resources: [], artworkTextures: new Map(), cube: null,
    busy: false, appearance: DEFAULT_APPEARANCE,
  });
  const artwork = new Map(design.printing.map(s => [s.id, { width: 256, height: 256, id: s.image }]));
  viewer.configure(design, state, artwork);
  const snapshot = JSON.stringify(viewer.presentedState), cube = viewer.cube;
  const texture = viewer.artworkTextures.get(4), next = new Map(artwork);
  next.set(4, { width: 256, height: 256, id: "replacement" });
  viewer.setAppearance({ construction: "stickerless", frameColor: null });
  const turn = cube.beginTurn([...new Set(state.filter(s => s.p[0] === 1).map(s => s.cubie))], 0, Math.PI / 2);
  turn.update(.5); const hierarchy = viewer.presentation.children.slice();
  viewer.updateArtwork(next);
  assert.equal(viewer.artworkTextures.get(4), texture);
  assert.equal(texture.image, next.get(4));
  assert.equal(JSON.stringify(viewer.presentedState), snapshot);
  assert.deepEqual(viewer.presentation.children, hierarchy);
  assert.throws(() => viewer.updateArtwork(new Map()), /Incomplete/);
  turn.dispose(); cube.sync(state);
  assert.throws(() => viewer.configure(design, state, new Map()), /Incomplete/);
  assert.equal(viewer.cube, cube);
  let disposed = 0; texture.addEventListener("dispose", () => disposed++);
  viewer.clear(); assert.equal(disposed, 1); assert.equal(viewer.artworkTextures.size, 0);
});
