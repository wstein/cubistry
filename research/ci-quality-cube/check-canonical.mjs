// Independently replay Julia words through the existing pinned Cubistry mechanics.
// This checker does not import the Julia pose model or its transition tables.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const [checkoutArgument, evidenceArgument, outputArgument] = process.argv.slice(2);
assert(checkoutArgument && evidenceArgument, "canonical checkout and evidence directory required");
const checkout = resolve(checkoutArgument), evidence = resolve(evidenceArgument);
const pinnedSource = "35db0e1929979f569e4758cd105f4df805a6c6d3";
const sources = [
  "packages/cube-core/res/PwCore.res",
  "packages/cube-mechanics/res/PwMechanics.res",
  "packages/cube-core/src/index.ts",
  "packages/cube-mechanics/src/index.ts",
];
const hashes = {};
for (const name of sources) {
  const pinned = execFileSync("git", ["show", `${pinnedSource}:${name}`], { cwd: checkout });
  const actual = readFileSync(join(checkout, name));
  assert.deepEqual(actual, pinned, `canonical source drift: ${name}`);
  hashes[name] = createHash("sha256").update(actual).digest("hex");
}
const core = await import(pathToFileURL(join(checkout, "packages/cube-core/src/index.ts")));
const mechanics = await import(pathToFileURL(join(checkout, "packages/cube-mechanics/src/index.ts")));
const front = [[-1, 1, 1], [1, 1, 1], [-1, -1, 1], [1, -1, 1]];
const categories = ["Build", "Test", "Analyze", "Review"];
const states = ["open", "running", "OK", "error", "blocked"];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hashFile = (name) => createHash("sha256").update(readFileSync(join(evidence, name))).digest("hex");

