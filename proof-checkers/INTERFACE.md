# Shared checker interface

Commands read raw UTF-8 JSON: `counter FILE [REPO_ROOT]`, `state3 FILE`, and
`conformance REPO_ROOT [NEW_EXPORT_JSONL]`. Per-language instructions document
lifecycle entry points and prerequisite builds.

Every verdict has Boolean `valid` and string `status`: `VALID`, `INVALID`,
`INVALID_JSON`, `UNSUPPORTED` or `ERROR`. Rejection/error includes `reason`;
additional diagnostic codes are allowed. Exits: 0 valid, 1 invalid/invalid JSON,
2 unsupported command/schema, 3 unexpected runtime, I/O or corpus-integrity error.
Toolchain failures before program entry are not mathematical verdicts.

Counter success reports `values=100`, `inverseChecks=100`,
`chainedTransitionsPerFormat=800`, `hubOrderedTransitions=10000` and
`canonicalStateSHA256` over the 100 ID-sorted full-state wire arrays. Marked-state
success includes full `state`, `stateSHA256`, six physical `centerTwists`, and
`goalMatches` (null if no optical goal, otherwise Boolean). A physically valid
state can have `goalMatches=false`; callers requiring a target must check both.

Complete conformance success reports actual counts:

- `counterCases=41`, `counterAccepted=2`, `counterRejected=39`;
- `geometryCases=154`, `geometryAccepted=129`, `geometryRejected=25`;
- `kernelReferences=2048`, `centerGenerators=36`;
- `geometryWitnessesReplayed=121`, `geometryOuterHTM=628`,
  `geometryWholeRotations=369`, `geometryRotationQuarterTurns=469`.

`fullStateAggregateSHA256` is over ASCII lowercase digest strings joined with one
newline and no trailing newline: successful case digests in manifest order (one
100-state digest per counter case, one full-state digest per marked case), then
36 generator endpoint digests in array order, then 2,048 kernel endpoint digests
in array order. There are 2,215 component hashes; the frozen expected aggregate is
`2b7474246a94f3ea4788c119b93a292283dd2d40cd2739dcc76978b399fcb661`.
Per-case acceptance must be compared before expected-state/goal assertions;
catching those assertions as if a negative input were rejected is incorrect.

JSONL export labels use string `group` and `name`, plus full `state` wire arrays:
`counter` (case name, integer `value` 0–99), `geometry` (case name), `generators`
(ordinal name `0`–`35`) and `kernel` (corpus bit-index name). Names and counts are
exact; a missing/duplicate record is an audit failure. Output keeps actual world
frames; reachability normalization never replaces returned state.
