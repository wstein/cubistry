# Pure stacked split, month-letter scheme A: legal states for 2027

**Status: research candidate, not certified.** Stage 1 (the twelve months of
2027) is accepted by native Julia and the Flix structural port, with
byte-identical receipts. Stage 2 (all 91 displays) has **not** been started; one
display is blocked under this print (see "Stage 2").

This work depends on PR #145 (`research/calendar7-stacked-dual-labels`), which
holds the inventory result for the pure split with moved month letters.

## Layout

- The **pure split** under the strict reading, with no overflow marks:
  - F31 (Friday-start, 31 days): `24/31` red at row 7 Sunday;
  - S30 (Saturday-start, 30 days): `23/30` red at row 7 Sunday;
  - S31 (Saturday-start, 31 days): `23/30` red and `24/31` black at row 7 Sunday
    and Monday.
- **Month letters, scheme A** (`H=555555555222`): January to September at
  columns 5–7 as in PR #99; October to December at columns 2–4 instead of 1–3.
- Every stacked label has one ink and counts only when upright.

## The print

[evidence/print-pure-A.tsv](evidence/print-pure-A.tsv) has 240 printed surfaces,
the same count as PR #99. It was derived from the PR #99 print by the untrusted
[design_print.jl](design_print.jl). The checkers pin the SHA-256 of the PR #99
print as the provenance base, and every surface keeps its cubie, home and
normal. Sixteen surfaces change ([print-changes.tsv](evidence/print-changes.tsv);
both checkers list them as `pure-print-change` lines):

| Surface | PR #99 | New | Orbit |
|---:|---|---|---|
| 218 | `O` month | `23/30` red | corner (-3,-3) |
| 219 | `D` month | `24/31` red | corner (-3,-3) |
| 220 | `N` month | blank | corner (-3,-3) |
| 25 | blank | `D` month | outer wing (-3,-2) |
| 74 | blank | `N` month | outer wing (-3,-2) |
| 278 | `C` month | blank | outer wing (-3,-2) |
| 283 | `E` month | blank | outer wing (-3,-2) |
| 228 | `V` month | `O` month | inner wing (-3,-1) |
| 261 | `T` month | `E` month | inner wing (-3,-1) |
| 35 | blank | `C` month | midge (-3,0) |
| 134 | blank | `T` month | midge (-3,0) |
| 135 | blank | `V` month | midge (-3,0) |
| 224 | `30↶` red | blank | (-3,1) |
| 243 | `31↶` red | blank | (-3,1) |
| 4 | blank | `24/31` black | outer wing (-3,2) |
| 193 | `31↶` black | blank | (-2,1) |

**How the designer chose these surfaces:**

- It keeps every surface that a still-valid PR #99 state shows on the front.
- It reprints only obsolete artwork (moved letters, overflow marks) and spare
  blanks.
- Among all assignments it picks one under which every display has a
  **cubie-level front matching**. Two stickers on one cubie cannot serve two
  cells at once, which the per-orbit inventory does not see.
- The first version ignored this coupling. Six displays then had no possible
  state (for example February 2027 at row 4, column 7), and the search stalled
  on them.

**Strict print supply** (both checkers, `pure-print-orbit` lines): every orbit
supplies every required class at least as often as its peak demand.

| orbit | required printed | blank peak | printed in print | blank in print | spare (24 or 6 − required − blank peak) |
|---|---:|---:|---:|---:|---:|
| (-3,-3) corner | 19 | 3 | 19 | 5 | 2 |
| (-3,-2) | 15 | 2 | 15 | 9 | 7 |
| (-3,-1) | 21 | 2 | 21 | 3 | 1 |
| (-3,0) midge | 21 | 2 | 21 | 3 | 1 |
| (-3,1) | 20 | 2 | 20 | 4 | 2 |
| (-3,2) | 20 | 1 | 20 | 4 | 3 |
| (-2,-2) | 16 | 0 | 16 | 8 | 8 |
| (-2,-1) | 21 | 1 | 21 | 3 | 2 |
| (-2,0) | 20 | 0 | 20 | 4 | 4 |
| (-2,1) | 17 | 1 | 17 | 7 | 6 |
| (-1,-1) | 22 | 2 | 22 | 2 | 0 |
| (-1,0) | 22 | 1 | 22 | 2 | 1 |
| core (6) | 6 | 0 | 6 | 0 | 0 |

## Stage 1: legal states for January to December 2027

[synth.jl](synth.jl) (untrusted) handles each month of 2027 in turn:

- If the PR #99 state of the display already shows the new display under the
  new print, its root is kept.
- Otherwise it runs the **unchanged PR #130 global beam search**
  (`../global-search/search.jl`, goal = all 49 front cells, don't-care
  elsewhere), using the new print and the new display as the goal. It starts
  from the PR #99 state.
- If that stalls, it uses the PR #99 planner's orbit-by-orbit catalogue solve
  with a two-macro escape ([orbit_solve.jl](orbit_solve.jl)).
- If that also stalls, it runs the global search from the states already found
  for other months.
- Every result is a word of the 21 legal generators. It is appended to the
  PR #99 DAG as primitive products, as in PR #128's repairs:
  [dag-2027.tsv.gz](evidence/dag-2027.tsv.gz).
- The search log is [synth-2027.tsv](evidence/synth-2027.tsv).

[check_pure.jl](check_pure.jl) (Julia) and [flix/](flix/) (Flix) check the
following, with identical receipts ([cases.tsv](evidence/receipts/cases.tsv)):

