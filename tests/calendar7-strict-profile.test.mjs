// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube: the "strict" rule profile (research candidate, not certified).
// Strict = only the digit 0 and 6 <-> 9 equal after a turn, O != 0, I != 1, upright split labels
// drawn diagonally, weekday letters MON and FRI. Mirrors research/calendar-7x7/upright-moves/
// verify_moves.jl (branch research/cube-display-feasibility). Deterministic, no DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STICKERS, clonePose } from "../src/apps/calendar7/engine.ts";
import { frontFailure, imageNormal, monthCells } from "../src/apps/calendar7/display.ts";
import { DEFAULT_RULE_PROFILE, RULE_PROFILES } from "../src/apps/calendar7/profile.ts";
import { parseState } from "../src/apps/calendar7/graph.ts";
import {
  EM,
  INK_COLORS,
  PAPER,
  SPLIT_DIGIT_FRACTION,
  TEXTURE,
  TEXT_SQUARE,
  drawSticker,
  SPLIT_MIN_GAP,
  SPLIT_SLASH_LIFT,
  isSplitLabel,
  splitInkGaps,
  splitLayout,
} from "../src/apps/calendar7/sticker-art.ts";

const { pose: root } = parseState(JSON.parse(readFileSync("public/calendar7/state.v1.json", "utf8")));
const strictNorm = (t, a, i = "dark") => imageNormal(t, a, i, "strict");
const legacyNorm = (t, a, i = "dark") => imageNormal(t, a, i, "legacy");

test("profiles: legacy is the default and the only switch is DEFAULT_RULE_PROFILE", () => {
  assert.deepEqual([...RULE_PROFILES], ["legacy", "strict"]);
  assert.equal(DEFAULT_RULE_PROFILE, "legacy");
  assert.deepEqual(imageNormal("O", 0, "dark"), legacyNorm("O", 0));
  assert.deepEqual(imageNormal("O", 0, "dark"), legacyNorm("0", 0));
});

test("strict glyph rule: 0 versus O, 1 versus I, 6 and 9, no other half-turn reading", () => {
  // No aliasing: O is not 0 and I is not 1, at every angle.
  for (const a of [0, 1, 2, 3]) {
    assert.notDeepEqual(strictNorm("O", a), strictNorm("0", 0), `O vs 0 at ${a}`);
    assert.notDeepEqual(strictNorm("I", a), strictNorm("1", 0), `I vs 1 at ${a}`);
  }
  // The legacy rule still aliases them.
  assert.deepEqual(legacyNorm("I", 0), legacyNorm("1", 0));
  // The digit 0 reads the same at every turn; ink still matters.
  for (const a of [1, 2, 3]) assert.deepEqual(strictNorm("0", a), strictNorm("0", 0));
  assert.notDeepEqual(strictNorm("0", 0, "red"), strictNorm("0", 0, "dark"));
  // 6 <-> 9 by a half turn only.
  assert.deepEqual(strictNorm("9", 2), strictNorm("6", 0));
  assert.deepEqual(strictNorm("6", 2), strictNorm("9", 0));
  assert.notDeepEqual(strictNorm("9", 0), strictNorm("6", 0));
  assert.notDeepEqual(strictNorm("9", 1), strictNorm("6", 0));
  assert.notDeepEqual(strictNorm("9", 3), strictNorm("6", 0));
  // Digits that legacy accepts turned are upright-only under strict.
  for (const d of ["1", "2", "5", "8"]) {
    assert.deepEqual(legacyNorm(d, 2), legacyNorm(d, 0), `legacy ${d}`);
    assert.notDeepEqual(strictNorm(d, 2), strictNorm(d, 0), `strict ${d}`);
  }
  for (const l of ["H", "N", "S", "X", "Z"]) {
    assert.deepEqual(legacyNorm(l, 2), legacyNorm(l, 0), `legacy ${l}`);
    assert.notDeepEqual(strictNorm(l, 2), strictNorm(l, 0), `strict ${l}`);
  }
  // Multi-character labels: only whole-string 0/6/9 half turns (60 <-> 09 reversed).
  assert.deepEqual(strictNorm("69", 2), strictNorm("69", 0)); // 69 turned reads 69
  assert.notDeepEqual(strictNorm("16", 2), strictNorm("91", 0));
  assert.notDeepEqual(strictNorm("MON", 2, "weekday"), strictNorm("MON", 0, "weekday"));
  assert.equal(strictNorm("", 3, "blank"), "blank");
});

