# Independent proof review

Reviewer: separate agent `verify_german_whole_weekdays`, October 28, 2026.
Authoring evidence was not modified by the reviewer.

Verdict: **SAT** for both German single-sticker three-letter weekday candidates.
No blocking findings within the following scope.

Independent executions:

```bash
python verify-layout.py witnesses/de-weekend-c1-3.json candidates/de-weekend-c1-3.json
python verify-layout.py witnesses/de-weekend-c2-3.json candidates/de-weekend-c2-3.json
```

Both executions passed 2,562 calendar patterns each, covering the Gregorian
400-year cycle. The reviewer inspected the separate Rodrigues checker and
confirmed legal moves, all 54 immutable source sticker frames, upright nonblank
glyphs, visible centers, full inverse restorations, and fixed red `#ba302c`,
weight-800 SAM/SON. Other weekdays remain dark, weight 600. The PNG, renderer,
font provenance and image hashes were also inspected and found consistent.

Both candidates also use whole three-letter months on one sticker. C1 preserves
weekday/day/month order; C2 uses weekday/month/day. The existing German A print
is not replaced. Daily transition lengths and shortest-path optimality remain
**UNKNOWN**; source-to-target initialization costs must not be described as daily
transition costs. This independent review covered the three-letter candidates;
two-letter variants have separate successful validator results but were not
independently rerun in this review.
