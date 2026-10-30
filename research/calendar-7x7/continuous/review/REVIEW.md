# Independent R2 continuity and implementation review

Date: 2026-10-30. Reviewer: separate Codex agent, not an implementation author.
The complete reproduction was independently run in an isolated worktree at
`7051043c45968c0067752451d416dce65db32673`. The final incremental review and
targeted regressions cover `eff3c2ad6f1f36315b360ac729df48ed3d427516`.

## Verdict and exact scope

**Scoped SAT for four saved two-edge chronological chains. No unresolved
blocking finding remains.** Both native checkers independently accept the same
raw inputs and produce byte-identical physical-state hashes and metrics.

| Chain | Edge HTM | Edge QTM | Whole-cube rotation records | Total HTM |
|---|---|---|---|---:|
| Jan → Feb → Mar 2026 | 397, 53 | 406, 54 | 19, 0 | 450 |
| Feb → Mar → Apr 2026 | 48, 430 | 50, 438 | 0, 20 | 478 |
| Nov → Dec 2026 → Jan 2027 | 487, 433 | 506, 442 | 26, 23 | 920 |
| Feb → Mar → Apr 2028 | 378, 397 | 382, 412 | 17, 20 | 775 |

These are eight edge observations in four selected chains, not an 887-edge run.
Mean = 327.875, median = 397, minimum = 48, maximum = 487 HTM; nearest-rank
p90 and p95 = 487. Totals are 2,623 HTM, 2,690 layer QTM and 125 whole-cube
rotation records. Completion is 4/4 selected primary chains. Six observations
exceed 200 HTM; no general short-path bound or global optimality is established.

## Physical continuity and legal moves

Each native verifier establishes exactly one initial physical state from the
unchanged legal-word DAG. Julia retains its complete `state` and pose permutation
across the edge loop. Flix folds over the actual preceding sticker vector and
pose permutation. Neither reads a replacement DAG root inside that loop.
Each edge's declared source hash is compared with the actual retained state,
not used to load a new state. Chronological adjacency is enforced independently.

All 294 immutable sticker IDs, cubie attachments, positions, normals and actual
up vectors are retained. Julia compares direct sticker rotation with the
complete rigid-piece lift after every emitted move. Flix independently derives
the legal geometry, performs direct sticker and pose replay, and requires exact
agreement at each month boundary. Both verify artwork, actual orientation,
declared metrics, intermediate hashes, edge inverses and whole-chain inverses.

The central-layer construction flattens to one legal whole-cube rotation plus
six compensating noncentral turns. Independent tests compare that word with the
exact central-slice action. Certificates contain only the original 21 legal
generators: no abstract central move or uncharged wide-turn shorthand escapes
into playback. Each layer half turn costs one HTM and two QTM; whole-cube
rotation records and their QTM remain separate.

The December–January and leap-February chains are directly checked. Marked
overflow artwork and the fixed core's actual up vector remain part of the
native targets. The diff from R1 adds only `continuous/`; R1, PR #99's immutable
printing and PR #97's evidence remain unchanged.

## Independently executed reproduction

At the complete-reproduction snapshot:

```sh
JULIA_BIN=/tmp/julia-1.13.3/bin/julia \
CALENDAR7_CHAIN_RESULTS_DIR=/tmp/calendar7-r2-review \
CALENDAR7_CHAIN_FLIX_BUILD_DIR=/tmp/calendar7-r2-review-flix \
bash research/calendar-7x7/continuous/reproduce.sh
```

The command passed. It regenerated all four raw primary chains byte for byte,
reproduced the three saved exploratory state-selection artifacts, and compared
the selection survey excluding only its elapsed-time column. The reviewer also
independently compared the exploratory baseline word with primary chain 2:
they are byte-identical. This does not confirm the other exploratory variants.

Independent validation passed 32 Julia grammar/metric tests and 105,482
generator/macro tests. The latter include exact central-layer flattening,
failure classifications and all recorded isolated macro actions. Native Flix
parser controls and the inherited 21-generator physical checks passed. All four
Julia/Flix chain receipts matched exactly, and the statistics file reproduced.

