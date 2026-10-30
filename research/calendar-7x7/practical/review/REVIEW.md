# Independent R1 implementation and proof review

Date: 2026-10-30. Reviewer: separate Codex agent, not the solver or checker
implementation author. Review snapshot:
`5a1f3fdf3e92cea5818c634ae70831989e8e6cb6`, in an isolated worktree.

## Verdict and scope

**Scoped SAT for the three saved finite transitions. No unresolved blocking
finding remains.** Native Julia and native Flix independently accept each raw
word, agree byte for byte on source and endpoint physical-state hashes and
all five metric fields, and restore the exact source under the inverse word.

| Chronological transition | Source root | HTM | QTM | Whole-cube rotations |
|---|---:|---:|---:|---:|
| February → March 2026 | 2 | 48 | 50 | 0 |
| February → March 2029 | 38 | 57 | 60 | 0 |
| February → March 2030 | 50 | 62 | 66 | 0 |

The source-root metadata identifies those exact February months. Both checkers
validate the source artwork and independently generate the destination artwork.
Every move acts legally on the complete physical cube, not just the visible
front. All 218 cubies and 294 individually identified stickers retain their
immutable artwork, positions, normals and actual up vectors. The metric charges
each individual noncentral layer turn once in HTM, a half turn twice in QTM,
and whole-cube rotations separately; wide turns are not free shorthand.

These are three separately initialized favorable transitions. They do not form
a consecutive physical chain. The original source initialization remains an
existence-only DAG, evaluated without expanding its astronomical word.
Practical initialization, all 887 chronological edges, boundary transitions,
global optimality, print-font production and runtime integration remain outside
this result. The 25 candidate date-specific outputs in the broader experiment
are not independently confirmed as a set by this review.

## Independently executed checks

From the repository root, after inspecting the driver and underlying native
implementations:

```sh
JULIA_BIN=/tmp/julia-1.13.3/bin/julia \
CALENDAR7_RESULTS_DIR=/tmp/calendar7-review-final \
CALENDAR7_FLIX_BUILD_DIR=/tmp/calendar7-review-flix \
bash research/calendar-7x7/practical/reproduce.sh
```

The reviewer independently built the additive Flix project from source in the
temporary build directory. No Julia solver decisions or endpoint permutations
are inputs to Flix. Native Julia uses direct sticker rotations and independently
checks them against the pose action; native Flix derives geometry separately and
compares its pose replay with direct sticker rotations. Both derive the legal
source from the unchanged raw DAG and validate the whole destination front.

The reproduction run passes:

- Byte-identical regeneration of all three selected sequence files.
- 27,321 Julia macro tests, including all 9,104 generated actions, complete
  recorded permutations and fixed untargeted orbits.
- 327 Julia protocol, profile, move-convention and semantic tests.
- Native Flix parser positive and 12 malformed-input controls, inherited
  physical tests for all 21 generators, and three semantic rejection controls:
  removed first move, wrong destination month and an empty word.
- Independent native replay of all three words, with byte-identical four-line
  receipts and the expected 48/57/62 HTM counts.
- Reproduction of the full 887-edge artwork-difference survey, including its
  distinction between changed artwork counts and legal-move counts.
- Documentation spelling, offline relative links and `git diff --check`.

Toolchains: Julia 1.13.3; Flix 0.79.0; wrapper 0.34.9; OpenJDK 21.0.12.1.
No browser E2E test was run. No merge, deployment or release was performed.

The reviewer additionally ran the canonical **data-only** corpus audit from
immutable main snapshot `6d905ec3359f2dee06b24b0140dd2dd83303a057`:

```sh
python3 /tmp/calendar7-review-corpus/proof-checkers/tools/audit_corpus.py
```

It returned `PASS_DATA_PINS`: 195 cases (41 counter, 154 geometry), 2,048 kernel
rows, 36 kernel generators and 801 chain values. Manifest SHA-256:
`c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01`.
This audit establishes frozen data identity, not mathematical acceptance of this
new research profile. The canonical checker directory is absent from this
research dependency; no canonical profile registration is claimed. Python was
not used as a proof authority. No native accept/reject, replay, count or hash
dissent was observed. The research CLI has no normalized rejection status-class
contract; different diagnostic text is not promoted to a canonical class claim.

## Input and implementation fingerprints

| Input | SHA-256 |
|---|---|
| Immutable physical print | `b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931` |
| Raw source legal DAG | `ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24` |
| 2026 finite word | `70bd684e144978acaa4231907d4d4943c516caec7dbda3bffda9d19dc1c06a00` |
| 2029 finite word | `1689452a588f8caf62f8c39ea42e562a90dd9eda33a8ca2a2405d6be403a17c1` |
| 2030 finite word | `c41781eb676c7c45a703567e97e39214ec6f1851fcbe32567f3976a5b794513e` |
| Additive Julia verifier | `87e266b98b7991c624b9601e7ee2ae57d43cd91ddf2e82f480e2dfa2d066eccf` |
| Additive Flix entrypoint | `4a919ed513b32e9da5328ccdaaa0bff846b9c858b100030638adb346ed97c877` |

The [experiment manifest](../experiment.json) records each verified endpoint
digest and exact statistics. The [findings](../RESULTS.md) retain the initial
50-HTM candidate and distinguish it from the deterministic 48-HTM word. Those
are different raw inputs and physical endpoints, not checker disagreement.

## Findings and closure

1. **Closed, reproducibility blocker:** the extended reproduction driver in
   `5cfdd56` expected `feb-mar-YEAR.moves.tsv` for generic solver invocations,
   while that CLI writes `transition-SOURCE-YEAR-3.moves.tsv`. The native words
   were valid, but the documented complete command failed at its comparison.
   Author fix `d95bb2a` corrects the filename. The final complete reproduction
   above exercises the corrected command and all three comparisons.
2. **Closed, claim clarity:** the generic certificate checks legal source-root
   to destination artwork, not an external chronological month mapping. The
   selected source IDs map to the exact stated February months. Documentation
   explicitly preserves this boundary for candidate surveys and future chains.

The diff against PR #99 adds only `practical/` files; existing PR #97 and #99
artifacts are unchanged. The independent review supports the scoped R1 result
and its stated limitations. **PR #105 stays Draft for owner acceptance.**
