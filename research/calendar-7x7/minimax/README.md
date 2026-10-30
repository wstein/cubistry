# R3 minimax calendar transition research

Owner-authorized implementation of the R3 analysis, based on PR #106 commit
`c1619530e554e85622d8383636fbca4a248e1d3e`. This is an optimistic research
stack. All R2 evidence, native validators, immutable printing and parent PRs
remain unchanged. No browser E2E, runtime integration, merge or deployment.

Priorities are worst-edge HTM, complete-chain maximum, average/variance, then
already short edges. The 100–120 HTM target and desired 200-HTM upper bound
are research objectives, not guarantees. Short edges must not be padded.

Baseline: 397, 53, 48, 430, 487, 433, 378, 397 HTM, mean 327.875, maximum 487.
Individual noncentral layers cost one HTM; half turns cost two QTM; whole-cube
rotations are separate. Central shorthands must expand exactly as in R2.

The initial scope is cost-consistent cached macro candidates, weighted macro
representations, endpoint-preserving sequence simplification, bounded search
including midges, and retained-state minimax selection. Every adopted candidate
must pass the unchanged Julia and Flix chain verifiers. Full-state hashes,
source provenance, raw words, metrics, timings, budgets and failures are saved.
Any native dissent yields UNKNOWN and the prescribed independent root-cause
investigation. Search failure is never an impossibility proof.

**Checkpoint status: scoped SAT for five saved raw chains**, independently
accepted by unchanged native Julia and Flix replay. See
[evidence and open review findings](evidence/README.md). Primary maximum is
446 HTM; the 100–120 and 200-HTM objectives remain UNKNOWN. The owner subsequently authorized Phase A completion before application
integration. [Corrected verification](verification/README.md) records the fixed
implementation and fresh native receipts. [Independent review](review/REVIEW.md)
clears Phase A for the documented five-chain scope, with all blocking findings
closed. Optimization targets and general solver completeness remain UNKNOWN.
This PR remains Draft for owner research acceptance; no parent PR is changed.
