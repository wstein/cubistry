// SPDX-License-Identifier: AGPL-3.0-or-later
// Cut (hidden) faces of the stickerless cubies colored as on a real cube (names layout, PhysicalCubeScene option
// miterCutFaces): along an edge shared with an exterior face the cut face carries that face's color; where it borders two
// exterior faces of different colors it is split diagonally; a cut face touching no exterior face keeps the body color.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PhysicalCubeScene, createPlasticMaterial, cutColorAt, cutFaceEdges, faceUvAxes, flatCutColor, paintCutPattern, CUT_TEXTURE_SIZE } from "@cubistry/cube-viewer";

const RED = "#e0282c", WHITE = "#fdfdfd", BLUE = "#2a2aff", BODY = "#f0f0f0";
const hex = (c) => c.slice(1);

// ---- the pure rule ----
test("cutColorAt: one exterior edge colors the whole face, two neighboring edges split it on the diagonal through their shared corner, none gives the body", () => {
  assert.equal(cutColorAt([], 0.5, 0.5), null);
  for (const [u, v] of [[0.1, 0.1], [0.9, 0.9], [0.5, 0.5], [0.99, 0.01]]) assert.equal(cutColorAt([{ edge: "u1", color: RED }], u, v), RED);
  const two = [{ edge: "u1", color: RED }, { edge: "v1", color: WHITE }]; // shared corner (1, 1), diagonal u = v
  assert.equal(cutColorAt(two, 0.95, 0.5), RED, "near the u1 edge");
  assert.equal(cutColorAt(two, 0.5, 0.95), WHITE, "near the v1 edge");
  assert.equal(cutColorAt(two, 0.9, 0.1), RED, "far corner (1, 0) is on the u1 side");
  assert.equal(cutColorAt(two, 0.1, 0.9), WHITE, "far corner (0, 1) is on the v1 side");
  assert.equal(cutColorAt(two, 0.2, 0.2), RED, "the tie on the diagonal goes to the first edge");
  assert.equal(flatCutColor(two), null);
  assert.equal(flatCutColor([{ edge: "u1", color: RED }, { edge: "v0", color: RED }]), RED);
  assert.equal(flatCutColor([]), null);
});
test("paintCutPattern: the texture bytes follow the rule (row 0 is v = 0) and the diagonal is smoothed", () => {
  const edges = [{ edge: "u1", color: "#ff0000" }, { edge: "v1", color: "#0000ff" }];
  const n = CUT_TEXTURE_SIZE, d = paintCutPattern(edges);
  const px = (x, y) => [...d.slice((y * n + x) * 4, (y * n + x) * 4 + 4)];
  assert.deepEqual(px(n - 2, 2), [255, 0, 0, 255], "u near 1, v near 0: red side");
  assert.deepEqual(px(2, n - 2), [0, 0, 255, 255], "u near 0, v near 1: blue side");
  const on = px(n / 2, n / 2);
  assert.ok(on[0] > 0 && on[2] > 0, "mixed pixel on the diagonal");
});

// ---- the scene: real geometry, real uv ----
const geometry = () => ({ body: new RoundedBoxGeometry(0.99, 0.99, 0.99, 1, 0.055), sticker: new THREE.PlaneGeometry(1, 1), stickerOffset: 0.502 });
const NORMALS = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
const upOf = (n) => (n[1] === 0 ? [0, 1, 0] : [0, 0, 1]);
const FACE_INDEX = { "+x": 0, "-x": 1, "+y": 2, "-y": 3, "+z": 4, "-z": 5 };

