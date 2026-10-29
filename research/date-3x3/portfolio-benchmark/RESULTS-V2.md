# Portfolio V2: avoid repeating the same native search

V1's complete capture remains preserved in [the original findings](RESULTS.md).
Review identified 540 second native calls with exactly the same depth and
100,000-node ceiling as their unknown first calls. Their recorded attempt time
summed to approximately 43.535 seconds. Repeating that deterministic native search
at the same source and bounds contributes no new search coverage.

Clean V2 application `0c9b166ca66d252ecd096a73042d322f52d987a0` only executes the
second attempt when its effective native depth is strictly smaller than the
first recorded effective depth. Otherwise it retains the checked first proposal
and records `native-depth-not-strictly-smaller`. The metadata names this policy
`default-then-shorter-cap18-v2`. Each attempt retains the 100,000-node ceiling,
maximum total ceiling remains explicitly 200,000, and the existing browser hard
deadline is unchanged. Candidate selection, fixed printing, actual-pose tracking
and exact reference compaction remain in force.

The new capture is separate from V1; its `baseline-center` series uses the same
current controller with `policy:"default"`. Both policies keep their own physical
poses across the entire 2024 forward/backward year, deterministic jumps and
interruption sequences. A fresh comparison is required because ordinary planner
soft-budget variation and differing hidden poses can affect later rows. Measured
latency differences are not universal wall-clock guarantees.

## Final measured result

[The immutable V2 capture](captures/calendar-2024-v2.json) contains **4,716 complete
request groups**, 24 streams and 120 obsolete committed turns. Author verification
passed all chosen-word full 54-frame inverses, **4,254 saved candidate replays**,
and **2,418 own-first retention checks**. All fifteen full-capture corruption
controls passed, including duplicate native depth and missing skip diagnostics.
The separate V2 November capture passed all 30 groups; all eighteen historical
same-source probes passed 72 candidate/inverse replays and nine corruption controls.

**Exactly 540 duplicate native calls were skipped, with zero equal-or-greater-depth
second calls.** All **4,716 chosen words and all full physical endpoints are
identical to the V1 capture**. Thus the captured physical paths and move totals
are preserved while removing the redundant search work. See the reproducible
[V1/V2 comparison](captures/calendar-v1-v2.comparison.json).

The second attempt still improved 1,059 calls and saved 2,799 candidate moves over
those calls' own checked first proposals. First outcomes remain 1,512 solved,
864 unknown and 42 not-attempted. Second outcomes are 1,059 solved and 777 unknown
(previously 1,317 unknown). Another 540 first proposals are retained through the
explicit skip rule. Sixty expected planning cancellations per policy are separate;
both policies have zero provider errors and zero legacy fallback groups. Maximum
actual reference endpoint remains 361 tokens for default and 323 for portfolio.

| Print | Direction | Default mean HTM | V2 mean HTM | V2 max HTM | Default mean ms | V2 mean ms | V2 p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| de-a | inc | 20.161 | 19.587 | 40 | 72.00 | 101.71 | 204.25 |
| de-a | dec | 20.276 | 19.120 | 41 | 63.82 | 90.74 | 198.53 |
| en-3-zero | inc | 17.342 | 16.033 | 38 | 60.86 | 95.67 | 231.58 |
| en-3-zero | dec | 17.451 | 16.016 | 38 | 54.99 | 93.57 | 219.36 |
| en-3-unpadded | inc | 17.273 | 16.033 | 40 | 57.86 | 98.65 | 242.44 |
| en-3-unpadded | dec | 17.434 | 15.984 | 40 | 54.04 | 91.81 | 210.21 |

The V2 complete run took **397.84 seconds**, compared with 462.20 seconds for V1.
Portfolio request times sum to 239.65 seconds versus 296.26 seconds in V1; default
also varied, 153.44 seconds versus 161.02 seconds. These are descriptive Node
measurements on a shared machine; the whole 64.37-second run difference cannot
be attributed solely to the algorithm. V1 duplicate calls themselves recorded
43.535 seconds. No guaranteed wall-clock gain is inferred. V2 year portfolio
request means are 91–102 ms; default means are 54–72 ms. The cold first default
request took 2,235.34 ms. Portfolio runs later with warm process-global tables;
this capture does not measure isolated cold portfolio initialization. No targeted
probe jobs overlapped the V2 year capture, but shared background load is uncontrolled.

Maximum still reaches **41 HTM plus two xyz rotations**, so a universal 18/20/21
bound and optimality remain UNKNOWN. Every xyz turn is retained physically and
reported separately from outer HTM; QTM counts half turns twice. Full medians,
p95, maxima, totals, worst cases and per-attempt diagnostics are preserved in the
[CSV](captures/calendar-2024-v2.summary.csv),
[analysis](captures/calendar-2024-v2.analysis.md) and
[outcomes](captures/calendar-2024-v2.outcomes.json).

## Reproduction and provenance

Use the README command with clean source
`0c9b166ca66d252ecd096a73042d322f52d987a0` and a new output path. The run uses
frozen runner `08cafc4` (same `run.mjs` bytes as `21d3b76`), default threshold14,
100,000 nodes/attempt, depth24 and explicit `policy:"default"` versus `"portfolio"`.
Shared PuzlWerk pin remains `ffe513c43f5d622810b9a3c9aff2fac88163d0f0` with exact
package integrity retained in the manifest/series metadata. Raw V2 SHA256:
`c74b7ddb58dd6769ed26aaa0aa18d3f8d58300ab745f18f93c86957152f50b14`.
Run `verify.py`, `test_verify.py`, `analyze-portfolio.py` and
`compare-versions.py V1.json V2.json` to reproduce the certificate and derived
comparison. The strengthened checker additionally requires every solved candidate
word to fit its recorded native outer-face cap. Prior raw captures and generation
UNKNOWN fields remain unchanged; later verification is recorded separately.
