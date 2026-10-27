# Proposed API and package contracts (review input, not implementation)

## Canonical low-level truth

Core must preserve a fixed puzzle definition independently of a current pose:

- schema/version + puzzle size and right-handed coordinate convention;
- unique immutable cubie IDs and sticker IDs; each sticker attached to exactly
  one cubie, with local normal and local print-up/right frame;
- current integer cubie positions and discrete proper-rotation body frames;
- immutable image/color/text asset definition references and asset manifest hash;
- optical equivalence subgroup for quarter-turn matching, **separate** from the
  actual physical orientation; never normalize away a symmetric sticker's pose.

Use integer lattice coordinates `2*i-(n-1)` so even/odd and future 6/7 need no
floating half-cell convention change. A signed-permutation 3×3 orientation is
one of 24 proper cube rotations. Camera orientation is not in physical state.

The binding PuzWerk decision in issue #21 assigns this domain to ReScript.
The following TypeScript shape illustrates its JS interop surface, not a
TypeScript-owned physical implementation:

```ts
type Vec3i = readonly [number, number, number];
type BodyFrame = readonly [Vec3i, Vec3i, Vec3i]; // orthonormal, det +1
interface StickerDefinition {
  readonly id: string;
  readonly cubieId: string;
  readonly normalLocal: Vec3i;
  readonly upLocal: Vec3i;
  readonly assetId: string;
  readonly equivalentQuarterTurns: readonly (0 | 1 | 2 | 3)[];
}
interface CubiePose {
  readonly id: string;
  readonly position: Vec3i;
  readonly orientation: BodyFrame;
}
interface CubeState {
  readonly schema: 'cube-state@1';
  readonly definitionHash: string;
  readonly size: number;
  readonly cubies: readonly CubiePose[];
}
```

These are illustrative interfaces. Define whether body-frame vectors are rows
or columns, exact face ordering, and composition direction; tests must lock
those conventions. Expose a JSON-safe lossless export of definition + pose;
do not serialize Three objects or treat face colors as the canonical state.

## Package dependencies

```text
counter product -> cube-viewer -> cube-assets -> cube-core
       |                |                         ^
       +-> cube-mechanics ------------------------+
       |                ^                         ^
       +-> cube-solver adapters -> cube-notation --+
                         |                        ^
                         +-> cube-validation -----+
                         +-> cube-codecs ---------+

optional cube-capture -> codec/validation boundaries
optional cube-devices -> typed move/frame event boundaries
```

Interpret arrows as imports, not ownership. A simpler actual M1 dependency
set is core (definitions/poses), mechanics (moves/replay), assets (manifest and
safe resolver), viewer (core+assets+render dependencies), counter product
(core/mechanics/viewer) and isolated solver/proof modules (mechanics). Low-level
codecs, validation and notation may begin as well-bounded modules rather than
creating nine tiny publishable packages prematurely. No DOM/Three/UI dependency
in core/mechanics/notation/codecs. No solver/capture/device dependency in viewer.

Primitive mechanics move: axis + inclusive layer interval + signed quarter turns,
with conventions explicitly versioned. This covers outer, inner, wide and whole
puzzle rotations for 2..7 without hardcoding only face names or a max size 5.
Notation must retain dialect/lowercase interpretation and error spans. Keep
comment/pause/repetition AST outside a primitive turn. Expanding and normalizing
must preserve the requested physical frame, not silently discard regrips because
classic color solving considers all global rotations equivalent.

## Honest codecs and validation

Return a structured report of information loss. Plain URFDLB/color facelets
are a projection. They lack custom asset definitions and local print frames;
identically colored centers lose unique physical IDs and logo spins. Orbit64's
size-specific classical coordinates can preserve classical corner/edge state
and a documented whole-cube frame, but are **not generally lossless** for an
arbitrary specialized image-sticker puzzle. With a retained immutable design
mapping, some 2×2 projections can recover labeled corner pose; that does not
make all center-rich sizes lossless.

Recommended APIs separate `encodeLosslessJson()` from
`encodeClassicalProjection(): {value, convention, losses}` and
`decodeClassical(): {state, newIdentityMapping, losses}`. Do not let a lossy
roundtrip claim the original IDs/frames survived. A versioned sidecar can be
specified later; fail closed if its design hash does not match.

