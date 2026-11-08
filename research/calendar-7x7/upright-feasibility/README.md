<!--
Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Strict upright rule for the 7x7 English calendar: feasibility and acceptance

**Status: research study, not certified. Research only: no change to the
solver, the chain, the checkers or the app.** Base: branch
`research/cube-display-feasibility` (head `53e96732`), pure split, month-letter
scheme A, 91 displays (7 weekdays x 13 month types), 294 stickers on 218 bodies.

Marks: **[V]** verified (a Julia script here printed it, output in `evidence/`),
**[I]** inference (my reading, not machine-checked), **[D]** deferred (not done).
Everything verified is **Julia only; Flix was not run.**

## Scope (owner decisions, binding)

1. Prove only the **91 front variants**: a cubie-level front matching under the
   strict rule. No move words, no chain, no replay, no HTM statistics: **[D]
   deferred until the owner accepts the cube.** (An earlier head of this PR had a
   move-word search; it was removed and none of its numbers is claimed.)
2. Rebuild the cube as a **final print table** and make it ready for acceptance,
   with visuals (section 5).

Rule: half-turn equal are only the digit **0** (circular) and a single **6 <-> 9**.
Everything else is upright: 1, 2, 5, 8, H, N, S, X, Z, every multi-character
label and every `a/b` split label. **No aliasing: the letter O is not the digit 0,
the letter I is not the digit 1.** Font: Noto Sans (OFL-1.1). Split labels are
diagonal (first number top left, slash in the middle, second number bottom right).

## Verdict

**Feasible at the front level. A reprint is needed. No extra stickers or bodies.**

| Question | Result |
|---|---|
| Does today's print suffice? | **No** [V] |
| Missing sticker class copies (per orbit and orientation) | **46** [V] |
| Extra stickers / bodies | **0 / 0**: 294 stickers on 218 bodies stay [V] |
| Proposed print | 243 printed, 51 blank (240 / 54 today), **48 surfaces change** [V] |
| 91 front variants | **91 / 91 matched**, 4459 cells, all upright under the rule [V] |
| Legal states and moves, rest of the cube | **not done** [D] |

## 1. Which stickers do the displays need? [V]

`evidence/label-demand.tsv`, `evidence/inventory-strict.tsv`.

- No sticker exists today for **10, 20, 21** (dark and red) and for **9** (served
  by a turned 6, allowed). The weekday stickers are printed `FR1` and `M0N`, and
  the month letter O of October by the digit `0`; with no aliasing they do not
  count as FRI, MON, O.
- 1, 2, 5, 8, 11, 22 exist but not in the orientation the cells need.
- Orbit inventory (every orbit must supply every class at its peak demand):

| | required printed classes | missing in today's print |
|---|---:|---:|
| today's rule (relaxed) | 240 | 0 |
| strict, with the old O=0, I=1 aliasing | 243 | 42 |
| **strict, no aliasing (owner)** | **243** | **46** |

Missing copies by label (46): 10: 7, 20: 7, 21: 7, 22: 5, 11: 3, 1/2/5/8: 3
each, **O: 2, FRI: 1, MON: 1**, N: 1 (month letter, upright). The orbit slack is
>= 0 in all 13 orbits (0 for orbits (-3,0), (-1,-1), (-1,0) and the core), so
the budget **fits** and 46 is the minimum number of surfaces to reprint.

## 2. Glyphs: measured Noto Sans SemiBold [V] (`evidence/glyph-geometry.tsv`)

Half-turn residual (symmetric difference over union of the ink after turning the
outline 180 degrees; 0 = identical), and shape difference without turning:

| glyph | half-turn residual |
|---|---:|
| digit 0 | 0.0028 |
| 6 vs 9 | 0.0077 |
| **letter O** | **0.0110** |
| **letter I** | **0.0016** |
| 5 / 8 / 2 / 1 | 0.357 / 0.275 / 0.618 / 0.876 |

| pair (no turn) | shape difference |
|---|---:|
| 0 vs O | 0.579 |
| 1 vs I | 0.734 |

So 0 and O, and 1 and I, are clearly different glyphs. **Decision for O and
I: upright only.** The owner rule gives half-turn status only to the digit 0 and
6/9, and O (0.011) is measured near-symmetric but is not 0. I is symmetric but
occurs only inside the word FRI, which is never half-turn equal. Sensitivity
[V] (`evidence/inventory-strict-halfO.tsv`): allowing O half-turn equal would not
change the missing count (46) or the print.

## 3. Baseline: today's goal states [V] (`evidence/baseline-turned.tsv`)

The 91 goal states of the committed DAG (read only; no new states computed).
All pass today's rule; **0 of 91** are fully upright under the new rule.

- Turned stickers whose glyph is not the digit 0 and not a single 6/9: **554**
  (mean 6.1 per display, 4 to 8). Per month type: Jan, Jun, Nov 48 per 7
  displays; Feb, Feb leap, Mar, Apr, May, Jul, Aug, Sep, Oct, Dec 41.
- Glyphs: 01 and 02 and 12 (read as 10, 20, 21) in all 91, 22 in 65, 1, 2, 5, 8,
  11 in 39 each, N in 14, and **the letter O in 7** (November, turned a quarter
  turn: accepted only through the O=0 alias).
- **Alias uses** (sticker text differs from the cell text, accepted only by the
  alias): `FR1` for FRI and `M0N` for MON in **all 91 displays**, the digit `0` for
  the October O in 7 displays. 189 cells in total.

## 4. O and I: where they occur and what changes

