# Independent calendar transition review

Reviewer: separate agent `calendar_optimizer_proof_review`, October 29, 2026.
The reviewer did not author or modify the planner, generator, or witness corpus.
Research worktree baseline: `fa842d2`; the optimizer files were uncommitted during
review and are identified by the exact hashes below.

## Verdict and frozen scope

**SAT** for all 15,414 saved V1 ordered transitions: each begins at the recorded
canonical full pose, reaches the next or previous Gregorian day's physical
front, retains all 54 immutable sticker frames, and reverses exactly. The corpus
represents 876,582 transitions across the Gregorian 400-year cycle and the three
selected formats: unchanged German A, English 3 with a leading zero, and English
3 without a leading zero. This is a pointwise canonical-start result, not a
complete proof about indefinitely chained runtime hidden-center orientations.

**SAT** for the 36 separately tested latest-planner transitions: 12 fresh
canonical examples and 24 sequential actual-pose examples, including increments,
decrements, date jumps, leap-day/year boundaries, and intervening explicit x/y/z
rotations. Every resulting state passed the independent Rodrigues replay,
upright nonblank front check, immutable-frame inverse restoration, and exact
HTM/QTM/whole-cube count checks. No source print was changed.

**UNKNOWN** for shortest paths, a universal twenty-move bound, a universal
forty-move bound, or all possible actual runtime poses. No claim of optimality
is cleared by this review.

## Pinned implementations and actual validation

- V1 `planner-v1.mjs` SHA-256:
  `c71de1aa2426cf404c5166e6b785957368c0e0e60a5987370ff8618d09cb9a70`.
- Latest `planner.mjs` SHA-256:
  `518c38a0f3ab32dea39fed79b73b2d161c1d2a4bbe7a71536b1539272ce78776`.
- V1 witness SHA-256:
  `efd454d3510bf01359730084beaf9e8ce4f9f11839fbabb87daab5607f9cd6dc`.

The independent checker imports the preexisting standard-library Rodrigues
engine, not JavaScript planner geometry, KPattern, or the solver. Actual full
corpus invocation from the repository root:

```sh
python3 research/date-3x3/transition-optimization/verify.py research/date-3x3/transition-optimization/daily-witness-v1.json
```

Result: 15,414 unique transitions, 876,582 represented calendar transitions,
all immutable-frame inverse checks and visible nonblank upright frames passed;
3,637 unique cases remain over twenty moves.

The reviewer copied the latest prototype and its read-only inputs into an
isolated temporary directory, used `cubing@0.66.1` from the feature dependency
installation, and freshly executed `prototype.mjs`. The output was then replayed
with the independent Python engine. A separate chained-pose runner retained the
actual returned full state and legal source reference for eight successive
requests per format, rather than reconstructing canonical starts between them.

Reproduction scripts, 36 captured routes, results, and input/output hashes are
retained under [independent-review](independent-review/manifest.json). Run the
portable checker with `python3 research/date-3x3/transition-optimization/independent-review/replay.py`.
The latest-planner chained generator can be rerun with Node and the pinned
solver dependency; randomized new outputs need not be byte-identical.
Five independently exercised corruption controls rejected a wrong
source hash, missing target, illegal move token, wrong legal move sequence, and
dishonest move count.

## Results and implementation review

| Format | Date transition | Baseline HTM | Latest tested HTM |
| --- | --- | --- | --- |
| German A | October 28 to 29, 2026 | 79 | 19 |
| German A | July 11 to 12, 2026 | 36 | 18 |
| English 3, either padding | October 28 to 29, 2026 | 77 | 17 |
| English 3, either padding | July 11 to 12, 2026 | 75 | 16 |

The reverse canonical examples passed at the same lengths. These examples do
not characterize every later actual pose. The chained cases reached 43 moves:
center-orientation correction can add 18 or 20 face turns, and explicit
whole-cube orientation changes can add separate rotations. A generic optimal
ordinary-cube bound does not establish the same bound for oriented printed
centers. The V1 weighted averages are approximately 23.57/23.64 German and
20.57–20.81 English for increment/decrement; do not attribute the full V1 corpus
statistics to the separately modified latest planner.

Inspected relative transformation composition, physical cubie-to-KPattern
mapping, rigid normal/up frames, center-position alignment, visible-center
repair, forward/reverse solve inversion, and conjugated face maps. Candidate
words are validated against physical target glyphs and accepted only when
strictly shorter in total tokens, including whole-cube rotations. Hidden center
orientations are allowed to differ from the canonical target and remain in the
actual state.

No blocking research correctness finding remains in the tested scope. Runtime
integration must independently validate returned words against its authoritative
state, retain exact hidden frames, and provide a hard worker timeout and bounded
in-flight work. The planner's `timeBudgetMs` only checks between awaited solves;
it is a soft budget and cannot cancel a blocked solver. Browser worker
termination, UI fallback behavior, asset loading, and production-preview output
are outside this research clearance and need implementation/browser review.