- the PR #99 print provenance and the print changes;
- the strict print supply;
- for the 2027 displays (ids 13 to 24): the DAG is replayed from the 21 legal
  generators, the complete 294-sticker state is decoded, and the front is
  checked against the new display under the strict reading.

| Month 2027 | Display id | Type | Result | Word (HTM) |
|---|---:|---|---|---:|
| 1 | 13 | F31 folded (24/31 red) | global search from the PR #99 state, PASS in both | 3 |
| 2 | 14 | plain | PR #99 state kept, PASS in both | 0 |
| 3 | 15 | plain | PR #99 state kept, PASS in both | 0 |
| 4 | 16 | plain | PR #99 state kept, PASS in both | 0 |
| 5 | 17 | S31 folded (23/30 red, 24/31 black) | global search from the PR #99 state, PASS in both | 9 |
| 6 | 18 | plain | PR #99 state kept, PASS in both | 0 |
| 7 | 19 | plain | PR #99 state kept, PASS in both | 0 |
| 8 | 20 | plain (PR #99 state broken by a reprint) | global search from the PR #99 state, PASS in both | 14 |
| 9 | 21 | plain | PR #99 state kept, PASS in both | 0 |
| 10 | 22 | F31 folded + letters moved | orbit solve from the PR #99 state (global search stalled), PASS in both | 57 |
| 11 | 23 | letters moved | global search from the PR #99 state, PASS in both | 17 |
| 12 | 24 | letters moved | global search from the PR #99 state, PASS in both | 17 |

All twelve states pass in both checkers.

- The search words are candidates found by a heuristic. They are not shortest
  words, and no move counts are claimed as savings.
- The same 12 displays with the unchanged PR #99 DAG fail in both checkers
  (`pr99-dag-2027`). That shows the new states are needed.
- With the new DAG, the other displays still fail: only 2027 was synthesized
  (`new-dag-all`).

The owner's month sheets: [displays-2027.tsv](evidence/displays-2027.tsv)
(rows 1 to 7, cell = text and ink; descriptive listing from
[displays.jl](displays.jl)).

## Transitions (item 4): UNKNOWN

No chain from January to December 2027 was searched or verified.

- The PR #130 search could produce month-to-month words between the new states.
- The native chain verifiers (`../continuous/verify.jl` and its Flix port)
  derive their goals from the PR #99 print and the PR #99 displays. Verifying
  chains for this print would need them parametrized for the print and the
  display set. That is a moderate change to two verifiers, not done here.
- Any HTM numbers would therefore be "search result, not verified, not
  optimal". No move-saving claims are made.

## Stage 2 (all 91 displays): not started, one display blocked under this print

- 57 of the 91 displays are unchanged by scheme A. 13 of them are broken by the
  reprints (the reprinted surfaces show on their fronts): 2, 3, 20, 26, 40, 43,
  57, 66, 73, 74, 77, 85, 86.
- 34 displays change: the folded ones, plus October to December.
- So 47 displays need new states.
- 2027 covers 6 of them: January, May, August, October, November and December.
- **Blocker:** [matchability.jl](matchability.jl) (descriptive, Julia only)
  finds that display 72 (December 2031) has **no cubie-level front matching**
  under this print (cell row 4, column 7, in the midge orbit). No legal state
  can show it with this print.
- The designer tried every assignment of the three new midge letters to the
  midge blanks; each leaves at least one such cell. Fixing this needs a coupled print
  redesign in the midge orbit, which moves dates onto other midge cubies, like
  PR #99's coupled synthesis. That is not done; stage 2 is UNKNOWN.

## Negative controls

[negative_checks.sh](negative_checks.sh) runs seven controls; results are in
[results.tsv](evidence/negative-controls/results.tsv). Julia and Flix both exit
1 on all seven:

- the black `24/31` surface blanked: the supply check fails, and May fails;
- the red `24/31` surface turned a quarter: the supply check fails, and
  January fails with `stacked-not-upright`;
- a cubie id changed in the print;
- January's root put back on its PR #99 root;
- the first appended product inverted;
- a target id 0;
- a duplicate target.

## Provenance and common-mode risks

- [stacked_common.jl](stacked_common.jl) and [flix/src/Stacked.flix](flix/src/Stacked.flix)
  are clean copies from PR #145 (branch `research/calendar7-stacked-dual-labels`
  at `50fa8b2`). Their source SHA-256:
  - `dual-stacked/stacked_common.jl`:
    `1acefbd32b1e56221f3b84c1a17e0e7820228bab84fb53edee0e9e9051785312`;
  - `dual-stacked/flix/src/Main.flix`:
    `4187ee5683c1049232813219ebc5d6aa8c1b7fda5acda532722e5cc11dea31b2`.
  - The Flix copy has its `main` removed and a two-line provenance header
    added.
- The English Julia and Flix modules on this base are identical to those at
  `50fa8b2`.
- The Flix checker is a structural port of the Julia checker (print supply,
  front rule), so a wrong definition would be shared. Geometry, calendar,
  optics, print reader and DAG replay come from the separately written PR #99
  Julia and Flix modules.
- The designer, the synthesizer and the matchability check are Julia-only
  candidate tools. Only the two checkers decide.

## Reproduce

```sh
research/calendar-7x7/pure-split-states/flix/build.sh
JULIA_BIN=julia research/calendar-7x7/pure-split-states/run_checks.sh /tmp/cubistry-calendar7-pure-flix/artifact/flix.jar "$work/run"
JULIA_BIN=julia research/calendar-7x7/pure-split-states/negative_checks.sh /tmp/cubistry-calendar7-pure-flix/artifact/flix.jar "$work/neg"
```