Required tests: exact JSON identity/frame roundtrip, color scheme and face-order
vectors, global frame handling, and a deliberate negative test showing classical
color encoding omits specialized identity/orientation. Reuse existing Orbit64
cross-language vectors rather than inventing another slot order.

Structural well-formedness and physical reachability are different results.
A state reached by replay of legal moves from a known valid source is verified.
An arbitrary imported pose needs the appropriate per-size reachability checker;
classic color quota/permutation tests cannot prove every image-center frame
reachable. Return unsupported/UNKNOWN for a stronger unimplemented theorem.

## Solver facade prototype

Keep this outside core, with adapters, not a universal algorithm:

```ts
type Goal =
  | {kind: 'classical-solved'; frame: 'exact' | 'global-rotation-quotient'}
  | {kind: 'partial-image-display'; predicateVersion: string;
     designHash: string; constraints: readonly unknown[]};
interface SolverCapabilities {
  id: string; version: string;
  sizes: readonly number[];
  goals: readonly Goal['kind'][];
  framePolicies: readonly ('exact' | 'global-rotation-quotient')[];
  metrics: readonly string[];
  cancellation: 'preflight-discard' | 'cooperative' | 'worker-terminate';
  budgets: {wallClock: 'hard' | 'soft' | false;
    memory: 'hard' | 'hint' | false; preparationIncluded: boolean};
}
interface SolveRequest {
  state: CubeState; goal: Goal; metric: {id: string; version: string};
  budget: {wallClockMs?: number; maxNodes?: number; maxMemoryBytes?: number;
    requireHardLimit?: boolean};
  signal?: AbortSignal;
}
```

Use a serializable/versioned predicate rather than an arbitrary callback across
a worker boundary. Fail explicitly on unsupported size, goal, frame, metric,
state encoding or hard budget; never silently downgrade them. Cancellation may
only discard a late result unless the backend is truly terminated/cooperative;
a Promise timeout alone does not stop CPU/memory consumption.

Result distinguishes solved-with-verified-path, invalid-input, unsupported,
not-found/unknown, budget-exceeded, cancelled and internal-error. `UNSAT` needs
its own independently checkable certificate and is not a synonym for not-found.
For any successful path, independent mechanics replay must confirm the exact
start hash, legal move list, final hash and actual goal predicate. Return
optimality `optimal | best-known | unknown` with claimed metric and evidence;
a valid hub route normally has optimality unknown, not a shortest-display claim.
Include backend/source version, preprocessing/table version/hash, run duration,
preparation cost and measured resource fields only when actually available.

M1 executable adapter should reuse the existing offline cubing producer for
classic 2×2, plus contrast a known counter-witness route as a separate supported
partial goal, with exact design/source-hash matching. Do not advertise arbitrary
partial image search merely because classical solved or a finite witness table
works. A useful contrast test rejects a generic unsupported partial goal while
accepting a documented known-witness target and verifying its exact frame.

## Asset safety and renderer consistency

Versioned manifest: sticker IDs reference asset IDs, font IDs, material IDs and
local frames. Support immutable color/image/text descriptors. Text may be
rasterized once at print-definition construction; a counter step must never
rewrite a texture. Preserve font version/license/hash. Image resolver must be
injected with an allowlist/base, MIME/size bounds and integrity checks. Do not
load untrusted arbitrary URLs or executable/raw SVG; reject script/event/
foreignObject/external-reference SVG or accept only a deliberately sanitized,
restricted SVG subset. A renderer's texture orientation derives from the same
physical local/body frames used by target verification. Test asymmetric image
crops at multiple poses, not just a rotationally symmetric zero.

## Concrete interoperability traps to freeze in tests

CubeLab internally stores faces as **U,L,F,R,B,D**, while its serialization
boundary is **U,R,F,D,L,B** (`src/State/StateTypes.res`). Do not pass raw internal
face arrays to another codec just because both name the format URFDLB. Prefer
normal-indexed selectors and explicit exporters.

The current flix-orbit64 repository is version 0.9.0; flix-cubesolve's pinned
`flix.toml` declares Orbit64 0.3.0. CubeLab/CubeAssembler contain their own ports
and fixture sets at the pinned revisions. A matching format name is not an
assertion that every port implements the same global-frame order, center
numbering, twist radix or move-envelope version. Record the actual convention
and codec version, run cross-language vectors, and reject incompatible variants.
No transparent migration of tokens is implied by this source audit.
