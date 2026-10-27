# Shared framework reuse audit: evidence matrix

This extends `docs/COUNTER_REUSE.md`, rather than replacing its 2×2 MVP audit.
Scope: current Cubistry issue #21, read-only source inspection. No external
repository, issue, PR, migration, or hosted service was created. No Rust/Flix
solver was built or benchmarked here. Tests below are located source evidence,
not claims that this audit executed their suites. Cost marked UNKNOWN means
not measured, not zero. Pins are in `00-source-pins.json`.

## Source-pinned repository matrix

| Source | Pin | Concrete reuse boundaries | Actual size evidence and limits | License/distribution | Measured artifact costs / unknowns |
| --- | --- | --- | --- | --- | --- |
| `wstein/cube-assembler` | `d62d1715e041c6b808fcce08c597fcb4a3ce5c98` | `src/cube/CubeGeometry.res`, `CubeMoves.res`, TS `cubeMoves.ts`; `src/cube/Parity.res`; `src/core/view/CubeMesh.res`, `TurnAnimation.res`, `Mat4.res`; Preact viewer hooks; capture/assembly modules remain app services | Geometry and guided-capture test loops explicitly include 2,3,4,5,6,7. Move API has face/depth/width/quarter turns. Browser screenshot tests cover 2 and 5, not all sizes. Color validation checks corners, per-orbit wings and odd-cube middle edges; this is not an arbitrary uniquely labeled image-center reachability theorem. | MIT, copyright Werner Stein 2026. Apache-2.0 notices for copied Orbit64 port/test data must remain; fonts have their own licenses. | CubeMesh source ~538 lines; existing mesh and shader have no image UVs. Production transfer/bundle/frame-time costs for 6/7 UNKNOWN. |
| `wstein/cubelab` / Cube Rosetta | `89053d06df0a992acf68506d0dec5082c71dfaab` | `src/Move/MoveTypes.res`, `MoveParser.res`, `MoveExecutor.res`, `MoveTransform.res`; `State/FaceletCodec`, `ColorCodec`, `Orbit64Codec`; `StateParity`, `StateValidation4x4`; `client/cube-gl.ts`; `Solver/Optimal2x2*`, classical solver workers | `StateTypes.isSupportedSize` explicitly 2..5; MoveExecutor tests loop 2..5. Orbit64 widths only 2..5. Explicit full classical 2/3 invariants and 4×4 color-visible validator; docs explicitly withhold complete 5×5 reachability. 5×5 source has staged center/edge planning/inspection, not a blanket general solver. No 6/7 state support at this pin. | AGPL-3.0-or-later. NOTICE includes GPL-3.0-or-later 4×4 solver origin; preserve per-file provenance. Do not copy into a permissively licensed package without an explicit license decision. | `cube-gl.ts` 101,053 source bytes / 2,601 lines, no sticker-image UV input. Actual 2×2 table 1,837,112 bytes = 32 header + 3,674,160/2 packed distance bytes. Browser runtime/bundle beyond prior audit UNKNOWN. |
| `wstein/cubacle` | `233045908fe3b3a2ef5e57e410549d438614c820` | Rust `src/puzzle/{kind,facelets,moves,solver,target}.rs`, notation/Orbit64 modules, metrics; optional higher-level engine/CLI/server adapters | `PuzzleKind` declares 2..7 and generic facelet moves. Real engines exist for 2,3,4,5,6,7: `engines/two`, `three`, `four`, `five`, `dwalton`. `tests/dwalton_test.rs` contains nonignored 6×6 and 7×7 scramble/replay tests. Source presence is stronger than a README claim, but no test/runtime result was obtained in this audit. Partial target overrides: 2 and 3; other engines inherit unsupported unless complete-target routing handles them. | AGPL-3.0-or-later. `NOTICE.md` retains MIT origins for min2phase, cube555, TPR, dwalton; Orbit64 Apache-2.0 origin. Package boundaries, worker isolation, or HTTP do not automatically waive license obligations. | Native Rust requires 1.95, current Cargo package has native sysinfo/rustix/threads and no ready browser/wasm-bindgen facade. WASM size, browser viability, cold/warm/current runtime UNKNOWN. Upstream *older native* benchmarks (Oct 22, different `afee323` revision on Apple M2 Pro) list ~12.1 MB 4×4 tables / ~306–319 MB 5×5 RSS; these are not current browser measurements. |
| `wstein/flix-cubesolve` | `be17cd13d6695b5f3a6ea17bfc04157a8a406848` | Flix `src/CubeSolve.flix`, `Model/{Cube,Move,Notation,Validate,Facelets}`, solver/search/cache APIs; JVM optional higher service | Exact source APIs separate `supportedSizes()=[2,3]` from `turnableSizes()=[2,3,4,5]`; `Model.Validate` refuses 4/5 reachability. Tests `TestSized`, `TestCubeSolve` exercise the lists. 4/5 can turn/draw but cannot solve/validate/compose through the full-coordinate path. No 6/7 API claim here. | AGPL-3.0-or-later, imports Apache-2.0 Orbit64. Retain `ATTRIBUTION.md` for upstream algorithms. | Flix/JVM + JDK21+, no measured browser/WASM port. Build/download/table/cache sizes and local runtimes UNKNOWN. Upstream README says first table build ~20 s, not a measurement here. |
| `wstein/flix-orbit64` | `9a6c9bbe8431f01068ae0a083ec36913abbd78e1` | Apache codec/reference format: `FORMAT.md`, `src/Orbit64/{State,Coord,Frame,Net,Move,Algorithm,Canonical}.flix`; cross-language test vectors | `Net.canDraw(n)` admits 2..7; explicit conventions and facelet tables for all six sizes. `TestCanonical.flix` loops 2..7 and vectors cover large sizes. It is a codec, not a puzzle reachability solver. Classical color coordinates quotient indistinguishable centers and omit their logo spins. | Apache-2.0, copyright Werner Stein 2026; retain license, notices and change attribution when porting. Compatible with AGPLv3 distribution subject to retained obligations; not proof that arbitrary relicense is allowed. | Token widths exactly 5,12,27,43,66,90 ASCII characters for 2..7 from format. JVM code; a JS port's bundle/runtime UNKNOWN. Existing JS/TS ports can be evaluated before a new one. |
| `wstein/regrip` | `ef0c3ef2be10ed8e0d0303e9d61fb576753d78cf` | Published `packages/core` 0.3.1 typed exports; deterministic domain quaternion/frame/regrip reducers and session lifecycle. `createSmartCubeSession`, transport bindings, profile adapters; keep BLE/capture/app UI outside puzzle core | `domain/CubeFacelets.res` explicitly converts **3×3 54-facelet** / Kociemba states. Sensor orientation/regrip math is generally reusable, but that does not establish NxN state or solver support. BLE hardware/vendor capability is distinct from puzzle size. | MIT (Andy Fedotov and Werner Stein notices). Runtime deps `@rescript/runtime`; peers RxJS and optional smartcube-web-bluetooth. Browser BLE requires supported browsers/secure context/user interaction; deterministic replay should work without live hardware. | GitHub `core-v0.3.1` release `.tgz` metadata size **47,831 bytes** (compressed package, not browser bundle); consumer/tree-shaken bundle and devices runtime UNKNOWN. |

