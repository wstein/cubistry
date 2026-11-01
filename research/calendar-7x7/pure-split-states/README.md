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
  letters went onto the PR #99 blanks 35, 134 and 135.
  - No unchanged-layout PR #99 state shows surface 134 or 135.
  - Surface 35 is shown by 13 of them.
  - `design_print.jl` ran with the 2027 displays protected (ids 13 to 24). It
    keeps the fewest unmatchable cells first, then the fewest broken protected
    states, then the fewest broken states in total. It put `C` on 35, which
    gave up those 13 states.
  - `redesign_midge.jl` then started from that print. It searched single
    artwork swaps inside the midge orbit with no protected list, minimizing
    unmatchable displays and then broken states.
  - Independent review (not checked by these checkers):
    - none of the 120 placements of `C`, `T`, `V` onto the six PR #99 midge
      blanks gives a full matching;
    - over placements plus one swap, with the 2027 displays protected first,
      the final print is optimal (1 broken 2027 display, 15 in total);
    - **without that protection, a fully matchable print that breaks only 10
      unchanged-layout states exists**: displays 6, 14, 15, 29, 37, 52, 55, 69,
      80, 89. It puts `C` on surface 36 and red 13 on surface 42. It breaks
      February and March 2027.
  - Prints with two or more swaps: UNKNOWN.
  - In the final print, surface 70 (not a blank: PR #99 dark `26`, now `C`) is
    also changed. It is shown by the states of displays 62 and 90.
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

[chain.jl](chain.jl) (untrusted) keeps one physical state from the stage-2
January 2027 root through December 2027. For each month edge it runs the
unchanged PR #130 global search under the final print and the pure-split
displays; if that stalls, it uses the planner's orbit solve. The chain is
[chain-2027.moves.tsv](evidence/chain-2027.moves.tsv), in the existing chain
format; the search log is [chain-2027-edges.tsv](evidence/chain-2027-edges.tsv).

**The chain verifiers were parametrized for this print and these displays,
in both languages:**

- [pure_chain.jl](pure_chain.jl) (Julia) and the Flix `chain` command run the
  same replay as `../continuous/verify.jl` and `../continuous/flix`:
  - one retained physical state;
  - chronological edges;
  - pose and direct 294-sticker replay must agree;
  - every front must match;
  - exact inverse restoration of each edge and of the whole chain.
- Only three things change:
  - the print is read from the file, with the PR #99 print SHA-pinned as the
    provenance base and identities unchanged;
  - the source-root check uses the pure-split displays;
  - every front is checked against the pure-split display under the strict
    stacked rule.

Both verifiers accept the chain with identical receipts
(`VALID_CONTINUOUS_CHAIN 11 218 294 49`; `chain-2027` in
[cases.tsv](evidence/receipts/cases.tsv)).

| Edge | Method | HTM |
|---|---|---:|
| Jan → Feb | orbit solve (global search stalled) | 443 |
| Feb → Mar | orbit solve | 62 |
| Mar → Apr | orbit solve | 422 |
| Apr → May | global search | 117 |
| May → Jun | global search | 120 |
| Jun → Jul | global search | 113 |
| Jul → Aug | global search | 98 |
| Aug → Sep | global search | 114 |
| Sep → Oct | orbit solve | 462 |
| Oct → Nov | orbit solve | 439 |
| Nov → Dec | global search | 68 |

In total the chain has **2458 HTM**. These are search results from one
deterministic heuristic run. They are not
optimal. This chain is not compared with the PR #99 chains here; section B
below compares different 12-edge chains (December 2026 to December 2027)
under the same search. The orbit-solve edges
(over 400 HTM) are much longer than the global-search edges, which shows how
weak the fallback is, not a property of the layout. No move savings are
claimed. The total must not be compared with the PR #130 35-edge chain average
(128.5 HTM per edge): the search effort and the fallback differ.

Chain controls (in [results.tsv](evidence/negative-controls/results.tsv)):

- Both parametrized verifiers reject:
  - one layer move changed with the same metrics (the edge front fails);
  - a changed declared HTM (metrics mismatch);
  - the stage-1 print (the source digest differs);
  - the same chain re-hashed under the stage-1 print by the control generator
    [rehash_chain.jl](rehash_chain.jl), so that every digest check passes. The
    **front rule** then rejects it at edge 4 (April → May), because the old
    midge artwork is visible.
- The **unchanged** PR #99 Julia chain verifier also rejects the chain, because
  its print and displays differ. That is why the parametrization is needed.

## Cost comparison with the PR #99 layout (owner request)

### A. Layout-level metric (no search; not a cost)

[compare/layout-metric.tsv](compare/layout-metric.tsv), from
[compare/layout_metric.jl](compare/layout_metric.jl), is a descriptive listing
and Julia only. For each of the 875 month transitions from 2027-01 to 2099-12,
it counts:

- **diff:** the front cells (rows 1 to 7, 49 cells) whose label or ink differs
  between consecutive displays;
- **moved:** the labels present on both displays but at different cells.

| Layout | diff mean | diff median | diff max | moved mean | moved median | moved max |
|---|---:|---:|---:|---:|---:|---:|
| PR #99 (wrap marks) | 34.97 | 36 | 41 | 12.42 | 13 | 21 |
| pure split, scheme A | 34.40 | 36 | 41 | 12.31 | 13 | 21 |

- **Per transition**, the pure split never has more differing cells than
  PR #99. It is equal on 516 transitions and lower by 1 or 2 on 359.
- **By month type (diff mean, PR #99 / pure):**

  | Month type | as source | as target |
  |---|---|---|
  | plain | 34.09 / 33.74 | 35.26 / 34.88 |
  | F31 | 38.14 / 37.14 | 33.28 / 32.39 |
  | S30 | 38.31 / 37.31 | 35.76 / 34.76 |
  | S31 | 38.16 / 36.16 | 33.45 / 31.66 |

- The biggest differences in favor of the pure split are 2 cells, at S31
  transitions such as 2027-04 → 2027-05. The fold removes the row-3 overflow
  cells.
- **What this cannot show:** the number of changed cells is not a move count.
  The cost depends on which pieces must move, on cubie coupling, on the print
  and on the search.

### B. Same-search comparison on the 12 transitions December 2026 → December 2027

[compare/compare_chain.jl](compare/compare_chain.jl) (untrusted) runs the
**unchanged PR #130 global search** with identical settings on both prints:

- **PR #99:** the PR #99 print, the PR #99 displays, and the PR #99 DAG.
- **Pure split:** the final print, the pure-split displays, and the stage-2
  DAG.
- **Same policy on both:**
  - start from the December 2026 root of each DAG;
  - each print carries its own physical state through the months;
  - the planner's orbit solve runs **only when the beam stalls** ("fb" below).
- **Default budget:** library L5, lambda 12, width 40, fanout 4, depth 60,
  patience 8, strict, W1 orbit weights, deterministic, no random seed.
- **Generous budget:** width 80 and patience 16, everything else the same.

All four chains are verified:

- the PR #99 chains by the **unchanged** continuous chain verifiers (Julia and
  Flix);
- the pure-split chains by the parametrized verifiers;
- in every case both languages give identical receipts
  (`VALID_CONTINUOUS_CHAIN 12`; [compare/evidence](compare/evidence)).

The HTM values are search results: not optimal.

| Edge | PR #99, default | pure, default | PR #99, generous | pure, generous | seconds default (PR #99 / pure) | seconds generous |
|---|---:|---:|---:|---:|---:|---:|
| 2026-12 → 2027-1 | 88 | 439 (fb) | 88 | 439 (fb) | 1521/1539 | 2767/2713 |
| 2027-1 → 2027-2 | 137 | 469 (fb) | 119 | 469 (fb) | 1244/1185 | 944/863 |
| 2027-2 → 2027-3 | 73 (fb) | 64 (fb) | 78 (fb) | 64 (fb) | 141/140 | 226/307 |
| 2027-3 → 2027-4 | 139 | 422 (fb) | 461 (fb) | 422 (fb) | 536/436 | 1492/1398 |
| 2027-4 → 2027-5 | 477 (fb) | 426 (fb) | 454 (fb) | 426 (fb) | 566/504 | 1302/1100 |
| 2027-5 → 2027-6 | 487 (fb) | 479 (fb) | 116 | 479 (fb) | 676/680 | 994/1084 |
| 2027-6 → 2027-7 | 340 (fb) | 95 | 448 (fb) | 98 | 650/611 | 1068/972 |
| 2027-7 → 2027-8 | 411 (fb) | 440 (fb) | 416 (fb) | 439 (fb) | 567/617 | 858/948 |
| 2027-8 → 2027-9 | 112 | 411 (fb) | 397 (fb) | 125 | 650/517 | 866/826 |
| 2027-9 → 2027-10 | 443 (fb) | 452 (fb) | 455 (fb) | 435 (fb) | 481/675 | 1145/1129 |
| 2027-10 → 2027-11 | 122 | 355 (fb) | 121 | 127 | 700/340 | 816/755 |
| 2027-11 → 2027-12 | 409 (fb) | 54 | 385 (fb) | 126 | 640/354 | 836/808 |

| Run | Total HTM | Mean | Median | Max | Fallbacks (of 12) | Mean of edges without fallback | Mean seconds per edge |
|---|---:|---:|---:|---:|---:|---:|---:|
| PR #99, default | 3238 | 269.8 | 239.5 | 487 | 7 | 119.6 | 698 |
| pure, default | 4106 | 342.2 | 424 | 479 | 10 | 74.5 | 633 |
| PR #99, generous | 3538 | 294.8 | 391 | 461 | 8 | 111.0 | 1109 |
| pure, generous | 3649 | 304.1 | 424 | 479 | 8 | 119.0 | 1075 |

The wall times were measured with four runs sharing four cores. (An earlier,
unlogged observation of single runs was about 400 seconds per edge; no evidence
file backs it.)

**Reading:**

- Every total is dominated by the orbit-solve fallback, mostly 340 to 490 HTM
  per fallback edge (range 64 to 490; the 2027-2 → 2027-3 fallback costs only
  64 to 78 HTM in all four chains). Edges the beam completes cost about 55 to 140 HTM on
  either print.
- At the default budget, the beam stalls on 10 of 12 pure-split edges against
  7 of 12 PR #99 edges, so the pure-split total is 27% higher.
- At the generous budget, both stall on 8 of 12 edges and the totals differ by
  3% (3649 vs 3538).
- The generous budget did not help the PR #99 print here: two edges that the
  default beam had solved now stalled.

**Verdict:** under equal search effort the pure split is **comparable, not
clearly worse**.

- The difference at the default budget is one search's stall count (three more
  fallbacks), not a measured layout cost.
