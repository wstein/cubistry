# Calendar 3x3: a goal that only requires the visible front

Status: UNKNOWN until independent review. Research prototype; no app file changed.

## Result

Optimal outer-turn count (HTM, whole-cube rotations free and counted separately) when the goal is exactly the
controller's acceptance predicate `matches(state, target.cells)` instead of the full cubie state. Same 100 consecutive
+1-day steps per print from 2027-01-01 as the measurement of the current planner (app: real `CalendarController` with
`createPlanner`, 1M node policy). Format: min / median / p95 / max.

| print | app HTM | front goal, ACTUAL app pose | front goal, own pose carried | steps saved >= 3 moves | saved min / median / max |
|---|---|---|---|---|---|
| de-a | 14 / 18 / 24 / 30 | 6 / 9 / 9 / 10 | 6 / 9 / 9 / 11 | 100 of 100 | 5 / 9 / 22 |
| de-a-unpadded | 13 / 17 / 24 / 30 | 6 / 8 / 9 / 10 | 6 / 9 / 9 / 10 | 100 of 100 | 5 / 9 / 22 |
| en-3-zero | 12 / 16 / 18 / 24 | 5 / 7 / 9 / 10 | 5 / 7 / 8 / 10 | 100 of 100 | 5 / 9 / 15 |
| en-3-unpadded | 12 / 16 / 18 / 24 | 5 / 7 / 8 / 9 | 6 / 7 / 8 / 9 | 100 of 100 | 5 / 9 / 16 |

All 100 steps per print and variant were solved within depth 12 (0 unsolved). All 800 routes were verified with the
app's own move engine and `matches()` (`verify-routes.mjs`). The own-pose column is a different trajectory (the routes
differ, so the poses differ), so it is a second distribution, not a per-step comparison. Rotation tokens are not in
the HTM columns; with them (`results/summary.txt`, third table) the front goal is 7/9/11/12 (de-a, app pose) against
14/18/25/30. About half of the de-a front routes start with a rotation (47 and 49 of 100 steps for de-a and
de-a-unpadded, 3 to 7 of 100 for en-3), against 12 and 3 steps with a rotation in the app routes.

Search cost (Julia, one core, `nice -n 10`; `results/summary.txt`, second table): median 19 000 to
36 000 nodes, p95 112 000 to 423 000, max 3.9 million; median 2 to 5 ms, p95 9 to 47 ms, max 542 ms per step, plus
about 0.7 to 1.0 s to build the nine tables of a target (they depend on print and target, not on the pose).

## What the goal is (derived from the code)

`matches` in `src/apps/calendar/model.ts`: for the nine front positions `(x,y,1)` with normal `(0,0,1)`, the sticker
there must have `image === cells[i]`, and a non-blank image must have `up == (0,1,0)`. Consequences:

- Only images count. All stickers with the same image string are interchangeable, on any cubie (for example `O` has
  four stickers in `de-a`, `A` three). A blank cell accepts every blank sticker.
- There is no symmetry class: a letter turned by 180 degrees is not accepted, because `up` is compared with one vector.
  O/I/S/Z get no extra orientations.
- The front center sticker must show `cells[4]` upright. With outer turns only the centers never change place, so the
  center that is in front must already carry that image, or a whole-cube rotation must bring it there. The search
  therefore tries every rotation (24, minimum x/y/z word each, at most 2 tokens) that puts a center with the required
  image in front. That gives 1 candidate center in all prints and 2 for a blank center cell (`de-a-unpadded`: blank
  center stickers are two); each center has four rotations about the front axis, so 4 or 8 candidate rotations. The
  twist of the front center is tracked (absolute up direction, four values) and must be upright when the cell is not
  blank; hidden centers are free.
- Everything else is free: 4 corners, 8 edges (and the corner twist, edge flip, permutation parity of the free pieces).
- Whether a route needs rotation words is decided by the center candidates; rotations commute with outer turns up to
  relabeling the faces, so a rotation prefix loses nothing against rotations in the middle of a route.

Size of the goal set (`goalset-stats.jl`, `results/goalset-stats.tsv`, 27 sample targets per print): assignments of
distinct corner/edge cubies to the eight non-center front slots, min/median/p95/max: de-a and de-a-unpadded
2 / 2 / 4 / 4; en-3-zero 18 / 18 / 36 / 72; en-3-unpadded 18 / 36 / 36 / 72. Each assignment leaves 4 corners and 8
edges free: 4! * 8! / 2 * 3^3 * 2^7 = 1.67e9 completions, so the median goal set holds 3.3e9 (de-a) to 6.0e10
(en-3-unpadded) of the 4.3e19 cubie states. The current planner aims at one of them.

