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
> The owner reports that the new stickers are printed (the 14 changed
> identities: ids 1, 2, 3, 4, 6, 8, 9, 10, 12, 14, 15, 17, 18 and 19).

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
The pin names the research branch `research/hsm-seconds-first-modes`, commit
`30b6d022da60c366d79de5498497df0a07e28caf`, and the SHA-256 of every file the application relies on there.
That branch adds the all-mode research
(`research/hsm-counter/seconds-first/modes/`) on top of the long-lived research
branch `research/cube-display-feasibility` at
`4d9ef771305def5c4f6e9b1f2eec7689a03ed21b`, where the seconds-first print landed
with its independent review (recorded as `basePublished`). The print was first
published on `research/hsm-seconds-first` at
`24240a3b2dbd691de99d5bf1170b5695fc62a320` (recorded as `firstPublished`). The
print research files are unchanged at all three commits, except that the first
publication's README has no review section and its manifest's README hash
differs. Verbatim copies live in
[data/hsm/seconds-first/](../data/hsm/seconds-first/):

- `witness.json`, the seconds-first print;
- `modes/witness.json`, the same print with one period for each of the 18 modes;
- `modes/recovery.json`, the research recovery table.

`node scripts/derive-hsm-runtime.mjs` derives the application runtime
[public/hsm-counter.v3.json](../public/hsm-counter.v3.json) from the modes
witness; `--check` fails when the file or its pin is stale. Its schema version
is 4, with one period per counting mode. The digest pin makes a stale cached
copy fail loudly instead of loading a mismatched print.

The previous runtime [public/hsm-counter.v2.json](../public/hsm-counter.v2.json)
stays byte-identical. It is the frozen print source of the committed HSM sticker
sheets, whose manifests pin its SHA-256; it has the same 24 sticker records and
the same 00 setups as the application runtime. The same script checks that it
still derives exactly from the base witness, and never rewrites it. The
application no longer loads it.

> **Proof status.**
>
> - **CONFIRMED** for the two original pinned witnesses, by both native checkers
>   (Flix and Julia, merged in PR 95, independent review at `477ac51`, profile in
>   [proof-checkers/HSM-PROFILE.md](../proof-checkers/HSM-PROFILE.md)):
>   `data/hsm/seconds-first/witness.json` (SHA-256 `f71d4237…`, profile
>   `cubistry.hsm-seconds-first`) and `data/hsm/seconds-first/modes/witness.json`
>   (SHA-256 `5dd24dd7…`, research `30b6d02`, profile
>   `cubistry.hsm-seconds-first-modes`). Both files are byte-identical to the
>   PR 95 conformance cases `witness.json` and `modes.json`. This covers the
>   24-sticker print, the 18 mode periods with every edge at most 5 HTM, the
>   lap, maximum and mean figures (159, 204, 82, 40) and the 6 HTM universal
>   bound. Run it with `hsm FILE`.
> - **CONFIRMED** for the recovery table, bound to the all-mode witness, by
>   separate native Julia and Flix recovery entrypoints. Both exhaustively
>   rebuilt all 18 graphs and returned byte-identical results. See the
>   [recovery results](../proof-checkers/HSM-RECOVERY-RESULTS.md) and
>   [final independent review](../proof-checkers/review/HSM-RECOVERY-FINAL.md).
>   The old `hsm FILE` command still returns UNSUPPORTED for this schema;
>   that preserved command is not the new recovery validator.
> - **NOT_CHECKED by the recovery proof**: runtime reachability of forced
>   six-HTM poses. The graph permits forced six-HTM M/H steps; it does not
>   assert every runtime transition needs at most five.
> - **UNKNOWN**: global print optimality. The research README states what is
>   proved and what is best-found.
> - **Software-tested, not proof**: what the app does at run time
>   (`periods.ts`, `recovery.ts`, the planner, the live clock).
>
> The previous pin (`blank/witness.json`, SHA-256 `13eea2a1…`, review commit
> `8e9ad5c0…`) is retained in `hsm-source.json` under `supersedes`.

The general guarantee is unchanged: **at most six HTM** from a settled legal pose
whose blank and upright unit are already in their required front slots, over the
independent four-corner graph of 136,080 states. A blank/H/00 to blank/H/34 jump
still needs exactly six moves on the new print. The user explicitly accepted
this general bound.

