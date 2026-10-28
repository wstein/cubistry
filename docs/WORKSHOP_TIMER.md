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
**Reset**. Start applies a valid edited countdown duration; invalid input cannot
silently start the previous duration. Enter also sets the duration. Reset returns
to the configured countdown duration or Stopwatch zero. Changing mode stops and
resets the clock, discards an unapplied duration draft and requests that mode's
initial physical target. It never interrupts a face turn or resets session moves.

**Timer speed** (1×, 10×, 20×, 50×, 100×) belongs in the right-hand controls and
changes virtual time only. Changing rate integrates elapsed time at the old rate
using one monotonic sample before anchoring the new rate. Pauses retain fractions;
interval callbacks do not accumulate drift. The selected multiplier remains when
switching modes within this application.

**Rotation Speed** stays beneath the cube with its six existing presets. Switching
applications while physically idle applies **250 ms per move for Timer** and
**100 ms for Counter**. Rotation changes within Timer do not overwrite Counter's
saved value/format/speed record. No new cross-application preference persistence
is implied. Mode changes retain the current rotation setting and do not change
an in-flight animation. Reload returns to the saved idle Counter and never
silently resumes a Timer deadline.

## Physical synchronization

Playback has one active legal target and one replaceable latest target. An active
sequence always finishes. Faster virtual ticks may replace the pending target,
so accelerated or background playback can skip intermediate *displays*, never
individual moves inside an active sequence or its verification. The logical time
and a separate synchronization indicator distinguish the clock from the last
settled physical display.

Pause freezes time immediately, finishes the active target, then settles to the
frozen bucket. Reset and mode changes use the same bounded policy. At either
terminal boundary the clock stops; completion/limit reached is reported only when
the exact physical 00:00/59:50 state is verified. Until then, status says settling.
A matching visible face alone never grants certified-edge eligibility.

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

Real no-reduced-motion five-move observations were roughly 1.5 seconds at 250 ms,
0.7 seconds at 100 ms, and 10.3 seconds at 2,000 ms. The slow edge exceeds a
normal ten-second tick. These are hardware-dependent observations, not timing
guarantees; bounded catch-up remains necessary.

A real interactive **100×** full-range exercise used the visible speed selector
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
