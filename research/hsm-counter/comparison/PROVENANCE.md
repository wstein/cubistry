# Comparison provenance and interpretation

This comparison retains every complete H/S/M candidate saved during the original
investigation, including the drafts that preceded the final proof publication.
It does not reinterpret the 4,096 stochastic proposals as individually retained
or independently verified candidates.

| Candidate | Origin | Original objective |
| --- | --- | --- |
| initial | Preserved initial draft witness, formerly `work/hsm-initial-witness.json`; 512 proposals | Increment cost and 23→00 reset |
| intermediate | Preserved combined-objective draft, formerly `work/hsm-intermediate-witness.json`; 512 proposals | Increment cost and both short resets |
| final | Byte-identical copy of `research/hsm-counter/witness.json` at Research commit `73f40fb` | Same combined objective; 4,096 proposals |

The initial and intermediate witnesses were not previously published. Their
complete prints and paths are now retained verbatim in `candidates/`, with hashes
in [manifest.json](manifest.json). Their exact historical generator source was
not retained, so no exact historical search regeneration claim is made. The
comparison is fully reproducible from these immutable saved witnesses. The
final candidate also retains its original generation source and experiment
manifest in the parent directory.

The new [comparison script](../compare.py) imports the independent Python replay
and BFS engine. It checks every saved display and forward path, calculates a
shortest reset from each actual reached 11, 23, or 59 full pose, and retains the
saved reset word when present and independently valid. It replays the inverse
of every complete pass to verify the corresponding decrement traversal.

For upper bound N, total moves are the sum of the N saved increments 00→01
through N−1→N plus the N→00 reset. The average divides this total by N+1, not
N, and never includes setup. The aggregate total sums three passes, one for H,
one for S, and one for M. Its denominator is 3×(N+1).

The intermediate candidate has the lowest aggregate cycle total for all three
ranges among these three retained candidates. The final candidate instead has
a two-HTM 11→00 reset for every letter; the intermediate candidate needs three
for that reset. The historical weighted search prioritized the worst reset
before overall increment total. This comparison does not select a new print
or claim global optimality.

A reset closes the visible display, not necessarily the complete hidden pose.
The structured results explicitly record full-pose equality. These are one-pass
costs, not guaranteed repeated-cycle averages. Reverse traversal starts from
the actual final full pose and has the same total length; no independent
shortest-path claim is made for reverse edges.

Reproduce from the repository root with standard-library Python 3:

```sh
python3 research/hsm-counter/compare.py --write
python3 -m unittest discover -s research/hsm-counter -p 'test_*.py' -v
```

`--write` regenerates only the comparison report and table. It does not change
the original proof, candidate witnesses, print choice, or experiment manifest.
