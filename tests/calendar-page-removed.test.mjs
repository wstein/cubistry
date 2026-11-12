import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";

// Owner decisions (knowledge/plans/unified-application.md, D5 and stage 4): the old pages go completely, without
// redirect or shim. The 3x3 calendar page is gone; the Calendar mode of the host (`index.html?app=calendar`) replaces
// it, and the old URL answers 404 (checked on the build in tests/pages/production.spec.mjs).

const read = (path) => readFileSync(path, "utf8");
const pages = readdirSync(".").filter((f) => f.endsWith(".html"));

test("calendar.html, its script and the styles and presentation helper only the page used are deleted", () => {
  for (const file of ["calendar.html", "src/calendar.mjs", "src/calendar.css", "src/presentation.css", "src/apps/shared/presentation.ts"])
    assert.equal(existsSync(file), false, file);
});

test("the build has no calendar page input", () => {
  const vite = read("vite.config.mjs");
  assert.doesNotMatch(vite, /calendar\.html/);
  assert.doesNotMatch(vite, /^\s*calendar:/m);
});

test("no legacy page offers calendar.html and each chooser links to the host mode", () => {
  assert.ok(pages.length > 10);
  for (const page of pages) {
    const source = read(page);
    assert.doesNotMatch(source, /calendar\.html/, page);
    if (/<option\b[^>]*value="index\.html\?app=clock"/.test(source))
      assert.match(source, /<option value="index\.html\?app=calendar">Calendar · Deutsch \/ English<\/option>/, page);
  }
  assert.match(read("print.html"), /href="index\.html\?app=calendar"/);
});

test("no tracked file outside the plans names calendar.html as a way to open the calendar", () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const hits = [];
  for (const file of tracked) {
    if (/^knowledge\//.test(file) || file === "tests/calendar-page-removed.test.mjs") continue;
    if (/\.(png|jpe?g|webp|svg|woff2?|bin|pdf|ico|wasm|gz|zip|json|ttf|otf|mp4|webm)$/i.test(file)) continue;
    if (!existsSync(file)) continue;
    // A sentence may say that the former page is gone.
    const text = read(file).replace(/former (?:page )?`?\[?calendar\.html\]?`?/g, "");
    if (/calendar\.html/.test(text)) hits.push(file);
    if (/src\/calendar\.mjs/.test(text)) hits.push(`${file} (src/calendar.mjs)`);
  }
  assert.deepEqual(hits, []);
});

test("the router sends the Calendar choice to the host and the markup check no longer lists the page", () => {
  assert.match(read("src/main.mjs"), /"calendar": "index\.html\?app=calendar"/);
  assert.doesNotMatch(read("tests/mpa-routing.test.mjs"), /calendar\.html/);
  assert.match(read("index.html"), /<option value="calendar">/);
});
