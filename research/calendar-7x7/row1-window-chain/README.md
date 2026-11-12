<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Month-name window: legal retained-state chain

The fixed whole-cubie printing from [the print experiment](../row1-window-print/README.md)
has a legal chain for May 2026 through January 2028: 21 states and 20 adjacent
month changes. All words start from the retained preceding state. May 2026 is
the identity pose of this new printing. No independent root words are joined.

The witness has 7338 HTM, 7514 QTM, 368 stored rotations and 376 rotation QTM.
It is not optimized. The words use the existing legal generators 1 through 21,
with exponents -1, 1 or 2; no middle-slice generator is introduced. Reverse
playback uses the reversed inverse word. Each edge and the complete chain
restore all 294 surfaces when reversed.

Julia and Flix replay the raw words independently, compare a direct action on
294 printed surfaces with an action on 264 oriented piece poses, and check all
21 complete snapshots, artwork, ink, orientation, chronological adjacency,
source/end hashes and all four move metrics. The print is immutable, including
hidden faces. Their receipts are byte-identical. A separate adaptation of the
existing independent `verify_chain.jl` also accepts all 20 edges and inverses;
that third replay checks HTM and hashes, while the first two check all metrics.
Its geometry, calendar construction and optics do not call the producer.
Silent self-checks of its band and blank optics reject a quarter-turned band, a
blank tile read as band and a band read as blank.

The profile keeps the bottom line on every empty row-one band tile upright.
Plain empty date tiles remain distinct. O is upright and differs from 0;
only 0 and the pair 6/9 have the inherited neutral rotations. Proper body
rotations preserve the permanent placement and up vectors of all printed faces.

## Reproduction

Build with `CALENDAR7_CHAIN_FLIX_BUILD_DIR=<unique scratch build directory>
bash flix/build.sh`. The wrapper writes `<build>/artifact/<build-name>.jar`.
Then run:

```sh
bash run_checks.sh JULIA JAVA CHAIN_JAR UNIQUE_SCRATCH_DIRECTORY --mutations
```

The default without `--mutations` runs the three positive replays. The opt-in
suite corrupts adjacency, each metric type, hashes, legal moves, canonical
encoding and full snapshots; both primary native checkers must reject each
case. `generate.jl OUT` is an untrusted candidate producer, reusing the existing
bounded orbit solver with a private in-memory band profile. Run it under an
external 290-second timeout and verify its output independently. It stops
starting new targets after 240 seconds. No frozen solver or proof is edited.

## Window end after January 2028

The window end is a parameter: `WINDOW_END=YYYY-MM` (default `2028-01`) for `check.jl`,
`verify_chain.jl`, `generate.jl` and `run_checks.sh`, and the optional arguments
`WINDOW_END PRINT_SHA256` of the Flix checker. The 21-month defaults and the stored evidence are
unchanged byte for byte. A longer window needs the SHA-256 of its print in `CAL7_WINDOW_PRINT_SHA`
(`run_checks.sh` also takes `PRINT_OVERRIDE`, `CHAIN_OVERRIDE`, `STATES_OVERRIDE`). Julia and Flix
chain checkers assert that the window end equals the year and month of the last chain edge
(`verify_chain.jl` asserts the final month). The Flix print checker in `../row1-window-print` is
fixed at 21 months and its messages say 21; the Julia print checker follows the window end.

Seam. The chain stays one chain when the stored chain is extended from its end state with the
stored print: `SEAM_CHAIN=evidence/moves.tsv SEAM_STATES=evidence/states WINDOW_END=2028-03 julia
generate.jl OUT`. The generator replays the stored words, checks the end digest, copies the stored
rows and snapshots verbatim and continues. `check_seam.jl` (run by `run_checks.sh` with
`SEAM_STORED=1`) checks the byte-identical prefix, the unchanged snapshots and that the first new
edge starts at the stored end digest. `test_seam.jl` extends to 2028-02 and breaks the seam three
ways. The same join point is meant for a later backward extension.

Result with the stored print and the stored states: 2028-02 and 2028-03 have a legal chain (SAT:
Julia and Flix receipts byte-identical, independent replay accepts; HTM 7338, then 7781, then
8057). Julia matchers find no whole-body front matching for the stored print from 2028-04 (a second
independent Julia matcher agrees); that is UNKNOWN, with no Flix confirmation. The generator
reports 2028-04 as UNKNOWN (search stalled).

