# Pure stacked split, month-letter scheme A: legal states for all 91 displays

**Status: research candidate, not certified.** For all **91 displays** (888
months, 2026 to 2099), native Julia and the Flix structural port accept a legal
full physical state under the new print, with byte-identical receipts. There
is no pinned manifest. Anything not covered by both checkers is UNKNOWN.

This work depends on PR #145 (`research/calendar7-stacked-dual-labels`), which
holds the inventory result for the pure split with moved month letters.

## Layout

- The **pure split** under the strict reading, with no overflow marks:
  - F31 (Friday-start, 31 days): `24/31` red at row 7 Sunday;
  - S30 (Saturday-start, 30 days): `23/30` red at row 7 Sunday;
  - S31 (Saturday-start, 31 days): `23/30` red at row 7 Sunday and `24/31` dark
    (black ink) at row 7 Monday.
- **Month letters, scheme A** (`H=555555555222`): January to September at
  columns 5–7 as in PR #99; October to December at columns 2–4 instead of 1–3.
- Every stacked label has one ink and counts only when upright.

## The print

[evidence/print-pure-A.tsv](evidence/print-pure-A.tsv) has 240 printed
surfaces, the same count as PR #99.

- It is derived from the PR #99 print. The checkers pin the PR #99 print's
  SHA-256 as the provenance base, and every surface keeps its cubie, home and
  normal.
- 17 surfaces differ from PR #99. Both checkers list them as
  `pure-print-change` lines; the design steps are in
  [print-changes.tsv](evidence/print-changes.tsv).

| Surface | PR #99 | Final print | Orbit | Step |
|---:|---|---|---|---|
| 218 | `0` month (digit 0, the allowed O/0 alias) | `23/30` red | corner (-3,-3) | design |
| 219 | `D` month | `24/31` red | corner (-3,-3) | design |
| 220 | `N` month | blank | corner (-3,-3) | design |
| 25 | blank | `D` month | outer wing (-3,-2) | design |
| 74 | blank | `N` month | outer wing (-3,-2) | design |
| 278 | `C` month | blank | outer wing (-3,-2) | design |
| 283 | `E` month | blank | outer wing (-3,-2) | design |
| 228 | `V` month | `O` month | inner wing (-3,-1) | design |
| 261 | `T` month | `E` month | inner wing (-3,-1) | design |
| 134 | blank | `T` month | midge (-3,0) | design |
| 135 | blank | `V` month | midge (-3,0) | design |
| 35 | blank | `26` dark | midge (-3,0) | design (`C`), then midge redesign |
| 70 | `26` dark | `C` month | midge (-3,0) | midge redesign |
| 224 | `30↶` red | blank | (-3,1) | design |
| 243 | `31↶` red | blank | (-3,1) | design |
| 4 | blank | `24/31` dark | outer wing (-3,2) | design |
| 193 | `31↶` dark | blank | (-2,1) | design |

### How the surfaces were chosen

The untrusted [design_print.jl](design_print.jl) reprints, orbit by orbit, the
artwork scheme A no longer needs (moved letters, overflow marks) and spare
blanks. It prefers surfaces that no still-valid PR #99 state shows on the front.

- **It does not keep every shown surface.** In the midge orbit, the three new
  letters needed three PR #99 blanks, and every one of them is shown by some
  still-valid PR #99 state. The designer gave those states up.
  - In the stage-1 print, surface 35 (a PR #99 blank, then `C`) sits on the
    front of the PR #99 states of 13 unchanged displays (2, 3, 20, 26, 40, 43,
    57, 66, 73, 74, 77, 85, 86). That is why those states broke.
- **The designer also requires a cubie-level front matching for every display.**
  Two stickers on one cubie cannot serve two front cells at once, and the
  per-orbit inventory does not see this.
  - A first, uncommitted design run that ignored this left 6 displays without a
    possible state, by my count. An independent reviewer's reconstruction
    found 7 (6, 14, 35, 48, 52, 69, 89).
  - The committed stage-1 print still left display 72 (December 2031) without a
    matching. It needs `C` at (1,4), red 7 at (4,1), dark 31 at (7,4) and red 13
    at (4,7), all midge cells. `C` (surface 35) sat on cubie 22, which also
    carries the only red 13 midge surface (36).
- **Midge redesign.** [redesign_midge.jl](redesign_midge.jl) (untrusted) runs a
  best-improvement swap search over the midge orbit's artwork. It keeps the
  class multiset, so the strict supply is unchanged.
  - It found one swap: `C` onto surface 70, dark `26` onto surface 35. The
    independent reviewer found the same swap as the cheapest of four.
  - It breaks two more unchanged PR #99 states (displays 62 and 90). In total,
    the PR #99 states of 15 unchanged displays no longer fit:
    2, 3, 20, 26, 40, 43, 57, 62, 66, 73, 74, 77, 85, 86, 90.
- **Matchability is a command of both checkers** (`check_pure.jl matchability`,
  Flix `matchability`), with identical receipts:
  - final print: 0 displays without a cubie-level matching;
  - stage-1 print ([print-stage1.tsv](evidence/print-stage1.tsv)): display 72.

  This is a necessary design check. The proof is that both checkers accept the
  states.

### Strict print supply and remaining capacity

Both checkers print `pure-print-orbit` lines: every orbit supplies every
required class at least as often as its peak demand.

| orbit | required printed | blank peak | printed | blank | spare (24 or 6 − required − blank peak) |
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

