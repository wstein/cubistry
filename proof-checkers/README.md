# Independent proof checkers

Implementation of [issue 74](https://github.com/wstein/cubistry/issues/74), stacked
on the finalized lifecycle spike. The shared [contract](SPEC.md),
[coverage ledger](coverage.json) and [hash-pinned corpus](conformance/manifest.json)
precede parallel Flix/Julia implementation. Both bounded engines are implemented and independently replayed; see the
[results and lifecycle comparison](RESULTS.md).

As of the 2026-10-29 [authority change](AUTHORITY.md), the
Flix and Julia checkers are the authoritative verification: a proof is confirmed
only when both accept it, and any dissent is `UNKNOWN` and needs a root-cause
investigation. Python verifiers play no role in confirming proofs or resolving
dissent. At the time of issue 74 the existing Python,
Research evidence, production code and CI were unchanged, and that delivery
changed none of them; neither does the authority change.
Full ports are restricted to the counter-certificate checks and marked 3×3
replay/reachability groups. No solver, optimality claim, new layout proof or
Cubacle adaptation is included.

The corpus contains 41 raw counter cases, 154 marked-state cases, the exact
801-value incumbent chain, 36 center generators and 2,048 center references.
The metadata records deliberately stricter JSON policies and original oracle
acceptance, rather than silently claiming identical accepted-input sets.
Unknown certificate formats fail closed.

```sh
python3 proof-checkers/tools/audit_corpus.py
```

`tools/build_corpus.py` reproduces the draft data only into a fresh source tree,
using unchanged independent Python/Research oracles at their recorded hashes.
It never supplies runtime preprocessing to either language's validator. Runtime interfaces and reproducible commands are documented in the
[Julia](julia/README.md) and [Flix](flix/README.md) guides. Source, complete-state
exports, lifecycle captures and independent review evidence accompany this Draft.

The additive HSM seconds-first profile (`hsm FILE`, `hsm-conformance ROOT`) is documented in
[HSM-PROFILE.md](HSM-PROFILE.md); its separate conformance corpus is `conformance-hsm/`.
The frozen 195-case corpus above is unchanged.
