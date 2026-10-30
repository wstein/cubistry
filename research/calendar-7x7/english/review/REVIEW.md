# Independent English calendar proof review

Date: 2026-10-30. The review covers the source snapshots below and the specified
raw printing and legal-word certificate. The author will record the final Git
commit after incorporating this receipt. Later code changes need diff review.

## Verdict and precise scope

**No blocking finding remains for the research-local SAT witness or its
240-nonblank-surface optimum under the declared glyph-equivalence profile.**

The claim is one English 7×7 fixed print for every month in 2026–2099: Sunday-first
weeks, red Saturday/Sunday headers and dates, three separate uppercase month
letters in columns 5–7 for January–September and 1–3 for October–December,
no printed year, and explicitly marked sixth-week overflow. Whole-cube rotations
and choosing a different physical front are allowed.

The symbolic artwork profile, including the allowed 6/9 half turn, circular
0/O and bar 1/I, is part of the claim. This is not certification of an actual
licensed font, SVG print sheet, or production application. The new certificate
format is research-local; no canonical counter/state3 registration or canonical
`CONFIRMED` status is implied.

## Why the positive witness is sufficient

The certificate begins only with the 21 independently defined legal generators:
18 noncentral layer quarter turns and three whole-cube quarter rotations.
Every later node is a product of earlier nodes or their inverses. Ascending
references therefore certify a finite legal word by induction; GAP's group order,
stabilizer-chain claims, and candidate solver verdicts are not proof authority.

The 264-point action retains 24 oriented poses in each of 11 physical component
orbits. Corners and midges retain their face frame, and the core retains its up
direction. The native decoders require a single proper rotation for all pose
representatives belonging to each home cubie, then lift it to every attached
sticker. They check all 218 physical cubies and 294 surface locations without
collision or identity loss. Text and ink remain attached to the same source IDs.
Actual up vectors, including the face-center up, are checked before optical
equivalence; the more permissive core inventory quotient is not used as a replay
substitute.

The raw target table is checked against independently computed Gregorian boards.
All 888 months map to the 91 first-occurrence representatives. Each complete
replayed state satisfies all 49 cells of its target board. Independent Julia and
Flix runs agree on all 91 SHA-256 digests of the full 294-sticker states, including
hidden sticker normals and up directions. Julia also checks exact algebraic
closure of A→B→C→A using the certified state permutations.

The native checkers separately derive a lower bound by summing, for each sticker
orbit and nonblank oriented-artwork class, its maximum simultaneous demand.
That lower bound is 240. The same legal print has exactly 240 nonblank surfaces,
so it attains the bound even after full legal reachability is required. The
earlier 250-surface baseline was a coupled-front candidate; it is not treated
as a separately certified earlier physical solution. The remaining 54 blanks
are actual print surfaces, not a freely reusable design budget.

## Findings and closure

1. **Closed, proof-checker soundness:** the original Flix axis-unit check used
   fixed-width squared norm arithmetic. Blank sticker 25 with up `(65536,1,0)`
   passed that check because 65536² wraps to zero in Int32, while Julia rejected
   it. The reviewer independently reproduced the accept/reject disagreement.
   A separate [Codex Sol root-cause investigation](../rc-overflow/REPORT.md)
   established the cause before correction. Both native readers now require
   exact membership in the six signed coordinate axes before tangent arithmetic.
2. **Closed, evidence preservation:** a partial or variant Julia replay could
   overwrite the full-state hash receipt. Partial/variant output now has an
   input-hash-specific filename and cannot replace the complete 91-state file.
3. **Closed, canonical metadata:** Julia required the first lexicographic target
   pose while Flix accepted any compatible target frame. Both now enforce the
   producer's canonical first-pose choice. The valid witness bytes did not change.

After correction, the reviewer independently ran the original malformed fixture
through the final native Flix `data` command and Julia `read_physical`: both
exited 1. The reviewed corrected Flix JAR SHA-256 was
`b9c91ca22aa474f78f8b07e2225cf9f78583f65435cef90ac507b45631004409`.
The malformed fixture SHA-256 was
`58b26265a392049333fc098a1fb46eacf0ef561eba88a0b4092f64f900498608`.

The reviewer inspected the authors' post-correction full-replay receipts and the
shared control tables: both native implementations reject all 26 corrupt cases
and accept the legitimate alternative blank-axis control. All 91 valid state
digests remain unchanged and agree. The reviewer did not unnecessarily duplicate
those complete runs; the independent before/after exploit reproduction was the
additional review test.

## Witness fingerprints

| Input | SHA-256 |
|---|---|
| Physical 294-sticker print | `b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931` |
| Complete legal DAG | `ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24` |

## Reviewed source fingerprints

Paths are relative to `research/calendar-7x7/`.

| Source | SHA-256 |
|---|---|
| `english/prepare_physical.jl` | `008f056ef95fd9a30eb8ee9de0db0289fe867e5994697d8e2d257b44fcd1865b` |
| `english/replay_legal.jl` | `c405bd9cac39ccf13236cb69a48fb278c32d701c9a7d0c0c7faa198c7f51b444` |
| `english/negative_controls.jl` | `7a4f50788b396b92ee5ce4ac143b262cbe27d5e553ead0f27241638023346cd7` |
| `english/flix/src/Core.flix` | `01719a6d01f9bb2021d51d621905571d2165c7540767729a66d04c9370935d5a` |
| `english/flix/src/Data.flix` | `e6dc0d3911deb93dae23c1220181d4a293582ee8183e31f3d0e7c40e208dbb7f` |
| `english/flix/src/Dag.flix` | `852ecf1c5f5f724e04c2eeb788c9426811d2404a8fd546a2f161f9ed0c816535` |
| `english/flix/src/Main.flix` | `df513f41acc3964303f103926ff121bf31d138949946d08b2926b4567c7b2430` |
| `en-physical-review/group_action_audit.jl` | `04785425b18a73dc513b5e321cf9f885de1a77d620043be0e7a7a9fc38d597ff` |
| `en-print-optimization/assemble_and_check.jl` | `2ec71fae3f63f9fafda93f42e48cab9b7182e54ab1f9a8bd1bd532c2c499997c` |

## Limitations and delivery boundary

The generated, unreduced words contain roughly 10^111 generator leaves.
Compressed replay proves existence; it does not provide usable human playback,
HTM-optimal paths, or a short-path guarantee. The count separates layer quarters
from whole-cube rotations and must not be presented as a necessary move lower
bound. Practical transition synthesis is separate work.

This review does not alter the German obstruction, authorize a merge or
deployment, register a canonical proof profile, or mark a PR Ready. It supports
a focused Draft PR with the stated scope and limitations.
