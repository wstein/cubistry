// English 7x7 calendar cube, stage S1: data, pin and full replay (no UI, no browser).
// Research candidate, not certified. Deterministic, no timers or network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  CUBIES,
  GENERATORS,
  STICKERS,
  applyMoves,
  checkPose,
  clonePose,
  generatorAxis,
  generatorLayer,
  inverseMoves,
  metrics,
  samePose,
  stateDigest,
  stateText,
} from "../src/apps/calendar7/engine.ts";
import { sha256Hex, sha256Text } from "../src/apps/calendar7/sha256.ts";
import {
  displayIds,
  firstWeekday,
  frontFailure,
  imageNormal,
  monthCells,
} from "../src/apps/calendar7/display.ts";
import {
  MOVE_ALPHABET,
  ReplayError,
  chainReceipt,
  decodeMoves,
  displayIdOf,
  encodeMoves,
  parseDisplays,
  parseGraph,
  parseState,
  verifyChain,
  verifyEdge,
} from "../src/apps/calendar7/graph.ts";
import { check, RESEARCH_FILES } from "../scripts/prepare-calendar7.mjs";

const started = Date.now();
const read = (p, encoding) => readFileSync(p, encoding);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (p) => JSON.parse(read(p, "utf8"));
const pin = json("calendar7-source.json");

const start = parseState(json("public/calendar7/state.v1.json"));
const table = parseDisplays(json("public/calendar7/displays.v1.json"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));
const { printing, pose } = start;
const RECEIPT = "data/calendar7/research/chain-2028-2076.receipt.julia.tsv";

test("the pin binds the research commit, every research file, the Julia exports and the runtime files", () => {
  assert.match(pin.commit, /^[0-9a-f]{40}$/);
  assert.equal(pin.status, "research candidate, not certified");
  for (const [file, digest] of Object.entries(pin.runtime))
    assert.equal(sha(read(file)), digest, file);
  for (const [research, copy] of Object.entries(pin.copies))
    assert.equal(sha(read(copy)), pin.sources[research], copy);
  for (const research of Object.keys(RESEARCH_FILES)) assert.ok(pin.sources[research], research);
  // Both verifiers produced the same receipt bytes.
  const receipts = Object.entries(pin.sources).filter(([k]) => k.includes("/receipts/chain-2028-2076."));
  assert.equal(receipts.length, 2);
  assert.equal(receipts[0][1], receipts[1][1]);
  // Rederive the runtime files from the pinned copies; compare with the research commit when present.
  check(pin);
});

test("SHA-256 matches node:crypto on every padding boundary", () => {
  for (let n = 0; n <= 200; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 31 + n) & 255);
    assert.equal(sha256Hex(bytes), sha(bytes), `length ${n}`);
  }
  assert.equal(sha256Text("abc"), sha(Buffer.from("abc")));
});

test("generator conventions: 21 generators, layers -3..-1, 1..3 and rotation, no layer 0", () => {
  assert.equal(GENERATORS, 21);
  const layers = [];
  for (let g = 1; g <= 21; g++) {
    assert.equal(generatorAxis(g), Math.floor((g - 1) / 7));
    layers.push(generatorLayer(g));
  }
  assert.deepEqual(layers.slice(0, 7), [-3, -2, -1, 1, 2, 3, 99]);
  assert.deepEqual(layers.slice(7, 14), layers.slice(0, 7));
  assert.ok(!layers.includes(0));
  // Positive quarter turns (x,y,z) -> (x,-z,y), (z,y,-x), (-y,x,z) on a single sticker pose.
  const probe = clonePose(pose);
  probe.pos.set([3, 1, 2], 0);
  for (const [g, expected] of [[7, [3, -2, 1]], [14, [2, 1, -3]], [21, [-1, 3, 2]]]) {
    const turned = applyMoves(probe, [[g, 1]]);
    assert.deepEqual([...turned.pos.slice(0, 3)], expected, `rotation ${g}`);
  }
  // Each generator has order four; a half turn is two quarters; q and -q cancel.
  for (let g = 1; g <= 21; g++) {
    assert.ok(samePose(applyMoves(pose, [[g, 1], [g, 1], [g, 1], [g, 1]]), pose));
    assert.ok(samePose(applyMoves(pose, [[g, 2]]), applyMoves(pose, [[g, 1], [g, 1]])));
    assert.ok(samePose(applyMoves(applyMoves(pose, [[g, -1]]), [[g, 1]]), pose));
    assert.ok(!samePose(applyMoves(pose, [[g, 1]]), pose));
  }
  // Layers select by body position: outer layers hold 77 stickers, inner layers 28.
  const count = (axis, layer) => {
    let n = 0;
    for (let i = 0; i < STICKERS; i++) if (pose.pos[3 * i + axis] === layer) n++;
    return n;
  };
  for (let axis = 0; axis < 3; axis++)
    for (const [layer, n] of [[-3, 77], [-2, 28], [-1, 28], [1, 28], [2, 28], [3, 77]])
      assert.equal(count(axis, layer), n, `axis ${axis} layer ${layer}`);
  assert.equal(count(0, 0), 28); // the middle slice exists as bodies but is not a generator
});

