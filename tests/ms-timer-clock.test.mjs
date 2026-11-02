// M/S Timer, one-second timer profile on WorkshopClock (stack PR 3). The clock
// arithmetic is the one of the existing timers; these tests pin that a
// one-second profile fits it and that the ends and the Set input behave as the
// owner decisions of 2026-11-01 require.
import test from "node:test";
import assert from "node:assert/strict";
import {
  WorkshopClock,
  ONE_SECOND_TIMER,
  TEN_SECOND_TIMER,
  FIVE_SECOND_TIMER,
  formatTimer,
  formatLiveTimer,
  formatMsTimer,
  parseDuration,
  parseMsDuration,
} from "../src/apps/timer/clock.ts";

const clockAt = (now) => new WorkshopClock(() => now.value, ONE_SECOND_TIMER);

test("the one-second profile has the owner's range and default and leaves the other profiles alone", () => {
  assert.deepEqual(
    { ...ONE_SECOND_TIMER },
    {
      stepSeconds: 1,
      maxSeconds: 3599,
      defaultSeconds: 900,
      stepName: "one-second",
    },
  );
  assert.equal(Object.isFrozen(ONE_SECOND_TIMER), true);
  assert.equal(TEN_SECOND_TIMER.maxSeconds, 3590);
  assert.equal(FIVE_SECOND_TIMER.maxSeconds, 2395);
  const now = { value: 0 };
  const c = clockAt(now);
  assert.equal(c.mode, "countdown");
  assert.equal(c.bucket, 900);
  assert.equal(c.snapshot().liveSeconds, 900);
  assert.equal(formatTimer(c.bucket, ONE_SECOND_TIMER), "15:00");
});

test("buckets are whole seconds: Countdown rounds up, Stopwatch rounds down", () => {
  const now = { value: 0 };
  const down = clockAt(now);
  down.start();
  now.value = 2500;
  assert.equal(down.snapshot().bucket, 898); // 897.5 s left shows 14:58
  assert.equal(down.snapshot().liveSeconds, 898);
  assert.equal(formatTimer(down.bucket, ONE_SECOND_TIMER), "14:58");
  const up = clockAt(now);
  up.setMode("stopwatch");
  now.value = 0;
  up.start();
  now.value = 12500;
  assert.equal(up.snapshot().bucket, 12); // 12.5 s shows 00:12
  assert.equal(up.snapshot().liveSeconds, 12);
});

test("the next boundary is the next whole second, one second away", () => {
  const now = { value: 1000 };
  const c = clockAt(now);
  c.setMode("stopwatch");
  c.start();
  now.value = 1000 + 12500;
  let s = c.snapshot();
  assert.deepEqual(s.next, { target: 13, deadline: 14000, interval: 1000 });
  c.setMode("countdown");
  now.value = 14000;
  c.start();
  now.value = 14000 + 2500;
  s = c.snapshot();
  assert.equal(s.bucket, 898);
  assert.deepEqual(s.next, { target: 897, deadline: 17000, interval: 1000 });
});

test("pause keeps the fraction: 12.5 s shows 00:12 and resumes with 0.5 s to go", () => {
  const now = { value: 0 };
  const c = clockAt(now);
  c.setMode("stopwatch");
  c.start();
  now.value = 12500;
  c.pause();
  assert.equal(c.valueMs, 12500);
  now.value = 99999;
  assert.equal(c.snapshot().liveSeconds, 12);
  assert.equal(c.valueMs, 12500);
  c.start();
  assert.equal(c.snapshot().next.deadline, 99999 + 500);
  now.value += 500;
  assert.equal(c.snapshot().bucket, 13);
});

test("Stopwatch starts at 00:00 and stops at 59:59 without wrapping", () => {
  const now = { value: 0 };
  const c = clockAt(now);
  c.setMode("stopwatch");
  assert.equal(c.bucket, 0);
  c.start();
  now.value = 3598500;
  assert.equal(c.snapshot().bucket, 3598);
  assert.equal(c.running, true);
  now.value = 3599000;
  let s = c.snapshot();
  assert.equal(s.bucket, 3599);
  assert.equal(formatTimer(s.bucket, ONE_SECOND_TIMER), "59:59");
  assert.equal(s.running, false);
  assert.equal(s.next, null);
  assert.equal(c.elapsed, true);
  now.value += 10 * 3600 * 1000;
  s = c.snapshot();
  assert.equal(s.bucket, 3599);
  assert.equal(c.valueMs, 3599000);
  c.start(); // no restart past the end
  assert.equal(c.running, false);
  c.reset();
  assert.equal(c.bucket, 0);
});

