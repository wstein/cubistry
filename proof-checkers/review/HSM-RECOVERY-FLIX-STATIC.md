# Independent static review of the Flix recovery checker

## Scope and result

Initial inspected implementation: `5bda015`. Reviewed correction:
`ac1b6bf893472044103a552a34654ec1a9162b21`.
The [recovery contract](../HSM-RECOVERY-PROFILE.md), including its documentation-only
valid-result wire clarification, has SHA-256
`532e0157c241f5086e59ff0fad2f46fe24aae01dbb13e03b674656dfbb9ecd52`.
The clarification appends serialization requirements to the earlier contract;
it changes neither the mathematical graph nor the raw proof inputs.

**No unresolved blocking static findings at the corrected revision. Confirmation
remains UNKNOWN.** This report does not claim the full Flix proof, adversarial
suite or final cross-language comparison has passed. The review used a separate
worktree and did not edit the author's implementation. The Flix author received
contract-based findings only, not Julia algorithms or computed mode values.

## Findings and author corrections

1. **Input provenance, closed in `ac1b6bf`.** The initial standalone entrypoint
   parsed each path with `readJson`, then independently reopened it with
   `shaFile`. A change between reads could bind a result about earlier bytes to
   a digest of different bytes. The corrected entrypoint reads each strict UTF-8
   text once, parses that same text and hashes that same text. Valid UTF-8 is
   decoded/re-encoded without normalization, so the hash describes the exact
   parsed bytes. The existing pinned reader is not modified.
2. **Compiler-input provenance, closed in `ac1b6bf`.** The initial build compiled
   copied `work/src` files but subsequently hashed the original source paths.
   An edit during compilation could misidentify the compiled source. The build
   now hashes the actual copies, checks copied/original hashes before and after
   compilation, and records those snapshot hashes. Existing source and parser
   pins are preserved.
3. **Packed-cost capacity, explicit guard added in `ac1b6bf`.** The correction
   rejects graphs outside `0 < N <= 1,000,000` before packed-cost arithmetic.
   This makes the signed-64-bit bound explicit instead of relying only on the
   expected size of the generated physical graph. The guard reports an error,
   not a positive proof result.

These were static provenance/capacity findings before a complete comparison of
native mathematical verdicts. They were not an observed Flix/Julia dissent or
a vote. The author made the corrections; the reviewer inspected their diff.

## Mathematical source inspection

Reviewed [RecoveryMain.flix](../flix-recovery/src/RecoveryMain.flix),
[build.py](../flix-recovery/build.py), the process-capture harness and documentation,
and the unchanged native HSM geometry/parser primitives used by the new command.

- Enumeration retains eight physical corners, the blank's distinct physical
  facelets, all hidden-body permutations and legal twists, and every displayed
  value in the mode. The fixed front assignments use the existing upright slot
  classes. There is no global-rotation quotient.
- The endpoint graph includes every canonically reduced word through five HTM
  when that limit is attainable; otherwise it includes every shortest six-HTM
  endpoint. Same-face reductions and ordering of commuting opposite faces retain
  minimum-cost endpoint coverage. Distances prune only impossible suffixes.
  Ascending word lengths and endpoint deduplication keep the minimum cost per
  endpoint, and endpoint membership/modular next value are checked.
- Reverse incoming edges and a binary min-heap implement multi-source shortest
  paths. The packed cost preserves the contract's priority: above-limit edge
  count, display-step count, then total HTM. Stale heap labels are ignored.
- Application-period selection and traversal are independently recomputed using
  the existing native HSM checker. Full physical period poses bind the goal set;
  distinct goals and their membership in the exhaustive graph are checked.
- Counts, unreachable nodes, forced sources, both histograms, maxima and exact
  means are recomputed. Decimal equality uses the original number token's
  significant digits and exponent; no floating-point equality determines
  acceptance. Rounding is integer nearest/ties-to-even.
- Samples are replayed through complete physical frames, show the next modular
  value, satisfy bounded-or-forced edge rules, cannot pass through an earlier
  goal, end at a bound period goal and attain the computed optimum. Both edge
  inverses and the complete sample inverse are checked.
- Normal two-file execution covers all eighteen rows. The explicit one-mode
  diagnostic returns `valid:false`, `UNKNOWN` and `PARTIAL`. Runtime reachability
  of forced poses and global print optimality remain outside this claim.

### Exact packed-cost bound

For `N` nodes, all encoded edge weights are positive. A shortest route can be
simple and have fewer than `N` edges; relaxing one further incoming edge creates
a candidate with at most `N` edges. Its total HTM is at most `6N`.

The implementation uses `unit = 6N + 1` and `above = (N + 1) * unit`.
The HTM component is strictly below `unit`, and the candidate's lower two
components together are strictly below `above`. Thus no component carries into
the next one, and scalar comparison preserves exact lexicographic comparison.
The largest candidate is bounded by

```text
N * above + N * unit + 6N = 6N^3 + 13N^2 + 8N.
```

At the enforced maximum `N = 1,000,000`, this is
`6,000,013,000,008,000,000`, below signed-64-bit maximum
`9,223,372,036,854,775,807`. Infinity labels are never inserted into the heap.

## Data checks actually run

No heavy compiler, native mathematical command or browser test was launched by
this reviewer during this static review. Inspected the exact correction with
`git diff 5bda015..ac1b6bf`; checked the contract with `sha256sum`; and checked
the additive diff against base `a2fdf5fec33c49c4b3303d3df965b4d462fb17f3`.
Existing issue-74 and HSM corpus/manifests/pins, native Flix source files and
parser pin have no changes.

An independent inline Node SHA-256 audit read the author's actual build record
`/tmp/hsm-recovery-flix-runs/build-final.json`, then compared its artifact hash
against the actual JAR and every recorded source hash against both the frozen
review files and actual copied `work/src` compiler inputs. Result:
`PASS_BUILD_SOURCE_BINDING_DATA_ONLY`, seven source files matched.

- Actual artifact SHA-256:
  `dd296c1320e42ae3bd7474b67b23f2d1b14f479d1a1c13a8c62aada16435c691`.
- Corrected `RecoveryMain.flix` SHA-256:
  `1dd0ea4cfb8347661fefbf84c09916847091d21e78486bdf48517400ebb6d21f`.
- Parser SHA-256 recorded by the guarded build:
  `2d30c375cddea9657a1e1ef97547a2694b663b355facb4de53a097782b312d1a`.

This audit establishes source/artifact binding only. It does not independently
execute the compiled mathematical code or compare a computed mode with another
implementation's output. The source uses the existing pinned wstein/flixw,
Flix 0.79.0, Java 21 and Jackson Core 2.22.4; no new runtime version observation
or benchmark is claimed by this static report.

## Remaining gates

The corrected artifact still requires its actual native self-tests, meaningful
raw/component controls and complete eighteen-mode execution. Final confirmation
requires independent acceptance of the same raw files and comparison of the
complete deterministic outputs, followed by final review. No class-only verdict
differences were evaluated here. Any actual dissent invokes the documented
[authority stop and root-cause rule](../AUTHORITY.md), not voting or a Python
tie-break.

No implementation or pinned historical evidence was edited by the reviewer. No
pull request readiness, merge or deployment is authorized by this static report.