test("the move word encoding round-trips and rejects non-moves", () => {
  assert.equal(MOVE_ALPHABET.length, 63);
  for (let g = 1; g <= 21; g++)
    for (const q of [1, -1, 2]) assert.deepEqual(decodeMoves(encodeMoves([[g, q]])), [[g, q]]);
  assert.throws(() => decodeMoves("!"), RangeError);
  assert.throws(() => encodeMoves([[22, 1]]), RangeError);
  assert.throws(() => encodeMoves([[1, 3]]), RangeError);
});

test("the root is a legal 294-sticker, 218-body pose and its digest is the research source hash", () => {
  checkPose(printing, pose);
  assert.equal(new Set(printing.piece).size, CUBIES);
  assert.equal(printing.text.filter((t) => t !== "").length, 240);
  const text = stateText(printing, pose);
  assert.equal(sha(text), start.node.hash);
  assert.ok(text === read("data/calendar7/julia/root-state.tsv", "utf8"));
});

test("display sheets: the independent generator equals the Julia display table for all 888 months", () => {
  assert.equal(firstWeekday(2028, 1), 6); // Saturday
  assert.equal(firstWeekday(2000, 2), 2);
  assert.deepEqual(displayIds(), [...table.months]);
  assert.equal(new Set(table.months).size, 91);
  let month = 0;
  for (let y = 2026; y <= 2099; y++)
    for (let m = 1; m <= 12; m++, month++) {
      const id = table.months[month];
      assert.equal(displayIdOf(table, y, m), id);
      assert.deepEqual(monthCells(y, m), table.displays[id - 1].cells, `${y}-${m}`);
    }
  // Display id is the first occurrence; its year and month are that first month.
  table.displays.forEach((d, i) => {
    assert.equal(table.months[(d.year - 2026) * 12 + d.month - 1], i + 1);
    assert.equal(table.months.indexOf(i + 1), (d.year - 2026) * 12 + d.month - 1);
  });
  // The folded sixth weeks are the stacked pairs 23/30 and 24/31 only.
  const stacked = new Set();
  for (const d of table.displays) for (const c of d.cells) if (c.text.includes("/")) stacked.add(c.text);
  assert.deepEqual([...stacked].sort(), ["23/30", "24/31"]);
});

