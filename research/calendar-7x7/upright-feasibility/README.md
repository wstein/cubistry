<!--
Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Strict upright rule for the 7x7 English calendar: feasibility study

**Status: research study, not certified. Research only: no change to the solver,
the chain, the checkers or the app.** Base: branch
`research/cube-display-feasibility` (head `53e96732`), pure split, month-letter
scheme A, 91 displays (7 weekdays x 13 month types), 294 stickers on 218 bodies.

Every claim is marked **[V] verified** (a Julia script in this directory printed
it; output in `evidence/`) or **[I] inference** (my reading, not machine-checked).
Flix was not run: every "verified" line is Julia only.

## Rule studied (owner decisions, binding)

- Half-turn equal: only **0** (circular, any turn) and **6 <-> 9**. Everything
  else must be upright: 1, 2, 5, 8, H, N, S, X, Z, every multi-character label,
  and `a/b` split labels.
- The turned "01", "02", "12" (read as 10, 20, 21) are no longer allowed.
- Font stays Noto Sans (OFL-1.1); new stickers use its glyphs.
- Print changes are allowed: dedicated stickers for 10, 20, 21 and for 1, 2, 5, 8
  (plus 11 and 22, see below). 9 stays a turned 6.
- Split labels are laid out diagonally (see section 6).

## Verdict

**Feasible, needs a reprint, no extra stickers or bodies.** The cube has 294
sticker positions on 218 bodies; that is geometry, so "extra stickers" can only
mean re-assigning existing positions, and that is enough.

| Question | Result |
|---|---|
| Does today's print (294 positions) suffice? | **No** [V] |
| Extra stickers / bodies needed | **0 / 0** [V] (budget stays 294 / 218) |
| Positions that must change artwork | **42 class copies are missing; the proposed print changes 45 surfaces** [V] |
| Printed / blank surfaces | 240 / 54 today, **243 / 51** proposed [V] |
| Legal state for all 91 displays under the strict rule | **91 / 91 found and checked (Julia)** [V] |
| Effort | solver unchanged; whole 863-edge chain must be regenerated [I] |

## 1. Which stickers do the 91 displays need?

[V] `evidence/label-demand.tsv` (per text and ink: displays using it, peak
simultaneous count, surfaces of the current print with exactly that artwork).

- Labels with **no sticker in the current print**: 10, 20, 21, each dark and red
  (they were made by turning "01", "02", "12"), and 9 dark / red (made by turning
  a 6; stays allowed). Weekday labels `FRI`, `MON` appear as `FR1`, `M0N` in the
  print (digit glyphs for I and O, an existing alias, see caveats).
- With the strict rule 1, 2, 5, 8, 11, 22 exist in the print, but not with the
  orientation the cells need. Today's print supplies them in the orientations
  that are only right when turned half a turn.
- Orbit inventory, `evidence/inventory-relaxed.tsv` vs `inventory-strict.tsv`:
  required printed classes rise from **240 to 243**; the current print is short
  by **42 class copies** in all 13 orbits (list in `inventory-strict.tsv`):

| missing (strict) | copies |
|---|---:|
| 10 (new sticker, any orientation) | 7 |
| 20 | 7 |
| 21 | 7 |
| 22 (upright orientation) | 5 |
| 11 (upright orientation) | 3 |
| 1, 2, 5, 8 (upright orientation, 3 each) | 12 |
| N month letter (upright orientation) | 1 |
| 9 | 0 (6 serves it) |
| **total** | **42** |

  (counted per orbit and orientation class; the per-class list is in the TSV)
- Minimum number of reprinted surfaces = 42 [V]: every missing copy needs its own
  surface, and each orbit has enough surplus surfaces (slack >= 0 in all 13
  orbits, `inventory-strict.tsv` column slack), so the bound is reached. The
  proposed print changes 45 because 3 surplus printed surfaces become blank.
- **Budget fits** [V]: no orbit is over capacity (24 surfaces, 6 for the core);
  tightest orbits have slack 0 (the midge orbit (-3,0), (-1,-1), (-1,0), core).

## 2. Is the glyph geometry really symmetric? (Noto Sans SemiBold, measured)

[V] `evidence/glyph-geometry.tsv` (parses the TTF, rotates the outline 180
degrees about its ink-box center, rasterizes, reports symmetric difference over
union; 0 = identical).

| glyph vs its half turn | difference |
|---|---:|
| 6 vs 9 | 0.0077 (practically a rotation) |
| 0 vs 0 | 0.0028 |
| 5 | 0.357 |
| 8 | 0.275 |
| 2 | 0.618 |
| 1 | 0.876 |

So, as measured, 2 and 5 (and 8, 1) are **not** half-turn symmetric in Noto
Sans; 0 and 6/9 are. This agrees with the owner decision. Cap height of digits
is 0.735 em, advance 0.572 em (tabular), slash advance 0.399 em.

## 3. Baseline: turned stickers in today's goal states

