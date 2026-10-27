---
name: feasibility-spike
description: Investigate Chronocube/cube-state feasibility with explicit assumptions and reproducible SAT/UNSAT/UNKNOWN evidence.
---
# Feasibility Spike

Use for every mathematical or combinatorial feasibility experiment, including alternate languages, leading zeros, sticker layouts, and date/time constraints.

## Inputs
1. Exact question and scope: puzzle size, legal moves, target dates/times/languages, sticker identity and orientation, print restrictions.
2. Baseline commit SHA and known prior results.
3. Solver version, parameters, seeds, hardware/time limits.

## Procedure
1. Write a scoped hypothesis and enumerate invariants and constraints before solving; mark new assumptions.
2. Define a machine-readable experiment manifest plus exact reproduction command.
3. Separate the candidate generator from the witness validator. Validate legal moves, target coverage, orientations, and printing assignment independently.
4. For each run, preserve input hashes, solver/validator versions, invocation, output, exit status, and bounded execution metadata.
5. Classify results:
   - **SAT** only with saved witness and independently executed validator success.
   - **UNSAT** only with a certificate or independently checkable exhaustive proof for the specified model; a timeout or unsuccessful search is NOT UNSAT.
   - **UNKNOWN** for timeout, errors, incomplete search, unverified witness/certificate, or insufficient evidence.
6. Compare changes to prior runs; never silently broaden an earlier result to new assumptions.
7. Commit an analysis note under `knowledge/zettel/` or the appropriate research path and link to outputs. Never modify a prior certificate in place.

## Deliverables
- Research question, constraints, evidence status and limitations.
- Reproduction recipe, manifest, witness/proof paths and checksums.
- Independent validation result, exact command and test output.
- A focused Conventional Commit with no unrelated refactor.

## Stop conditions
If the solver or checker cannot run, retain `UNKNOWN`, document blocker and next experiment. Never invent proof outcomes.
