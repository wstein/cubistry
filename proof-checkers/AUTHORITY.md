# Authority change (2026-10-29)

Owner decision (final). The independent Flix and Julia checkers in this directory
are the AUTHORITATIVE verification for proofs and certificates. Python becomes a
third voice. This page supersedes the statement in the [contract](SPEC.md) header,
written at the time of issue 74, that the Python proof gates and production code
remain authoritative. That header line now points here; only the `SPEC.md` entry
of `evidence-manifest.json` was re-pinned for this wording change.

## Rule, in order of strength

1. A proof or certificate counts as CONFIRMED only when BOTH the Flix and the
   Julia checker accept it, each reading the raw input itself as the contract
   already requires.
2. The existing Python verifiers (Research branch and production gates) are no
   longer authoritative. They remain a third voice, used for differential testing
   and for generating independent expected data. Python acceptance alone never
   confirms a proof.
3. Disagreement between Flix and Julia, or between either of them and the pinned
   expected outcomes, is fail-closed: the status is `UNKNOWN` (never `SAT` or
   `UNSAT`) until the cause is understood and documented. There is no majority
   vote and no averaging.
4. Deliberately stricter rejections stay listed one by one in the
   [coverage ledger](coverage.json) (`deliberatelyStricter`): Boolean unpadded
   coordinates, duplicate object keys, exponent schema versions, float schema
   versions, rounded fractional values and underflow fractional values. Python
   accepting them is a known Python-side leniency, not a defect of the checkers.
5. This is a governance change only. No checker code, corpus data, hash, CI
   workflow or Research evidence changes, and no claim about any existing proof
   changes.

## Status of existing proofs

Existing proofs whose only verifier is Python are not retroactively re-labeled.
They remain verified by their Python verifier and are candidates for porting to
the two checkers. The port backlog is in [RESULTS.md](RESULTS.md#port-backlog).