Decision: the way forward is a new print with a whole recomputed chain; the stored months then
change, because a new print has a new identity root. `evidence/extended-window.tsv` lists the
recomputations per window end. Only the chosen end 2029-12 (44 months, HTM 15305) has a committed
witness, in `evidence/window-2029-12/` (print, front matches, solver log, chain, 44 states). The
other SAT rows are exploration rows without a committed witness; they are not reproducible from the
repository. Re-check the witness:

```sh
WINDOW_END=2029-12 CAL7_WINDOW_PRINT_SHA=$(sha256sum evidence/window-2029-12/printing.tsv | cut -d' ' -f1) \
PRINT_OVERRIDE=$PWD/evidence/window-2029-12/printing.tsv CHAIN_OVERRIDE=$PWD/evidence/window-2029-12/moves.tsv \
STATES_OVERRIDE=$PWD/evidence/window-2029-12/states bash run_checks.sh JULIA JAVA CHAIN_JAR SCRATCH_DIR
```

## Explicit month list instead of a window end

`CAL7_WINDOW_MONTHS=<file>` with `CAL7_WINDOW_MONTHS_SHA256=<hex>` (Flix: `months MONTHS_FILE MONTHS_SHA256 PRINT_SHA256`) replaces `WINDOW_END`
in `check.jl`, `verify_chain.jl`, the Flix chain jar and `run_checks.sh`. The list is strictly increasing (1900-01 .. 2100-01); edge i must carry the month of member i+1; an edge across skipped calendar months is a bridge edge
(`BRIDGE` on the receipt line). The root month (`CAL7_ROOT_MONTH`, the month the identity pose shows) is separate from the first member; a different root adds a root edge (`ROOTEDGE`).
Chain format v2 adds per-edge wrong cells with Hall witnesses (best-effort months); v3 adds a free start state (`start` block) for stages, and `CAL7_JOIN_START` / `CAL7_JOIN_END` pin the start and end digest of a stage
(Flix: arguments after the root month). Format, root rule, stages, best-effort rule, coverage and receipts: [evidence/month-list/README.md](evidence/month-list/README.md).
Tests: `test_month_list.jl`, `run_month_list_checks.sh` (two positives, a bridge chain and a chain starting at 2037-05, and 15 negatives; Julia, Flix and the independent verifier),
`test_month_coverage.jl`, `test_best_effort.jl`, `test_stage_coverage.jl`, `run_root_best_effort_checks.sh` (root, best-effort and stage fixtures, three checkers). `generate.jl` and `beam_edge.jl` take their targets from the same goals and were not changed or run for a list.

## Beam pilot: Nov 2026 to Dec 2026

The stored edge into December 2026 (greedy orbit solver) has 271 HTM and 276 QTM. `beam_edge.jl`
re-solves this one edge from the stored November 2026 state with the global macro beam (`../global-search/search.jl`
library, `../upright-beam/beam2.jl` core weight, orbit catalogs and exact last mile). The result,
`evidence/beam-pilot-2026-12/`, is the stored chain up to November 2026 byte for byte plus the new
December edge: 61 HTM, 71 QTM (`library=L5 width=40 lambda=3`, 4 threads, 38 s including the library
build; deterministic on rerun). `runs.tsv` lists the runs of every knob tried. Julia `check.jl`,
Flix and the independent `verify_chain.jl` accept it for `WINDOW_END=2026-12`; Julia and Flix receipts are
byte-identical. The new December state differs from the stored one off the front, so a later edge must
be re-solved from it (done for Jan to Jun 2027 in the next section). Candidate tooling, not a stored witness replacement;
independent review is pending.

```sh
julia --threads=4 beam_edge.jl OUT evidence/window-2029-12/printing.tsv evidence/window-2029-12/moves.tsv \
  evidence/window-2029-12/states 2026 12 mode=beam library=L5 width=40
```

`mode=greedy` reproduces the stored 271 HTM edge. `test_beam_edge.jl` bounds the pilot edge at 130 HTM and
checks the prefix, every front and the digests.


## Beam chain: Nov 2026 to Jun 2027 (demo)

