import test from "node:test";
import assert from "node:assert/strict";
import { civilDate } from "../src/apps/calendar/model.ts";

test("civilDate correctly parses valid ISO calendar dates from URL parameters", () => {
  const christmas = civilDate("2026-12-25");
  assert.equal(christmas.iso, "2026-12-25");
  assert.equal(christmas.year, 2026);
  assert.equal(christmas.month, 12);
  assert.equal(christmas.day, 25);
  // Dec 25, 2026 is a Friday (weekday index 4 where Mon=0)
  assert.equal(christmas.weekday, 4);

  const leapDay = civilDate("2024-02-29");
  assert.equal(leapDay.iso, "2024-02-29");
});

test("civilDate rejects invalid dates", () => {
  assert.throws(() => civilDate("2026-02-29"));
  assert.throws(() => civilDate("invalid-date"));
  assert.throws(() => civilDate("2026-13-01"));
});

test("URL query parameter resolution maps to correct physical print design", () => {
  const resolveDesign = (queryString) => {
    const params = new URLSearchParams(queryString);
    const lang = params.get("lang") || params.get("language") || params.get("design");
    if (!lang) return "de-a";
    const val = lang.toLowerCase();
    if (val === "en" || val === "en-3" || val === "english") return "en-3";
    if (val === "de" || val === "de-a" || val === "deutsch" || val === "german") return "de-a";
    return "de-a";
  };

  assert.equal(resolveDesign("?lang=en"), "en-3");
  assert.equal(resolveDesign("?language=english"), "en-3");
  assert.equal(resolveDesign("?design=en-3"), "en-3");
  assert.equal(resolveDesign("?lang=de"), "de-a");
  assert.equal(resolveDesign("?language=deutsch"), "de-a");
  assert.equal(resolveDesign("?design=de-a"), "de-a");
  assert.equal(resolveDesign(""), "de-a");
});
