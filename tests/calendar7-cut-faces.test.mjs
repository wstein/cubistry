// SPDX-License-Identifier: AGPL-3.0-or-later
// Cut (hidden) faces of the stickerless cubies colored as on a real cube (names layout, PhysicalCubeScene option
// miterCutFaces): along an edge shared with an exterior face the cut face carries that face's color; where it borders two
// exterior faces of different colors it is split diagonally; a cut face touching no exterior face keeps the body color.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PhysicalCubeScene, createPlasticMaterial, cutColorAt, cutPatternKey, cutFaceEdges, faceUvAxes, flatCutColor, paintCutPattern, CUT_TEXTURE_SIZE } from "@cubistry/cube-viewer";

const RED = "#e0282c", WHITE = "#fdfdfd", BLUE = "#2a2aff", BODY = "#f0f0f0";
const hex = (c) => c.slice(1);
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

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
function build(faces, faceEdgeColors) {
  const frames = faces.map(([name], k) => ({ id: k + 1, cubie: 1, p: [0, 0, 0], n: NORMALS[name], up: upOf(NORMALS[name]) }));
  const mats = new Map(frames.map((f) => [f.id, new THREE.MeshStandardMaterial({ color: "#ffffff" })]));
  const colors = new Map(faces.map(([, color], k) => [k + 1, color]));
  const root = new THREE.Group();
  const scene = new PhysicalCubeScene(root, frames, mats, createPlasticMaterial("#23272e", 0.55), 1, geometry(), colors, { bodyColor: BODY, coreColor: BODY, miterCutFaces: true, faceEdgeColors });
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

// ---- edge colors: a white strip along one edge of a red face (the month banner of the unit grid) ----
test("scene: faceEdgeColors: a cut face takes the color of the edge it borders, not of the whole face (red banner with a white strip at its top and bottom edge)", () => {
  const edges = new Map([[1, { top: WHITE, bottom: WHITE }]]);
  const { shell } = build([["+z", RED]], edges);
  // the +z face has up +y, right +x: its bottom edge borders -y, its top edge +y, its side edges +x and -x
  assert.equal(colorNextTo(shell, "-y", "+z"), WHITE, "below the banner: the white strip");
  assert.equal(colorNextTo(shell, "+y", "+z"), WHITE, "above the banner: the white strip");
  assert.equal(colorNextTo(shell, "+x", "+z"), RED, "beside the banner: red");
  assert.equal(colorNextTo(shell, "-x", "+z"), RED);
  // without edge colors the whole face color applies (the previous model)
  assert.equal(colorNextTo(build([["+z", RED]]).shell, "-y", "+z"), RED);
});
test("scene: faceEdgeColors with an edge cubie: the miter uses the edge colors of the face (white bottom strip, red sides) next to a second face", () => {
  const edges = new Map([[1, { bottom: WHITE }]]);
  const { shell } = build([["+z", RED], ["+x", BLUE]], edges); // red front with a white bottom edge, blue right face
  assert.equal(colorNextTo(shell, "-y", "+z"), WHITE, "the cut face below borders the white bottom strip of the front");
  assert.equal(colorNextTo(shell, "-y", "+x"), BLUE, "and the blue right face (miter)");
  assert.equal(colorNextTo(shell, "+y", "+z"), RED, "the top edge has no strip");
});
test("scene: setFaceColors with edge colors follows them in place (a replaced map clears the old edges, no map keeps them)", () => {
  const { scene, shell } = build([["+z", RED]], new Map([[1, { bottom: WHITE }]]));
  assert.equal(colorNextTo(shell, "-y", "+z"), WHITE);
  scene.setFaceColors(new Map([[1, BLUE]]));
  assert.equal(colorNextTo(shell, "-y", "+z"), WHITE, "edge colors stay when no map is given");
  assert.equal(colorNextTo(shell, "+y", "+z"), BLUE);
  scene.setFaceColors(new Map([[1, BLUE]]), new Map([[1, { top: RED }]]));
  assert.equal(colorNextTo(shell, "-y", "+z"), BLUE, "a new map replaces the old edges");
  assert.equal(colorNextTo(shell, "+y", "+z"), RED);
  assert.throws(() => scene.setFaceColors(new Map([[1, BLUE]]), new Map([[1, { top: "red" }]])), /Invalid face edge color/);
});
test("scene: the edge follows the sticker's up and right, also on a face with another orientation (+x face with up +z: its bottom edge borders -z)", () => {
  const frames = [{ id: 1, cubie: 1, p: [0, 0, 0], n: [1, 0, 0], up: [0, 0, 1] }];
  const root = new THREE.Group();
  const scene = new PhysicalCubeScene(root, frames, new Map([[1, new THREE.MeshStandardMaterial({ color: "#ffffff" })]]), createPlasticMaterial("#23272e", 0.55), 1, geometry(), new Map([[1, RED]]), { bodyColor: BODY, coreColor: BODY, miterCutFaces: true, faceEdgeColors: new Map([[1, { bottom: WHITE }]]) });
  scene.setConstruction("stickerless");
  const shell = root.children.find((c) => c.children[0]?.isMesh && Array.isArray(c.children[0].material)).children[0];
  assert.equal(colorNextTo(shell, "-z", "+x"), WHITE, "bottom edge (up = +z) borders -z");
  assert.equal(colorNextTo(shell, "+z", "+x"), RED);
  assert.equal(colorNextTo(shell, "+y", "+x"), RED, "right = up x n = (0,1,0)... a side edge");
  assert.equal(colorNextTo(shell, "-y", "+x"), RED);
});

// ---- edge colors that change along the edge (stops): a red banner between two white strips ----
const hexAt = (shell, cutFace, u, v) => {
  const m = shell.material[FACE_INDEX[cutFace]];
  if (!m.map) return `#${m.color.getHexString()}`;
  const n = m.map.image.width, d = m.map.image.data, x = Math.min(n - 1, Math.floor(u * n)), y = Math.min(n - 1, Math.floor(v * n)), k = (y * n + x) * 4;
  return `#${[0, 1, 2].map((c) => d[k + c].toString(16).padStart(2, "0")).join("")}`;
};
/** Color of a side cut face next to the +z face at the fraction `up` (0 bottom, 1 top of the +z face) along the edge, close to the edge. */
function sideAt(shell, cutFace, up) {
  const axes = faceUvAxes(new RoundedBoxGeometry(0.99, 0.99, 0.99, 1, 0.055))[FACE_INDEX[cutFace]];
  const near = 0.05; // the nearest edge is the +z one
  let u, v;
  const edgeCoord = (axis, sign, towardsPositive) => (towardsPositive ? (sign > 0 ? 1 - near : near) : (sign > 0 ? near : 1 - near));
  if (axes.uAxis === 2) { u = edgeCoord(2, axes.uSign, true); v = axes.vSign > 0 ? up : 1 - up; } // the +z edge is a u edge; the coordinate along it (v) runs along y
  else { v = edgeCoord(2, axes.vSign, true); u = axes.uSign > 0 ? up : 1 - up; }
  return hexAt(shell, cutFace, u, v);
}
test("cutColorAt and cutFaceEdges with stops: the nearest edge's color follows the position along the edge, in either direction of the uv axes", () => {
  const stops = [{ to: 0.3, color: WHITE }, { to: 0.9, color: RED }, { to: 1, color: WHITE }];
  const edge = [{ edge: "u1", color: WHITE, stops }];
  assert.equal(cutColorAt(edge, 0.95, 0.1), WHITE);
  assert.equal(cutColorAt(edge, 0.95, 0.5), RED);
  assert.equal(cutColorAt(edge, 0.95, 0.95), WHITE);
  assert.equal(cutColorAt([{ edge: "v0", color: WHITE, stops }], 0.6, 0.02), RED, "a v edge runs along u");
  assert.equal(flatCutColor(edge), null, "stops are never flat");
  assert.notEqual(cutPatternKey(edge), cutPatternKey([{ edge: "u1", color: WHITE }]));
  const axes = faceUvAxes(new RoundedBoxGeometry(0.99, 0.99, 0.99, 1, 0.055)), ext = [null, null, null, null, RED, null]; // +z exterior, cut face +x
  const up = [0, 1, 0], got = cutFaceEdges(0, ext, axes, [null, null, null, null, { stops, dir: up }]);
  assert.equal(got.length, 1);
  const q = got[0].stops, vAxisIsY = axes[0].vAxis === 1 || axes[0].uAxis === 1;
  assert.ok(vAxisIsY);
  const sign = (got[0].edge[0] === "u" ? axes[0].vSign : axes[0].uSign) * up[1];
  const want = sign > 0 ? [[0.3, WHITE], [0.9, RED], [1, WHITE]] : [[0.1, WHITE], [0.7, RED], [1, WHITE]]; // reversed along the edge: to' = 1 - (previous to)
  assert.deepEqual(q.map((x) => [Math.round(x.to * 1e9) / 1e9, x.color]), want);
  const rev = cutFaceEdges(0, ext, axes, [null, null, null, null, { stops, dir: [0, -1, 0] }])[0].stops; // the same stops running the other way: the mirror image
  assert.deepEqual(rev.map((x) => [Math.round(x.to * 1e9) / 1e9, x.color]), sign > 0 ? [[0.1, WHITE], [0.7, RED], [1, WHITE]] : [[0.3, WHITE], [0.9, RED], [1, WHITE]]);
});
test("scene: edge colors with stops: the side cut face is white along the two strips and red between them (stops run up along the +z face)", () => {
  const stops = [{ to: 0.3, color: WHITE }, { to: 0.9, color: RED }, { to: 1, color: WHITE }];
  const { shell } = build([["+z", RED]], new Map([[1, { top: WHITE, bottom: WHITE, left: stops, right: stops }]]));
  for (const cut of ["+x", "-x"]) {
    assert.equal(sideAt(shell, cut, 0.1), WHITE, `${cut}: bottom strip`);
    assert.equal(sideAt(shell, cut, 0.6), RED, `${cut}: banner`);
    assert.equal(sideAt(shell, cut, 0.97), WHITE, `${cut}: top strip`);
  }
  const { scene, shell: s2 } = build([["+z", RED]], new Map([[1, { left: stops }]]));
  scene.setFaceColors(new Map([[1, RED]]), new Map([[1, { left: [{ to: 0.5, color: BLUE }, { to: 1, color: RED }] }]]));
  assert.equal(sideAt(s2, "-x", 0.2), BLUE, "stops follow setFaceColors in place");
  assert.equal(sideAt(s2, "-x", 0.8), RED);
  assert.throws(() => scene.setFaceColors(new Map([[1, RED]]), new Map([[1, { left: [{ to: 1, color: "red" }] }]])), /Invalid face edge color/);
});

// ---- the real names print (unit grid): the cut faces under the month row ----
import { readFileSync } from "node:fs";
import { NAMES_BODY_WIDTH, NAMES_GAP, layerWidthsOf, unitGridTileOf } from "../src/apps/calendar7/geometry.ts";
import { SCHEMES, namesGround } from "../src/apps/calendar7/schemes.ts";
import { parseState } from "../src/apps/calendar7/graph.ts";
import { faceEdgeFills, faceFills } from "../src/apps/calendar7/viewer.ts";
test("names print: the cut face under every month row ring cubie is one flat white (the banner has a white strip of 0.5 below it), the previous red is gone", () => {
  const { printing, pose } = parseState(JSON.parse(readFileSync("public/calendar7/names/state.v1.json", "utf8")));
  const n = printing.text.length, frames = Array.from({ length: n }, (_, i) => ({ id: i + 1, cubie: printing.piece[i], p: [...pose.pos.slice(3 * i, 3 * i + 3)], n: [...pose.normal.slice(3 * i, 3 * i + 3)], up: [...pose.up.slice(3 * i, 3 * i + 3)] }));
  const tiles = frames.map((f) => unitGridTileOf(f.p, f.n, f.up, layerWidthsOf("names")));
  const mats = new Map(frames.map((f) => [f.id, new THREE.MeshStandardMaterial({ color: "#ffffff" })]));
  const geo = { body: new RoundedBoxGeometry(NAMES_BODY_WIDTH, NAMES_BODY_WIDTH, NAMES_BODY_WIDTH, 1, 0.055), sticker: new THREE.PlaneGeometry(1, 1), stickerOffset: 0.502 };
  const scheme = SCHEMES.find((s) => s.id === "paper-red");
  const root = new THREE.Group();
  const scene = new PhysicalCubeScene(root, frames, mats, createPlasticMaterial("#23272e", 0.55), 1, geo, faceFills(printing, scheme, "names"), { bodyColor: namesGround(scheme.dayFill), coreColor: namesGround(scheme.dayFill), miterCutFaces: true, faceEdgeColors: faceEdgeFills(printing, scheme, "names", tiles), layers: { widths: layerWidthsOf("names"), body: (c) => new RoundedBoxGeometry(c[0] - NAMES_GAP, c[1] - NAMES_GAP, c[2] - NAMES_GAP, 1, 0.055) } });
  scene.setConstruction("stickerless");
  const shells = root.children.filter((g) => g.children[0]?.isMesh && Array.isArray(g.children[0].material)).map((g) => g.children[0]);
  let checked = 0;
  for (const shell of shells) {
    const ids = shell.userData.sourceFaceStickerIds, front = ids[4]; // +z
    if (front === null || ids[2] === null || ids.filter((x) => x !== null).length !== 2) continue; // exactly front and top: a ring piece of the month row
    const i = front - 1;
    if (frames[i].p[1] !== 3 || printing.text[i] === "" && printing.ink[i] !== "band") continue;
    assert.equal(`#${shell.material[3].color.getHexString()}`, namesGround(scheme.dayFill), `cubie ${frames[i].p}: the cut face below is the white strip`);
    assert.equal(shell.material[3].map, null, "one flat color");
    checked++;
  }
  assert.ok(checked >= 5, `${checked} month row cubies checked`);
  // the same cubies without the edge colors would be red below (the previous model)
  const edges = faceEdgeFills(printing, scheme, "names", tiles);
  assert.ok(edges.size >= 7, `edge colors for ${edges.size} banner stickers`);
  assert.equal(faceEdgeFills(printing, scheme, "standard", tiles).size, 0);
  for (let i = 0; i < n; i++) { // beside the banner: white strip 0.5 / red 1.2 / white strip 0.1 of the 1.8 tall cubie, from the bottom up
    if (printing.ink[i] !== "month" && printing.ink[i] !== "band") continue;
    const e = edges.get(i + 1);
    if (!Array.isArray(e.left) && !Array.isArray(e.right)) continue; // a month tile on another face of the print: no thick row, no strips beside it
    for (const side of [e.left, e.right].filter(Array.isArray)) { // the outer edge of a corner tile is the white band: a plain color
      assert.deepEqual(side.map((x) => x.color), [namesGround(scheme.dayFill), scheme.bandFill, namesGround(scheme.dayFill)]);
      near(side[0].to, 0.5 / 1.8, 0.03); near(side[1].to, 1 - 0.1 / 1.8, 0.03); assert.equal(side[2].to, 1);
    }
    assert.equal(e.top, namesGround(scheme.dayFill)); assert.equal(e.bottom, namesGround(scheme.dayFill));
  }});
