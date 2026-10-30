# Independent static review of the Julia HSM recovery checker

## Scope and verdict

Reviewed revision: `175c68587fca8d1d2ba4f9dffffd51437fade077`.
Mathematical implementation and exact-decimal fix:
`249df9d31b1d2c6daa617e88f898ff0c25906300`.
Base for the additive diff: `a2fdf5fec33c49c4b3303d3df965b4d462fb17f3`.

The frozen [recovery profile](../HSM-RECOVERY-PROFILE.md) has SHA-256
`758e95d60b04e0dfa4fb756451510e6abe0ea44d67574669f52e0fb5302c05d6`.
The review used a separate worktree and did not modify the author's files.

**No blocking static implementation findings. Proof status remains UNKNOWN.**
This is a source and data-integrity review, not a successful execution of the
eighteen-mode proof and not final clearance of two independent implementations.
The [authority rule](../AUTHORITY.md) requires both native checkers to accept the
same raw inputs. Julia acceptance alone cannot establish confirmation.

## Source inspection

Reviewed [Recovery.jl](../julia/Recovery.jl), the standalone entrypoint, both new
native test sources, their documentation and the unchanged native HSM primitives
they call. The following implementation choices match the frozen contract:

- Every displayed value enumerates four fixed front corners and all permutations
  and twists of the four hidden corners, retaining the total-twist constraint.
  The blank's three physical stickers remain distinct choices. Full eight-corner
  poses are retained without a global-rotation quotient. The existing print
  parser's upright slot classes bind the facelet model to physical sticker up
  vectors; sample replay separately checks complete position/normal/up frames.
- The bounded word search includes endpoints of all routes through five HTM,
  rather than restricting each recovery edge to shortest words. When no such
  edge exists it includes all shortest six-HTM endpoints. Same-face reduction and
  ordering of commuting opposite faces remove redundant words, while duplicate
  endpoints retain their minimum HTM cost. Target-distance pruning is a lower
  bound. Each generated endpoint is checked against the exhaustive enumeration.
- Reverse CSR indexing retains the source and minimum cost of every endpoint
  edge. Multi-source Dijkstra uses exact lexicographic integer triples: number of
  above-limit edges, display steps, total HTM. The binary heap and stale-entry
  check preserve that ordering. Goals have the zero triple.
- Goal membership is bound to the selected application period, including its
  source direction and inverse traversal. Own-period words, modular displays,
  physical start frames, closure and inverse closure use the existing native
  Julia replay implementation. This command does not claim to recompute the
  separate minimum-mean period certificates.
- Node/edge/goal/forced-source counts, reachability, both histograms, maxima and
  exact rational means are recomputed. Four-place rounding uses integer
  arithmetic with ties to even. Sample steps are physically replayed and inverted,
  cannot pass through an earlier period goal, and must attain the independently
  computed optimal cost triple.
- The [documented decimal root cause](HSM-RECOVERY-MEAN-RC.md) was investigated
  before the fix. The corrected reader preserves each real `meanSteps` number's
  original token with typed `JSONText` traversal. A repeated read must match the
  first read's SHA-256. Decimal coefficient/exponent normalization compares exact
  values without allocating attacker-controlled powers of ten. Floating-point
  materialization is not the final equality predicate. Escaped keys and label
  decoys are covered by the new test source.
- The normal standalone command checks all eighteen rows. Its internal one-row
  smoke path emits `valid:false`, `UNKNOWN` and a partial claim. Resource failures
  cannot produce a valid proof result. Runtime reachability of forced poses and
  global print optimality are explicitly outside the verified claim.

The test sources include parser/binding corruptions, synthetic lexicographic and
rounding traps, an unpruned full-frame depth-three endpoint comparison, metric
corruptions and sample replay/optimality controls. Those tests were inspected;
this reviewer did not execute them during the static review.

## Checks actually run

The following lightweight checks were run from the review worktree while the
author's full Julia run owned the CPU slot:

```sh
git rev-parse HEAD
git status --short
git diff --name-only a2fdf5f..HEAD
sha256sum proof-checkers/HSM-RECOVERY-PROFILE.md
python3 proof-checkers/tools/audit_corpus.py
```

Results: the reviewed SHA and contract digest match the values above; the
worktree was clean. The implementation diff adds seven files only. Existing
`Checker.jl`, `Hsm.jl`, `check.jl`, dependency pins, issue-74 corpus and pins, HSM
corpus and manifest, and historical evidence are unchanged against the base.

The existing data auditor reported `PASS_DATA_PINS`: 195 cases, comprising 41
counter and 154 geometry cases, 2,048 kernel rows, 36 generators and 801 chain
values. Manifest SHA-256:
`c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01`.
This Python command audits data hashes and counts only; it is not a proof verdict.

An additional inline Node data audit checked the unchanged HSM manifest digest,
every declared fixture byte hash and the exact case filename set:

```js
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bytes = readFileSync("proof-checkers/conformance-hsm/manifest.json");
const manifest = JSON.parse(bytes);
if (sha(bytes) !== "0c497d15ca1cf530c7b8be2a6775723bc562e2583c5c2cfc103265b3a4935993")
  throw Error("manifest pin");
for (const entry of manifest.cases)
  if (sha(readFileSync(entry.path)) !== entry.sha256) throw Error(entry.name);
const files = readdirSync("proof-checkers/conformance-hsm/cases").sort();
const expected = manifest.cases.map((entry) => entry.name + ".json").sort();
if (JSON.stringify(files) !== JSON.stringify(expected)) throw Error("file list");
```

Result: `PASS_DATA_PINS_ONLY`, 46 cases, manifest SHA-256
`0c497d15ca1cf530c7b8be2a6775723bc562e2583c5c2cfc103265b3a4935993`.
This is not a rerun of the 46 native semantic verdicts.

## Remaining gates

No heavy native checker, component test, parser suite, lifecycle run or browser
test was executed by this reviewer. No new checker versions or execution times
are claimed. The checks above establish source/data integrity, not mathematical
acceptance. No class-only native verdict differences were evaluated here.

Before final confirmation, retain an actual complete eighteen-row result from
the corrected Julia source, run the meaningful native negative/component controls
and required regressions, then implement and run independent Flix against the
same two immutable raw inputs. Compare the complete deterministic outputs and
perform the final cross-language review. Any actual dissent requires the
authority stop and documented root-cause process; no voting or Python tie-break.

No implementation, pinned file or historical artifact was changed to clear this
review. No pull request readiness, merge or deployment is authorized by this
static report.
