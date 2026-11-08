// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Rule profile of the 7x7 calendar cube: the one place that selects the front rule and the
 * sticker art (research candidate, not certified).
 *
 *  - "legacy": the research rule behind the pinned print (print-pure-A.tsv): O = 0 and
 *    I = 1 are equal glyphs, the half-turn set is 0 1 2 5 8 H N S X Z plus 6 <-> 9, the
 *    print uses M0N and FR1, split labels are drawn on one line.
 *  - "strict": the accepted upright rule: only the digit 0 (any turn) and 6 <-> 9 (half
 *    turn) read as the wanted glyph, O is not 0 and I is not 1 (no aliasing), the print
 *    uses the letters MON and FRI, split labels such as 23/30 are drawn diagonally.
 *
 * The data (print, chain, pin) is still the legacy data, so the default stays "legacy".
 * Switching to "strict" later is a data change plus changing DEFAULT_RULE_PROFILE here.
 */
export const RULE_PROFILES = ["legacy", "strict"] as const;
export type RuleProfile = (typeof RULE_PROFILES)[number];

/** The only switch: the profile every default argument of the mode uses. */
export const DEFAULT_RULE_PROFILE: RuleProfile = "legacy";
