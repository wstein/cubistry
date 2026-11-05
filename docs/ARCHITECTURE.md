# Architecture and ecosystem

How Cubistry relates to PuzlWerk, ChronoCube and the shared solver packages. Back to the [README](../README.md).

## Ecosystem

Cubistry is the reusable cube-display framework above the
[PuzlWerk](https://github.com/wstein/puzlwerk) puzzle/solver foundation and
below application-level products. Dependencies flow from applications to the
shared viewer to PuzlWerk core, never in reverse.

The shared viewer is `@puzlwerk/viewer`, a separate package in the PuzlWerk
monorepo (not in the core package and not in an application). Target split:
PuzlWerk core (ReScript) owns model, states and moves without DOM;
`@puzlwerk/viewer` owns the scene (camera, light, rotation of the cube about
its center) and rendering without application knowledge, with the CubeScene
model ([#111](https://github.com/wstein/cubistry/issues/111)) as its contract;
Cubistry owns presentation, animation timing, themes, printing, counters and
calendars, generic physical-display composition, rendering of permanent
sticker prints, validation, and a planned declarative application runtime.
CubeAssembler keeps scan, camera and validation; CubeLab keeps its native
WebGL viewport until a separate migration (M3) is approved; Cubacle (Rust/WASM
solver) never depends on the viewer. This is the target architecture, not a
migration approval: each migration (CubeAssembler, Cubistry, CubeLab) needs
the owner's separate approval. Until then the viewer code remains in this
repository (`packages/cube-viewer`); a future print/design studio will *use*
the viewer, not be required by it.

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
