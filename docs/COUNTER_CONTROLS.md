# Real Cube counter controls

> Historical controls before Issue #53. The current UI uses
> [Set/Run/Stop and six rotation-speed stops](CUBE_FIRST_UI.md). Auto and the
> separate minute-timer block are superseded in the counter UI.

The prominent Application selector opens directly on **Counter 00–99
(Certified)** at canonical 00, with the permanent COUNTER title and leading
zero. **Counter countdown 10–00** is the same neutral numeric example with a
decrement policy and initial value 10. It is not an MM:SS Break Timer. The
separate 60-minute Break Timer remains deferred to
[issue #30](https://github.com/wstein/cubistry/issues/30); no certification is
transferred to that future application.

There is no personalization/apply step in the normal flow. The underlying
immutable-print/title APIs and label validation remain available and tested.
Application changes configure their associated permanent print, reset the value
and session, and stop automatic progression. Switching is disabled during a
physical sequence, so no half-completed state is discarded.

## Physical format, not a screen overlay

**Leading zero / Blank tens** is one exclusive selector next to Wrap. Blank
tens uses the existing compatible original unpadded print and clearly removes
the certified-route claim. It retains the selected numeric application policy.
Returning to leading zero activates the certified print. Every format change
explicitly configures a new physical print and resets the value/session; no
sticker is replaced while counting. Returning to an application resets its
leading-zero default. The original padded/unpadded profile APIs remain intact.

The certified adjacent route remains exactly 339 HTM over 99 increments, at most
five per edge; reverse transitions restore full states. Setup remains separate.
[Arbitrary-jump planning](COUNTER_ARBITRARY_JUMPS.md) explains why those guarantees
do not apply to all navigation. Go, ±1, ±10 and custom-step controls retain their
behavior, bounds and queue semantics.

## Animation speed

The continuous slider affects visual animation only. The unchanged 1× baseline
is **75 ms per HTM move**. Its slow endpoint is **0.0375×**, giving about two
seconds per move; its fast endpoint is **2×**, about 37.5 ms. Quarter, inverse and
half turns still count one HTM. Adjusting speed during a turn changes the rate
of remaining progress without rewinding, dropping or duplicating that move.
Reduced-motion preferences still bypass interpolated animation. Speed persists
and supports native keyboard controls; it never changes clock deadlines,
physical routes or accounting.

## One Auto toggle

Each numeric application has a fixed one-second wall-clock cadence: Counter
increments, numeric countdown decrements from 10 and stops at 0. There is no
interval input, extra mode selector or new run/pause panel. Turning Auto on
anchors one clock to the current requested value. A delayed/background tick
computes the current target from elapsed time, rather than replaying missed
interval callbacks. The existing controller retains one active target and one
latest desired target, so slow animation cannot create an unbounded queue.
It may reconcile through an arbitrary jump; such a run is not advertised as the
339-HTM adjacent traversal.

Turning Auto off finishes the active legal value, drops queued automatic
progression and reconciles the input to that value. Manual changes remain
available; they explicitly rebase the running Auto clock to the new requested
value. An edited Go input is a draft: automatic ticks continue updating the
physical/logical counter without overwriting that draft. Submitting Go commits
the entered value and rebases Auto from it; explicit numeric actions or new
configuration clear the draft. Stop-after-value, Reset and application/format changes turn Auto off.
Auto is off on reload. Value/application/format/speed persist in a versioned UI
record; obsolete personalization records are not silently reapplied as a hidden
print selection.

The existing whole-minute countdown remains available and retains its deadline,
pause/resume/reset/restore semantics. Starting it turns Auto off; starting Auto
stops the minute countdown. This preserves the existing feature without claiming
that the deferred 60-minute Break Timer has been implemented.

## Verification boundaries

Controller and independent Python checks retain full states, permanent sticker
identities, exact upright frames and committed-only session accounting. Browser
regressions compare all eight reported arbitrary-jump previews with actual moves
and full endpoints, render the entire certified 00→99 traversal, preserve legacy
manual/minute-countdown behavior, exercise application/format/reset/Auto/speed
and mobile controls, and serve production assets beneath `/cubistry/`.

The removed label-form interaction tests are superseded by direct
application/format/speed persistence tests; the domain's Unicode label bounds
and generic text rendering/fitting/cleanup tests remain. No viewer-engine port,
new solver/table, protected research edit or timer-framework redesign is included.
Optional camera work in #37 is deferred because presets exceed a trivial default
parameter adjustment.
