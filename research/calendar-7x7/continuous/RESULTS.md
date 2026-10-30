# R2 results: physical continuity demonstrated

## Verified chains

**Scoped SAT:** native Julia and native Flix independently accept the four
saved raw chains, with two consecutive chronological transitions each. Every
intermediate destination is retained as the next actual physical source.
There is one initial legal DAG state per chain, no reset between months.
The checkers agree on full 294-sticker hashes and all move metrics.

| Chain | First transition HTM / QTM / rotations | Second transition HTM / QTM / rotations | Total HTM |
|---|---:|---:|---:|
| Jan → Feb → Mar 2026 | 397 / 406 / 19 | 53 / 54 / 0 | 450 |
| Feb → Mar → Apr 2026 | 48 / 50 / 0 | 430 / 438 / 20 | 478 |
| Nov → Dec 2026 → Jan 2027 | 487 / 506 / 26 | 433 / 442 / 23 | 920 |
| Feb → Mar → Apr 2028 | 378 / 382 / 17 | 397 / 412 / 20 | 775 |

For these **eight verified edge observations**: minimum 48, mean 327.875,
median 397, nearest-rank p90 = 487, p95 = 487, maximum 487 HTM. Total HTM
is 2,623; QTM is 2,690; whole-cube rotation records total 125. Frequency:
48×1, 53×1, 378×1, 397×2, 430×1, 433×1, 487×1.
Primary-chain completion is **4/4**, not a full-domain completion rate.
These deliberately selected short chains are not a random sample and do not
establish a general move-count bound. Six of eight edges exceed 200 HTM;
R2 establishes continuity rather than R3's optimization targets.

Full source, intermediate and final hashes are in the paired native receipts
`evidence/julia-chain-N.tsv` and `evidence/flix-chain-N.tsv`, as well as the
raw `chain-N.moves.tsv` inputs. The candidate-generation timing log records
each edge's wall time: approximately 2.63–6.55 seconds in the initial run.
Those one-shot, JIT/cache-dependent measurements are computational observations,
not proof or comparative performance guarantees. Reproduction records fresh
timings and toolchain versions; the original candidate log remains labeled
CANDIDATE to preserve its provenance.

## Construction and physical constraints

R1's immutable printing, geometry, artwork equivalences and native foundations
are reused without modification. R1's catalog supported corners and two wing
orbits. R2 adds executable isolated commutators for all ten noncore cubie
orbits, including midges and movable centers.

An abstract central-layer quarter turn is expressed as a legal whole-cube turn
followed by the six compensating noncentral layers. All emitted words flatten
to the original 21-generator alphabet. The central-layer shorthand never escapes
into the certificate and is never charged as a free physical operation: six
layer turns cost six HTM, plus one separately counted whole-cube rotation.
Native verification checks the flattened raw word, not the abstract macro.

The fixed core center requires choosing an actual whole-cube frame with the
correct immutable artwork and up vector. The prototype enumerates 24 proper
frames, chooses a matching one, then repairs the other ten orbits with legal
macros. It retains every hidden cubie and sticker orientation. Piece-orbit
catalog availability is not a completeness theorem for this greedy planner.

The four chains cover both a December–January boundary and leap February 2028.
They also include marked sixth-week overflow: January 2027's 31 and April
2028's 30 wrap into their declared first-week columns. Both native checkers
generate these targets independently and check actual artwork orientation.
All four initial states remain existence-certified rather than practically
initialized; that limitation is inherited from R1 and is unchanged.

## Comparison with R1 and bounded state selection

R1's canonical February 2026 source yields a 48-HTM March transition. R2's
January chain reaches a different physical February state, despite displaying
the same calendar. The subsequent March transition costs 53 HTM. Both are
independently verified, demonstrating why visible-front equality cannot be
used to substitute sources in a continuous chain.

