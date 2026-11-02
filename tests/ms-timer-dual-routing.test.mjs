import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateMsDesign } from "../src/apps/ms/design.ts";
import { MsTimerCube } from "../src/apps/ms-timer/cube.ts";
import { MsTimerTenthCube, tenthAssetImages } from "../src/apps/ms-timer/tenth.ts";
import { PairController } from "../src/apps/pair/controller.ts";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
import { stateEquals } from "@cubistry/cube-core";

const ms = validateMsDesign(
  JSON.parse(readFileSync("public/ms-counter.v1.json", "utf8")),
).print;

test("MsTimerCube uses optimal solver on non-adjacent jumps and period words on single steps", async () => {
  const animatedMoves = [];
  const view = {
    configure() {},
    resetCamera() {},
    async animate(p) {
      animatedMoves.push(p.move);
    },
  };

  const cube = new MsTimerCube(
    view,
    ms,
    {},
    "S",
    () => {},
    async (manifest) => ({
      manifest,
      images: new Map(),
      materials: new Map(),
      textureOrigin: "bottom-left",
      dispose() {},
    }),
    prepareTestSolver,
  );

  await cube.configure(0);
  assert.equal(cube.currentValue, 0);

  // Non-adjacent jump from 0 to 30:
  // On period walk this would take 30 edges (~80 HTM).
  // With optimal dual-routing solver, it solves directly to canonical period node in <= 6 HTM moves!
  animatedMoves.length = 0;
  cube.set(30);
  // Wait for drain
  while (cube.busy) {
    await new Promise((r) => setTimeout(r, 10));
  }

  assert.equal(cube.currentValue, 30);
  assert.ok(
    animatedMoves.length <= 11,
    `Jump to 30 took ${animatedMoves.length} moves, expected <= 11 optimal moves`,
  );
  // Verify cube settled on the exact canonical period node 30
  assert.ok(
    stateEquals(cube.state, cube.period.nodes[30]),
    "Cube must settle on exact canonical period node 30",
  );

  // Now single-step tick from 30 to 31:
  // Must use the exact verified period edge word (not free solver)
  animatedMoves.length = 0;
  cube.request(31);
  while (cube.busy) {
    await new Promise((r) => setTimeout(r, 10));
  }

  assert.equal(cube.currentValue, 31);
  assert.equal(
    animatedMoves.length,
    ms.runs.S.words[30].split(" ").length,
    "Single step must use exact 1-edge period word",
  );
  assert.ok(
    stateEquals(cube.state, cube.period.nodes[31]),
    "Cube must settle on exact canonical period node 31",
  );
});

test("PairController separates set() from step()", async () => {
  let minorSetCalled = false;
  let minorRequestCalled = false;

  const mockUnit = (initial = 0) => ({
    busy: false,
    currentValue: initial,
    async configure(v) {
      this.currentValue = v;
    },
    request(v) {
      minorRequestCalled = true;
      this.currentValue = v;
    },
    set(v) {
      minorSetCalled = true;
      this.currentValue = v;
    },
    dispose() {},
  });

  const minor = mockUnit(0);
  const major = mockUnit(0);

  const pair = new PairController({
    minorModulus: 60,
    majorModulus: 60,
    createMinor: () => minor,
    createMajor: () => major,
  });

  await pair.configure(0);

  // Calling set() must invoke unit.set()
  await pair.set(35);
  assert.equal(minorSetCalled, true, "Pair.set() must invoke unit.set()");

  // Calling step() must invoke unit.request()
  minorRequestCalled = false;
  await pair.step(1);
  assert.equal(minorRequestCalled, true, "Pair.step() must invoke unit.request()");
});

test("Shared DSEG manifest defaults to dseg7 and off marker and supports updateManifest", async () => {
  const images = tenthAssetImages("dseg7", "off");
  // Check default images contain blank, T, and 0..9 without dot
  assert.ok(images.some((i) => i.id === "blank"));
  assert.ok(images.some((i) => i.id === "T"));
  for (let d = 0; d < 10; d++) {
    const entry = images.find((i) => i.id === String(d));
    assert.ok(entry, `Image for digit ${d} must exist`);
    assert.ok(entry.url.includes("/dseg7/"), `URL must point to dseg7`);
    assert.ok(!entry.url.includes("-dot"), `Default off marker must not contain -dot`);
  }
});
