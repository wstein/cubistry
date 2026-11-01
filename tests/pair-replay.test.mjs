// Exhaustive replay of the pair controller on a fully independent cube model
// (tests/helpers/pair-replay.mjs: the converted runtimes read as raw JSON and
// replayed with integer quarter-turn rotations, no code shared with
// cube-mechanics, the controllers or their periods). tests/pair-controller.test.mjs
// pins the carry cases, Set/Reset routes, parallel settle and contracts; this
// file adds, on the independent model: every M/S value both ways with both
// seconds laps and no pose off the saved period (Set and Reset included), and
// every H/M value both ways on the saved words of the counting mode.
// Software regression tests, not proofs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMsDesign } from "../src/apps/ms/design.ts";
import { MsController } from "../src/apps/ms/controller.ts";
import { validateHsmDesign } from "../src/apps/hsm/design.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import { PairController } from "../src/apps/pair/controller.ts";
import { hsmPairUnit } from "../src/apps/pair/hsm-unit.ts";
import { serializeMove } from "../packages/cube-mechanics/src/index.ts";
import { loadS3Replay, loadHsmReplay, ReplayCube, key, shows, inverseWord, htm } from "./helpers/pair-replay.mjs";

const s3 = validateMsDesign(JSON.parse(readFileSync("public/ms-counter.v1.json", "utf8"))).print;
const hsm = validateHsmDesign(JSON.parse(readFileSync("public/hsm-counter.v3.json", "utf8")));
const msReplay = loadS3Replay();
const hsmReplay = loadHsmReplay();
const assets = async () => ({ dispose() {} });
const label = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;

/** A view feeding an independent replay cube; `period` flags any pose off the saved period. */
function replayView(model, period, offPeriod, name) {
  return {
    configure() {},
    resetCamera() {},
    animate: async (presentation) => {
      model.apply(presentation.move);
      const k = key(model.state);
      if (period && !period.onPeriod.has(k) && !period.nodeIndex.has(k)) offPeriod.push(name);
    },
  };
}

/** Independent check of one settled cube step: the saved word from a node to the next node, and the digit. */
function checkWord(model, period, letter, digit, direction, inverse, label) {
  const n = period.nodes.length,
    before = model.before,
    from = period.nodeIndex.get(key(before)),
    played = model.take();
  assert.ok(from !== undefined, `${label}: started on a period node`);
  const word = inverse && direction === -1 ? inverseWord(period.words[(from - 1 + n) % n]) : period.words[from];
  const next = inverse ? (from + direction + n) % n : (from + 1) % n;
  assert.equal(played, word, `${label}: the saved word`);
  assert.equal(period.nodeIndex.get(key(model.state)), next, `${label}: the next period node`);
  assert.ok(shows(model.state, letter, digit), `${label}: shows ${digit}`);
  model.before = model.state;
  return htm(played);
}

async function msPair(from) {
  const offPeriod = [],
    model = {
      minor: new ReplayCube(msReplay.start("S", from % 60), serializeMove),
      major: new ReplayCube(msReplay.start("M", Math.floor(from / 60)), serializeMove),
    };
  const pair = new PairController({
    minorModulus: 60,
    majorModulus: 60,
    createMinor: (s) =>
      new MsController(replayView(model.minor, msReplay.periods.S, offPeriod, "S"), s3, {}, "S", s, assets),
    createMajor: (s) =>
      new MsController(replayView(model.major, msReplay.periods.M, offPeriod, "M"), s3, {}, "M", s, assets),
  });
  await pair.configure(from, 1);
  model.minor.before = model.minor.state;
  model.major.before = model.major.state;
  return { pair, model, offPeriod };
}