### Counting modes

The best sustainable way to count on a fixed print is a **period**: a closed
sequence of poses over the full 24-sticker state, hidden stickers included. It
repeats indefinitely. Every one of the 18 counting modes has one, and **no step
of any period exceeds five HTM**. Counting up follows the research's
shortest-edge period. Counting down runs the same period backward with every
word inverted. The runtime file writes both out, one period per mode:

| Unit and range | Period edges | Lap HTM | Largest edge | Wrap |
| --- | ---: | ---: | ---: | ---: |
| S 00–59 | 60 (one lap) | 159 | 4 | 59→00 in 3 |
| S 00–23 | 24 (one lap) | 68 | 5 | 5 |
| S 00–11 | 12 (one lap) | 32 | 4 | 4 |
| M 00–59 | 120 (two laps) | 204 average | 5 | 4 |
| M 00–23 | 48 (two laps) | 82 average | 5 | 4 |
| M 00–11 | 12 (one lap) | 40 | 4 | 4 |
| H 00–59 | 120 (two laps) | 204 average | 5 | 4 |
| H 00–23 | 48 (two laps) | 82 average | 5 | 4 |
| H 00–11 | 12 (one lap) | 40 | 4 | 4 |

Lap, largest edge and wrap are the same counting down; the down wrap is 00→59
(00→23, 00→11). The S 00–59, M 00–59, H 00–23 and H 00–11 rows are the four
periods published first, unchanged.

Move-count frequencies below cover the **complete saved period**, including
all wraps, with setup excluded. Some periods span two laps; their integer
frequencies must not be read as counts for one lap. Each half turn counts as one
HTM. Mean HTM per transition is the weighted total divided by period edges.

| Unit and range | Transitions | 1 HTM | 2 HTM | 3 HTM | 4 HTM | 5 HTM | Total HTM | Mean HTM/transition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S 00–59 | 60 | 12 | 6 | 33 | 9 | 0 | 159 | 2.6500 |
| S 00–23 | 24 | 3 | 3 | 14 | 3 | 1 | 68 | 2.8333 |
| S 00–11 | 12 | 3 | 0 | 7 | 2 | 0 | 32 | 2.6667 |
| M 00–59 | 120 | 0 | 0 | 81 | 30 | 9 | 408 | 3.4000 |
| M 00–23 | 48 | 2 | 0 | 29 | 10 | 7 | 164 | 3.4167 |
| M 00–11 | 12 | 0 | 0 | 8 | 4 | 0 | 40 | 3.3333 |
| H 00–59 | 120 | 0 | 0 | 81 | 30 | 9 | 408 | 3.4000 |
| H 00–23 | 48 | 2 | 0 | 29 | 10 | 7 | 164 | 3.4167 |
| H 00–11 | 12 | 0 | 0 | 8 | 4 | 0 | 40 | 3.3333 |

These are descriptive counts of the pinned route words, not an independent
confirmation of feasibility or optimality. Reversing a period preserves the
histogram and mean.

The inverse used for counting down closes the same poses and costs the same
HTM. It is not necessarily the shortest word toward the lower display. In every
mode it is cheaper than the research's own down period, or equal to it:

| Unit | 00–59 | 00–23 | 00–11 |
| --- | --- | --- | --- |
| S | 159 against 171 | 68 against 70.25 | 32 against 33.75 |
| M | 204 against 204.75 | 82 against 82 | 40 against 41.2 |
| H | 204 against 204.75 | 82 against 82 | 40 against 41.2 |

The inverse also keeps the largest edge at five or less. Switching direction
therefore never leaves the period.

A unit starts on its period: a fresh setup, a unit change and a lettering change
install the period's pose for the current value, range and direction instead of
setting up 00 and jumping. In the live
clock the same install happens for the current time. Shared playback still checks
exact physical completion including all hidden cubies, and the blank is a
permanent color asset with no text.

### Leaving and returning to the period

A free jump leaves the period: Set, Reset, a range change, a live-clock catch-up
or an interrupted route. The counter then returns to it as follows.

