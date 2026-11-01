# H/M counter

The separate **H/M Counter** application counts hours and minutes on one fixed
2×2×2 print, **m3-SH**, from research PR #133
(`research/hm-counter-3move`). The upper-left sticker is genuinely unprinted.
The upright H or M occupies the upper-right cell, and the tens and units digits
fill the lower row. The existing [H/S/M Counter 00–59](HSM_COUNTER.md) is a
separate application and is unchanged.

Choose the unit (H or M), the range and the direction, then use Set, single
steps, Reset, or Run/Stop, exactly as in the H/S/M counter. The ranges are:

- **M 00–59**, one lap of 60 steps;
- **H 00–23**, one lap of 24 steps;
- **H 00–11**, the 12-hour cycle: counting up from 11 wraps to 00 in one
  ordinary period step (11→00). This is not the Reset button, which is a free
  jump to 00 from any value.

Leading zeros are shown, and counting wraps in both directions. The default
rotation speed is 500 ms per HTM move for H and 250 ms for M, as in the H/S/M
counter. Open it from the application chooser or with `?application=hm-counter`.

## Status and provenance

> **Candidate, not yet independently reviewed.** The numbers below come from
> research PR #133. The pinned commit is
> `44ca982d9e15dc28c62ba105f47f62a26cf8d261`, the PR head when this was pinned.
> The m3-SH witness and receipts are byte-identical to the earlier pin
> `0df2f3a0`; only the checkers, the README and the checks file (more negative
> controls) changed. An independent re-review of that research at this commit
> is still running. If the review finds issues or the research head moves, the
> data must be re-pinned; that takes one command (see
> [Data pinning and verification](#data-pinning-and-verification)).
>
> - Both native research checkers (Julia `checker/check.jl` and Flix
>   `flix/src/Main.flix`) accept the m3-SH witness
>   (`evidence/witness-blank-m3-SH.tsv`, SHA-256
>   `2f5412bab13821909fc76c981a17e58aaf65c99271bea706f0b5ef4cdb52e210`).
>   Their receipts are byte-identical (SHA-256
>   `8279bafe76a5490351a8004742af8659f2013cb1937de8cef65c87659158de25`), and
>   every negative control in `evidence/checks-blank-m3-SH.tsv` is rejected by
>   both checkers.
> - **Not established** (reproduced from the research README):
>   - **Max 3 for all three modes on one print is UNKNOWN.** m3-SH reaches max 3
>     for the minutes only; both hour modes stay at max 4. Other research prints
>     reach max 3 for the minutes alone (s3-MH) or for both hour modes alone
>     (hours3), never for all three.
>   - The exact max-3 screen that rules out these prints (`fixpoint.jl`) is
>     generator-side. Its verdicts are not re-derived by the Julia or Flix
>     checkers.
>   - The words are min-cost for each lap, given the lap's start state. Global
>     optimality of the cycle and of the setup is not claimed.
> - **Software-tested, not proof**: everything the application does at run
>   time (periods, free jumps, recovery, unit changes). The tests listed under
>   [Validation](#validation) are application regression tests, not proofs.

## Counting modes

Every mode counts on a **period**: a closed sequence of full 24-sticker poses,
hidden stickers included. Each period is one lap, starts directly after setup
(no run-in) and returns to the exact full state at the wrap. Counting up follows
the research words. Counting down runs the same period backward with every word
inverted: the same poses, the same HTM per step and the same totals.

| Unit and range | Period edges | Total HTM | Mean HTM/step | Largest step | Steps at 4 HTM | 1 / 2 / 3 / 4 HTM | Wrap word |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| M 00–59 | 60 (one lap) | 163 | 2.7167 | **3** | 0 | 4 / 9 / 47 / 0 | 59→00 `B2 L' D` (3) |
| H 00–23 | 24 (one lap) | 73 | 3.0417 | 4 | 5 | 0 / 4 / 15 / 5 | 23→00 `R L2 B D` (4) |
| H 00–11 | 12 (one lap) | 40 | 3.3333 | 4 | 5 | 0 / 1 / 6 / 5 | 11→00 `R D R' D` (4) |

Counting down, the wraps are 00→59, 00→23 and 00→11; they are the inverses of
the words above. The owner's per-step limit for this application is **4 HTM**.
The minutes period in fact stays within 3, and the application asserts each
period's own maximum from the data. The research receipts also record a lower
bound per step: the word is the shortest possible from its actual pose on 42 of
60 minutes steps, 14 of 24 steps of H 00–23 and 6 of 12 steps of H 00–11. The
other steps are longer because the closed cycle needs them.

### Setups

The solved print is the **M00 reference state**: the minutes need no setup.
Both hour periods start from the same H00 pose, reached from M00 with
`U' B2 U B` (4 HTM). Setups are not counting steps and are not part of any
total above.

## Behavior

The H/M counter uses the same controller, planner, periods and recovery code as
the H/S/M counter. Only the variant parameters differ (see
[Implementation](#implementation)). It behaves as follows.

- **Changing the unit** installs the selected range's period pose for 00 directly:
  M00 is the solved print, and H00 is the solved print followed by its setup. This
  is not a counted step. The range list follows the unit: M offers 00–59, and H
  offers 00–23 and 00–11.
- **Up and down.** With Direction set to Up, +1 follows the period. With
  Direction set to Down, −1 follows the inverse period. Both closed periods visit
  the same poses, so switching direction never leaves the period.
- **Set, Reset and other free jumps** (including −1 while Direction is Up) take
  a least route to the requested display. Among least routes they prefer one
  that lands on a period node, as in the H/S/M counter. Counting on from a pose
  off the period follows an exact recovery plan back onto it. Each recovery
  step shows the next value and uses at most 4 HTM, unless the pose has no
  route of 4 HTM; then the first step takes its shortest word. The
  exact four-corner planner remains the last fallback. As in the H/S/M counter,
  these jumps use the application's exact four-corner planner, not the shared
  PuzlWerk solver.
- **Free-jump bound.** For the H/S/M print, a jump from a settled pose is proved
  to need at most 6 HTM. **No such bound is established for m3-SH.** The
  application caps a jump at 7 HTM, the radius of the four-corner graph, which no
  route can exceed. Sampled jumps in the tests needed at most 6, but sampling is
  not a bound.
- The H/M print has a single lettering (the large H and M symbols). The H/S/M
  word lettering is not offered.

The live clock and the H/S/M counter do not use this print.

## Implementation

`src/apps/hsm` is parameterized by an `HsmVariant`: its letters, its ranges per
letter, its print id, its per-step limit, its free-jump cap and its runtime
file. `HSM_VARIANT` is the default everywhere, so the H/S/M counter, its data
and its numbers are unchanged. `src/apps/hm/variant.ts` defines `HM_VARIANT`:
letters H and M, M 00–59, H 00–23 and 00–11, limit 4 and jump cap 7. An
extended runtime names its letters and limit, and each period carries its
`maximumHTM`. Loading validates every period node, the closure, the per-step
limit and that maximum against the replayed words. The H/M counter shares the
H/S/M controls in `index.html`. The heading, letters, ranges and help text
adapt to the variant, and switching back restores the H/S/M controls.

## Data pinning and verification

No data is hand-edited. [hm-source.json](../hm-source.json) pins the repository,
branch, commit, the SHA-256 of every research file the application relies on
and the application copy paths. These research files are copied byte for byte:

- `evidence/witness-blank-m3-SH.tsv`, the witness;
- `evidence/receipt-blank-m3-SH.julia.tsv` and `receipt-blank-m3-SH.flix.tsv`;
- `evidence/checks-blank-m3-SH.tsv`, the negative controls.

The copies are under
[data/hm/m3-sh/research/](../data/hm/m3-sh/research/). The research README,
both checkers, `run-checks.sh` and the M/S import provenance are pinned by hash
only.

The deterministic converter [scripts/hm/convert-witness.mjs](../scripts/hm/convert-witness.mjs)
(JavaScript) turns the TSV into the modes witness
[data/hm/m3-sh/modes/witness.json](../data/hm/m3-sh/modes/witness.json). It
replays the witness with its own integer rotation model, independent of the
application mechanics, and checks every display, every inverse word and the
exact closure. It refuses a run-in. It cross-checks the totals, maxima and
setups against the receipt, requires the two receipts to be byte-identical and
requires the checks file to record that digest. The runtime
[public/hm-counter.v1.json](../public/hm-counter.v1.json) is derived from it with
the H/S/M runtime derivation, parameterized by an H/M profile. The application
loads the runtime only when its SHA-256 matches the pin.

```sh
node scripts/prepare-hm.mjs --check          # verify pins, copies, converted data, runtime, net
node scripts/prepare-hm.mjs --pin <commit>   # re-pin: copy, hash, convert, derive in one command
node scripts/prepare-hm.mjs                  # regenerate outputs from the pinned copies
```

`--check` also compares the copies with the research files at the pinned commit
when that commit is available locally. It reports when it checked the copies
only, and `--require-commit` makes a missing commit an error. `--pin` fetches
the branch when the commit is missing. `npm run verify:hm` runs `--check`.

## Artwork

The glyphs are the existing artwork, unchanged: the H/S/M large symbols
[H.svg](../public/assets/hsm/H.svg) and [M.svg](../public/assets/hsm/M.svg),
and the counter digits in `public/assets/digits/`. They follow the same rules
(see [counter artwork](COUNTER_ARTWORK.md)): original geometric vector paths in
a 256 × 256 viewBox, a uniform background, a bottom orientation mark against
rotational aliases, and no fonts or raster content. Blank means the background
with no glyph.

The new print's sticker net is
[public/assets/hm/m3-sh-net.svg](../public/assets/hm/m3-sh-net.svg), generated
by [scripts/hm/render-net.mjs](../scripts/hm/render-net.mjs). It shows the solved
source pose as a cross: U above F; L, F, R and B in a row; D below F. Each face
is shown in outside view. Each glyph is turned so that its top points along the
sticker's print-up vector. F shows blank, M, 0, 0: the M00 reference state.
[provenance.json](../public/assets/hm/provenance.json) records the source
witness digest, every input glyph digest, each sticker's face, row, column and
rotation, and the output digest. `prepare-hm.mjs --check` fails when either file
is stale.

This is an assembly and review reference, not production artwork. No print or
cut sheets (`public/print/`, generated by the Python print tooling) were made for
m3-SH. See below.

## Physical reprint required

> **Owner decision.** m3-SH is a new print. **All 24 of the 24 sticker
> identities differ from the current H/S/M seconds-first print, and all 24 differ
> from the previous H/S/M print.** Each one differs in artwork, in orientation
> on its corner, or both. A cube stickered from either H/S/M sheet cannot run
> the H/M counter. **Whether and when to reprint the physical stickers is the
> owner's decision.** This change makes no print sheets and does not alter the
> H/S/M sheets.

Method: both earlier prints and m3-SH use the same 24 sticker identities. Each
identity is a fixed corner (cubie) and facelet (position and normal) in the
solved pose; the test asserts this. For every identity, the comparison takes the
`printing` record of
[data/hsm/seconds-first/modes/witness.json](../data/hsm/seconds-first/modes/witness.json)
(current H/S/M sheets), of `tests/fixtures/hsm-blank-print.v2.json` (previous
H/S/M sheets) and of the converted m3-SH witness. An identity is unchanged only
if its glyph is the same and, for a printed glyph, its print-up vector is the
same (a blank reads the same in every orientation). "Tens" and "units" name the
front cell in which a digit is upright. `tests/hm-counter.test.mjs` recomputes
the count.

| Id | Corner | Normal | Previous H/S/M print | Seconds-first print (current) | m3-SH print |
| ---: | ---: | --- | --- | --- | --- |
| 0 | 0 | (−1, 0, 0) | tens 0 (0, 1, 0) | tens 0 (0, 1, 0) | H (0, −1, 0) |
| 1 | 0 | (0, −1, 0) | tens 1 (0, 0, 1) | tens 2 (0, 0, 1) | units 3 (1, 0, 0) |
| 2 | 0 | (0, 0, −1) | tens 2 (1, 0, 0) | tens 4 (1, 0, 0) | units 7 (0, 1, 0) |
| 3 | 1 | (−1, 0, 0) | tens 3 (0, 0, −1) | tens 1 (0, 0, −1) | tens 2 (0, 0, −1) |
| 4 | 1 | (0, −1, 0) | tens 4 (1, 0, 0) | tens 3 (1, 0, 0) | blank |
| 5 | 1 | (0, 0, 1) | tens 5 (0, 1, 0) | tens 5 (0, 1, 0) | tens 0 (0, 1, 0) |
| 6 | 2 | (−1, 0, 0) | units 0 (0, −1, 0) | units 3 (0, −1, 0) | tens 3 (0, 0, 1) |
| 7 | 2 | (0, 1, 0) | units 1 (0, 0, 1) | units 1 (0, 0, 1) | blank |
| 8 | 2 | (0, 0, −1) | units 2 (1, 0, 0) | units 9 (1, 0, 0) | tens 1 (0, −1, 0) |
| 9 | 3 | (−1, 0, 0) | units 3 (0, 0, −1) | units 8 (0, 0, −1) | tens 4 (0, −1, 0) |
| 10 | 3 | (0, 1, 0) | units 4 (1, 0, 0) | S (0, 0, 1) | tens 5 (0, 0, −1) |
| 11 | 3 | (0, 0, 1) | units 5 (0, −1, 0) | units 5 (0, −1, 0) | blank |
| 12 | 4 | (1, 0, 0) | units 6 (0, 1, 0) | units 2 (0, 1, 0) | units 9 (0, 1, 0) |
| 13 | 4 | (0, −1, 0) | units 7 (0, 0, 1) | units 7 (0, 0, 1) | H (1, 0, 0) |
| 14 | 4 | (0, 0, −1) | units 8 (−1, 0, 0) | S (0, −1, 0) | units 5 (−1, 0, 0) |
| 15 | 5 | (1, 0, 0) | units 9 (0, 0, −1) | units 4 (0, 0, −1) | M (0, −1, 0) |
| 16 | 5 | (0, −1, 0) | units 0 (−1, 0, 0) | units 0 (−1, 0, 0) | units 8 (−1, 0, 0) |
| 17 | 5 | (0, 0, 1) | units 9 (0, 1, 0) | units 6 (0, 1, 0) | units 0 (0, 1, 0) |
| 18 | 6 | (1, 0, 0) | H (0, 1, 0) | S (0, 1, 0) | units 6 (0, 0, 1) |
| 19 | 6 | (0, 1, 0) | S (0, 0, −1) | H (0, 0, −1) | M (0, 0, −1) |
| 20 | 6 | (0, 0, −1) | M (1, 0, 0) | M (1, 0, 0) | units 2 (0, −1, 0) |
| 21 | 7 | (1, 0, 0) | blank | blank | units 4 (0, −1, 0) |
| 22 | 7 | (0, 1, 0) | blank | blank | units 1 (0, 0, −1) |
| 23 | 7 | (0, 0, 1) | blank | blank | M (0, 1, 0) |

Vectors are print-up vectors in the solved pose. The m3-SH print code, one
triple per corner (stickers on its x, y and z faces), is
`H U3 U7 | T2 _ T0 | T3 _ T1 | T4 T5 _ | U9 H U5 | M U8 U0 | U6 M U2 | U4 U1 M`.
It has three blanks on three different corners, each next to two tens digits.
It has H twice, M three times, tens 0–5 once each and units 0–9 once each. As a
multiset, the seconds-first print has the same digits and blanks. Its letters
are S ×3, H and M instead of H ×2 and M ×3. So two counts apply, and both are
recomputed by the test:

- **By position:** all 24 identities change. A cube stickered from an H/S/M sheet
  must be fully re-stickered; no sticker can stay where it is.
- **By artwork:** printed glyphs counted as a multiset, ignoring position and
  orientation. A new m3-SH sheet needs only **3 glyphs not on the seconds-first
  sheet**: one more H and two more M, which take the place of the three S. The
  3 blanks and 16 digits are the same artwork. The research README of PR #133
  reports the same count. Stickers already on a cube are not reusable in
  practice, so this is about artwork, not about peeling and moving stickers.

## Limitations

- Candidate data: the research review of PR #133 is pending (see
  [Status and provenance](#status-and-provenance)).
- Max 3 holds for the minutes only; the hours keep 4-HTM steps (5 in each hour
  mode). All three modes at max 3 on one print is UNKNOWN.
- Free jumps have no established universal bound on this print; the cap of 7 is
  the graph radius. The recovery step count after a jump is software-tested,
  not bounded by a research table (the H/S/M counter has one).
- No print or cut sheets exist for m3-SH; the sticker net is a reference.
- Only M 00–59, H 00–23 and H 00–11 are offered: the research covers exactly
  these modes (no H 00–59 and no M 00–23 or M 00–11).

## Validation

```sh
node scripts/prepare-hm.mjs --check
node --test tests/hm-counter.test.mjs
npm run typecheck
npm run test:e2e -- tests/browser/hm-counter.spec.mjs
```

`tests/hm-counter.test.mjs` checks:

- the pins, the copies, the converted witness, the runtime and the net;
- the print code, glyph counts and blanks;
- the research numbers: totals, maxima, histograms and steps at 4 HTM.

It replays **every period edge of every mode, up and down**, in the
application's mechanics model (`@cubistry/cube-mechanics`). At every node it
reads the front face explicitly: blank upper-left, then the correct letter,
tens and units, all upright. It also checks:

- each word's exact inverse;
- exact closure at the period boundary and a minimal period;
- the per-mode maximum (M 3, H 4) and the limit of 4;
- the totals 163, 73 and 40;
- down periods visiting the same poses in reverse;
- the 4-HTM setup from the M00 reference state to H00.

Three laps per mode and direction run through the real controller. Further
tests cover unit changes, jumps, recovery onto the period, per-letter ranges
and the 24-of-24 reprint comparison. Negative controls must be rejected: the
wrong variant, a corrupted runtime (maximum, limit, letters, glyph, word,
setup), a tampered witness and mismatched receipts.

`tests/browser/hm-counter.spec.mjs` opens the application and checks:

- its controls and the blank upper-left;
- counting up and down in every mode with each wrap (59→00, 23→00, 11→00 and
  back), within each mode's maximum;
- Set, Reset, unit change, validation and Run/Stop;
- that the H/S/M counter keeps its own controls afterward.

These are application regression tests, not proofs.
