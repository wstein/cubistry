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

The shared control panel follows the five-second timer's typography and shows
the current local `HH:MM:SS` beside the cubes, or above them on narrow screens.
It reads the same wall-clock snapshot for all units and remains live during
physical motion. The browser's local time zone is displayed explicitly.

Preferred move durations are H: 500 ms, M: 250 ms, S: 100 ms. All three retain
the seven existing speed stops. Values slower than the available interval can
lag; the physical status then says Synchronizing rather than claiming that an
old pose is current. The digital control stays on actual time.

## Predictive playback

The scheduler prepares shortest HSM routes only from committed, idle full
poses. It starts with a per-move frame margin, then times the final legal turn
to the next relevant time boundary. Units sharing a boundary also share the
exact monotonic endpoint. Hours, minutes, and seconds therefore target the
same instant at midnight rather than being driven by three interval counters.

Hour boundaries are found from local-time changes, including DST repeats,
spring skips, and half-hour offsets. A suspended tab or wall-clock jump clears
outdated deadlines and retains only the latest current target. No missed-second
backlog is replayed, no cube is teleported, and no sticker image is replaced.

The HSM controller adds idle preparation and optional final-turn timing without
changing standalone counting defaults. It can install an initial current-time
pose during application setup; later changes use actual legal moves. Its
six-move general bound is inherited from the pinned [HSM proof](HSM_COUNTER.md).
The narrower canonical five-move claim is not used as a universal clock promise.

## Verification

```sh
npm run check
npm run test:e2e -- tests/browser/live-clock.spec.mjs
```

Node regressions cover the shared midnight endpoint, DST changes and fractional
time-zone offsets, wall-clock jumps, bounded suspended-tab catch-up, exact-pose
preparation, current-value setup, and timing only on the final physical move.
Browser cases cover live local initialization, independent speeds and blank
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