// Independent port of `reading` in verify_moves.jl, compared with imageNormal exhaustively.
const HALFMAP = { 0: "0", 6: "9", 9: "6" };
const halfturn = (t) => ([...t].every((c) => c in HALFMAP) ? [...t].reverse().map((c) => HALFMAP[c]).join("") : null);
function reading(sText, sInk, angle, wText, wInk) {
  if (wText === "") return sText === "" ? "upright" : "bad";
  if (sText === "" || sInk !== wInk) return "bad";
  if (sText === wText && angle === 0) return "upright";
  if (sText === "0" && wText === "0") return "turned";
  const h = halfturn(sText);
  if (h !== null && angle === 2 && h === wText) return "turned";
  return "bad";
}
test("strict imageNormal agrees with the verifier reading on every pair of a small alphabet", () => {
  const words = ["", "0", "1", "5", "6", "9", "O", "I", "MON", "M0N", "FRI", "FR1", "23", "30", "69", "96", "60", "09", "23/30", "24/31"];
  let n = 0;
  for (const s of words)
    for (const w of words)
      for (const angle of [0, 1, 2, 3])
        for (const [si, wi] of [["dark", "dark"], ["red", "dark"]]) {
          const sInk = s === "" ? "blank" : si;
          const wInk = w === "" ? "blank" : wi;
          const same = JSON.stringify(strictNorm(s, angle, sInk)) === JSON.stringify(strictNorm(w, 0, wInk));
          assert.equal(same, reading(s, sInk, angle, w, wInk) !== "bad", `${s}@${angle}/${sInk} vs ${w}/${wInk}`);
          n++;
        }
  assert.ok(n > 1000);
});

// A strict printing for one month: every front sticker shows its cell, upright.
function strictFront(year, month) {
  const cells = monthCells(year, month);
  const pose = clonePose(root);
  const text = Array(STICKERS).fill("");
  const ink = Array(STICKERS).fill("blank");
  const front = [];
  for (let k = 0; k < 49; k++) {
    const row = Math.floor(k / 7) + 1;
    const col = (k % 7) + 1;
    const i = [...Array(STICKERS).keys()].find(
      (j) => pose.pos[3 * j] === col - 4 && pose.pos[3 * j + 1] === 4 - row && pose.pos[3 * j + 2] === 3 && pose.normal[3 * j + 2] === 1,
    );
    pose.up.set([0, 1, 0], 3 * i);
    text[i] = cells[k].text;
    ink[i] = cells[k].ink;
    front.push(i);
  }
  return { cells, pose, printing: { text, ink }, front };
}
const retext = (p, i, t) => ({ ...p, text: p.text.map((x, j) => (j === i ? t : x)) });
const turnTo = (pose, i, up) => {
  const q = clonePose(pose);
  q.up.set(up, 3 * i);
  return q;
};

