// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 color schemes applied to the sticker art: every label class in every scheme, drawn through a recording
// context. Expected grounds and inks are written here from the scheme roles, not taken from tileRoles. Deterministic, no WebGL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast } from "./calendar7-contrast.mjs";
import { DEFAULT_SCHEME, SCHEMES, schemeById } from "../src/apps/calendar7/schemes.ts";
import { FACE_FLAT, LINE_SCALE, TEXTURE, drawFace, drawSticker, tileClass } from "../src/apps/calendar7/sticker-art.ts";

function record(draw) {
  const log = [];
  const font = { v: "" };
  const ctx = {
    set fillStyle(v) { log.push(["fillStyle", v]); },
    get fillStyle() { return [...log].reverse().find((e) => e[0] === "fillStyle")?.[1]; },
    set font(v) { font.v = v; },
    set textAlign(v) {},
    set textBaseline(v) {},
    fillRect(...a) { log.push(["fillRect", ctx.fillStyle, ...a]); },
    fillText(t, ...a) { log.push(["fillText", ctx.fillStyle, t]); },
    measureText: (t) => ({ width: Number(font.v.match(/(\d+(?:\.\d+)?)px/)[1]) * 0.6 * t.length }),
    save() {}, restore() {}, translate() {}, scale() {},
  };
  draw(ctx);
  return log;
}
const texts = (log) => log.filter((e) => e[0] === "fillText");
const rects = (log) => log.filter((e) => e[0] === "fillRect");

// class -> [text, print ink, ground role(s), ink role]. Grounds follow tests/calendar7-schemes.test.mjs.
const TILES = {
  day: ["7", "dark", (s) => s.dayFill, "dayInk"],
  weekend: ["28", "red", (s) => s.weekendFill ?? s.weekendTint, "weekendInk"],
  weekday: ["MON", "weekday", (s) => s.weekdayRowFill ?? s.dayFill, "weekdayInk"],
  sun: ["SUN", "red", (s) => s.weekdayRowFill ?? s.weekendFill ?? s.weekendTint, "sunSatInk"],
  sat: ["SAT", "red", (s) => s.weekdayRowFill ?? s.weekendFill ?? s.weekendTint, "sunSatInk"],
  month: ["J", "month", (s) => s.bandFill ?? s.dayFill, "monthInk"],
};
const LARGE = { "paper-red": ["weekendInk", "sunSatInk"] };

test("tile class is decided by label and ink class only", () => {
  assert.equal(tileClass("", "blank"), "blank");
  assert.equal(tileClass("7", "dark"), "day");
  assert.equal(tileClass("28", "red"), "weekend");
  assert.equal(tileClass("23/30", "red"), "weekend");
  assert.equal(tileClass("SUN", "red"), "sunsat");
  assert.equal(tileClass("SAT", "red"), "sunsat");
  assert.equal(tileClass("MON", "weekday"), "weekday");
  assert.equal(tileClass("J", "month"), "month");
});

test("schemeById: known ids, unknown and missing ids give the default scheme without throwing", () => {
  for (const s of SCHEMES) assert.equal(schemeById(s.id), s);
  assert.equal(DEFAULT_SCHEME.id, "paper-red");
  for (const bad of ["nope", "", null, undefined, "PAPER-BLUE", "__proto__"]) assert.equal(schemeById(bad), DEFAULT_SCHEME);
});

