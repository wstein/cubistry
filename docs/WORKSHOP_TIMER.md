# 60-Minute Timer

The separate **60-Minute Timer** application uses one immutable 24-sticker print:
minutes above seconds, supporting **00:00–59:50** in ten-second steps. Its name
does not imply a 60:00 display. Counter remains the default application.

## Controls and clocks

**Countdown** defaults to 15:00. **Stopwatch** starts at 00:00 and stops at 59:50
without wrapping. Both use the same monotonic, anchored virtual clock, physical
controller and fixed print. For physical targets, Countdown rounds remaining time up to ten seconds;
Stopwatch shows completed ten-second intervals. For example, pausing Stopwatch
at 12.5 seconds shows 00:10 but retains the extra 2.5 seconds for Resume. The
cube does not claim single-second precision.

The large right-hand live readout uses **one-second resolution** from the same
monotonic sample: Countdown rounds remaining seconds up; Stopwatch rounds elapsed
seconds down. For example, Stopwatch paused at 12.5 seconds shows **00:12** in
the controls while its physical bucket remains **00:10**. At normal speed the
live readout changes each second; accelerated rates may visually skip seconds
between the existing 50 ms UI updates. This does not add a second clock, change
the immutable print, or request one-second cube states.

One button stays in place: **Start**, **Pause**, or **Resume**, with a separate
**Reset**. **Set** beside Duration applies the value without starting; Enter is
the same action. Set remains available during stopped-clock physical settling,
replacing only the pending target, and is disabled while the clock runs. Start
applies a valid edited countdown duration; invalid input cannot silently start
the previous duration. Reset returns
to the configured countdown duration or Stopwatch zero. Changing mode stops and
resets the clock, discards an unapplied duration draft and requests that mode's
initial physical target. It never interrupts a face turn or resets session moves.

**Timer speed** (1×, 10×, 20×, 50×, 100×) belongs in the right-hand controls and
changes virtual time only. Changing rate integrates elapsed time at the old rate
using one monotonic sample before anchoring the new rate. Pauses retain fractions;
interval callbacks do not accumulate drift. The selected multiplier remains when
switching modes within this application.

**Rotation Speed** stays beneath the cube with its six original presets plus **10 ms**. Switching
applications while physically idle applies **250 ms per move for Timer** and
**100 ms for Counter**. In Timer this is a preferred duration; the effective duration during a scheduled
sequence appears in the motion status. Rotation changes within Timer do not overwrite Counter's
saved value/format/speed record. No new cross-application preference persistence
is implied. Mode changes retain the selected rotation preference and never cancel an
in-flight legal turn. Effective presentation speed can reconcile when the old
deadline is invalidated. Reload returns to the saved idle Counter and never
silently resumes a Timer deadline.

## Physical synchronization

For a feasible scheduled ten-second boundary, the exact **last legal turn ends
at the absolute clock timestamp `T`**, with a **20 ms observed foreground
completion tolerance**. The cube must not finish hundreds of milliseconds early.
This supersedes the earlier conservative before-boundary policy recorded below.
Countdown's ceiling, Stopwatch's floor, and the independent one-second live
readout still come from the same monotonic clock.

The controller prepares the complete legal word from its full committed source
state. For `N > 0` moves, let `I = 10000 / Timer speed` milliseconds and
`B = min(I / 2, deadline - preparationFinishedAt)`. The scheduler reserves 75 ms
per move for frame/render/commit work, 8 ms for dispatch, and the accepted 20 ms
endpoint tolerance **inside** the half-interval budget:

```text
overhead = 75 * N + 8
effective = min(preferred, max(10, (B - overhead - 20) / N))
plannedSequenceDuration = overhead + N * effective
startAt = T - plannedSequenceDuration
finalMotionStart = T - effective
```

