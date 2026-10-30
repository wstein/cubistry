# Presentation rotation

Issue [#110](https://github.com/wstein/cubistry/issues/110) corrects the interaction model from historical [#37](https://github.com/wstein/cubistry/issues/37): ordinary dragging rotates the rendered assembly in front of a stationary observer. Only the conflicting camera-orbit behavior is superseded. Puzzle state, legal moves, immutable artwork, explicit zoom and reset controls retain their existing contracts.

## Source comparison and boundary

The standalone 2×2 `CubeViewer`, 3×3 `CalendarViewer`, and shared `ClockStage` currently update spherical camera positions from drag angles. Clock framing additionally changes camera distance as those angles change. Existing `PhysicalCubeScene` already isolates canonical piece/sticker poses and temporary layer pivots; it needs no mechanics changes.

CubeAssembler at inspected revision `1fb217ea2517fae45de7146e51b61bbda4f16c00`, `src/client/view3d/useCubeRenderer.ts:181–205`, already uses a stationary translated view and a model rotation. It does not require a sister-repository fix. Cubistry can use the same separation with its historical yaw sign preserved: presentation rotation is `Rx(pitch) * Ry(-yaw)`.

The implementation will place the physical assembly and its layer pivots beneath a presentation parent. Scene lights and the shadow receiver remain outside it. The three-cube clock rotates as one rigid arrangement around its common center, as explicitly confirmed by the owner. Local cube placement and canonical state stay unchanged.

Camera fitting must use an orientation-independent conservative sphere, updated on resize or explicit zoom rather than drag. The receiver and shadow bounds must cover the complete rotated assembly, including active turns. This conservative fit can make the initial clock row appear smaller; changing camera distance during drag would violate the requested interaction. Existing explicit zoom remains available.

## Verification boundary

Supported Cubistry renderer paths are the existing 2×2 and Calendar 3×3, including picture artwork and the shared three-cube clock. This change does not add larger-cube mechanics or make claims about unsupported sizes. No solver, table, artwork bytes, material design or research changes belong here.

Deterministic source-level tests will check stationary camera transforms, rigid parent transforms, reset and release behavior, layer animation and canonical-state preservation. Browser/E2E tests will not be run or enabled. Historical browser assertions that expect camera orbit are superseded by #110; they do not constitute visual acceptance of the replacement. Owner preview checks must still assess drag direction, centering, picture orientation, lighting/shadows, portrait fitting, whole-clock rotation and reset without losing a scramble. Owner visual acceptance remains pending.
