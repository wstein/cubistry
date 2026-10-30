# H/S/M counter

The separate **H/S/M Counter 00–59** application uses the seconds-first print
from the Research investigation. Choose the unit once per cube, then use
Set, single steps, Reset, or Run/Stop. Counting can run up or down over 00–59,
00–23, or 00–11, with leading zeros and wrap enabled. The default rotation speed
is 100 ms per HTM move. Run requests one step per second while settled; slow
animation does not queue an unbounded backlog.

The two digits occupy the lower front row, and the upright H, S, or M occupies
the upper-right slot. The upper-left sticker is genuinely unprinted. The print stays
immutable during counting. Changing the unit explicitly sets up a new 00
display; it is not a counted number transition.

## Physical reprint required

> **Owner decision.** The seconds-first print replaces the print that earlier H/S/M
> sticker sheets used. **Stickers printed from the earlier sheets no longer match:
> 14 of the 24 sticker identities changed.** Ten identities (0, 5, 7, 11, 13, 16,
> 20, 21, 22 and 23) are unchanged; do not mix old and new stickers on one cube.
> A cube already assembled from the old sheets keeps the old print and needs
> the old application behavior; the application now installs only the new print.
> Whether to reprint the physical stickers is the owner's decision.

| Id | Corner | Normal | Previous print | Seconds-first print |
| ---: | ---: | --- | --- | --- |
| 1 | 0 | (0, −1, 0) | tens 1 | tens 2 |
| 2 | 0 | (0, 0, −1) | tens 2 | tens 4 |
| 3 | 1 | (−1, 0, 0) | tens 3 | tens 1 |
| 4 | 1 | (0, −1, 0) | tens 4 | tens 3 |
| 6 | 2 | (−1, 0, 0) | units 0 | units 3 |
| 8 | 2 | (0, 0, −1) | units 2 | units 9 |
| 9 | 3 | (−1, 0, 0) | units 3 | units 8 |
| 10 | 3 | (0, 1, 0) | units 4 | **S** |
| 12 | 4 | (1, 0, 0) | units 6 | units 2 |
| 14 | 4 | (0, 0, −1) | units 8 | **S** |
| 15 | 5 | (1, 0, 0) | units 9 | units 4 |
| 17 | 5 | (0, 0, 1) | units 9 | units 6 |
| 18 | 6 | (1, 0, 0) | H | S |
| 19 | 6 | (0, 1, 0) | S | H |

The print code, one triple per corner (stickers on its x, y and z faces), is
`T0 T2 T4 | T1 T3 T5 | U3 U1 U9 | U8 S U5 | U2 U7 S | U4 U0 U6 | S H M | _ _ _`.
It has one fully blank corner, six single tens glyphs, ten single units glyphs
(the duplicate units 0 and 9 are gone) and **three S stickers** on three corners.
Because a face turn can bring another S corner into the upper-right cell while
the units cell changes, twelve of the sixty seconds steps cost a single HTM. The
ids 10 and 14 change their glyph slot and up vector with the new S. Every
sticker glyph is existing artwork: only the assignment of glyph to sticker
identity changed, so no new glyph SVG exists. The word variant (`hour`, `min`,
`sec`) follows the same identities.

## Proof and implementation boundary

The exact print and runtime digest are pinned in [hsm-source.json](../hsm-source.json).
The pin names the research branch `research/hsm-seconds-first`, commit
`24240a3b2dbd691de99d5bf1170b5695fc62a320`, and the SHA-256 of the witness and of its
README, verification and manifest files. A verbatim copy of the witness lives at
[data/hsm/seconds-first/witness.json](../data/hsm/seconds-first/witness.json);
`node scripts/derive-hsm-runtime.mjs` derives the runtime file
[public/hsm-counter.v2.json](../public/hsm-counter.v2.json) from it (`--check`
fails when the file or its pin is stale). The file name is kept because the
calendar print manifests pin the print input adapter by hash; its schema version
is 3, and the digest pin makes a stale cached copy fail loudly instead of
loading a mismatched print.

