# Native Flix continuous-chain checker

This additive research checker extends the independent physical model from
PR #99 without changing the R1 checker or evidence. It reads one legal source
DAG and then retains the actual complete physical state through every edge.
No root lookup, state reset or reinitialization occurs inside the edge loop.

```sh
bash research/calendar-7x7/continuous/flix/build.sh
java -Xmx8g -jar /tmp/cubistry-calendar7-continuous-flix/artifact/flix.jar selftest research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review
java -Xmx8g -jar /tmp/cubistry-calendar7-continuous-flix/artifact/flix.jar chain research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review /tmp/calendar7-english-legal-dag.tsv CHAIN.tsv
```

Flix 0.79.0, the PR #99 pinned wrapper and Java 21 are required. The build
copies the existing native geometry, calendar, artwork and DAG evaluator into
`CALENDAR7_CHAIN_FLIX_BUILD_DIR`, defaulting to
`/tmp/cubistry-calendar7-continuous-flix`. It copies the new CLI separately;
no existing source file or proof artifact is modified.

## Raw format

The canonical UTF-8 format uses actual tabs, LF line endings and a final LF.
There are no empty lines. The structure is:

```text
cubistry.calendar7.chain.v1
source<TAB>root<TAB>year<TAB>month<TAB>sourceSHA
edge<TAB>year<TAB>month<TAB>HTM<TAB>QTM<TAB>rotations<TAB>rotationQTM<TAB>sourceSHA<TAB>destinationSHA
move<TAB>generator<TAB>quarterExponent
end
... additional edges ...
finish
```

`<TAB>` denotes one actual tab. Ellipses are explanatory, not accepted input.
There must be at least two edges and at most 1,000, with at most 100,000 move
records per edge. Source root is 1–91. All source and destination months must
be within 2026–2099, and destinations must follow consecutively. A source date
may differ from its root's earliest representative date only when the complete
calendar artwork is identical. Every SHA is exactly 64 lowercase hexadecimal
digits. `finish` must be the last record. Mid-chain `source` records and reset
directives are rejected.

Moves retain R1's generator IDs 1–21 and exponents `-1`, `1` or `2`. Individual
noncentral inner and outer layers each count as one HTM. A half turn counts
once in HTM and twice in QTM. Whole-cube rotations (generators 7, 14 and 21)
are counted separately, including their quarter-turn cost. There is no wide
turn or central-slice shorthand. The checker recomputes all declared metrics
from the raw move records.

## Checks and receipts

The checker validates the exact immutable physical-print SHA from PR #99,
independently derives geometry and calendar goals, evaluates the legal source
DAG without expansion and checks the actual initial source month and full
294-sticker hash. Each edge consumes the retained actual state, checks the
claimed source hash, chronological adjacency and move metrics, then applies
every move both to the 264-pose action and directly to all 294 stickers.

At each destination the two physical replays must agree exactly. The lifted
state validates all 218 rigid cubies, outward normals and actual tangent up
vectors. All 49 front cells must match artwork, orientation and ink. The
complete destination hash must match the raw declaration. Inverse replay of
each edge and of the entire chain must recover the exact original physical
state, including hidden stickers.

Output begins with `source-sha256`. For each edge it emits:

```text
edge<TAB>index<TAB>year<TAB>month<TAB>sourceSHA<TAB>destinationSHA
metrics<TAB>index<TAB>HTM<TAB>QTM<TAB>rotations<TAB>rotationQTM<TAB>moveRecords
```

It concludes with `endpoint-sha256` and
`status<TAB>VALID_CONTINUOUS_CHAIN<TAB>edgeCount<TAB>218<TAB>294<TAB>49`.
DAG progress output is diagnostic and is not part of the shared receipt.

`selftest` runs a positive and 18 negative native parsing controls. With the
evidence and geometry arguments it also runs the inherited independent tests
of all 21 generators, inverse and four-turn identities, physical composition,
actual center orientation and artwork equivalence.

`orientation-selftest EVIDENCE GEOMETRY DAG CHAIN` derives and validates the
chain's legal initial state, then changes only the actual up vector of the
visible `SUN` header by one quarter turn. It asserts that exactly one sticker
changed and that every ID, cubie, position, normal, text and ink value stayed
identical. The same front validator must reject this corruption. This is a
synthetic unit-test state, not a claimed legal cube state or transition
certificate. The test isolates orientation from artwork-position failures.

`parse FILE` accepts syntax only and makes no physical or continuity claim.
A valid chain establishes only its recorded consecutive months. Practical
initialization, arbitrary months, complete period coverage and global move
optimality remain outside this checker's claim. Both native Julia and Flix
must accept the same raw evidence before the scoped research claim is confirmed.
