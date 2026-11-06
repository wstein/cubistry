import test from "node:test";
import assert from "node:assert/strict";
import { urlAfterAppSwitch } from "../src/app-switch-url.mjs";

const base = "http://localhost:5173/index.html";

test("value parameters do not survive an application switch", () => {
  assert.equal(urlAfterAppSwitch(`${base}?val=45&unit=S`, "ms-counter", "timer"), "/index.html?unit=S");
  assert.equal(urlAfterAppSwitch(`${base}?value=45`, "ms-counter", "timer"), "/index.html");
});

test("duration does not survive an application switch", () => {
  assert.equal(
    urlAfterAppSwitch(`${base}?duration=00:05&mode=countdown`, "five-second-timer", "timer"),
    "/index.html?mode=countdown",
  );
});

test("deep links are kept on first load and on a switch to the same application", () => {
  const deep = `${base}?duration=05:00&val=12#top`;
  assert.equal(urlAfterAppSwitch(deep, "", "timer"), "/index.html?duration=05:00&val=12#top");
  assert.equal(urlAfterAppSwitch(deep, "timer", "timer"), "/index.html?duration=05:00&val=12#top");
});
