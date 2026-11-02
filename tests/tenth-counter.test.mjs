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

  // Stepping +1, -1, +5, and -5 must also preserve all 8 cubies
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

  await cube.set(0);
  for (let i = 0; i < 10; i++) {
    const current = cube.currentValue;
    await cube.step(5);
    const expected = (current + 5) % 10;
    assert(
      stateEquals(cube.state, canonicalStates[expected]),
      `Step +5 from ${current} to ${expected} must land on canonical state ${expected} (all 8 cubies matter)`,
    );
  }

  await cube.set(0);
  for (let i = 0; i < 10; i++) {
    const current = cube.currentValue;
    await cube.step(-5);
    const expected = ((current - 5) % 10 + 10) % 10;
    assert(
      stateEquals(cube.state, canonicalStates[expected]),
      `Step -5 from ${current} to ${expected} must land on canonical state ${expected} (all 8 cubies matter)`,
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

  // Dedicated digit buttons 0-9
  for (let d = 0; d < 10; d++) {
    assert(
      html.includes(`data-tenth-target="${d}"`),
      `UI must include digit button ${d}`,
    );
  }

  // Increments: -5, -1, +1, +5
  assert(html.includes('data-tenth-delta="-5"'));
  assert(html.includes('data-tenth-delta="-1"'));
  assert(html.includes('data-tenth-delta="1"'));
  assert(html.includes('data-tenth-delta="5"'));

  // No text input, set-form, or reset button
  assert(!html.includes('id="tenth-value"'), "Must have no tenth-value text input");
  assert(!html.includes('id="tenth-set-form"'), "Must have no tenth-set-form");
  assert(!html.includes('id="tenth-reset"'), "Must have no tenth-reset button");

  // DSEG display & orientation marker UI elements
  assert(html.includes('<select id="tenth-display">'));
  assert(html.includes('<option value="dseg7" selected>7-Segment (DSEG7)</option>'));
  assert(html.includes('<option value="dseg14">14-Segment (DSEG14)</option>'));
  assert(html.includes('<option value="classic">Classic (Geometric)</option>'));

  assert(html.includes('<select id="tenth-marker">'));
  assert(html.includes('<option value="auto">Auto (0, 2, 5, 6, 8, 9)</option>'));
  assert(html.includes('<option value="all">All digits (0–9)</option>'));
  assert(html.includes('<option value="off" selected>Off</option>'));
});

test("DSEG7 and DSEG14 vector assets and orientation dot modes (0, 2, 5, 6, 8, 9) verify cleanly", async () => {
  const {
    tenthAssetImages,
    AMBIGUOUS_TENTH_DIGITS,
    TENTH_PRINT,
    MsTimerTenthCube,
  } = await import("../src/apps/ms-timer/tenth.ts");
  const dsegManifest = JSON.parse(readFileSync("src/apps/ms-timer/dseg-manifests.json", "utf8"));

  // Check all ambiguous digits are exactly {0, 2, 5, 6, 8, 9}
  assert.deepEqual([...AMBIGUOUS_TENTH_DIGITS].sort(), [0, 2, 5, 6, 8, 9]);

  // Check file hashes for every SVG in public/assets/digits
  for (const variant of ["dseg7", "dseg14", "noto-sans", "quicksand", "outfit"]) {
    const entries = dsegManifest[variant];
    assert.equal(Object.keys(entries).length, 30); // 10 clean + 10 dot + 10 line
    for (const [key, info] of Object.entries(entries)) {
      const filePath = "public" + info.url;
      const fileBytes = readFileSync(filePath);
      const computedSha = sha256(fileBytes);
      assert.equal(computedSha, info.sha256, `${filePath} sha256 mismatch`);
      const svgContent = fileBytes.toString("utf8");
      assert(svgContent.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
      assert(svgContent.includes('fill="#fffdf6"'));
      assert(svgContent.includes('fill="#1d4771"'));
    }
  }

  // Verify 'auto' marker mode: dots ONLY on 0, 2, 5, 6, 8, 9
  for (const variant of ["dseg7", "dseg14", "noto-sans", "quicksand", "outfit"]) {
    const autoImages = tenthAssetImages(variant, "auto");
    assert.equal(autoImages.length, 12); // blank, T, 0..9
    for (let d = 0; d < 10; d++) {
      const img = autoImages.find((i) => i.id === String(d));
      assert(img, `Digit ${d} image must be present`);
      if (AMBIGUOUS_TENTH_DIGITS.has(d)) {
        assert(img.url.endsWith(`${d}-dot.svg`), `Digit ${d} must have dot in auto mode`);
      } else {
        assert(img.url.endsWith(`${d}.svg`), `Digit ${d} must NOT have dot in auto mode`);
      }
    }

    // Verify 'all' marker mode: dots on all 0..9
    const allImages = tenthAssetImages(variant, "all");
    for (let d = 0; d < 10; d++) {
      const img = allImages.find((i) => i.id === String(d));
      assert(img.url.endsWith(`${d}-dot.svg`), `Digit ${d} must have dot in all mode`);
    }

    // Verify 'off' marker mode: no dots or lines on any digit
    const offImages = tenthAssetImages(variant, "off");
    for (let d = 0; d < 10; d++) {
      const img = offImages.find((i) => i.id === String(d));
      assert(img.url.endsWith(`${d}.svg`), `Digit ${d} must NOT have dot or line in off mode`);
    }

    // Verify 'line-auto' marker mode: thin underline ONLY on 0, 2, 5, 6, 8, 9
    const lineAutoImages = tenthAssetImages(variant, "line-auto");
    for (let d = 0; d < 10; d++) {
      const img = lineAutoImages.find((i) => i.id === String(d));
      if (AMBIGUOUS_TENTH_DIGITS.has(d)) {
        assert(img.url.endsWith(`${d}-line.svg`), `Digit ${d} must have line in line-auto mode`);
      } else {
        assert(img.url.endsWith(`${d}.svg`), `Digit ${d} must NOT have line in line-auto mode`);
      }
    }

    // Verify 'line-all' marker mode: thin underline on all 0..9
    const lineAllImages = tenthAssetImages(variant, "line-all");
    for (let d = 0; d < 10; d++) {
      const img = lineAllImages.find((i) => i.id === String(d));
      assert(img.url.endsWith(`${d}-line.svg`), `Digit ${d} must have line in line-all mode`);
    }
  }

  // Verify MsTimerTenthCube.updateManifest preserves puzzle state and value
  const mockView = {
    configure() {},
    animate() { return Promise.resolve(); },
    resetCamera() {},
  };
  const mockAssets = { dispose() {} };

  const cube = new MsTimerTenthCube(
    mockView,
    { schema: "cubistry.assets", version: 1, fonts: [], documents: [], images: tenthAssetImages("dseg7", "auto") },
    () => {},
    () => Promise.resolve(mockAssets),
  );

  await cube.configure(6);
  assert.equal(cube.currentValue, 6);
  const stateBefore = cube.state;

  // Switch to DSEG14 in-place
  await cube.updateManifest({
    schema: "cubistry.assets",
    version: 1,
    fonts: [],
    documents: [],
    images: tenthAssetImages("dseg14", "all"),
  });

  assert.equal(cube.currentValue, 6);
  assert.deepEqual(cube.state, stateBefore, "Cube permutation state must be preserved across manifest updates");
});
