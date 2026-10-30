# HSM recovery raw-input profile

Status: draft contract proposed before Julia implementation. Confirmation remains
**UNKNOWN** until the independently implemented Julia and Flix checkers accept
the same two raw files and a separate review clears their implementation.

This additive profile leaves the frozen issue-74 files, the existing HSM corpus,
its expected `UNSUPPORTED` recovery case, and all historical evidence unchanged.
It adds a separate command instead of changing the meaning of `hsm FILE`:

```sh
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl hsm-recovery RECOVERY.json MODES.json
```

The later Flix command has the same arguments. Each checker reads both files
itself; neither consumes another checker verdict. The existing native HSM model
may be reused within each language, but no production mechanics or Python proof
verifier is a dependency. The original HSM and all-mode proof claims retain
[their existing scope](HSM-PROFILE.md); this profile adds recovery claims only.

## Frozen source inputs

- Research revision: `30b6d022da60c366d79de5498497df0a07e28caf`.
- Recovery schema `cubistry.hsm-seconds-first-recovery`, version 1, SHA-256
  `0679d41c0f7241787a6680e8cea66f0b82c6c57eb02a11225f4e1a7efe162bda`.
- All-mode witness schema `cubistry.hsm-seconds-first-modes`, version 1, SHA-256
  `5dd24dd70d678cc9e7f24da633ba1a772b7ccaf72aa1d4a1622c197ba318c2ae`.

These are provenance pins, not a substitute for computation. Mutated inputs must
be independently rejected for the actual defect, not merely their changed hash.

## Parsing and binding

Both raw readers enforce bounded valid UTF-8 JSON, no byte order mark, no duplicate
keys, bounded nesting and number tokens. Unknown schema/version is `UNSUPPORTED`;
other invalid structure or claims are `INVALID` (`INVALID_JSON` for JSON syntax).
Exact key sets are required. Integer fields require integer tokens, excluding
Booleans, floating-point and exponent forms. `meanSteps` is the sole real-number
field: a finite number in [0, 100000], equal to the recomputed exact mean rounded
to four decimal places (nearest, ties to even). Printed words use the existing
strict HSM move notation, with a half turn counted as one HTM.

The all-mode witness uses the existing strict HSM parser, validates its immutable
24-sticker print, legal full-frame setups, every period edge, modular display
order, full-pose closure and inverse closure. Application periods use the same
selection rule as the existing profile. Recomputing their minimum-mean graph
certificates is outside this recovery command; those remain separate HSM claims.
Recovery `printCode` must match that derived from the witness's physical print.

Recovery top-level keys are `schema`, `version`, `label` (informational string),
`printCode`, `edgeLimitHTM` (5), `objective` (exact string
`lexicographic: edges above the limit, steps, HTM`), `modes`. There are exactly
18 rows, ordered S/M/H, maximum 59/23/11, direction +1/-1. Row keys are
`letter`, `maximum`, `direction`, `sourceDirection`, `traversal`, `graphNodes`,
`edgesAtMostLimitOrForced`, `periodNodes`, `unreachable`,
`poseWithoutEdgeAtMostLimit`, `stepsHistogram`, `edgesAboveLimitHistogram`,
`maximumSteps`, `meanSteps`, `maximumRecoveryHTM`, `samples`.

Histogram keys are canonical ASCII nonnegative decimal integers; counts are
positive JSON integers. All mode identity/selection/traversal fields must match
the recomputed application period. Samples contain exactly `fromValue`,
`setupFromSolved`, `steps`, `words`, with at least two samples and the first
attaining `maximumSteps`.

## Exhaustive graph and objective

For each mode independently enumerate every legal settled full eight-corner pose
showing an upright display of its range, including the real blank's allowable
orientations and the corner-twist constraint. Preserve all hidden cubies; do not
quotient global rotations. The graph's nodes include their displayed value.
An edge advances exactly one modular increment/decrement and consists of legal
face turns. If a node has some next-display route of at most five HTM, include all
endpoint poses reachable in one through five HTM. Otherwise include the endpoints
of all shortest next-display routes (six HTM). Duplicate endpoints retain the
minimum HTM cost.

Same-face adjacent turns can be reduced and commuting opposite-face turns ordered
canonically: omitting their redundant words preserves every endpoint/minimum
cost. Independently verify graph endpoints belong to the enumeration. The goal
set contains every full pose in the selected application period.

Reverse multi-source shortest paths minimize the exact integer triple
`(number of edges above five, number of display steps, total HTM)`
lexicographically. Goal nodes have triple (0,0,0). Recompute all distances rather
than trusting histograms or sample paths. Validate exact graph node/edge counts,
forced-pose count, no unreachable nodes, goal count, both histograms, maximum
steps, maximum total HTM and rounded mean steps against the raw row. Also check
that above-limit edges are needed for at most one step and exactly the forced
source poses require one.

Replay every sample through full sticker frames and its inverse. Each source and
endpoint must show the stated display; every step is at most five HTM or is a
shortest route from a pose with no route of five. No intermediate sample node may
already be a period goal. The final state must be a period goal. The sample's
cost triple must equal the independently computed optimum for its source.

## Verdict boundaries and reporting

Output is one deterministic JSON line with both input SHA-256 values, print hash,
all 18 ordered mode summaries and sample replay counts. Include exact rational
mean steps as well as the four-place representation; no wall-clock timings in
the verdict. Both implementations must produce byte-identical valid outputs.
Global print optimality and runtime reachability of forced poses remain UNKNOWN /
NOT_CHECKED. In particular this profile must not claim universal five-HTM recovery:
raw tables explicitly include forced six-HTM M/H poses. The owner accepts six HTM
for minutes and up to ten HTM for hours; normal second counting retains its
five-HTM priority. Those runtime policies do not change this unrestricted graph.

Execution order is Julia first, then independently implemented Flix on identical
raw files. Julia acceptance alone is not CONFIRMED. Any actual dissent invokes
[the authority stop and root-cause rule](AUTHORITY.md); no voting or Python gate.