/** One cubie (id 1) with the given exterior faces [[name, color]] in this id order; returns the shell and its cut materials. */
function build(faces) {
  const frames = faces.map(([name], k) => ({ id: k + 1, cubie: 1, p: [0, 0, 0], n: NORMALS[name], up: upOf(NORMALS[name]) }));
  const mats = new Map(frames.map((f) => [f.id, new THREE.MeshStandardMaterial({ color: "#ffffff" })]));
  const colors = new Map(faces.map(([, color], k) => [k + 1, color]));
  const root = new THREE.Group();
  const scene = new PhysicalCubeScene(root, frames, mats, createPlasticMaterial("#23272e", 0.55), 1, geometry(), colors, { bodyColor: BODY, coreColor: BODY, miterCutFaces: true });
  scene.setConstruction("stickerless");
  const shell = root.children.find((c) => c.children[0]?.isMesh && Array.isArray(c.children[0].material)).children[0];
  return { scene, shell, colors };
}
/** The color a cut face shows at the edge next to `neighbor` (a face name), read from the real vertices, uv and texture. */
function colorNextTo(shell, cutFace, neighbor) {
  const g = shell.geometry, pos = g.getAttribute("position"), uv = g.getAttribute("uv");
  const group = g.groups.find((x) => x.materialIndex === FACE_INDEX[cutFace]);
  const nAxis = FACE_INDEX[neighbor] >> 1, nSign = neighbor[0] === "+" ? 1 : -1;
  const tangents = [0, 1, 2].filter((a) => a !== (FACE_INDEX[cutFace] >> 1) && a !== nAxis);
  let best = null;
  for (let i = group.start; i < group.start + group.count; i++) {
    const v = g.index ? g.index.getX(i) : i;
    if (pos.getComponent(v, nAxis) * nSign < 0.46) continue; // the outer ring of the bevel next to that neighbor
    const t = pos.getComponent(v, tangents[0]);
    if (Math.abs(Math.abs(t) - 0.44) > 1e-3) continue; // a grid line inside the edge, away from the corners
    best = { u: uv.getX(v), v: uv.getY(v) };
  }
  assert.ok(best, `${cutFace} next to ${neighbor}: a sample vertex`);
  const material = shell.material[FACE_INDEX[cutFace]];
  if (!material.map) return `#${material.color.getHexString()}`;
  const n = material.map.image.width, d = material.map.image.data;
  const x = Math.min(n - 1, Math.floor(best.u * n)), y = Math.min(n - 1, Math.floor(best.v * n));
  const i = (y * n + x) * 4;
  return `#${[0, 1, 2].map((k) => d[i + k].toString(16).padStart(2, "0")).join("")}`;
}
const NEIGHBORS = { x: ["+y", "-y", "+z", "-z"], y: ["+x", "-x", "+z", "-z"], z: ["+x", "-x", "+y", "-y"] };
const closeColor = (got, want) => [1, 3, 5].every((i) => Math.abs(parseInt(got.slice(i, i + 2), 16) - parseInt(want.slice(i, i + 2), 16)) <= 2);

