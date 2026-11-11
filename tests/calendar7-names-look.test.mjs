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
import { FACE_FLAT, FACE_SCALE, LINE_SCALE, TEXTURE, drawFace, drawSticker, nameGrid, tileRoles } from "../src/apps/calendar7/sticker-art.ts";
import { drawFontSticker, nameLabelLayout } from "../src/apps/calendar7/font-art.ts";
import { CUBE_EDGE_MM_7X7, INNER_CUBIE_EDGE_MM, NAMES_BODY_WIDTH, NAMES_FACE_PX_PER_UNIT, NAMES_GAP, NAMES_GAP_MM, STANDARD_BODY_WIDTH, bodyWidthFor } from "../src/apps/calendar7/geometry.ts";
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
test("names layout: on the cubie face the weekday line runs from the left to the right end of the texture, 1.5 times as thick; the sheet (sticker surface) keeps its line", () => {
  for (const [name, draw, bottom] of [
    ["face", (c) => drawFace(c, "MON", "weekday", "strict", PAPER_RED, "names"), TEXTURE * ((1 + FACE_FLAT) / 2)],
    ["font face", (c) => drawFontSticker(c, "MON", "weekday", font, PAPER_RED, "face", undefined, "names"), TEXTURE * ((1 + FACE_FLAT) / 2)],
  ]) {
    const last = rects(record(draw)).at(-1);
    const h = PAPER_RED.lineRow2.px * LINE_SCALE * 1.5;
    assert.equal(last[1], PAPER_RED.lineRow2.color, name);
    assert.equal(last[2], 0, `${name}: starts at the left edge`);
    assert.equal(last[4], TEXTURE, `${name}: spans the whole texture width`);
    assert.equal(last[5], h, `${name}: 1.5 times the standard thickness`);
    assert.ok(Math.abs(last[3] + last[5] - bottom) < 1e-9, `${name}: bottom edge`);
  }
  for (const draw of [(c) => drawSticker(c, "MON", "weekday", "strict", PAPER_RED, "names"), (c) => drawFontSticker(c, "MON", "weekday", font, PAPER_RED, "sticker", undefined, "names")]) {
    const last = rects(record(draw)).at(-1);
    assert.deepEqual(last.slice(2), [0, TEXTURE - PAPER_RED.lineRow2.px * LINE_SCALE, TEXTURE, PAPER_RED.lineRow2.px * LINE_SCALE], "sheet line as in the standard layout");
  }
  // Standard layout: the line is the shipped one (shorter on the face, original thickness).
  const std = rects(record((c) => drawFace(c, "MON", "weekday", "strict", PAPER_RED))).at(-1);
  assert.equal(std[4], TEXTURE * FACE_FLAT);
  assert.equal(std[5], PAPER_RED.lineRow2.px * LINE_SCALE);
});

// ---- 3. cut faces colored as on a real cube: see tests/calendar7-cut-faces.test.mjs ----

// ---- 4. one uniform letter pitch ----
test("names layout (built-in font grid): letters of a name sit on one uniform center pitch over all tiles, the tile centers stepping 1 cubie", () => {
  const pitch = NAMES_FACE_PX_PER_UNIT / 3; // final (on-screen) texture pixels between two letters: a third of a cubie
  for (const [name, words] of [["DECEMBER", NAME_WORDS[11]], ["JANUARY", NAME_WORDS[0]], ["MAY", NAME_WORDS[4]], ["SEPTEMBER", NAME_WORDS[8]], ["NOVEMBER", NAME_WORDS[10]], ["FEBRUARY", NAME_WORDS[1]], ["OCTOBER", NAME_WORDS[9]]]) {
    // Row x of a letter in final pixels: tile k spans [k * cubie, (k + 1) * cubie), cubie = NAMES_FACE_PX_PER_UNIT.
    const centers = [];
    words.forEach((tile, k) => {
      for (const l of nameGrid(tile)) centers.push(k * NAMES_FACE_PX_PER_UNIT + TEXTURE / 2 + (l.x - TEXTURE / 2) * FACE_SCALE);
    });
    assert.equal(centers.length, name.length);
    for (let i = 1; i < centers.length; i++) assert.ok(Math.abs(centers[i] - centers[i - 1] - pitch) < 1e-6, `${name} letter ${i}: ${centers[i] - centers[i - 1]} vs ${pitch}`);
  }
});
test("names layout: the sheet (sticker surface) keeps its 3-slot pitch of 55 px", () => {
  for (const surface of ["sticker"]) {
    const xs = nameLabelLayout("EMB", font, surface).map((l) => l.x);
    assert.equal(xs.length, 3);
    assert.ok(Math.abs(xs[1] - TEXTURE / 2) < 1e-9, "middle letter on the tile center");
    assert.ok(xs[1] - xs[0] > 0 && Math.abs(xs[1] - xs[0] - (xs[2] - xs[1])) < 1e-9);
  }
  const s = nameLabelLayout("EMB", font, "sticker");
  assert.ok(Math.abs(s[1].x - s[0].x - (TEXTURE * 0.86) / 3) < 1e-9, "sheet pitch as before: a third of the 86% text square");
});
// The 2D sheet draws the names layout as on origin/main 71aa90f (letters and size); only the 3D face drawing changed.
test("names layout on the sheet: the letter run of every name tile is exactly the old one", () => {
  const h = createHash("sha256");
  for (const word of NAME_WORDS) for (const tile of word) h.update(JSON.stringify(nameLabelLayout(tile, font, "sticker")));
  assert.equal(h.digest("hex"), "ec8e0702852b558c61fa31d6bc1a21a95296ccbf139c220fc9288d043dad11d7");
});