- **The jump** takes a least route to the requested display, as before, and
  never exceeds the universal six. Among the least routes it prefers one that
  lands on a period node. Otherwise it prefers a pose from which the next step
  needs at most five HTM. Only if every least route lands on a pose without such
  a step does it spend one HTM more, and never beyond six. In a sample of 5,400
  jumps (300 per mode) no jump took longer than the least route. An exhaustive
  run through the real controller jumps from one period node per display of
  every mode to every value other than the shown and the next one (24,768
  jumps): 28 M/H jumps take one HTM more than the least route. Over every node
  of the two-lap periods as well (40,800 jumps) it is 58 M/H jumps. None takes
  more than six, and no S jump takes more than the least route.
- **Counting on** recovers. Each step shows the next value, as ordinary
  counting does, and may use any legal word of at most five HTM, not only a
  shortest one. An exact bidirectional search over settled full poses
  (`src/apps/hsm/recovery.ts`) picks the plan with the fewest steps, then the
  fewest HTM, that ends on a period node. The plan is followed while the cube
  stays where it predicts and recomputed otherwise. Once on the period,
  counting follows the saved words again.

Research bound ([recovery.json](../data/hsm/seconds-first/modes/recovery.json),
recomputed in full by the independent research verifier): from **every**
settled pose of a mode, the period is at most this many steps away. The
recovery HTM is the most HTM over all those steps together.

| Unit | Steps, 00–59 up / down | Steps, 00–23 | Steps, 00–11 | Most recovery HTM |
| --- | ---: | ---: | ---: | ---: |
| S | 6 / 6 | 6 / 6 | 5 / 6 | 28 |
| M | 7 / 6 | 6 / 7 | 7 / 7 | 35 |
| H | 7 / 6 | 6 / 7 | 7 / 7 | 35 |

The mean is 3.3–3.9 steps. Every step is at most five HTM, with one exception.
On M or H, 756 poses of 116,640 (00–59) or 252 (00–23, 00–11) have no route of
five to the next display. From such a pose the first step is its unavoidable
six-HTM shortest word. It happens once and only from such a pose; S has none.
The jump above avoids landing on these poses **for the counting direction in
force when it jumps**. A pose that is fine for one direction can be one of these
poses for the other.

Measured through the real controller (5,400 random jumps, 300 per mode):

- 0–6 steps back to the period, with 3–4 typical;
- at most five HTM on every step of these runs, which jump and then keep the
  same counting direction (see the six-HTM steps below for a direction change);
- at most 28 HTM per recovery;
- at most 249 ms for one recovery search.

The live seconds after a 40-second catch-up are back on the period within six
ticks; a test pins this.

The recovery search runs synchronously on the main thread. It is bounded by
`RECOVERY_MAX_STEPS = 8`. Measured on a 2.1 GHz Xeon the median is 6 ms and the
worst case 163 ms; timings vary by run (the 5,400-jump run above saw 249 ms, a
warm run over the 47,628 recoveries after the exhaustive jumps above had a
median of 4 ms and a worst of 67 ms). On a slow phone, several times slower, the
worst case is estimated (not measured) as a UI hitch of roughly 0.6 to 1.3
seconds. Moving the search off the main thread is under way in a separate
change; update this paragraph when that lands.

The exact shortest-path planner (policy 13) remains only as the last fallback,
if no recovery plan or jump route is found. With the pinned print that does not
happen.

### Largest step per mode

**All 18 modes count at most five HTM per step** from a fresh setup and from
the period, and after a free jump while the counting direction stays the same.
The largest step over three laps from a fresh setup is
pinned in `tests/hsm-seconds-first.test.mjs` and `tests/hsm-counter.test.mjs`:

| Unit | 00–59 up / down | 00–23 up / down | 00–11 up / down |
| --- | ---: | ---: | ---: |
| S | 4 / 4 | 5 / 5 | 4 / 4 |
| M | 5 / 5 | 5 / 5 | 4 / 4 |
| H | 5 / 5 | 5 / 5 | 4 / 4 |

A free jump itself can still need six HTM; the user accepted the six-HTM bound
for free jumps.

