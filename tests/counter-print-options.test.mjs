// Per-print defaults of the Counter's Wrap and Leading Zero controls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  wrapDefault,
  wrapFor,
  leadingZeroLabel,
} from "../src/apps/counter/print-options.ts";

test("Wrap defaults on for the blank-top print only", () => {
  assert.equal(wrapDefault("blank-top"), true);
  assert.equal(wrapDefault("titled"), false);
  // Unknown print ids keep the titled behavior.
  assert.equal(wrapDefault("unknown"), false);
});

test("an explicit Wrap choice wins over the print default", () => {
  assert.equal(wrapFor("blank-top", null), true);
  assert.equal(wrapFor("titled", null), false);
  for (const print of ["titled", "blank-top"]) {
    assert.equal(wrapFor(print, true), true);
    assert.equal(wrapFor(print, false), false);
  }
});

test("the Leading Zero label names the physical mode on the blank-top print", () => {
  assert.equal(leadingZeroLabel("titled"), "Leading Zero");
  assert.equal(leadingZeroLabel("blank-top"), "Leading zero mode (physical)");
  assert.match(leadingZeroLabel("blank-top"), /physical/);
});

test("the static page starts with the titled label and Wrap unchecked", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /<input id="wrap" type="checkbox" \/>/);
  assert.match(html, /<span id="format-label">Leading Zero<\/span>/);
});
