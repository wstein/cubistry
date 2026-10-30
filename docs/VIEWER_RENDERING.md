# Realistic cube presentation boundary

Tracks [issue #60](https://github.com/wstein/cubistry/issues/60). This is the P0
renderer decision; the 2D net and a full application framework remain P1.

## Source comparison

The inspected Cubistry baseline is `1d2ef42`. Its
[`CubeViewer`](../packages/cube-viewer/src/index.ts) owns Three.js meshes, textures,
orbit input and move interpolation, but receives validated physical states and
legal `MovePresentation` events. Its square `BoxGeometry` bodies and flat square
stickers hide edge highlights. The separate
[`CalendarViewer`](../src/apps/calendar/viewer.ts) uses the existing 3×3 physical
model and immutable sticker frames. [`ClockStage`](../src/apps/clock/stage.ts)
owns one shared renderer and camera for three size-2 viewers. Lighting must be
installed by that stage rather than once per cube.

CubeAssembler was inspected at `1fb217ea2517fae45de7146e51b61bbda4f16c00`:
`src/core/view/CubeMesh.res:buildCubeMesh/addBeveledFace` builds rounded faces,
smoothed edge normals, dark interior caps and seam occlusion. Its
`src/client/view3d/cubeMesh.ts` is a thin generated-code bridge;
`cubeView3DGraphics.ts:initProgram` supplies key/fill/specular lighting;
`useCubeRenderer.ts:useCubeRenderer` owns raw WebGL buffers, a floor-shadow
renderer and a Preact lifecycle. Those buffers encode palette colors rather than
Cubistry's immutable printed image UVs. Copying that runtime would duplicate
rendering ownership and require a new image pipeline. CubeAssembler is MIT;
Cubistry already retains its notice in
[`CUBE_ASSEMBLER_LICENSE.txt`](../packages/cube-viewer/src/CUBE_ASSEMBLER_LICENSE.txt)
for reused orbit techniques.

PuzlWerk's inspected source at `8440cfd8e84cf058c00b26140d4d77626508e56a`
provides `packages/solver-2x2/src/physical-adapter.mjs`: it accepts the Cubistry v1
wire format without normalizing physical sticker-up or body frames. Its solver
package is AGPL-3.0-or-later and has no renderer package. The consumer's actual
immutable dependency pins are recorded in
[`puzlwerk-source.json`](../puzlwerk-source.json) and
[`puzlwerk-picture-source.json`](../puzlwerk-picture-source.json).
The existing shared physical contracts and their provider adapters remain the
source of truth; renderer work must not replace mechanics or solver ownership.

## Decision

Keep the existing `@cubistry/cube-viewer` as the single reusable presentation
package. Add a narrow, size-neutral presentation adapter for printed frames,
canonical body poses and already validated turn events. The 2×2 caller keeps its
existing canonical print/state validation; the 3×3 Calendar caller keeps its
existing legal replay validation. This boundary does not advertise additional
mechanics capabilities or turn an arbitrary size into a supported application.

Reuse CubeAssembler's demonstrated techniques: rounded bevel highlights, visible
dark seams, opaque interior bodies and directional key/fill illumination. Use
Three.js's existing MIT-licensed rounded geometry rather than porting a second
mesh engine, shaders, application state or framework. Share geometry and a small
declarative presentation preset across both consumers and the shared clock
stage. Preserve artwork UVs, immutable sticker identity/up, orbit and zoom,
existing timing interpolation, reduced-motion behavior and controller commits.
Camera input never emits a physical move. App policies continue to own legal
manual turns; Counter and Timer remain locked.

## Validation and delivery limits

Fast numeric geometry/frame tests and existing physical replay, timer deadline,
interruption, counter, HSM, clock and calendar tests provide source-level evidence.
E2E NOT RUN: browser/Playwright execution is explicitly excluded by the owner.
Human desktop/mobile presentation acceptance remains necessary; numeric geometry
checks cannot establish perceived rendering quality or touch ergonomics.

Future work belongs in P1: 2D net from the same authoritative state, validated
larger sizes, provider-owned viewer extraction when its package contract exists,
and eventual declarative application lifecycle consolidation. Neither 7×7
research nor PR #97 is part of this change. No solver, scanner, CubeLab or
application-framework migration is authorized here.
