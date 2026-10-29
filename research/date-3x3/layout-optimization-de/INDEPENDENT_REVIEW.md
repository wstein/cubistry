# Independent German A fixed-print research review

Reviewer used detached `/workspace/cubistry-de-layout-review`, initially at
`9eb3c5279949e956a7267907bb7305fdcc6b788f`, separate from the author checkout.
No application, print default, production solver, protected Research branch or
GitHub state was changed. The reviewer did not author the proposed layouts.

## Evidence actually rerun

- Ran `verify.py coverage` separately on all six saved witnesses: c0-e0, c1-e0,
  c2-e0, c0-e1, c0-e2 and c1-e1. Each passed all 2,562 Gregorian display tuples,
  actual legal witness replay, exact visible strings, all upright nonblank frames
  including centers, and complete inverse restoration (15,372 verified targets).
- Ran `verify.py` on `year-four-2024.json` and `year-combined-2024.json`:
  2,928 +732 =3,660 actual retained-pose transitions passed. All 54 frames, source
  reference replay, chained state equality without reversal reset, desired dates,
  exact endpoint hashes and inverse restoration passed. HTM and rotations were
  independently recounted from legal words.
- Ran the eight provided corrupted-capture controls: all rejected.
- Reran baseline equivalence against the clean pinned app's original de-a.json:
  immutable printing is identical and every one of 2,562 **complete target poses**
  agrees, including hidden stickers and center frames, rather than merely fronts.
  Runtime JSON SHA256 is
  `1f5ecf89f4127ac1dd27e662c51193ca7d24677ba49abbca2737e306dc9cef56`.
- Independently checked all source printing fields against baseline: id, cubie,
  p, n, up and slot are unchanged; only weekday glyphs in slots 0/1 differ.
  All 2,562 front strings agree across all six prints. Row/slot color roles and
  upright orientations are therefore preserved, not traded for move reductions.
- Independently built the 24 proper signed permutation rotations and checked the
  slot invariants on all 216 oriented sticker frames ×24 rotations. Independently
  enumerated the conditional corner allocation: 1,440 one-blank assignments with
  zero supporting all prefixes; 360 two-blank assignments, 216 supporting them,
  with exactly three unordered body pairings. This is a conditional physical
  allocation restriction under the stated grammar, not global layout optimality.
- Independently checked the 18 month/corner-position tokens and all 72 prefix ×
  month-token co-occurrences that justify disjoint weekday/month corner bodies.
- Independently replayed every recorded solver warmup and its inverse, and verified
  every first counted state equals its regenerated canonical target in full.
- Checked all stored HTM/rotation types and bounds, finite nonnegative planning
  times, summary uniqueness/completeness and exact totals. All stored data pass.
  All diagnostics use the same policy limits: 100,000 nodes per attempt, 200,000
  total, at most two attempts, maximum depth24. The planner implementation is the
  same for all prints; this review replays retained evidence, not timing reruns.
- Verified capture runner SHA against actual measure.mjs, and app revision
  `3d4c179308b74b1242eaf17cafd4e1d70400b587` is clean. Runtime paths are identical
  to portfolio revision 1ef2ffc (the later change is tests only). Reran summary
  generation with no resulting tracked diff.

## Recomputed conclusion

| Print | Counted year edges | Total HTM | Mean HTM | Maximum | Versus baseline |
| --- | ---: | ---: | ---: | ---: | ---: |
| c0-e0 baseline | 732 | 14,167 | 19.3538 | 41 | — |
| c1-e0 | 732 | 13,903 | 18.9932 | 40 | −1.86% |
| c2-e0 | 732 | 13,866 | 18.9426 | 40 | −2.12% |
| c0-e1 | 732 | 14,481 | 19.7828 | 40 | +2.22% |
| c1-e1 | 732 | 14,804 | 20.2240 | 41 | +4.50% |