- With the generous budget the two prints are within 3%.

**What this comparison cannot show:**

- The optimal or near-optimal cost of either layout.
- How each layout does with a refined producer. The PR #130 35-edge chain
  average of 128.5 HTM came from the hand-refined `producer-run.jl` on the
  PR #99 print, and it was not rerun here.
- The behavior on transitions outside 2027.
- No layout is claimed to be cheaper.

### C. Effort to extend the pure-split chain to 2027–2099 (estimate, not started)

- **Size:** 875 edges (January 2027 to December 2099), plus the December 2026
  → January 2027 edge if wanted.
- **Time:**
  - About 633 to 698 seconds per edge at the default budget, measured with
    four runs sharing four cores. Single runs may be faster (an unlogged
    earlier observation was about 400 seconds).
  - Sequentially that is **roughly 100 to 170 hours (4 to 7 days)** at the
    default budget. The generous budget took 1075 to 1109 seconds per edge,
    about 1.6 to 1.7 times as long.
- **Memory:** about 1.6 GB per search process (measured). Four parallel
  search processes fit in 15 GB. Four parallel Flix chain verifiers with
  `-Xmx6g` were OOM-killed on a 15 GB machine: run them one at a time or with a
  smaller heap.
- **Parallelism is limited.** A continuous chain carries one physical state, so
  edge k+1 cannot start before edge k ends.
  - **Parallel per-year segments** would each start from the DAG root of their
    January. Joining them needs a *full-state* edge from one segment's
    December state to the next January root. These tools solve front goals,
    not full states, so that option is UNKNOWN.
  - **What does parallelize:** several search configurations for the same
    edge, keeping the best verified word. That improves quality, not elapsed
    time.
