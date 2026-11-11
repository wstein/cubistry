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
