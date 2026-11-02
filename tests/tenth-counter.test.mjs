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

test("all 90 tenth transitions loaded from file are verified against canonical states (all 8 cubies matter)", async () => {
  const {
    TENTH_OPTIMAL_TRANSITIONS,
    tenthOptimalMoves,
    tenthTarget,
    TENTH_WORDS,
  } = await import("../src/apps/ms-timer/tenth.ts");
  const { stateEquals } = await import("@cubistry/cube-core");
  assert.equal(TENTH_OPTIMAL_TRANSITIONS.length, 90);

  // Compute the 10 canonical period states
  const canonicalStates = [initialState(TENTH_PRINT)];
  for (let i = 0; i < 9; i++) {
    canonicalStates.push(applyMoves(canonicalStates[i], parseAlg(TENTH_WORDS[i])));
  }

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
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
      stateEquals(endState, canonicalStates[t.to]),
      `Transition ${t.from} -> ${t.to} with ${t.alg} must match canonical state ${t.to} on all 8 cubies`,
    );
    assert(
      matchesTarget(TENTH_PRINT, endState, tenthTarget(t.to)),
      `Transition ${t.from} -> ${t.to} with ${t.alg} must match tenthTarget(${t.to})`,
    );
  }

  // Exact distribution of shortest paths between canonical period nodes preserving all 8 cubies:
  assert.equal(counts[1], 14);
  assert.equal(counts[2], 16);
  assert.equal(counts[3], 16);
  assert.equal(counts[4], 12);
  assert.equal(counts[5], 20);
  assert.equal(counts[6], 12);
});

test("setting any state keeps valid full cycle cubie state where all 8 cubies matter", async () => {
  const {
    TENTH_PRINT,
    TENTH_WORDS,
    MsTimerTenthCube,
  } = await import("../src/apps/ms-timer/tenth.ts");
  const { stateEquals } = await import("@cubistry/cube-core");

  const canonicalStates = [initialState(TENTH_PRINT)];
  for (let i = 0; i < 9; i++) {
    canonicalStates.push(applyMoves(canonicalStates[i], parseAlg(TENTH_WORDS[i])));
  }

  const mockView = {
    configure() {},
    animate() {
      return Promise.resolve();
    },
    resetCamera() {},
  };
  const mockAssets = { dispose() {} };

  const cube = new MsTimerTenthCube(
    mockView,
    { schema: "cubistry.assets", version: 1, fonts: [], documents: [], images: [] },
    () => {},
    () => Promise.resolve(mockAssets),
  );

  await cube.configure(0);
  assert(stateEquals(cube.state, canonicalStates[0]), "Configured at 0 must match canonical state 0");

  // Setting every digit must result in exact canonical cycle node on all 8 cubies
  for (let target = 0; target < 10; target++) {
    await cube.set(target);
    assert(
      stateEquals(cube.state, canonicalStates[target]),
      `Setting ${target} must land on canonical state ${target} (all 8 cubies matter)`,
    );
  }

  // Stepping +1 and -1 must also preserve all 8 cubies
  await cube.set(0);
  for (let i = 0; i < 10; i++) {
    await cube.step(1);
    const expected = (i + 1) % 10;
    assert(
      stateEquals(cube.state, canonicalStates[expected]),
      `Step +1 to ${expected} must land on canonical state ${expected} (all 8 cubies matter)`,
    );
  }

  await cube.set(0);
  for (let i = 0; i < 10; i++) {
    await cube.step(-1);
    const expected = ((10 - i - 1) % 10 + 10) % 10;
    assert(
      stateEquals(cube.state, canonicalStates[expected]),
      `Step -1 to ${expected} must land on canonical state ${expected} (all 8 cubies matter)`,
    );
  }
});

test("tenth-speed options and hardwired turn speeds match specification", async () => {
  const {
    TENTH_STEP_INTERVALS,
    DEFAULT_TENTH_STEP_INTERVAL,
    TENTH_HARDWIRED_TURN_SPEEDS,
    tenthTurnSpeedForInterval,
  } = await import("../src/apps/ms-timer/tenth.ts");

  assert.deepEqual([...TENTH_STEP_INTERVALS], [2000, 1000, 500, 100]);
  assert.equal(DEFAULT_TENTH_STEP_INTERVAL, 1000);

  // Hardwired turn speed verification:
  // 100ms -> 50ms, 500ms -> 100ms, 1s (1000ms) -> 250ms, 2s (2000ms) -> 500ms
  assert.equal(TENTH_HARDWIRED_TURN_SPEEDS[100], 50);
  assert.equal(TENTH_HARDWIRED_TURN_SPEEDS[500], 100);
  assert.equal(TENTH_HARDWIRED_TURN_SPEEDS[1000], 250);
  assert.equal(TENTH_HARDWIRED_TURN_SPEEDS[2000], 500);

  assert.equal(tenthTurnSpeedForInterval(100), 50);
  assert.equal(tenthTurnSpeedForInterval(500), 100);
  assert.equal(tenthTurnSpeedForInterval(1000), 250);
  assert.equal(tenthTurnSpeedForInterval(2000), 500);

  // Check index.html UI elements
  const html = readFileSync("index.html", "utf8");
  assert(html.includes('<select id="tenth-speed">'));
  assert(html.includes('<option value="2000">2s</option>'));
  assert(html.includes('<option value="1000" selected>1s</option>'));
  assert(html.includes('<option value="500">500ms</option>'));
  assert(html.includes('<option value="100">100ms</option>'));
});
