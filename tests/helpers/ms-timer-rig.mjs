// Deterministic M/S Timer rig: the real MsTimer, PairController, MsTimerCube,
// MsTimerTenthCube, MsTimerScheduler and the production turn interpolation
// (animateTimedProgress) on ONE virtual monotonic clock. Only the displays are
// synthetic. Separate cube models, built here from the saved research words,
// replay every turn the views recorded; the controllers' own states are
// cross-checked against those models.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMsDesign, msTarget } from "../../src/apps/ms/design.ts";
import { MsTimerCube } from "../../src/apps/ms-timer/cube.ts";
import {
  MsTimerTenthCube,
  TENTH_MOVE_MS,
  TENTH_PRINT,
  TENTH_WORDS,
  tenthTarget,
} from "../../src/apps/ms-timer/tenth.ts";
import { MsTimer } from "../../src/apps/ms-timer/timer.ts";
import { PairController } from "../../src/apps/pair/controller.ts";
import { animateTimedProgress } from "../../packages/cube-viewer/src/motion-timing.ts";
import {
  applyMoves,
  initialState,
  matchesTarget,
  parseAlg,
  serializeMove,
} from "../../packages/cube-mechanics/src/index.ts";
import { stateEquals } from "../../packages/cube-core/src/index.ts";

export const ms = validateMsDesign(
  JSON.parse(readFileSync("public/ms-counter.v1.json", "utf8")),
).print;
const assets = async () => ({ dispose() {} });
export const UNITS = ["minor", "major", "tenth"];
const LETTER = { minor: "S", major: "M" };

/** Independent pose of a unit showing `value` on its first lap: setup word plus period words. */
export function startPose(unit, value) {
  if (unit === "tenth") {
    let state = initialState(TENTH_PRINT);
    for (let i = 0; i < value; i++)
      state = applyMoves(state, parseAlg(TENTH_WORDS[i]));
    return state;
  }
  const run = ms.runs[LETTER[unit]];
  let state = applyMoves(initialState(ms.print), parseAlg(run.setup));
  for (let i = 0; i < value; i++)
    state = applyMoves(state, parseAlg(run.words[i]));
  return state;
}

