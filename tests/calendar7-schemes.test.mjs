import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, mix, shiftToContrast } from "./calendar7-contrast.mjs";
import { SCHEMES } from "../src/apps/calendar7/schemes.ts";

// Gates (WCAG 2.x): SMALL_TEXT for normal text, LARGE_TEXT for large bold labels and numerals, NON_TEXT for lines.
const SMALL_TEXT = 4.5;
const LARGE_TEXT = 3;
const NON_TEXT = 3;

// Pairs that use the 3:1 large-text gate instead of 4.5:1 (owner accepted this for the fresh Paper Red). Every other
// text pair must read at 4.5:1. Paper Red's large bold weekend numerals (4.13:1 on the tint) and SUN/SAT labels (3.94:1 on
// the gray row) use it; its white month name on the red band reads 4.66:1 and needs no exception. The small second number
// of a folded weekend split label is not large text: weekendInkSmall is gated at 4.5:1 (Paper Red darkens it to #d5262a).
const LARGE_TEXT_PAIRS = { "paper-red": ["weekendInk", "sunSatInk"] };

// Lines that may stay below 3:1 against a neighbor. Empty: every line that exists reads at 3:1. Band edges carry no text
// or control and are not gated (WCAG does not require it).
const LINE_EXCEPTIONS = {};

const ORDER = [
  "paper-red", "paper-blue", "classic", "solarized-light", "gruvbox-light",
  "dracula", "monokai", "gruvbox-dark", "catppuccin-mocha", "high-contrast", "rubik-tint",
];
const COLOR_ROLES = ["dayFill", "dayInk", "weekdayInk", "weekendInk", "weekendInkSmall", "monthInk", "emptyFill", "seam", "sunSatInk"];
const NULLABLE_COLOR_ROLES = ["weekendFill", "weekendTint", "bandFill", "weekdayRowFill"];
const HEX = /^#[0-9a-f]{6}$/;
const byId = Object.fromEntries(SCHEMES.map((s) => [s.id, s]));

// The ground each text role sits on.
const grounds = (s) => ({
  dayInk: s.dayFill,
  weekdayInk: s.weekdayRowFill ?? s.dayFill,
  weekendInk: s.weekendFill ?? s.weekendTint,
  weekendInkSmall: s.weekendFill ?? s.weekendTint,
  monthInk: s.bandFill ?? s.dayFill,
  sunSatInk: s.weekdayRowFill ?? s.weekendFill ?? s.weekendTint,
});

const textPairs = (s) => Object.entries(grounds(s)).map(([role, ground]) => ({ role, fg: s[role], bg: ground }));

test("eleven schemes in the agreed order, unique ids and names", () => {
  assert.equal(SCHEMES.length, 11);
  assert.deepEqual(SCHEMES.map((s) => s.id), ORDER);
  assert.equal(new Set(SCHEMES.map((s) => s.id)).size, 11);
  assert.equal(new Set(SCHEMES.map((s) => s.name)).size, 11);
});

test("exactly one default scheme, paper-red", () => {
  assert.deepEqual(SCHEMES.filter((s) => s.isDefault).map((s) => s.id), ["paper-red"]);
});

test("six light and five dark schemes", () => {
  assert.equal(SCHEMES.filter((s) => s.kind === "light").length, 6);
  assert.equal(SCHEMES.filter((s) => s.kind === "dark").length, 5);
  for (const s of SCHEMES) assert.ok(["light", "dark"].includes(s.kind) && ["band", "line"].includes(s.style), s.id);
});

test("every role is present and well formed", () => {
  for (const s of SCHEMES) {
    for (const r of COLOR_ROLES) assert.match(String(s[r]), HEX, `${s.id}.${r}`);
    for (const r of NULLABLE_COLOR_ROLES) {
      assert.ok(r in s, `${s.id}.${r} missing`);
      assert.ok(s[r] === null || HEX.test(s[r]), `${s.id}.${r}`);
    }
    for (const r of ["lineRow1", "lineRow2"]) {
      assert.ok(r in s, `${s.id}.${r} missing`);
      if (s[r] !== null) {
        assert.match(s[r].color, HEX, `${s.id}.${r}.color`);
        assert.ok(Number.isInteger(s[r].px) && s[r].px > 0, `${s.id}.${r}.px`);
      }
    }
    for (const r of ["id", "name", "source"]) assert.ok(typeof s[r] === "string" && s[r].length > 0, `${s.id}.${r}`);
    assert.equal(typeof s.isDefault, "boolean", s.id);
    assert.ok(s.inspiredBy === null || typeof s.inspiredBy === "string", s.id);
  }
});