[V] `evidence/baseline-turned.tsv`. The 91 states of the pure split A are
replayed from the committed DAG; for every front cell the sticker's angle is
read. Counted: turned (angle != 0) stickers whose glyph is **not** 0 and not a
single 6 or 9. All 91 states pass today's rule; **0 of 91 are fully upright**.

| month type | displays | turned incl. 0/6/9 | **turned, violating** | per display (min-max) |
|---|---:|---:|---:|---|
| Jan, Jun | 7 each | 55 | **48** | 5-8 |
| Feb, Feb leap, Mar, Apr, May, Jul, Aug, Sep, Dec | 7 each | 48 | **41** | 4-7 |
| Oct, Nov | 7 each | 55 | **41** | 4-7 |
| all | 91 | | **547** | mean 6.0 |

Violating glyphs (counts over the 91 states): 01 (91, shown as 10), 02 (91,
shown as 20), 12 (91, shown as 21), 22 (65), 1, 2, 5, 8, 11 (39 each),
N (14, month letter in JAN/NOV). The count equals the number of cells
the current print cannot match upright (547 unmatched cells over 91 displays,
`verify-current-print-under-strict.tsv`); I did not check that they are the same cells.

## 4. Is there a solvable approach under the strict rule?

[V] **Yes, at the level of root states.** Steps and evidence:

1. `design_strict.jl` reprints surplus surfaces of the pure-A print (random
   restarts per orbit, objective: cubie-level front matching of all 91 displays).
   Result: `evidence/print-strict-upright.tsv` (same columns as
   `print-pure-A.tsv`), 45 changed surfaces (`print-changes.tsv`), 243 printed.
2. `verify_strict_print.jl` (reuses the existing supply and matchability code with
   the strict glyph table): supply missing 0, displays without a cubie matching 0
   (`verify-strict-print.tsv`). The same script rejects today's print (supply
   missing 42, 91 displays with unmatched cells).
3. `strict_synth_probe.jl` is the unchanged pure-split `synth.jl` with only the
   glyph table replaced. For all 91 displays it found a word of the 21 legal
   generators from the pure-A state: 73 by the global beam search, **17 by the
   orbit-solve fallback after the beam stalled** (2 + 1 in the original run).
   HTM: median 35, mean 95, maximum 494 (the orbit-solve words are 433-494 HTM;
   the original run had maximum 64). `evidence/strict-synth-91.tsv`.
4. `check_strict_states.jl` replays each result independently and applies the
   strict front rule (stacked labels upright): **91 / 91 PASS**, and 0 violating
   turned stickers (`strict-states-check.tsv`).

What is not shown: no chain (the 863-edge chain) was run under the strict rule, so
[I] edge lengths and the stall rate along the chain are unknown. The root-state
search stalling 18 times in 91 (20 percent, against 2 in 91 before) suggests that
edges are harder; that is an inference, not a measurement.

### What would change (nothing was touched)

[I] Solver (global beam, orbit solve, macros): no algorithmic change. The only
input that changes is the glyph table. Files that carry it:

- research Julia: `english/prepare_physical.jl` (`image_normal`, uses `HALF`),
  `orientation_screen.jl` (`HALF`, `artwork`); my scripts override `HALF` at
  run time instead of editing them. A clean change is a named rule profile.
- research Flix: `english/flix/src/Core.flix` (`halfChar`, `halfWord`) and
  `verification/flix/src/Oriented.flix`, plus the pure-split port.
- app: `src/apps/calendar7/display.ts` (`HALF`, `imageNormal`);
  `tests/calendar7-replay.test.mjs` lines 159-165 pin the old equivalences.
- data: new print (`state.v1.json`, `print-pure-A.tsv` successor), DAG, pins in
  `calendar7-source.json`. `displays.v1.json` (the 91 sheets) does **not** change.
- **Chain:** the chain and the 2028-2076 segment are physical states under the
  old print. The verifiers pin the print digest, so every old chain edge is
  invalid under the new print; the whole chain has to be produced again with
  the strict rule (all 863 edges to 2099-12). The running chain is unaffected
  (not touched) and stays valid for the old rule only.
- Effort [I]: rule profile in Julia + Flix + TS with tests about 2-3 working
  days; print review and independent Flix check of the new print about 1-2 days;
  chain regeneration is CI time: the old 576 edges took four workflow runs of
  144 edges, so about six runs for 863 edges, more if the fallback is used
  more often (as the root-state stall rate hints). Open risk: whether a strict
  chain keeps similar HTM per edge.

## 5. Proposed print