test("M/S on the independent model: all 3600 values up and down, both seconds laps, no pose off the period", async () => {
  const { pair, model, offPeriod } = await msPair(0);
  const S = msReplay.periods.S,
    M = msReplay.periods.M;
  assert.equal(S.nodes.length, 120, "S3 seconds: two laps");
  assert.equal(M.nodes.length, 60);
  const startS = key(model.minor.state),
    startM = key(model.major.state);
  for (const direction of [1, -1]) {
    let carries = 0,
      lapTwo = 0;
    for (let i = 1; i <= 3600; i++) {
      const before = pair.value,
        value = (before + direction + 3600) % 3600,
        carry = Math.floor(value / 60) !== Math.floor(before / 60);
      await pair.step(direction);
      assert.equal(pair.value, value);
      checkWord(model.minor, S, "S", value % 60, direction, true, `${label(value)} S`);
      if (carry) {
        carries++;
        const h = checkWord(model.major, M, "M", Math.floor(value / 60), direction, true, `${label(value)} M`);
        // The 4-HTM minutes edges of S3 (docs/MS_COUNTER.md), walked either way.
        const edge = direction === 1 ? Math.floor(before / 60) : Math.floor(value / 60);
        assert.equal(h === 4, [14, 35, 55].includes(edge), `${label(value)}: minutes edge ${edge} has ${h} HTM`);
      } else assert.equal(model.major.take(), "", `${label(value)}: no carry, the minutes cube stays`);
      // Seconds lap: every 60 steps the display repeats; only 120 close the period.
      if (i % 60 === 0) {
        assert.ok(shows(model.minor.state, "S", 0));
        if (i % 120 === 60) {
          lapTwo++;
          assert.notEqual(key(model.minor.state), startS, "lap 2 is a different full pose");
          assert.equal(S.nodeIndex.get(key(model.minor.state)), 60);
        } else assert.equal(key(model.minor.state), startS, "two laps close the seconds period");
      }
    }
    assert.equal(carries, 60);
    assert.equal(lapTwo, 30);
    assert.equal(pair.value, 0);
    assert.equal(key(model.major.state), startM);
  }
  // Set and Reset walk the saved periods: still no pose off the period.
  for (const target of [at("30:45"), at("59:59"), at("00:01"), 0]) {
    await (target === 0 ? pair.reset() : pair.set(target));
    assert.equal(pair.value, target);
    assert.ok(shows(model.minor.state, "S", target % 60) && shows(model.major.state, "M", Math.floor(target / 60)));
    assert.ok(S.nodeIndex.has(key(model.minor.state)) && M.nodeIndex.has(key(model.major.state)));
  }
  assert.deepEqual(offPeriod, [], "no free jumps on S3");
});

function at(text) {
  const [major, minor] = text.split(":").map(Number);
  return major * 60 + minor;
}

for (const direction of [1, -1])
  test(`H/M on the independent model: all 1440 values counting ${direction === 1 ? "up" : "down"} on the mode's saved words`, async () => {
    const H = hsmReplay.period("H", 23, direction),
      M = hsmReplay.period("M", 59, direction);
    const model = {
      minor: new ReplayCube(hsmReplay.start("M", 59, direction, 0), serializeMove),
      major: new ReplayCube(hsmReplay.start("H", 23, direction, 0), serializeMove),
    };
    const unit = (m, letter, range) => (s) =>
      hsmPairUnit(new HsmController(replayView(m, null, [], letter), hsm, {}, letter, s, assets), range);
    const pair = new PairController({
      minorModulus: 60,
      majorModulus: 24,
      createMinor: unit(model.minor, "M", 59),
      createMajor: unit(model.major, "H", 23),
    });
    await pair.configure(0, direction);
    model.minor.before = model.minor.state;
    model.major.before = model.major.state;
    const startM = key(model.minor.state),
      startH = key(model.major.state);
    let carries = 0;
    for (let i = 1; i <= 1440; i++) {
      const before = pair.value,
        value = (before + direction + 1440) % 1440;
      await pair.step(direction);
      assert.equal(pair.value, value);
      // The first step already fails here (not later, not as a hang) if a cube
      // was left in the other counting direction.
      assert.ok(checkWord(model.minor, M, "M", value % 60, direction, false, `${label(value)} M`) <= 5);
      if (Math.floor(value / 60) !== Math.floor(before / 60)) {
        carries++;
        assert.ok(checkWord(model.major, H, "H", Math.floor(value / 60), direction, false, `${label(value)} H`) <= 5);
      } else assert.equal(model.major.take(), "", `${label(value)}: no carry, the hours cube stays`);
    }
    assert.equal(carries, 24);
    // Both periods span two laps on this print (H 00-23: 48 edges, M 00-59:
    // 120 edges). 1440 steps are 12 whole minutes periods but one hours lap.
    assert.equal(H.nodes.length, 48);
    assert.equal(M.nodes.length, 120);
    assert.equal(key(model.minor.state), startM);
    assert.notEqual(key(model.major.state), startH);
    assert.equal(H.nodeIndex.get(key(model.major.state)), 24);
  });
