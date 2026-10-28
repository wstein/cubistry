# H/S/M counter

The separate **H/S/M Counter 00–59** application uses the preferred intermediate
print from the Research investigation. Choose the unit once per cube, then use
Set, single steps, Reset, or Run/Stop. Counting can run up or down over 00–59,
00–23, or 00–11, with leading zeros and wrap enabled. The default rotation speed
is 100 ms per HTM move. Run requests one step per second while settled; slow
animation does not queue an unbounded backlog.

The two digits occupy the lower front row, and the upright H, S, or M occupies
the upper-right slot. The upper-left sticker is unconstrained. The print stays
immutable during counting. Changing the unit explicitly sets up a new 00
display; it is not a counted number transition.

## Proof and implementation boundary

The exact print and runtime digest are pinned in [hsm-source.json](../hsm-source.json).
The universal [five-move proof](https://github.com/wstein/cubistry/blob/140b4ba/research/hsm-counter/periodic/REVIEW.md)
and all solver results remain on `research/cube-display-feasibility`.

The proof covers all 378 selected-corner source triples with the same upright
letter already in place. Every target number is reachable in at most five HTM,
regardless of hidden poses. Induction covers unlimited wraps and direction or
range changes. Initial setup and changing letters are separate operations.
Global print and whole-route optimality remain unknown.

The runtime reconstructs the 9,072-state three-corner graph using the shared
physical move primitives. It plans a shortest route to any matching partial
display from the actual full cube state. Among shortest paths it uses one-step
lookahead and the preferred candidate's tie policy 13. The selected full target
state is obtained by replaying those moves, including every hidden cubie, and
the shared playback controller checks exact physical completion. No solver
teleport, display relabeling, or canonical hidden-state assumption is used for
number transitions.

The first 00–59–00 pass retains the investigated totals of H: 185, S: 188, and
M: 190 HTM. Later full poses can differ, so those averages are not claimed for
every subsequent pass. The five-move ceiling does apply indefinitely.

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
M: 250 ms, and H: 500 ms per HTM, giving five-move motion budgets of 0.5, 1.25,
and 2.5 seconds respectively. Hours are not inherently harder to solve; their
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
full-state inverses, and bounded stop behavior. Browser tests cover all nine
letter/range variants in both wrap directions, run/stop/resume, mobile layout,
and isolation from the existing counter and timer applications.
