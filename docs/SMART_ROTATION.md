# Smart Rubber Band presentation rotation

[#120](https://github.com/wstein/cubistry/issues/120) extends the presentation boundary from [#110](https://github.com/wstein/cubistry/issues/110). Puzzle state, face turns, immutable artwork, solvers, timers, cameras, clock sizing and shadow geometry retain their existing owners.

## Inspected reuse and differences

CubeAssembler's inspected local revision `1fb217ea2517fae45de7146e51b61bbda4f16c00` and upstream main `01ff47f7018182994283b201d67edbd82fb499c3` both provide `src/core/view/DragInertia.res` and `src/client/view3d/useCubeCamera.ts`. The pure analytic exponential friction uses a 240 ms time constant and a stop threshold of 0.00003 radians/ms. That calculation is adapted to seconds; its MIT copyright notice and adjacent `CUBE_ASSEMBLER_LICENSE.txt` are retained. The Preact hook couples Euler state and automatic spin; it has no stable front-view anchor or settled-delay return. No framework or automatic-spin policy is imported.

Cubistry's shared `SmartRotation` owns presentation orientation only. Smart (default) and Classic use upright `Rx(pitch) * Ry(yaw)` rotation: yaw is unwrapped and unlimited, while pitch is clamped to `±(π/2 − 0.05)` (about ±87.1°). Assembly up therefore projects with zero horizontal tilt and positive vertical direction during normal drag, coast and return. Free Rotation retains full quaternion increments, including roll and upside-down views. Pixel sensitivities remain unchanged. Initial orientations remain size-2 yaw 10° / pitch 7°, Calendar/Picture yaw 0.2 / pitch 0.18 radians, and clock yaw 0.2 / pitch 0.16 radians.

One shared DOM binding serves standalone `CubeViewer`, `CalendarViewer` (including Super Picture), and `ClockStage`. The clock has one controller on its common H–M–S parent; its child cube viewers have none. Lights, ground, fixed cameras, local cube placements, canonical sticker frames and transient layer pivots are unchanged. Existing scene/renderer owners supply the frame loop; the controller creates no competing scheduler.

## State, anchors and timing

The state machine is `idle` / `dragging` / `coasting` / `awaiting-return` / `returning` / `leveling`. Time and angular velocity use seconds, without an 8 ms input floor. Velocity is measured from actual input intervals, smoothed in time and capped by vector magnitude. A stationary hold expires stale release velocity. Outward pitch inertia stops at the exact analytic clamp crossing while yaw continues. Coast integration stops at its analytic threshold crossing; remaining frame time belongs to the subsequent delay. Tests compare 30/60/144 Hz and frames that cross multiple phases.

Smart Rubber Band is the default. The tolerance is always measured from the **front view**: the exact frontal orientation (identity; the observer sits on +Z, so the front face points straight at the user with no deviation). It is neither the application's slightly rotated default view nor an earlier accepted view. The return target (anchor) starts as the default view. A genuine user rotation that settles within 35° quaternion geodesic distance (any direction) of the front view becomes the new target. A rotation that settles beyond 35° waits `returnDelay(distance)` after coast ends, then returns to the **last such target**, not to the front view. A target set by the user therefore never lies farther than 35° from the exact front, and automatic poses, taps and settings never become targets. Ordinary upright return deliberately avoids quaternion SLERP, which can introduce roll between upright endpoints. Quaternion signs are equivalent.

The wait depends on how far the view is stretched: 0.6 s just beyond 35°, shrinking smoothly (smoothstep) to 0.1 s at 120° and beyond. The return is a soft-start critically damped response on yaw (shortest unwrapped difference) and pitch, with the upright quaternion reconstructed every frame: the offset decays as `x(t) = x0 e^(-rt) (1 + rt + (rt)²/2)` with rate `r` = 9 /s. Speed and acceleration are zero at the start, so there is no jolt; speed grows with distance (measured peak about 88/146/219/365°/s from 36/60/90/150°) and the motion decays smoothly without overshoot or backward motion. There is no fixed duration; the response reaches 95% after about 0.7 s and 99% after about 0.94 s for any distance. It ends when the remaining offset is below 0.001 rad. It is analytic and therefore frame-rate independent.

**Viewing the back or other far views:** nothing returns while any contact is held, including a stationary hold, so a far view can be inspected for as long as the pointer stays down; settings, zoom and keyboard activity also pause it. Free Rotation never returns. A far view released in Smart does not rest: it goes back after the short wait.

Taps, wheel/settings activity, mode changes, reduced-motion changes and visibility transitions can interrupt a return. The view then settles where it was: if it is beyond 35° or differs from the target, it waits again (by its distance from the front) and returns to the target. Repeated interruptions cannot walk the anchor, because only a genuine user rotation within 35° of the front can set it.

| Parameter | Default | Purpose |
| --- | --- | --- |
| Damping time constant | 0.24 s | Adapted analytic friction |
| Stop speed | 0.03 rad/s | Finite coast endpoint |
| Maximum combined speed | 6 rad/s | Bounded diagonal flicks |
| Velocity smoothing | 0.04 s | Time-based input filtering |
| Stationary release expiry | 0.1 s | No stale held-pointer flick |
| Spatial tolerance | 35° | Settled quaternion distance from the front view |
| Return wait | 0.6 s at 35° to 0.1 s at 120°+ | After settling; no delay consumed by coasting |
| Return rate | 9 /s | Soft-start critically damped; no fixed duration |
| Return end offset | 0.001 rad | Snap to the return target |

Constants live in `ROTATION_TUNING`. At the maximum released speed, analytic coast lasts at most approximately 1.272 seconds before the return wait. Subjective sensitivity, damping and return feel remain for owner visual review.

## Input, settings and lifecycle

Every viewport pointerdown interrupts immediately before the movement threshold. Once a drag activates, reversal through the initial click deadzone is processed. Multiple contacts hold the orientation until all are released; this adds no implicit pinch zoom. Cancellation/lost capture stops the gesture, and failed capture cannot leave a ghost contact blocking subsequent gestures. Touch scrolling is disabled only on the viewer surface and restored on disposal. Existing explicit zoom remains separate and interrupts automatic motion without changing orientation; resize does not alter orientation or anchor.

The existing Appearance panel now contains an accessible native rotation selector: Smart Rubber Band, Free Rotation (inertia without return), or Classic (direct rotation without inertia/return). Mode changes preserve the displayed quaternion immediately. Leaving a rolled Free view requests a one-second explicit leveling bridge to the closest allowed upright quaternion. An analytic maximum-dot projection chooses the target, with deterministic ties. Bridge-only SLERP permits a continuous path from arbitrary roll; it is separate from the autonomous rubber-band return and cannot create an anchor candidate. A genuine prior Free or Classic gesture keeps its existing candidate through the mode change and any leveling; acceptance still waits for complete settling.

Pointerdown freezes the exact displayed bridge quaternion. While interrupted, upright drag changes the target yaw/pitch while retaining the frozen residual orientation, without adding roll. Release resumes the already requested leveling; a tap retains the original target. After leveling settles, only a genuine user drag can propose an anchor, and any owed Smart return wait starts then. Switching to Free cancels leveling and preserves the displayed pose. Per-page versioned/bounded localStorage preferences use the same mechanism as existing viewer appearance; failures fall back safely. Held panel pointers freeze return/leveling until all panel and canvas contacts end, including outside releases. Document release/cancel/lost-capture listeners and window blur/focus/visibility handling prevent ghost holds and overlap takeover. Keyboard/input activity interrupts motion without intercepting native control behavior. No new canvas arrow-key handler conflicts with Counter's puzzle shortcuts.

Reduced Smart still classifies settled views against the 35° tolerance; views beyond it stay without autonomous motion. This also applies after the requested 150 ms leveling finishes. Re-enabling motion returns a view that differs from the return target (for example one beyond the tolerance) to that target.

`prefers-reduced-motion` disables inertia and automatic return, including live preference changes, with an explanatory control note. An explicitly requested upright mode change still levels gently over 150 ms under reduced motion; it does not leave a rolled view permanently stranded. Pointer interruption freezes/resumes only this already requested transition. Visibility suspension freezes the displayed orientation and discards motion/countdowns; resume starts a fresh settled delay when return is owed, without consuming hidden wall time or accepting an automatic pose. Reset restores the defined initial view and anchor while retaining explicit zoom and puzzle state. Disposal releases pointer capture, pointer/panel/media/visibility listeners and added settings controls.

## Verification and acceptance boundary

Focused Node checks:

```sh
node --test tests/upright-rotation.test.mjs tests/smart-rotation.test.mjs tests/rotation-binding.test.mjs tests/presentation-rotation.test.mjs tests/clock-framing.test.mjs tests/viewer-rendering.test.mjs tests/appearance.test.mjs
```

These exercise upright yaw/pitch and pole limits, closest-target projection against an independent grid, shortest-yaw return without roll, normal/reduced explicit leveling, frame-independent pitch stops, low/high-speed and held input, diagonal caps, exact stop/delay timing, the distance-dependent wait, holding a far view, soft-start return (monotone, faster when farther, no fixed duration), spatial 34°/35°/36° decisions against the front view, the last accepted target and its bound, and sign/precision cases, full-quaternion interruption, touch overlap, capture failure, settings/storage faults, reduced motion, visibility and cleanup. Actual shared-clock construction with three configured viewers verifies rear/bottom inspection, rigid placements, stationary camera, all immutable sticker normal/up frames, active layer pivots, coast/return and shared reset. Existing solver replay, timer and Calendar tests remain part of `npm test`; run `npm run typecheck`, `npm run build`, and repository `npm run check` separately with actual exit statuses.

`tests/browser/smart-rotation.spec.mjs` adds browser regression source for settled tolerance, inertia/modes, tap interruption, real touch input and the rigid clock. Its syntax is checked only: **browser/E2E tests have NOT RUN** under the session restriction. Existing browser assertions/containment thresholds are retained. No screenshots or recordings are captured and no visual pass is claimed.

| Behavior | Deterministic evidence | Owner/browser acceptance |
| --- | --- | --- |
| Small settled view retained | Quaternion/state tests | Drag feel pending |
| Outside view returns to last anchor | Analytic timing/provenance tests | Easing feel pending |
| Interruption/touch/settings | Real production binding with synthetic events | Native browser interaction pending |
| Canonical frames/layer turns/clock | Actual scene and playback integration | WebGL inspection pending |
| Reduced motion/lifecycle/reset | Media/visibility/capture and owner-method tests | Platform behavior pending |

Owner checks must include low/fast mouse and touch drags, a held release, small/large diagonal adjustments, tap interruption during the delay and return, repeated gestures, mode/settings keyboard use, reduced motion, hidden/resume, zoom/resize/reset, 2×2/3×3 picture orientation, the rigid whole-clock arrangement, and simultaneous legal puzzle/timer playback. Captured before/after visual evidence and real browser regressions remain outstanding. Keep Draft; no author Ready, merge or deployment.

## Owner-approved supersession

The initial handoff used unrestricted quaternion rotation in Smart mode and a five-second wait. The owner's 2026-10-30 follow-up explicitly supersedes those choices with upright Smart/Classic rotation for every cube and a two-second settled wait. Free remains optional. The 25° spatial anchor, one-second return, physical-state boundary and fixed observer remain. Earlier exact-head reviews are historical evidence and do not clear this follow-up; new final-head review is required.

## Owner-approved supersession (front-based tolerance, 35°, spring, distance-dependent wait)

The owner's 2026-10-31 follow-up supersedes the 25° tolerance measured from the last accepted anchor, the fixed one-second quintic return and the fixed two-second wait. The tolerance is now 35° and always measured from the exact frontal view (not the rotated default view, and not an earlier accepted view); the return still goes to the last view that settled within it, initially the default view. The wait shrinks with distance from the front (0.6 s to 0.1 s) and the return is a soft-start damped response without a fixed duration. Viewing a far side stays possible by holding the pointer or in Free Rotation. Subjective feel (rate 9 /s, wait bounds 0.6/0.1 s, 120° reference) remains for owner visual review; browser tests, including the updated `tests/browser/smart-rotation.spec.mjs`, have NOT RUN.