## Fair viewer comparison (no predetermined winner)

1. CubeAssembler is a serious **M2** starting point: tested generalized geometric
   mesh/layers 2..7, camera, gestures, manual-turn lock, a rendering/application
   seam and MIT source. The existing state is color-grid based; image/text
   stickers and their transported frames need a new adapter or mesh attributes.
   Porting its complete Preact/capture application into M1 is not justified.
2. CubeLab offers a tested orbit/animation lifecycle and solver integration but
   its ~101 KB native WebGL module also contains extensive teaching/device
   overlays. It is color-facelet based, lacks arbitrary sticker textures, and
   only admits 2..5 at this pin. `docs/three-renderer-migration.md` is a **plan**,
   not evidence that an interchangeable Three.js backend already ships.
3. Current PR #20 adapter is pinned in this audit at
   `ff617dc41a4e50d073d3708598d9ad6ddd4a6232`: `src/renderer.mjs` 10,181 source bytes,
   `src/cube.mjs` 2,246 bytes; imports Three 0.180.0, uses immutable image halves
   on physical corner meshes, and already consumes the counter's actual states.
   It preserves the camera-input reuse from CubeAssembler. It is only a 2×2
   consumer adapter at this pin, not evidence of a general NxN framework or safe
   arbitrary asset loader. Preserve it and extract its seam for M1, then compare
   replacing/absorbing mesh construction against CubeAssembler in M2 using the
   same image/frame conformance tests and browser scenes. Do not ship two
   permanently competing physical engines.

The prior audit measured the PR #20 production JS around 487 KB / 124 KB gzip
at its earlier build; these are historical audit numbers, not a new build or
measurements for the revised shared-package implementation. The prior witness
asset is 19,793 bytes and Noto Sans Latin font 13,496 bytes. Re-measure current
production output before making a revised performance claim.

## Strongest semantic mismatch: solver target ≠ counter display

`cubacle::puzzle::Target` is a set of **six classic colors** per position, not
immutable image IDs, per-sticker frames, or thousands of print-specific glyphs.
For **2×2**, `Target::reached_by` tries every global rotation; its exact partial
solver similarly searches 3,674,160 DBL-fixed states with 24 rotated masks.
CubeLab's normal 2×2 solve also accepts a globally rotated solved cube. Thus
neither is automatically an exact-front counter-target solver. Correcting the
frame and independently replaying the full specialized predicate are mandatory.
The cubing 0.66.1 offline producer already used in PR #20 remains a viable M1
adapter; universal partial-image-target support must stay unsupported/UNKNOWN.
