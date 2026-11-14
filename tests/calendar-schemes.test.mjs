// SPDX-License-Identifier: AGPL-3.0-or-later
// Screen-only color schemes of the 3x3 calendar: role tokens in stickerArt, fed by the Calendar7 catalog.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateDesign } from "../src/apps/calendar/model.ts";
import { stickerArt, stickerSvg, CAL3_SCHEMES, CAL3_EXCLUDED, DEFAULT_CAL3_SCHEME, cal3SchemeById, paintSticker } from "../src/apps/calendar/artwork.ts";
import { SCHEMES } from "../src/apps/calendar7/schemes.ts";
import { contrast } from "./calendar7-contrast.mjs";

const IDS = ["de-a", "de-a-unpadded", "en-3-zero", "en-3-unpadded"];
const designs = Object.fromEntries(IDS.map((id) => [id, validateDesign(JSON.parse(readFileSync(`public/calendar/${id}.json`, "utf8")))]));

// The artwork of main before this change, copied verbatim as the pin of the default scheme.
const legacy = (s) => {
  const weekend = s.slot === 0 && ["SAT", "SUN"].includes(s.image);
  return {
    weight: weekend ? 800 : 600,
    color: weekend ? "#ba302c" : /^[0-9]$/.test(s.image) ? "#315d4e" : s.slot < 3 ? "#25343e" : "#925a32",
    size: s.image.length === 3 ? 82 : s.image.length === 2 ? 112 : 168,
  };
};

test("default scheme reproduces the current artwork for every sticker of every print", () => {
  assert.equal(DEFAULT_CAL3_SCHEME.id, "default");
  for (const d of Object.values(designs))
    for (const s of d.printing) {
      for (const art of [stickerArt(s), stickerArt(s, DEFAULT_CAL3_SCHEME)]) {
        assert.deepEqual({ weight: art.weight, color: art.color, size: art.size }, legacy(s), `${d.id} ${s.id}`);
        assert.equal(art.ground, "#fffdf6");
      }
    }
});

test("the print export keeps the default artwork: stickerSvg takes no scheme", () => {
  const s = designs["en-3-zero"].printing.find((x) => x.image === "SUN");
  const svg = stickerSvg(s, { 600: "", 800: "" });
  assert.match(svg, /fill="#ba302c"/);
  assert.match(svg, /<rect width="256" height="256" fill="#fffdf6"\/>/);
  assert.equal(stickerSvg.length, 2);
});

test("unknown, null and missing scheme ids give the default; the catalog is the Calendar7 one minus the excluded", () => {
  for (const id of ["nope", "", null, undefined, "__proto__"]) assert.equal(cal3SchemeById(id), DEFAULT_CAL3_SCHEME);
  assert.deepEqual(CAL3_SCHEMES[0], DEFAULT_CAL3_SCHEME);
  const ids = CAL3_SCHEMES.slice(1).map((s) => s.id);
  const excluded = CAL3_EXCLUDED.map((e) => e.id);
  assert.deepEqual([...ids, ...excluded].sort(), SCHEMES.map((s) => s.id).sort());
  for (const e of CAL3_EXCLUDED) assert.ok(e.reason.length > 20, e.id);
  assert.ok(excluded.includes("rubik-tint"), "needs the home faces of the 7x7 names data");
  for (const s of SCHEMES.filter((x) => ids.includes(x.id))) assert.equal(cal3SchemeById(s.id).name, s.name);
});

test("every label class of every 3x3 scheme passes the contrast gates", () => {
  for (const sc of CAL3_SCHEMES.slice(1)) {
    for (const role of ["day", "weekday", "month"]) assert.ok(contrast(sc.roles[role].ink, sc.ground) >= 4.5, `${sc.id} ${role} ${contrast(sc.roles[role].ink, sc.ground)}`);
    // SAT/SUN and the German S are large bold (82 px and 168 px, weight 800): the 3:1 gate of the Calendar7 weekend labels.
    assert.ok(contrast(sc.roles.weekend.ink, sc.roles.weekend.ground) >= 3, `${sc.id} weekend`);
    assert.equal(sc.roles.weekend.weight, 800);
  }
});

test("German: only the S weekday sticker (slot 0) carries the weekend cue, in non-default schemes", () => {
  const sc = cal3SchemeById("classic");
  for (const id of ["de-a", "de-a-unpadded"])
    for (const s of designs[id].printing) {
      const cue = s.image === "S" && s.slot === 0;
      const art = stickerArt(s, sc);
      assert.equal(art.color === sc.roles.weekend.ink && art.ground === sc.roles.weekend.ground, cue, `${id} ${s.slot}:${s.image}`);
      if (cue) assert.equal(art.weight, 800);
      assert.equal(stickerArt(s).color === "#ba302c", false);
    }
  assert.equal(designs["de-a"].printing.filter((s) => s.image === "S" && s.slot === 0).length, 1);
});

test("English: SAT and both SUN use the weekend token; other stickers do not", () => {
  const sc = cal3SchemeById("paper-blue");
  for (const d of [designs["en-3-zero"], designs["en-3-unpadded"]])
    for (const s of d.printing) {
      const weekend = ["SAT", "SUN"].includes(s.image) && s.slot === 0;
      assert.equal(stickerArt(s, sc).ground === sc.roles.weekend.ground && stickerArt(s, sc).color === sc.roles.weekend.ink, weekend, `${s.slot}:${s.image}`);
    }
});

test("paintSticker draws ground then glyph with the scheme tokens, on the given canvas context", () => {
  const calls = [];
  const ctx = new Proxy({}, { set: (_t, k, v) => (calls.push(["set", k, v]), true), get: (_t, k) => (...a) => calls.push([k, ...a]) });
  const s = designs["en-3-zero"].printing.find((x) => x.image === "SUN");
  paintSticker(ctx, s, cal3SchemeById("classic"));
  const sc = cal3SchemeById("classic");
  assert.deepEqual(calls.find((c) => c[0] === "set" && c[1] === "fillStyle")[2], sc.roles.weekend.ground);
  assert.ok(calls.some((c) => c[0] === "set" && c[1] === "fillStyle" && c[2] === sc.roles.weekend.ink));
  assert.ok(calls.some((c) => c[0] === "fillText" && c[1] === "SUN"));
});