> **Review status.** The research branch is not merged and the independent review
> of the seconds-first proof is pending. The application consumes the pinned
> witness; it does not claim the research result is confirmed. The previous pin
> (`blank/witness.json`, SHA-256 `13eea2a1…`, review commit `8e9ad5c0…`) is retained
> in `hsm-source.json` under `supersedes`. Print optimality remains UNKNOWN; the
> research README states what is proved and what is best-found.

The general guarantee is unchanged: **at most six HTM** from a settled legal pose
whose blank and upright unit are already in their required front slots, over the
independent four-corner graph of 136,080 states. A blank/H/00 to blank/H/34 jump
still needs exactly six moves on the new print. The user explicitly accepted
this general bound.

### Counting modes

The best sustainable way to count on a fixed print is a **period**: a closed
sequence of poses over the full 24-sticker state, hidden stickers included, in
which every edge is a shortest word from its actual pose. The witness holds one
period per mode. The application replays them on the loaded print and keeps
four, counting up:

| Unit and range | Period edges | Lap HTM | Largest edge | Wrap |
| --- | ---: | ---: | ---: | ---: |
| S 00–59 | 60 (one lap) | 159 | 4 | 59→00 in 3 |
| M 00–59 | 120 (two laps) | 204 average | 5 | 4 |
| H 00–23 | 48 (two laps) | 82 average | 5 | 4 |
| H 00–11 | 12 (one lap) | 40 | 4 | 4 |

Counting down walks the same period backward with every word inverted. It
closes the same poses and costs the same HTM, but is not necessarily the shortest
word toward the lower display. The research gives 159 for the seconds inverse and
a certified 171 for shortest-edge counting down; the inverse is also used for M
and H, where it is never longer than the research's own down periods
(M 204 against 204.75, H 82 and 40 against 82 and 41.14) and keeps the largest
edge at five or less. Switching direction therefore never leaves the period.

A unit starts on its period: a fresh setup, a unit change and a lettering change
install the period's pose for the current value and range instead of setting
up 00 and jumping. In the live clock the same install happens for the current
time. After a free jump (Set, Reset, range change), an interrupted route or in a
mode without a period (S 00–23 and 00–11, M 00–23 and 00–11, H 00–59), no period
pose is on the cube. The exact planner (shortest routes, one-step lookahead,
policy 13) then plans from the authoritative pose within the six-move bound;
that fallback needs no certificate beyond the six. A free jump can leave the
period for good; a unit change or lettering change reinstalls it. Shared
playback still checks exact physical completion including all hidden cubies, and
the blank is a permanent color asset with no text.

### Before and after

HTM per lap while counting up. Before is the previous print through the app's
planner (policy 13, which settles after several laps); after is the saved period.

| Unit | Before (previous print) | After | Change |
| --- | ---: | ---: | ---: |
| S 00–59 | 268.3 (first lap 269) | 159 | −41 % |
| M 00–59 | 266.0 (first lap 262) | 204 | −23 % |
| H 00–23 | 106.1 (first lap 107) | 82 | −23 % |
| H 00–11 | 53.1 (first lap 51) | 40 | −25 % |

Before figures are simulated through the same controller with the previous
print and the planner alone; they are laps 17–24 of a 24-lap run and vary by a few
HTM from lap to lap. (The research's 268.4 for S is the same quantity; its
best possible mode on the previous print was 250.5.)