export const at = (text) => {
  const [m, rest] = text.split(":");
  return Number(m) * 60 + Number(rest);
};
export const label = (value) => {
  const tenths = Math.round(value * 10);
  const sec = Math.floor(tenths / 10);
  const d = ((tenths % 10) + 10) % 10;
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}.${d}`;
};

/**
 * @param from   combined value (seconds, may include .d tenths) the cubes are installed on
 * @param origin virtual time the rig starts at (the clock anchors there)
 */
export async function rig({
  from = 900,
  preferred = 100,
  tick = 10,
  origin = 0,
  mode = "countdown",
  duration,
} = {}) {
  let now = origin;
  const frames = new Map(),
    timers = new Map();
  let id = 0;
  const runtime = {
    now: () => now,
    frame(cb) {
      frames.set(++id, cb);
      return id;
    },
    cancelFrame: (n) => frames.delete(n),
    timer(cb, delay) {
      timers.set(++id, { cb, at: now + delay });
      return id;
    },
    cancelTimer: (n) => timers.delete(n),
  };
  const speed = { minor: preferred, major: preferred, tenth: TENTH_MOVE_MS };
  const rows = [];
  const view = (unit) => ({
    configure() {},
    resetCamera() {},
    async animate(presentation, source) {
      const row = {
        unit,
        move: serializeMove(presentation.move),
        calledAt: now,
        completeAt: null,
        windowed: !!source?.(),
        samples: 0,
      };
      await animateTimedProgress(
        source ?? (() => null),
        () => speed[unit],
        () => row.samples++,
        runtime,
      );
      row.completeAt = now;
      rows.push(row);
    },
  });
  const cube = (unit) => (onState) =>
    new MsTimerCube(view(unit), ms, {}, LETTER[unit], onState, assets);
  const pair = new PairController({
    minorModulus: 60,
    majorModulus: 60,
    createMinor: cube("minor"),
    createMajor: cube("major"),
  });
  const tenth = new MsTimerTenthCube(view("tenth"), {}, () => {}, assets);
  const timer = new MsTimer({
    pair,
    tenth,
    now: () => now,
    preferred: () => preferred,
    setDuration: {
      minor: (ms) => (speed.minor = ms),
      major: (ms) => (speed.major = ms),
      tenth: (ms) => (speed.tenth = ms),
    },
  });
  if (mode !== "countdown") timer.clock.setMode(mode);
  if (duration !== undefined) {
    if (Number.isInteger(duration)) timer.clock.configure(duration);
    else timer.clock.configureTenths(Math.round(duration * 10));
  }
  const fromTenths = Math.round(from * 10);
  const fromSec = Math.floor(fromTenths / 10);
  const fromTenth = ((fromTenths % 10) + 10) % 10;
  await Promise.all([pair.configure(fromSec), tenth.configure(fromTenth)]);

  const model = {
    minor: startPose("minor", fromSec % 60),
    major: startPose("major", Math.floor(fromSec / 60)),
    tenth: startPose("tenth", fromTenth),
  };
  const settle = () => new Promise((r) => setImmediate(r));
  const fire = async (cbs) => {
    for (const cb of cbs) cb();
    await settle();
  };
  const r = {
    pair,
    tenth,
    timer,
    rows,
    speed,
    model,
    get now() {
      return now;
    },
    /** Advance virtual time to `time`, ticking the scheduler every `tick` ms. */
    async runTo(time, { ticking = true } = {}) {
      let nextTick =
        Math.ceil(now / tick) * tick + (now % tick === 0 ? tick : 0);
      while (now < time) {
        const due = [...timers.values()].map((t) => t.at);
        const next = Math.min(time, nextTick, ...due);
        now = Math.max(now, next);
        const ready = [...timers.entries()].filter(([, t]) => t.at <= now);
        await fire(
          ready.map(([n, t]) => {
            timers.delete(n);
            return t.cb;
          }),
        );
        if (now >= nextTick) {
          nextTick += tick;
          const f = [...frames.entries()];
          frames.clear();
          await fire(
            f.map(
              ([, cb]) =>
                () =>
                  cb(now),
            ),
          );
          if (ticking) {
            timer.tick();
            await settle();
          }
        }
      }
      if (pair.error) throw pair.error;
    },
    /**
     * Stopwatch that has been running for `seconds` already (the cubes sit on
     * `from`): anchors the clock in the past without ticking, then continues at
     * virtual time 0. Lets a test reach 14:59 without simulating 899 seconds.
     */
    joinRunning(seconds) {
      assert.ok(timers.size === 0 && frames.size === 0 && now === origin);
      now = origin - seconds * 1000;
      timer.clock.start();
      now = origin;
      timer.tick();
    },
    /** Run virtual time (no scheduler ticks) until `promise` settles, e.g. a Set or Reset walk. */
    async walk(promise, limit = 30000) {
      let done = false;
      const tracked = promise.then(() => (done = true));
      const end = now + limit;
      while (!done && now < end) await r.runTo(now + 50, { ticking: false });
      assert.ok(done, "the walk settled");
      await tracked;
      r.take();
    },
    /** Let queued microtasks run without advancing time. */
    settle,
    /** Turns played since the last call, per cube, replayed on the separate model. */
    take() {
      const out = { minor: [], major: [], tenth: [] };
      for (const row of rows.splice(0)) out[row.unit].push(row);
      for (const unit of UNITS)
        model[unit] = applyMoves(
          model[unit],
          parseAlg(out[unit].map((x) => x.move).join(" ")),
        );
      return out;
    },
    /** All three displays show `value` on the independent models and equal the controllers' poses. */
    check(value) {
      const totalTenths = Math.round(value * 10);
      const sec = Math.floor(totalTenths / 10);
      const wantTenth = ((totalTenths % 10) + 10) % 10;
      for (const unit of ["minor", "major"]) {
        const want = unit === "minor" ? sec % 60 : Math.floor(sec / 60);
        assert.ok(
          matchesTarget(ms.print, model[unit], msTarget(LETTER[unit], want)),
          `${unit} shows ${want} after replay (${label(value)})`,
        );
        assert.ok(
          stateEquals(model[unit], pair[unit].state),
          `${unit} replay equals the controller pose`,
        );
      }
      assert.ok(
        matchesTarget(TENTH_PRINT, model.tenth, tenthTarget(wantTenth)),
        `tenth shows ${wantTenth} after replay (${label(value)})`,
      );
      assert.ok(
        stateEquals(model.tenth, tenth.state),
        `tenth replay equals the controller pose`,
      );
    },
  };
  return r;
}
