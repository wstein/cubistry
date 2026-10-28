# 60-Minute Timer

The separate **60-Minute Timer** application uses one immutable 24-sticker print:
minutes above seconds, supporting **00:00–59:50** in ten-second steps. Its name
does not imply a 60:00 display. Counter remains the default application.

## Controls and clocks

**Countdown** defaults to 15:00. **Stopwatch** starts at 00:00 and stops at 59:50
without wrapping. Both use the same monotonic, anchored virtual clock, physical
controller and fixed print. Countdown rounds remaining time up to ten seconds;
Stopwatch shows completed ten-second intervals. For example, pausing Stopwatch
at 12.5 seconds shows 00:10 but retains the extra 2.5 seconds for Resume. The
cube does not claim single-second precision.

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
is implied. Mode changes retain the current rotation setting and do not change
an in-flight animation. Reload returns to the saved idle Counter and never
silently resumes a Timer deadline.

## Physical synchronization

For a scheduled ten-second boundary, playback prepares the exact legal word from
its full committed source state and starts **before** the boundary. Countdown's
ceiling and Stopwatch's floor remain logical clock rules: the physical next
bucket can intentionally appear early. Once its complete canonical state is
verified, the cube holds that state until the boundary instead of turning back.

Let `I = 10000 / Timer speed` milliseconds, `N` be the prepared move count, and
`B = min(I / 2, deadline - preparationFinishedAt)`. The preferred duration is the
slider value. The scheduler reserves **75 ms per move** for frame/render/commit
work plus **8 ms** for dispatch, then uses:

```text
overhead = 75 * N + 8
effective = min(preferred, max(10, (B - overhead) / N))
plannedSequenceDuration = overhead + N * effective
startAt = deadline - plannedSequenceDuration
```

For feasible budgets, this includes overhead within half the interval and never
slows a faster preference. A normal five-move edge at a 2,000 ms preference uses
923.4 ms nominal turns within a 5,000 ms planned sequence. A 250 ms preference
stays 250 ms; a 10 ms preference stays 10 ms. A guarded one-shot wake targets the
absolute start time; the existing 50 ms polling callback only reconciles clocks
and delayed work. Preparation time is included by resampling the same monotonic
clock after preparation. A prepared word is reused only if its complete source
state still matches, including hidden sticker poses.

Playback retains one active legal target and one replaceable latest target. An
active sequence always finishes. Faster virtual ticks may replace the pending
target, so accelerated or background playback can skip intermediate *displays*,
never moves inside an active sequence or its verification. **Moving** includes an
intentional early next target. **Synchronizing** means a genuine mismatch with
the current or planned target; it shows the last settled time. An idle cube that
has already verified the next target has no backlog message. The reserved
two-line status shows effective speed and **Budget infeasible** or **Late** when
applicable; slider preference and control position remain stable.

A budget is infeasible under this calibrated policy if `overhead + 10 * N > B`.
The scheduler keeps legal 10 ms nominal turns while running and uses the same
bounded latest-target catch-up. This is not a proof that faster hardware cannot
fit the word. At 100×, the interval is 100 ms and its half budget is 50 ms. Even
without render work, five turns requiring one animation frame each need about
83 ms at 60 Hz. The current conservative render allowance also rejects a
one-move 100× half budget. Actual browser refresh rates and scheduling vary;
no browser or OS timing guarantee is claimed, especially in background tabs.
A missed scheduled boundary remains visibly late until physical verification.
Ordinary stopped-clock Set, Reset, or paused settling does not invent a missed
deadline.

Pause freezes the logical clock immediately. If playback has started or already
settled the next bucket early, it finishes the legal target and then returns to
the frozen bucket using actual moves. Resume retains the fraction and replans
against the time still available. Reset, Set, and mode changes invalidate future
plans and reconcile their stopped target through the same legal bounded policy.
Unstarted plans are recomputed after rate or rotation preference changes; an
active sequence is never canceled, and its remaining budget is reassessed.
At a terminal boundary completion/limit reached is reported only after the exact
physical 00:00/59:50 state is verified. Until then, status says settling.

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

## UX acceptance evidence

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

## Deadline acceptance evidence

The [foreground observations](assets/issue-30-deadlines/foreground-observations.json)
record actual monotonic start, deadline, and settled timestamps for five-move
countdown transitions at preferred 250 ms, 2,000 ms, and 10 ms. Browser assertions
compare the full final physical state with its canonical target and require its
verified settled callback at or before the deadline. They additionally inspect
the viewer's nominal durations: the faster 250 ms and 10 ms preferences stay
unchanged, while 2,000 ms adapts. These are foreground observations on the test
machine, not portable timing guarantees.

The initial 17 ms per-move allowance passed the 250 ms and adaptive 2,000 ms
cases but missed a 10 ms case by **53.3 ms**. The 75 ms allowance incorporates
the earlier measured 33–55 ms per-move overhead with additional margin. This
calibration failure is not suppressed or presented as successful evidence.

New regressions cover infeasible 100×/10 ms playback with independent full move
replay, active and already-settled early-target pause/resume, never-started Set
without a false Late warning, preparation that crosses a deadline, stale hidden
sources, all rates in both clock directions, and rate/speed plan invalidation.
The existing immutable path, all 360 states, Counter, and production path tests
remain required.

The held-slider tests include early movement, accelerated backlog and effective
speed/warning text in the same reserved two-line area. Raw new-stage geometry:
[1280 px](assets/issue-30-deadlines/slider-1280.json),
[390 px](assets/issue-30-deadlines/slider-390.json), and
[320 px](assets/issue-30-deadlines/slider-320.json). The earlier screenshots and
observations above retain their original provenance.
