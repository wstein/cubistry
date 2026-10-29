# Direct calendar transition optimization

The original browser calendar reconstructed each new date by reversing the full
current source-to-display word and then playing the full target word. This is a
legal baseline, but repeatedly visits an unrelated common source pose and can
require 40–85 moves. It is not a direct solution between displayed dates.

This experiment solves the relative cubie transformation from the **actual full
physical pose**, aligns fixed center positions with explicit whole-cube turns,
and repairs the visible printed center's orientation when required. Every
candidate is physically replayed and must use strictly fewer total tokens than
the baseline. The German A print and the selected English 3 print are unchanged:
German months still occupy three individual front stickers.

## Evidence status

- **SAT, V1:** [saved corpus](daily-witness-v1.json) and
  [independent review](INDEPENDENT_REVIEW.md) verify all 15,414 distinct ordered
  canonical-start daily transitions for German A and both English padding modes.
  These represent 876,582 transitions over the 400-year Gregorian cycle.
- **SAT, latest planner tested examples:** independently replayed 12 freshly
  generated canonical transitions and 24 chained actual-pose transitions,
  including explicit whole-cube rotations, date jumps, and leap-day/year
  boundaries. See [review manifest](independent-review/manifest.json).
- **UNKNOWN:** shortest routes, universal bounds of twenty or forty moves, and
  exhaustive coverage of arbitrary chained physical poses. The V1 corpus does
  not certify the modified latest implementation over its whole domain.

| Selected print | Canonical daily mean before | V1 daily mean after, increment / decrement |
| --- | --- | --- |
| German A | 67.02 | 23.57 / 23.64 |
| English 3, leading zero | 63.71 | 20.75 / 20.81 |
| English 3, blank tens | 63.99 | 20.57 / 20.70 |

V1 maximum is 43 moves and 3,637 unique cases remain over twenty moves. Full
statistics are retained in [statistics-v1.json](statistics-v1.json); these are
pointwise canonical starts, not an indefinitely repeated runtime average.

For October 28 to 29, 2026, fresh latest-planner examples use 19 moves instead
of 79 for German A, and 17 instead of 77 for English 3. Visible-center repair
can still add 18 or 20 face turns in other cases. No printed center is hidden,
retextured, or teleported to avoid this cost.

## Versions and reproducibility

[experiment-v1.json](experiment-v1.json) pins the V1 generator, corpus, solver
version, and input hashes. `planner-v1.mjs` and `benchmark-v1.mjs` are preserved
V1 artifacts. `planner.mjs` additionally tries bounded conjugated solver frames;
its exact reviewed hash and tested coverage are recorded in the independent
review. The saved full corpus belongs to V1, not this later variant.

From the repository root:

```sh
python3 research/date-3x3/transition-optimization/verify.py research/date-3x3/transition-optimization/daily-witness-v1.json
python3 research/date-3x3/transition-optimization/independent-review/replay.py
```

The first command replays all V1 cases using the independent Python Rodrigues
engine; the second replays the 36 latest-planner captured cases and rejects five
corruptions. Neither imports the JavaScript planner or solver geometry.

With `cubing@0.66.1` resolvable from the research directory, generate fresh
examples or a new corpus at a **new output path**:

```sh
node research/date-3x3/transition-optimization/prototype.mjs NEW_EXAMPLES.json
node research/date-3x3/transition-optimization/benchmark-v1.mjs NEW_V1_CORPUS.json
node research/date-3x3/transition-optimization/independent-review/generate-chained.mjs
```

The last command writes `independent-review/chained.json` and is provided only
for reproduction in a separate copy; preserve the reviewed evidence and hashes.
Solver results may vary. Never overwrite preserved certificates in place.

## Runtime integration boundary

The module injects KPattern, kpuzzle, the solver, and legal center corrections;
it contains no Node-only imports. `timeBudgetMs` is a **soft** budget checked
between solves. A browser adapter must impose a hard timeout, terminate stalled
worker computations, bound in-flight work, and validate the returned word
against the application's own full-state geometry. Solver failure must retain
the legal baseline and report fallback honestly. This research does not certify
browser worker behavior, startup loading, animation, or deployment.
