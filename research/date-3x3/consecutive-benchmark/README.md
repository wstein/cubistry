# Consecutive physical calendar benchmark

This implements the measurement scope in [Cubistry issue 66](https://github.com/wstein/cubistry/issues/66).
Evidence and solver output stay on `research/cube-display-feasibility`. Application
implementation remains in its feature branches.

## Scope and invariants

Each provider uses the actual `CalendarController` and retains its own complete
54-sticker pose throughout a series. Setup is canonical **only at the beginning**.
The legacy provider follows inverse setup plus new setup. The direct provider
uses the pinned browser planner with six attempts and a 500 ms soft search budget.
Comparisons use identical requested dates, while allowing providers to reach
different legal hidden-center poses. A canonical reset between requests would
measure a different experiment.

For each of German A, English 3 with a leading zero, and English 3 without one:

- Advance 366 times from January 1, 2024, then decrement 366 times, carrying the
  reached state through the reversal and the leap-year boundary.
- Perform fourteen fixed date jumps, including Gregorian leap-century boundaries
  and the supported years 0001 and 9999.
- Run twenty groups that replace the active date during its first turn. Exactly
  that one obsolete turn commits, followed by a solution to the latest date.
- Run twenty groups that replace a target during planning; no stale turn commits.

There are 4,716 request groups for the two built-in providers. Every group records
all committed HTM, QTM and explicit whole-cube rotations, including an abandoned
one-turn prefix. The final-plan counter is recorded separately. Initial source
printing and streamed words, rather than repeated cumulative source words, keep
the evidence bounded. From/to hashes cover every sticker identity, body, position,
normal, printed up direction and image.

The separate Python verifier uses the historical Rodrigues engine, not JavaScript
solver geometry. It checks the exact Gregorian request sequence, source print,
continuous full poses, upright nonblank glyphs including the visible center,
inverse restoration, interruption boundaries, reference lengths, baseline costs,
move accounting and recomputed summary statistics.

## Run and reproduce

Use Node 24+, Python 3 and an installed implementation checkout. Outputs must be
new paths: the runner refuses to overwrite any existing report or sidecar.

```sh
node research/date-3x3/consecutive-benchmark/run.mjs \
  --app-root /path/to/cubistry-checkout \
  --output /path/to/NEW-capture.json
python3 research/date-3x3/consecutive-benchmark/verify.py /path/to/NEW-capture.json
```

For a quick smoke run, add `--days 3 --interruption-groups 2`. The full default
uses `--days 366 --interruption-groups 20 --max-ms 600000`. The elapsed budget is
checked between request groups; controller waiting has a separate 60-second limit.
For a hard process deadline, run through a process supervisor. An incomplete run
is saved with `complete: false`, an explicit reason and exit code 2; it remains
**UNKNOWN**, never a complete measurement or impossibility result.

The runner writes `.manifest.json`, `.summary.csv` and `.summary.md` sidecars.
It records source/lockfile/script hashes, application commit and tracked dirty
status, solver settings/version and basic CPU/Node information. Use a clean frozen
checkout for final evidence. The solver exposes no configurable random seed, so
saved move words are authoritative; fresh timing and paths may vary.

## Optional center-aware provider

Append `--provider /path/to/provider.mjs --provider-name center-aware`. The module
For explicit bounded options, add `--provider-options '{"threshold":14,"maximumNodes":100000}'`. The module
exports `async createPlanner({design, appRoot, options})`, returning an async
`CalendarPlanningContext => string` function. The context includes the immutable
design, actual `from` state, legal source reference, requested target and verified
fallback word. Export `metadata`, or attach `planner.metadata`, with package
version, source revision/hash and bounded solver parameters. The module hash alone
is insufficient to pin transitive provider code. Root issue 67 tracks integration.

A provider may attach `planner.dispose()`; the runner calls and awaits it after every
series, including failures, to release owned workers and caches.

All providers are subject to the controller's physical validation. A failed,
invalid or non-improving proposal retains the legal fallback. Fallback rate can
therefore include an already equally short reference; it is not an error rate.
Provider diagnostics and explicit thrown errors are retained separately.

## Interpretation

Node elapsed times include planning and immediate verified move commits; they do
not measure browser animation, rendering, network startup or a hard browser
worker deadline. Provider construction is measured separately. Mean/median/p95/max
move and elapsed counts describe the captured sequences and machine, not shortest
paths or a universal 20/21-move bound. All optical and physical print assignments
remain unchanged. Independent agent review is required before certifying results.
