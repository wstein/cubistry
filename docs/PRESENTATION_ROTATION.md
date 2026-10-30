# Presentation rotation

Issue [#110](https://github.com/wstein/cubistry/issues/110) corrects the interaction model from historical [#37](https://github.com/wstein/cubistry/issues/37): ordinary dragging rotates the rendered assembly in front of a stationary observer. Only the conflicting camera-orbit behavior is superseded. Puzzle state, legal moves and immutable artwork retain their existing contracts. Explicit zoom remains separate; Reset View now restores only presentation orientation and preserves zoom as well as the scramble.

## Source comparison and boundary

The standalone 2×2 `CubeViewer`, 3×3 `CalendarViewer`, and shared `ClockStage` previously updated spherical camera positions from drag angles. Clock framing additionally changed camera distance as those angles changed. Existing `PhysicalCubeScene` already isolates canonical piece/sticker poses and temporary layer pivots; it needs no mechanics changes.

CubeAssembler at inspected revision `1fb217ea2517fae45de7146e51b61bbda4f16c00`, `src/client/view3d/useCubeRenderer.ts:181–205`, already uses a stationary translated view and a model rotation. It does not require a sister-repository fix. Cubistry uses the same separation with its historical yaw sign preserved: presentation rotation is `Rx(pitch) * Ry(-yaw)`.

The implementation places the physical assembly and its layer pivots beneath a presentation parent. Scene lights and the shadow receiver remain outside it. The three-cube clock rotates as one rigid arrangement around its common center, as explicitly confirmed by the owner. Local cube placement and canonical state stay unchanged.

Camera fitting uses an orientation-independent conservative sphere, updated on resize or explicit zoom rather than drag. The receiver and shadow bounds cover the complete rotated assembly, including active turns. This conservative fit can make the initial clock row appear smaller; changing camera distance during drag would violate the requested interaction. Existing explicit zoom remains available.

## Verification boundary

Supported Cubistry renderer paths are the existing 2×2 and Calendar 3×3, including picture artwork and the shared three-cube clock. This change does not add larger-cube mechanics or make claims about unsupported sizes. No solver, table, artwork bytes, material design or research changes belong here.

Focused Node tests check stationary camera transforms, rigid parent transforms, pointer release/cancel, exact reversal through the activated click threshold, portrait/landscape fitting, receiver/shadow coverage during a rotating clock and active layer, actual 2×2 and 3×3 animations, presentation-only reset, canonical sticker frames, and unchanged exact-target solver results. The production pointer router stops on release; it adds no inertia. The existing `cube-camera-change` event and reset method names remain compatibility aliases for application callers.

Relevant commands are `node --test tests/presentation-rotation.test.mjs tests/clock-framing.test.mjs tests/viewer-rendering.test.mjs tests/studio.test.mjs tests/physical-scene.test.mjs tests/shared-solver.test.mjs`, `npm test`, `npm run typecheck`, and `npm run build`. Exact-head results belong in the PR review evidence.

Existing browser assertions that expected camera orbit were maintained for the new presentation transform, including transformed framing points and stationary-camera checks. This was static/syntax review only: E2E/Playwright/browser tests were NOT RUN or enabled. No assertion thresholds or physical-state checks were removed. This does not constitute visual acceptance.

Owner preview checks remain necessary: drag and reverse in both axes, release/cancel, reset after scrambling and zooming, picture continuity after legal turns, narrow and wide viewports, stationary scene lighting and geometric shadows, and the entire three-cube row rotating around its common center. A deliberately zoomed-in view may crop; default zoom fits the full rotation envelope. Conservative group fitting and a receiver below the complete sweep can change apparent initial size and shadow separation, which require owner judgment. Owner visual acceptance remains pending.

PR #112 was owner-merged before the final integration tests and independent review completed. Its follow-up retains those tests on the accepted main baseline, including the separately merged solver-table and favicon fixes. Neither merge itself nor source/numerical checks establish owner visual acceptance.
