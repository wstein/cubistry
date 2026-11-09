// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube: the stickerless face art (the label drawn on the cubie face, no sticker body). Deterministic,
// no WebGL: the pure drawing is checked against a recording context, the scene against the real PhysicalCubeScene.
// The fixture is hand-made (tests/calendar7-fixture.mjs), not research data.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PRESENTATION_PRESET, PhysicalCubeScene, createPlasticMaterial, createPresentationGeometry } from "@cubistry/cube-viewer";
import { STICKERS, checkPose } from "../src/apps/calendar7/engine.ts";
import { BLANK_PAPER, FACE_FLAT, FACE_SCALE, FACE_TEXT_SQUARE, PAPER, TEXTURE, drawFace, drawSticker } from "../src/apps/calendar7/sticker-art.ts";
import { frontCells, layoutFixture } from "./calendar7-fixture.mjs";

function record(draw) {
  const log = [];
  const font = { v: "" };
  const ctx = {
    set fillStyle(v) { log.push(["fillStyle", v]); },
    set font(v) { font.v = v; log.push(["font", v]); },
    set textAlign(v) { log.push(["textAlign", v]); },
    set textBaseline(v) { log.push(["textBaseline", v]); },
    fillRect: (...a) => log.push(["fillRect", ...a]),
    fillText: (...a) => log.push(["fillText", ...a]),
    measureText: (t) => ({ width: Number(font.v.match(/(\d+(?:\.\d+)?)px/)[1]) * 0.6 * t.length }),
    save: () => log.push(["save"]),
    restore: () => log.push(["restore"]),
    translate: (...a) => log.push(["translate", ...a]),
    scale: (...a) => log.push(["scale", ...a]),
  };
  draw(ctx);
  return log;
}
const labelLog = (log) => log.filter((e) => ["font", "textAlign", "textBaseline", "fillText"].includes(e[0]));

test("the fixture is a valid solved 7x7 pose with a made-up front layout", () => {
  const { printing, pose } = layoutFixture();
  checkPose(printing, pose);
  assert.equal(printing.text.length, STICKERS);
  const cells = frontCells();
  assert.deepEqual(cells.slice(0, 3).map((c) => c.text), ["NO", "VEM", "BER"]);
  assert.deepEqual(cells.slice(7, 14).map((c) => c.text), ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]);
});

test("FACE_FLAT is the real flat part of the body face in texture space (same geometry as the viewer)", () => {
  const p = PRESENTATION_PRESET;
  // lightGeometry() of viewer.ts: the preset body with one bevel segment.
  const g = new RoundedBoxGeometry(p.bodyWidth, p.bodyWidth, p.bodyWidth, 1, p.bodyRadius);
  const pos = g.getAttribute("position"), uv = g.getAttribute("uv"), nor = g.getAttribute("normal");
  let u0 = Infinity, u1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < pos.count; i++)
    if (Math.abs(nor.getZ(i) - 1) < 1e-6 && Math.abs(pos.getZ(i) - p.bodyWidth / 2) < 1e-6) {
      u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i)); x0 = Math.min(x0, pos.getX(i)); x1 = Math.max(x1, pos.getX(i));
    }
  assert.ok(Math.abs(u1 - u0 - FACE_FLAT) < 1e-3, `flat uv span ${u1 - u0}`);
  assert.ok(Math.abs((u0 + u1) / 2 - 0.5) < 1e-6, "the flat face is centered in the texture");
  assert.ok(Math.abs(x1 - x0 - (p.bodyWidth - 2 * p.bodyRadius)) < 1e-6, "the flat face is the body width minus both bevels");
  // The art keeps clear of the bevel: the text square is FACE_TEXT_SQUARE (0.92) of the flat face, so 4% of the flat
  // width stays free on each side; pinned to the measured value in the next test.
  assert.equal(FACE_TEXT_SQUARE, 0.92);
});

test("the stickerless text size is pinned: text square 0.92 of the flat face, picked from the candidates 0.86, 0.92, 0.97", () => {
  // Picked on the real ink of the three-letter labels (tests/browser/calendar7-stickerless.spec.mjs: at least 4% of the
  // flat face on every side); a different value needs a new measurement, so this test fails on purpose.
  assert.equal(FACE_TEXT_SQUARE, 0.92);
  assert.ok(Math.abs(FACE_SCALE - (FACE_FLAT * 0.92) / 0.86) < 1e-12);
  assert.ok(Math.abs(FACE_SCALE - 0.97416) < 1e-4, `scale ${FACE_SCALE}`);
  assert.equal(FACE_FLAT, 0.9106);
});