| string | where | today | new print |
|---|---|---|---|
| **MON** | row 2, column 2, all 91 displays | sticker `M0N` (digit 0) | new sticker `MON` (letter O), 1 copy |
| **FRI** | row 2, column 6, all 91 displays | sticker `FR1` (digit 1) | new sticker `FRI` (letter I), 1 copy |
| month letter **O**, October | row 1, column 2, 7 displays | digit sticker `0` | letter `O` sticker |
| month letter **O**, November | row 1, column 3, 7 displays | letter `O`, turned a quarter turn (alias) | letter `O`, upright |

The digit 0 is no longer printed on a sticker of its own; `0` appears only inside
10, 20, 30. `FR1`, `M0N` and the digit `0` are retired. Month letter O needs 2
copies (the two orbits of those cells). Letter I appears only inside FRI.

## 5. Proposed print and acceptance visuals

- **Print table:** `evidence/print-strict-upright.tsv`, same columns as
  `print-pure-A.tsv`. Every `piece`, `home`, `normal` is unchanged; `up`, `text`,
  `ink` of 48 surfaces differ (`evidence/print-changes.tsv`). Net text changes
  against the pure-split A print: +10, +20, +21 (7 each), +8 (3), +FRI, +MON,
  month O (2 stickers, was 2 letters and 1 digit), `01`, `02` (-7 each), `12`
  (-7), `FR1`, `M0N`, month `0` retired, 3 stickers become printed.
- **Diagonal split label** (stickers 4, 218, 219: `23/30` red, `24/31` dark and
  red): the rule is *text contains `/` means diagonal*, the print table keeps its columns. Digit
  height 0.346 of the text square at clearance 0.04 of the square (font size
  0.471), about 4.8 mm on a 16 mm cut and 4.5 mm on 15 mm, against 3.8 mm for
  today's one-line label [V]. Plain two-digit dates are bigger (about 6.7 mm).
- **Visuals** (`acceptance/`): `index.html` (open locally; inline SVG with Noto Sans
  SemiBold glyph outlines, no font file needed) and `preview-1.png` to
  `preview-5.png` (screenshots of the same page). Contents: the three diagonal
  split stickers, every sticker class with count now and before (new classes
  highlighted), the 48 changed surfaces before and after, and **all 91 front
  views**. The cell art follows the text fitting of
  `src/apps/calendar7/sticker-art.ts` (140/110/80 px, 86 percent text area)
  except for split labels, which use the diagonal layout.
- **Front proof** [V] (`render_acceptance.jl`, `evidence/front-matching.tsv`,
  `evidence/front-variants-summary.tsv`): for each of the 91 displays one cubie and
  one rotation per front cell, found by a maximum matching, such that the shown
  sticker is the cell text upright (second, independent check in `shown_ok`).
  4459 cells, no cubie used twice per display, the only turned readings are
  **91 cells of a 6 shown as 9**; no digit 0 turned, no split label turned.
  `verify_strict_print.jl`: supply missing 0, displays without matching 0; the
  same script rejects today's print (supply missing 46, all 91 displays with
  unmatched cells, 743 cells).

## 6. What is not proven, and what would change [I][D]

- **[D]** Reachability: the matching is a necessary condition. That the remaining
  stickers can be completed by legal moves, the 91 root states, the 863-edge
  chain and any HTM numbers are **not done** and wait for acceptance.
- **[D]** Flix: the Flix port (`english/flix/src/Core.flix` `halfChar`/`optic`,
  `verification/flix/src/Oriented.flix`) still has the old rule; no Flix check of
  this print or matching was made.
- **[I]** Solver and chain code: no algorithm change, only the glyph rule (the
  research `image_normal`, `artwork` and `HALF` in `english/prepare_physical.jl`
  and `orientation_screen.jl` fold O to 0 and I to 1; `strict_rule.jl` here
  redefines them at run time instead). The app needs `display.ts` (`HALF`,
  `imageNormal`, aliases) and `tests/calendar7-replay.test.mjs` lines 159-165.
  New print, pins and states change; `displays.v1.json` does not.
  Old chain edges are invalid under a new print (the verifiers pin the print
  digest), so the chain would be produced again after acceptance.
- **[I]** Rendering: `src/apps/calendar7/sticker-art.ts` `drawSticker` needs a
  split branch (diagonal), and `month-view.ts` if it draws split cells. The print
  sheet generator (`scripts/print-sticker-sheets.py`) has no calendar7 support.
  Not edited.
- **[I]** Physical: the real recess of corner and wing pieces may be smaller
  than the square assumed here; the 6 vs 9 turn is a near-exact rotation in Noto
  Sans (0.0077) but a 6 turned is still a 6 glyph.

## Reproduce

```sh
P=../pure-split-states/evidence/print-pure-A.tsv        # DAG: gunzip dag-all.tsv.gz
julia --startup-file=no baseline_turned.jl $P DAG       # section 3
julia --startup-file=no upright_inventory.jl $P strict  # relaxed|strict-alias|strict-halfO
julia --startup-file=no label_demand.jl $P
julia --startup-file=no design_strict.jl $P OUT.tsv 7 300
julia --startup-file=no verify_strict_print.jl OUT.tsv
julia --startup-file=no render_acceptance.jl OUT.tsv $P NotoSans-SemiBold.ttf .
julia --startup-file=no glyph_geometry.jl NotoSans-SemiBold.ttf
```

Julia 1.10.5. The font is `public/fonts/noto-sans/NotoSans-SemiBold.ttf` on
`main` (OFL-1.1, not copied here). Tests only via GitHub Actions; nothing was
added to a workflow.
