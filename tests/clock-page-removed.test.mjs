import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

// Owner decision 2 (knowledge/plans/unified-application.md): the old pages go completely, without redirect or shim.
// The Live Clock page is gone; its URL answers 404 and nothing links to it.

const read = (path) => readFileSync(path, "utf8");
const pages = readdirSync(".").filter((f) => f.endsWith(".html"));

test("clock.html and its script are deleted and no shim stands in for them", () => {
  assert.equal(existsSync("clock.html"), false);
  assert.equal(existsSync("src/clock.mjs"), false);
});

test("the build has no clock page input", () => {
  assert.doesNotMatch(read("vite.config.mjs"), /clock\.html/);
});

test("no page links to clock.html or offers it in a chooser", () => {
  assert.ok(pages.length > 10);
  for (const page of pages) assert.doesNotMatch(read(page), /clock\.html/, page);
});

test("the counter family no longer carries the hidden live-clock option or the redirect to the page", () => {
  for (const page of pages) assert.doesNotMatch(read(page), /value="live-clock"/, page);
  const main = read("src/main.mjs");
  assert.doesNotMatch(main, /live-clock/);
  assert.doesNotMatch(main, /clock\.html/);
});

test("the markup check no longer lists the page and the landing page still reaches the clock", () => {
  assert.doesNotMatch(read("tests/mpa-routing.test.mjs"), /clock\.html/);
  assert.match(read("index.html"), /href="index\.html\?app=clock"/);
});

test("no tracked script or document outside the history names the removed page as a way to open the clock", () => {
  for (const file of ["README.md", "docs/APPLICATIONS.md", "docs/LIVE_CLOCK.md", "scripts/readme-screenshot.mjs"])
    assert.doesNotMatch(read(file), /(?<!former `|former )clock\.html/, file);
});
