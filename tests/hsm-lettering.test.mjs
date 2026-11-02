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
  for (const [variant, dir, map] of [
    ["words", "public/assets/hsm/words", { H: "hour", M: "min", S: "sec" }],
    ["words-pascal", "public/assets/hsm/words-pascal", { H: "Hour", M: "Min", S: "Sec" }],
  ]) {
    const p = JSON.parse(
      readFileSync(`${dir}/provenance.json`, "utf8"),
    );
    assert.equal(hash(readFileSync(p.font.path)), p.font.sha256);
    assert.equal(p.font.license, "SIL-OFL-1.1");
    assert(p.fontSize <= MAX_WORD_FONT_SIZE);
    for (const a of hsmImagesFor(variant)) {
      const bytes = readFileSync("public" + a.url),
        svg = bytes.toString();
      assert.equal(hash(bytes), a.sha256);
      assert.match(svg, /viewBox="0 0 256 256"/);
      assert.equal((svg.match(/<path\b/g) || []).length, 1);
      assert.doesNotMatch(svg, /<text|href=|url\(|stroke=/);
      assertWordRules(p, a.id);
      assert.equal(p.stickers[a.id].text, map[a.id]);
    }
  }
  assert.equal(parseLettering("words"), "words");
  assert.equal(parseLettering("words-pascal"), "words-pascal");
  assert.equal(parseLettering("unsupported"), "symbols");
});
test("all lettering choices retain the same physical print and valid upright HSM setups", () => {
  const original = validateHsmDesign(
    JSON.parse(readFileSync("public/hsm-counter.v3.json", "utf8")),
  );
  for (const style of ["symbols", "words", "words-pascal"]) {
    const d = hsmDesignFor(original, style);
    assert.deepEqual(d.print.cubies, original.print.cubies);
    assert.deepEqual(d.print.stickers, original.print.stickers);
    assert.equal(
      d.print.id,
      style === "words-pascal"
        ? "hsm_counter_seconds_first_words_pascal"
        : style === "words"
          ? "hsm_counter_seconds_first_words"
          : original.print.id,
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
  assert.deepEqual(HSM_UNITS.map((u) => hsmUnitLabel(u, "words-pascal")), ["Hour", "Min", "Sec"]);
  assert.equal(hsmUnitLabel("H", parseLettering("anything else")), "H");
});