All nine common raw corruptions were rejected by both native checkers. Their
input hashes and exits exactly match the saved negative-results receipt.
The reviewer inspected the actual failure diagnostics: source substitution
fails retained-source equality; hidden initialization fails grammar; a canonical
R1 tail from the wrong physical source fails artwork; corrupted intermediate
hash fails physical-hash comparison; orientation/move corruption fails artwork;
incorrect counts fail metrics; incorrect dates fail chronology; and a different
initial root fails the declared source calendar. These are rejection tests,
not impossibility certificates.

After the final test-only changes, the reviewer independently rebuilt Flix and
ran the new orientation-only unit, Julia's 32 grammar plus five orientation
tests, Flix's parser and 21-generator self-tests, and chain 1 through both native
checkers. The final chain receipt matched the previous complete-run receipt.
Diff inspection confirmed that physical chain acceptance logic did not change.
The added native Flix command was:

```sh
java -Xmx8g -jar /tmp/calendar7-r2-review-flix/artifact/flix.jar orientation-selftest research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review /tmp/calendar7-r2-review/source-dag.tsv research/calendar-7x7/continuous/evidence/chain-1.moves.tsv
```

Toolchains: Julia 1.13.3, Flix 0.79.0, wrapper 0.34.9, OpenJDK 21.0.12.1.
Documentation spelling, offline relative links and `git diff --check` passed.
No browser E2E test, merge, deployment or release was performed.

The reviewer also repeated the canonical data-only audit from immutable main
snapshot `6d905ec3359f2dee06b24b0140dd2dd83303a057`:
`python3 /tmp/calendar7-review-corpus/proof-checkers/tools/audit_corpus.py`.
It returned `PASS_DATA_PINS` for 195 cases, 2,048 kernel rows, 36 generators and
801 chain values. The canonical manifest SHA-256 is
`c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01`.
Python was not a proof authority. This new research-local profile is not a
canonical checker registration. No native accept/reject, replay, metric or hash
dissent was observed. Research rejection diagnostics have no normalized
status-class contract; no canonical class-equivalence claim is made.

## Input fingerprints

| Input | SHA-256 |
|---|---|
| Immutable print | `b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931` |
| Raw legal source DAG | `ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24` |
| Chain 1 | `808bb07d217215984adc9f087c5572f96b8ee88d4d75cf1d5d292a08e71646d8` |
| Chain 2 | `0d85a6fdb384e2a90e8b0739809eb66fe5184eab6019eecee2abd8ba645110d7` |
| Chain 3 | `c6d1c84ced364a7b2a953bcd0a8f3b81917e4b6aeb58390623baa46a70a7498b` |
| Chain 4 | `aae8250ef4eb90d5d50f1eb98846e263b48f2d368a18f8edd2959c5a3c2172f9` |
| Julia verifier | `b6ae7ce58401a6c626b067823ea08f8d9d1607ee24dc45f065b15ae0f2654734` |
| Final Flix entrypoint | `da5c357a4e1eb07f27a17c328fada0b85efa99c6b59c63a42a208601a67c3721` |

The [manifest](../experiment.json) and paired native receipts retain every
initial, intermediate and final complete physical-state hash.

## Findings and closure

1. **Closed, evidence classification:** the exploratory manifest status used
   explanatory prose instead of the exact `UNKNOWN` label. Commit `b2eed7f`
   separates the status from its scope. The primary four-chain SAT claim remains
   explicitly scoped; unverified alternatives are not promoted.
2. **Closed, orientation regression coverage:** the original legal front-turn
   negative also changed artwork positions, so it did not isolate reading the
   sticker up vector. Commits `b71d168` and `eff3c2a` add independent native
   target-validation units. Each first accepts the legal baseline, changes only
   the SUN header's up vector, checks every other field is unchanged, and
   rejects the corrupted target. The synthetic state is explicitly a unit-test
   input, not a legal physical-state certificate. Both final units pass.

## Limitations and acceptance boundary

Practical initial-state setup, arbitrary retained-state completeness, long-chain
completion, the entire 887-edge domain, general move bounds, global optimality
and runtime integration remain unresolved. The hidden-midge plateau is a
bounded local-search failure, not a wall-clock timeout or UNSAT result.
The alternative corner and axial-center lookahead chains remain exploratory;
their generation and hash preservation are not native confirmation.

The [results](../RESULTS.md) distinguish those limits from the four verified
chains and correctly leave R3 optimization for separate owner authorization.
**PR #106 and its R1 dependency remain Draft for owner research acceptance.**