for (const scheme of SCHEMES) {
  test(`${scheme.id}: every label class draws its ground and ink, readable`, () => {
    for (const [cls, [text, ink, ground, role]] of Object.entries(TILES)) {
      for (const draw of [(c) => drawSticker(c, text, ink, "strict", scheme), (c) => drawFace(c, text, ink, "strict", scheme)]) {
        const log = record(draw);
        assert.deepEqual(log[0], ["fillStyle", ground(scheme)], `${cls} ground`);
        const t = texts(log);
        assert.equal(t.length, 1);
        assert.equal(t[0][1], scheme[role], `${cls} ink`);
        const gate = (LARGE[scheme.id] ?? []).includes(role) ? 3 : 4.5;
        assert.ok(contrast(t[0][1], ground(scheme)) >= gate, `${scheme.id} ${cls} contrast`);
      }
    }
  });

  test(`${scheme.id}: blank tiles take the empty fill and carry no ink`, () => {
    for (const draw of [(c) => drawSticker(c, "", "blank", "strict", scheme), (c) => drawFace(c, "", "blank", "strict", scheme)]) {
      const log = record(draw);
      assert.deepEqual(log[0], ["fillStyle", scheme.emptyFill]);
      assert.equal(texts(log).length, 0);
      assert.ok(rects(log).every((e) => e[1] === scheme.emptyFill), "only the ground is painted");
    }
  });

  test(`${scheme.id}: folded weekend labels draw the big number in weekendInk and the small one in weekendInkSmall`, () => {
    for (const text of ["23/30", "24/31"]) {
      const log = record((c) => drawSticker(c, text, "red", "strict", scheme));
      const t = texts(log);
      assert.deepEqual(t.map((e) => e[2]), text.split("/"));
      assert.deepEqual(t.map((e) => e[1]), [scheme.weekendInk, scheme.weekendInkSmall]);
      const ground = scheme.weekendFill ?? scheme.weekendTint;
      assert.ok(contrast(scheme.weekendInkSmall, ground) >= 4.5);
    }
  });

  test(`${scheme.id}: folded labels sit on the weekend ground, like other weekend digits`, () => {
    for (const text of ["23/30", "24/31"]) {
      for (const draw of [(c) => drawSticker(c, text, "red", "strict", scheme), (c) => drawFace(c, text, "red", "strict", scheme)]) {
        assert.deepEqual(record(draw)[0], ["fillStyle", scheme.weekendFill ?? scheme.weekendTint], `${text} ground`);
      }
      // A folded label on a weekday tile (dark ink) sits on the day ground.
      assert.deepEqual(record((c) => drawSticker(c, text, "dark", "strict", scheme))[0], ["fillStyle", scheme.dayFill], `${text} weekday ground`);
    }
  });

  test(`${scheme.id}: the weekday-row line is drawn on weekday-name tiles only, lineRow1 never`, () => {
    for (const [cls, [text, ink]] of Object.entries(TILES)) {
      const names = cls === "weekday" || cls === "sun" || cls === "sat";
      const sticker = record((c) => drawSticker(c, text, ink, "strict", scheme));
      if (names && scheme.lineRow2) {
        const h = scheme.lineRow2.px * LINE_SCALE;
        assert.deepEqual(rects(sticker).at(-1), ["fillRect", scheme.lineRow2.color, 0, TEXTURE - h, TEXTURE, h], `${cls} sticker line`);
        const face = record((c) => drawFace(c, text, ink, "strict", scheme));
        const edge = TEXTURE * ((1 + FACE_FLAT) / 2);
        const last = rects(face).at(-1);
        assert.equal(last[1], scheme.lineRow2.color);
        assert.ok(Math.abs(last[3] + last[5] - edge) < 1e-9, `${cls} face line sits on the flat edge`);
      } else {
        assert.equal(rects(sticker).length, 1, `${cls} paints only its ground`);
      }
      // lineRow1 is not applied: no tile gets a rect of its width (its color may equal lineRow2's, as in Paper Blue).
      if (scheme.lineRow1) assert.ok(rects(sticker).every((e) => e[5] !== scheme.lineRow1.px * LINE_SCALE), "lineRow1 not applied");
    }
  });
}

test("scheme line pixels are scaled to the 192 px texture: 4 texture pixels per line pixel", () => {
  assert.equal(TEXTURE, 192);
  assert.equal(LINE_SCALE, 4);
});

test("the print look without a scheme is unchanged", () => {
  const log = record((c) => drawSticker(c, "28", "red", "strict"));
  assert.deepEqual(log[0], ["fillStyle", "#fffdf6"]);
  assert.equal(texts(log)[0][1], "#b3261e");
});