A feasible plan satisfies `plannedSequenceDuration + 20 <= B`. A normal five-move
edge at a 2,000 ms preference uses 919.4 ms nominal turns in a 4,980 ms planned
sequence. Faster 250 ms and 10 ms preferences remain unchanged when they fit.
The earlier turns run normally. The final turn holds **its starting pose**, then
rotates during its nominal motion window ending at `T`. It does not reach the
final pose early and merely delay the displayed value or move count.

A guarded one-shot wake starts the word. Final-turn interpolation uses the same
absolute endpoint, with a guarded timer at `T` competing safely with animation
frames. Completion happens once: the final mesh state is synchronized and drawn
before the animation promise resolves, then the controller verifies the full
canonical state, commits the HTM, and updates the live UI in the same task and
microtask chain before paint. Counter uses its original untimed presentation path.
Reduced-motion preference is captured once per presentation.

Preparation time is included by resampling the same monotonic clock after
preparation. A prepared word is reused only if its complete source still matches,
including hidden poses. The 50 ms polling callback reconciles clocks and delayed
work; it does not add clock drift. Playback retains one active legal target and
one replaceable latest target. An active legal sequence always finishes. Faster
virtual ticks can skip intermediate *displays*, never moves or verification.

**Moving** includes a normal future target and its intentional final-turn hold.
**Synchronizing** means a genuine mismatch with the current or planned target;
it shows the last settled time. The reserved two-line area reports effective
speed, **Budget infeasible**, or **Late** without moving the slider. The slider
always shows the selected preference. Ordinary initial or paused physical
settling does not invent a missed deadline.

A budget is infeasible under this policy if `overhead + 10 * N + 20 > B`.
Infeasible or expired plans release endpoint pacing and retain legal 10 ms
nominal catch-up with one latest pending target. They do not claim exact endpoint
alignment. At 100×, the interval is 100 ms and half is 50 ms. Five turns needing
one frame each take about 83 ms at 60 Hz even before render work. The conservative
policy also rejects a one-move 100× half budget; this is not a proof that faster
hardware cannot fit it. No turn or whole cube state is teleported to catch up.

Pause freezes the clock and releases a scheduled hold. A partially animated turn
continues forward, then the legal sequence reconciles the frozen bucket. Reset,
Set, mode changes, and application replacement invalidate old pacing similarly.
Resume preserves fractions. Rate and speed changes rebase remaining progress
without reversing the angle; an initially untimed final turn can acquire a newly
feasible deadline. Automatic terminal clock ticks preserve a valid final-turn
endpoint until physical completion instead of canceling its timer at `T`.
Completion/limit reached still requires the exact physical 00:00/59:50 state.

Browser and OS scheduling cannot provide an unconditional 20 ms guarantee. A
blocked main thread, background tab, or unavailable render cycle can miss the
window; the clock continues honestly and legal bounded catch-up remains the
exception. A controlled callback stalled to `T + 35 ms` verifies the recorded
miss, exactly one final HTM, and full-state integrity rather than claiming it
met the tolerance.

The move-progress label is **Sequence N**, where N identifies an actual nonempty
physical sequence. Numbering advances at its start, not for queued/coalesced
targets, frames, or repeated requests. The number remains after completion and
resets when an application is configured. Reset session moves preserves it.

The existing shared exactPhysical solver handles arbitrary/reset/catch-up targets
with full replay. No new solver, search, table, or claim of globally optimal
partial-display paths is introduced. Counter's presentation-only blank-tens mask
is cleared for Timer; all four Timer digits remain printed, upright digits.
Returning to Counter restores its presentation preference and certified 339-HTM route.

## Evidence and timing

The unchanged source is Cubistry's `research/cube-display-feasibility` commit
`7c05d28e97ecf30848220f5c70cb3100a4f3628d`, original SAT evidence commit
`22ad143168f814a1d7513d7ac2349b9c77c97a2d`. Copied bytes and checksums are in
`research/workshop-timer/provenance.json`. Runtime uses only the full 59:50 print,
not the separate 19:50 candidate. Its 360 complete states and 359 adjacent edges
use **1,324 HTM**, at most **five per edge**. R, R2 and R′ each count as one
committed move, after animation resolves.