test("front rule: glyph equivalences, half-turn pairs, stacked labels upright with exact text and ink", () => {
  assert.deepEqual(imageNormal("O", 0, "dark"), imageNormal("0", 0, "dark"));
  assert.deepEqual(imageNormal("I", 1, "dark"), imageNormal("1", 3, "dark")); // 1 is half-turn symmetric
  assert.deepEqual(imageNormal("9", 2, "dark"), imageNormal("6", 0, "dark"));
  assert.notDeepEqual(imageNormal("9", 0, "dark"), imageNormal("6", 0, "dark"));
  assert.deepEqual(imageNormal("0", 3, "red"), imageNormal("0", 0, "red")); // zero has no direction
  assert.notDeepEqual(imageNormal("M0N", 2, "weekday"), imageNormal("M0N", 0, "weekday"));
  assert.equal(imageNormal("", 1, "blank"), "blank");
  // The root front passes; each tamper below must fail with the stated reason.
  const cells = table.displays[start.node.display - 1].cells;
  assert.equal(frontFailure(printing, pose, cells), null);
  const cell = cells.findIndex((c) => c.text === "24/31");
  assert.ok(cell >= 0, "the root display has a stacked 24/31");
  const row = Math.floor(cell / 7) + 1,
    column = (cell % 7) + 1;
  const front = [...Array(STICKERS).keys()].find(
    (i) => pose.pos[3 * i] === column - 4 && pose.pos[3 * i + 1] === 4 - row && pose.pos[3 * i + 2] === 3 && pose.normal[3 * i + 2] === 1,
  );
  assert.equal(printing.text[front], "24/31");
  const turned = clonePose(pose);
  turned.up.set([-1, 0, 0], 3 * front); // quarter turn: stacked labels must be upright
  assert.equal(frontFailure(printing, turned, cells)?.why, "stacked-not-upright");
  const upside = clonePose(pose);
  upside.up.set(pose.up.slice(3 * front, 3 * front + 3).map((v) => -v), 3 * front);
  assert.equal(frontFailure(printing, upside, cells)?.why, "stacked-not-upright");
  const text = { ...printing, text: printing.text.map((t, i) => (i === front ? "23/30" : t)) };
  assert.equal(frontFailure(text, pose, cells)?.why, "stacked-mismatch");
  const ink = { ...printing, ink: printing.ink.map((t, i) => (i === front ? "red" : t)) };
  assert.equal(frontFailure(ink, pose, cells)?.why, "stacked-mismatch");
  const plain = { ...printing, text: printing.text.map((t, i) => (i === front ? "24" : t)) };
  assert.equal(frontFailure(plain, pose, cells)?.why, "plain-mismatch");
});

let chain;
test("replay of the whole chain: states, hashes, metrics, fronts, inverse per edge and for the chain", () => {
  assert.equal(graph.nodes.length, 577);
  assert.equal(graph.edges.length, 576);
  assert.deepEqual([graph.nodes[0].year, graph.nodes[0].month, graph.nodes[0].display], [2028, 1, 25]);
  const last = graph.nodes.at(-1);
  assert.deepEqual([last.year, last.month], [2076, 1]);
  assert.equal(new Set(graph.nodes.map((n) => n.display)).size, 91, "all 91 display types occur");
  chain = verifyChain(printing, pose, table, graph);
  assert.equal(chain.edges.length, 576);
  // Complete-state hash equality with the research receipt, byte for byte.
  const receipt = chainReceipt(chain);
  // Compare digests first: a failing string comparison of 100 kB would only produce a diff.
  assert.equal(sha(receipt), sha(read(RECEIPT)));
  assert.ok(receipt === read(RECEIPT, "utf8"), "receipt differs from the research Julia receipt");
  assert.equal(sha(receipt), pin.sources[Object.keys(pin.sources).find((k) => k.endsWith("receipts/chain-2028-2076.julia.tsv"))]);
  assert.match(receipt, /status\tVALID_CONTINUOUS_CHAIN\t576\t218\t294\t49\n$/);
  assert.equal(chain.source, graph.nodes[0].hash);
  assert.equal(chain.endpoint, graph.nodes.at(-1).hash);
});

test("a retained state hashes to each node on a spot check of the stored words", () => {
  const word = graph.edges[0].moves;
  const forward = applyMoves(pose, word);
  assert.equal(stateDigest(printing, forward), graph.nodes[1].hash);
  assert.ok(samePose(applyMoves(forward, inverseMoves(word)), pose));
  assert.deepEqual(metrics(word), { htm: graph.edges[0].htm, qtm: graph.edges[0].qtm, rot: graph.edges[0].rot, rotq: graph.edges[0].rotq });
});

