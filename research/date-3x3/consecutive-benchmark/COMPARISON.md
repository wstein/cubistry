# Final consecutive calendar comparison

[Issue 66](https://github.com/wstein/cubistry/issues/66) is complete for the
specified benchmark domain. The [retained capture](captures/final-providers-2024.json)
contains **7,074 complete request groups** and 36 continuous physical streams.
Both author and independent Rodrigues replays passed all 54 sticker identities,
orientations (including hidden centers), inverses, reference substitutions and
180 obsolete committed turns. The independent reviewer rejected eight general
and five compaction-specific corruptions; the author rejected ten additional
controls. See [independent review](INDEPENDENT_REVIEW.md).

Each provider retains its own actual pose across 366 increments and 366 decrements
through leap year 2024, fourteen deterministic jumps, twenty move-interruption
groups and twenty planning-interruption groups, for each of three prints. There
is no canonical reset between requests. Direct and center-aware use the same
controller and exact source-reference compaction policy. Different accepted paths
lead to different later hidden poses, so these are whole-stream comparisons;
per-date rows across providers are not necessarily identical-source comparisons.

| Print | Direction | Legacy mean HTM | Compacted direct mean HTM | Center-aware mean HTM | Center max HTM | Center mean request ms | Center p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| German A | Increment | 66.40 | 21.98 | 20.16 | 40 | 73.39 | 162.44 |
| German A | Decrement | 66.40 | 22.15 | 20.28 | 41 | 82.31 | 203.91 |
| English 3, zero | Increment | 64.05 | 18.53 | 17.34 | 39 | 61.17 | 170.43 |
| English 3, zero | Decrement | 64.05 | 18.61 | 17.45 | 39 | 54.31 | 153.56 |
| English 3, unpadded | Increment | 64.10 | 18.74 | 17.27 | 40 | 67.53 | 197.96 |
| English 3, unpadded | Decrement | 64.10 | 18.43 | 17.43 | 40 | 66.75 | 195.53 |

HTM counts face turns, with half turns counting once. QTM counts half turns twice;
whole-cube xyz rotations are reported separately. Full mean/median/p95/max HTM,
QTM, xyz and timing statistics, worst cases, fallback rates and request words are
in the retained [CSV](captures/final-providers-2024.summary.csv),
[generated analysis](captures/final-providers-2024.analysis.md) and raw capture.
The longest optimized group is still **41 HTM plus two xyz rotations**, German A
2024-11-20 → 2024-11-19 (row 5124). There is **no universal 20/21-move or
optimality claim**.

Across all center-aware scenarios, 1,516 plan calls accepted a strictly shorter
route than their own direct candidate at the same source, saving 3,595 candidate
moves in those calls. Another 860 searches reached their node budget (`unknown`)
and retained the checked direct route; 42 calls did not attempt center search.
The 60 expected planning cancellations are separate. Both optimized providers
had zero explicit provider errors and zero legacy fallback request groups.
`unknown` is not an impossibility result, and a retained direct result is not a
legacy fallback. These diagnostic totals count calls, including obsolete requests,
so they differ from the 2,358 completed groups per provider.

The source-reference growth finding in [the preserved baseline](BASELINE.md) is
addressed: actual reference endpoints never exceeded 352 tokens for direct or
361 for center-aware, versus 13,642 in the original uncompacted direct capture.
Every shorter replacement was independently replayed to the identical full 54-frame
pose. This bound is a measurement of the saved domain, not a proof for all dates.

The complete run took **324.67 seconds**. Node request timings include planning
and immediate verified physical commits, excluding browser animation and network.
The first center-aware request took **2,262.73 ms**, including lazy solver-table
initialization; warm year means are approximately 54–82 ms. Providers run sequentially
in one process and library caches can remain warm. A shared four-CPU quota and
background load affect measurements. Compaction substantially reduces long-reference
cost, while center search can add planning time; no universal latency improvement is
claimed. Browser deadlines and animation have separate implementation tests.

## Frozen inputs and reproduction

- Harness: `1b036aadc8397e0c7e363f07cb0303edf90a1947`.
- Clean application: `96bd61cd7d226fae7973300139e589bd1738fd01`.
- Shared PuzlWerk provider: `ffe513c43f5d622810b9a3c9aff2fac88163d0f0`, package
  `@puzlwerk/solver-3x3-picture@0.1.0`; package integrity and upstream CubeLab
  `08e079f3bc211777d8980f75ec6a7f61979dd2ac` are retained in series metadata.
- Center options: threshold 14 HTM, maximum 100,000 nodes and depth 24.
  The direct factory uses `backend: "direct"`, threshold 1,000, with identical
  compaction and no center search.
- Raw SHA256: `3753b6ec0aec44068fd2dc9aa23481c7abf001f6b6f025265f60f0a6ff96af84`.

Use clean checkouts at these revisions, equivalent local paths and a new output
filename (the runner refuses overwrite):

```sh
node research/date-3x3/consecutive-benchmark/run.mjs \
  --app-root /workspace/cubistry-calendar-centers \
  --output /tmp/NEW-final-comparison.json \
  --direct-provider /workspace/cubistry-calendar-centers/src/apps/calendar/center-planner.mjs \
  --provider /workspace/cubistry-calendar-centers/src/apps/calendar/center-planner.mjs \
  --provider-name center-aware \
  --provider-options '{"threshold":14,"maximumNodes":100000,"maximumDepth":24}' \
  --days 366 --interruption-groups 20 --max-ms 1200000
python3 research/date-3x3/consecutive-benchmark/verify.py \
  research/date-3x3/consecutive-benchmark/captures/final-providers-2024.json
python3 research/date-3x3/consecutive-benchmark/test_verify.py \
  research/date-3x3/consecutive-benchmark/captures/final-providers-2024.json
python3 research/date-3x3/consecutive-benchmark/analyze.py \
  research/date-3x3/consecutive-benchmark/captures/final-providers-2024.json
```

Raw capture and generation sidecars retain their historical generation-time UNKNOWN
status. Verification and independent review are separate later artifacts. Original
4,716-case evidence is preserved byte-for-byte. No production deployment changed.
