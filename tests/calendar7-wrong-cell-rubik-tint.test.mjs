// SPDX-License-Identifier: AGPL-3.0-or-later
// The wrong-cell hatch (#438) on the Rubik-Tint scheme (#443): the viewer draws the face with the tint of the stone's home face, then the hatch on top.
// The hatch colors do not depend on the scheme and nothing repaints the tinted ground afterwards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMES, withBannerStyle, namesGround } from "../src/apps/calendar7/schemes.ts";
import { FACES } from "../scripts/calendar7-rubik-tint.mjs";
import { RUBIK_TINTS, schemeForHome } from "../src/apps/calendar7/home-tint.ts";
import { drawFace, drawWrongCell, WRONG_CELL } from "../src/apps/calendar7/sticker-art.ts";

// Recording context: every property write and every call, in order; the text measures 10 wide.
function recorder() {
  const log = [];
  const ctx = new Proxy({}, {
    set(_, k, v) { log.push(["set", k, v]); return true; },
    get(_, k) { return k === "measureText" ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : (...a) => { log.push(["call", k, ...a]); }; },
  });
  return { ctx, log };
}

test("the hatch is drawn last, in its own colors, on the tinted ground of every home face", () => {
  const rubik = withBannerStyle(SCHEMES.find((s) => s.id === "rubik-tint"), "theme");
  for (const face of FACES) {
    const { ctx, log } = recorder();
    drawFace(ctx, "14", "dark", undefined, schemeForHome(rubik, face), "names");
    const afterFace = log.length;
    drawWrongCell(ctx, 192, 192, undefined);
    const ground = log.slice(0, afterFace).find((e) => e[0] === "set" && e[1] === "fillStyle")[2];
    assert.equal(ground, namesGround(RUBIK_TINTS[face]), `${face}: the face is painted on the tint of its home face`);
    const hatch = log.slice(afterFace);
    assert.ok(!hatch.some((e) => e[1] === "fillRect" || e[1] === "fillText" || (e[0] === "set" && e[1] === "fillStyle")), `${face}: the hatch paints no ground and no text`);
    const styles = hatch.filter((e) => e[0] === "set" && e[1] === "strokeStyle").map((e) => e[2]);
    assert.deepEqual(styles, [WRONG_CELL.halo, WRONG_CELL.hatch], `${face}: halo and hatch keep their own colors`);
    assert.equal(hatch.filter((e) => e[1] === "stroke").length, 2);
  }
});