A separate bounded one-edge lookahead experiment changes the hidden March
state after the February → March step. It tests exactly three alternatives,
without changing the displayed March front in the planner's candidate check.

| Variant | First / next candidate HTM | Candidate worst | Candidate total | Evidence class |
|---|---:|---:|---:|---|
| Baseline | 48 / 430 | 430 | 478 | Same independently verified primary chain 2 |
| Hidden corner cycle | 56 / 427 | 427 | 483 | Exploratory candidate only |
| Hidden axial-center cycle | 66 / 430 | 430 | 496 | Exploratory candidate only |
| Hidden midge cycle | First edge emitted; next step stalls | — | — | UNKNOWN, bounded local-search plateau |

The corner alternative suggests a tradeoff: lower worst-edge length by three
HTM at the cost of five extra total HTM. This is an experimental planner result,
not a confirmed additional chain or optimality claim. Its raw input and hashes
are retained for future native replay. Candidate generation completes three of
four tested variants including baseline; this is separate from primary-chain
completion and independent verification.

The unsuccessful hidden-midge attempt stalls at three of four April front
midge slots. The imported search accepts monotonically improving single macros;
its bounded two-macro escape currently applies to corners only. This is an
exhausted local-search neighborhood, **not a wall-clock timeout and not UNSAT**.
Its emitted March prefix and intermediate candidate hash are preserved. The
smallest next experiment is a bounded two-macro midge escape from that exact
saved state, with independent native replay if it succeeds.

## Negative controls and failure classification

Both native checkers reject the same nine generated raw corruptions:

| Control | Failure being detected |
|---|---|
| Source substitution | Edge 2 claims the unrelated canonical February source hash |
| Hidden reset record | A second initialization record is inserted between edges |
| Canonical tail after hidden reset | Canonical-source R1 moves are spliced after the actual January chain without resetting its physical state |
| Corrupted intermediate | The first physical endpoint hash is altered |
| Incorrect artwork orientation | A legal front quarter turn is added with correctly updated metrics and physical hash; the artwork still fails |
| Incorrect moves | A quarter-turn direction is changed while preserving declared move counts |
| Incorrect metrics | Declared HTM differs from the actual raw sequence |
| Incorrect chronology | The next month is replaced with a nonconsecutive date |
| Incorrect initial root | A different legal root is substituted for the declared initial month |

The hidden-reset tail is particularly relevant: an independently valid R1 word
cannot simply be reused from an unrelated physical state with the same front.
The orientation control's correct physical hash/counts prevent those checks from
masking the intended artwork rejection. Negative controls test verifier rejection;
they are not calendar impossibility certificates. Their raw SHA-256 fingerprints
and native exit statuses are recorded; exact bytes regenerate deterministically.

The four primary construction attempts have no unsuccessful edge. The bounded
state-selection attempt supplies a real UNKNOWN local-search failure. Other
cases remain **UNKNOWN (not checked)**, rather than being mislabeled as failed searches.
No mathematical impossibility is asserted. PR #99's unbounded legal existence
result remains intact; the remaining questions concern practical construction,
solver completeness and bounded move lengths.

## Remaining obstacles and R3 recommendation

This result establishes eight continuous edge observations in four short chains,
not one 887-edge run. Arbitrary retained states can still trap the local search,
as the midge experiment illustrates. A source state should never be replaced to
hide such a trap. Longer-chain completion, practical initialization, general
length bounds, global optimality and production integration remain unresolved.

Recommend a separately authorized R3 focused on shorter setup words and
whole-cube/central-layer cancellation, plus bounded midge escape and destination
state selection optimizing worst-edge length before total length. Compare
approaches on identical retained physical starts. Avoid unrestricted search;
preserve exact raw inputs, time budgets, UNKNOWN failures and both native
receipts. The owner must review R2 before authorizing that next phase.

This PR and its R1 dependency stay Draft. No browser E2E, application changes,
merge, deployment or release was performed.
