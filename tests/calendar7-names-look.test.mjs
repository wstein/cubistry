// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, appearance rework (owner review of 2026-11-10): near-white token, weekday line edge to edge and
// 1.5 times thicker, red cut faces on month and band cubies, one uniform letter pitch over the whole row of name tiles, a
// gap of 0.01 mm between cubies. The standard layout draws and builds exactly what it did before (golden hash, scene check).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PRESENTATION_PRESET, PhysicalCubeScene, createPlasticMaterial } from "@cubistry/cube-viewer";
import { NAME_WORDS } from "../src/apps/calendar7/layout.ts";
import { NAMES_WHITE, SCHEMES } from "../src/apps/calendar7/schemes.ts";
import { FACE_FLAT, FACE_SCALE, LINE_SCALE, TEXTURE, drawFace, drawSticker, tileRoles } from "../src/apps/calendar7/sticker-art.ts";
import { drawFontSticker, nameLabelLayout } from "../src/apps/calendar7/font-art.ts";
import { CUBIE_PITCH_MM, NAMES_BODY_WIDTH, NAMES_FACE_PX_PER_UNIT, NAMES_GAP, NAMES_GAP_MM, STANDARD_BODY_WIDTH, bodyWidthFor } from "../src/apps/calendar7/geometry.ts";
import { layoutFixture } from "./calendar7-fixture.mjs";

const PAPER_RED = SCHEMES.find((s) => s.id === "paper-red");