`evidence/print-strict-upright.tsv`, columns as `print-pure-A.tsv`. Every
`piece`, `home` and `normal` is unchanged; only `up`, `text`, `ink` of 45
surfaces differ. Net text changes: 10 (+7), 20 (+7), 21 (+7), 8 (+3), "01" (-7),
"02" (-7), "12" (-7), blank (-3). Upright orientations of 1, 2, 5, 11, 22 and one
N change by `up` only. Licence: CC BY-SA 4.0 (this directory's NOTICE.txt).
[V] Necessary conditions hold; legal states exist (section 4). Not done: Flix
check of the print, the independent cubie-level review the earlier prints had,
and a human check of the 45 positions (no look at the physical cube).

## 6. Diagonal split labels

Owner layout: `23` top left, slash in the middle, `30` bottom right, all upright
in Noto Sans. [V] `evidence/glyph-geometry.tsv` (glyph outlines placed in the
unit text square, slash 1x the font size, ink-to-ink distance measured; a
clearance of 0.04 of the square is about 0.5 mm on a 14 mm square):

| layout | font size (square = 1) | digit height | digit height vs plain 2 digits |
|---|---:|---:|---:|
| plain two digits (current art rule) | 0.874 | 0.643 of the text square | 1.00 |
| one line `23/30` (current art rule) | 0.372 | 0.274 | 0.43 |
| **diagonal, clearance 0.02 / 0.04 / 0.06** | 0.487 / 0.471 / 0.457 | **0.358 / 0.346 / 0.336** | 0.56 / 0.54 / 0.52 |

- Legibility: the diagonal label is **23-31 percent taller** than today's one-line
  label (digit height 0.35 against 0.27 of the text square). In the app art
  rule (`TEXTURE` 192, text square 0.86), digit height is 0.30 of the sticker
  side. On a 16 mm cut (14 mm text square after the 1 mm inset in
  `docs/PRINT_STICKERS.md`) that is about **4.8 mm** (4.5 mm on a 15 mm cut),
  against 3.8 mm one line. Plain two-digit dates are bigger (about 6.7 mm in
  the app art rule), so split stickers stay the smallest digits on the cube.
- Room: [V] fits with clearance up to at least 0.08; the two numbers are far
  apart (gap between their ink 0.32-0.41 of the square). All stickers are the
  same square, so the three split stickers (4, 218, 219) have the same room as
  any other. [I] The recess of a corner or wing piece in a real cube may be
  smaller than a center piece; that must be measured on the cube.
- Count and table: **no change** to the number of stickers or bodies. The three
  split surfaces are the same as in the print; I give the layout in
  `evidence/print-strict-upright.layout.tsv` (`layout=diagonal`) and keep the
  print table itself in the old columns, so existing tools still read it. The
  rule is "text contains `/` means diagonal".
- Code that would change (not edited here): `src/apps/calendar7/sticker-art.ts`
  (`drawSticker` draws any text on one line and picks 80 px for 5 characters;
  needs a split branch drawing two numbers and a slash), `src/apps/calendar7/
  viewer.ts` (calls `drawSticker`, probably unchanged), the HTML sheet in
  `month-view.ts` if it draws split cells as `a/b` text (not checked), and the
  print sheet generator (`scripts/print-sticker-sheets.py`; it has no calendar7
  support today). The front rule keeps the label text `23/30` and its upright
  requirement; the layout is rendering only.

## Caveats and open points

- [V] The print file named in the brief is on `main`
  (`data/calendar7/research/print-pure-A.tsv`); the research branch carries the
  identical copy `research/calendar-7x7/pure-split-states/evidence/` (diff
  clean), which the scripts use. `display.ts` was read from `main`.
- [V] The model "type" in section 3 is the calendar month (13 types incl. leap
  February); results do not depend on the weekday of the first.
- [I] The existing aliases O = 0 and I = 1 stay. In Noto Sans the digit 0 and the
  letter O, or 1 and I, are different glyphs; the print uses `FR1`, `M0N` and a
  month letter `O`. This is outside the owner rule (those labels are upright
  anyway) but should be checked against "Noto Sans glyphs only".
- [I] 6 <-> 9: measured near-exact, but a 6 turned is still a 6 glyph, not the
  designed 9; it is the owner decision.
- [I] Words in `strict-synth-91.tsv` are search results, not optimal.

## Reproduce

```sh
julia --startup-file=no baseline_turned.jl PRINT DAG        # section 3
julia --startup-file=no upright_inventory.jl PRINT strict   # section 1
julia --startup-file=no label_demand.jl PRINT               # section 1
julia --startup-file=no design_strict.jl PRINT OUT 1 200    # section 5
julia --startup-file=no verify_strict_print.jl OUT          # section 4
IDS=1,13 julia --startup-file=no strict_synth_probe.jl DAG OUT all NEWDAG LOG
julia --startup-file=no check_strict_states.jl OUT NEWDAG all
julia --startup-file=no glyph_geometry.jl NotoSans-SemiBold.ttf
```

`PRINT` is `../pure-split-states/evidence/print-pure-A.tsv`, `DAG` the gunzipped
`../pure-split-states/evidence/dag-all.tsv.gz`. Julia 1.10.5 was used. Tests via
GitHub Actions only; nothing here was added to a workflow.