Initial application configuration establishes independently replayed canonical
15:00 with session zero, excluded from runtime statistics. The source-to-00:00
proof setup is five moves, **not** a five-move source-to-15:00 setup. The proof
path to 15:00 is that setup followed by the first 90 increments. The ordinary
15:00→00:00 controller and browser traces visit 91 displays in 90 edges and
commit **331 HTM**, independently replayed. Reset/catch-up moves count normally.

The 10 ms preset changes presentation speed only. It still animates and commits
every legal turn. Display refresh rate and scheduling may make actual turns
longer than the nominal 10 ms. Timer speed remains independent.

Earlier manual-Set, no-reduced-motion five-move observations were roughly 1.5 seconds at 250 ms,
0.7 seconds at 100 ms, and 10.3 seconds at 2,000 ms. The slow manual edge exceeds a
normal ten-second tick; scheduled playback now adapts it as described above. These are hardware-dependent observations, not timing
guarantees; bounded catch-up remains necessary.

Before adaptive scheduling, a real interactive **100×** full-range exercise used the visible speed selector
and 250 ms rotations, with no fake clock or reduced motion. The clock traversed
59:50→00:00 while visibly lagging; the cube settled after **40.110 seconds** and
**134 committed HTM**, excluding the prior duration setup. The exact final state
and every actual move were independently replayed. This observation does not
promise every intermediate display, a fixed move count, or completion within one
minute on other hardware. The immutable observation/trace is separate from proof
certificates in `research/workshop-timer/observations/100x-summary.json` and
`100x-countdown-commits.json`.

## Reproduction

```sh
npm run setup
npm run check
CI=1 npm run test:e2e
CI=1 npm run test:pages
python3 research/workshop-timer/verify.py research/workshop-timer/observations/100x-countdown-commits.json
```

The check command includes the original and optimized independent checkers,
18 copied controls, all 360 runtime states and actual countdown replay. Browser
cases additionally cover all five rates and mid-run changes, Stopwatch fractions
and cap, single-button focus/labels, mode changes during lag, real visible 100×
playback, mobile, mask isolation, per-application defaults and built Pages paths.

This feature started on PR #54 (`feat/53-cube-first-ui`) for issue #30. After
that parent was merged, PR #56 was retargeted to `main`. The external history
restack preserved all implementation trees and atomic patches; this author did
not modify the parent, protected research, or preview workflows.

## Earlier UX acceptance evidence

The focused browser regressions exercise Set/Enter equivalence, Set without
starting, pending-duration replacement, and the Moving → Synchronizing → idle
path with actual animations enabled. They hold and drag the Rotation Speed
slider across the status change. Ready, Running, Paused and Settling retain the
same slider position. Frame samples at widths 1280, 390 and 320 pixels measured
**0 px vertical movement**; the tests reject movement of 0.5 px or more.

| View | Before | Moving | Synchronizing | After |
| --- | --- | --- | --- | --- |
| Desktop | [Before](assets/issue-30-ux/desktop-before.png) | [Moving](assets/issue-30-ux/desktop-moving.png) | [Synchronizing](assets/issue-30-ux/desktop-synchronizing.png) | [After](assets/issue-30-ux/desktop-after.png) |
| Mobile footer | [Before](assets/issue-30-ux/mobile-before.png) | [Moving](assets/issue-30-ux/mobile-moving.png) | [Synchronizing](assets/issue-30-ux/mobile-synchronizing.png) | [After](assets/issue-30-ux/mobile-after.png) |

Raw frame/phase measurements: [1280 px](assets/issue-30-ux/slider-1280.json),
[390 px](assets/issue-30-ux/slider-390.json),
[320 px](assets/issue-30-ux/slider-320.json). Desktop captures show the full
application; mobile captures focus on the footer under pointer interaction.
These UI checks use Playwright's controlled clock with actual turn animation;
they do not replace the separate real-time animation-budget measurements above.

