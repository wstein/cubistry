# Recovery mean decimal root cause

Status: **UNKNOWN** pending complete native validation of the documented fix. This is a
Codex Sol author investigation of a static exactness defect, found before Flix
implementation. No Flix/Julia dissent has occurred. The original full eighteen-mode
Julia baseline ran unchanged at source
`c997f268f451748086c0aaedd32f804ce0f745c6`.

## Concrete counterexample

At that revision, `Recovery.jl` compares a parsed `meanSteps` with
`parse(Float64, independentlyRoundedFourPlaceString)`. With the pinned Julia
1.13.3 / JSON 1.13.0 environment, this lightweight native command was executed:

```sh
JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot /tmp/julia-1.13.3/bin/julia --startup-file=no --compile=min --project=proof-checkers/julia -e 'using JSON; a="3.31990000000000000001"; b="3.3199"; qa=parse(BigInt,"331990000000000000001")//big(10)^20; qb=big(33199)//10000; println(JSON.json((rawA=a,rawB=b,parsedA=JSON.parse(a),parsedB=JSON.parse(b),floatEqual=JSON.parse(a)==JSON.parse(b),exactEqual=qa==qb)))'
```

Actual output:

```json
{"rawA":"3.31990000000000000001","rawB":"3.3199","parsedA":3.3199,"parsedB":3.3199,"floatEqual":true,"exactEqual":false}
```

The valid S 00-11 +1 row publishes `3.3199`. Changing only its raw number token
to the first value would preserve the existing floating-point equality while
changing the mathematical claim. This consequence follows directly from the
executed predicate counterexample; a complete mutated-witness command has not yet
been run, and this note does not invent such a verdict.

## Cause and scope

The strict JSON reader protects integer fields, duplicate keys, syntax and bounds,
but its default materialization rounds ordinary noninteger numbers to `Float64`.
The additive checker retained that rounded value for the sole real field. The
input lexeme was lost before equality was tested. Computing the expected mean
with exact integers did not repair the already rounded input.

The native full-pose enumeration, endpoint graph, shortest-path objective,
histograms and sample replay are unaffected. Existing pinned files and the two
frozen raw witnesses are unchanged. The frozen contract requires exact decimal
value equality and will not be weakened to floating-point equality.

## Proposed fix, before implementation

Retain the existing strict raw parser and its structural/type checks. Use the
pinned JSON library's `JSONText` type to extract each actual `meanSteps` value's
original JSON text from the same input bytes, bound by the original input hash.
Typed object/array traversal decodes escaped keys and ignores string contents;
no loose regular expression searches labels for key-like text.

Normalize the number lexeme exactly as a signed integer coefficient and a base-10
exponent. Remove leading/trailing zeros and normalize zero. Parse the bounded
exponent as `BigInt`; compare canonical decimal values without allocating powers
of ten for extreme exponents. Compare with the independently rounded four-place
mean's canonical decimal value. No `Float64` or finite-precision `BigFloat`
comparison decides mean equality.

Add controls accepting numerically equivalent scientific notation, rejecting the
colliding nearby decimal, and ignoring key/number decoys inside informational
labels. Preserve exact raw-input binding and rerun native positive validation at
the new source revision. The coordinator will determine the complete validation
sequence after the unchanged mathematical baseline finishes. Do not start Flix
implementation before that sequence clears.

## Implementation and focused validation

Fix revision: `249df9d31b1d2c6daa617e88f898ff0c25906300`. The coordinator approved
the fix after reading the committed root cause. The graph, Dijkstra and sample
replay algorithms are unchanged. Mean equality now uses the exact canonical
decimal guard. A second read for `JSONText` extraction must match the original
strict reader's SHA-256, so it cannot silently bind tokens from different bytes.
Progress diagnostics now explicitly flush after phases, each 25,000 graph nodes
and each completed row; the deterministic verdict excludes timings.

The focused native parser suite passed all 23 assertions, including equivalent
scientific notation, a nearby decimal that collides as `Float64`, escaped keys,
label-string decoys, extreme exponents, leading zeros, signed zero and input-byte
binding. Exact command:

```sh
JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot /tmp/julia-1.13.3/bin/julia --startup-file=no --compile=min --project=proof-checkers/julia proof-checkers/julia/recovery-parser-tests.jl /tmp/hsm-recovery-source.json /tmp/hsm-modes-source.json
```

Observed exit 0; elapsed 11.819 seconds; maximum resident size 384,580 KiB.
These focused assertions do not establish the recovery proof.

The obsolete original baseline was deliberately interrupted with `SIGINT` after
1,293.360 seconds, before any complete verdict. Its captured child exit was -2,
stdout was empty and maximum resident size was 744,828 KiB. It is retained as
`INTERRUPTED_UNKNOWN`, with the exact loaded source and diagnostics, rather than
reported as a semantic rejection. A fresh complete eighteen-mode run at the fix
revision is required before Flix implementation and confirmation can proceed.
