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

## Owner review and implemented follow-up

The owner **did not accept** the initial preview. Issue #60 Sections 7 and 8 now govern
visual acceptance. R01's rounded plastic/reflections are retained. Source/numeric
review is evidence for correctness, not an owner's visual sign-off. The owner's
reference screenshots were not available to the author; use the preview handoff
below to compare against them.

[`PhysicalCubeScene`](../packages/cube-viewer/src/physical-scene.ts) consumes the
render projection `{id, cubie, p, n, up}`. The 2×2 viewer projects canonical
`stickerPoses(print, state)`; Calendar passes its existing scoped 3×3 sticker
state. One immutable source normal/up frame per body establishes the current
rotation. Caller-validated legal selection/angle drive a temporary turn pivot;
controllers own state, deadlines and commit. Appearance changes replace mesh
materials in place, including during an active turn, without changing that state.

### R02: connected plastic geometry

The initial design combined a 1.04-unit center pitch, 0.99-unit bodies and
symmetric 0.055-unit bevels. Its 0.05-unit air gaps widened at beveled junctions,
explaining the disconnected look. CubeAssembler instead uses unit pitch,
seam-specific bevel coverage and interior cut-face caps. Both consumers now use
unit pitch (0.5 times the size-2 ±1 lattice), retaining the approved 0.99-unit
rounded outer shell and 0.055-unit bevels. The visible shell seam is 0.01 units.

**Core ball (supersedes per-cubie box cores).** The former per-cubie plastic box
cores are removed. Each cube has one static core ball at its center, diameter
`CORE_DIAMETER_RATIO` (0.8) of the full cube edge length, so a 3×3 has a 2.4-unit
ball and keeps 0.3 units of distance to the surface. It follows the view group but never a layer turn or
body frame. Consequence, owner-requested and measured with rays: the shell seams
are no longer sealed behind the bevels, so frontal and slightly oblique rays
through four-cubie junction lines can pass between bodies. The former tests for
opaque seams are replaced by tests of the ball's placement and its independence
from poses and turns. The owner should judge the see-through lines in the
preview.

### R05/R06: dynamic cast shadows and warm studio

CubeAssembler's `cubeShadow.ts`/`CubeShadow.res` projects a rotated cube outline
onto a soft floor, but its API receives only size/pitch/yaw, not active-layer
geometry. Copying it would miss the requested changing turn silhouette. The
shared [`studio.ts`](../packages/cube-viewer/src/studio.ts) instead uses actual
moving shell/core/sticker meshes as shadow casters, one 1024×1024 key-light
shadow map per viewport and fixed 17-tap PCF filtering. Its radius represents
0.1 world units per half-cube extent, converted to texels and bounded to 2–24,
so single/group scenes share softness without extra samples or passes. Key/fill/rim lighting and approved nonmetallic clearcoat are retained.
The three-cube clock has one rig and floor for the entire synchronized scene.

A warm radial/vertical gradient replaces flat green on the viewport and its
stage. The ground now uses Three's shadow-only `ShadowMaterial`: outside actual
occlusion it is transparent, avoiding the uniform floor tint/horizon against that
gradient. Shadow opacity is 0.38. The same conservative turn sweep and front-sided
floor are retained, allowing bottom inspection. Lights, floor geometry/material and
shadow targets are disposed by the scene owner. The adapter does not own shared
stage renderers. Numeric projection tests show that a moving layer changes the
cast silhouette within the light frustum. They do not measure GPU shadow softness,
artifacts, frame rate or perceived depth; these remain owner preview checks.

### R07: whole-group camera travel

The shared clock camera now permits a full 360° horizontal orbit and vertical
travel to ±(π/2 − 0.05), avoiding polar singularities. Yaw wraps to retain numeric
precision. The existing camera-basis fit still contains the whole row and turn
bounds, tested at rear/side/near-polar views and portrait aspect ratios. Camera
input does not rotate individual cubes or alter canonical state. Wheel zoom is
bounded to 0.8–2 times the fitted distance; deliberate zoom-in can crop the row.
Reference view resets yaw, pitch, zoom and drag, restoring default full-group fit.