function expectCubie(faces, label) {
  const { shell } = build(faces);
  const colorOf = new Map(faces);
  for (const cut of Object.keys(NORMALS).filter((f) => !colorOf.has(f))) {
    const neighbors = NEIGHBORS[cut[1]];
    const touching = neighbors.filter((n) => colorOf.has(n));
    for (const n of neighbors) {
      const got = colorNextTo(shell, cut, n);
      if (touching.length === 0) assert.ok(closeColor(got, BODY), `${label}: cut ${cut} touches no exterior face: body color, got ${got} next to ${n}`);
      else if (colorOf.has(n)) assert.ok(closeColor(got, colorOf.get(n)), `${label}: cut ${cut} next to exterior ${n} has ${colorOf.get(n)}, got ${got}`);
      else if (touching.length === 1) assert.ok(closeColor(got, colorOf.get(touching[0])), `${label}: cut ${cut} with one exterior neighbor is all ${colorOf.get(touching[0])}, got ${got} next to ${n}`);
    }
  }
}
test("scene: a center cubie: cut faces next to its face carry its color, the face opposite it keeps the body color", () => {
  expectCubie([["+z", RED]], "center");
  const { shell } = build([["+z", RED]]);
  assert.equal(colorNextTo(shell, "+x", "+z"), RED);
  assert.ok(closeColor(colorNextTo(shell, "-z", "+x"), BODY));
});
test("scene: an edge cubie with a red and a white face: red sides next to red, white sides next to white, diagonal on the faces that touch both", () => {
  for (const order of [[["+z", RED], ["+y", WHITE]], [["+y", WHITE], ["+z", RED]]]) expectCubie(order, "edge " + order.map((o) => o[0]).join(""));
  const { shell } = build([["+z", RED], ["+y", WHITE]]);
  assert.equal(colorNextTo(shell, "+x", "+z"), RED);
  assert.equal(colorNextTo(shell, "+x", "+y"), WHITE, "the same cut face is white next to the white face (the miter)");
  assert.equal(colorNextTo(shell, "-x", "+z"), RED);
  assert.equal(colorNextTo(shell, "-x", "+y"), WHITE);
  // The cut face opposite the white face touches only the red face: all red.
  assert.equal(colorNextTo(shell, "-y", "+x"), RED);
  assert.equal(colorNextTo(shell, "-z", "+y"), WHITE, "opposite the red face: touches only the white face");
});
test("scene: a corner cubie with three colors: every cut face is split between the two exterior faces it touches", () => {
  for (const order of [[["+z", RED], ["+y", WHITE], ["+x", BLUE]], [["+x", BLUE], ["+z", RED], ["+y", WHITE]], [["+y", WHITE], ["+x", BLUE], ["+z", RED]]]) expectCubie(order, "corner");
  const { shell } = build([["+z", RED], ["+y", WHITE], ["+x", BLUE]]);
  assert.equal(colorNextTo(shell, "-x", "+z"), RED);
  assert.equal(colorNextTo(shell, "-x", "+y"), WHITE);
  assert.equal(colorNextTo(shell, "-y", "+z"), RED);
  assert.equal(colorNextTo(shell, "-y", "+x"), BLUE);
  assert.equal(colorNextTo(shell, "-z", "+y"), WHITE);
  assert.equal(colorNextTo(shell, "-z", "+x"), BLUE);
});
test("scene: a cubie with two red tiles and a cubie with red and white (the DEC|EMB, J|ANU and mixed cubies) never lose a side to the body color or to the wrong tile", () => {
  for (const order of [[["+z", RED], ["+y", RED]], [["+y", RED], ["+z", RED]]]) {
    expectCubie(order, "two red");
    const { shell } = build(order);
    for (const cut of ["+x", "-x", "-y", "-z"]) for (const n of NEIGHBORS[cut[1]]) if (order.some((o) => o[0] === n)) assert.equal(colorNextTo(shell, cut, n), RED, `two red: ${cut} next to ${n}`);
  }
  const { shell } = build([["+z", RED], ["+y", RED]]);
  assert.equal(colorNextTo(shell, "-y", "+x"), RED, "-y touches the red +z face (a one-color face: no body strip)");
  assert.equal(colorNextTo(shell, "-z", "+x"), RED, "-z touches the red +y face");
});
test("scene: a white date cell cubie (no red anywhere) shows no red; the colors follow setFaceColors in place and the body color stays for setBodyColor", () => {
  const { scene, shell } = build([["+z", WHITE]]);
  for (const cut of ["+x", "-x", "+y", "-y"]) assert.equal(colorNextTo(shell, cut, "+z"), WHITE);
  scene.setFaceColors(new Map([[1, BLUE]]));
  for (const cut of ["+x", "-x", "+y", "-y"]) assert.equal(colorNextTo(shell, cut, "+z"), BLUE);
  scene.setBodyColor("#101010");
  assert.ok(closeColor(colorNextTo(shell, "-z", "+x"), "#101010"));
  assert.equal(colorNextTo(shell, "+x", "+z"), BLUE);
  assert.throws(() => scene.setFaceColors(new Map([[1, "blue"]])), /Invalid face color/);
});
test("scene: without the option the cut faces are the body color, untouched (default off)", () => {
  const frames = [{ id: 1, cubie: 1, p: [0, 0, 0], n: [0, 0, 1], up: [0, 1, 0] }];
  const mats = new Map([[1, new THREE.MeshStandardMaterial({ color: "#ffffff" })]]);
  const root = new THREE.Group();
  const scene = new PhysicalCubeScene(root, frames, mats, createPlasticMaterial("#23272e", 0.55), 1, geometry(), new Map([[1, RED]]), { bodyColor: BODY, coreColor: BODY });
  scene.setConstruction("stickerless");
  const shell = root.children[0].children[0];
  assert.deepEqual([...new Set(shell.material.filter((_, i) => i !== 4).map((m) => `${m.color.getHexString()}${m.map ? "m" : ""}`))], [hex(BODY)]);
  scene.setFaceColors(new Map([[1, BLUE]])); // no effect without the option
  assert.deepEqual([...new Set(shell.material.filter((_, i) => i !== 4).map((m) => m.color.getHexString()))], [hex(BODY)]);
});
test("cutFaceEdges and faceUvAxes: the uv axes are measured from the real geometry and map neighbors to the right edge", () => {
  const axes = faceUvAxes(new RoundedBoxGeometry(0.99, 0.99, 0.99, 1, 0.055));
  assert.equal(axes.length, 6);
  for (const a of axes) assert.notEqual(a.uAxis, a.vAxis);
  const ext = [null, null, null, null, RED, null]; // +z exterior
  const edges = cutFaceEdges(0, ext, axes); // cut face +x, neighbors +z
  assert.equal(edges.length, 1);
  assert.equal(edges[0].color, RED);
  assert.deepEqual(cutFaceEdges(5, ext, axes), [], "the face opposite touches nothing");
});