test("strict front: letters MON and FRI, 0 and O, 1 and I, 6 and 9 on a real sheet", () => {
  // January 2028 starts on Saturday and needs six weeks: 23/30 and 24/31 exist.
  const f = strictFront(2028, 1);
  assert.equal(frontFailure(f.printing, f.pose, f.cells, "strict"), null);
  const at = (text) => f.front[f.cells.findIndex((c) => c.text === text)];
  const mon = at("MON");
  const fri = at("FRI");
  assert.equal(f.printing.text[mon], "MON");
  assert.equal(f.printing.text[fri], "FRI");
  // The legacy print letters (M0N, FR1) are not the letters MON and FRI under strict ...
  assert.equal(frontFailure(retext(f.printing, mon, "M0N"), f.pose, f.cells, "strict")?.why, "plain-mismatch");
  assert.equal(frontFailure(retext(f.printing, fri, "FR1"), f.pose, f.cells, "strict")?.why, "plain-mismatch");
  // ... but they were under legacy.
  assert.equal(frontFailure(retext(f.printing, mon, "M0N"), f.pose, f.cells, "legacy"), null);
  assert.equal(frontFailure(retext(f.printing, fri, "FR1"), f.pose, f.cells, "legacy"), null);
  // Letters never turn.
  assert.equal(frontFailure(f.printing, turnTo(f.pose, mon, [0, -1, 0]), f.cells, "strict")?.why, "plain-mismatch");
  // O (month letter, OCT) is not 0, I is not 1.
  const oct = strictFront(2026, 10);
  const o = oct.front[oct.cells.findIndex((c) => c.text === "O")];
  assert.equal(frontFailure(oct.printing, oct.pose, oct.cells, "strict"), null);
  assert.equal(frontFailure(retext(oct.printing, o, "0"), oct.pose, oct.cells, "strict")?.why, "plain-mismatch");
  assert.equal(frontFailure(retext(oct.printing, o, "0"), oct.pose, oct.cells, "legacy"), null);
  const one = f.front[f.cells.findIndex((c) => c.text === "1")];
  assert.equal(frontFailure(retext(f.printing, one, "I"), f.pose, f.cells, "strict")?.why, "plain-mismatch");
  assert.equal(frontFailure(retext(f.printing, one, "I"), f.pose, f.cells, "legacy"), null);
  // A date 6 may show a 9 turned by a half turn only; a 1 is not accepted turned.
  const six = f.front[f.cells.findIndex((c) => c.text === "6")];
  const nine = retext(f.printing, six, "9");
  assert.equal(frontFailure(nine, turnTo(f.pose, six, [0, -1, 0]), f.cells, "strict"), null);
  assert.equal(frontFailure(nine, f.pose, f.cells, "strict")?.why, "plain-mismatch");
  assert.equal(frontFailure(nine, turnTo(f.pose, six, [-1, 0, 0]), f.cells, "strict")?.why, "plain-mismatch");
  assert.equal(frontFailure(f.printing, turnTo(f.pose, one, [0, -1, 0]), f.cells, "strict")?.why, "plain-mismatch");
  assert.equal(frontFailure(f.printing, turnTo(f.pose, one, [0, -1, 0]), f.cells, "legacy"), null);
  // The digit 0 (a date 10) is not a letter; a letter O inside 10 ("1O") is not the digit 0.
  const ten = f.front[f.cells.findIndex((c) => c.text === "10")];
  assert.equal(frontFailure(retext(f.printing, ten, "1O"), f.pose, f.cells, "strict")?.why, "plain-mismatch");
});

test("strict front: split labels stay upright with exact text and ink", () => {
  const f = strictFront(2028, 1);
  const labels = f.cells.filter((c) => c.text.includes("/")).map((c) => c.text);
  assert.deepEqual(labels.sort(), ["23/30", "24/31"]);
  const s = f.front[f.cells.findIndex((c) => c.text === "24/31")];
  for (const up of [[-1, 0, 0], [0, -1, 0], [1, 0, 0]])
    assert.equal(frontFailure(f.printing, turnTo(f.pose, s, up), f.cells, "strict")?.why, "stacked-not-upright");
  assert.equal(frontFailure(retext(f.printing, s, "23/30"), f.pose, f.cells, "strict")?.why, "stacked-mismatch");
  assert.equal(frontFailure({ ...f.printing, ink: f.printing.ink.map((x, j) => (j === s ? (x === "red" ? "dark" : "red") : x)) }, f.pose, f.cells, "strict")?.why, "stacked-mismatch");
  // The un-split date is a plain mismatch.
  assert.equal(frontFailure(retext(f.printing, s, "24"), f.pose, f.cells, "strict")?.why, "plain-mismatch");
  // A label turned by a half turn is never accepted, even a look-alike such as 13/42 (the slash is not in the half-turn set).
  assert.equal(frontFailure(retext(f.printing, s, "13/42"), turnTo(f.pose, s, [0, -1, 0]), f.cells, "strict")?.why, "stacked-mismatch");
});