## Method

IDA* over the 18 outer turns (no same face twice in a row, opposite faces in fixed order), iterative deepening to
depth 12, one search per candidate rotation, depth-major so the first depth with a solution is the optimum, fewest
rotation tokens among equal depths. Heuristic: the maximum over nine pattern databases (`FrontGoal.jl`).

- A database tracks four cubies, each by the location digit (0..23) of one reference sticker, plus the absolute up
  direction of the front center: 24^4 * 4 = 1 327 104 entries, one byte each.
- Entries are the exact distance (BFS) to the nearest abstract goal. An abstract tuple is a goal if every front slot
  occupied by a tracked cubie shows an acceptable sticker, every other front slot can be filled by some untracked
  cubie with an acceptable sticker, and the center is upright (relaxed goal, so the heuristic is admissible and
  consistent).
- Tracked cubies are chosen per target by how strongly the cells require them (weight 1 / number of acceptable stickers
  per slot): corners 1-4, corners 5-8, edges 1-4, 5-8, 9-12, and four mixed groups. Sizes: 9 tables * 1.27 MiB = 11.4 MiB
  per target; the five move tables shared by all targets take 114 MiB (UInt32; replaceable by per-digit permutations).
- The tables depend on the print and the cells only. The pose enters only through the root indices, so one build serves
  all poses and both rotation candidates of a date.

Measured in Julia 1.13.3, one core: building the nine tables of one target 0.7 to 1.0 s (median); first target of a
process 1.8 s (includes the move tables); process peak 445 MiB (Julia runtime, move tables, tables).

Number of tables against search cost (`results/ablation-*.tsv`, first 30 steps, app pose; the tables are subsets of the nine):

| tables | size | en-3-zero nodes median / max | de-a nodes median / max |
|---|---|---|---|
| 9 | 11.4 MiB | 27 308 / 161 595 | 26 581 / 175 699 |
| 5 | 6.3 MiB | 42 731 / 242 183 | 70 263 / 600 196 |
| 4 | 5.1 MiB | 42 731 / 462 141 | 116 790 / 1 264 595 |
| 2 | 2.5 MiB | 133 745 / 1 226 866 | 288 738 / 3 217 704 |
| 1 (corners) | 1.3 MiB | 494 084 / 44 097 956 | 5 317 227 / 72 249 730 |

The root heuristic is 5 to 6 at the median where the optimum is 7 to 9: the gap of about 3 is where the nodes go.

## Verification and tests

- `test/runtests.jl` (1512 assertions, 43 s): the Julia predicate against the app's `matches()` on 504 cases (177
  positive, including a 12 move word that twists only the front center, which must be rejected; cases come from
  `export-predicate-cases.mjs`, expected values computed by the app); the acceptance tables against the real up vector
  produced by the engine for every slot/sticker pair reachable in three turns; known optima (a back turn costs 0 although
  the full-state optimum is 1, one front turn costs 1); the optimum against heuristic-free brute force on 40 scrambles of
  1 to 3 turns (exact reference, depth 3); free rotations against brute force; the same optimum with a weaker heuristic.
- `test/verify.test.mjs` (3 tests): the verifier accepts the recorded routes and rejects a tampered route and a wrong count.
- `run-mutations.sh`: each of five mutations makes the named test set fail: heuristic plus one (known optima, brute force,
  free rotations), relaxed sources made strict (brute force and four more), up direction ignored (predicate and acceptance
  tables), center up ignored (predicate), slot 9 dropped (predicate and acceptance tables). Output: all CAUGHT.
- Route verification: `verify-routes.mjs` replays every route with the app's `apply` and requires `matches` for the
  target the app finds for that date; the app-pose variant also compares the first 48 bits of a SHA-1 of the replayed pose with the pose the
  real controller had (`data/app-chain-*.tsv`, last column, decimal).

## Commands

