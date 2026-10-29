# Bounded center-search portfolio comparison

This versioned follow-up preserves the earlier
[7,074-group evidence](../consecutive-benchmark/COMPARISON.md) unchanged. It compares
`baseline-center` (the existing center-aware policy with `policy:"default"`) and
`portfolio` (`policy:"portfolio"`) on the same controller/reference policy and
immutable printing. Both keep their own actual physical pose through the entire
stream; later hidden poses may differ. These are measured stream comparisons,
not claims that independent calls always produce identical first candidates.

The portfolio first keeps its checked default proposal, then permits one bounded
improvement search with an outer-face HTM cap of at most 18. Each attempt has a
100,000-node ceiling; maximum total ceiling is explicitly 200,000. Half turns count
once in HTM. Whole-cube xyz rotations are not outer face turns, but every xyz move
is retained, counted and replayed physically. The hard browser worker deadline is
an implementation concern, not measured by this immediate-port Node benchmark.

`run.mjs` is a versioned adaptation of the previous benchmark harness, with explicit
baseline options and two independent domains:

- `--domain calendar` (default): 366 increments and 366 decrements in 2024, fourteen
  deterministic jumps, twenty move-interruption and twenty planning-interruption
  groups per print/provider: **4,716 groups** for the two policies and three prints.
- `--domain regressions`: canonical 2026-11-03 → 04, actual chained Nov 02 → 03 → 04,
  and Oct 29 → Nov 03 → 04 (a deliberate free jump). All three prints, both policies:
  **30 groups**. Initial canonical setup occurs only once per path.

Example after freezing the application/provider source (replace paths/revisions
with those recorded in the final capture manifest):

```sh
node research/date-3x3/portfolio-benchmark/run.mjs \
  --app-root /workspace/cubistry-calendar-portfolio \
  --output /tmp/NEW-portfolio-calendar.json \
  --baseline-provider /workspace/cubistry-calendar-portfolio/src/apps/calendar/center-planner.mjs \
  --baseline-options '{"policy":"default","threshold":14,"maximumNodes":100000,"maximumDepth":24}' \
  --provider /workspace/cubistry-calendar-portfolio/src/apps/calendar/center-planner.mjs \
  --provider-name portfolio \
  --provider-options '{"policy":"portfolio","threshold":14,"maximumNodes":100000,"maximumDepth":24}' \
  --days 366 --interruption-groups 20 --max-ms 1200000
python3 research/date-3x3/portfolio-benchmark/verify.py /tmp/NEW-portfolio-calendar.json
python3 research/date-3x3/portfolio-benchmark/test_verify.py /tmp/NEW-portfolio-calendar.json
python3 research/date-3x3/portfolio-benchmark/analyze.py /tmp/NEW-portfolio-calendar.json
```

Use a new output filename for each run; evidence is never overwritten. The manifest
pins application and transitive provider revisions/options, source hashes, actual
cold/warm timings and machine limits. See the earlier harness README for capture
schema and reference-replacement semantics. This fork adds per-attempt candidate
replay, outer HTM/xyz counts and explicit budget checks. The independent Python
Rodrigues checker uses no JavaScript planner/controller geometry. It checks every
candidate from its actual source, target display and full 54-frame inverse, plus
that the chosen result does not lose its own checked first proposal. A new solution
can reach a different valid hidden pose; displaying the target alone does not
establish equality with another candidate's hidden stickers.

Node elapsed times include planning and immediate verified commits; they exclude
rendering/animation/network. Lazy first-request tables are included in that request;
subsequent calls may use warm process-global caches. Source words, returned candidate
words and measured diagnostics are authoritative. Unknown search results are retained
separately from errors, cancellation, direct retention and legacy fallback. Neither
an unknown search nor a long route establishes impossibility or optimality. No
universal 18/20/21-move bound is claimed.

`probe-contexts.mjs APP_ROOT NEW.json` tests all eighteen historical same-source
contexts (six per print), using each stored direct proposal. `verify-contexts.py`
replays all candidate words and inverses independently and checks the portfolio's
first result equals the old policy at that identical source. `test-contexts.py`
adds eight corruption controls, including negative, boolean and fractional attempt depths. The exact fixture bytes are preserved in
`investigation/portfolio-contexts.json` (SHA256
`c8fd5d9601f931b8896db54709b729fff22599936c8a3d1f8ef57289fe568812`).
These targeted same-source probes complement, and do not replace, independently
chained year and November-path measurements.

V2 metadata policy `default-then-shorter-cap18-v2` executes the second native call
only when its effective depth is strictly smaller. `verify.py` checks that rule and
requires explicit skip diagnostics. `compare-versions.py V1.json V2.json` reports
measured word/endpoint identity, timing and duplicate-native-call counts without
claiming universal speed gains. V1 captures are immutable; V2 capture filenames
include `-v2`. See [V2 findings](RESULTS-V2.md).

[Post-repair V3 findings](RESULTS-V3.md) retain a fresh continuous capture at
repair table version 2 with the V2 search policy unchanged. The earlier 41-HTM
maximum remains historical; use the V3 report for the newly observed maximum.
