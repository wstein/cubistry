// SPDX-License-Identifier: AGPL-3.0-or-later
// The wrong-cell hatch (#438) on the Rubik-Tint scheme (#443): `Calendar7Viewer.prototype.draw` paints a marked cell on the tint of the stone's home face,
// then hatches it with the scheme-independent halo and hatch colors; nothing repaints the ground afterwards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Calendar7Viewer } from "../src/apps/calendar7/viewer.ts";
import { SCHEMES, withBannerStyle, namesGround } from "../src/apps/calendar7/schemes.ts";
import { FACES } from "../scripts/calendar7-rubik-tint.mjs";
import { RUBIK_TINTS } from "../src/apps/calendar7/home-tint.ts";
import { WRONG_CELL } from "../src/apps/calendar7/sticker-art.ts";

// Recording canvas: every property write and every call, in order; text measures 10 wide.
function record() {
  const log = [];
  const ctx = new Proxy({}, {
    set(_, k, v) { log.push(["set", k, v]); return true; },
    get(_, k) { return k === "measureText" ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : (...a) => { log.push(["call", k, ...a]); }; },
  });
  return { log, canvas: { width: 192, height: 192, getContext: () => ctx } };
}
const rubik = withBannerStyle(SCHEMES.find((s) => s.id === "rubik-tint"), "theme");
const stub = (canvas, face) => ({ font: null, scheme: rubik, surface: "face", layout: "names", nameWords: undefined, homeOf: new Map([[canvas, face]]) });

test("viewer.draw: a marked cell has the tint of its home face as ground, the hatch is drawn last in its own colors", () => {
  for (const face of FACES) {
    const marked = record(), plain = record();
    Calendar7Viewer.prototype.draw.call(stub(plain.canvas, face), plain.canvas, "14", "dark", undefined, false);
    Calendar7Viewer.prototype.draw.call(stub(marked.canvas, face), marked.canvas, "14", "dark", undefined, true);
    const ground = marked.log.find((e) => e[0] === "set" && e[1] === "fillStyle")[2];
    assert.equal(ground, namesGround(RUBIK_TINTS[face]), `${face}: the marked cell is painted on the tint of its home face`);
    assert.deepEqual(marked.log.slice(0, plain.log.length), plain.log, `${face}: the original drawing is unchanged under the hatch`);
    const hatch = marked.log.slice(plain.log.length);
    assert.ok(!hatch.some((e) => e[1] === "fillRect" || e[1] === "fillText" || (e[0] === "set" && e[1] === "fillStyle")), `${face}: the hatch paints no ground and no text`);
    assert.deepEqual(hatch.filter((e) => e[0] === "set" && e[1] === "strokeStyle").map((e) => e[2]), [WRONG_CELL.halo, WRONG_CELL.hatch], `${face}: halo and hatch keep their own colors`);
  }
});
