# Smart Rubber Band presentation rotation

Source decision for [#120](https://github.com/wstein/cubistry/issues/120). This extends the presentation boundary from [#110](https://github.com/wstein/cubistry/issues/110), without changing puzzle state, face turns, immutable artwork, solvers, cameras, clock sizing or shadow geometry.

## Inspected reuse

CubeAssembler's inspected local revision `1fb217ea2517fae45de7146e51b61bbda4f16c00` and current upstream main `01ff47f7018182994283b201d67edbd82fb499c3` both provide `src/core/view/DragInertia.res` and `src/client/view3d/useCubeCamera.ts`. The pure analytic exponential friction uses a 240 ms time constant and a stop threshold of 0.00003 radians/ms. That calculation is suitable for adaptation to seconds, with the existing MIT notice retained. The Preact hook couples Euler view state and automatic spin; it has no stable 25° quaternion anchor or settled-delay return. Importing that framework or copying its automatic-spin policy would not implement the approved behavior.

Cubistry already has one presentation parent for each standalone 2×2/3×3 viewer and one common parent for the entire H–M–S row. The new controller will own only that parent's quaternion. Lights, ground, fixed cameras, local cube placements, canonical sticker frames and transient layer pivots remain under their existing owners. The size-2 default, Calendar/Picture default and clock default orientations remain distinct.

## Shared controller contract

One application-neutral controller owns `idle`, `dragging`, `coasting`, `awaiting-return`, and `returning`. Drag increments and angular velocity use view-space axes and quaternions; no Euler reconstruction may discard roll when an interrupted return becomes a new drag. Velocity is measured in radians/second, capped by vector magnitude, and expired if release follows a stationary hold. Analytic damping integrates exactly to its threshold crossing; any remaining frame time belongs to the subsequent settled delay. This is required for consistent 30/60/144 Hz behavior.

Smart Rubber Band is the default: initialize the stable anchor from the application's initial quaternion; accept a settled orientation within 25° quaternion geodesic distance; otherwise retain the accepted anchor, wait five seconds after coast ends, and return over one second with smooth ease-in-out. Compare quaternion signs equivalently. Return does not update the accepted anchor. Every pointerdown interrupts immediately, even before a movement threshold is crossed. Zoom is a separate explicit camera action and cancels return timing without rotating the puzzle. Resize does not alter orientation or anchor.

Free Rotation keeps inertia and disables return. Classic disables inertia and return. Mode changes preserve the displayed quaternion. Reduced motion disables inertia and automatic return. Shared accessible settings will use the existing viewer panel and bounded per-page local preferences, with a safe default if storage fails. Visibility suspension will freeze the displayed orientation and discard motion/timers; resume starts a fresh settled delay rather than consuming hidden wall time. Reset restores the defined initial orientation and anchor while retaining explicit zoom and puzzle state.

## Evidence boundary

Deterministic controller, pointer/settings, lifecycle and physical integration tests will cover timing, low/high-speed input, combined velocity caps, 24°/26° anchor decisions, stationary holds, interruption, frame rates, touch/pointer overlap, mode/reduced-motion changes, reset and canonical state. Existing unit/integration, typecheck, production builds and documentation checks remain required. Browser/E2E tests, screenshots and recordings will not be run under the session restriction; owner visual interaction acceptance remains pending. No author Ready, merge or deployment.