### R10 and limited R11: construction and appearance

One **Appearance** panel per viewport provides **Stickered / Stickerless**.
Stickerless assigns actual colored materials to the rounded body's six local
geometry groups. Colors are keyed by immutable source sticker IDs/normals, not
current world-facing sides. Canonical body quaternions keep those materials
correct after legal moves, nontrivial loaded poses and interrupted presentations.
This reuses CubeAssembler's colored-body construction technique without importing
its palette/physics engine. Interior cut-facing plastic remains opaque.

Inward-facing cut faces of a stickerless body take the color of a bordering
exterior face of the same cubie (the first one by local face order whose axis
differs; a lone exterior face is the fallback), as on real stickerless cubes.
An optional manifest material with id `body` overrides every cut face of the
cube. The stickerless core ball is dark gray (`DEFAULT_CORE_COLOR`) unless an
optional manifest material `core` or `PhysicalCubeScene.setCoreColor` sets it.
Stickered keeps the core ball in the selected frame color. Neither color is exposed in the UI.

Under Section 8, Stickerless maps original glyph/photo artwork directly onto
the rounded body's face groups and hides only the redundant inset planes.
[`body-artwork.ts`](../packages/cube-viewer/src/body-artwork.ts) retains Three's
complete 0..1 arc-length bevel UVs and rotates their intrinsic right/up basis
into each immutable source frame. Naive planar projection would trim tile edges.
Tests cover all six normals/four up rotations, asymmetric raycast landmarks and
adjacent Landscape tile endpoints. No pixels are erased, recolored or cropped;
source assets and print exports are unchanged. Stickered restores its original
inset planes and selected frame.

Body materials follow the original live artwork map/tint, including the existing
screen-only leading-zero override through turns, cancellation and resets. A
map-presence change invalidates the shader. The core and cut materials are
independent of selected Frame Color in Stickerless, preventing color leakage.

The optional frame-color picker accepts a six-digit hex color and can reset to
the loaded style's default. It remains visible but disabled in Stickerless and
retains its selected value for returning to Stickered; body artwork determines
visible exterior appearance. The translucent panel layout is unchanged. Preferences are versioned, validated,
bounded and optional when storage is unavailable. **Persistence is per page**:
Counter, Timer and HSM modes on the same main page share it. Full per-application
R11 isolation is deferred, not claimed as complete. No application settings
framework was introduced. The three-cube stage presents one control and applies
its choice to all three cubes.

Stickered's rounded inset contours still mask corner pixels; Stickerless now
carries the complete tile parameterization around its bevels. The owner must
inspect actual image continuity and lighting on the fresh preview; numeric UV
checks are not visual acceptance.

## Resource and performance boundaries

Three base shapes serve each cube: rounded shell (588 triangles), core (12),
and inset artwork plane (18 per printed face). Source-up UV variants are cached
only at configuration, at most one per distinct body-frame key (bounded by the
8/26 configured bodies). Positions/normals are unchanged; variants and face
material clones are explicitly disposed. No UV/geometry/texture generation runs
per animation frame, and original textures remain caller-owned.

Stickered totals are 5,232/16,572/15,696 triangles for 2×2/Calendar/three-cube
clock; Stickerless hides inset planes and renders 4,800/15,600/14,400. Each
viewport adds two ground triangles.

Upper-bound main-pass mesh/group draws before culling are 41/107/121 for
Stickered 2×2/Calendar/clock, and 57/183/169 for Stickerless (body face groups
increase draws, while inset artwork planes are hidden). One additional 1024×1024 shadow pass renders the actual casters;
there are no per-cube shadow maps, static shadow sprites or accumulation buffers.
DPI remains capped at 2. The production Three chunk exceeds the existing 500 kB
warning threshold. GPU timing and memory were not measured; bounded allocations
are not a performance guarantee. Idle render loops and adaptive quality remain
separate lifecycle work.