function word(record) {
  assert(Array.isArray(record.moves));
  for (const token of record.moves) assert.match(token, /^[RLUDFB](2|')?$/u);
  assert.equal(record.htm, record.moves.length);
  if (record.qtm !== undefined)
    assert.equal(record.qtm, record.moves.reduce((sum, token) => sum + (token.endsWith("2") ? 2 : 1), 0));
  return mechanics.parseAlg(record.moves.join(" "));
}

function displayed(print, physical, labels) {
  const poses = mechanics.stickerPoses(print, physical);
  assert.equal(poses.length, 24);
  assert.equal(new Set(poses.map((pose) => pose.id)).size, 24);
  assert.equal(new Set(poses.map((pose) => JSON.stringify([pose.p, pose.n]))).size, 24);
  return front.map((position, slot) => {
    const matches = poses.filter((pose) => eq(pose.p, position) && eq(pose.n, [0, 0, 1]));
    assert.equal(matches.length, 1);
    const pose = matches[0];
    assert.equal(pose.assetId, `quality-${categories[slot].toLowerCase()}-${states[labels[slot] - 1].toLowerCase()}`);
    assert.deepEqual(pose.up, [0, 1, 0], "category and state must both be upright");
    return { id: pose.id, assetId: pose.assetId, up: pose.up };
  });
}

function checkRecord(print, from, record) {
  const moves = word(record);
  const actual = mechanics.applyMoves(from, moves);
  core.validateState(actual, print);
  const compact = [...actual.cubies].sort((a, b) => a.id - b.id).map((body) => [body.id, body.position, body.orientation]);
  const digest = createHash("sha256").update(JSON.stringify(compact)).digest("hex");
  assert.equal(digest, record.physicalStateSHA256, "complete body pose differs from Julia output");
  const tiles = displayed(print, actual, record.states);
  if (record.front) assert.deepEqual(tiles, record.front);
  assert(core.stateEquals(mechanics.applyMoves(actual, mechanics.inverseMoves(moves)), from), "inverse restoration");
  return actual;
}

const results = [];
for (const count of [4, 5]) for (const style of ["neutral", "labeled"]) {
  const name = `${count}-state-${style}`, filename = `${name}-witnesses.json`;
  const document = JSON.parse(readFileSync(join(evidence, filename), "utf8"));
  assert.deepEqual(document.categories, categories);
  assert.deepEqual(document.stateNames, states.slice(0, count));
  const print = core.validatePrint(document.print);
  assert.equal(print.cubies.length, 8);
  assert.equal(print.stickers.length, 24);
  const initial = mechanics.initialState(print), before = JSON.stringify(print);
  const seen = new Set();
  assert.equal(document.setupWitnesses.length, count ** 4);
  for (const record of document.setupWitnesses) {
    assert.equal(record.states.length, 4);
    for (const value of record.states) assert(Number.isInteger(value) && value >= 1 && value <= count);
    const key = record.states.join(",");
    assert(!seen.has(key), "duplicate display instead of complete coverage");
    seen.add(key);
    checkRecord(print, initial, record);
  }
  assert.equal(seen.size, count ** 4);
  let actual = initial;
  for (const record of document.continuousSequence) actual = checkRecord(print, actual, record);
  assert.equal(document.continuousSequence.length, 2 * count ** 4);
  assert.equal(JSON.stringify(print), before, "immutable print changed during replay");

  // Exact upright category positions matter; camera/whole-cube rotation cannot
  // replace assembling the requested combinations with actual layer moves.
  const wholeCubeDisplays = new Set();
  for (const rotation of mechanics.ROTATIONS) {
    const rotated = core.validateState({
      ...initial,
      cubies: print.cubies.map((body) => ({
        id: body.id,
        position: core.rotate(body.position, rotation),
        orientation: rotation,
      })),
    }, print);
    const poses = mechanics.stickerPoses(print, rotated);
    const labels = front.map((p) => poses.find((pose) => eq(pose.p, p) && eq(pose.n, [0, 0, 1])));
    if (labels.every((pose, slot) => eq(pose.up, [0, 1, 0]) && pose.assetId.startsWith(`quality-${categories[slot].toLowerCase()}-`)))
      wholeCubeDisplays.add(labels.map((pose) => pose.assetId).join(","));
  }
  assert(wholeCubeDisplays.size < seen.size, "design still only selects whole-cube faces");

  // Mutation controls show that the boundary rejects an incorrect path, wrong
  // local print-up and a falsely declared complete body pose.
  const nonempty = document.setupWitnesses.find((record) => record.moves.length > 0);
  assert(nonempty);
  const missingTurn = structuredClone(nonempty);
  missingTurn.moves.pop(); missingTurn.htm--;
  if (missingTurn.qtm !== undefined) delete missingTurn.qtm;
  assert.throws(() => checkRecord(print, initial, missingTurn));
  const badPose = structuredClone(nonempty);
  badPose.physicalStateSHA256 = "0".repeat(64);
  assert.throws(() => checkRecord(print, initial, badPose));
  const rotatedPrint = structuredClone(print);
  const used = nonempty.front[0].id;
  rotatedPrint.stickers.find((sticker) => sticker.id === used).up = print.stickers.find((sticker) => sticker.id === used).up.map((v) => -v);
  assert.throws(() => checkRecord(core.validatePrint(rotatedPrint), mechanics.initialState(rotatedPrint), nonempty));
  results.push({ name, setups: seen.size, continuousTransitions: document.continuousSequence.length,
    validWholeCubeRotations: wholeCubeDisplays.size, negativeControls: 3, witnessSHA256: hashFile(filename) });
}

const lowerBoundResults = [];
const lowerBoundPath = join(evidence, "five-state-family-lower-bounds.json");
assert(existsSync(lowerBoundPath), "finite-family lower-bound artifact is required");
if (existsSync(lowerBoundPath)) {
  const document = JSON.parse(readFileSync(lowerBoundPath, "utf8"));
  assert.equal(document.records.length, 100);
  const seen = new Set();
  for (const record of document.records) {
    assert(!seen.has(record.pattern.join(",")));
    seen.add(record.pattern.join(","));
    const print = core.validatePrint(record.print), initial = mechanics.initialState(print);
    const source = checkRecord(print, initial, { moves: record.sourceMoves, htm: record.sourceMoves.length,
      states: record.sourceStates, physicalStateSHA256: record.sourcePhysicalStateSHA256 });
    const target = checkRecord(print, source, { moves: record.targetMoves, htm: record.targetMoves.length,
      states: record.targetStates, physicalStateSHA256: record.targetPhysicalStateSHA256 });
    assert.equal(record.targetMoves.length, 6);
    assert.equal(record.exactHTM, 6);
    const sourceFront = displayed(print, source, record.sourceStates);
    const targetFront = displayed(print, target, record.targetStates);
    const changed = sourceFront.map((tile, slot) => tile.assetId === targetFront[slot].assetId ? -1 : slot).filter((slot) => slot >= 0);
    assert.deepEqual(changed, [0]);
    const oldBody = print.stickers.find((sticker) => sticker.id === sourceFront[0].id).cubie;
    const alternatives = print.stickers.filter((sticker) => sticker.assetId === targetFront[0].assetId);
    assert(alternatives.length > 0 && alternatives.every((sticker) => sticker.cubie === oldBody));
    for (const slot of [1, 2, 3])
      assert.equal(print.stickers.filter((sticker) => sticker.assetId === targetFront[slot].assetId).length, 1);
    assert(record.targetAlternativeDistances.every((distance) => distance === 6));
  }
  lowerBoundResults.push({ candidates: seen.size, reachableSourceWitnesses: seen.size,
    sixMoveTargetWitnesses: seen.size, scope: "Physical witnesses and target-copy obstruction; distance lower bound needs the separate finite certificate check." });
}

const report = { valid: true, scope: "Existing canonical mechanics replay; independent research review still required.",
  pinnedSource, checkoutHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim(),
  sourceHashes: hashes, results, lowerBoundResults };
if (outputArgument) writeFileSync(resolve(outputArgument), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