const inside = (b, lo, hi) => b.x0 >= lo && b.y0 >= lo && b.x1 <= hi && b.y1 <= hi;
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
test("diagonal layout of 23/30 and 24/31: top-left, slash in the middle, bottom-right, upright, inside the sticker", () => {
  for (const label of ["23/30", "24/31"]) {
    assert.ok(isSplitLabel(label));
    const { first, slash, second } = splitLayout(label);
    const [a, b] = label.split("/");
    assert.deepEqual([first.text, slash.text, second.text], [a, "/", b]);
    const lo = (TEXTURE - TEXT_SQUARE) / 2;
    const hi = lo + TEXT_SQUARE;
    // Digit ink height is 0.35 of the text square (0.735 em ink height of the Noto Sans digits).
    for (const p of [first, second]) {
      assert.ok(Math.abs(p.size * EM.digitInk - SPLIT_DIGIT_FRACTION * TEXT_SQUARE) < 1e-9);
      assert.ok(Math.abs(p.box.y1 - p.box.y0 - 0.35 * TEXT_SQUARE) < 1e-9);
      assert.equal(p.baseline, p.box.y1);
      assert.ok(inside(p.box, 0, TEXTURE) && inside(p.box, lo - 1e-9, hi + 1e-9), `${p.text} inside the sticker`);
    }
    // First number top-left, second bottom-right, both in their own half of the diagonal.
    assert.equal(first.align, "left");
    assert.equal(second.align, "right");
    assert.ok(Math.abs(first.box.x0 - lo) < 1e-9 && Math.abs(first.box.y0 - lo) < 1e-9);
    assert.ok(Math.abs(second.box.x1 - hi) < 1e-9 && Math.abs(second.box.y1 - hi) < 1e-9);
    assert.ok(first.box.x1 <= TEXTURE / 2 + 10 && first.box.y1 <= TEXTURE / 2);
    assert.ok(second.box.x0 >= TEXTURE / 2 - 10 && second.box.y0 >= TEXTURE / 2);
    assert.ok(first.box.y1 < second.box.y0, "numbers do not share a row band");
    assert.ok(!overlap(first.box, second.box), "numbers do not overlap");
    // The slash is centered (lift 0), inside the text square.
    const cx = (slash.box.x0 + slash.box.x1) / 2;
    const cy = (slash.box.y0 + slash.box.y1) / 2;
    assert.ok(Math.abs(cx - TEXTURE / 2) < 1e-9);
    assert.ok(Math.abs(cy - (TEXTURE / 2 - SPLIT_SLASH_LIFT * TEXTURE)) < 1e-9);
    assert.ok(inside(slash.box, lo, hi));
    // Stroke-aware: the slash stroke (polygon) keeps a real ink gap to both numbers' ink.
    const gaps = splitInkGaps({ first, slash, second });
    assert.ok(gaps.first >= SPLIT_MIN_GAP * TEXTURE, `${label} slash to ${a}: ${gaps.first.toFixed(2)} px`);
    assert.ok(gaps.second >= SPLIT_MIN_GAP * TEXTURE, `${label} slash to ${b}: ${gaps.second.toFixed(2)} px`);
    // Negative control: the old centered 0.45 slash (a measured 1 px collision in Chromium) is caught.
    const old = splitInkGaps(splitLayout(label, 0.45, 0));
    assert.ok(Math.min(old.first, old.second) < SPLIT_MIN_GAP * TEXTURE, `${label} old layout rejected`);
  }
  assert.throws(() => splitLayout("23"));
  assert.throws(() => splitLayout("MON"));
  assert.equal(isSplitLabel("0/5"), false);
});

function drawRun(text, ink, profile) {
  const calls = { fills: [], fonts: [], texts: [], aligns: [], baselines: [] };
  const ctx = {
    set fillStyle(v) {
      calls.fills.push(v);
    },
    set font(v) {
      calls.fonts.push(v);
    },
    set textAlign(v) {
      calls.aligns.push(v);
    },
    set textBaseline(v) {
      calls.baselines.push(v);
    },
    fillRect: () => calls.fills.push("rect"),
    fillText: (t, x, y) => calls.texts.push([t, x, y]),
    measureText: (t) => ({ width: Number(calls.fonts.at(-1).match(/(\d+(?:\.\d+)?)px/)[1]) * 0.6 * t.length }),
  };
  drawSticker(ctx, text, ink, profile);
  return calls;
}

test("sticker art: strict draws split labels as three upright runs, other labels as before", () => {
  const c = drawRun("23/30", "red", "strict");
  assert.equal(c.fills[0], PAPER);
  assert.ok(c.fills.includes(INK_COLORS.red));
  assert.deepEqual(c.texts.map((t) => t[0]), ["23", "/", "30"]);
  const l = splitLayout("23/30");
  assert.deepEqual(c.texts.map((t) => [t[1], t[2]]), [[l.first.x, l.first.baseline], [l.slash.x, l.slash.baseline], [l.second.x, l.second.baseline]]);
  assert.deepEqual(c.aligns, ["left", "center", "right"]);
  assert.ok(c.baselines.every((b) => b === "alphabetic"));
  // Legacy keeps the one-line label; strict draws MON and FRI as plain one-line letters.
  assert.deepEqual(drawRun("23/30", "red", "legacy").texts.map((t) => t[0]), ["23/30"]);
  assert.deepEqual(drawRun("23/30", "red").texts.map((t) => t[0]), ["23/30"]);
  for (const t of ["MON", "FRI", "7", "28", "O"]) assert.deepEqual(drawRun(t, "weekday", "strict").texts.map((x) => x[0]), [t]);
  assert.deepEqual(drawRun("", "blank", "strict").texts, []);
});
