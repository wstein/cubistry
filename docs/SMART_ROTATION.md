# Smart Rubber Band presentation rotation

[#120](https://github.com/wstein/cubistry/issues/120) extends the presentation boundary from [#110](https://github.com/wstein/cubistry/issues/110). Puzzle state, face turns, immutable artwork, solvers, timers, cameras, clock sizing and shadow geometry retain their existing owners.

## Inspected reuse and differences

CubeAssembler's inspected local revision `1fb217ea2517fae45de7146e51b61bbda4f16c00` and upstream main `01ff47f7018182994283b201d67edbd82fb499c3` both provide `src/core/view/DragInertia.res` and `src/client/view3d/useCubeCamera.ts`. The pure analytic exponential friction uses a 240 ms time constant and a stop threshold of 0.00003 radians/ms. That calculation is adapted to seconds; its MIT copyright notice and adjacent `CUBE_ASSEMBLER_LICENSE.txt` are retained. The Preact hook couples Euler state and automatic spin; it has no stable 25° quaternion anchor or settled-delay return. No framework or automatic-spin policy is imported.

Cubistry's new `SmartRotation` owns only a presentation quaternion. View-space +X follows downward drag and +Y follows rightward drag, retaining each viewport's pixel sensitivity. It uses full quaternion increments rather than Euler/polar clamps, so interruption preserves intermediate roll and the whole object remains inspectable. Initial orientations remain size-2 yaw 10° / pitch 7°, Calendar/Picture yaw 0.2 / pitch 0.18 radians, and clock yaw 0.2 / pitch 0.16 radians.

One shared DOM binding serves standalone `CubeViewer`, `CalendarViewer` (including Super Picture), and `ClockStage`. The clock has one controller on its common H–M–S parent; its child cube viewers have none. Lights, ground, fixed cameras, local cube placements, canonical sticker frames and transient layer pivots are unchanged. Existing scene/renderer owners supply the frame loop; the controller creates no competing scheduler.

## State, anchors and timing

The state machine is `idle` / `dragging` / `coasting` / `awaiting-return` / `returning`. Time and angular velocity use seconds, without an 8 ms input floor. Velocity is measured from actual input intervals, smoothed in time and capped by vector magnitude. A stationary hold expires stale release velocity. Coast integration stops at its analytic threshold crossing; remaining frame time belongs to the subsequent delay. Tests compare 30/60/144 Hz and frames that cross multiple phases.

Smart Rubber Band is the default. The anchor starts at the application's defined initial quaternion. A genuine user rotation proposes an anchor candidate: after inertia settles, accept it only within 25° quaternion geodesic distance of the last accepted anchor. Otherwise retain the anchor, wait two seconds after coast ends, then return along the shortest quaternion path over one second. Quaternion signs are equivalent. Quintic ease-in-out has zero first and second derivatives at both return endpoints and does not overshoot.

Automatic interpolation never creates an anchor candidate. Taps, wheel/settings activity, mode changes, reduced-motion changes and visibility transitions can interrupt return but cannot promote its intermediate pose to an anchor, even once that pose is within 25°. A new nonzero user drag can propose a new candidate. Thus repeated interruptions cannot walk the accepted anchor through automatic poses.

| Parameter | Default | Purpose |
| --- | --- | --- |
| Damping time constant | 0.24 s | Adapted analytic friction |
| Stop speed | 0.03 rad/s | Finite coast endpoint |
| Maximum combined speed | 6 rad/s | Bounded diagonal flicks |
| Velocity smoothing | 0.04 s | Time-based input filtering |
| Stationary release expiry | 0.1 s | No stale held-pointer flick |
| Spatial tolerance | 25° | Settled quaternion distance |
| Idle delay | 2 s after settling | No delay consumed by coasting |
| Return duration | 1 s | Approved 0.8–1.2 s tuning range |

Constants live in `ROTATION_TUNING`. At the maximum released speed, analytic coast lasts at most approximately 1.272 seconds before the two-second delay. Subjective sensitivity, damping and return feel remain for owner visual review.

## Input, settings and lifecycle

Every viewport pointerdown interrupts immediately before the movement threshold. Once a drag activates, reversal through the initial click deadzone is processed. Multiple contacts hold the orientation until all are released; this adds no implicit pinch zoom. Cancellation/lost capture stops the gesture, and failed capture cannot leave a ghost contact blocking subsequent gestures. Touch scrolling is disabled only on the viewer surface and restored on disposal. Existing explicit zoom remains separate and interrupts automatic motion without changing orientation; resize does not alter orientation or anchor.

The existing Appearance panel now contains an accessible native rotation selector: Smart Rubber Band, Free Rotation (inertia without return), or Classic (direct rotation without inertia/return). Mode changes preserve the displayed quaternion. Per-page versioned/bounded localStorage preferences use the same mechanism as existing viewer appearance; failures fall back safely. Pointer/keyboard/input activity in that panel cancels automatic motion without intercepting native control behavior. No new canvas arrow-key handler conflicts with Counter's puzzle shortcuts.

`prefers-reduced-motion` disables inertia and automatic return, including live preference changes, with an explanatory control note. Visibility suspension freezes the displayed orientation and discards motion/countdowns; resume starts a fresh settled delay when return is owed, without consuming hidden wall time or accepting an automatic pose. Reset restores the defined initial view and anchor while retaining explicit zoom and puzzle state. Disposal releases pointer capture, pointer/panel/media/visibility listeners and added settings controls.

## Verification and acceptance boundary

Focused Node checks:

```sh
node --test tests/smart-rotation.test.mjs tests/rotation-binding.test.mjs tests/presentation-rotation.test.mjs tests/clock-framing.test.mjs tests/viewer-rendering.test.mjs tests/appearance.test.mjs
```

These exercise low/high-speed and held input, diagonal caps, exact stop/delay/return timing, spatial 24°/25°/26° decisions, last accepted anchors and sign/precision cases, full-quaternion interruption, every anchor-provenance path, touch overlap, capture failure, settings/storage faults, reduced motion, visibility and cleanup. Actual shared-clock construction with three configured viewers verifies rear/bottom inspection, rigid placements, stationary camera, all immutable sticker normal/up frames, active layer pivots, coast/return and shared reset. Existing solver replay, timer and Calendar tests remain part of `npm test`; run `npm run typecheck`, `npm run build`, and repository `npm run check` separately with actual exit statuses.

`tests/browser/smart-rotation.spec.mjs` adds browser regression source for settled tolerance, inertia/modes, tap interruption, real touch input and the rigid clock. Its syntax is checked only: **browser/E2E tests have NOT RUN** under the session restriction. Existing browser assertions/containment thresholds are retained. No screenshots or recordings are captured and no visual pass is claimed.

| Behavior | Deterministic evidence | Owner/browser acceptance |
| --- | --- | --- |
| Small settled view retained | Quaternion/state tests | Drag feel pending |
| Outside view returns to last anchor | Analytic timing/provenance tests | Easing feel pending |
| Interruption/touch/settings | Real production binding with synthetic events | Native browser interaction pending |
| Canonical frames/layer turns/clock | Actual scene and playback integration | WebGL inspection pending |
| Reduced motion/lifecycle/reset | Media/visibility/capture and owner-method tests | Platform behavior pending |

Owner checks must include low/fast mouse and touch drags, a held release, small/large diagonal adjustments, tap interruption during the delay and return, repeated gestures, mode/settings keyboard use, reduced motion, hidden/resume, zoom/resize/reset, 2×2/3×3 picture orientation, the rigid whole-clock arrangement, and simultaneous legal puzzle/timer playback. Captured before/after visual evidence and real browser regressions remain outstanding. Keep Draft; no author Ready, merge or deployment.