Each counted path has 142 explicit whole-cube rotation tokens, reported separately
from HTM. Initial setup and warmup are excluded consistently. These are measured
print/catalog packages with the same deterministic completion generator and bounded
planner policy. The baseline's regenerated full-pose equality removes a major
completion-generator confound; the comparison still does not prove globally
optimal sticker allocation, hidden completion or routes. Timing is shared-machine
wall time and excludes browser animation/deadline behavior.

The approximately 11.6% c1-e0 pilot improvement does not generalize to the year.
The final recommendation to keep the original physical print is well supported:
2.12% finite-path gain and maximum40 remain far from a short-turn guarantee. A
partial-goal/alternative-hidden-completion search on the unchanged print is a
reasonable future investigation, with no improvement claimed yet. Likewise,
replacing unused blank centers30/43 with fixed0/1 is only an old-goal-superset
argument; it is not a measured controller speedup and requires actual orientations
and candidate witnesses before adoption.

## Review-discovered validator gaps

Four reviewer-owned metadata corruptions were accepted by the original saved
capture validator: Boolean zero rotations, negative elapsedMs, removed summaries,
and tampered runnerSHA256. The reviewer separately confirmed the **actual retained
captures** have correct types, finite times, complete summaries and valid runner
provenance, so the numerical conclusions above are unaffected. Author was asked
for focused validation and negative-control hardening; final addendum follows.

Reproduction scripts and raw local results are retained in
`/tmp/cubistry-de-layout-independent/`: author-checks.json/log, baseline.json,
structure-independent.json, independent-metrics.json, path-starts-and-warmups.json,
negative-controls.json and the independent scripts. No external review comment,
Ready transition, merge or deployment was performed.

## Practical assessment (reviewer judgment)

| Decision | Rating | Basis and limit |
| --- | ---: | --- |
| Keep original German A print | 9/10 | Strong compatibility; best measured alternative gains only2.12% on one year. |
| Reprint to c2-e0 now | 3/10 | Physically feasible, but a small path-specific gain and maximum40 remain. |
| Investigate hidden completions on original print | 8/10 | Avoids manufacturing changes and attacks current full-goal restriction; speedup unmeasured. |
| Test fixed extra0/1 centers | 6/10 | Safe old-goal-superset hypothesis under fixed orientations; no witness or measured gain yet. |

Ratings express priorities under the retained evidence, not mathematical performance guarantees.

## Final hardening review and clearance

Reviewed final author commit `e8adf12d014c4ced84b5004b875b97fc95eae164` in the
same detached reviewer checkout. The change is limited to capture validation,
negative controls, their saved results and transparent research documentation.
No generator, captured measurement, candidate witness or application source changed.

The guard now rejects Boolean counts, negative/nonfinite durations, missing or
duplicate summaries, forged runner/app revision provenance and changed solver
budgets. Counts use exact integer types; times are finite and nonnegative; summary
variant coverage is exact; runner bytes and app revision are pinned; attempt/node/
depth limits are enforced. Actual HTM, rotations and November subsummary counts
are still recomputed from the captured routes.

Actually reran all sixteen author negative controls: all rejected. Independently
reran the four original reviewer-owned corruptions: all now rejected. Reran the
hardened validator on both pilot captures and both full-year captures: all passed,
including all3,660 year transitions. Stored data and published totals remain
unchanged. Initial mathematical/feasibility/baseline checks remain applicable because
their inputs and replay primitive did not change.

**Final clearance: no unresolved blocking finding for this bounded research.**
The numerical conclusions and conservative keep-original-print recommendation are
supported. Global print optimality, alternate hidden-completion gains, safe-center
controller improvements and repeated/arbitrary-source move guarantees remain
UNKNOWN as documented. Root may integrate the five focused research commits after
its own branch coordination; this review did not merge, deploy or change defaults.

Final evidence: `hardened-controls.json`, `hardened-captures.json`,
`independent-metrics.json` (four reviewer corruptions now REJECTED), plus retained
initial coverage/baseline/structural outputs and scripts in this report directory.
