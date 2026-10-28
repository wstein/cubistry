# Issue 58 independent proof gate

**Gate clear:** the largest continuous five-second MM/SS range is **00:00 through
39:55 inclusive**, under the frozen strict upright 24-sticker/eight-corner model.
The exact 30:00 Pomodoro target is included. This is not a result under a new
optical-symmetry, cross-digit-alias or display-architecture relaxation.

## SAT lower bound

Reviewed immutable source certificate:
`research/five-second-timer/certificate.json`, SHA-256
`629bce3f88b434798b5067a59ea3f3675e3a2ece5eecadafcce0e840f215384c`.
It matches the promoted candidate bytes exactly. Public runtime certificate
`research/five-second-timer/runtime.json`, SHA-256
`0a718f652bae0e9e63414e329b5be536cacc2cbd52c209781f543bd96e28ed7b`,
removes only the `evidence` metadata key; every retained field is identical.

I implemented and executed `physical_replay.py` separately from the generator
and project checker, using standard-library integer Rodrigues rotations and no
project imports. It validates the complete physical facelet lattice, eight
three-sticker rigid bodies, permanent single-digit images and integer normal/up
frames; replays every legal word; checks all four displayed glyphs and their
upright vectors at every time; checks each inverse; and executes the complete
reverse route to restore each exact prior 24-sticker state and the source.

Independent result: **SAT**, 480 inclusive states, 479 adjacent edges,
2,261 committed HTM, maximum six per edge, mean 4.720250521920668; five-move
source setup excluded. Exact 30:00 prefix: 361 states, 360 edges, 1,703 HTM.
The old abstract-only UNKNOWN lower-bound note is now superseded by this actual
physical witness/replay, not by inference from a matching count.

Also independently executed the project's separate Python physical/BFS checker:
all 479 forward reached-state-to-display paths are shortest according to its
independently rebuilt 136,080-state four-corner graph. This is not a global
print/traversal move-optimality proof or an unqualified reverse partial-display
optimality claim. Global print-move optimality remains **UNKNOWN**.

## UNSAT upper bound

The independent `upper_bound_audit.py` / promoted `upper_bound.py` structural
proof checks 2,304 rigid-frame rotation cases, derives the exact Cartesian
00:00..39:55 digit domain, and exhausts all sole-duplicate slots plus 12
remaining-face placements. Exactly two old-domain skeleton families survive;
both force the new minute-tens 4 and required seconds-units 0 onto one cubie at
40:00. Therefore **40:00 is UNSAT** in the frozen model. Every longer continuous
range contains 40:00, establishing the true maximum together with the SAT witness.
The reviewer-authored audit was promoted byte-for-byte, with SHA-256
`3684f72e865af7cad2829f8c4fb71c7c6ab4701f578dba8a4a523177b7ad743d`.

## Reproduction

From the pinned Research checkout (the later branch separation changes file location, not certificate bytes):

```sh
python3 research/five-second-timer/physical_replay.py research/five-second-timer/certificate.json
python3 research/five-second-timer/verify.py research/five-second-timer/certificate.json
python3 research/five-second-timer/upper_bound.py
node research/five-second-timer/generate.mjs /tmp/five-second-independent-regeneration-NEW.json
```

Use a fresh, nonexistent output path for each generator invocation: it correctly
refuses to overwrite existing artifacts. The fresh generator run (seed 271028,
512 proposals, selected tie policy 7) independently reproduced every runtime-core
field and all non-time evidence metadata. Only observational `runtimeSeconds`
differed (2.427 versus stored 2.581 seconds), as expected. Compare semantic core
or public certificate hash, not the full observational candidate hash, for
reproduction. Geometry bytes independently match the inherited pinned geometry
SHA-256 `d1616f23f88fc6ff1d9f502070652b6290e48d51bbb1fd6c7f503056a7d01264`.

## Remaining gate boundaries

No unresolved mathematical finding for this strict model. Runtime integration,
real 250-ms animation measurement, clock/lag handling, UI naming and upper-bound
validation, application isolation, full regressions, CI and final PR review are
not cleared by this proof report. Six turns imply a nominal 1.5-second move budget,
not a device-independent scheduling guarantee. No merge/deployment/readiness
action is authorized or performed by this report.
