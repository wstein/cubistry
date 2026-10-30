# Continuous English 7×7 calendar chains (R2)

## Scope and evidence status

R1 is provisionally accepted by the owner within its documented three-transition
scope. This separate R2 research branch starts at PR #105 commit
`014c383874170f35542305aeeed0945310a33408`. R1, PR #99's immutable
240-nonblank printing and PR #97's evidence remain unchanged. No parent PR is
merged or promoted. Issue #102's research boundary applies.

The question is whether at least two consecutive chronological month transitions
can execute while retaining the complete physical cube state. The actual end
of edge N must be the exact start of edge N+1, including all hidden stickers,
positions, normals and up vectors. Matching artwork alone is insufficient.
One legal initial state may be established by the original DAG, without
expanding it. Practical physical initialization remains a separate limitation.

**Current status: UNKNOWN.** A planner candidate is not proof. Native Julia and
native Flix must independently accept the same raw chain, including every
intermediate physical state, chronological date, artwork orientation, claimed
metrics and exact state hash. Neither may silently substitute a new source.
Global optimality, full 887-edge coverage and runtime integration are not
claimed. No printing change or unrestricted optimization is authorized.

Initial experiments use January–February–March 2026,
February–March–April 2026, November–December 2026–January 2027, and
February–March–April 2028. Unsupported algorithms and budget exhaustion are
UNKNOWN, not mathematical impossibility. A verified partial result with explicit
remaining obstacles is acceptable; no positive result will be fabricated.

## Executable chain contract

UTF-8, LF-terminated TSV, no empty records. Fixed fields:

```text
cubistry.calendar7.chain.v1
source<TAB>ROOT<TAB>YEAR<TAB>MONTH<TAB>STATE_SHA256
edge<TAB>YEAR<TAB>MONTH<TAB>HTM<TAB>QTM<TAB>ROTATIONS<TAB>ROTATION_QTM<TAB>SOURCE_SHA256<TAB>DESTINATION_SHA256
move<TAB>GENERATOR<TAB>QUARTER_EXPONENT
end
edge<TAB>YEAR<TAB>MONTH<TAB>HTM<TAB>QTM<TAB>ROTATIONS<TAB>ROTATION_QTM<TAB>SOURCE_SHA256<TAB>DESTINATION_SHA256
move<TAB>GENERATOR<TAB>QUARTER_EXPONENT
end
finish
```

This is a syntax illustration, not a solution. `<TAB>` means one actual tab.
The sole source root is a legal state from PR #99. Its declared date must match
that physical front. Edge dates must be successive months in 2026–2099. There
must be at least two edges and at most 1,000; at most 100,000 move records per
edge. No source replacement, state snapshot loading or reset record is allowed.
Each edge's source digest must equal the actual retained physical state; its
end digest must equal the computed full physical result.

Generator IDs and metrics are exactly [R1's conventions](../practical/README.md):
individual noncentral layers cost one HTM, a half turn costs two QTM, whole-cube
rotations are counted separately, and wide turns require individual-layer
expansion. Exponents are `-1`, `1` and `2`. All declared counts must equal native
replay counts. Both checkers also verify exact inverse restoration.

The reproduction evidence must distinguish verified cases from exploratory
candidates and classify unsuccessful cases as unsupported, budget exhausted,
missing construction, verification failure or certified impossibility. Only
an independently checkable impossibility proof would justify the last category.

R2 remains Draft for owner research acceptance. No browser E2E, application
integration, merge, deployment or release belongs to this experiment.