```sh
# run from the repository root; JULIA and NODE are the interpreter paths; Node 24 and Julia 1.13
node research/calendar-3x3-front-goal/dump-app-chain.mjs de-a 2027-01-01 100 research/calendar-3x3-front-goal/data <scratchDir>
research/calendar-3x3-front-goal/run-all.sh <outDir>            # 8 runs, under 2 min each
node research/calendar-3x3-front-goal/verify-routes.mjs <outDir>/front-*.tsv
julia research/calendar-3x3-front-goal/summarize.jl <outDir>
julia research/calendar-3x3-front-goal/test/runtests.jl
research/calendar-3x3-front-goal/run-mutations.sh
node --test research/calendar-3x3-front-goal/test/verify.test.mjs
```

`research/calendar-3x3-front-goal/data/` holds the app's routes and a pose hash per step, `fixtures/` the prints,
27 targets per print and the predicate cases, `results/` the raw measurements of this report.

## Not verified

- Browser or WASM speed: nothing was run in a browser or worker; all numbers are Julia on one core, the app numbers are
  Node.
- Optimality is shown by the admissibility argument, brute force to depth 3 and equality under a weaker heuristic; not by
  an independent Flix or second implementation, and not by an exhaustive search at depth 7 to 9.
- The sample is 100 consecutive days per print, not all 2562 targets; worst cases elsewhere are unknown (the largest search
  here was 3.9 million nodes).
- Rotations: the metric is HTM with rotations free. Rotation tokens (at most 2) are reported but not optimized; physical
  cost of a rotation is not modeled. The rotation-prefix equivalence is argued, and every route was verified, but
  routes with rotations in the middle were not searched separately.
- Ties among equal-length routes are broken by fewest rotation tokens, then search order; the own-pose chain depends on
  that choice.
- `app_ms` in `data/app-chain-*.tsv` was measured on a loaded machine (median 77 to 481 ms, p95 about 2 s) and is not
  comparable with the earlier measurement.
- Slice moves, other print sets, and the `matches` variants of other apps are not covered.
- `lychee` was not available locally; relative links were checked by hand.
- The tests were written after a first draft of the search and before any measurement; the commits list them first.

## Recommendation

All values in this section marked "estimate" are estimates, not measurements.

A browser implementation looks realistic for the table size and probably for the time; the shipped-table route does not.

- Shipping tables does not work: the tables depend on the target, 2562 targets per print, 1.3 to 11.4 MiB each (3 to 29 GB
  per print).
- Build at start of planning (estimate): one table takes about 0.09 s natively (0.8 s for nine), so 2 to 5 tables take
  0.2 to 0.5 s; a JavaScript typed-array port is likely 2 to 5 times slower, so 0.4 to 2.5 s against the 8 s worker budget. The search
  runs about 10 million nodes per second in Julia; a port at one third of that handles the median (30 000 nodes) in
  milliseconds and the largest observed case (3.9 million nodes) in about 1 s (estimate).
- The 114 MiB move tables would be replaced by per-digit permutation tables (estimate: a few hundred kB, slower per node).
- Preparation can start for tomorrow's target while the cube is idle; the controller already prepares targets
  (`CalendarController.prepare`).

Step 2, options with cost estimates:

1. TypeScript port as an additional planner stage in the worker (about 3 to 5 days: port, tests with the cases above,
   worker integration, fallback to the current route kept, browser benchmark on phone-class hardware). Risk: table build
   time on slow devices; mitigated by 2 to 4 tables and prefetch.
2. The same as a WASM module built from the Julia design in Rust or similar (about 1 to 2 weeks); only worthwhile if the
   TypeScript port misses the budget.
3. Measure Cubacle target sets as an engine first (about 2 days; earlier report estimates `--any-orientation` and masks
   exist, but sticker-level identities are not expressible); this prototype is the reference for expected lengths.
4. No app change: keep the numbers as the target for a later decision. The saving (median 9 moves, minimum 5 in 400 steps)
   is the reference for that decision.

Open questions for the owner before step 2: whether rotation tokens may be traded against HTM (about half of the de-a
routes use one), and whether optimal routes are wanted or a bound with a time limit.

## Files

`FrontGoal.jl` (search), `run_steps.jl`, `run-all.sh`, `summarize.jl`, `ablation.jl`, `goalset-stats.jl` (Julia);
`lib.mjs`, `dump-app-chain.mjs`, `export-fixtures.mjs`, `export-predicate-cases.mjs`, `verify-routes.mjs` (Node glue and
verifier, importing `src/apps/calendar/*`); `run-mutations.sh`; `test/`; `data/`, `fixtures/`, `results/`.