Demo and pilot on the print `window-2029-12`, which is not the final print. The owner decided on the final print
(Print B/C, root Jan 1980) and a full chain; see the research PRs (#408, #411, #413, #414) and their notes.

- Stays valid when the print changes: `beam_edge.jl`, the chaining change, the settings (L5, lambda 3, width 40 and
  80) and the order of magnitude of 95 to 130 HTM per edge.
- Does not stay valid: moves, states, hashes and receipts; every edge is re-solved on the new print.

The pilot chain continued by six edges, each re-solved by `beam_edge.jl` from the state the previous beam edge
ended in (`evidence/beam-chain-2026-06/`: the stored chain up to Nov 2026 byte for byte, the pilot Dec 2026 edge,
then Jan to Jun 2027; 14 states). The states differ from the stored greedy chain off the front, so no stored
edge after Dec 2026 applies. Candidate tooling; independent review is pending.

| Edge into | HTM | QTM | rot | block moves (1) | seconds (2) | stored greedy HTM / QTM |
|---|---|---|---|---|---|---|
| Dec 2026 (pilot) | 61 | 71 | 1 | 53 | 38 | 271 / 276 |
| Jan 2027 | 96 | 125 | 1 | 84 | 108 | 440 / 452 |
| Feb 2027 | 115 | 138 | 2 | 94 | 37 | 384 / 390 |
| Mar 2027 | 34 | 49 | 0 | 26 | 25 | 60 / 62 |
| Apr 2027 | 99 | 118 | 2 | 82 | 35 | 347 / 354 |
| May 2027 | 121 | 148 | 1 | 101 | 37 | 342 / 348 |
| Jun 2027 | 124 | 149 | 1 | 105 | 53 | 498 / 510 |
| sum / mean | 650 / 92.9 | 798 / 114.0 | | 545 / 77.9 | | 2342 / 334.6 |

HTM min 34 (Mar), max 124 (Jun); without Mar the mean is 102.7 (61 to 124). The six new edges: mean 98.2 HTM,
121.2 QTM. The beam chain has 28 percent of the stored greedy HTM. (1) Block moves from the reviewer's
independent simulator (same-axis runs, adjacent equal-angle layers merged, no middle layer), a proxy for the app's
count: 0.76 to 0.88 of HTM, 0.84 overall. (2) In-process time of `beam_edge.jl`, 4 threads, including the library
build; all below the 5-minute limit.

Setting `library=L5 lambda=3`, `width=40`; Jan 2027 uses `width=80` (96 instead of 137 HTM at width 40). `runs.tsv`
lists every run, including two other chains tried on the way (A: width 40 everywhere, 137 154 24 121 110 87, sum 633;
B: Jan 96, width 80 for Feb and Mar, width 40 after, 96 124 33 163 127 108, sum 651; committed chain C: sum 589) and
lambda=2 for Jan (125). The beam is deterministic for fixed inputs, but an edge depends on the state it starts from,
so the per-edge HTM moves by up to about 60 between chains (Apr 99, 121, 163; Feb 115, 124, 154) and the settings are
not tuned per edge. Whether the order of magnitude of 95 to 130 HTM per edge holds in a chain: in the committed
chain 5 of 7 edges are inside it, Dec and Mar are below, none above; in the other two chains 3 of 11 edges (A, and B after Jan) were above
(137, 154, 163). One chain of seven edges is a small sample, and the Mar edge (34) is unexplained: the stored greedy edge is also small (60).

`beam_edge.jl` change for chaining: if the edge is not in `CHAIN`, `CHAIN` is a candidate chain, every edge of it is
replayed and the new edge is appended (stored HTM prints as -1). The pass-through of states
(`STATES` is the state directory of the previous run) is unchanged.

```sh
# edge Jan 2027 from the pilot chain; each later edge takes the previous OUT as CHAIN (OUT/candidate.moves.tsv) and STATES (OUT)
julia --threads=4 beam_edge.jl OUT evidence/window-2029-12/printing.tsv evidence/beam-pilot-2026-12/moves.tsv \
  evidence/beam-pilot-2026-12/states 2027 1 mode=beam library=L5 width=80 lambda=3
```

Checks of the chain with `WINDOW_END=2027-06`: Julia `check.jl` SAT, Flix receipt byte-identical, `verify_chain.jl`
ACCEPT_CHAIN, negative cases of `run_checks.sh --mutations` (see the PR text for the numbers), the independent
simulator state match for all 7 edges, and `test_beam_chain.jl` (bounds per edge, greedy chain must fail).

### Relation to the Calendar7 app

Nothing in the app or the public data changes in this branch. The demo chain uses the print `window-2029-12`
(`evidence/window-2029-12/printing.tsv`, 44 months to Dec 2029, own identity root), and its nodes hash other state
texts than `public/calendar7/names/graph.v1.json` (stored print, 21 months), so it is not a drop-in for the app data.
The final print, the month list and the full chain are decided and tracked in the research PRs (#408, #411, #413,
#414) and their notes, not here. On this demo the app's block-move count is about 0.84 of HTM (proxy). Because every
later edge depends on the state before it, a change of an earlier edge forces a re-solve of all later edges.

## Long chain with month status (window_chain.jl)

`window_chain.jl OUT PRINT [key=value ...]` loops the beam edge of `beam_edge.jl` sequentially from the retained state over the
chain months, builds the macro library once per process and falls back to the greedy orbit solver when the beam finds no word.
The run contract is the one of the chain checkers and is read from the same environment; nothing is fixed to one print or root:

| Variable | Meaning |
| --- | --- |
| `CAL7_WINDOW_MONTHS`, `CAL7_WINDOW_MONTHS_SHA256` | month list S (one `YYYY-MM` per row, 1900-01 .. 2100-01, strictly increasing, LF, pinned by SHA-256); required |
| `CAL7_ROOT_MONTH` | month the identity pose of the print shows; default the first month of S. A root other than S[1] adds one root edge (`ROOTEDGE`) |
| `CAL7_WINDOW_PRINT_SHA` | SHA-256 of the print (checked by the producer when set, required by the checkers) |

The chain is the root month followed by S; an edge across skipped calendar months is a bridge edge (`BRIDGE`). Options:
`prior=DIR` continues `DIR/chain.moves.tsv` and `DIR/states` (replayed, end digest checked, rows copied verbatim) and carries
`DIR/edges.tsv` and `DIR/segments.tsv` forward; `claims=FILE` and `best_effort=FILE` (declared best-effort months, header
`month status wrong_cells evidence` as in the coverage tools) feed `months.tsv`; `start=`/`end=` bound the months of `months.tsv`
(default the chain range); `max_edges=N`; `library`, `width`, `lambda` and the other beam options. `GENERATE_DEADLINE_S` (default
3000) stops cleanly: no new edge when the slowest edge so far would not fit. Output: `chain.moves.tsv` (chain.v1), `states/`,
`edges.tsv` (cumulative; column `method` is `beam`, `finishN` or `greedy`), `segments.tsv` (one row per run: run id, research
commit, library, width, lambda, print and list SHA-256, root month, edge range; carried through resume), `months.tsv`,
`PROGRESS.txt` (incl. `greedy_edges`, `root_month`, `bridge_edges`, `best_effort_edges`). Exit 3 means no new edge.

Segments. A long chain runs as sequential segments of about one hour: edge-loop deadline 3000 s, workflow job limit 70 min
(`timeout 65m` around the producer), each segment continued from the verified artifact of the previous one with
`prior_run_id`. The verify job re-checks the whole cumulative chain after every segment; its duration is UNKNOWN (not measured for a
long chain) and its job limit stays at 345 min. A stopped segment is checked against the members of S up to its last edge (the
checkers require a list that ends at the last edge); the root month stays the run parameter.

Months and statuses. `months.tsv` has one row per month of the range: `valid` (an edge leads into the month, or it is the root; reasons
`root`, `root_edge`, `bridge_edge`, `chain_edge`), `unknown` with the reason `skipped_gap` (a month between chain months that is not in S),
`before_chain_root`, `after_month_list`, the stop reason of the segment (`deadline`, `max_edges`, `search_stalled`) or
`best_effort_month`, and the claimed statuses `unavailable_nomatch`, `unavailable_unsat`, `best_effort`, which need `confirmed=both`
(Julia and Flix) and are otherwise written as `unknown` with reason `claimed_<status>_<confirmed>`. Best-effort months are chain
members whose edge needs wrong cells and Hall witnesses (chain.v2); this producer writes chain.v1 only and stops before a declared
best-effort month (`best_effort_month`), so a chain through 2037-02 or 2043-02 is not produced here. The checkers accept such chains
(verdict `BEST_EFFORT` / `ACCEPT_BEST_EFFORT_CHAIN`) and the verify job expects that verdict when `PROGRESS.txt` says
`best_effort_edges` greater than 0.

A greedy edge has 300 to 400 HTM against about 100 for a beam edge; it is never silent: `months.tsv` has a `method` column, the verify
job prints the count and warns, and the workflow input `fail_on_greedy` (default true) fails the verify job after the verified
artifact is uploaded. The logic without the solver is tested by `test_window_chain.jl`; the workflow
`.github/workflows/window-chain.yml` (manual, produce job limit 70 min, verify job with the three checkers) runs it and is checked
statically by `tests/window-chain-workflow.test.mjs`.

Inputs of the workflow: `research_ref` (a commit on `research/cube-display-feasibility`; the prepare job rejects any other commit),
`months_path` and `months_sha256`, `root_month`, `print_path` and `print_sha256`, optional `best_effort_path`, `claims_path`, `start`,
`end`, `library`, `width`, `lambda`, `prior_run_id`, `fail_on_greedy`, `smoke_mode`. No default names a print, month list or root.
The old 2028-01 print pin only applies to the checkers' `WINDOW_END` mode; the list mode used here pins the print by
`CAL7_WINDOW_PRINT_SHA` for every window end.

### Print and months that exist

The identity pose of a print shows its root month: May 2026 for the committed 2037-01 print, so a chain on that print cannot start earlier; the root month is a run parameter (a print with root January 1980 is planned, see below). The print for window end
2037-01 is committed in [evidence/window-2037-01](evidence/window-2037-01/README.md) with Julia and Flix receipts (print matching of
129 months: SAT; corner lemma for the 130 targets up to 2037-02: UNSAT, both checkers, with the caveats of that README). No chain
for this print is committed. A greedy chain 2026-05 .. 2037-01 (129 months, 128 edges, 44342 HTM, about 346 per edge; Julia and Flix
receipts byte-identical, independent replay ACCEPT_CHAIN) exists only in scratch evidence of an earlier session; the beam chain is
what this workflow computes. Beam edges are verified for 3 edges here (smoke), the pilot has one.

| Months | Status for this print | Basis |
| --- | --- | --- |
| 2026-05 .. 2037-01 | print matching SAT (Julia, Flix); chain SAT in scratch (greedy), not committed | window-2037-01 README |
| 2026-01 .. 2026-04 | UNKNOWN | no print for a window that starts there is known; the ceiling claims are Julia-only scans |
| 2037-02 .. 2050-01 | UNSAT for every window that contains the 130 targets May 2026 .. Feb 2037 (containment argument of the window-2037-01 README) | corner-2037-02 receipts, Julia and Flix |

### Print B (owner decision 2026-11-11)

Print B is `printing-S2` ([window-skip](evidence/window-skip/README.md), PR #413) with the April tiles renamed `APR`, `IL` to `AP`, `RIL`
(label only: one sticker each, same bodies, same cubie assignment; the edge computation is unchanged). Files in
[evidence/print-b](evidence/print-b/README.md):

| Item | Path | SHA-256 |
| --- | --- | --- |
| Print B | `research/calendar-7x7/row1-window-chain/evidence/print-b/printing.tsv` | `5ac2e92e5b1d1d333006409bd29258adb3071a9bf6341b561a42b095b5e4e18c` |
| Layout (April = `AP`, `RIL`; same file as the 2037-01 layout) | `research/calendar-7x7/row1-window-chain/evidence/print-b/layout.tsv` | `e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a` |
| `printing-S2` (unchanged, `APR`, `IL`) | `evidence/window-skip/printing-S2.tsv` | `5808fcac697ffc600d87b60f39f459de47d2aac05b4b2bd5be86bae9b0f6edd3` |

All hashes are in `evidence/print-b/sha256.txt`. The checkers read the target text from the layout, so Print B runs with its own layout: `run_checks.sh` and the
`check.jl` default still pin `row1-revision/layout.tsv` (`APR`, `IL`) and the workflow has no layout input, so no chain run uses Print B yet. Receipts
(Julia and Flix byte-identical): print matching of the 286 months of `months-S2.tsv` (SAT, legal states UNKNOWN, chain NOT_RUN) and the corner-lemma lists
S2, S2-chain, 2026-02 and 2043-02. Layout hash and the April target hashes differ from the `printing-S2` receipts. Whether Print B is frozen is the
owner's decision; this change does not state it. No chain was computed for Print B.

Under the repository rule a month record `unavailable_unsat` needs both checkers; the claims file carries that evidence pointer.

### How to represent a month without a solution

Today the app takes the chain as contiguous: node k is month `first + k`, a month outside it is reported as "outside"
(`src/apps/calendar7/month-view.ts`, `public/calendar7/graph.v1.json` nodes carry hash, display, year, month), and the three chain
checkers require chronological adjacency of consecutive edges.

1. Sidecar month records (recommended). The chain stays contiguous and unchanged. `months.tsv` has one row per month of
   the requested range: `month status reason edge method evidence`; status is one of `valid`, `best_effort`, `unavailable_nomatch`,
   `unavailable_unsat`, `unknown`. `valid` means the chain has an edge into the month (or it is the root); `method` is the solver
   of that edge. An `unavailable_*` or `best_effort` status needs a certificate confirmed by Julia and Flix (a claims file row with `confirmed=both`);
   a claim confirmed by one checker is written as `unknown` with reason `claimed_<status>_<confirmed>`. Months the run did not reach
   say `deadline`, `search_stalled` or `max_edges`; months outside the chain say `before_chain_root`, `skipped_gap` or `after_month_list`. The UI
   reads the file next to the graph: a month with status other than `valid` shows the reason instead of a cube. No checker or app
   change. `months.tsv` is not verified by any checker: the checkers prove the chain only, a `valid` record is the producer's
   reading of the chain and an `unavailable_*` record points to its evidence.
2. Bridge edges inside the chain. The checkers accept a month list with interior gaps: the edge into the next member is a bridge edge
   (`BRIDGE`), so valid months on both sides connect directly and the skipped months are `skipped_gap` rows of `months.tsv`.
   `window_chain.jl` produces them. The app still reads the chain as contiguous: showing a gap month is an app change, not part of
   this PR.
3. Encode status in graph nodes (a node without hash). Mixes proof data with display data and breaks the strict month-order check;
   not recommended.

Recommendation: option 1, with option 2 for a print that has an interior gap. Cost of option 1: a second file to ship and to keep
consistent with the graph; the app change (read the file, show the reason) is separate.

Claims file (optional `claims=` option, `claims_path` of the workflow): TSV with header
`month status reason evidence confirmed` (`confirmed` is `both`, `julia_only` or `none`); a month may appear once, a duplicate fails;
a claim on a chain month is an error (the chain decides it).

### Starting the workflow

GitHub docs ("Manually running a workflow"): "To trigger the `workflow_dispatch` event, your workflow must be in the default
branch." To run on another branch the CLI takes `--ref`. The docs do not say whether the file may then exist only on that branch;
that case was not tried (no workflow may be started by the author): UNKNOWN. The route that follows the docs is the one of
`upright-chain.yml`: the workflow file lands on `main` (separate PR, only `.github/workflows/window-chain.yml`), and `research_ref`
names the commit SHA on `research/cube-display-feasibility` that holds `window_chain.jl`, the print and the checker files. A prior
run is continued only when it was started from `main`. The group `window-chain` runs one at a time; GitHub keeps one running and
one pending run per group and cancels an older pending run when a newer one is dispatched, so start the next run only after the
previous one finished.

### Planned (not in this change)

Open inputs (not decided here, so no defaults): the SHA-256 of Print C (root January 1980, PR #417) and the final month lists of the
stages. Each stage is its own run with its own list, root and print: 2026-01 .. 2050-01 (root 1980-01 gives a root edge), then
1980-01 .. 2026-01 backward to the root, 1950-01 .. 1980-01, 1900-01 .. 1950-01 and 2050-01 .. 2100-01. Not supported by the producer:
stages that start at a free state (chain.v3 `start` block) or join by digest (`CAL7_JOIN_START`, `CAL7_JOIN_END`), best-effort edges
(chain.v2: wrong cells and Hall witnesses), and a window-local layout such as the April tiles AP|RIL of Print B (`run_checks.sh` reads
`row1-revision/layout.tsv`). The coverage summary (`month_coverage.jl`) is not run by the verify job. The workflow was never run.

## Scope and limits

This is a window witness, not a print for every calendar shape. The separate
[corner-coupling certificate](../row1-corner-coupling/README.md) obstructs a
single permanent print for the full 91-display domain under this band profile.
That obstruction does not apply to this smaller witness. The new printing
uses its own data names; old prints, strict root words, pins and app assets
remain unchanged. No print-sheet generator, app export, workflow dispatch or
browser test is included. Independent review is still required.

See `experiment.json` for artifact hashes and `NOTICE.txt` for data attribution.