The seconds cube of the [live clock](LIVE_CLOCK.md#move-statistics) averages
**2.65 HTM per tick (159 per lap) instead of 4.49** over three simulated laps
from 00 (808 HTM per 180 ticks before, 477 after). These are settled-display
results. A manual Set, letter or range change can need up to
six HTM, and the setup word from the solved print to the period start (8–10 HTM)
is excluded from the laps.

## Artwork

The H/S/M SVG assets are original geometric paths, authored for this application
under the repository's AGPL-3.0-or-later license. They contain no fonts, raster
content, or external references. Their canonical dimensions and viewBox are
256 × 256, with the same background, ink, and bottom orientation marker as the
existing digit assets. Image digests are recorded in
[images.json](../src/apps/hsm/images.json). These are display assets; a physical
print-sheet export is outside this change.

## Sticker lettering variants

Choose either a large H/M/S symbol or only the small word `hour`, `min`, or `sec`
at the bottom of R1C2. They are separate fixed physical prints, never both on one
sticker. The word variant replaces each entire unit image before setup; it is
not a position-dependent overlay. Changing lettering in the single-cube counter
installs the selected print at the current value. Choosing a new unit retains
the existing reset-to-zero behavior.

The word SVGs are fetched by their unversioned URL and verified against the
pinned SHA-256; a stale HTTP-cache entry triggers one reload retry (see
[shared cube loading rules](SHARED_CUBE_M1.md)).

[Word artwork provenance](../public/assets/hsm/words/provenance.json) pins the
local Noto Sans 600 font and maps each unit to an outlined vector path with ink
inside the bottom safe area. Reproduce it with `python3 scripts/export-hsm-word-art.py`
using the pinned [font tooling](../scripts/hsm-art-requirements.txt). The licensed
font is converted to paths; the runtime SVGs need no external fonts. The words are
set at font size 80.64 on the unchanged baseline 232 (1.2 times the previous 67.2,
which was itself 1.2 times the original 56). The widest word, `hour`, keeps at least
2.7 mm of clear space to the side edges of a 20 mm sticker, and all three words stay
inside the lower third of the 256-unit canvas, which is what limits further
growth. Geometry, immutable face IDs, actual blank and legal routes are shared by
both variants.

## Three-cube live clock

The separate [live clock](LIVE_CLOCK.md), PR #64, uses one view for all three cubes.
Its preferred H/M/S timings are 250/100/50 ms **per quarter turn**. A half turn
uses two quarter units. Six HTM loosely permit twelve quarter units, with nominal
H/M/S budgets of 3/1.2/0.6 seconds before fitting. Saved period routes use at most five quarter units
for seconds and eight for minutes and hours; this narrower result does not cover
arbitrary poses. The clock shows scheduled quarter/half
times when it fits a route into the available live interval. Standalone counter
rotation settings retain their existing per-move behavior.

## Validation

```sh
npm run check
npm run test:e2e -- tests/browser/hsm-counter.spec.mjs
```

The HSM Node regressions cover repeated traversal of all eighteen letter/range/
direction modes, arbitrary targets, fallback prefix totals, invalid inputs,
full-state inverses, and bounded stop behavior. From each unit's fresh setup, the
eight modes with a period close over the full pose within one period at most five
HTM per step; the ten modes without one stay within the six-move bound. A positive
control turns the blank's up vectors without changing any plan.
`tests/hsm-seconds-first.test.mjs` pins the research commit and file hashes, the
derived runtime file, the print code and the 14 changed identities against a
fixture of the previous print, replays each period on the app's mechanics (the
saved start frames, closure, and every edge shortest from its actual pose), and
counts three laps of every researched mode up and down through the real
controller: S 159, M 204 and H 82 / 40 per lap with the largest edges 4, 5, 5 and 4
and the S wrap at 3. It then runs the three-cube live-clock scheduler with the move
statistics for 180 ticks, before and after, and checks bounded catch-up. Negative
controls corrupt the witness bytes, the derived runtime, a sticker, a period word and
its length, and each must fail. Browser tests cover all nine letter/range variants in
both wrap directions, run/stop/resume, mobile layout, isolation from the existing
counter and timer applications, and the exact blank/M/33 regression. A known
six-move free jump is pinned as a Node regression.