## Earlier before-boundary observations

The [before-boundary observations](assets/issue-30-deadlines/foreground-observations.json)
retain the prior source revision's measurements at preferred 250 ms, 2,000 ms,
and 10 ms. Those assertions required full settlement before the boundary. They
are historical evidence, superseded by the target-time endpoint acceptance below.

The initial 17 ms per-move allowance passed the 250 ms and adaptive 2,000 ms
cases but missed a 10 ms case by **53.3 ms**. The 75 ms allowance incorporates
the earlier measured 33–55 ms per-move overhead with additional margin. This
calibration failure is not suppressed or presented as successful evidence.

The held-slider tests include movement, accelerated backlog, and effective
speed/warning text in the same reserved two-line area. Raw geometry:
[1280 px](assets/issue-30-deadlines/slider-1280.json),
[390 px](assets/issue-30-deadlines/slider-390.json), and
[320 px](assets/issue-30-deadlines/slider-320.json). Earlier screenshots and
observations retain their original provenance.

## Target-time endpoint acceptance

[Countdown observations](assets/issue-30-deadlines/endpoint-observations.json),
[Stopwatch](assets/issue-30-deadlines/stopwatch-endpoint.json), and
[terminal zero](assets/issue-30-deadlines/terminal-endpoint.json) capture the actual
clock deadline, canonical render timestamp, verified physical commit timestamp,
and live readout in that commit. The three preferred speeds are 250 ms, 2,000 ms,
and 10 ms. The tests require render and commit within 20 ms of `T`, full canonical
state equality, the unchanged faster nominal durations, and actual intermediate
rendered angles for the 250 ms and adaptive paths. This checks real legal motion
and canvas synchronization, not a delayed DOM label after early settlement.

Deterministic cases cover timer/RAF completion races, terminal-tick ordering,
released holds, nondecreasing rate changes, initially infeasible-to-feasible
attachment, reduced-motion changes, stale full sources, and a blocked callback.
Browser cases also replay actual moves after Reset, paused reconciliation, and
retiming. Exact live-readout assertions explicitly sample the existing pageshow
handler and avoid floating-point whole-second boundaries while preserving the
clock arithmetic and physical target assertions.

These are foreground observations on the test machine. They do not establish a
portable scheduling guarantee. The immutable route, all 360 states, Counter's
339-HTM paths, the actual 331-HTM ordinary countdown, and production path checks
remain required.

## Final local validation

The [acceptance summary](assets/issue-30-deadlines/acceptance-summary.json) records
production source `06e392ed93775b9b87148d334c82c915ac87dc61` and the observations'
actual timestamps. Its complete local checks passed: **94 Node tests, 43 Python
tests, 18 copied source-verifier controls, 85 browser cases, 5 production Pages
cases, and 4 preview cases**, plus build and typecheck. The 85-case run took
9.1 minutes. Both 339-HTM Counter sweeps and the 331-HTM ordinary Timer replay
remain unchanged. All three viewport frame samples measured 0 px slider movement.

| Observed case | Nominal move | Canonical render relative to T | Verified commit relative to T |
| --- | --- | --- | --- |
| Countdown 250 ms | 250 ms | +2.4 ms | +3.0 ms |
| Countdown 2000 ms | 919.4 ms | +1.5 ms | +2.0 ms |
| Countdown 10 ms | 10 ms | +2.1 ms | +2.7 ms |
| Stopwatch 250 ms | 250 ms | +4.0 ms | +4.5 ms |
| Terminal 250 ms | 250 ms | +1.9 ms | +2.7 ms |

All five observed endpoints met the accepted 20 ms tolerance, with the live
readout updated at the verified commit. The linked raw data retain intermediate
rendered angles and exact clock deadlines; these observations do not bound
background or blocked-main-thread scheduling.
