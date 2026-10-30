# Continuous timed timer routes

The owner follow-up to [#30](https://github.com/wstein/cubistry/issues/30) removes the deliberate pause before the last sync move in Countdown and Stopwatch, for both timer profiles. This work is stacked on PR 124's complete application preview; it does not change that parent or the separate publisher fix.

Source diagnosis: TimerController passes deadline timing only to its final move. `planSequence(3, 250, 10000)` reserves `75*3+8 = 233 ms` beyond the three nominal turns. On the real 90→89 route `D2 B2 R2`, dispatch at 9017 plays two untimed turns through 9517; the final turn then waits until 9750 and reaches 10000. At a 10 ms preference the same 233 ms wait remains. This is controller scheduling, not view rotation or a physical solver delay. Live H–M–S already assigns contiguous route windows, with a different angular weighting policy.

The replacement will give every timer move a live contiguous deadline window, using HTM weight 1 for both quarter and half turns. HSM keeps its existing quarter-angle weighting. The scheduling reserve belongs before the first turn, rather than between turns; normal faster preferences remain unchanged. Canonical endpoints, immutable stickers, legal incremental fallback, queued interruptions, pause/reset and deadline revisions retain their existing owners.

Validation must exercise the actual TimerController with the production animation clock, recording progress starts and commits across the route, both profiles and directions, retiming, late callbacks and initially untimed work. No E2E/Playwright/browser execution or deployment is authorized. Numeric scheduling tests are separate from native browser feel and owner visual acceptance.
