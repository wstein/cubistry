# Independent R3 Phase A implementation and proof review

Date: 2026-10-30. Reviewer: separate Codex agent, not an implementation author.
The final executable review used isolated snapshot
`a0a1fe2dddbd1e82746a0050ddb9ef4e6c99edd6`.

## Verdict and precise scope

**Scoped SAT for five saved, complete two-edge physical chains. All reported
implementation findings are closed; no unresolved blocker remains for this
research scope.** This clears the Phase A research checks, not production
integration, a general move bound, global optimality or owner merge acceptance.

Both unchanged native Julia and Flix checkers independently accepted every raw
input under `verification/`. They agree byte for byte on initial, intermediate
and final complete-state hashes and all five metric fields. Each chain retains
the actual full physical endpoint as the next source, with no hidden reset.

| Chain | Edge HTM | Edge layer QTM | Whole-cube rotation records |
|---|---|---|---|
| Jan → Feb → Mar 2026 | 358, 57 | 366, 58 | 1, 0 |
| Feb → Mar → Apr 2026 | 48, 409 | 50, 416 | 0, 2 |
| Nov → Dec 2026 → Jan 2027 | 446, 401 | 454, 412 | 2, 1 |
| Feb → Mar → Apr 2028 | 363, 361 | 368, 372 | 1, 2 |
| Supplemental midge recovery, Feb → Mar → Apr 2026 | 66, 432 | 68, 438 | 0, 2 |

The primary eight edge observations total 2,443 HTM, 2,496 layer QTM and nine
whole-cube rotation records. Minimum = 48, mean = 305.375, median = 362,
maximum = 446 HTM; nearest-rank p90 and p95 = 446. Each listed primary HTM
occurs once. The supplemental probe is excluded from those statistics.

These selected witnesses do not establish a 100–120 or 200-HTM bound. All-month
existence belongs to PR #99's fixed-profile result; neither R2 nor this review
establishes a continuously executable 887-edge calendar or practical setup.

## Independent execution

The reviewer inspected the driver and underlying code, then ran its complete
default path in a separate worktree with isolated outputs and a fresh Flix build:

```sh
JULIA_BIN=/tmp/julia-1.13.3/bin/julia \
CALENDAR7_MINIMAX_RESULTS_DIR=/tmp/calendar7-r3-final-review \
CALENDAR7_MINIMAX_FLIX_BUILD_DIR=/tmp/calendar7-r3-final-flix \
bash research/calendar-7x7/minimax/reproduce.sh
```

The command exited 0 with `PASS: five native chain agreements, nine shared
rejections`. Independently observed checks:

- All **318,631** Julia software assertions pass, including exact full-action
  algebra, actual HTM costs, cached inverses and fixed untargeted orbits at the
  production 60,000-attempt relaxation budget.
- Regeneration reproduces R2's four frozen raw words byte for byte.
- Corrected R3 and supplemental-probe outputs reproduce all five selected raw
  words byte for byte. No old proof artifact is rewritten.
- The unchanged native Flix checker builds from source. Its parser controls,
  21-generator physical tests and isolated sticker-up corruption test pass.
- Both independent native checkers accept all five complete raw chains. Their
  seven-line receipts match each other exactly and match the saved receipts.
- All nine common corruptions are rejected independently by both checkers.
  The reviewer inspected actual diagnostics: wrong grammar, retained source,
  chronology, metrics, physical hash or artwork fails at the intended check.
- Documentation spelling, offline relative links and `git diff --check` pass.

The reviewer also ran the unchanged descriptive-statistics command on the four
accepted primary raw chains:

```sh
/tmp/julia-1.13.3/bin/julia --startup-file=no research/calendar-7x7/continuous/statistics.jl research/calendar-7x7/minimax/verification/chain-{1,2,3,4}.moves.tsv
```

It reproduces the statistics above. Toolchains are Julia 1.13.3, Flix 0.79.0,
wrapper 0.34.9 and OpenJDK 21.0.12.1. No browser E2E, merge, deployment or
release was performed.

## What regeneration proves, and what it does not

The corrected bounded search does **not** newly discover all selected routes.
Case 3 reaches an UNKNOWN search-budget limit and exports its complete certified
checkpoint. Cases 1, 2 and 4 retain an endpoint-preserving checkpoint because
their new bounded candidates are no better. The supplemental 40,000-expansion
probe remains UNKNOWN at orbit 4 and likewise exports its certified incumbent.
A valid retained witness is not reported as a newly successful search.

The reproduction consumes those explicit immutable incumbent inputs. Physical
acceptance comes from replaying their complete raw words with both native
checkers, not from the planner's success messages or fallback label. Whole-cube
frame transport and same-axis cancellation must preserve the exact 264-point
action; native replay retains all 218 cubies and 294 sticker identities, normals,
up vectors and immutable artwork. Layer half turns cost one HTM and two QTM;
whole-cube rotations are counted separately. Central shorthand remains flattened
to the original legal alphabet and charged by its emitted layer moves.

