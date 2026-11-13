// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { angleFromProgress, displayAngle, netQuarters, reduceQuarters, MAGNET_DEG } from "../packages/cube-viewer/src/play-gesture-turn.ts";

test("angle follows the progress linearly in both directions, pxPerQuarter px = 90 degrees", () => {
  assert.equal(angleFromProgress(0, 120), 0);
  assert.equal(angleFromProgress(120, 120), 90);
  assert.equal(angleFromProgress(-60, 120), -45);
  assert.equal(angleFromProgress(480, 120), 360);
  assert.throws(() => angleFromProgress(1, 0), /pxPerQuarter/);
  assert.throws(() => angleFromProgress(1, NaN), /pxPerQuarter/);
});

test("magnet: within 8 degrees of every multiple of 90 the layer sits exactly on it, outside it is free", () => {
  assert.equal(MAGNET_DEG, 8);
  for (let m = -8; m <= 8; m++) {
    assert.equal(displayAngle(m * 90 + 7.9), m * 90, `above ${m}`);
    assert.equal(displayAngle(m * 90 - 7.9), m * 90, `below ${m}`);
    assert.equal(displayAngle(m * 90 + 8), m * 90, "boundary inclusive");
    assert.equal(displayAngle(m * 90 + 8.5), m * 90 + 8.5);
    assert.equal(displayAngle(m * 90 - 8.5), m * 90 - 8.5);
  }
  assert.equal(displayAngle(45), 45);
  assert.equal(displayAngle(10, 12), 0, "custom window");
});

test("free path: the displayed angle may go past a quarter and come back (270 then 90)", () => {
  assert.equal(displayAngle(270), 270);
  assert.equal(displayAngle(180), 180);
  assert.equal(displayAngle(90), 90);
  assert.equal(displayAngle(-130), -130);
});

test("release rounds to the nearest quarter; ties go away from zero", () => {
  assert.equal(netQuarters(44.9), 0);
  assert.equal(netQuarters(45), 1);
  assert.equal(netQuarters(-45), -1);
  assert.equal(netQuarters(-44.9), 0);
  assert.equal(netQuarters(134.9), 1);
  assert.equal(netQuarters(135), 2);
  assert.equal(netQuarters(270), 3);
  assert.equal(netQuarters(-400), -4);
  assert.ok(Object.is(netQuarters(-10), 0), "no negative zero");
});

test("net 0 is no move: returning to the start without release has net 0", () => {
  assert.equal(netQuarters(angleFromProgress(0, 100)), 0);
  assert.equal(netQuarters(angleFromProgress(37, 100) - angleFromProgress(37, 100)), 0);
});

test("reduceQuarters maps the net turn to the physical move: 0 none, +-1 quarter, 2 half, full turns vanish", () => {
  const expect = { "-8": 0, "-7": 1, "-6": 2, "-5": -1, "-4": 0, "-3": 1, "-2": 2, "-1": -1, 0: 0, 1: 1, 2: 2, 3: -1, 4: 0, 5: 1, 6: 2, 7: -1, 8: 0 };
  for (const [q, r] of Object.entries(expect)) assert.equal(reduceQuarters(Number(q)), r, `q=${q}`);
  assert.throws(() => reduceQuarters(0.5), /integer/);
});
