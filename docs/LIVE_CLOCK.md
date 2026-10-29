# Live H–M–S clock

The separate [clock page](../clock.html) implements #62 using three independent
copies of the corrected HSM print from #61. Hours use 00–23; minutes and seconds
use 00–59. Each unit keeps its own full physical state, assets, animation speed,
and immutable H/M/S label. The upper-left stickers are genuinely blank.

All three cubes share one WebGL canvas, one scene, one camera and one render
loop. They remain together in a horizontal row on mobile. Dragging the view
orbits the entire clock. Each cube has its own group of eight bodies, physical
state and move pivot; turn speeds stay independent. The caller-owned viewport
extension leaves standalone viewers in control of their own renderer. Timed
shared endpoints are painted together by the stage frame loop.

The sticker lettering selector chooses either large H/M/S or only small
`hour`/`min`/`sec` at the bottom of R1C2. It reloads a different immutable print
at current local time, preserving the three preferred turn settings. The two
styles never appear together on a sticker. See [artwork provenance](HSM_COUNTER.md#sticker-lettering-variants).

The shared control panel follows the five-second timer's typography and shows
the current local `HH:MM:SS` beside the cubes, or above them on narrow screens.
It reads the same wall-clock snapshot for all units and remains live during
physical motion. The browser's local time zone is displayed explicitly.

Preferred quarter-turn durations are H: 250 ms, M: 100 ms, S: 50 ms. A half
turn takes twice the scheduled quarter-turn duration. All three retain the seven
existing preference stops. The clock shows both the preferred setting and the
calculated scheduled quarter/half durations; these are plans, not measurements
of browser latency. Long or deliberately slow routes shorten the angular period
uniformly to fit the next live boundary. Standalone counters and timers retain
their existing speed semantics.

Use **Present** for the [presentation layout](PRESENTATION_MODE.md), with native
fullscreen when supported. **Reference view** restores the camera without
changing the displayed value, print, date or active motion.

## Predictive playback

The scheduler prepares shortest HTM routes only from committed, idle full poses.
For a route, angular work is `Q = sum(abs(move.turns))`: a quarter turn contributes
one unit and a half turn two. The nominal route duration is `Q * preferredMs`.
At launch, `scheduledQuarterMs = min(preferredMs, availableMs / Q)`. Every turn
gets a contiguous absolute window proportional to its angular work, and the last
window ends at the shared live boundary. No per-move reserve is accumulated as
an artificial pause before the final turn. Polling lateness is spread uniformly
across the sequence instead of being hidden in its last turn.

The minimum scheduled quarter turn is 10 ms. An insufficient remaining window
stays Synchronizing rather than snapping an unfinished physical route. Recovery
uses at most half the remaining local slot when possible, leaving time to plan
the next value; it also honors the 10 ms minimum and the quarter/half ratio. A
missed absolute turn window still plays incrementally with that ratio. Actual
rendering can finish late if the browser or OS is delayed; the digital readout
continues to show the shared current time.

Units sharing a boundary share the exact monotonic endpoint. Hours, minutes,
and seconds target the same instant at midnight rather than being driven by
three interval counters.

Hour boundaries are found from local-time changes, including DST repeats,
spring skips, and half-hour offsets. A suspended tab or wall-clock jump clears
outdated deadlines and retains only the latest current target. No missed-second
backlog is replayed, no cube is teleported, and no sticker image is replaced.

The HSM controller adds idle preparation and optional all-turn angular timing without
changing standalone counting defaults. It can install an initial current-time
pose during application setup; later changes use actual legal moves. Its
six-move bound for settled blank-and-unit sources is inherited from the pinned
[HSM proof](HSM_COUNTER.md). Interrupted partial sources are replanned through
the same exact graph without asserting that bound; see
[target interruption](TARGET_INTERRUPTION.md). The narrower canonical five-move
claim is not used as a universal clock promise.
These proof bounds count a half turn as one HTM, whereas clock timing counts it
as two angular units. A six-HTM route can therefore require up to twelve angular
units before the live schedule is fitted.

## Move statistics

A status block under the cubes shows, per cube (Hours, Minutes, Seconds) and in
total, the committed HTM moves and whole-cube rotations of the session, the cost
of the last completed tick, the largest tick cost so far, and the average cost
per tick of each cube. It reuses the
counting conventions of the counter and calendar: an outer-face token counts
once, a half turn included. Whole-cube x/y/z rotations are counted separately;
HSM routes consist of outer-face moves only, so that column stays at zero.

- Only moves that were physically committed are counted, taken from each
  controller's committed session total. Planned but unplayed moves of an
  interrupted or superseded route are never counted.
- A cube's tick cost is every move it committed since its previous completed
  display change, including turns of a superseded route. Changes that complete
  between two display polls form one tick, so a midnight rollover is one tick.
  A dash means no tick has completed yet.
- Per cube, Total HTM is every move that cube committed this session and
  Average / tick is its mean cost per completed change (the same costs behind
  last and max, so zero-cost changes count): the exact total cost divided by the
  number of completed changes, shown with two decimals and rounded only for
  display. It keeps two integers, no per-tick history. A dash means no change
  has completed yet; Reset session moves clears it. The Total row has no
  average.
- Session counters restart on page load or when the print changes, and with the
  Reset session moves button. They survive re-rendering and presentation mode
  and are not stored in the browser. Presentation mode hides the block, like the
  per-cube status lines.
- Only exact figures are shown, no estimates; the average is rounded for display.

## Verification

```sh
npm run check
npm run test:e2e -- tests/browser/live-clock.spec.mjs
```

Node regressions cover the shared midnight endpoint, DST changes and fractional
time-zone offsets, wall-clock jumps, bounded suspended-tab catch-up, exact-pose
preparation, current-value setup, and contiguous weighted timing on every physical move, slot fitting, and minimum-duration recovery.
Browser regressions measure real mixed quarter/half turns and check that no turn
waits in its start pose across multiple rendered frames. Separate recovery tests
confirm quarter-based clock pacing and unchanged default viewer pacing.
Browser cases also cover live local initialization, independent speeds and blank
faces, responsive layout, synchronized midnight, suspended-tab recovery,
navigation to the standalone HSM counter, and actual three-cube animation in one viewport
against a shared midnight deadline. Physical endpoint checks use the committed
endpoint itself because the seconds cube may already be moving again when a
later browser inspection runs.

The real-animation test saves full physical presentations and measured endpoint
offsets to ignored test results for independent review. Browser/OS scheduling
can finish late; measured tolerances describe the tested environment, not a
universal real-time guarantee. No merge or deployment is authorized by these
checks. The separate German and English 3×3 calendars are tracked in #63.
