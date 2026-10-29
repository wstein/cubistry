# Independent Issue 74 implementation review

## Julia candidate

Reviewed frozen `b4fa161e87c29772c3fb64f64bca71b781aefaff` in detached
`/workspace/cubistry-checkers-review`. No author source edits. No production solver,
Python move engine, or generated typed fixture source is imported by the Julia
validator. JSON is used only for parsing/ordinary output; independent integer
Rodrigues action, body geometry, reachability and canonical escaping are implemented
in the named checker.

Actually ran:

```sh
JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot /tmp/julia-1.13.3/bin/julia \
  --startup-file=no --optimize=0 --project=proof-checkers/julia \
  proof-checkers/julia/check.jl conformance /workspace/cubistry-checkers-review \
  /tmp/cubistry-checker-independent/julia-full-states.jsonl
```

Complete result: 41 raw counter cases (2 valid, 39 rejected), 154 marked-state
cases (129 valid, 25 rejected), 36 generators and all 2,048 center references PASS.
All 121 positive geometry words are actually replayed and inverses restored:
628 outer HTM, 369 whole-rotation tokens, 469 rotation quarter turns. The reviewer
independently recalculated these counts from the pinned words.

Independently audited every actual JSONL endpoint against unchanged Python/Research
oracles: **2,413 complete states / 124,302 sticker frames** match exactly, including
strict integer output types, Unicode images, all kernel endpoints and full world
frames. Expected aggregate SHA-256:
`2b7474246a94f3ea4788c119b93a292283dd2d40cd2739dcc76978b399fcb661`.
The Julia export SHA-256 is
`9993992864a969cc14dd6f360519ae82e96ebbba0f87873e9c93354d845f4e60`.

All 17 reviewer-owned standalone raw-CLI probes passed with correct validity,
nonzero/zero exits and canonical digests: reordered source/state arrays, permuted
body and sticker labels, their combination, counter ID/array permutation checked
against the unchanged Python oracle, arbitrary reference print-up, mixed Unicode
escaping, decoded duplicate keys, unpaired surrogate keys, negative zero integer
spelling, exact 64/65 total-container depth, exact 128/129-byte numeric-token bounds,
and finite fractional/exponent numbers in ignored metadata.

## Findings and current status

A substantive initial conformance gap was fixed before candidate freeze: state
validity and expected input hashes did not replay ordinary geometry fixture words,
leaving XYZ actions unexercised. `b4fa161e87c29772c3fb64f64bca71b781aefaff` adds actual full-state word replay and
inverse restoration, now independently verified. A minor CLI exit-code consistency
suggestion was sent to the author: the outer catch currently returns code 1 for an
UNSUPPORTED command, although schema-path failures can return code 2. Both fail
closed; final protocol/doc reconciliation is pending.

No remaining Julia mathematical/raw-JSON correctness blocker was found in this
candidate. Flix implementation review, final combined protocols/docs, complete
same-process conformance lifecycle measurements and final frozen-head reconciliation
remain pending. This is not clearance for all repository proof formats or Python/CI
replacement. No publication, Ready transition, merge, deployment or solver/producer
adaptation was performed.

## Flix candidate and additional independent probes

Reviewed Flix raw core through `5e856f219275d7f908edfc066b515caf33a980f5` and its
frozen executable SHA-256
`8d6cedb47a28bc6fe3e621642294718e89629fc2e123187232972ccea9c7612f`.
The Jackson Core 2.22.4 parser artifact SHA-256 and built-source hashes independently
match the retained pin/build record. Java interoperability supplies tokenization,
UTF-8 file I/O and standard hashing; schema policy, integer bounds, geometry,
reachability, optical goals and counter mathematics are implemented in Flix.

Independent full conformance passed every raw case and all 36/2,048 references.
All 2,413 actual exported states / 124,302 frames match the unchanged oracles, with
aggregate `2b7474246a94f3ea4788c119b93a292283dd2d40cd2739dcc76978b399fcb661`.
Final Flix export SHA-256:
`e4aad044ed3058689356521d9cf243ac28284c919357722236b241274e941f03`.
All 20 independent raw-CLI probes pass in both engines. The three additional
resource probes include a permitted 60,000-character metadata member name and
exactly 16 MiB raw JSON, plus rejection one byte beyond the limit. The author caught
and fixed Jackson's unrelated default 50,000-character name cap before final freeze.

The reviewer independently computed physical center indices for all 24 rotated
reference sources, added exact period-4 goals and declarations, and tested both
engines. All 52 checks pass: 24 exact cases per engine, one physically valid optical
mismatch per engine, and one contradictory declared twist rejected per engine.
This supplements identity-reference optical tests in the shared corpus without
altering the corpus or adding another certificate format.