test("drawFace: paper on the whole texture, then the sticker label scaled about the center by FACE_SCALE", () => {
  for (const [text, ink, profile] of [["7", "dark", "strict"], ["MON", "weekday", "strict"], ["NO", "month", "strict"], ["23/30", "red", "strict"], ["6", "dark", "strict"], ["23/30", "red", "legacy"]]) {
    const sticker = record((c) => drawSticker(c, text, ink, profile));
    const face = record((c) => drawFace(c, text, ink, profile));
    assert.deepEqual(face.slice(0, 2), [["fillStyle", PAPER], ["fillRect", 0, 0, TEXTURE, TEXTURE]], `${text} paper`);
    const at = face.findIndex((e) => e[0] === "save");
    assert.ok(at > 1, "transform is scoped by save");
    assert.deepEqual(face.slice(at, at + 4), [["save"], ["translate", TEXTURE / 2, TEXTURE / 2], ["scale", FACE_SCALE, FACE_SCALE], ["translate", -TEXTURE / 2, -TEXTURE / 2]]);
    assert.deepEqual(face.at(-1), ["restore"]);
    // The label is exactly the one of the sticker path: same fonts, alignment, baselines and positions.
    assert.deepEqual(labelLog(face), labelLog(sticker), `${text} label shared with the sticker path`);
  }
});

test("drawFace: a blank face is blank paper, with no label", () => {
  const log = record((c) => drawFace(c, "", "blank", "strict"));
  assert.deepEqual(log.slice(0, 2), [["fillStyle", BLANK_PAPER], ["fillRect", 0, 0, TEXTURE, TEXTURE]]);
  assert.deepEqual(labelLog(log), []);
});

test("labels of up to three letters fit the 86% text square before scaling, and the scaled square stays in the flat face", () => {
  for (const t of ["NO", "VEM", "BER", "EMB", "MON", "WED", "M", "28"]) {
    const log = record((c) => drawFace(c, t, "dark", "strict"));
    const size = Number(log.filter((e) => e[0] === "font").at(-1)[1].match(/(\d+)px/)[1]);
    const width = size * 0.6 * t.length; // the recording context's width model
    assert.ok(width <= 0.86 * TEXTURE + 1e-9, `${t} fits the 86% text square`);
    assert.ok(width * FACE_SCALE <= FACE_TEXT_SQUARE * TEXTURE * FACE_FLAT + 1e-9, `${t} inside the text square of the flat face`);
  }
});

test("the real scene: stickerless hides all 294 sticker meshes and puts each label on its cubie face; stickered restores", () => {
  const { printing, pose } = layoutFixture();
  const frames = Array.from({ length: STICKERS }, (_, i) => ({
    id: i + 1, cubie: printing.piece[i],
    p: [...pose.pos.slice(3 * i, 3 * i + 3)], n: [...pose.normal.slice(3 * i, 3 * i + 3)], up: [...pose.up.slice(3 * i, 3 * i + 3)],
  }));
  const textures = new Map();
  const materials = new Map();
  for (let i = 0; i < STICKERS; i++) {
    const key = `${printing.ink[i]}|${printing.text[i]}`;
    if (!textures.has(key)) {
      const tex = new THREE.Texture();
      textures.set(key, { tex, mat: new THREE.MeshStandardMaterial({ map: tex }) });
    }
    materials.set(i + 1, textures.get(key).mat);
  }
  const parent = new THREE.Group();
  const cube = new PhysicalCubeScene(parent, frames, materials, createPlasticMaterial(), 1, createPresentationGeometry(), new Map(), { bodyColor: "#23272e" });
  const stickerMeshes = [];
  const shells = [];
  parent.traverse((o) => {
    if (o.userData.stickerId !== undefined) stickerMeshes.push(o);
    if (o.userData.sourceFaceStickerIds) shells.push(o);
  });
  assert.equal(stickerMeshes.length, STICKERS);
  assert.equal(shells.length, 218);
  assert.ok(stickerMeshes.every((m) => m.visible));
  cube.setConstruction("stickerless");
  assert.ok(stickerMeshes.every((m) => !m.visible), "no sticker body is drawn");
  let labeled = 0;
  for (const shell of shells) {
    assert.ok(Array.isArray(shell.material) && shell.material.length === 6);
    shell.userData.sourceFaceStickerIds.forEach((id, face) => {
      if (id === null) return;
      assert.equal(shell.material[face].map, materials.get(id).map, `sticker ${id}: label texture on the cubie face`);
      labeled++;
    });
  }
  assert.equal(labeled, STICKERS);
  cube.setConstruction("stickered");
  assert.ok(stickerMeshes.every((m) => m.visible));
});
