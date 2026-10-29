# Bounded portfolio findings

The reproducible comparison is scoped to the actual chained calendar paths, not a
universal move bound. The original baseline and earlier center-aware dataset remain
unchanged in `../consecutive-benchmark/`.

## November regression and same-source counterfactuals

Clean application `1ef2ffc64b9eeb2d8065de75021ff5e6053cfffc` includes runtime
`d150be1`; pinned PuzlWerk provider remains
`ffe513c43f5d622810b9a3c9aff2fac88163d0f0`. The new policy first retains its checked
default result, then tries one tighter outer-face depth bound (at most 18) with
another 100,000-node ceiling. Maximum total ceiling is explicitly 200,000 nodes.
This is extra bounded work, not a hidden increase to the old per-attempt budget.

The author independently replayed all 30 actual chained November regression groups
and inverses, plus their 30 saved portfolio candidates. The three paths are
2026-11-03 → 04, Nov 02 → 03 → 04, and Oct 29 → Nov 03 → 04 (the last includes a
free date jump). The final Nov 03 → 04 route is:

| Print | Existing policy HTM | Portfolio HTM | Paths checked |
| --- | ---: | ---: | ---: |
| German A | 24 | 18 | 3 |
| English 3, zero | 14 | 13 | 3 |
| English 3, unpadded | 14 | 13 | 3 |

A separate frozen historical-source fixture covers six actual hidden poses per
print: prior direct and prior center-aware paths, for each of the three source
histories. All eighteen same-source comparisons retained the exact old first
proposal and improved to the same 18/13/13 counts above. The independent Python
Rodrigues checker replayed 72 saved candidate words and full 54-frame inverses,
including hidden center orientations. Five author corruption controls were rejected.
These probes use stored direct proposals, avoiding nondeterministic soft-budget
variation in a freshly invoked ordinary solver. They establish the reported
same-source results, rather than treating different chained hidden poses as equal.

The [raw regression capture](captures/november-regressions.json),
[CSV](captures/november-regressions.summary.csv),
[historical probes](captures/historical-contexts.json) and separate author
verification files preserve exact words and timing measurements. The cold first
old-policy request was about 2.26 seconds (table initialization). Subsequent Nov
03 → 04 old-policy requests were roughly 20–72 ms; portfolio requests roughly
74–151 ms in this capture. Portfolio ran after the old policy in the same process,
with warm shared tables. These Node timings include immediate physical commits,
exclude browser animation and are affected by shared-machine load. The targeted
probe jobs briefly overlapped the baseline portion of the year capture; the
measurement does not claim isolated CPU conditions.

## Complete chained 2024 comparison

The complete [raw year/domain capture](captures/calendar-2024.json) contains **4,716
request groups**, 24 actual-pose streams, and took **462.20 seconds**. The author
Rodrigues replay passed all 4,716 inverses and 120 obsolete committed single turns,
plus 4,794 saved portfolio candidates and 2,418 own-first retention checks. All
thirteen author corruption controls were rejected. The source manifest records
clean application `1ef2ffc`, frozen runner `21d3b76` and the exact provider pin/options.
Raw SHA256: `235b91c60b3e9521ff62cb10807e16067f59a57b5cc035f21c0076d4f4187952`.

| Print | Direction | Old mean HTM | Portfolio mean HTM | Portfolio max HTM | Old mean ms | Portfolio mean ms | Portfolio p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| de-a | inc | 20.161 | 19.587 | 40 | 75.36 | 126.81 | 271.39 |
| de-a | dec | 20.276 | 19.120 | 41 | 71.34 | 108.37 | 249.50 |
| en-3-zero | inc | 17.342 | 16.033 | 38 | 61.98 | 120.16 | 302.43 |
| en-3-zero | dec | 17.451 | 16.016 | 38 | 57.36 | 113.19 | 281.81 |
| en-3-unpadded | inc | 17.273 | 16.033 | 40 | 60.74 | 125.53 | 311.20 |
| en-3-unpadded | dec | 17.434 | 15.984 | 40 | 54.92 | 114.87 | 289.32 |

The portfolio improves the mean in all six measured year streams, while adding
planning work: year request means are 108–127 ms versus 55–75 ms for the old policy.
The cold first old-policy request took 2,474.39 ms. Portfolio runs later with warm
shared tables; this capture does not measure an isolated cold portfolio startup.
The longest group still needs **41 HTM plus two xyz rotations** for both policies.
Full HTM/QTM/xyz mean, median, p95, maximum, totals and worst cases are retained in
[CSV](captures/calendar-2024.summary.csv) and [analysis](captures/calendar-2024.analysis.md).

Across all portfolio scenarios the second attempt improved 1,059 plan calls and
saved 2,799 candidate moves relative to those calls' own first checked proposals.
First attempts reported 1,512 solved, 864 unknown and 42 not-attempted; second
attempts reported 1,059 solved and 1,317 unknown. Unknown second attempts retained
the first checked proposal; unknown is never classified as an impossibility.
These counts include obsolete calls, so they differ from completed request-group
counts. Both policies recorded zero legacy fallback groups, zero provider errors
and sixty expected planning cancellations each. Maximum actual reference endpoint
length was 361 tokens for old policy and 323 for portfolio. Exact reference
replacements retained every hidden sticker frame. See [derived outcomes](captures/calendar-2024.outcomes.json),
reproducible with `analyze-portfolio.py CAPTURE.json`.

## Interpretation and outstanding limits

The per-call certificate checks that the chosen portfolio result is no longer than
its own checked first proposal. Separately invoked ordinary-planner results may
vary under their soft time budget. Continuous old-policy and portfolio traces can
follow different hidden poses, so their later same-date rows are measured stream
outcomes, not guaranteed same-source dominance.

Half turns count once in HTM and twice in QTM. Every whole-cube xyz rotation remains
in the physical word and is reported separately. A capped unsuccessful search is
UNKNOWN and retains the checked best. No result here proves an optimum or a
universal 18/20/21-move limit. Browser worker hard deadlines and production behavior
are covered by the implementation's separate tests; these immediate-port timings
do not measure animation or a hard browser deadline.
