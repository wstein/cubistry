# Independent certificate and marked-cube checker contract

Status: approved bounded implementation scope from [issue 74](https://github.com/wstein/cubistry/issues/74).
Base: finalized lifecycle spike `285e8348e35e3bfc2a974bc6d77e8d9d5baf0bd6`.
Python proof gates and production code remain authoritative and unchanged. These
are validators/replayers, not solvers or new layout/optimality/UNSAT experiments.

## Ownership and trust boundary

The coordinator owns this specification, common conformance data, coverage manifest
and corpus pins. Flix owns `proof-checkers/flix/`; Julia owns
`proof-checkers/julia/`. Each implements semantic validation and group action in
its named language. A pinned/licensed JSON parser is allowed, including Flix JVM
parser interoperability. Neither checker imports Python/production/solver move
code as its engine. Python/Research code may generate independent expected data
and compare outputs, never preprocess the runtime input for a named checker.

The shared specification, exact input names, expected outcomes and hashes must be
committed before parallel implementation. Corpus runners enforce the published
manifest pin and all declared cases; a missing/substituted fixture is an error,
not a smaller successful suite. Unknown schema versions/commands fail closed.

## Raw JSON and bounded input policy

All decoded strings must consist of valid Unicode scalar values; reject unpaired
surrogates. Both CLIs read original raw UTF-8 JSON bytes, not typed source generated from
Python. Reject invalid JSON/encoding, duplicate object keys, NaN/Infinity, missing
required fields, wrong types and unsupported versions. Bound input to 16 MiB,
object/array nesting to 64 and an unquoted numeric token to 128 bytes. The
root container has depth 1 (a scalar root has depth 0 but is unsupported here);
each nested object/array adds one. Numeric-token length includes a leading minus,
decimal point and exponent/sign characters, not only its digits. Semantic
integer fields use JSON **integer tokens** with no fraction or exponent; reject
Booleans, `1.0`, `1e0`, rounded fractions and underflow forms before machine-integer
conversion. Range-check before conversion; no wrap, saturation or truncation.

This is deliberately stricter than incumbent Python's integer-valued-float policy
and default duplicate-key behavior. Optional legacy metadata (`faceFrame`,
`source`, `solver`, sticker `slot`) remains informational. Unknown extra fields do
not create a new supported schema or bypass required-field checks; their JSON
syntax and resource bounds are still checked. The conformance manifest identifies
strict-only rejections that incumbent Python may accept, especially declared
unpadded fields that compare equal under Python's Boolean/integer equality.

Move separators are exactly Python 3.12 `str.split()` whitespace: U+0009–000D,
U+001C–0020, U+0085, U+00A0, U+1680, U+2000–200A, U+2028, U+2029, U+202F,
U+205F and U+3000. Runs/leading/trailing separators are ignored; no other code
point is a separator. The reordered-array positive fixture exercises the set.
Move words are strings of explicit whitespace-separated `R L U D F B` tokens,
optionally suffixed `2` or `'`; 3×3 also supports `x y z`. Reject lowercase face
moves, slices, wide turns, duplicate suffixes and nonstrings. Bound a word to
16,384 bytes and 1,024 tokens. A quarter turn is -90° about the positive coordinate
axis for R/U/F and x/y/z; opposite face turns reverse that sign. A half turn is
two quarters. All arithmetic is exact integer group action.

## Group 1: complete incumbent counter checks

Input schema is numeric `1`, puzzle `2x2x2`. Required fields are `schema`, `puzzle`,
`printing`, `unpaddedPrinting`, and `witnesses`. Required sticker fields are
`id`, `cubie`, `p`, `n`, `up`, `image`; image is a string. IDs are exactly 0–23,
cubies exactly 0–7, 24 unique outward facelets on {-1,+1}³, three co-located
stickers per body, eight distinct body positions, and signed-axis normal/up
vectors forming outward orthogonal tangent frames. Preserve ID/body/image through
all moves. Validate declared unpadded fields with the same strict types and frames.
As in the incumbent certificate verifier, `unpaddedPrinting` must retain the
matching ID order of `printing` before the one-sticker image substitution is
compared. Both arrays may be permuted together; permuting only one is invalid.
Canonical state hashing subsequently sorts by ID and does not relax this input
relationship.

Witnesses contain each value 0–99 exactly once in order, with a legal word. Replay
all 100 padded displays, 100 exact inverses and all 100 unpadded displays. The
front positions are top-left, top-right, bottom-left, bottom-right; images are
`title-left`, `title-right`, tens and units, with upright nonblank images. The
unpadded source differs at exactly one fixed sticker: a `0` on cubie <4 becomes a
literal space; no runtime repaint is allowed.

Replay the exact incumbent 801-value chain, pinned in `counter-chain.json`, from
canonical 00 through 800 transitions per format. It includes increments,
decrements, seeded random jumps and clamped ±1/±10 changes. Every chained full
state must match its independently replayed canonical state. The 100 forward and
inverse words justify the same 100×100 hub factorization, without falsely claiming
10,000 separately executed composed paths.

Retain the incumbent fixed-upper-body arithmetic/model argument (8×3=24 total
faces, (8−2)×3=18 digit faces, 10×2=20 padded and 9×2+1+1=20 unpadded requirements)
and the actual rotated-title-source rejection control. This is the unchanged
argument under its explicit upright/distinct-digit/title-body assumptions, not a
new result about unrestricted layouts or rotated digit aliases.

Machine output reports counts, accepted/invalid status, source hash and canonical
full-state digest. An accepted certificate must complete every listed check;
other certificate formats remain unsupported.

## Group 2: arbitrary full marked 3×3 state and replay

Schema `cubistry.marked-3x3.v1` has `printing` and `state`, each 54 stickers with the
same required fields as above. IDs are 0–53; reference cubie IDs are 0–25, grouped
by the 26 noncore source positions in {-1,0,+1}³. Each reference facelet satisfies
p·n=1 with signed-axis n/up and n·up=0. Groups have three/two/one stickers at
corner/edge/center positions. Images and IDs/bodies are immutable in `state`.
Reference up-vectors can differ per sticker; no color labels replace identities.

Validate complete unique occupancy and rigid physical bodies. There must be one
proper signed-axis rotation that maps **all** reference p/n/up vectors of a body
to its actual vectors; rejecting a reflected or independently twisted sticker is
required even when its visible image is blank. Keep all actual world-frame data
in outputs and replay. A derived normalized copy is used only for reachability.

Find one of the 24 proper whole-cube rotations mapping all six actual center IDs
and positions/normals to their reference positions/normals. No such rigid frame
means invalid. Normalize that copy, then enforce all of:

- corner twist sum = 0 mod 3;
- edge flip sum = 0 mod 2;
- corner and edge permutation parities agree;
- sum of six physical center quarter turns mod 2 equals corner permutation parity.

Extract orientation using these ordered destination face tuples, not the shortcut
"a U/D sticker is off Y". Positions are sums of the named face normals.

Corners, in order: `(U,R,F)`, `(U,F,L)`, `(U,L,B)`, `(U,B,R)`,
`(D,F,R)`, `(D,L,F)`, `(D,B,L)`, `(D,R,B)`.
The source U/D sticker's index in the destination tuple is its twist (0/1/2).

Edges, in order: `(U,R)`, `(U,F)`, `(U,L)`, `(U,B)`, `(D,R)`, `(D,F)`,
`(D,L)`, `(D,B)`, `(F,R)`, `(F,L)`, `(B,L)`, `(B,R)`.
The first source-tuple sticker's destination-tuple index is its flip (0/1).
Permutation parity counts inversions of source-body indices in destination order.

Physical centers are ordered U/L/F/R/B/D. A center's quarter index is 0–3 relative
to its reference up vector under the corresponding explicit face turns. Its
physical orientation is retained even for hidden or blank art. Optional optical
`centerGoal` (six indices 0–3) and `periods` (six members of {1,2,4}) compare
`(actual−goal) mod period == 0`. Period 1 permits all orientations, period 2 permits
half-turn symmetry, period 4 requires exact orientation. Optional `centerTwists` declares the six physical indices in this schema's
explicit U/L/F/R/B/D order/convention and must exactly agree with the full up
vectors after normalization. Optical equivalence never
makes an unreachable physical state valid. Report physical validity and goal
matching separately.

Replay all 18 outer moves, nine whole-rotation tokens, inverses/fourfold words,
all 24 rigid frames, rotated reference sources and seeded multiface words.
The shared corpus includes rigid single-edge flips, single-corner twists,
corner-only/edge-only odd swaps, isolated 90° centers, malformed bodies and
metadata, alongside valid R-quarter and legal center-half states. These are
reachability predicates, not claims that invalid input proves layout UNSAT.

Replay the exact pinned 36 center generators and all 2,048 kernel words from
Research `0013522`; compare every complete frame, expected center indices and
inverse restoration with unchanged independent Research replay. The 286-HTM
constructed reference maximum is provenance, never an optimality or animation
bound. Retain every xyz token even when a producer's optimization assigns whole
rotations zero HTM cost; report outer HTM and physical whole rotations separately.
A future Cubacle producer must declare its own twist order/direction/reference
frame; this schema does not silently assume its format or adapt its engine. No production solver helper is imported by either engine.

## Interface, conformance and lifecycle

Provide `counter FILE`, `state3 FILE`, and a complete conformance entry. Return
structured JSON diagnostics and nonzero exit for invalid/unsupported input;
unsupported formats and bounded resource failures never produce SAT/UNSAT claims.
The exact stdout result schema may include language/runtime diagnostics, but
shared outcomes/counts/digests and failure names must be machine comparable.
Canonical full-state wire output is an ID-sorted array of
`[id,cubie,[p0,p1,p2],[n0,n1,n2],[up0,up1,up2],image]`, compact ASCII JSON using the standard Python `json.dumps(..., ensure_ascii=True,
separators=(",",":"))` string escaping: quote/backslash escaped, slash unescaped,
short escapes for backspace/tab/newline/form-feed/carriage-return, all other
control code points and code points >=127 as lowercase `\uXXXX`; supplementary
scalars use their two lowercase UTF-16 surrogate escapes. Integer output has no
leading zero or exponent. This defines the full-state SHA-256 for Unicode too.
Single-state commands return the full wire state when valid. Complete conformance
can normally emit counts/digests, but must offer a full-state JSONL export for
independent comparison (including every kernel endpoint); repeated lifecycle
checks may suppress output volume, never the actual replay or full-state checks.

Conformance data pins source inputs, every named positive/corrupt fixture,
independent expected full states, incumbent-policy differences, chains and kernel
references. Report all expected counts; enforce the manifest hash before running.
Keep unknown or not-yet-implemented coverage explicit; do not label a partial
checker complete.

After correctness parity, measure setup/build separately, one fresh-process
READY/load, first **complete two-group conformance run**, at least three complete
same-process repeats with fresh/reset data, and flushed DONE-to-parent-wait exit
tail. Use the established monotonic observer; do not substitute microkernels,
elide negatives, force GC, or assume zero teardown. Different prototype/production
coverage cannot be used for a cross-language full-suite speed claim.

Independent review, focused Conventional Commits and a separate stacked Draft PR
are required. No Python/CI replacement, Ready transition, merge, deployment,
package publication or Cubacle migration is authorized by this contract.
