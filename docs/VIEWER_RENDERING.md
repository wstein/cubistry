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
The installed, pinned 3×3 provider at
`ffe513c43f5d622810b9a3c9aff2fac88163d0f0` was also inspected:
`packages/solver-3x3-picture/src/index.mjs:solvePicture3x3` accepts URFDLB
facelets and explicit center orientations in ULFRBD order, returning verified
outer moves. It is AGPL-3.0-or-later, with retained upstream notices, and is not
a renderer or a general immutable-print API. Cubistry's existing
[`center-planner.mjs`](../src/apps/calendar/center-planner.mjs) maps its scoped
physical Calendar state into that solver request; the new presentation adapter
consumes the full original sticker frames instead of a lossy solver projection.

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

## Implemented presentation and adapter

[`PhysicalCubeScene`](../packages/cube-viewer/src/physical-scene.ts) consumes the
version-1 render projection `{id, cubie, p, n, up}`. The 2×2 viewer projects
`stickerPoses(print, state)`; Calendar passes its existing 3×3 sticker state.
One immutable printed normal/up frame per body establishes the local-to-current
rotation. Legal move selection and angle come from each existing mechanics
module. A temporary pivot interpolates those selected meshes; it never produces
a target state. The caller commits its validated endpoint after animation.
Failed timing restores the previous authoritative frame and releases the pivot.

[`PRESENTATION_PRESET`](../packages/cube-viewer/src/presentation-preset.ts),
version 1, replaces square boxes with Three.js `RoundedBoxGeometry`: 0.99-unit
bodies, 0.055-unit bevel radius and three bevel segments. Existing center spacing
retains 0.05-unit plastic gaps. Stickers are raised 0.007 units above each body's
flat face, with a 0.87-unit width and rounded corners. Standard image coordinates
remain affine and unflipped: local +x is image right and +y is print up.
**Rounded corners mask the outer corner pixels**, including in Playground photo
mosaics; this is a visual contour change, not a change to asset bytes, UV scale,
identity or physical orientation. Art whose meaning depends on exact corner
pixels needs human acceptance before using this presentation preset. Print
exports retain their original complete source artwork.

Before, both renderers used square boxes/stickers and ambient plus one key
light; Calendar used unlit sticker materials. After, both use smoothed plastic
bevels, opaque interior bodies, rounded sticker contours and restrained
nonmetallic clearcoat. A hemisphere/ambient base and key/fill/rim rig illuminate
the scene. Neutral tone mapping compresses bright highlights. Material colors,
asset textures and supplied roughness remain intact. All faces receive light
when orbiting, with no shadow-map or floor-layout dependency. Existing camera
angles, orbit/zoom behavior, easing and absolute-deadline timing are retained.
The shared clock installs the rig once, not once per cube. Its single WebGL
context, camera, render loop and physical cube placements remain unchanged.

## Resource and performance boundaries

There are two geometries per cube, shared among its meshes: 588 triangles per
body and 18 per sticker. Current sizes use 5,136 triangles for one 2×2, 16,260 for
one 3×3 Calendar, and 15,408 for the three-cube clock. Mesh/draw counts remain
32, 80 and 96 respectively before renderer batching; no per-frame geometry or
texture rebuilding is introduced. Frame matrices and a turn pivot allocate at
configuration/commit/turn boundaries. Geometry, materials and textures are
released on reconfiguration/destruction. Shared viewers do not dispose their
stage's renderer. Pixel ratio is capped at 2, as before; there is no automatic
mobile quality switching or new global geometry cache.

The production build reports a Three.js chunk of approximately 500.60 kB
minified / 126.36 kB gzip and warns at the existing 500 kB threshold. This is an
observed output size, not a measured before/after performance improvement.
Physical materials and rounded geometry increase shading/triangle cost; no
frame-rate or memory benchmark was run. Existing continuous render loops remain;
idle rendering and adaptive quality are separate lifecycle work.

Three.js's existing WebGL context-loss/restoration handling remains in charge
of GPU recovery. JS scene resources and canonical controller state are retained;
there is no new alternate physical state or custom GPU recovery path. Context
loss, restoration during a timed move, GPU fallback and device-specific frame
rates have not been exercised in a browser. Failure to create a WebGL context
retains the existing application behavior; this change does not add a 2D fallback.

## Human presentation handoff

E2E NOT RUN (per owner instruction). No screenshot, touch-device, GPU or browser
rendering result is claimed. Reviewers can compare the source-level before/after
above and the numerical evidence in
[`physical-scene.test.mjs`](../tests/physical-scene.test.mjs),
[`presentation-preset.test.mjs`](../tests/presentation-preset.test.mjs) and
[`viewer-rendering.test.mjs`](../tests/viewer-rendering.test.mjs).

For final visual acceptance, inspect desktop and narrow mobile layouts at 1×/2×
DPI in Counter, both timers, HSM, Live Clock, German/English Calendar and the
picture Playground. Check front/back sticker contrast and highlights, corner
masking on asymmetric pictures, orbit/zoom/reset, resize while hidden/visible,
turns at the slowest/fastest speeds, reduced motion, app switching, and simulated
WebGL context loss/restoration during a turn. Confirm move counters, countdown
catch-up and print exports retain their established semantics. Calendar and
Live Clock retain their existing orbit controls; the single-cube 2×2 viewer
retains wheel zoom. This change introduces no layer-turn gesture in any app.

The architectural lesson is to share physical frame projection and bounded
render resources while leaving existing mechanics, assets and application
lifecycles authoritative. The inherited Calendar mechanics remain a scoped
3×3 implementation; a shared render adapter does not migrate them into the
size-2 PuzlWerk solver contract. Eventual provider extraction must preserve both
conformance suites before changing that ownership boundary. Larger-size work
needs new budgets and independent conformance, not a size ceiling in this scene
adapter. PR #97 may adopt this presentation boundary later through its own
reviewed integration; no research compatibility or 7×7 capability is claimed.