- **Batching plan (resumable):**
  - one-year segments, run in sequence;
  - after each segment, export the cumulative chain from the January 2027 root
    and verify it with both parametrized chain verifiers (about 15 to 25
    seconds per 12 edges, so a full 875-edge verification takes minutes);
  - resume from the verified chain prefix by replay, as PR #130's `search.jl`
    already does with `PREFIX_EDGES`;
  - pin each verified segment's receipts.
- **Risks:**
  - On this sample, the orbit-solve fallback ran on 8 to 10 of 12 edges,
    mostly at 340 to 490 HTM each (range 64 to 490). The run means per edge
    (270 to 342 HTM) times 875 edges give roughly 236,000 to 300,000 HTM.
  - A better fallback, or a refined producer like PR #130's, is the main lever
    for move counts. Whether it helps the pure split is UNKNOWN.
  - A stall that the orbit solve also fails on would stop the chain. This did
    not happen in 2027; it is UNKNOWN for other years.
  - Long runs on a shared machine.

## UNKNOWN

- Chains for years other than 2027.
- A continuous chain over 2026 to 2099.
- Other cube sizes.
- Real sticker sizes and legibility.
- There is no pinned manifest; anything not covered by both checkers is
  UNKNOWN.

## Negative controls

[negative_checks.sh](negative_checks.sh) runs nine checker controls and five
chain controls (see stage 3); results are in
[results.tsv](evidence/negative-controls/results.tsv). Julia and Flix both exit
1 on all nine checker controls:

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
- [flix/src/Chain.flix](flix/src/Chain.flix) copies the chain parser and step
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