test("Countdown stops at 00:00 and does not continue past it", () => {
  const now = { value: 0 };
  const c = clockAt(now);
  c.configure(3);
  c.start();
  now.value = 2500;
  assert.equal(c.snapshot().bucket, 1);
  assert.equal(c.running, true);
  now.value = 3000;
  const s = c.snapshot();
  assert.equal(s.bucket, 0);
  assert.equal(s.running, false);
  assert.equal(s.next, null);
  assert.equal(c.elapsed, true);
  now.value = 60000;
  assert.equal(c.valueMs, 0);
  assert.equal(c.bucket, 0);
  c.reset();
  assert.equal(c.bucket, 3);
});

test("Set accepts exactly MM:SS from 00:00 to 59:59 and rejects the rest without rounding", () => {
  assert.equal(parseDuration("00:00", ONE_SECOND_TIMER), 0);
  assert.equal(parseDuration("00:01", ONE_SECOND_TIMER), 1);
  assert.equal(parseDuration("15:00", ONE_SECOND_TIMER), 900);
  assert.equal(parseDuration("5:07", ONE_SECOND_TIMER), 307);
  assert.equal(parseDuration("59:59", ONE_SECOND_TIMER), 3599);
  for (const bad of [
    "60:00",
    "99:99",
    "15:60",
    "15:6",
    "15",
    "1500",
    "",
    " 15:00",
    "15:00 ",
    "-1:00",
    "15:00.5",
    "15.5:00",
    "ab:cd",
    "1:2:3",
    "００:01",
  ])
    assert.throws(() => parseDuration(bad, ONE_SECOND_TIMER), Error, bad);
  const c = new WorkshopClock(() => 0, ONE_SECOND_TIMER);
  c.configure(3599);
  assert.equal(c.bucket, 3599);
  for (const bad of [3600, -1, 0.5, 1.0000001, NaN, Infinity, "5"])
    assert.throws(
      () => c.configure(bad),
      /Duration must be 00:00–59:59 in one-second steps/,
    );
  assert.equal(c.bucket, 3599); // a rejected Set leaves the configured duration alone
});

test("the readout formats every second up to 59:59 and nothing beyond", () => {
  assert.equal(formatLiveTimer(3599, ONE_SECOND_TIMER.maxSeconds), "59:59");
  assert.equal(formatLiveTimer(0, ONE_SECOND_TIMER.maxSeconds), "00:00");
  for (const bad of [-1, 3600, 0.5, NaN])
    assert.throws(() => formatLiveTimer(bad, ONE_SECOND_TIMER.maxSeconds));
  assert.throws(() => formatTimer(3600, ONE_SECOND_TIMER));
  // The existing timers keep their bound of 59:50.
  assert.throws(() => formatLiveTimer(3591));
  assert.equal(formatLiveTimer(3590), "59:50");
});

test("tenth-second readout and Set duration parser accept MM:SS and MM:SS.d", () => {
  assert.equal(formatMsTimer(0), "00:00.0");
  assert.equal(formatMsTimer(9000), "15:00.0");
  assert.equal(formatMsTimer(125), "00:12.5");
  assert.equal(formatMsTimer(35990), "59:59.0");
  assert.equal(formatMsTimer(35999), "59:59.9");
  assert.equal(parseMsDuration("00:00"), 0);
  assert.equal(parseMsDuration("00:00.0"), 0);
  assert.equal(parseMsDuration("15:00"), 9000);
  assert.equal(parseMsDuration("15:00.0"), 9000);
  assert.equal(parseMsDuration("15:00.5"), 9005);
  assert.equal(parseMsDuration("5:07.3"), 3073);
  assert.equal(parseMsDuration("59:59.0", 35990), 35990);
  for (const bad of [
    "60:00",
    "60:00.0",
    "15:60",
    "15:6",
    "15:00.",
    "15:00.12",
    "1500",
    "",
    "-1:00",
  ])
    assert.throws(() => parseMsDuration(bad, 35990), Error, bad);

  const now = { value: 0 };
  const c = clockAt(now);
  c.setMode("stopwatch");
  c.start();
  now.value = 250;
  const ts = c.tenthSnapshot();
  assert.equal(ts.bucket, 2);
  assert.deepEqual(ts.next, { target: 3, deadline: 300, interval: 100 });
});
