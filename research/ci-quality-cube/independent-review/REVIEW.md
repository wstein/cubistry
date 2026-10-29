# Independent fixed-print Quality Cube review

Reviewed publication author commit:
`e9e544c0b2cfdffc55918e4ef9e8ef4d78d84d9b`. The original frozen author commit
was `13ad01abc39298d240fc6f90a78339afcfa397f8`, on which the executions below
were performed. This reviewer independently checked that the complete
`research/ci-quality-cube/` tree is byte-identical between those two commits.
The publication author commit is based on
`8a85fd8c93f6d0305174e63767bda366cae7544b`, the actual remote research tip found
after a stale local tracking reference caused a safe non-fast-forward push
rejection. Only the unpushed Quality Cube commits were rebased; existing remote
research history and all generated evidence were preserved. The original input
baseline `7c05d28e97ecf30848220f5c70cb3100a4f3628d` in the manifest remains
historical provenance, rather than a mutable publication target.

The reviewer then inspected the classification and scope clarifications in
publication documentation commit `797aba41f3a969360affbbb5ab86d2d877939de4`.
They preserve the restricted lower-bound and policy-mean qualifications below.
The byte-identity and documentation-only changes require no repeated physics
search or certificate run. This reviewer is separate from the Julia generator author.
The checks below import none of the author's model, search, scoring, or canonical
checker implementation. They read the frozen evidence and distance certificate.

## Verdict and scope

**SAT:** the selected five-state fixed print realizes every one of the 625
requested upright Build / Test / Analyze / Review displays, with permanent
sticker identities and abstract category/state artwork assignments. All 24
stickers are labeled; there are 20 distinct artworks because open is duplicated
once per category. This is not approval of typography, fonts, final vector
artwork, colors, manufacture, or an application implementation.

**SAT:** the prescribed single-category transition policy has a universal
six-HTM upper bound. It preserves the three unchanged front sticker identities
and chooses the nearest copy of the new category state. The certificate and
finite local-case enumeration apply to any actually legal complete source pose
with the required front, including poses produced by repeated earlier requests.
They do not depend on resetting hidden corners or on assuming a uniform runtime
distribution. The arbitrary-target upper bound is seven HTM.

**UNSAT, restricted claim:** a universal five-HTM bound is impossible in the
specified five-state fully labeled two-corner-per-category construction, with
the fixed category pairing and upright-frame assignment used by the generator.
This is not an impossibility result for arbitrary other print constructions.
The selected print has a reachable transition requiring exactly six HTM even
when the route may replace unchanged fields with equal-artwork copies.

The selected print's policy mean is `4.012820512820513` HTM. It is a comparison
under equal categories and directed logical edges, then uniform source copies
and the 12 alternate-body back poses. It is not empirical usage or the mean of
the saved continuous walk. Global mean optimality over unrestricted routes or
other print constructions remains **UNKNOWN**.

## Independently executed checks

Commands are run at the repository root using Node 24:

```sh
node research/ci-quality-cube/independent-review/check.mjs research/ci-quality-cube/evidence
node research/ci-quality-cube/independent-review/score.mjs research/ci-quality-cube/evidence
node research/ci-quality-cube/independent-review/lower.mjs research/ci-quality-cube/evidence
node research/ci-quality-cube/independent-review/provenance.mjs research/ci-quality-cube
```

All commands passed. Execution was on a pinned separate review worktree, without
the author's Julia code or Python:

- Independently derived exact Rodrigues quarter-turns, all 24 corner poses,
  all 18 moves, inverse restoration, and additive twist offsets.
- All 136,080 rank/unrank pairs and all 2,449,440 move edges. There is one zero
  goal, every edge obeys the distance inequality, and every non-goal has a
  descending edge. These are a local proof of exact graph distance rather than
  a second unexamined BFS assertion.
- Histogram `1,15,198,2030,15396,61768,53528,3144`, maximum seven. The certificate
  SHA256 is `f56224ee1b76e2bdaac4bb8441df5881e6b7c9a51dd6a14e62eff58e78e396d6`.
- 5,286 legal full-pose witness replays across four comparison prints, including
  all 625 selected displays and their 1,250 continuous transitions. Each replay
  checked the full eight-body matrix hash, permanent sticker ID/normal/up data,
  front category/state labels, and exact upright print orientation.
- Exhaustive independent pattern enumeration: 20 four-state neutral, 92
  four-state fully labeled, 40 five-state neutral, and 100 five-state fully
  labeled symmetry representatives. Every candidate score was recomputed,
  with equal logical-edge weighting before conditional physical averaging.
- All 11,312 per-slot/per-edge profiles were recomputed and matched; the four
  slots have identical profiles for every compared pattern. The chosen witness
  print attains the reported maximum-then-mean minimum for this policy.
- All 100 saved lower-bound source words and six-move target words were
  independently replayed. Every actual target-sticker alternative was checked
  to have certificate distance six. The unchanged three category artworks are
  unique, so preserving their IDs is forced by the visible goal, not an extra
  restriction smuggled into the lower bound.
- All 15 manifest hashes, exact physical source axes/IDs, selected best-pattern
  scores, and all 24 global rotations of each print. Exactly one rotation of
  the selected print produces a valid upright category front, rather than 625.

## Why the restricted lower bound also covers mixed pair patterns

The 100 saved witnesses each repeat one pair pattern across all four categories;
they are not a literal enumeration of `100^4` mixed patterns. The extension to
independent pair-pattern choices uses the following separability argument.

Every five-state assignment on six stickers has at least four uniquely occurring
states. The independent enumeration establishes a same-front-body obstruction
for each possible changed-category pattern. In any other three category pairs,
choose any uniquely occurring state. These choices are on different bodies
because category pairs are disjoint. The partial-goal graph supplies a legal
setup to those four chosen upright stickers; its coverage and twist-offset
invariance do not depend on their printed labels. On the obstructed change, all
eligible target copies are on the current front body and require a nonzero
twist, while the other three unique target artworks force their exact bodies and
frames. Both nonzero front-twist distances are six in every slot. This proves
the restricted lower bound for mixed label patterns without claiming that every
mixed witness was saved or that arbitrary pairings were searched.

Similarly, policy scoring is separable by category: routes depend only on the
changed slot, its source/target copies, and the alternate body pose. Independent
recomputation found identical profiles in all four slots. Choosing a different
pattern for each category cannot improve the reported policy mean below the
best per-category mean. This is still not optimization over routes that replace
other fields with different equal-artwork copies.

The upper bound does not need a claim that all 648 abstract full completions are
reachable. Its partial graph covers an overapproximation of every legal full
source pose, so the bound holds for the physically reachable subset as well.

## Findings and publication requirements

No blocking correctness finding remains in the frozen model or evidence.
Before publication, clarify that the executed 100 lower-bound witnesses are
homogeneous representatives and cite the separability argument above for mixed
patterns. Preserve the immutable generated `UNKNOWN/pending` snapshots as
historical outputs; publish the reviewed classification in the analysis and
this report instead of silently rewriting their provenance.

The author's 12 canonical mutation controls were inspected in source and their
stored report, but were not independently re-executed by this reviewer. No claim
is made that the final application, SVG artwork, or browser behavior was tested.
