# Counter move progress — issue #23, Phase A

This focused change depends directly on PR #20 at `507fb46`, not PR #22. It
counts the existing physical counter paths; it changes neither solver, fixed
printing, mechanics nor timer implementation.

## Metric and state contract

The display shows **completed / planned moves**. The metric is HTM: `R`, `R2`
and `R'` each count as one legal outer-face token; `R R2 R'` counts as three.
Frames, animation duration, camera motion and internal quarter-turn calculations
do not count. The complete total is published before the first animation starts.
A move advances the completed count only after the viewer's animation promise
resolves and the authoritative core state commits its `to` state.

The controller exposes immutable `MoveProgress` snapshots, also passed as an
optional fourth argument to its existing state callback. Target changes remain
latest-wins **behind the current plan**. While 42 is being executed and 44 is
queued, both the displayed total and completed count still describe the active
42 plan. The next plan publishes a fresh 0 / N when it actually starts. The
last completed plan stays at N / N. A same-value idle request is a new no-op:
0 / 0. Successful print configuration starts at 0 / 0; a failed configuration
retains the old state and metrics.

`currentValue` means the last complete display, not an intermediate physical
face during playback. The authoritative `state` records each committed move.
If an animation rejects, its uncommitted token is excluded: the counter retains
k / N with failed status and requires recovery. It never claims N / N success
or clears failure metrics to zero.

## Stop and reset policy

**Stop after this value** finishes the active legal plan, discards queued values
and stops timer updates through the existing manual-reset behavior. The numeric
input and saved value/timer are reconciled to that active value without making
another controller request. The button explicitly does not promise immediate
mid-turn cancellation. Its final state is a complete upright known display;
subsequent plans therefore start from the actual canonical state, not an
incorrect assumption about a partially executed word. A later explicit value
request may override the stop and queue new work normally.

Timer Reset keeps its existing meaning: request the timer's initial value.
During active playback this queues behind the current plan. It neither
teleports the cube nor clears the active move count. Applying a new print stays
disabled during playback and resets progress only after successful setup.

The progress bar exposes committed/total values and a readable HTM label.
Per-token updates are not live announcements; the separate polite status only
changes when its message changes. The stop control and count wrap on small
screens. Camera controls and timer behavior remain unchanged.

## Path limitation and separate Phase B scope

The actual path remains `inverse(witness[current]) + witness[target]`, through
the common reference state. All its executed tokens count, including any hub
detour. These are independently verified legal paths, **not shortest HTM
paths**. See [issue #23](https://github.com/wstein/cubistry/issues/23) and the
non-blocking review findings on [PR #20](https://github.com/wstein/cubistry/pull/20)
and [PR #22](https://github.com/wstein/cubistry/pull/22).

The updated issue #23 (2026-10-27T17:03:37Z) authorizes a **separate** Phase B
integration of CubeLab's existing `Optimal2x2Solver`, canonical/frame helpers
and checked-in table, with Cubacle as an alternative only if simpler. That
follow-up will replace the hub route with actual current-state → selected
complete target-state solving and exact-frame replay. It must not invent a
solver/table, run an exhaustive benchmarking campaign, or claim optimality for
any valid partial printed display. No Phase B code or external repository edit
is included here; Phase A reports the current actual route honestly.

## Verification

```sh
npm ci --cache /tmp/cubistry-npm-cache
npm run check
PLAYWRIGHT_BROWSERS_PATH=/tmp/cubistry-playwright CI=1 npx playwright test --config playwright.phase-a.config.mjs
```

The isolated config defaults to port 5183 and accepts `PLAYWRIGHT_PORT` so a
reviewer's server cannot be reused accidentally. Unit tests cover HTM notation,
held renderer commits, latest-wins queuing, stop/completion, reset, failed turns
and configuration. Browser regressions hold and release the real viewer's turn
promises, then execute its normal animation; they check visible counts, queued
targets, timer/input persistence, reset, accessibility and mobile layout. The
existing proof, printing, timer and renderer checks remain in the full suite.
