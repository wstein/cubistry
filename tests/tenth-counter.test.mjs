import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  TENTH_MODULUS,
  TENTH_MOVE_MS,
  TENTH_WORDS,
  TENTH_PRINT,
  TENTH_RUN,
  tenthTarget,
  MsTimerTenthCube,
} from "../src/apps/ms-timer/tenth.ts";
import { applyMoves, initialState, matchesTarget, parseAlg } from "@cubistry/cube-mechanics";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("tenth-second Period-1 sequence is an exact 10-step cycle holding stationary 1/10 sticker", () => {
  assert.equal(TENTH_MODULUS, 10);
  assert.equal(TENTH_WORDS.length, 10);
  assert.equal(TENTH_MOVE_MS, 50);

  let state = initialState(TENTH_PRINT);
  for (let i = 0; i < 10; i++) {
    assert(
      matchesTarget(TENTH_PRINT, state, tenthTarget(i)),
      `Target at node ${i} must show digit ${i} and stationary 1/10 unit sticker`,
    );
    const moves = parseAlg(TENTH_WORDS[i]);
    state = applyMoves(state, moves);
  }
  assert.deepEqual(state, initialState(TENTH_PRINT), "Sequence must close after 10 steps");
});

test("tenth-second print preset ms-timer-tenth-20mm-3sets is verified and in catalog", () => {
  const catalog = JSON.parse(readFileSync("public/print/catalog.json", "utf8"));
  const entry = catalog.entries.find((e) => e.id === "ms-timer-tenth-20mm-3sets");
  assert(entry, "Preset ms-timer-tenth-20mm-3sets must be in print catalog");
  assert.equal(entry.design, "ms-timer-tenth");
  assert.equal(entry.sizeMm, 20);
  assert.equal(entry.copies, 3);
  assert.equal(entry.stickerCount, 72);

  const dir = "public/print/" + entry.directory;
  for (const [file, hash] of Object.entries(entry.files)) {
    const actual = sha256(readFileSync(dir + file));
    assert.equal(actual, hash, `File ${file} sha256 mismatch`);
  }

  // Check net.svg contains outside views of all 6 faces and 24 stickers
  const netSvg = readFileSync(dir + "net.svg", "utf8");
  for (const face of ["U", "L", "F", "R", "B", "D"]) {
    assert(netSvg.includes(`text-anchor="middle">${face}</text>`), `Net must label face ${face}`);
  }
  for (let i = 0; i < 24; i++) {
    assert(netSvg.includes(`id="sticker-${i}"`), `Net must include sticker-${i}`);
  }
});

test("MsTimerTenthCube step, reset, set and request update state and advance through 0-9", async () => {
  const mockView = {
    configure() {},
    animate() {
      return Promise.resolve();
    },
    resetCamera() {},
  };
  const mockAssets = { dispose() {} };
  let reportedValue = -1;
  let reportedBusy = false;

  const cube = new MsTimerTenthCube(
    mockView,
    { schema: "cubistry.assets", version: 1, fonts: [], documents: [], images: [] },
    (v, busy) => {
      reportedValue = v;
      reportedBusy = busy;
    },
    () => Promise.resolve(mockAssets),
  );

  await cube.configure(0);
  assert.equal(cube.currentValue, 0);
  assert.equal(reportedValue, 0);
  assert.equal(reportedBusy, false);

  // Step +1 -> 1
  await cube.step(1);
  assert.equal(cube.currentValue, 1);

  // Step +1 -> 2
  await cube.step(1);
  assert.equal(cube.currentValue, 2);

  // Step -1 -> 1
  await cube.step(-1);
  assert.equal(cube.currentValue, 1);

  // Set 7
  await cube.set(7);
  assert.equal(cube.currentValue, 7);

  // Reset -> 0
  await cube.reset();
  assert.equal(cube.currentValue, 0);

  // Request 9
  cube.request(9);
  while (cube.busy) {
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(cube.currentValue, 9);
});

test("all 90 tenth transitions loaded from file are verified against tenthTarget", async () => {
  const {
    TENTH_OPTIMAL_TRANSITIONS,
    tenthOptimalMoves,
    tenthTarget,
    TENTH_WORDS,
  } = await import("../src/apps/ms-timer/tenth.ts");
  assert.equal(TENTH_OPTIMAL_TRANSITIONS.length, 90);

  // Compute the 10 canonical period states
  const canonicalStates = [initialState(TENTH_PRINT)];
  for (let i = 0; i < 9; i++) {
    canonicalStates.push(applyMoves(canonicalStates[i], parseAlg(TENTH_WORDS[i])));
  }

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const t of TENTH_OPTIMAL_TRANSITIONS) {
    assert(t.from >= 0 && t.from < 10);
    assert(t.to >= 0 && t.to < 10);
    assert.notEqual(t.from, t.to);

    const moves = parseAlg(t.alg);
    assert.equal(moves.length, t.htm);
    assert.deepEqual(moves, tenthOptimalMoves(t.from, t.to));
    counts[t.htm] = (counts[t.htm] || 0) + 1;

    // Apply moves to canonical starting state
    const endState = applyMoves(canonicalStates[t.from], moves);
    assert(
      matchesTarget(TENTH_PRINT, endState, tenthTarget(t.to)),
      `Transition ${t.from} -> ${t.to} with ${t.alg} must match tenthTarget(${t.to})`,
    );
  }

  // Distribution matches exact BFS: 33 1-move, 35 2-move, 19 3-move, 3 4-move
  assert.equal(counts[1], 33);
  assert.equal(counts[2], 35);
  assert.equal(counts[3], 19);
  assert.equal(counts[4], 3);
  assert.equal(counts[1] + counts[2] + counts[3], 87); // 96.7% <= 3 moves
});