## Stage 2: legal states for all 91 displays

[synth.jl](synth.jl) (untrusted, `all` mode) handles every display:

- If the PR #99 state already shows the new display under the final print, it
  is kept.
- Otherwise it runs the **unchanged PR #130 global beam search**
  (`../global-search/search.jl`; goal = all 49 front cells, don't-care
  elsewhere) from the PR #99 state of the same display.
- If that stalls, it uses the PR #99 planner's orbit-by-orbit catalogue solve
  with a two-macro escape ([orbit_solve.jl](orbit_solve.jl)).
- If that also stalls, it runs the global search from the six nearest
  displays' new states.
- Each result is a word of the 21 legal generators, appended to the PR #99 DAG
  as primitive products ([dag-all.tsv.gz](evidence/dag-all.tsv.gz)). The search
  log is [synth-all.tsv](evidence/synth-all.tsv).

**Outcome:** 42 displays keep their PR #99 state, 46 were found by the global
search, and 3 by the orbit solve after the global search stalled (displays 22,
58 and 71). Words have median 15 HTM and at most 64 HTM. They are search
results, not optimal, and no move savings are claimed.

Checker receipts ([cases.tsv](evidence/receipts/cases.tsv), Julia and Flix
identical):

| Case | Result |
|---|---|
| matchability, final print | 0 displays without a cubie-level matching |
| new DAG, all 91 displays | **ACCEPT 91 / 91**, print supply complete |
| PR #99 DAG, all 91 displays | 42 pass, 49 fail. These are the 34 changed displays plus the 15 broken PR #99 states; it shows the new states are needed |

### 2027 (the owner's worked example)

| Month | Display id | Type | State | HTM |
|---|---:|---|---|---:|
| Jan | 13 | F31 folded | global search from the PR #99 state | 3 |
| Feb | 14 | plain | PR #99 state kept | 0 |
| Mar | 15 | plain | kept | 0 |
| Apr | 16 | plain | kept | 0 |
| May | 17 | S31 folded | global search | 24 |
| Jun | 18 | plain | kept | 0 |
| Jul | 19 | plain | kept | 0 |
| Aug | 20 | plain, PR #99 state broken (surface 35) | global search | 14 |
| Sep | 21 | plain | kept | 0 |
| Oct | 22 | F31 folded, letters moved | orbit solve (global search stalled) | 57 |
| Nov | 23 | letters moved | global search | 17 |
| Dec | 24 | letters moved | global search | 18 |

Month sheets: [displays-2027.tsv](evidence/displays-2027.tsv) (rows 1 to 7,
cell = text and ink; descriptive listing from [displays.jl](displays.jl)).

## Stage 3: the 2027 chain January to December

In progress: the chain search and the parametrized chain verifiers follow in the next commit.

## Negative controls

[negative_checks.sh](negative_checks.sh) runs nine controls; results are in
[results.tsv](evidence/negative-controls/results.tsv). Julia and Flix both exit
1 on all nine:

- the dark `24/31` surface blanked: supply fails, and the first S31 display
  fails at (7,2);
- the red `24/31` surface turned a quarter: supply fails, and a display fails
  as not upright;
- a cubie id changed in the print: rejected by the shared PR #99 print reader
  (`piece ID/home mismatch`), not by the new identity assertion;
- **midge redesign undone** (surfaces 35 and 70 back to the stage-1 print):
  some displays fail;
- the same undone print under `matchability`: display 72 has no cubie-level
  matching;
- January 2027's root put back on its PR #99 root;
- the first appended product inverted;
- a target id 0;
- a duplicate target.

## Provenance and common-mode risks

- [stacked_common.jl](stacked_common.jl) and
  [flix/src/Stacked.flix](flix/src/Stacked.flix) are clean copies from PR #145
  (`research/calendar7-stacked-dual-labels` at `50fa8b2`). Source SHA-256:
  - `dual-stacked/stacked_common.jl`:
    `1acefbd32b1e56221f3b84c1a17e0e7820228bab84fb53edee0e9e9051785312`;
  - `dual-stacked/flix/src/Main.flix`:
    `4187ee5683c1049232813219ebc5d6aa8c1b7fda5acda532722e5cc11dea31b2`
    (`main` removed, provenance header added).
- (Next commit) [flix/src/Chain.flix](flix/src/Chain.flix) copies the chain parser and step
  replay of `../continuous/flix/src/Main.flix` (base `7eaebaf`).
- [pure_chain.jl](pure_chain.jl) copies `turn_vector` and `direct_move` from
  `../practical/verify.jl`, and `read_chain` and `chain_metrics` from
  `../continuous/verify.jl`.
- The Flix checkers are structural ports of the Julia ones (print supply, front
  rule, matchability, chain replay), so a wrong definition would be shared.
  Geometry, calendar, optics, print reader and DAG replay come from the
  separately written PR #99 Julia and Flix modules.
- The designer, midge redesign, synthesizer, orbit solve and chain generator
  are Julia-only candidate tools. Only the checkers decide.

## Reproduce

```sh
research/calendar-7x7/pure-split-states/flix/build.sh
JULIA_BIN=julia research/calendar-7x7/pure-split-states/run_checks.sh /tmp/cubistry-calendar7-pure-flix/artifact/flix.jar "$work/run"
JULIA_BIN=julia research/calendar-7x7/pure-split-states/negative_checks.sh /tmp/cubistry-calendar7-pure-flix/artifact/flix.jar "$work/neg"
```
