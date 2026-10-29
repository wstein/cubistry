---
name: proof-review
description: Independently review mathematical feasibility claims and supporting witnesses or UNSAT certificates.
---
# Proof Review

Use before approving any SAT/UNSAT assertion, print plan, or published feasibility conclusion.

## Separation of responsibilities
Reviewer must not rely solely on assertions from the generator, solver or original author. Prefer a separately implemented checker and a clean invocation at a pinned commit.

## Checker authority
Follow [proof-checkers/AUTHORITY.md](../../../proof-checkers/AUTHORITY.md). A proof is **CONFIRMED** only when both the Flix and the Julia checker accept it. Python verifiers play no role in confirming proofs or resolving dissent. We do not vote: any Flix/Julia dissent (a different accept/reject decision, witness/replay result, hash or count) yields **UNKNOWN** and requires a root-cause investigation by an Opus-class agent or stronger, then re-evaluation after fixing the checker or spec and re-running both checkers; no majority vote, no tie-break by a third source. Status-class-only differences with the same decision are not dissent; list them separately and check that each is itemized in `proof-checkers/coverage.json`.

## Review checklist
1. Freeze precise claim: puzzle geometry and legal group action, sticker IDs, permutation and orientation rules, time/date domain, language and formatting, and permitted art/print operations.
2. Verify input provenance and version hashes; check that claims match the constraints encoded in the model.
3. For **SAT**, replay witness using an independent checker: legal moves, final sticker state, each required date/time configuration, single physically consistent print layout, nonduplicated sticker identities and orientation.
4. For **UNSAT**, independently validate certificate or exhaustive argument against exactly the claimed encoding and assumptions. A solver 'UNSAT' line without independently checked evidence is not enough for certified UNSAT.
5. Challenge boundary cases (e.g. leading zeros, bilingual variants, blank outer stickers, rotation/reflection, timezone-independent formatting).
6. Record reproducibility commands, checker outputs, environment, artifacts, discrepancies, and remaining uncertainty. Name each checker run (Flix and Julia) with its exact command and version, and the corpus pin (`proof-checkers/conformance-pin.json` manifest hash, plus `python3 proof-checkers/tools/audit_corpus.py` result).
7. Mark **UNKNOWN** if any necessary claim cannot be verified; distinguish 'solver reports UNSAT' from 'independently proven UNSAT'.

## Output
A short review report stating claim, scope, evidence paths, verdict (SAT/UNSAT/UNKNOWN), independent checks (checkers run, commands, versions, corpus pin), class-only differences listed separately, concrete findings with severity, and exact next steps. Do not rewrite source evidence to make a review pass.