**Six-HTM counting steps.** The five-HTM statements hold only while the counting
direction does not change after a free jump (or Set). If the direction is
changed after a jump or Set, M and H can need six HTM on a counting step. The
exhaustive run above, with each jump followed by a direction change and counting
on until the period is reached, found 78 such steps over its 24,768 jumps (M 40,
H 38) and 144 over the 40,800 jumps from every node (M 72, H 72). All are
forced: from that pose no route of five HTM shows the next display, so the
six-HTM shortest word is the only choice (for example M 00–59 counting up: Set
40, reverse the direction, then 40 to 39). S never takes six, and with the
direction unchanged no step of either run takes six.

The owner's accepted scope: seconds are primary, with ordinary and recovery
steps at most five HTM; minutes may take six HTM, including Set followed by a
direction change; hours have the lowest priority, with a ceiling of ten HTM;
free jumps may take six HTM. This is an accepted runtime scope, not a proof.

Before the all-mode periods, M 00–23 (up and down), M 00–11 down and H 00–59
down needed six HTM on ordinary counting steps, and so could M 00–59 after
leaving its period. A negative-control test keeps that regression
visible: removing the M 00–23 periods brings the six back.

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
six HTM for the jump itself, and the setup word from the solved print to the
period start (8–10 HTM) is excluded from the laps.

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
Its preferred H/M/S timings are 500/250/100 ms **per quarter turn**. A half turn
uses two quarter units. Six HTM loosely permit twelve quarter units, with nominal
H/M/S budgets of 6/3/1.2 seconds before fitting. Saved period routes use at most five quarter units
for seconds and eight for minutes and hours; this narrower result does not cover
arbitrary poses. A recovery step after a catch-up has at most five HTM, so at
most ten quarter units. The clock shows scheduled quarter/half
times when it fits a route into the available live interval. Standalone counter
rotation settings keep their per-move behavior; choosing the unit (or opening the
HSM counter) sets the slider to that unit's default of H 500 ms, M 250 ms, S 100 ms,
which can then be changed freely.

## Validation

```sh
npm run check
npm run test:e2e -- tests/browser/hsm-counter.spec.mjs
```

The HSM Node regressions cover repeated traversal of all eighteen letter/range/
direction modes, arbitrary targets, fallback prefix totals, invalid inputs,
full-state inverses, and bounded stop behavior. From each unit's fresh setup,
every one of the 18 modes closes over the full pose within one period at most
five HTM per step. A positive control turns the blank's up vectors without
changing any plan.

`tests/hsm-seconds-first.test.mjs` covers the following:

- the research commit and file hashes;
- the derived runtime file;
- the print code and the 14 changed identities, against a fixture of the
  previous print;
- each of the 18 periods replayed on the app's mechanics: the saved start
  frames, closure, at most five HTM, every forward edge shortest from its
  actual pose, and every backward word the inverse of its research word;
- three laps of every mode up and down through the real controller, against
  the per-mode lap, largest-edge and wrap pins above.

It checks recovery four ways:

- after free jumps in every mode, the period returns within the research step
  bound at most five HTM per step;
- after an interrupted route in every mode, the same holds;
- the recovery search from every saved research pose gives exactly the
  research's step count and HTM;
- from the poses without a route of five, exactly one six-HTM step comes
  first.

Three further tests are mutation controls and a coverage gap:

- free jumps from period nodes land on a period node where a least route can
  (fails if the period preference in the jump is removed);
- the recovery route search equals a brute-force search over every move
  sequence, including both orders of two opposite faces (fails if the search
  prunes both orders);
- after `configure()`, a switch of mode, range or direction from period nodes
  costs at most five HTM per step and is back on the period within six steps.

It runs the three-cube live-clock scheduler with the move statistics for 180
ticks, before and after, and checks that a bounded catch-up returns the seconds
to their period within six ticks.

Negative controls each must fail:

- corrupting the witness bytes, the derived runtime, a sticker, a period word
  and its length, a direction or traversal;
- a six-move witness word;
- an application mode the derivation cannot find;
- a design without the M 00–23 periods: it needs six HTM again.

Browser tests cover all nine letter/range variants in both wrap directions,
run/stop/resume, mobile layout, isolation from the existing counter and timer
applications, and the exact blank/M/33 regression. A known six-move free jump is
pinned as a Node regression.