test("Saturday and Sunday share one weekend token set by construction", () => {
  // The key list is closed: one weekend fill/tint/ink and one SUN/SAT label ink, no per-day fields.
  const keys = ["id", "name", "kind", "style", "isDefault", "source", "inspiredBy", "dayFill", "dayInk", "weekdayInk", "weekendFill", "weekendInk", "weekendInkSmall",
    "weekendTint", "bandFill", "monthInk", "weekdayRowFill", "emptyFill", "seam", "lineRow1", "lineRow2", "sunSatInk"].sort();
  for (const s of SCHEMES) assert.deepEqual(Object.keys(s).sort(), keys, s.id);
});

test("third-party schemes are named inspired-by and flagged unchecked", () => {
  const third = ["solarized-light", "gruvbox-light", "dracula", "monokai", "gruvbox-dark", "catppuccin-mocha"];
  for (const s of SCHEMES) {
    if (third.includes(s.id)) {
      assert.ok(s.inspiredBy, s.id);
      assert.match(s.source, /from memory/, s.id);
      assert.match(s.source, /license check pending/, s.id);
    } else assert.equal(s.inspiredBy, null, s.id);
  }
});

test("paper schemes: line style has no band, the weekend tint is the accent mixed into white", () => {
  const red = byId["paper-red"];
  assert.equal(red.style, "band");
  assert.equal(red.weekendTint, mix("#e0282c", "#ffffff", 0.92));
  assert.equal(red.emptyFill, "#ffffff");
  assert.deepEqual(red.lineRow2, { color: "#e0282c", px: 2 });
  assert.equal(red.lineRow1, null);
  const blue = byId["paper-blue"];
  assert.equal(blue.style, "line");
  assert.equal(blue.bandFill, null);
  assert.deepEqual(blue.lineRow1, { color: "#1558d8", px: 3 });
  assert.deepEqual(blue.lineRow2, { color: "#1558d8", px: 2 });
  assert.equal(blue.weekendTint, "#e3ebfa");
  assert.equal(blue.emptyFill, "#ffffff");
});

test("weekendInkSmall equals weekendInk, except Paper Red: the minimal darkening that reads 4.5:1 on the tint", () => {
  for (const s of SCHEMES) {
    if (s.id !== "paper-red") assert.equal(s.weekendInkSmall, s.weekendInk, s.id);
  }
  const red = byId["paper-red"];
  assert.equal(red.weekendInkSmall, shiftToContrast(red.weekendInk, red.weekendTint, SMALL_TEXT));
  assert.equal(red.weekendInkSmall, "#d5262a");
});

test("High Contrast empty days are #2a2a2a (owner decision, lighter than the mock's #161616)", () => {
  assert.equal(byId["high-contrast"].emptyFill, "#2a2a2a");
});

test("the weekday line exists only for Paper Red, Paper Blue, Monokai and High Contrast", () => {
  assert.deepEqual(SCHEMES.filter((s) => s.lineRow2 !== null).map((s) => s.id), ["paper-red", "paper-blue", "monokai", "high-contrast"]);
  assert.deepEqual(SCHEMES.filter((s) => s.lineRow1 !== null).map((s) => s.id), ["paper-blue"]);
});

test("text pairs: 4.5:1, or 3:1 for the named large-text pairs", () => {
  for (const s of SCHEMES) {
    const large = LARGE_TEXT_PAIRS[s.id] ?? [];
    for (const { role, fg, bg } of textPairs(s)) {
      const gate = large.includes(role) ? LARGE_TEXT : SMALL_TEXT;
      const c = contrast(fg, bg);
      assert.ok(c >= gate, `${s.id}.${role} ${fg} on ${bg} is ${c.toFixed(2)}, needs ${gate}`);
    }
  }
  for (const [id, roles] of Object.entries(LARGE_TEXT_PAIRS)) {
    for (const r of roles) assert.ok(r in grounds(byId[id]), `${id}.${r} is not a text role`);
  }
});

test("lines read at 3:1 against the tiles they touch", () => {
  for (const s of SCHEMES) {
    const neighbors = [s.dayFill, s.weekdayRowFill, s.weekendFill, s.weekendTint, s.emptyFill].filter((c) => c !== null);
    for (const row of ["lineRow1", "lineRow2"]) {
      if (s[row] === null) continue;
      for (const n of neighbors) {
        const c = contrast(s[row].color, n);
        const exempt = (LINE_EXCEPTIONS[s.id] ?? []).includes(`${row}:${n}`);
        assert.ok(exempt || c >= NON_TEXT, `${s.id}.${row} ${s[row].color} vs ${n} is ${c.toFixed(2)}`);
      }
    }
  }
});

test("the data is frozen", () => {
  const frozen = (v) => v === null || typeof v !== "object" || (Object.isFrozen(v) && Object.values(v).every(frozen));
  assert.ok(frozen(SCHEMES));
  assert.throws(() => { SCHEMES.push(SCHEMES[0]); }, TypeError);
  assert.throws(() => { SCHEMES[0].dayFill = "#000000"; }, TypeError);
  assert.throws(() => { SCHEMES[1].lineRow1.px = 9; }, TypeError);
});