## Complete same-process lifecycle executions

The reviewer independently executed four complete conformance calls in one fresh
process for each engine. Every call retains all raw positives and negatives,
121 geometry words/inverses, 36 generators and all 2,048 kernel replays/full-state
checks. Each aggregate equals the independently verified expected digest. There is
no microkernel substitution or cached semantic verdict. Module/runtime caches are
allowed; original input/resource bytes are read and validated again in every call.

Reviewer child-body observations, not cross-process absolute timestamps:

- Julia, normal optimization at `9abe7e04972af1aebe92a2e40dd746b0e25fe8c3`:
  first 7.857 s; warm 2.955 / 2.924 / 2.960 s; observed exit tail 24.82 ms;
  whole process 20.51 s. Five actual CLI/integrity protocol checks also passed.
- Flix at `5e856f219275d7f908edfc066b515caf33a980f5`:
  first 4.816 s; warm 3.195 / 2.849 / 2.530 s; observed exit tail 17.95 ms;
  whole process 13.60 s.

Startup/load/preflight and parent envelopes remain separate from these inner body
times. The Flix preflight returns only a byte count and retains no parsed model or
completed verdict. Both engines reread/reparse the corpus in complete calls. Shared
machine observations do not provide universal latency guarantees or estimate every
repository proof format. GC was not forced; exit tails include observation/scheduling
and are not isolated destructor CPU time.

Final interoperation reconciliation is pending: the common interface now requires
four top-level geometry execution counters, which the Flix candidate initially
reported only partly per case. The author is deriving the shared counters from
actual executed words; final metadata-only candidate and documentation review will
close this item. No publication, Ready transition, merge or deployment occurred.

## Final findings resolved and aggregate clearance

Final aggregate reviewed:
`c7c13711edd5f3dd0b14468012e1bafae17dd59e`.

The shared top-level geometry counters are now derived from actual executed words
and asserted in Flix, matching Julia and the interface. A fresh independent full
conformance run confirmed 121 / 628 / 369 / 469, the expected aggregate, and the
unchanged complete JSONL export. The final reporting-only change did not alter
parser/body/reachability code.

A subsequent independent counter probe found a real acceptance discrepancy:
reversing only `unpaddedPrinting` rejected in Python and Julia but accepted in
Flix, whose early ID sorting discarded the incumbent paired input-order relation.
The author fixed this with an explicit comparison of decoded integer ID sequences
before canonical sorting. The specification now states this legacy relationship.
Independent final regressions pass all three cases: only the declared array
reordered rejects; both arrays reordered together accept; lexical integer `-0`
versus `0` still accepts. No new undocumented acceptance-set relaxation remains.
The regression input and pre-fix discrepancy are retained with reviewer evidence.

Final Flix engine source is
`bbd8eb5a742b6b11daf950c7922137fbe9fe9411` (the focused three-line decoded-ID-order guard), with artifact SHA-256
`9602959e2fc33b431f595018484faf65ae33d0bcf0309cb2f371c103d0603442`.
The final independent complete conformance again passed every shared count and
hash, and its 2,413-record JSONL output remains byte-identical to the previously
independently audited Flix export. Julia mathematical source remains unchanged
from reviewed `9abe7e04972af1aebe92a2e40dd746b0e25fe8c3`.

All 45 final evidence-manifest entries, both six-file language source-hash maps,
and both decompressed 2,413-record export hashes independently verified. All local
links in the six narrative documents resolve. Existing production, Python/Research
proofs, tests, root package manifests and CI paths are unchanged from the finalized
spike base. The detached aggregate reviewer checkout remains clean.

The reviewer independently recomputed both lifecycle table rows from retained
parent receipt timestamps and child-relative durations. Reported first envelopes,
inner call times, nonzero observed exit tails, total wall times and separately
captured build/load costs agree. The narrative correctly discloses Julia's extra
first-use JIT outside the inner timer, differing load/preflight work, populated
dependency caches, and the limits of shared-machine measurements. No zero-teardown
or unported-production-suite performance guarantee is inferred.

No unresolved blocking finding remains for Issue 74's two scoped optional checker
groups. This is independent regression/conformance evidence, not formal verification
of either program or every possible parser input. Other certificate formats and
production test groups remain outside scope. The six explicitly stricter frozen
counter fixtures retain their disclosed policy differences; no identical global
accepted-input-set claim is made. Invalid inputs do not establish layout UNSAT,
and no solver, optimality or universal move bound was introduced.

No review publication, Ready transition, merge, deployment, package publication,
Python/CI replacement or Cubacle adaptation was performed. The local review is
complete for Draft delivery and explicit human review.
