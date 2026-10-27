---
name: proof-review
description: Independently review mathematical feasibility claims and supporting witnesses or UNSAT certificates.
---
# Proof Review

Use before approving any SAT/UNSAT assertion, print plan, or published feasibility conclusion.

## Separation of responsibilities
Reviewer must not rely solely on assertions from the generator, solver or original author. Prefer a separately implemented checker and a clean invocation at a pinned commit.

## Review checklist
1. Freeze precise claim: puzzle geometry and legal group action, sticker IDs, permutation and orientation rules, time/date domain, language and formatting, and permitted art/print operations.
2. Verify input provenance and version hashes; check that claims match the constraints encoded in the model.
3. For **SAT**, replay witness using an independent checker: legal moves, final sticker state, each required date/time configuration, single physically consistent print layout, nonduplicated sticker identities and orientation.
4. For **UNSAT**, independently validate certificate or exhaustive argument against exactly the claimed encoding and assumptions. A solver 'UNSAT' line without independently checked evidence is not enough for certified UNSAT.
5. Challenge boundary cases (e.g. leading zeros, bilingual variants, blank outer stickers, rotation/reflection, timezone-independent formatting).
6. Record reproducibility commands, checker outputs, environment, artifacts, discrepancies, and remaining uncertainty.
7. Mark **UNKNOWN** if any necessary claim cannot be verified; distinguish 'solver reports UNSAT' from 'independently proven UNSAT'.

## Output
A short review report stating claim, scope, evidence paths, verdict (SAT/UNSAT/UNKNOWN), independent checks, concrete findings with severity, and exact next steps. Do not rewrite source evidence to make a review pass.
