# Preserved original consecutive-run baseline

This capture measures the clean Cubistry implementation at
`5a73f34c39cf9d254a5ac4056d152f595d832123`, before bounded source-reference
compaction and shared center-aware integration. It is preserved separately from
those later changes.

[Raw capture](captures/legacy-direct-2024.json) contains **4,716 complete request
groups** across the legacy and direct providers, three prints and four scenarios.
Both providers retain their own actual full pose. Each year series runs 366 days
forward through 2024, then 366 backward; fourteen jumps and twenty groups each of
move-boundary and planning supersession are additional scenarios.

All 4,716 routes and inverses passed the separate Python Rodrigues verifier.
An independent reviewer repeated the full replay and rejected eight additional
corruptions; see [review](INDEPENDENT_REVIEW.md). The author also retained
[ten corruption controls](captures/legacy-direct-2024.negative-controls-author.json).
The captured routes are physically valid; this is not shortest-path evidence or
a universal move bound.

| Print | Direction | Legacy mean HTM | Direct mean HTM | Direct max HTM | Direct mean request ms | Direct max source-reference tokens |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| German A | Increment | 66.40 | 21.98 | 41 | 138.09 | 5,504 |
| German A | Decrement | 66.40 | 22.15 | 40 | 410.03 | 13,642 |
| English 3, zero | Increment | 64.05 | 18.53 | 39 | 148.75 | 6,694 |
| English 3, zero | Decrement | 64.05 | 18.64 | 39 | 390.41 | 13,439 |
| English 3, unpadded | Increment | 64.10 | 18.74 | 40 | 108.77 | 4,671 |
| English 3, unpadded | Decrement | 64.10 | 18.43 | 40 | 222.39 | 8,792 |

These timings include Node planning and immediate verified physical commits, not
browser animation. The legacy series averaged approximately six milliseconds per
request. Direct German decrement p95 was 578.88 ms and maximum was 926.95 ms.
No direct year request used the legacy fallback or reported a provider error.
The complete run took 546.01 seconds in the recorded shared execution environment.
Underlying container quotas and background load were not captured by this older
runner; its advertised CPU model and parallelism are observations, not guarantees.

The important finding is source-reference growth. The original controller only
shortens the reference to a canonical setup when every hidden frame also agrees.
Direct paths allow different hidden center orientations, so legal source words
can grow through consecutive requests. The fallback path is repeatedly replayed
for validation, adding planning cost despite short physical routes. A separate
implementation now addresses bounded exact references. Compare that implementation
with the same request sequence; do not silently reinterpret these timings as its
results.

## Exact capture and reproduction

Runner revision: `3eef3c5092beb1ccfa362275760d0151c65d0c3d`.
The raw runner output records `UNKNOWN` at generation time because independent
review had not yet run. The separately retained verification results and review
provide its subsequent validation; raw evidence bytes were not rewritten.

```sh
node research/date-3x3/consecutive-benchmark/run.mjs \
  --app-root /workspace/cubistry-calendar \
  --output /tmp/cubistry-consecutive-baseline-full.json \
  --days 366 --interruption-groups 20 --max-ms 600000
python3 research/date-3x3/consecutive-benchmark/verify.py \
  research/date-3x3/consecutive-benchmark/captures/legacy-direct-2024.json
```

Use clean checkouts at the stated runner and application revisions and a **new**
output path. The original command's workspace paths describe the actual execution;
replace the application path with the equivalent frozen checkout when reproducing.
See the retained [manifest](captures/legacy-direct-2024.manifest.json),
[CSV](captures/legacy-direct-2024.summary.csv) and
[log](captures/legacy-direct-2024.log) for exact inputs, hashes and progress.
