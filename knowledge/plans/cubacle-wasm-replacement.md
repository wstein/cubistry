---
id: PLAN-CUBACLE-WASM-REPLACEMENT
title: Replace Cubing.js and twips with cubacle compiled to WebAssembly
type: plan
status: draft
created: 2026-11-03
---
# Replace Cubing.js and twips with cubacle compiled to WebAssembly

**Status: proposal, not a decision.** This plan changes no accepted ADR or spec.
Any size, speed or optimality statement below is **UNKNOWN** until measured by the
first gate. Work items are tracked only in GitHub Issues (epic in
`wstein/cubistry`, engine work in `wstein/cubacle`); this file holds the approach
and the written gate criteria.

## Context (verified from the repository)

- Cubing.js 0.66.1, with its bundled twips WebAssembly solver, runs only in the
  Calendar (3×3 optimizer, center planner, transition planner) and the Picture
  3×3 solver worker. Counters, timers and clocks use stored, verified sequences
  and `@puzlwerk/solver-2x2`.
- The Calendar vendor bundles are about 1.2 MB each (two copies in `dist/`).
- The [source audit](../../docs/FRAMEWORK_SOURCE_AUDIT.md) records for
  `wstein/cubacle`: real 2×2–7×7 engines, AGPL-3.0-or-later, no browser WASM
  facade, WASM size and browser runtime **UNKNOWN**; 3×3 target overrides are
  only partial.

## Approach

1. Measure first (WASM facade and benchmark in cubacle).
2. Shadow-mode parity tests against Cubing.js on recorded fixtures.
3. Move the 2×2 adapter and research generator.
4. Add the missing cubacle features: exact-frame and ignore-centers 3×3 targets,
   a KPuzzle-like pattern/transformation API, worker-friendly table loading.
5. Move Picture 3×3 and the Calendar.
6. Remove Cubing.js, its bundles and notices; record an ADR.

**No runtime fallback to Cubing.js.** Until gate G2 it exists only as a
test-only oracle (a dev dependency used by parity tests, never imported by app
code). Verification is local.

## Gates (normative for this plan)

- **G1 measurement.** Record `.wasm` size (raw, gzip, brotli), cold and warm solve
  time on fixed scrambles, and peak memory, with the exact commands and
  revisions. Compare with the current Calendar bundles. A result clearly worse
  than the current bundles stops the plan after step 3; the decision is written
  down with the numbers.
- **G2 parity.** On every recorded Calendar and Picture fixture the cubacle result
  replays to an identical exact end state and uses no more moves than Cubing.js.
  Any difference stays `UNKNOWN` until root-caused; no vote or averaging.
- **G3 release.** `npm run typecheck`, `npm test`, `npm run test:pages` and the
  Calendar, Picture and Counter browser specs pass locally before Cubing.js is
  removed.

## G1 result

**Conditionally passed, decided by the owner on 2026-11-06.** Steps 2 and 3 go
ahead (shadow-mode parity, 2×2 adapter and research generator). The 2×2 cold start
and memory stay open. This is not a decision on steps 4 to 6 and changes no ADR.
Numbers from [cubacle `docs/wasm.md`](https://github.com/wstein/cubacle/blob/134b6a3749e8a251b5419df02b0037ee0fd938ec/docs/wasm.md)
(PR [wstein/cubacle#34](https://github.com/wstein/cubacle/pull/34), merge commit
`134b6a3749e8a251b5419df02b0037ee0fd938ec`; gate issue
[wstein/cubacle#21](https://github.com/wstein/cubacle/issues/21), epic
[#190](https://github.com/wstein/cubistry/issues/190)). Cubistry revision compared:
`fb19f8f17b6d28c359280ddfa285c9585d8c8ac2`, Cubing.js 0.66.1. Commands and setup
(Node v22.23.4, one aarch64 Linux VM, three runs) are in that document.

- **Size.** `cubacle-wasm`: 162,079 bytes raw, 61,134 gzip, 50,241 brotli. Against
  one Calendar vendor bundle (upper bound, the bundle holds more than the solvers):
  13 percent raw, 18 percent gzip and brotli. Against the embedded twips module,
  which serves the 2×2 only: 32 percent raw, 40 percent gzip and brotli. The 3×3 in
  Cubing.js is a JavaScript solver (min2phase) inside the bundles; its size there is
  **UNKNOWN**.
- **Moves** (12 fixed scrambles per size). 3×3 mean 20.83 for cubacle against 20.5
  for Cubing.js; 2×2 mean 8.83 for both.
- **Time, Node.** First 3×3 solve: cubacle 32.6 to 33.1 ms, Cubing.js 119.8 to
  121.9 ms. First 2×2 solve: cubacle 92.7 to 94.2 ms (tables built on the first
  solve), Cubing.js 16.6 to 20.3 ms. The ratio is derived here from the two ranges
  (92.7 to 94.2 ms against 16.6 to 20.3 ms), not stated in the source: the cubacle
  cold start is 4.6 to 5.7 times slower. Later calls: 3×3 median 0.2 ms against
  4.4 to 4.6 ms; 2×2 median 0.004 to 0.005 ms against 2.4 to 2.5 ms. Measurement
  limit: the Cubing.js times include the library's call overhead and, for the first
  call, its lazy loading (the 2×2 call runs after the 3×3 calls, so the worker
  already runs); the cubacle times are the `cubacle_solve` call only.
- **Memory.** cubacle: 21,364,736 bytes of linear memory after the first 2×2
  solve (peak of the module for these calls, as linear memory never shrinks). Cubing.js: **UNKNOWN**. No resident set was measured
  for either side.
- **Not measured.** Firefox and Safari, warm code cache, the other Calendar page
  files. The comparison is a hint for G2, not a parity result.

Open: whether the 2×2 cold start (about 93 ms in Node, 109 ms in Chromium) and the
21.4 MB of memory are acceptable.

## Constraints

- Pin cubacle by commit hash and integrity, as `puzlwerk-source.json` does; never
  vendor its source into Git.
- AGPL-3.0 §13 applies to network use; package or worker boundaries do not waive
  it. The ADR in step 6 documents handling.
- Preserve proof artifacts and their provenance; regenerate only with
  reproducibility retained. Cubing.js and cubacle results are solver outputs, not
  proofs of optimality.
- Retain license notices for anything that still ships.

Back to [Plans](index.md).