In the independent final run, primary regeneration reported 274.56 seconds,
123.59 GB cumulative allocation and approximately 1.096 GB peak RSS. These are
observations from the final snapshot and shared host, not a controlled speed
comparison or memory bound. The earlier 82.53-second observation belongs to the
pre-tie-fix source; allocation must not be described as resident memory.
Budgets count beam expansions per orbit, excluding greedy scans and construction.

## Findings and closure

1. **Closed, first-seen endpoint loss:** `9abea16` replaces first-seen endpoint
   deduplication with componentwise nondominated trajectory labels. The labels
   preserve maximum, total and squared edge costs before the global beam cap.
   Tests cover a cheaper path arriving second and maximum/total tradeoffs.
2. **Closed, unsafe additive-cost pruning:** `9abea16` retains the actual
   normalized word context at every node and removes the invalid incumbent
   pruning rule. Equal physical endpoints with different word suffixes remain
   distinct labels. Fully legal regressions include a prefix above the incumbent
   that later cancels to a two-HTM result below a three-HTM incumbent.
3. **Closed, production-cache regression gap:** tests now replay the actual
   60,000-attempt relaxed representations, checking every recorded orbit action,
   inverse, untargeted orbit and HTM cost. The independent final run passes.
4. **Closed, incomplete export risk:** edge/word and edge/hash length mismatches
   fail before opening an output file. Regression tests preserve existing file
   bytes and avoid creating a new file on those mismatches.
5. **Closed, incomplete beam tie order:** `a0a1fe2` adds the exact normalized word
   to the final ranking key. The two ordering tests cover opposite insertion
   orders of otherwise tied labels; independent full regeneration passes.

`7f71dde` separately preserves whole verified incumbents and documents budget
semantics. Fallback never substitutes a source halfway through a raw chain.
The finite width, depth and expansion budgets still permit missed improvements;
the heuristic is not an optimality certificate.

## Provenance and authority

Only the new `minimax/` research folder differs from R2 commit
`c1619530e554e85622d8383636fbca4a248e1d3e`. The historical R3 `evidence/`
folder is unchanged from checkpoint `ca3b918`. R1, R2, PR #99's printing and
native validators, and PR #97's evidence remain unchanged.

| Input | SHA-256 |
|---|---|
| Immutable print | `b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931` |
| Raw legal source DAG | `ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24` |
| Primary chain 1 | `3394e630db10e8b6c9b1d9f166ea9eac9fe729a6aa5a7e98c1ce2b5788d7b653` |
| Primary chain 2 | `7dd5981ca947530d5ac796685180dbce12babcfda2c412a4009b92a4b461537d` |
| Primary chain 3 | `d72793f8df71d48195f02a5eea929206b03414c032a7580d256373c223f72861` |
| Primary chain 4 | `71060b20676211ed2a4619b0af13689c7650c7eae88e2c341739d4311876159c` |
| Corrected supplemental midge chain | `37bd95f71801096e87f483582b5bb2b69a2eaff37e2b44fba58888367a21f510` |

The unchanged Julia verifier hash is
`b6ae7ce58401a6c626b067823ea08f8d9d1607ee24dc45f065b15ae0f2654734`;
the unchanged Flix entrypoint hash is
`da5c357a4e1eb07f27a17c328fada0b85efa99c6b59c63a42a208601a67c3721`.
The [manifest](../experiment.json) and paired native receipts retain the exact
source and physical endpoint hashes.

The reviewer repeated the canonical **data-only** audit from immutable main
snapshot `48de7defa1e7e7a0a7744f5697874150d29a50ed`:
`python3 /tmp/calendar7-r3-review-corpus/proof-checkers/tools/audit_corpus.py`.
It returns `PASS_DATA_PINS`: 195 cases, 2,048 kernel rows, 36 generators and 801
chain values; canonical manifest SHA-256
`c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01`.
Python was not a proof authority. No native accept/reject, replay, metric or hash
dissent was observed. Research CLI diagnostics have no normalized rejection-class
contract; no canonical status-class equivalence is claimed.

## Remaining boundary

The 100–120 and 200-HTM objectives, general optimality, arbitrary retained-state
completeness, a full 887-edge chronological run and practical initialization
remain UNKNOWN. The printing proof uses its declared symbolic glyph-equivalence
profile, not a certificate for arbitrary production fonts. Runtime integration
and application behavior are NOT_CHECKED by this research review.

**PR #115 remains Draft for owner acceptance.** This report does not authorize
production promotion, merging, deployment or a release.
