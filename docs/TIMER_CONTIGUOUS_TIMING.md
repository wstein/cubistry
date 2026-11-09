# Continuous timed timer routes

Every legal turn receives a contiguous absolute deadline window. On November 9,
2026, the owner requested angular timing on every cube: quarter turns use one
time unit and half turns use two. The same easing curve applies to both.
Single-cube defaults are 250 ms per quarter turn; explicit speed selections and
multi-cube preferences remain in effect.

The scheduler separates HTM token counts from angular work. Frame/commit reserve
is still 75 ms per token plus 8 ms for dispatch. Motion uses the sum of absolute
quarter-turn angles. The existing 20 ms foreground completion tolerance stays
inside the half-interval budget. Reserve occurs before the first turn; adjacent
turn windows share their boundary and the final turn ends at the clock deadline.

Each callback captures its legal word, index and target. Queued targets cannot
lend stale callbacks a deadline. Timing can attach, change revision or clear
during playback. Expired windows play incrementally at 10 ms per quarter turn;
they do not credit an unplayed turn instantly. Explicit changes retain monotone
rebasing, which may intentionally hold the current angle. HTM progress and
session counts, legal endpoint commits and immutable artwork are unchanged.

The shared helper retains an explicit HTM compatibility option; application
Timer, M/S Timer and HSM routes use angular windows. Calendar7's reduced-motion
orientation exception remains 150 ms per rotation.

Deterministic tests exercise real controllers and production interpolation in
both directions, mixed angles, exact deadlines, revisions, pause/reset, late
callbacks and initially untimed work. Native browser feel and portable timing
guarantees require separate runtime assessment.

Run `node --test tests/timer-contiguous.test.mjs tests/timer-scheduler.test.mjs
 tests/five-second-timer.test.mjs tests/ms-timer.test.mjs
 tests/motion-timing.test.mjs`.
