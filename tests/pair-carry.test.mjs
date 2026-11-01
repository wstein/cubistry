// Pure carry rule and per-cube carry budget of the pair (M/S Timer stack):
// both parameter sets (M/S 60/60, H/M 60/24), no cube controllers.
import test from "node:test";
import assert from "node:assert/strict";
import { MS_MODULI, HM_MODULI, carryStep, planCarryBudget } from "../src/apps/pair/carry.ts";
import { planSequence } from "../src/apps/timer/scheduler.ts";

const at = (text) => {
  const [major, minor] = text.split(":").map(Number);
  return major * 60 + minor;
};
const label = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;

test("presets name the plans' moduli", () => {
  assert.deepEqual(MS_MODULI, { minorModulus: 60, majorModulus: 60 });
  assert.deepEqual(HM_MODULI, { minorModulus: 60, majorModulus: 24 });
});

test("the carry rule over every value of both parameter sets, both directions", () => {
  for (const moduli of [MS_MODULI, HM_MODULI, { minorModulus: 7, majorModulus: 5 }]) {
    const { minorModulus: m, majorModulus: M } = moduli;
    let carries = 0;
    for (const direction of [1, -1])
      for (let v = 0; v < m * M; v++) {
        const s = carryStep(moduli, v, direction),
          minor = v % m,
          major = Math.floor(v / m);
        // Independent: the minor digit moves by one modulo m on every step ...
        assert.equal(s.minor, (minor + direction + m) % m);
        // ... and the major digit exactly when the minor digit wraps.
        const wrapped = direction === 1 ? s.minor === 0 : s.minor === m - 1;
        assert.equal(s.carry, wrapped);
        assert.equal(s.major, wrapped ? (major + direction + M) % M : major);
        assert.equal(s.to, s.major * m + s.minor);
        assert.equal(carryStep(moduli, s.to, -direction).to, v, "the reverse step returns");
        if (s.carry) carries++;
      }
    assert.equal(carries, 2 * M, "one carry per major value and direction");
  }
});

test("the named carries of both plans, up and down", () => {
  for (const [moduli, a, b] of [
    [MS_MODULI, "00:59", "01:00"],
    [MS_MODULI, "01:59", "02:00"],
    [MS_MODULI, "58:59", "59:00"],
    [MS_MODULI, "14:59", "15:00"],
    [MS_MODULI, "35:59", "36:00"],
    [MS_MODULI, "55:59", "56:00"],
    [MS_MODULI, "59:59", "00:00"],
    [HM_MODULI, "12:59", "13:00"],
    [HM_MODULI, "23:59", "00:00"],
  ]) {
    const up = carryStep(moduli, at(a), 1),
      down = carryStep(moduli, at(b), -1);
    assert.deepEqual([label(up.to), up.carry], [b, true], `${a} -> ${b}`);
    assert.deepEqual([label(down.to), down.carry], [a, true], `${b} -> ${a}`);
  }
  assert.equal(carryStep(MS_MODULI, at("59:00"), 1).carry, false);
  assert.equal(carryStep(HM_MODULI, at("12:58"), 1).carry, false);
  for (const bad of [
    [MS_MODULI, 0, 0],
    [MS_MODULI, 3600, 1],
    [HM_MODULI, 1440, 1],
    [HM_MODULI, 1.5, 1],
    [{ minorModulus: 1, majorModulus: 24 }, 0, 1],
  ])
    assert.throws(() => carryStep(...bad));
});

test("carry budget: one whole budget per cube, the step planned for the larger word", () => {
  // Derived arithmetic of the M/S Timer plan (A4) at 1x: I = 1000, B = 500.
  const four = planCarryBudget({ minor: 3, major: 4 }, 100, 1000);
  assert.equal(four.larger, 4);
  assert.equal(four.feasible, true);
  assert.equal(four.major.effective, (500 - 308 - 20) / 4); // 43 ms
  assert.equal(four.minor.effective, (500 - 233 - 20) / 3); // 82.3 ms
  // The words are not chained: a serial 3 + 4 = 7 moves does not fit.
  assert.equal(planSequence(7, 100, 1000).feasible, false);
  assert.equal(four.duration, Math.max(four.minor.duration, four.major.duration));
  const plain = planCarryBudget({ minor: 3, major: null }, 100, 1000);
  assert.deepEqual([plain.major, plain.larger, plain.feasible], [null, 3, true]);
  // Feasible exactly when the larger word fits on its own.
  for (const interval of [100, 400, 600, 735, 736, 1000, 2000])
    for (let minor = 0; minor <= 4; minor++)
      for (const major of [null, 0, 1, 2, 3, 4])
        assert.equal(
          planCarryBudget({ minor, major }, 100, interval).feasible,
          planSequence(Math.max(minor, major ?? 0), 100, interval).feasible,
          JSON.stringify({ interval, minor, major }),
        );
  // 10x: not even one move fits (plan A5). Less remaining time, less budget.
  assert.equal(planCarryBudget({ minor: 1, major: null }, 100, 100).feasible, false);
  assert.equal(planCarryBudget({ minor: 3, major: 4 }, 100, 1000, 300).feasible, false);
  for (const bad of [
    [{ minor: -1, major: null }, 100, 1000],
    [{ minor: 1.5, major: null }, 100, 1000],
    [{ minor: 1, major: null }, 0, 1000],
    [{ minor: 1, major: null }, 100, NaN],
    [{ minor: 1, major: null }, 100, 1000, NaN],
  ])
    assert.throws(() => planCarryBudget(...bad), /budget/);
});
