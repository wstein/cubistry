# Continuous timed timer routes

The owner follow-up to [#30](https://github.com/wstein/cubistry/issues/30) removes the deliberate pause before the last sync move in Countdown and Stopwatch, for both timer profiles. This work is stacked on PR 124's complete application preview; it does not change that parent or the separate publisher fix.

Source diagnosis before this follow-up: TimerController passed deadline timing only to its final move. `planSequence(3, 250, 10000)` reserves `75*3+8 = 233 ms` beyond the three nominal turns. On the real 90→89 route `D2 B2 R2`, dispatch at 9017 plays two untimed turns through 9517; the final turn then waits until 9750 and reaches 10000. At a 10 ms preference the same 233 ms wait remains. This is controller scheduling, not view rotation or a physical solver delay. Live H–M–S already assigns contiguous route windows, with a different angular weighting policy.

The replacement gives every timer move a live contiguous deadline window, using HTM weight 1 for both quarter and half turns. HSM keeps its existing quarter-angle weighting. The scheduling reserve belongs before the first turn, rather than between turns; normal faster preferences remain unchanged. Canonical endpoints, immutable stickers, legal incremental fallback, queued interruptions, pause/reset and deadline revisions retain their existing owners.

Deterministic tests exercise the actual TimerController with the production animation clock, recording progress starts and commits across the route, both profiles and directions, retiming, late callbacks and initially untimed work. No E2E/Playwright/browser execution or deployment is authorized. Numeric scheduling tests are separate from native browser feel and owner visual acceptance.


The shared window helper has an explicit HTM metric; its default angular metric
and Live H–M–S behavior are unchanged. Each Timer callback captures its legal
word, move index and target, so a queued target cannot lend an active old move a
deadline. Every move receives a callback even when initially untimed, allowing
late attachment, revision and clearing. Expired windows play incrementally at
the existing minimum HTM duration; they never credit an unplayed turn instantly.
Explicit user rate/deadline/preference changes retain the existing monotone
rebasing policy, which may hold the current angle intentionally. This exception
is separate from the removed automatic interior dwell on unchanged plans.

Run `node --test tests/timer-contiguous.test.mjs tests/timer-scheduler.test.mjs tests/workshop-timer.test.mjs tests/five-second-timer.test.mjs tests/motion-timing.test.mjs tests/live-clock.test.mjs`.
The progress regression measures emitted production progress before/after each
window boundary and derives the observed start from its slope, rather than
calling a predicted timestamp a measurement. Both profiles use their actual
interval/half-budget, including adaptive 2000 ms preferences. Mixed quarter/half
Timer durations stay equal; the HSM default remains 2:1. Native browser tests,
recordings and portable timing guarantees are not claimed.