test("negative controls: every corruption is rejected", () => {
  const rejects = (fn, message) => assert.throws(fn, (e) => e instanceof ReplayError, message);
  const edge0 = graph.edges[0];
  const withEdge = (i, patch) => ({
    nodes: graph.nodes,
    edges: graph.edges.map((e, k) => (k === i ? { ...e, ...patch } : e)),
  });
  const run = (g, p = printing, from = pose, i = 0) => verifyEdge(p, table, g, i, from);
  assert.ok(run(graph)); // the unmodified edge passes
  // A flipped move (first move that is not a half turn).
  const k = edge0.moves.findIndex((m) => m[1] !== 2);
  const flipped = edge0.moves.map((m, i) => (i === k ? [m[0], -m[1]] : m));
  rejects(() => run(withEdge(0, { moves: flipped })), "flipped move");
  // A changed edge: another generator in one move, metrics kept consistent.
  const changed = edge0.moves.map((m, i) => (i === k ? [(m[0] % 21) + 1, m[1]] : m));
  rejects(() => run(withEdge(0, { moves: changed, ...metrics(changed) })), "changed generator");
  // A whole-cube rotation substituted for a layer move, metrics kept consistent.
  const rotated = edge0.moves.map((m, i) => (i === k ? [7 * (Math.floor((m[0] - 1) / 7) + 1), m[1]] : m));
  rejects(() => run(withEdge(0, { moves: rotated, ...metrics(rotated) })), "rotation for layer move");
  // Declared metrics that do not match the word; a truncated word.
  rejects(() => run(withEdge(0, { htm: edge0.htm + 1 })), "metrics");
  const cut = edge0.moves.slice(0, -1);
  rejects(() => run(withEdge(0, { moves: cut, ...metrics(cut) })), "truncated word");
  // A changed print: one sticker text differs, so the complete-state hash differs.
  const other = { ...printing, text: printing.text.map((t, i) => (i === 4 ? "Z" : t)) };
  rejects(() => run(graph, other), "changed print");
  rejects(() => verifyChain(other, pose, table, graph), "changed print, chain");
  // Wrong root: the state of the neighbouring month is not the root of this chain.
  const next = applyMoves(pose, edge0.moves);
  rejects(() => verifyChain(printing, next, table, graph), "neighbour root");
  rejects(() => run(graph, printing, next, 0), "wrong source state");
  // Swapped edge order and truncated chain.
  rejects(() => verifyChain(printing, pose, table, { nodes: graph.nodes, edges: [graph.edges[1], graph.edges[0], ...graph.edges.slice(2)] }), "swapped edges");
  rejects(() => verifyChain(printing, pose, table, { nodes: graph.nodes.slice(0, 3), edges: graph.edges.slice(0, 3) }), "node/edge count");
  // A node that claims the wrong display.
  const lied = { edges: graph.edges, nodes: graph.nodes.map((n, i) => (i === 1 ? { ...n, display: n.display % 91 + 1 } : n)) };
  rejects(() => run(lied), "wrong display id");
  // A wrong pin is detected by the data check.
  const wrongPin = structuredClone(pin);
  const file = Object.keys(wrongPin.runtime)[0];
  wrongPin.runtime[file] = "0".repeat(64);
  assert.throws(() => check(wrongPin), /pin/);
  // A wrong print hash in the pin.
  const wrongPrint = structuredClone(pin);
  wrongPrint.sources[Object.keys(wrongPrint.copies)[0]] = "f".repeat(64);
  assert.throws(() => check(wrongPrint), /pin/);
  // Parsers refuse malformed data.
  assert.throws(() => parseGraph({ ...json("public/calendar7/graph.v1.json"), alphabet: "x" }));
  assert.throws(() => parseState({ ...json("public/calendar7/state.v1.json"), version: 2 }));
});

test("the whole test stays within the runtime budget", () => {
  const seconds = (Date.now() - started) / 1000;
  console.log(`calendar7 replay: ${seconds.toFixed(1)} s`);
  assert.ok(seconds < 60, `took ${seconds} s`);
});
