import test from "node:test";
import assert from "node:assert/strict";
import { urlAfterAppSwitch } from "../src/app-switch-url.mjs";

const base = "http://localhost:5173/index.html";

test("value parameters do not survive an application switch", () => {
  // unit belongs to the letter counters only: it goes when switching to the timer, but stays between letter counters.
  assert.equal(urlAfterAppSwitch(`${base}?val=45&unit=S`, "ms-counter", "timer"), "/index.html");
  assert.equal(urlAfterAppSwitch(`${base}?val=45&unit=S`, "ms-counter", "hsm-counter"), "/index.html?unit=S");
  assert.equal(urlAfterAppSwitch(`${base}?value=45`, "ms-counter", "timer"), "/index.html");
});

test("duration does not survive an application switch", () => {
  assert.equal(
    urlAfterAppSwitch(`${base}?duration=00:05&mode=countdown`, "five-second-timer", "timer"),
    "/index.html?mode=countdown",
  );
});

test("startup call keeps deep links although the default application is certified", () => {
  // The real startup call has previous "certified" (src/main.mjs `let application`) and initial true.
  const deep = `${base}/timer.html?duration=05:00&val=12#top`.replace("/index.html", "");
  assert.equal(urlAfterAppSwitch(deep, "certified", "timer", true), "/timer.html?duration=05:00&val=12#top");
});

test("a switch to the same application keeps the URL", () => {
  const deep = `${base}?duration=05:00&val=12#top`;
  assert.equal(urlAfterAppSwitch(deep, "timer", "timer"), "/index.html?duration=05:00&val=12#top");
});

test("the Calendar parameters are owned by the Calendar: date, language, padding and design do not flow in or out", () => {
  const cal = `${base}?app=calendar&date=2026-11-12&lang=en&design=en-3&pad=0&speed=100&nerd=1`;
  assert.equal(urlAfterAppSwitch(cal, "calendar", "clock"), "/index.html?app=calendar&speed=100&nerd=1");
  assert.equal(urlAfterAppSwitch(cal, "calendar", "calendar7"), "/index.html?app=calendar&speed=100&nerd=1");
  assert.equal(urlAfterAppSwitch(cal, "calendar", "ci"), "/index.html?app=calendar&speed=100&nerd=1");
  assert.equal(
    urlAfterAppSwitch(cal, "calendar", "calendar"),
    "/index.html?app=calendar&date=2026-11-12&lang=en&design=en-3&pad=0&speed=100&nerd=1",
  );
  // stray keys of another app are dropped on the way in
  assert.equal(urlAfterAppSwitch(`${base}?app=calendar7&year=2026&month=3&date=2026-01-01`, "calendar7", "calendar"), "/index.html?app=calendar7");
  assert.equal(urlAfterAppSwitch(`${base}?app=counter&val=5&display=dseg7`, "counter", "calendar"), "/index.html?app=counter");
});
