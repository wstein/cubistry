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

Open (G1): whether the 2×2 cold start (about 93 ms in Node, 109 ms in Chromium) and the
21.4 MB of memory are acceptable. Decision **D4** (tables in-module, hashes in tests) does
**not** close this G1 open point.

## C2 to C5 go (2026-11-12; narrowed twice the same day)

**P** (pending owner confirmation on [Cubistry #430](https://github.com/wstein/cubistry/pull/430)):
the cloud-agent session was told "go also with C2-5" against the cubacle Browser
WebAssembly plan ([wstein/cubacle#38](https://github.com/wstein/cubacle/pull/38), merged
as `bb92669c`, plan revision [`78539646`](https://github.com/wstein/cubacle/commit/78539646)).
No matching owner quote is yet in a repository comment or issue; treat the go as
proposal until the owner confirms it on that PR. Later the same day the owner
sharpened the 2026-11-08 rule: **all components share one cube model and one
abstraction**. The comparison Draft is
[puzlwerk#49](https://github.com/wstein/puzlwerk/pull/49) on `docs/shared-model-comparison`
(`specs/006-shared-model/`; the PR is a Draft and its head moves, so this plan names
no SHA). Its decision record (README.md, plan.md section 4, read at head `0bd5f72e`)
lists these owner answers of 2026-11-12 (**O**, source: owner answer in the
coordinator session, as recorded there):

- **SM1:** PuzlWerk wire-v1 is the canonical model; the Cubacle fixed frame is the
  Rust implementation of the same semantics; Orbit64 V2 is a codec only.
- **SM3:** appearance is a separate document per sticker ID; wire-v1 revision 1
  stays unchanged.
- **SM4:** a schema generator; one schema generates the types and codecs for Rust
  and ReScript/TypeScript. This needs its own plan (generator steps G1/G2 there).
- **SM11:** the shared core and the generator are licensed EUPL-1.2 (the `LICENSE`
  file is a follow-up PR with a compatibility check). This plan states no license
  for them and does not contradict it.

**SM2** (V2 as the compact token derived from the canonical model, owned by
flix-orbit64) and **SM8** (one ReScript Orbit64 V2 module in PuzlWerk) are marked
as open proposals in that record at `0bd5f72e` (**P**, not **O**); this plan follows
them only as proposals. Until the cubacle plan is updated for SM1 and SM4 (a
follow-up docs PR in `wstein/cubacle`, puzlwerk#49 plan.md section 3):

- **Do not start** cubacle stacks **B** (own `kpuzzle` algebra) or **M** (target modes).
- **Do not take** cubacle plan **D3**, **D12**, **D13** or **D14** as approved.
- Any earlier blanket “D1–D14 as Recommended” reading is **withdrawn** for those holds
  (and for any D1 reading that starts B/M). Accepting D13 as Recommended would add a
  second public algebra and break the shared-model rule.

These holds stay in force until that cubacle plan update lands; SM1 being decided
does not lift them.

Narrowing per puzlwerk#49 section 3 / SM6 (**P**): record **A**, **L2** and **L3** as
the intended go set; keep B, M, D3, D12, D13 and D14 on hold. L1 may proceed only
with a capability/error-code mapping to the PuzlWerk
[solver contract](https://github.com/wstein/puzlwerk/blob/main/specs/001-core-foundation/contracts/solver.md)
(puzlwerk#49 §3 “change”). Cubacle C2–C4 are approach **step 4** of the cubacle plan
(section 1); approach **step 5** (move Picture 3×3 and Calendar onto cubacle) stays a
separate decision (unified-application.md D3/E0) and is not approved here.

### Still in force if the go is confirmed (stack A, L2, L3; L after A once D4/D11 are explicit)

| Decision | Choice taken |
| --- | --- |
| D1 (narrow) | Stack **A** may proceed; **B** and **M** wait on the cubacle plan update for SM1/SM4 and on SM5 |
| D2 | Commit plus `sha512` for the wasm tarball; tag pin unchanged for native binaries |
| D4 | Tables built in the module; hashes pinned in tests (needed before L3); does not decide G1 |
| D5 | xtask checks one `rustc` version; no repo-wide `rust-toolchain.toml` |
| D6 | Rust tarball writer in xtask (`tar` + gzip crates) |
| D7 | Package name `cubacle-wasm`, unscoped, unpublished |
| D8 | Yes: optional `cli` feature for `clap`, `sysinfo`, `toml` |
| D10 | Yes: light-lane wasm CI job after A3 |
| D11 | Terminate the worker plus `budgetMs`; no shared-memory cancel flag |
| L2, L3 | JS glue, table hashes, loader/worker/abort — model independent; proceed after A |

### On hold until the cubacle plan is updated for SM1 and SM4

SM1 and SM4 are decided, but the cubacle plan still assumes its own algebra and
Cubing.js numbering. Each row below stays on hold until the follow-up docs PR in
`wstein/cubacle` lands (puzlwerk#49 plan.md section 3).

| Decision | Was Recommended | Hold reason |
| --- | --- | --- |
| D3 | Cubing.js numbering | Numbering derives from wire-v1 piece IDs, checked by vectors; Orbit64 V2 is a codec only (SM1); Cubing.js numbering only as a test-side mapping (puzlwerk#49 plan.md section 3, SM5 open) |
| D9 | Fix-up after ignore-centers | Target-mode route; stack M |
| D12 | Calendar fixture list at M1 | Express as corpus rows (wire-v1 state + Orbit64 V2 token) after the plan update |
| D13 | Rust algebra + limited JS surface | Would fork the public model; types and codecs come from the SM4 generator, which needs its own plan |
| D14 | Module placement `src/kpuzzle` / `src/targets` plus `RULES` | Names modules for an algebra that is on hold; revisited in the plan update (puzlwerk#49 plan.md section 3) |

C1 facade measurement work already landed on cubacle (PRs #33 / #34; plan #38
merged as `bb92669c`). Stack A continues from that tip (`feat/wasm-build-1` …).
**UNKNOWN:** the target branch for cubacle implementation PRs. No repository source
records an owner decision on it. **V** GitHub lists `develop` as cubacle's default
branch (tip `bb92669c`); `main` (`5f41eb06`) and `develop` have diverged
(compare: 807 commits ahead, 3 behind), so `main` cannot be fast-forwarded to the
`develop` tip. The owner decides the base branch before any stack PR is opened.
Implementation PRs stay in `wstein/cubacle`.

### Focused work items (one PR each, stacked)

| WI | Branch | Depends on | Notes |
| --- | --- | --- | --- |
| WI-A1 | `feat/wasm-build-1` | `main` | C1 facade split + `cubacle_abi_version` |
| WI-A2 | `feat/wasm-build-2` | A1 | optional `cli` + `wasm-deps` |
| WI-A3 | `feat/wasm-build-3` | A2 | `cargo xtask wasm` + sorted manifest (D5) |
| WI-A4 | `feat/wasm-build-4` | A3 | deterministic tarball (D2, D6, D7) |
| WI-L2…L3 | `feat/wasm-loader-*` | A merged | proceed; model independent |
| WI-L1 | `feat/wasm-loader-1` | A merged | **change**: map capabilities/error codes to the PuzlWerk solver contract |
| WI-B1…B2 | `feat/kpuzzle-*` | **hold** | wait on the cubacle plan update for SM1/SM4, SM5 and D14 |
| WI-M1…M3 | `feat/target-modes-*` | **hold** | wait on the cubacle plan update for SM1/SM4 + D12/D13 |

Local patches for A1–A4 (rebased on tip `bb92669`) live with the cloud agent
artifacts until cubacle write access exists; do not open against `develop`. Do
not land a cubacle `kpuzzle` module from parked drafts.

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
