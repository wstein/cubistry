# Architecture and ecosystem

How Cubistry relates to PuzlWerk, ChronoCube and the shared solver packages. Back to the [README](../README.md).

## Ecosystem

Cubistry is an application-level framework above the shared viewer, which in
turn sits above the [PuzlWerk](https://github.com/wstein/puzlwerk)
puzzle/solver foundation. The viewer depends on the core; applications depend
on the viewer. Dependencies never point in reverse.

The shared viewer is `@puzlwerk/viewer`, a separate package in the PuzlWerk
monorepo (not in the core package and not in an application). Target split:
PuzlWerk core (ReScript) owns model, states and moves without DOM;
`@puzlwerk/viewer` owns the scene (camera, light) and rendering without
application knowledge, with the CubeScene model as its intended contract
(proposed in [#111](https://github.com/wstein/cubistry/issues/111), still
open); Cubistry owns presentation, animation timing, themes, printing,
validation, counters and calendars, generic physical-display composition,
rendering of permanent sticker prints, and a planned declarative application
runtime. CubeAssembler keeps scan, camera and validation; CubeLab keeps its
native WebGL viewport until a separate migration (M3) is approved; Cubacle
(Rust solver) never depends on the viewer. This is the target architecture,
not a migration approval: each migration (CubeAssembler, Cubistry, CubeLab)
needs the owner's separate approval. Until then the viewer code remains in
this repository (`packages/cube-viewer`); a future print/design studio will
*use* the viewer, not be required by it.

Decided (owner, 2026-11-05): puzzle orientation (whole-cube rotations x/y/z,
fixed frame, centers) belongs to the application and core and reaches the
viewer as plain transformation data in the CubeScene contract (for example a
quaternion per group); display orientation (camera, orbit, POV) and
interpolation between supplied states belong to the viewer, which knows no move
notation. Who owns the timing and easing of an animation is still open
(proposal: the application supplies start and target, the viewer interpolates).

The neutral 00–99 counter belongs in Cubistry as a reference example. The
planned **ChronoCube** application belongs above the framework and focuses
strictly on time-related uses (clocks, calendars, countdowns). Its application
definitions, physical print designs, visual themes, and certified transition
data should remain separable, with as little application-specific code as
practical. Changing the appearance of a screen-only theme should not change
physical state semantics; changing physical sticker art or placement requires
appropriate revalidation.

This describes the intended architectural boundary. The current counter is
an MVP, not evidence that the full declarative runtime, ChronoCube, or studio
has already been delivered. Cubistry must remain usable without ChronoCube.

## Shared framework path

The counter is the first consumer of **PuzlWerk**: actual private shared workspaces
with a ReScript-owned domain/mechanics/validation/JSON codec and a TypeScript
viewer/browser asset loader. The canonical naming/language decision is
[issue #21](https://github.com/wstein/cubistry/issues/21); the hosted
repository is [PuzlWerk](https://github.com/wstein/puzlwerk), with the
`@puzlwerk/*` scope used for shared-package naming. No package publication or
broader core migration is implied; the existing `@cubistry/*` workspaces stay unchanged.
The counter now consumes the pinned private `@puzlwerk/solver-2x2` package in
`exactPhysical` mode; see [dependency setup and verification](COUNTER_SHARED_SOLVER.md). [M1 contracts and data flow](SHARED_CUBE_M1.md)
document the validated v2 design, loadable oriented images, independent replay,
and the explicit size-2 limits. Sizes 3–7 and external migrations remain planned.
