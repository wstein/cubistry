# Independent proof checkers

Implementation of [issue 74](https://github.com/wstein/cubistry/issues/74), stacked
on the finalized lifecycle spike. The shared [contract](SPEC.md),
[coverage ledger](coverage.json) and [hash-pinned corpus](conformance/manifest.json)
precede parallel Flix/Julia implementation. They do not claim the engines are
already complete: implementation status is explicit in the ledger.

Existing Python, Research evidence, production code and CI are unchanged.
Full ports are restricted to the counter-certificate checks and marked 3×3
replay/reachability groups. No solver, optimality claim, new layout proof or
Cubacle adaptation is included.

The corpus contains 41 raw counter cases, 152 marked-state cases, the exact
801-value incumbent chain, 36 center generators and 2,048 center references.
The metadata records deliberately stricter JSON policies and original oracle
acceptance, rather than silently claiming identical accepted-input sets.
Unknown certificate formats fail closed.

```sh
python3 proof-checkers/tools/audit_corpus.py
```

`tools/build_corpus.py` reproduces the draft data only into a fresh source tree,
using unchanged independent Python/Research oracles at their recorded hashes.
It never supplies runtime preprocessing to either language's validator. Runtime
interfaces, dependencies and measured lifecycle results will be documented with
each completed implementation and independently reviewed before Draft delivery.
