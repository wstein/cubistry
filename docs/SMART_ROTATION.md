# Smart Rubber Band presentation rotation

[#120](https://github.com/wstein/cubistry/issues/120) extends the presentation boundary from [#110](https://github.com/wstein/cubistry/issues/110). Puzzle state, face turns, immutable artwork, solvers, timers, cameras, clock sizing and shadow geometry retain their existing owners.

## Inspected reuse and differences

CubeAssembler's inspected local revision `1fb217ea2517fae45de7146e51b61bbda4f16c00` and upstream main `01ff47f7018182994283b201d67edbd82fb499c3` both provide `src/core/view/DragInertia.res` and `src/client/view3d/useCubeCamera.ts`. The pure analytic exponential friction uses a 240 ms time constant and a stop threshold of 0.00003 radians/ms. That calculation is adapted to seconds; its MIT copyright notice and adjacent `CUBE_ASSEMBLER_LICENSE.txt` are retained. The Preact hook couples Euler state and automatic spin; it has no stable front-view anchor or settled-delay return. No framework or automatic-spin policy is imported.

Cubistry's shared `SmartRotation` owns presentation orientation only. Smart (default) and Classic use upright `Rx(pitch) * Ry(yaw)` rotation: yaw is unwrapped and unlimited, while pitch is clamped to `±(π/2 − 0.05)` (about ±87.1°). Assembly up therefore projects with zero horizontal tilt and positive vertical direction during normal drag, coast and return. Free Rotation retains full quaternion increments, including roll and upside-down views. Pixel sensitivities remain unchanged. Initial orientations remain size-2 yaw 10° / pitch 7°, Calendar/Picture yaw 0.2 / pitch 0.18 radians, and clock yaw 0.2 / pitch 0.16 radians.

One shared DOM binding serves standalone `CubeViewer`, `CalendarViewer` (including Super Picture), and `ClockStage`. The clock has one controller on its common H–M–S parent; its child cube viewers have none. Lights, ground, fixed cameras, local cube placements, canonical sticker frames and transient layer pivots are unchanged. Existing scene/renderer owners supply the frame loop; the controller creates no competing scheduler.

## State, anchors and timing

The state machine is `idle` / `dragging` / `coasting` / `awaiting-return` / `returning` / `leveling`. Time and angular velocity use seconds, without an 8 ms input floor. Velocity is measured from actual input intervals, smoothed in time and capped by vector magnitude. A stationary hold expires stale release velocity. Outward pitch inertia stops at the exact analytic clamp crossing while yaw continues. Coast integration stops at its analytic threshold crossing; remaining frame time belongs to the subsequent delay. Tests compare 30/60/144 Hz and frames that cross multiple phases.

Smart Rubber Band is the default. The anchor is always the application's defined initial quaternion, the **front view**; no gesture, tap or return ever moves it. After inertia settles, a view within 35° quaternion geodesic distance (any direction) of the front view stays. Beyond 35°, wait two seconds after coast ends, then spring back to the front view. Ordinary upright return deliberately avoids quaternion SLERP, which can introduce roll between upright endpoints. Quaternion signs are equivalent.

The return is a critically damped spring on yaw (shortest unwrapped difference) and pitch, starting at rest: the offset decays as `x(t) = x0 (1 + wt) e^(-wt)` with natural frequency `w` = 7 rad/s, so the upright quaternion is reconstructed every frame. Speed grows with distance (measured peak about 103/232/386°/s from 40/90/150°) and the motion decays smoothly without overshoot. There is no fixed duration; a linear spring reaches 95% after about 0.7 s and 99% after about 1 s for any distance. The return ends when the remaining offset is below 0.001 rad. It is analytic and therefore frame-rate independent.

Taps, wheel/settings activity, mode changes, reduced-motion changes and visibility transitions can interrupt a return. The view then stays where it was: within 35° of the front it remains, beyond it waits two seconds and springs again. Repeated interruptions cannot walk the anchor, because it never moves.

| Parameter | Default | Purpose |
| --- | --- | --- |
| Damping time constant | 0.24 s | Adapted analytic friction |
| Stop speed | 0.03 rad/s | Finite coast endpoint |
| Maximum combined speed | 6 rad/s | Bounded diagonal flicks |
| Velocity smoothing | 0.04 s | Time-based input filtering |
| Stationary release expiry | 0.1 s | No stale held-pointer flick |
| Spatial tolerance | 35° | Settled quaternion distance from the front view |
| Idle delay | 2 s after settling | No delay consumed by coasting |
| Return spring frequency | 7 rad/s | Critically damped; no fixed duration |
| Return end offset | 0.001 rad | Snap to the front view |

Constants live in `ROTATION_TUNING`. At the maximum released speed, analytic coast lasts at most approximately 1.272 seconds before the two-second delay. Subjective sensitivity, damping and return feel remain for owner visual review.

## Input, settings and lifecycle

Every viewport pointerdown interrupts immediately before the movement threshold. Once a drag activates, reversal through the initial click deadzone is processed. Multiple contacts hold the orientation until all are released; this adds no implicit pinch zoom. Cancellation/lost capture stops the gesture, and failed capture cannot leave a ghost contact blocking subsequent gestures. Touch scrolling is disabled only on the viewer surface and restored on disposal. Existing explicit zoom remains separate and interrupts automatic motion without changing orientation; resize does not alter orientation or anchor.

The existing Appearance panel now contains an accessible native rotation selector: Smart Rubber Band, Free Rotation (inertia without return), or Classic (direct rotation without inertia/return). Mode changes preserve the displayed quaternion immediately. Leaving a rolled Free view requests a one-second explicit leveling bridge to the closest allowed upright quaternion. An analytic maximum-dot projection chooses the target, with deterministic ties. Bridge-only SLERP permits a continuous path from arbitrary roll; it is separate from the autonomous rubber-band return and cannot create an anchor candidate. A genuine prior Free or Classic gesture keeps its existing candidate through the mode change and any leveling; acceptance still waits for complete settling.

Pointerdown freezes the exact displayed bridge quaternion. While interrupted, upright drag changes the target yaw/pitch while retaining the frozen residual orientation, without adding roll. Release resumes the already requested leveling; a tap retains the original target. After leveling settles, only a genuine user drag can propose an anchor, and any owed two-second Smart delay starts then. Switching to Free cancels leveling and preserves the displayed pose. Per-page versioned/bounded localStorage preferences use the same mechanism as existing viewer appearance; failures fall back safely. Held panel pointers freeze return/leveling until all panel and canvas contacts end, including outside releases. Document release/cancel/lost-capture listeners and window blur/focus/visibility handling prevent ghost holds and overlap takeover. Keyboard/input activity interrupts motion without intercepting native control behavior. No new canvas arrow-key handler conflicts with Counter's puzzle shortcuts.

Reduced Smart still classifies settled views against the 35° tolerance; views beyond it stay without autonomous motion. This also applies after the requested 150 ms leveling finishes. Re-enabling motion returns an outside view to the front view.

`prefers-reduced-motion` disables inertia and automatic return, including live preference changes, with an explanatory control note. An explicitly requested upright mode change still levels gently over 150 ms under reduced motion; it does not leave a rolled view permanently stranded. Pointer interruption freezes/resumes only this already requested transition. Visibility suspension freezes the displayed orientation and discards motion/countdowns; resume starts a fresh settled delay when return is owed, without consuming hidden wall time or accepting an automatic pose. Reset restores the defined initial view and anchor while retaining explicit zoom and puzzle state. Disposal releases pointer capture, pointer/panel/media/visibility listeners and added settings controls.

## Verification and acceptance boundary

Focused Node checks:

```sh
node --test tests/upright-rotation.test.mjs tests/smart-rotation.test.mjs tests/rotation-binding.test.mjs tests/presentation-rotation.test.mjs tests/clock-framing.test.mjs tests/viewer-rendering.test.mjs tests/appearance.test.mjs
```

These exercise upright yaw/pitch and pole limits, closest-target projection against an independent grid, shortest-yaw return without roll, normal/reduced explicit leveling, frame-independent pitch stops, low/high-speed and held input, diagonal caps, exact stop/delay timing, spring return (monotone, faster when farther, no fixed duration), spatial 34°/35°/36° decisions against the front view, a fixed anchor and sign/precision cases, full-quaternion interruption, touch overlap, capture failure, settings/storage faults, reduced motion, visibility and cleanup. Actual shared-clock construction with three configured viewers verifies rear/bottom inspection, rigid placements, stationary camera, all immutable sticker normal/up frames, active layer pivots, coast/return and shared reset. Existing solver replay, timer and Calendar tests remain part of `npm test`; run `npm run typecheck`, `npm run build`, and repository `npm run check` separately with actual exit statuses.

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

The initial handoff used unrestricted quaternion rotation in Smart mode and a five-second wait. The owner's 2026-10-30 follow-up explicitly supersedes those choices with upright Smart/Classic rotation for every cube and a two-second settled wait. Free remains optional. The physical-state boundary and fixed observer remain. Earlier exact-head reviews are historical evidence and do not clear this follow-up; new final-head review is required.

## Owner-approved supersession (front view, 35°, spring)

The owner's 2026-10-31 follow-up supersedes the 25° settled-anchor rule and the fixed one-second quintic return. The tolerance is now 35° and always measured from the front view, never from an earlier accepted view. The return is a damped spring without a fixed duration. The two-second settled wait is unchanged and still owner-reviewable. Subjective spring feel (frequency 7 rad/s) remains for owner visual review; browser tests, including the updated `tests/browser/smart-rotation.spec.mjs`, have NOT RUN.