Three.js retains context-loss/restoration ownership. Canonical JS state and scene
resources remain authoritative. No custom recovery state, 2D fallback or changed
WebGL-creation failure policy is introduced. Restoration during a timed move is
still a manual browser check.

## Validation and owner preview handoff

**E2E NOT RUN (per owner instruction).** No screenshot, browser, touch-device or
GPU result is claimed. Tests exercise source-level geometry, real Three transforms
and real viewer methods with small JS stubs, without a browser engine. Relevant
fast suites include:

- [`physical-scene.test.mjs`](../tests/physical-scene.test.mjs): immutable frames,
  shared placements, all-side and moving-layer seam coverage.
- [`body-artwork.test.mjs`](../tests/body-artwork.test.mjs): full bevel UV coverage,
  all source frames, tile edges, bounded variants and live map/shader ownership.
- [`studio.test.mjs`](../tests/studio.test.mjs): changing geometric cast silhouette,
  shared frustum/filter budget, shadow-only receiver and resource ownership.
- [`clock-framing.test.mjs`](../tests/clock-framing.test.mjs): full orbit/polar fit,
  bounded zoom and reset without moving physical cubes.
- [`appearance.test.mjs`](../tests/appearance.test.mjs): source-face colors in
  canonical 2×2/3×3 poses, retained art, interrupted toggles, preferences, control
  initialization/reset and disposal.
- [`presentation-preset.test.mjs`](../tests/presentation-preset.test.mjs) and
  [`viewer-rendering.test.mjs`](../tests/viewer-rendering.test.mjs): geometry/UV
  bounds, materials, rejected timing recovery and reduced-motion commits.

For owner acceptance at the reported head, inspect:

1. 2×2 HSM close-up and the full three-cube group front, slight-angle, rear and
   bottom: compact connected cubies, tiny opaque seams and retained rounded
   reflections; no exterior protrusion during legal turns.
2. German Calendar **FR 30 OKT**: face alignment, original green/cream/copper
   colors, legible text and no offset/protruding faces.
3. Soft cast-shadow silhouettes during layer turns and camera orbit, all three
   cubes sharing the same ground/light; warm gradient/depth and readable contrast
   at desktop/mobile sizes and 1×/2× DPI, with no pronounced ground/horizon line.
4. Stickered/Stickerless on Counter, both timers, HSM, Live Clock, Calendar and
   Picture Playground, including mid-turn toggles: retained art/IDs, source-face
   colors, close seams and no white-removal/transparency artifacts. In Landscape
   pictures, compare the owner's before screenshot: no separate pale perimeter in
   Stickerless, correct adjacent image continuity/orientation, and no turquoise/
   green Frame Color leakage after toggling. Returning to Stickered must restore
   the selected frame; Frame Color stays visible-disabled in Stickerless.
5. Group Reference view and zoom, presentation-mode layout, resize and app
   switching, reduced motion, deadlines/catch-up/counters, print exports, and
   simulated context loss/restoration during a timed move.

Only the owner can mark this visual review accepted. Independent source review
and green non-E2E CI establish readiness eligibility, not a visual pass.

## Architectural lessons and P1

Share frame projection, construction materials and bounded studio resources;
leave mechanics, solvers and app lifecycles authoritative. Calendar remains its
existing scoped 3×3 implementation, not a migrated size-2 provider contract.
Provider extraction needs both conformance suites. No larger-size claim follows
from a size-neutral render seam, and PR #97 remains untouched and independent.

Explicit P1 follow-ups are R04 TrueType/OpenType consistency without replacing
SVG/image artwork; R08 declarative Calendar style selection preserving the
current green/cream/copper design; R09 canonical-state 2D net for single-cube
apps; full R11 per-application preference isolation; broader size conformance and
budgets; eventual declarative application lifecycle consolidation. None is a
hidden current P0 gate.
