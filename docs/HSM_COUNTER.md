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

The general guarantee is **at most six HTM** from any legal physical pose.
The independent four-corner graph covers 136,080 states with all three blank
orientations allowed. A real blank/H/00 to blank/H/34 example requires exactly
six moves. The user explicitly accepted this corrected general bound.

All 18 exact canonical counting runs separately have full-state preperiods and
periods with at most five HTM over 8,292 independently replayed edges. That
stronger statement depends on the recorded starting pose and policy. It does
not automatically cover Run after arbitrary Set, Reset to a different 00 pose,
or range/direction changes. The runtime retains physical continuity and uses
the honest six-move general ceiling for those states rather than teleporting
to a canonical pose.

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

## Three-cube clock proposal

The user's intended follow-up places three copies of this print in H–M–S order,
with the letter fixed once per cube. Number transitions, not unit changes, are
the optimization priority. The proposed preferred durations are S: 100 ms,
M: 250 ms, and H: 500 ms per HTM, giving general six-move motion budgets of 0.6, 1.5,
and 3 seconds respectively. Hours are not inherently harder to solve; their
slower presentation is a visual choice.

A clock should read all three targets from one time source, use independent
physical poses and motion budgets, and time final turns to the same relevant
second/minute/hour boundary. After a suspended tab it should replan directly
to the current time rather than replay a backlog. Browser timing needs its own
acceptance evidence. This PR implements the single-cube application; the
three-cube clock remains a proposal and is not silently included in its scope.

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
