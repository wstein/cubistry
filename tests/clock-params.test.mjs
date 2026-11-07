import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOCK_SPEED_CHOICES_MS,
  CLOCK_UNIT_NAMES,
  DEFAULT_CLOCK_SPEEDS_MS,
  clockPrintDesign,
  parseClockParams,
  urlWithLettering,
} from "../src/apps/clock/params.ts";
import { buildStudioManifest, normalizeMarkerMode } from "../src/apps/chronocube/manifest.ts";

// The Live Clock mode reads the parameters that clock.html read (knowledge/plans/unified-application.md, appendix rows
// lettering, nerd/dev/expert, hours-speed/minutes-speed/seconds-speed). These tests pin the rules of src/clock.mjs.

const parse = (search, stored = {}) => parseClockParams(new URLSearchParams(search), stored);

test("the defaults are Hours 500 ms, Minutes 250 ms, Seconds 100 ms and the Pascal-case words", () => {
  assert.deepEqual(CLOCK_UNIT_NAMES, ["hours", "minutes", "seconds"]);
  assert.deepEqual(DEFAULT_CLOCK_SPEEDS_MS, { hours: 500, minutes: 250, seconds: 100 });
  assert.deepEqual(CLOCK_SPEED_CHOICES_MS, [2000, 1000, 500, 250, 100, 50, 10]);
  const p = parse("");
  assert.deepEqual(p.speeds, [500, 250, 100]);
  assert.equal(p.lettering, "words-pascal");
  assert.equal(p.nerd, false);
});

test("a listed speed parameter selects that quarter-turn time per unit", () => {
  assert.deepEqual(parse("?hours-speed=250&minutes-speed=100&seconds-speed=50").speeds, [250, 100, 50]);
  assert.deepEqual(parse("?seconds-speed=2000").speeds, [500, 250, 2000]);
  assert.deepEqual(parse("?hours-speed=10").speeds, [10, 250, 100]);
});

test("an unlisted or malformed speed falls back to the unit default", () => {
  for (const bad of ["", "0", "-100", "123", "abc", "1e3", "0250", " 250", "250ms"])
    assert.deepEqual(parse(`?hours-speed=${encodeURIComponent(bad)}`).speeds, [500, 250, 100], JSON.stringify(bad));
});

test("lettering: the URL wins over the stored choice, the stored choice over the default, an unknown value is symbols", () => {
  assert.equal(parse("?lettering=words").lettering, "words");
  assert.equal(parse("?lettering=symbols").lettering, "symbols");
  assert.equal(parse("?lettering=words-pascal").lettering, "words-pascal");
  assert.equal(parse("?lettering=words", { lettering: "symbols" }).lettering, "words");
  assert.equal(parse("", { lettering: "symbols" }).lettering, "symbols");
  assert.equal(parse("", { lettering: null }).lettering, "words-pascal");
  assert.equal(parse("?lettering=Hour").lettering, "symbols");
});

test("the Nerd panel opens for nerd, dev, expert, any speed parameter, or the stored choice", () => {
  for (const q of ["?nerd", "?nerd=1", "?dev", "?expert=0", "?hours-speed=250", "?seconds-speed=bad", "?minutes-speed="])
    assert.equal(parse(q).nerd, true, q);
  assert.equal(parse("", { nerd: "true" }).nerd, true);
  for (const stored of ["false", null, undefined, "1"]) assert.equal(parse("", { nerd: stored }).nerd, false);
  assert.equal(parse("?lettering=words&kiosk=1").nerd, false);
});

test("the print link follows the sticker lettering", () => {
  assert.equal(clockPrintDesign("words-pascal"), "hsm-words-pascal");
  assert.equal(clockPrintDesign("words"), "hsm-words");
  assert.equal(clockPrintDesign("symbols"), "hsm-symbols");
});

test("changing the lettering rewrites only the lettering parameter and keeps the rest of the URL", () => {
  assert.equal(
    urlWithLettering("http://x/index.html?app=clock&seconds-speed=50&nerd=1#t", "words"),
    "/index.html?app=clock&seconds-speed=50&nerd=1&lettering=words#t",
  );
  assert.equal(
    urlWithLettering("http://x/index.html?app=clock&lettering=words", "symbols"),
    "/index.html?app=clock&lettering=symbols",
  );
});

// The Clock page offered the dot markers as "auto" and "all"; the studio panel stores them as "dot-auto" and "dot-all".
test("studio marker names map onto the markers the digit images understand", () => {
  assert.equal(normalizeMarkerMode("dot-auto"), "auto");
  assert.equal(normalizeMarkerMode("dot-all"), "all");
  for (const ok of ["auto", "all", "off", "line-auto", "line-all"]) assert.equal(normalizeMarkerMode(ok), ok);
  assert.equal(normalizeMarkerMode("nonsense"), "off");
  assert.equal(normalizeMarkerMode(null), "off");
});

test("the studio manifest draws a dot for a dot marker name and an underline for a line marker name", () => {
  const marker = (name) =>
    buildStudioManifest("dseg7", name, "same", "words-pascal").images.find((i) => i.id === "6").marker;
  assert.equal(marker("dot-auto"), "dot");
  assert.equal(marker("dot-all"), "dot");
  assert.equal(marker("line-auto"), "underline");
  assert.equal(marker("off"), undefined);
});
