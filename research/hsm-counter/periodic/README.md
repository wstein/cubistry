# Universal five-move bound for the preferred print

**SAT**: after setup of H, S, or M upright in the upper-right front slot,
every subsequent same-letter number transition 00–59 takes at most five HTM.
This includes arbitrarily many wraps, either direction, and range changes
between 00–11, 00–23, and 00–59, regardless of hidden-corner poses.

The layout is exactly the [preferred intermediate candidate](../comparison/candidates/intermediate.json).
The upper-left sticker is unconstrained; the digits remain upright below.

The independent proof exhausts all 378 possible selected-corner source
triples with the letter already in place. Their maximum target distance is
five. Each completed transition restores the premise, so induction proves
unlimited repetition. This does not depend on a particular tie policy or
retaining a canonical hidden pose.

See the full [independent proof and review](REVIEW.md), the
[structured verification](verification.json), and the
[experiment manifest](manifest.json). The [explicit witness](witness.json)
also retains 18 full-state recurrent examples with 10,548 checked edges.
Period closure checks all 24 physical sticker frames, not just the visible 00.

Reproduce from the Research branch root:

```sh
node research/hsm-counter/generate-periodic.mjs NEW_OUTPUT_PATH
python3 research/hsm-counter/verify_periodic.py research/hsm-counter/periodic/witness.json
python3 -m unittest discover -s research/hsm-counter -p 'test_*.py' -v
```

The generator uses the preserved intermediate print and policy 13, with a
10,000-cycle search limit per mode. No npm dependencies are needed. The
independent verifier imports no generator or JavaScript geometry. The original
single-pass witnesses and their metrics remain unchanged.

Initial setup and arbitrary letter changes are outside the five-move bound.
The proof guarantees existence and shortest replanning, not global print or
whole-route optimality, physical timing, or device performance. It applies to
settled displays; intermediate turns need not show a readable number.
