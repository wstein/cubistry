# Authority change (2026-10-29)

Owner decision (final). The independent Flix and Julia checkers in this directory
are the AUTHORITATIVE verification for proofs and certificates. Python
verifiers play no role in it. This page supersedes the statement in the [contract](SPEC.md) header,
written at the time of issue 74, that the Python proof gates and production code
remain authoritative. That header line now points here; only the `SPEC.md` entry
of `evidence-manifest.json` was re-pinned for this wording change.

## Rule

1. A proof or certificate counts as CONFIRMED only when BOTH the Flix and the
   Julia checker accept it, each reading the raw input itself as the contract
   already requires.
2. The existing Python verifiers (Research branch and production gates) are no
   longer authoritative. They play no role in confirming proofs or resolving
   dissent; they remain historical evidence for existing proofs and port sources.
   Python-generated expected data in the pinned corpus stays as it is: it is
   pinned data, not a verdict.
3. WE DO NOT VOTE. Any dissent between the Flix and Julia checkers, or between
   either of them and the pinned expected outcomes, makes the status `UNKNOWN`
   (never `SAT` or `UNSAT`) and a root-cause (RC) investigation is mandatory: an
   Opus-class agent (or stronger) finds and documents the cause, and only then is
   the result re-evaluated (fix the checker or the spec, re-run both checkers).
   There is no majority vote and no tie-breaking by any third source, Python
   included. A dissent is a different accept/reject decision, a different
   witness/replay result, or a different hash or count. Flix and Julia do NOT
   dissent when they make the same accept/reject decision for the same input but
   report different status classes (for example Julia `UNSUPPORTED` where Flix
   reports `INVALID`; [RESULTS.md](RESULTS.md) records four such rejected fixtures
   among the 195 conformance cases). Each such class difference must be itemized
   in the [coverage ledger](coverage.json); the ledger has no entry type for them
   yet, and adding it is follow-up work.
4. Deliberately stricter rejections stay listed one by one in the
   [coverage ledger](coverage.json) (`deliberatelyStricter`): Boolean unpadded
   coordinates, duplicate object keys, exponent schema versions, float schema
   versions, rounded fractional values and underflow fractional values. Python
   accepting them is a known Python-side leniency, not a defect of the checkers.
5. This is a governance change only. No checker code, corpus data, hash, CI
   workflow or Research evidence changes, and no claim about any existing proof
   changes.

## Status of existing proofs

Existing proofs whose only verifier is Python are not retroactively re-labeled;
their recorded results and Python verification stay as recorded. Under rule 1
they are not CONFIRMED until both Flix and Julia accept them, and they are
candidates for porting to the two checkers. The port backlog is in [RESULTS.md](RESULTS.md#port-backlog).
