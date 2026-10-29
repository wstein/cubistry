# H/S/M counter

The separate **H/S/M Counter 00–59** application uses the corrected real-blank
print from the Research investigation. Choose the unit once per cube, then use
Set, single steps, Reset, or Run/Stop. Counting can run up or down over 00–59,
00–23, or 00–11, with leading zeros and wrap enabled. The default rotation speed
is 100 ms per HTM move. Run requests one step per second while settled; slow
animation does not queue an unbounded backlog.

The two digits occupy the lower front row, and the upright H, S, or M occupies
the upper-right slot. The upper-left sticker is genuinely unprinted. The print stays
immutable during counting. Changing the unit explicitly sets up a new 00
display; it is not a counted number transition.

## Proof and implementation boundary

The exact print and runtime digest are pinned in [hsm-source.json](../hsm-source.json).
The corrected [physical proof](https://github.com/wstein/cubistry/blob/8e9ad5c05e93efa2b1f841590f725416abf226f4/research/hsm-counter/blank/REVIEW.md)
and all solver results remain on `research/cube-display-feasibility`.

The earlier three-corner print allowed an arbitrary upper-left glyph. That was
not the user's intended blank, so its universal five-move result does not carry
over. The corrected print has one corner with three unprinted faces, two tens
corners, four units corners, and one H/S/M corner. Every target now includes all
four visible stickers; no screen mask or image override hides an extra digit.

The general guarantee is **at most six HTM** from a settled legal pose whose
blank and upright unit are already in their required front slots.
The independent four-corner graph covers 136,080 states with all three blank
orientations allowed. A real blank/H/00 to blank/H/34 example requires exactly
six moves. The user explicitly accepted this corrected general bound.

All 18 exact canonical counting runs separately have full-state preperiods and
periods with at most five HTM over 8,292 independently replayed edges. That
stronger statement depends on the recorded starting pose and policy. It does
not automatically cover Run after arbitrary Set, Reset to a different 00 pose,
or range/direction changes. The runtime retains physical continuity and uses
the honest six-move general ceiling for those states rather than teleporting
to a canonical pose. If a changed target interrupts a route after one turn,
the blank or unit may no longer be in those slots. That intermediate source uses
the same exact graph through `planFromPose`, without extending the settled
six-move assertion. See [target interruption](TARGET_INTERRUPTION.md).

The runtime reconstructs the four-corner graph from shared physical move
primitives and plans shortest routes from the authoritative full state. Among
shortest paths it uses one-step lookahead and policy 13, except M/00–59/down,
which uses policy 1. It derives the full target state by actual move replay;
shared playback checks exact physical completion including all hidden cubies.
The blank is a permanent color asset with no text, not a hidden digit texture.

The first canonical 00–59–00 passes take H: 267, S: 269, and M: 262 HTM. These
replace the earlier unconstrained-layout numbers. They are not guaranteed
averages for later passes; print and whole-route optimality remain unknown.

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
H/M/S budgets of 3/1.2/0.6 seconds before fitting. Canonical verified upward routes
for the selected initial cycles use at most eight quarter units; this narrower
result does not cover arbitrary poses. The clock shows scheduled quarter/half
times when it fits a route into the available live interval. Standalone counter
rotation settings retain their existing per-move behavior.

## Validation

```sh
npm run check
npm run test:e2e -- tests/browser/hsm-counter.spec.mjs
```

The HSM Node regressions cover repeated traversal of all eighteen letter/range/
direction modes, arbitrary targets, shortest-path prefix totals, invalid inputs,
full-state inverses, and bounded stop behavior. From each unit's fresh 00
setup, every mode is counted until its full physical state repeats, with at
most five HTM per step; this pins the M/00–59/down policy. A positive control
turns the blank's up vectors without changing any plan. Browser tests cover all nine
letter/range variants in both wrap directions, run/stop/resume, mobile layout,
isolation from the existing counter and timer applications, and the exact
blank/M/33 regression. A known six-move free jump is pinned as a Node regression.