// ---- 5. the gap ----
test("names layout: the gap between cubies is 0.01 mm, stated in scene units (inner cubie = 66.5 mm / (5 + 2 f))", () => {
  assert.equal(NAMES_GAP_MM, 0.01);
  assert.equal(CUBE_EDGE_MM_7X7, 66.5); // assumption: middle of the 61.5 to 70 mm range of common 7x7 cubes (not measured)
  assert.ok(Math.abs(INNER_CUBIE_EDGE_MM - 66.5 / 8.6) < 1e-9, "5 + 2 * 1.8 = 8.6 inner widths: 7.7326 mm");
  assert.ok(Math.abs(NAMES_GAP - 0.01 / (66.5 / 8.6)) < 1e-12, "0.01 mm / 7.7326 mm = 0.0012932 scene units");
  assert.ok(NAMES_GAP > 0, "never zero");
  assert.equal(bodyWidthFor("names"), NAMES_BODY_WIDTH);
  assert.ok(Math.abs(NAMES_BODY_WIDTH - (1 - 0.0012932)) < 1e-6);
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
import { STANDARD_EXPOSURE } from "../src/apps/calendar7/geometry.ts";
import { irradiance, namesExposure } from "../src/apps/calendar7/names-exposure.ts";
import { addPresentationLighting } from "@cubistry/cube-viewer";
test("exposure: the standard layout keeps the shared presentation value 1 and the preset is not touched", () => {
  assert.equal(STANDARD_EXPOSURE, 1);
  assert.equal(PRESENTATION_PRESET.version, 1); // the shared preset (Neutral tone mapping, exposure 1 in configurePresentationRenderer) is not touched
});

// A white diffuse surface shows albedo * irradiance / pi (three.js); exposure = pi / irradiance on the face that looks at
// the camera makes that face show its albedo, so a token renders as itself (browser spec calendar7-names-color).
const studioScene = () => { const scene = new THREE.Scene(); addPresentationLighting(scene); return scene; };
const camera = () => { const c = new THREE.PerspectiveCamera(24, 1, 0.1, 200); c.position.set(0, 0, 20); return c; };
const turned = (yaw, pitch) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, -yaw, 0, "XYZ")); // rotatePresentation

test("exposure: head on, the names exposure is pi / front face irradiance of the studio lights, 1.217 at the shared preset", () => {
  const scene = studioScene(), p = PRESENTATION_PRESET;
  const e = namesExposure(scene, new THREE.Quaternion(), camera());
  assert.ok(Math.abs(e - 1.217) < 0.003, String(e));
  // The same number from the preset by hand: ambient + hemisphere (sky white, ground 0x77808d) + key, fill, rim, shadow fill at n = +z.
  const dir = (v) => new THREE.Vector3(...v).normalize().z;
  const k = p.keyPosition, az = Math.atan2(k[0], k[2]) - THREE.MathUtils.degToRad(p.shadowFillAzimuthDegrees);
  const el = Math.atan2(k[1], Math.hypot(k[0], k[2])) + THREE.MathUtils.degToRad(p.shadowFillElevationDelta);
  const sum = p.keyIntensity * dir(k) + p.fillIntensity * dir([-4, 1, 2]) + p.rimIntensity * Math.max(0, dir([1, 3, -4])) +
    p.shadowFillIntensity * dir([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]);
  const ground = new THREE.Color(0x77808d), lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const hand = p.ambientIntensity + p.hemisphereIntensity * (0.5 + 0.5 * lum(ground)) + sum;
  assert.ok(Math.abs(irradiance(scene, new THREE.Vector3(0, 0, 1)) - hand) < 1e-6, `${irradiance(scene, new THREE.Vector3(0, 0, 1))} vs ${hand}`);
});

const stepsOf = (scene, cam, rotationAt, from, to) => {
  let prev = namesExposure(scene, rotationAt(from), cam), worst = 0;
  for (let a = from + 0.01; a <= to + 1e-9; a += 0.01) { const e = namesExposure(scene, rotationAt(a), cam); worst = Math.max(worst, Math.abs(e - prev)); prev = e; }
  return worst;
};

