# Independent row-2 endpoint proof review

Date: 2026-10-30. Reviewer: separate Codex agent, not the proof implementation
author. Checked snapshot: `13752f82668520ab48411e84f68afc747cb2aefd`, in an
isolated worktree. **No blocking finding remains for the stated research scope.**

## Verdict and exact claim

**Research-local SAT:** the existing English calendar printing supports the
checked month states and five practical chains while restoring the same seven
weekday stickers and their host cubies to exactly the same front-row poses at
each checked month endpoint.

Native Julia and native Flix independently accept:

- All 91 pinned legal physical states representing 888 months in 2026–2099.
- Five pinned continuous chains and all ten retained transition endpoints.
- The same exact seven sticker IDs, host IDs, positions, normals and actual
  up vectors, with the same row serialization hash throughout.

The certificate selects sticker IDs `66, 200, 237, 213, 202, 199, 290`, on cubies
`44, 154, 179, 166, 156, 153, 217`. Column c has position `(c−4,2,3)`, front
normal `(0,0,1)` and up `(0,1,0)`. The validators compare those exact fields
before computing the supplementary row SHA-256:
`2592f05dad652f99ad8f6bfed0cf77b86061747856edb6bf75bb63f7cbacb95a`.

This is **endpoint-only and front row 2 only**. It does not require the stickers
to remain still during primitive turns, nor constrain two rows or entire
horizontal rings. No impossibility conclusion about those other problems is
drawn. No complete practical 887-edge run, practical initialization or efficient
arbitrary-month solver is established here.

## Why uniqueness implies the conditional invariant

Both native implementations inspect all 294 immutable source surfaces at all
four in-plane orientations. Each required weekday has exactly one matching
surface and only the upright orientation, including ink and the declared O/0
and I/1 aliases. This is not a literal-text search that would overlook the
printed `M0N` and `FR1` forms.

Consequently, any legal full state correctly displaying this exact calendar
profile must place that same surface in the specified weekday cell, with the
same normal and up. Its host cubie is fixed by immutable attachment. A proper
rigid rotation is determined by the normal/up frame, so the host's physical
orientation is also determined. This conditional implication is separate from
constructing a state; the legal witnesses supply the required existence.

The implementations additionally replay and lift the full physical states,
retaining all 218 cubies and 294 sticker identities and checking all 49 front
artworks and orientations. The compressed legal DAG is evaluated without
expanding its astronomical words. Chain replay retains the actual preceding
permutation, checks chronology, raw legal moves, declared metrics and complete
source/end hashes, then checks the row-2 identity at every boundary. It does
not load an unrelated intermediate source.

## Independently executed reproduction

From the isolated repository root:

```sh
JULIA_BIN=/tmp/julia-1.13.3/bin/julia \
CALENDAR7_ROW2_FLIX_BUILD_DIR=/tmp/calendar7-row2-independent-flix \
bash research/calendar-7x7/row2-invariant/reproduce.sh /tmp/calendar7-row2-independent
```

The full command exits 0. The reviewer independently built Flix from the pinned
native source modules. Fresh Julia output, filtered fresh Flix output and both
saved receipts are byte-identical: **114 lines** each. The fresh full Flix log
also matches its saved 138-line log, including the unchanged DAG diagnostics.
The summary reports exactly seven unique oriented surfaces, 91 legal roots,
888 target months, five practical sources and ten retained endpoints.

Both checkers reject all four regenerated certificate corruptions with exit 1.
The reviewer inspected their actual failure diagnostics:

| Control | Rejection |
|---|---|
| Wrong weekday sticker ID | Oriented-surface uniqueness mismatch |
| Wrong up vector | Certificate contradicts the upright front-row pose |
| Duplicate column | Certificate column/order constraint |
| Wrong row position | Certificate contradicts the exact row-2 position |

The corruption outcomes are invalid-certificate results, not UNSAT proofs.
No native accept/reject, replay, count or row/full-state hash dissent was
observed. Rejection text is not a canonical normalized status-class contract.

Toolchains are Julia 1.13.3, Flix 0.79.0, wrapper 0.34.9 and Java 21. The freshly
built reviewer Flix artifact SHA-256 is
`b4708a7b1d728b64ab1989dc46e645239e276d44c996bdafddc7d2b03b867aaa`;
the manifest separately records the author's artifact. Rebuilt binary identity
is not substituted for independently matching native replay results.

## Provenance and data audits

The diff against unchanged PR #99 commit
`1bd783245abaa0d10946945be309e9fe8392d392` adds only `row2-invariant/`.
Old printing, model, proof inputs, native checker sources and application code
are not modified. The five practical inputs are extracted by exact Git commit
`545e342b75d883e88159fd31d8acfcdee3b95f59`; no R3 planner code is required.

The reviewer independently audited all manifest fingerprints: 26 evidence files,
three checker/certificate inputs, three borrowed native Flix sources, five raw
practical inputs from the exact dependency commit, and the print/DAG pins.
All match. Both proof checkers also enforce the immutable print and raw DAG
SHA-256 themselves:

- Print: `b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931`.
- DAG: `ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24`.

The canonical **data-only** corpus audit from immutable main snapshot
`48de7defa1e7e7a0a7744f5697874150d29a50ed` was repeated and passed:
`python3 /tmp/calendar7-r3-review-corpus/proof-checkers/tools/audit_corpus.py`.
It confirms 195 cases, 2,048 kernel rows, 36 generators and 801 chain values;
manifest pin
`c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01`.
Python was used only for data identity audits, not proof acceptance or dissent
resolution. This research-local certificate is not a canonical profile
registration.

Documentation spelling, offline relative links and `git diff --check` pass.
The executable script modes are committed. No browser E2E, merge, deployment
or release was performed.

## Remaining boundary

The result concerns the immutable symbolic artwork profile, not arbitrary
production fonts or different prints. Keeping row 2 motionless throughout a
transition, keeping additional rows or rings, efficient all-month playback,
global optimality and production integration remain outside this proof.

The [manifest](../experiment.json), certificate and native receipts support
the stated endpoint-only result without changing existing evidence.
**PR #119 remains Draft for owner research acceptance.**
