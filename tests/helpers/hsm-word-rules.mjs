import assert from "node:assert/strict";

// Intended geometry of the HSM unit words, in 256-unit canvas coordinates.
export const MAX_WORD_FONT_SIZE = 80.64;
export const WORD_BASELINE = 232;
// The rule is "ink stays in the lower third": ink y >= 512 / 3 = 170.667.
export const LOWER_THIRD_Y = (256 * 2) / 3;
// Allowance for float and font-tooling noise in exporter-recorded bounds. One
// unit is 20/256 mm = 0.078 mm on a 20 mm sticker, so 0.1 units is 0.008 mm. The
// tightest word (H) clears the line by only 0.047 units; with this allowance a
// re-export may move that top edge by up to 0.147 units before the rule flips,
// while a real change still fails: font size 82 puts the top of H about 1.0 unit
// above the line and a one-unit baseline shift moves it by a full unit. The
// allowance alone would admit H up to font size 80.83, so the font-size cap
// below, not the bounds rule, is what pins the size.
export const BOUNDS_TOLERANCE = 0.1;

// provenance: parsed public/assets/hsm/words/provenance.json
export function assertWordRules(
  provenance,
  id,
  inkBounds = provenance.stickers[id].inkBounds,
) {
  assert(
    provenance.fontSize <= MAX_WORD_FONT_SIZE,
    `font size ${provenance.fontSize} exceeds the intended maximum ${MAX_WORD_FONT_SIZE}`,
  );
  assert.equal(provenance.baseline, WORD_BASELINE, "baseline moved");
  const [x0, y0, x1, y1] = inkBounds;
  const t = BOUNDS_TOLERANCE;
  assert(
    y0 >= LOWER_THIRD_Y - t,
    `${id}: ink top ${y0} is above the lower third`,
  );
  assert(
    x0 >= 32 - t && x1 <= 224 + t,
    `${id}: ink too close to the side edges`,
  );
  assert(y1 <= 236 + t, `${id}: ink too close to the bottom edge`);
}