test("exposure: it follows the face that looks at the camera and is continuous while the cube turns about y, about x and at a pitch", () => {
  const scene = studioScene(), cam = camera();
  const tilted = namesExposure(scene, turned(0.3, 0.22), cam), head = namesExposure(scene, new THREE.Quaternion(), cam);
  assert.ok(tilted > head + 0.1, `${tilted} ${head}`); // the default tilt lights the front face less: the exposure rises
  // Largest change of the exposure per 0.01 rad of turn. A hard switch to the most facing face jumps at the
  // crossover; the smooth weighting stays below 0.16 (bound 0.3); a hard switch gives 1.4 to 4.5.
  const sweeps = {
    "yaw at pitch 0": stepsOf(scene, cam, (a) => turned(a, 0), 0, Math.PI),
    "yaw at pitch 0.5": stepsOf(scene, cam, (a) => turned(a, 0.5), 0, Math.PI),
    "pitch at yaw 0": stepsOf(scene, cam, (a) => turned(0, a), -Math.PI / 2, Math.PI / 2),
    "pitch at yaw 0.3": stepsOf(scene, cam, (a) => turned(0.3, a), -Math.PI / 2, Math.PI / 2),
    "pitch at yaw 0.8": stepsOf(scene, cam, (a) => turned(0.8, a), -Math.PI / 2, Math.PI / 2),
  };
  for (const [name, worst] of Object.entries(sweeps)) assert.ok(worst < 0.3, `${name}: largest step of 0.01 rad ${worst}`);
});

test("exposure: the studio has only the light types the irradiance counts, and a scene without light gives the shared 1", () => {
  const scene = studioScene(), cam = camera();
  const types = new Set();
  scene.traverse((o) => { if (o.isLight) types.add(o.type); });
  assert.deepEqual([...types].sort(), ["AmbientLight", "DirectionalLight", "HemisphereLight"]);
  const head = namesExposure(scene, new THREE.Quaternion(), cam);
  scene.traverse((o) => { if (o.isDirectionalLight) o.visible = false; }); // a switched-off light leaves the irradiance
  assert.ok(namesExposure(scene, new THREE.Quaternion(), cam) > head + 0.5);
  scene.traverse((o) => { if (o.isLight) o.visible = false; });
  assert.equal(namesExposure(scene, new THREE.Quaternion(), cam), 1);
});

// ---- plasticity of the names layout (names-plasticity.ts) ----
import { DEFAULT_PLASTICITY, MIN_SHADOW_STRENGTH, clampPlasticity, floorOpacityFactor, parsePlasticity, plasticityGain, plasticityParts } from "../src/apps/calendar7/names-plasticity.ts";
test("plasticity: 0 is the flat look, the parts grow with it, the default is in range, parsing and clamping", () => {
  assert.deepEqual(plasticityParts(0), { specular: 0, clearcoat: 0, faceShadows: false, shadowStrength: MIN_SHADOW_STRENGTH });
  assert.equal(plasticityGain(0), 1);
  let prev = plasticityParts(0.01);
  for (const p of [0.1, 0.25, 0.5, 0.75, 1]) {
    const now = plasticityParts(p);
    assert.ok(now.faceShadows && now.specular > prev.specular && now.clearcoat > prev.clearcoat && now.shadowStrength > prev.shadowStrength, String(p));
    prev = now;
  }
  const full = plasticityParts(1);
  // Never past the shared plastic (specular 1, clearcoat 0.18, shadows 1): the old look is the comparison, not the top of the range.
  assert.ok(full.specular <= 0.3 && full.clearcoat <= 0.1 && full.shadowStrength <= 0.85 && full.shadowStrength >= MIN_SHADOW_STRENGTH);
  assert.equal(DEFAULT_PLASTICITY, 0.6); // owner decision 2026-11-11
  assert.equal(clampPlasticity(-3), 0); assert.equal(clampPlasticity(7), 1); assert.equal(clampPlasticity(Number.NaN), DEFAULT_PLASTICITY);
  assert.equal(parsePlasticity(null), DEFAULT_PLASTICITY); assert.equal(parsePlasticity(""), DEFAULT_PLASTICITY); assert.equal(parsePlasticity("0.6"), 0.6); assert.equal(parsePlasticity("x"), DEFAULT_PLASTICITY);
  // Out of range clamps, whether finite or not; only NaN (garbage) gives the default.
  for (const [text, want] of [["7", 1], ["1e9", 1], ["Infinity", 1], ["-Infinity", 0], ["-1", 0], ["NaN", DEFAULT_PLASTICITY]]) assert.equal(parsePlasticity(text), want, text);
  assert.equal(clampPlasticity(Infinity), 1); assert.equal(clampPlasticity(-Infinity), 0);
  assert.equal(floorOpacityFactor(MIN_SHADOW_STRENGTH) * 0.3, 1); // the floor shadow material reaches opacity 1 at the minimum strength: its darkness is kept
});
test("plasticity: the exposure gain gives back what shadows, specular and clearcoat take; without a shadow map only the specular part", () => {
  for (const p of [0.1, 0.25, 0.5, 1]) {
    assert.ok(plasticityGain(p) > plasticityGain(p, false) && plasticityGain(p, false) > 1, String(p));
    assert.ok(plasticityGain(p) > 1.02 && plasticityGain(p) < 1.12, `${p}: ${plasticityGain(p)}`);
  }
  assert.ok(plasticityGain(1) > plasticityGain(0.25));
});
