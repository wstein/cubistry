# Post-repair continuous calendar evidence

This V3 capture measures the shorter visible-center repair table, with the V2
bounded search policy and budgets unchanged. It preserves V1 and V2 raw evidence;
the previously measured 41-HTM maximum describes those historical captures.

Clean application `cc7b5abc0c72005ed6b67bf88de5d71e607a31a6` uses repair table
version 2: quarter/half/inverse-quarter repairs of **14/12/14 HTM**, replacing
18/20/18. The [independent repair investigation](../center-bound-investigation/README.md)
replays the full sticker frames. All three replacements have the same full
54-frame transform as their old counterparts. Both old and new quarter repairs turn the unconstrained hidden back
center identically while restoring every noncenter frame; this is legal physical
motion, not sticker relabeling. The repair substitution itself preserves the
complete endpoint.

For the recorded V2 German A 2024-04-20 → 19 source, the independently verified
same-source counterfactual reduces 41 HTM plus two xyz rotations to **32 HTM plus
two xyz rotations** (one adjacent face-turn merge is included). This is a
specific witnessed route, not an optimum or a new whole-domain maximum. A fresh
continuous run is necessary because shorter repair costs alter candidate ranking
and native depth caps. That can select different paths and hence different later
actual hidden poses, even though each substituted macro has the same endpoint.
The primary-source investigation distinguishes the 2,048
residual center configurations from a full arbitrary picture-cube solve; no
universal 21-move guarantee follows here.

The new run retains one actual pose per provider/print across 366 increments and
366 decrements through leap year 2024, fourteen deterministic jumps and twenty
move- and planning-interruption groups each. All three prints are tested using
`policy:"default"` and `"portfolio"` on the same current controller/reference
policy. Threshold 14, outer depth 24, 100,000 nodes per attempt, the two-attempt
200,000 ceiling and strictly smaller second native depth remain unchanged.
Every xyz rotation remains in the physical route; HTM and QTM are reported
separately. Source printing is unchanged.

The final consumer head `1e051a44ab5e43f912089d4742728d75fc7f976f` differs
from captured `cc7b5abc` only in provenance metadata, documentation and a
provenance regression test. The author and benchmark author independently
confirmed the planner, worker, repair table, printing and worst-source fixture
are byte-identical. The corrected provenance records repair-table SHA256
`c6acdc2ab88bb2167ee8c7646db9787da3766175f1b9ce71313761327be49f8c`
and the independent repair proof at Research `9e73659`. The capture retains
its exact original source hashes; this reconciliation does not rewrite them.

## Fresh continuous measurements

[The complete raw V3 capture](captures/calendar-2024-v3.json) contains **4,716
request groups** and 24 actual-pose streams, finishing in **418.49 seconds**.
Author Rodrigues replay passed all 4,716 full 54-frame inverses, 120 obsolete
single turns, 4,254 saved candidate replays and 2,418 own-first proposal checks.
All fifteen author corruption controls were rejected. The raw SHA256 is
`3262fd53e0444312b3cb79c67792724c823eaa5bd5e2ed55ba0ee4a3c47dd6b7`.

The observed maximum is now **35 HTM plus two xyz rotations (37 physical tokens)**,
for German A 2024-04-19 → 20, portfolio row 2467 (default row 109). Thus **41 is a
historical V2 maximum**, not the current observed maximum. This still does not
establish a universal 21-move bound or optimality.

| Print | Direction | V2 portfolio mean HTM | V3 portfolio mean HTM | V2 max HTM | V3 max HTM |
| --- | --- | ---: | ---: | ---: | ---: |
| de-a | inc | 19.587 | 19.186 | 40 | 35 |
| de-a | dec | 19.120 | 18.907 | 41 | 34 |
| en-3-zero | inc | 16.033 | 16.011 | 38 | 32 |
| en-3-zero | dec | 16.016 | 15.951 | 38 | 33 |
| en-3-unpadded | inc | 16.033 | 15.964 | 40 | 34 |
| en-3-unpadded | dec | 15.984 | 16.008 | 40 | 34 |

German default-policy means also change: increment 20.161 → 20.055 and decrement
20.276 → 19.749, with maxima 40/41 → 35/34. Not every mean improves: English
unpadded decrement changes slightly from 15.984 to 16.008. Over all captured groups,
portfolio HTM total changes 40,984 → 40,610; default changes 43,669 → 42,960.
These are measured whole-stream outcomes, not per-date same-source dominance.
Only 739/2,358 portfolio endpoints and 282/2,358 default endpoints match the old
capture completely; differing paths propagate different actual hidden poses.
The macro substitutions themselves have equal full transforms, as explained above.

Across portfolio calls, the second attempt improves 1,058 proposals and saves 2,359
candidate moves relative to its own retained first results. First calls report
1,513 solved, 863 unknown and 42 not-attempted; second calls report 1,058 solved and
778 unknown. There are 540 explicit native-depth skips, zero equal-or-greater
second native depths, zero provider errors, zero legacy fallback groups and 60
expected planning cancellations per policy. Actual reference endpoint maxima are
355 tokens for default and 340 for portfolio, independently reconstructible from
full physical words and strictly shortening reference substitutions.

Planning remains bounded work: V3 portfolio year request means are approximately
96–109 ms; default means 56–80 ms. The cold first default request took 2,370.06 ms.
The full V3 run 418.49 seconds versus V2 397.84 seconds does not show a wall-clock
speed improvement. These Node timings include planning and immediate verified
commits, exclude browser animation/network and reflect shared machine load and
process-global caches. Fewer physical turns do not imply a universal lower
planning time. QTM counts half turns twice; xyz remains explicitly reported.

See the [full CSV](captures/calendar-2024-v3.summary.csv),
[analysis](captures/calendar-2024-v3.analysis.md),
[outcomes](captures/calendar-2024-v3.outcomes.json) and
[V2/V3 comparison](captures/calendar-v2-v3.comparison.json).
The comparison helper's `v1`/`v2` fields mean its first/second arguments (V2/V3
here), with exact source commits and hashes retained. Reproduce with the unchanged
README command at captured `cc7b5abc`, using new output paths, then `verify.py`,
`test_verify.py`, `analyze.py`, `analyze-portfolio.py` and
`compare-versions.py OLD-V2.json NEW-V3.json`. Old raw captures and their generation
UNKNOWN fields are preserved. Later verification is recorded separately.
