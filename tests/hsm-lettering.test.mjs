import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  hsmImagesFor,
  parseLettering,
  hsmDesignFor,
  hsmUnitLabel,
  HSM_UNITS,
} from "../src/apps/hsm/lettering.ts";
import {
  assertWordRules,
  MAX_WORD_FONT_SIZE,
} from "./helpers/hsm-word-rules.mjs";
import { validateHsmDesign, hsmTarget } from "../src/apps/hsm/design.ts";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
} from "../packages/cube-mechanics/src/index.ts";
const hash = (b) => createHash("sha256").update(b).digest("hex");
test("unit lettering is a fixed vector print with only small bottom words", () => {
  const p = JSON.parse(
    readFileSync("public/assets/hsm/words/provenance.json", "utf8"),
  );
  assert.equal(hash(readFileSync(p.font.path)), p.font.sha256);
  assert.equal(p.font.license, "SIL-OFL-1.1");
  assert.equal(p.fontSize, MAX_WORD_FONT_SIZE);
  for (const a of hsmImagesFor("words")) {
    const bytes = readFileSync("public" + a.url),
      svg = bytes.toString();
    assert.equal(hash(bytes), a.sha256);
    assert.match(svg, /viewBox="0 0 256 256"/);
    assert.equal((svg.match(/<path\b/g) || []).length, 1);
    assert.doesNotMatch(svg, /<text|href=|url\(|stroke=/);
    // Lower third of the canvas, at least 2.5 mm (32 units) from the side edges
    // (beyond the 1 mm print safe inset) and 1.5 mm from the bottom, checked
    // against the exporter-recorded bounds with a documented tolerance.
    assertWordRules(p, a.id);
    assert.equal(
      p.stickers[a.id].text,
      { H: "hour", M: "min", S: "sec" }[a.id],
    );
  }
  assert.equal(parseLettering("words"), "words");
  assert.equal(parseLettering("unsupported"), "symbols");
});
test("both lettering choices retain the same physical print and valid upright HSM setups", () => {
  const original = validateHsmDesign(
    JSON.parse(readFileSync("public/hsm-counter.v3.json", "utf8")),
  );
  for (const style of ["symbols", "words"]) {
    const d = hsmDesignFor(original, style);
    assert.deepEqual(d.print.cubies, original.print.cubies);
    assert.deepEqual(d.print.stickers, original.print.stickers);
    assert.equal(
      d.print.id,
      style === "words" ? "hsm_counter_seconds_first_words" : original.print.id,
    );
    for (const letter of ["H", "M", "S"])
      assert(
        matchesTarget(
          d.print,
          applyMoves(initialState(d.print), parseAlg(d.zeroWords[letter])),
          hsmTarget(letter, 0),
        ),
      );
  }
});
test("the Unit select lists H, M, S in that order and follows the lettering", () => {
  assert.deepEqual([...HSM_UNITS], ["H", "M", "S"]);
  assert.deepEqual(HSM_UNITS.map((u) => hsmUnitLabel(u, "symbols")), ["H", "M", "S"]);
  assert.deepEqual(HSM_UNITS.map((u) => hsmUnitLabel(u, "words")), ["hour", "min", "sec"]);
  assert.equal(hsmUnitLabel("H", parseLettering("anything else")), "H");
});
