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
