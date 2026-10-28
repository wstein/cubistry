import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LiveClockScheduler,
  nextChange,
  clockText,
} from "../src/apps/clock/scheduler.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import { validateHsmDesign, hsmTarget } from "../src/apps/hsm/design.ts";
import { matchesTarget } from "@cubistry/cube-mechanics";
const utc = (epoch) => {
  const d = new Date(epoch);
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
};
function port(value, length = 6) {
  return {
    currentValue: value,
    busy: false,
    requests: [],
    deadline: null,
    deadlines: [],
    queued: null,
    prepare() {
      assert.equal(this.busy, false);
      return Array(length).fill({ face: "R", turns: 1 });
    },
    request(value) {
      this.requests.push(value);
      if (this.busy) {
        this.queued = value;
        return;
      }
      this.pending = value;
      this.busy = true;
    },
    setDeadline(target, endAt, durationMs) {
      this.deadline = { target, endAt, durationMs };
      this.deadlines.push(this.deadline);
    },
    clearDeadline() {
      this.deadline = null;
    },
    settle() {
      this.currentValue = this.pending;
      this.busy = false;
      const q = this.queued;
      this.queued = null;
      if (q !== null && q !== this.currentValue) this.request(q);
    },
  };
}
function units(values) {
  return values.map((value, i) => ({
    controller: port(value),
    duration: [500, 250, 100][i],
    setDuration() {},
  }));
}
test("three physical clock units use one midnight deadline with independent preferred durations", () => {
  const boundary = Date.UTC(2027, 0, 1),
    u = units([23, 59, 56]),
    s = new LiveClockScheduler(utc);
  for (let elapsed = 0; elapsed <= 4000; elapsed += 10) {
    const mono = 4100 + elapsed;
    for (const unit of u)
      if (
        unit.controller.busy &&
        unit.controller.deadline &&
        mono >= unit.controller.deadline.endAt
      )
        unit.controller.settle();
    s.tick(boundary - 4000 + elapsed, mono, u);
  }
  assert.deepEqual(
    u.map((v) => v.controller.deadlines.at(-1)),
    [500, 250, 100].map((durationMs) => ({
      target: 0,
      endAt: 8100,
      durationMs,
    })),
  );
  const snapshot = s.tick(boundary, 8100, u);
  assert.equal(clockText(snapshot.values), "00:00:00");
  assert.deepEqual(
    u.map((v) => v.controller.currentValue),
    [0, 0, 0],
  );
});
test("hour boundaries follow local DST and half-hour zones rather than UTC-hour arithmetic", () => {
  const reader = (zone) => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    return (epoch) => fmt.format(new Date(epoch)).split(":").map(Number);
  };
  const berlin = reader("Europe/Berlin");
  assert.deepEqual(nextChange(Date.parse("2026-03-29T00:59:30Z"), 0, berlin), {
    epoch: Date.parse("2026-03-29T01:00:00Z"),
    value: 3,
  });
  assert.deepEqual(nextChange(Date.parse("2026-10-25T00:59:30Z"), 0, berlin), {
    epoch: Date.parse("2026-10-25T02:00:00Z"),
    value: 3,
  });
  assert.deepEqual(
    nextChange(Date.parse("2026-01-01T00:29:59Z"), 0, reader("Asia/Kolkata")),
    { epoch: Date.parse("2026-01-01T00:30:00Z"), value: 6 },
  );
});
test("suspended playback keeps only the current target and never enumerates missed seconds", () => {
  const boundary = Date.UTC(2026, 0, 1, 12, 35, 0),
    u = units([12, 34, 59]),
    s = new LiveClockScheduler(utc);
  s.tick(boundary - 700, 0, u);
  assert.equal(u[2].controller.busy, true);
  s.tick(boundary + 31000, 31700, u);
  assert.deepEqual(u[2].controller.requests, [0, 31]);
  assert.equal(u[2].controller.queued, 31);
  assert.equal(u[2].controller.deadline, null);
  u[2].controller.settle();
  assert.equal(u[2].controller.pending, 31);
  u[2].controller.settle();
  assert.equal(u[2].controller.currentValue, 31);
  assert.equal(u[2].controller.busy, false);
});
test("wall-clock jumps cancel anticipated deadlines and replan against the new shared time", () => {
  const now = Date.UTC(2026, 0, 1, 12, 34, 59, 500),
    u = units([12, 34, 59]),
    s = new LiveClockScheduler(utc);
  s.tick(now, 100, u);
  assert.ok(u[2].controller.deadline);
  const snapshot = s.tick(now - 3600000, 125, u);
  assert.equal(snapshot.values[0], 11);
  assert.equal(u[2].controller.deadline, null);
  assert.equal(u[0].controller.requests.at(-1), 11);
});
test("HSM prepares from exact full poses, initializes current values and forwards timing only on the last move", async () => {
  const d = validateHsmDesign(
      JSON.parse(readFileSync("public/hsm-counter.v2.json")),
    ),
    calls = [];
  const c = new HsmController(
    {
      configure() {},
      resetCamera() {},
      animate: async (p, timing) =>
        calls.push({ p, timing: timing?.() ?? null }),
    },
    d,
    {},
    "S",
    () => {},
    async () => ({ dispose() {} }),
  );
  await c.configure(42);
  assert.equal(c.currentValue, 42);
  assert.ok(matchesTarget(d.print, c.state, hsmTarget("S", 42)));
  const state = c.state,
    moves = c.prepare(43);
  assert.equal(c.state, state);
  assert.equal(c.prepare(43), moves);
  c.setDeadline(43, 12345, 100);
  c.request(43);
  for (let i = 0; c.busy && i < 100; i++)
    await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
  assert.equal(c.currentValue, 43);
  assert.equal(calls.filter((v) => v.timing).length, 1);
  assert.equal(calls.at(-1).timing.endAt, 12345);
  assert.equal(calls.at(-1).timing.durationMs, 100);
  assert.ok(
    Number.isInteger(calls.at(-1).timing.revision) &&
      calls.at(-1).timing.revision > 0,
  );
  assert.ok(matchesTarget(d.print, c.state, hsmTarget("S", 43)));
  c.clearDeadline();
  c.dispose();
});