// A font with very different glyph widths (M wide, I narrow), so a pitch measured over ink boxes would differ from one over centers.
const glyphs = Object.fromEntries([..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((c) => {
  const w = c === "M" || c === "W" ? 0.86 : c === "I" || c === "J" ? 0.24 : c === "V" ? 0.64 : 0.55;
  return [c, { advance: w + 0.08, left: 0.04, right: 0.04 + w, top: -0.714, bottom: 0 }];
}));
const font = { style: { id: "test", weight: 600, master: "6" }, family: "test", glyphs, dateSize: 100 };

function record(draw) {
  const log = [];
  const state = { font: "", align: "" };
  const ctx = {
    set fillStyle(v) { log.push(["fillStyle", v]); },
    get fillStyle() { return [...log].reverse().find((e) => e[0] === "fillStyle")?.[1]; },
    set font(v) { state.font = v; },
    get font() { return state.font; },
    set fontKerning(v) {},
    set textAlign(v) { state.align = v; },
    set textBaseline(v) {},
    fillRect(...a) { log.push(["fillRect", ctx.fillStyle, ...a]); },
    fillText(t, x, y) { log.push(["fillText", ctx.fillStyle, t, x, y, state.align, state.font]); },
    measureText: (t) => ({ width: Number(state.font.match(/(\d+(?:\.\d+)?)px/)[1]) * 0.6 * t.length }),
    save() { log.push(["save"]); }, restore() { log.push(["restore"]); },
    translate(...a) { log.push(["translate", ...a]); }, scale(...a) { log.push(["scale", ...a]); }, rotate(a) { log.push(["rotate", a]); },
  };
  draw(ctx);
  return log;
}
const rects = (log) => log.filter((e) => e[0] === "fillRect");

// ---- the standard layout stays identical ----
const TILES = [["SUN", "red"], ["MON", "weekday"], ["SAT", "red"], ["1", "dark"], ["28", "red"], ["23/30", "red"], ["J", "month"], ["DEC", "month"], ["", "blank"], ["", "dark"]];
const standardGolden = () => {
  const h = createHash("sha256");
  for (const scheme of SCHEMES) for (const [text, ink] of TILES) {
    h.update(JSON.stringify([scheme.id, text, ink,
      record((c) => drawSticker(c, text, ink, "strict", scheme)),
      record((c) => drawFace(c, text, ink, "strict", scheme)),
      record((c) => drawFontSticker(c, text, ink, font, scheme, "face")),
      record((c) => drawFontSticker(c, text, ink, font, scheme, "sticker")),
      tileRoles(scheme, text, ink)]));
  }
  return h.digest("hex");
};
test("standard layout: every draw call of the sticker, face and font drawing and every tile role is unchanged (golden hash of origin/main 71aa90f)", () => {
  assert.equal(standardGolden(), "9e3c24c478b206b168403954c32d4424c1c8c43e69058ae926f5babda65a8c58");
});
test("standard layout: body width stays 0.99 and the scene builds its cut faces as before", () => {
  assert.equal(STANDARD_BODY_WIDTH, PRESENTATION_PRESET.bodyWidth);
  assert.equal(bodyWidthFor("standard"), PRESENTATION_PRESET.bodyWidth);
  const { printing, pose } = layoutFixture();
  const frames = Array.from({ length: printing.text.length }, (_, i) => ({ id: i + 1, cubie: printing.piece[i], p: [...pose.pos.slice(3 * i, 3 * i + 3)], n: [...pose.normal.slice(3 * i, 3 * i + 3)], up: [...pose.up.slice(3 * i, 3 * i + 3)] }));
  const mats = new Map(frames.map((f) => [f.id, new THREE.MeshStandardMaterial()]));
  const geometry = { body: new RoundedBoxGeometry(0.99, 0.99, 0.99, 1, 0.055), sticker: new THREE.PlaneGeometry(1, 1), stickerOffset: 0.502 };
  const root = new THREE.Group();
  new PhysicalCubeScene(root, frames, mats, createPlasticMaterial("#23272e", 0.55), 1, geometry, new Map(), { bodyColor: "#ffffff", coreColor: "#ffffff" }).setConstruction("stickerless");
  const cut = new Set();
  root.traverse((o) => { if (o.isMesh && Array.isArray(o.material)) for (const m of o.material) cut.add(m.color.getHexString()); });
  assert.deepEqual([...cut], ["ffffff"], "without cutColors every cut face is the body color");
});

// ---- 1. near-white token ----
test("names layout: white fields (weekday row, date cells, empty days) use the one near-white token; red and tints are untouched", () => {
  assert.match(NAMES_WHITE, /^#[0-9a-f]{6}$/);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(NAMES_WHITE.slice(i, i + 2), 16));
  assert.ok(r === g && g === b, "neutral: no warm or cool tint");
  assert.ok(r >= 0xf8 && r < 0xff, "near-white, not grey and not a pure-white literal");
  for (const [text, ink] of [["MON", "weekday"], ["SUN", "red"], ["SAT", "red"], ["7", "dark"], ["", "blank"]])
    assert.equal(tileRoles(PAPER_RED, text, ink, "names").fill, NAMES_WHITE, `${text}/${ink}`);
  assert.equal(tileRoles(PAPER_RED, "J", "month", "names").fill, PAPER_RED.bandFill);
  assert.equal(tileRoles(PAPER_RED, "", "band", "names").fill, PAPER_RED.bandFill);
  assert.equal(tileRoles(PAPER_RED, "12", "red", "names").fill, PAPER_RED.weekendTint);
  // The standard layout keeps the grey weekday row.
  assert.equal(tileRoles(PAPER_RED, "MON", "weekday").fill, "#ececec");
  // Colored schemes (cream, teal ...) keep their own grounds.
  for (const s of SCHEMES.filter((x) => !/^#(\w\w)\1\1$/.test(x.dayFill))) assert.equal(tileRoles(s, "7", "dark", "names").fill, s.dayFill, s.id);
});

// ---- 2. the line under the weekday names ----
test("names layout: the weekday line runs from the left to the right end of the texture, 1.5 times as thick, on face and sticker", () => {
  for (const [name, draw, bottom] of [
    ["face", (c) => drawFace(c, "MON", "weekday", "strict", PAPER_RED, "names"), TEXTURE * ((1 + FACE_FLAT) / 2)],
    ["sticker", (c) => drawSticker(c, "MON", "weekday", "strict", PAPER_RED, "names"), TEXTURE],
    ["font face", (c) => drawFontSticker(c, "MON", "weekday", font, PAPER_RED, "face", undefined, "names"), TEXTURE * ((1 + FACE_FLAT) / 2)],
    ["font sticker", (c) => drawFontSticker(c, "MON", "weekday", font, PAPER_RED, "sticker", undefined, "names"), TEXTURE],
  ]) {
    const last = rects(record(draw)).at(-1);
    const h = PAPER_RED.lineRow2.px * LINE_SCALE * 1.5;
    assert.equal(last[1], PAPER_RED.lineRow2.color, name);
    assert.equal(last[2], 0, `${name}: starts at the left edge`);
    assert.equal(last[4], TEXTURE, `${name}: spans the whole texture width`);
    assert.equal(last[5], h, `${name}: 1.5 times the standard thickness`);
    assert.ok(Math.abs(last[3] + last[5] - bottom) < 1e-9, `${name}: bottom edge`);
  }
  // Standard layout: the line is the shipped one (shorter on the face, original thickness).
  const std = rects(record((c) => drawFace(c, "MON", "weekday", "strict", PAPER_RED))).at(-1);
  assert.equal(std[4], TEXTURE * FACE_FLAT);
  assert.equal(std[5], PAPER_RED.lineRow2.px * LINE_SCALE);
});

// ---- 3. red cut faces ----
test("PhysicalCubeScene: the cut faces next to a sticker with a cut color show it (not the opposite one), setBodyColor leaves them, setCutColors changes them, other cubies keep the body color", () => {
  // Two cubies side by side along x; each has one sticker (+z), so the other five faces are cut faces.
  const frames = [1, 2].map((id) => ({ id, cubie: id, p: [id - 1, 0, 0], n: [0, 0, 1], up: [0, 1, 0] }));
  const mats = new Map(frames.map((f) => [f.id, new THREE.MeshStandardMaterial({ color: "#ffffff" })]));
  const geometry = { body: new RoundedBoxGeometry(0.99, 0.99, 0.99, 1, 0.055), sticker: new THREE.PlaneGeometry(1, 1), stickerOffset: 0.502 };
  const root = new THREE.Group();
  const scene = new PhysicalCubeScene(root, frames, mats, createPlasticMaterial("#23272e", 0.55), 1, geometry, new Map(), { bodyColor: "#f0f0f0", coreColor: "#f0f0f0", cutColors: new Map([[1, "#e0282c"]]) }); // sticker id 1
  scene.setConstruction("stickerless");
  const cutOf = (cubie) => {
    const shell = [...root.children].filter((c) => c.children[0]?.isMesh && Array.isArray(c.children[0].material))[cubie - 1].children[0];
    return shell.material.filter((_, i) => i !== 4).map((m) => m.color.getHexString()); // index 4 is +z, the sticker side; the order is +x -x +y -y -z
  };
  assert.deepEqual(cutOf(1), ["e0282c", "e0282c", "e0282c", "e0282c", "f0f0f0"], "+x -x +y -y red, the back (-z, opposite the sticker) keeps the body color");
  assert.deepEqual([...new Set(cutOf(2))], ["f0f0f0"]);
  scene.setBodyColor("#101010");
  assert.deepEqual(cutOf(1), ["e0282c", "e0282c", "e0282c", "e0282c", "101010"], "setBodyColor leaves the red faces");
  assert.deepEqual([...new Set(cutOf(2))], ["101010"]);
  scene.setCutColors(new Map([[1, "#2a2aff"]]));
  assert.deepEqual(cutOf(1), ["2a2aff", "2a2aff", "2a2aff", "2a2aff", "101010"]);
  assert.throws(() => scene.setCutColors(new Map([[1, "red"]])), /Invalid cut color/);
});

// ---- 4. one uniform letter pitch ----
test("names layout: letters of a name sit on one uniform center pitch over all tiles, the tile centers stepping 1 cubie", () => {
  const pitch = NAMES_FACE_PX_PER_UNIT / 3; // final (on-screen) texture pixels between two letters: a third of a cubie
  for (const surface of ["face"]) for (const [name, words] of [["DECEMBER", NAME_WORDS[11]], ["JANUARY", NAME_WORDS[0]], ["MAY", NAME_WORDS[4]], ["SEPTEMBER", NAME_WORDS[8]], ["NOVEMBER", NAME_WORDS[10]], ["FEBRUARY", NAME_WORDS[1]], ["OCTOBER", NAME_WORDS[9]]]) {
    // Row x of a letter in final pixels: tile k spans [k * cubie, (k + 1) * cubie), cubie = NAMES_FACE_PX_PER_UNIT.
    const centers = [];
    words.forEach((tile, k) => {
      for (const l of nameLabelLayout(tile, font, surface)) centers.push(k * NAMES_FACE_PX_PER_UNIT + TEXTURE / 2 + (l.x - TEXTURE / 2) * FACE_SCALE);
    });
    assert.equal(centers.length, name.length);
    for (let i = 1; i < centers.length; i++) assert.ok(Math.abs(centers[i] - centers[i - 1] - pitch) < 1e-6, `${name} letter ${i}: ${centers[i] - centers[i - 1]} vs ${pitch}`);
  }
});
test("names layout: a letter never leaves its tile and the letter size is one for every name tile", () => {
  const sizes = new Set();
  for (const word of NAME_WORDS) for (const tile of word) for (const l of nameLabelLayout(tile, font, "face")) {
    sizes.add(l.size);
    const x0 = TEXTURE / 2 + (l.box.x0 - TEXTURE / 2) * FACE_SCALE, x1 = TEXTURE / 2 + (l.box.x1 - TEXTURE / 2) * FACE_SCALE;
    assert.ok(x0 > 0 && x1 < TEXTURE, `${tile}: ${l.text} box ${x0}..${x1} stays inside the cubie face`);
  }
  assert.equal(sizes.size, 1);
});
test("names layout: the font drawing places the letters of a tile at the layout x (face and sticker)", () => {
  for (const surface of ["face", "sticker"]) {
    const xs = nameLabelLayout("EMB", font, surface).map((l) => l.x);
    assert.equal(xs.length, 3);
    assert.ok(Math.abs(xs[1] - TEXTURE / 2) < 1e-9, "middle letter on the tile center");
    assert.ok(xs[1] - xs[0] > 0 && Math.abs(xs[1] - xs[0] - (xs[2] - xs[1])) < 1e-9);
  }
  // The sticker body is narrower than the body face texture's flat: its pitch in sticker pixels is larger.
  assert.ok(nameLabelLayout("EMB", font, "sticker")[1].x - nameLabelLayout("EMB", font, "sticker")[0].x > nameLabelLayout("EMB", font, "face")[1].x - nameLabelLayout("EMB", font, "face")[0].x);
});

// ---- 5. the gap ----
test("names layout: the gap between cubies is 0.01 mm, stated in scene units (cubie pitch 1 = CUBIE_PITCH_MM)", () => {
  assert.equal(NAMES_GAP_MM, 0.01);
  assert.equal(CUBIE_PITCH_MM, 16); // assumption: the 16 mm calendar print preset (docs/PRINT_STICKERS.md); the app has no mm unit
  assert.ok(Math.abs(NAMES_GAP - 0.01 / 16) < 1e-12, "0.01 mm / 16 mm = 0.000625 scene units");
  assert.ok(NAMES_GAP > 0, "never zero");
  assert.equal(bodyWidthFor("names"), NAMES_BODY_WIDTH);
  assert.ok(Math.abs(NAMES_BODY_WIDTH - (1 - 0.000625)) < 1e-12);
  // Real geometry: two neighboring bodies at pitch 1 are NAMES_GAP apart.
  const g = new RoundedBoxGeometry(NAMES_BODY_WIDTH, NAMES_BODY_WIDTH, NAMES_BODY_WIDTH, 1, PRESENTATION_PRESET.bodyRadius);
  g.computeBoundingBox();
  assert.ok(Math.abs(1 - (g.boundingBox.max.x - g.boundingBox.min.x) - NAMES_GAP) < 1e-6);
});
test("names layout: the face pixels per unit of the letter grid match the real body geometry", () => {
  const g = new RoundedBoxGeometry(NAMES_BODY_WIDTH, NAMES_BODY_WIDTH, NAMES_BODY_WIDTH, 1, PRESENTATION_PRESET.bodyRadius);
  const pos = g.getAttribute("position"), uv = g.getAttribute("uv"), nor = g.getAttribute("normal");
  let u0 = Infinity, u1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < pos.count; i++) if (Math.abs(nor.getZ(i) - 1) < 1e-6 && Math.abs(pos.getZ(i) - NAMES_BODY_WIDTH / 2) < 1e-6) {
    u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i)); x0 = Math.min(x0, pos.getX(i)); x1 = Math.max(x1, pos.getX(i));
  }
  assert.ok(Math.abs(TEXTURE * (u1 - u0) / (x1 - x0) - NAMES_FACE_PX_PER_UNIT) < 0.05, `${TEXTURE * (u1 - u0) / (x1 - x0)}`);
});

// ---- exposure (owner decision: white must not render grey) ----
import { NAMES_EXPOSURE, STANDARD_EXPOSURE, exposureFor } from "../src/apps/calendar7/geometry.ts";
test("exposure: the standard layout keeps the shared presentation value 1, the names layout raises it", () => {
  assert.equal(STANDARD_EXPOSURE, 1);
  assert.equal(exposureFor("standard"), 1);
  assert.equal(exposureFor("names"), NAMES_EXPOSURE);
  assert.equal(NAMES_EXPOSURE, 2.6); // rendered near-white #f5f6f7 on the lit front face at this value, see the PR text
  assert.equal(PRESENTATION_PRESET.version, 1); // the shared preset (toneMappingExposure 1 in configurePresentationRenderer) is not touched
});
