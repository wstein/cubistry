# Independent native Flix recovery author report

Author: Codex Sol, separately implemented from the frozen contract after the
Julia-first execution gate cleared. No new Julia recovery source/tests,
computed Julia result, production mechanics or Python proof verifier was read or
used as an implementation oracle. Only the preexisting native Flix model/parser
and its full physical enumeration were reused.

Code worktree: `/workspace/cubistry-hsm-recovery-flix`, branch
`feat/hsm-recovery-flix`, baseline `eb151a9`, doc-only wire cherry-pick `126a8a7`.
Implementation commits: `5bda015`, harness `a899c76`, controls `3e34cf4`, static
review fixes `ac1b6bf`. Mathematical source has remained immutable since `ac1b6bf`.

Current Flix result: full native `VALID`, exit 0. The coordinator compared the complete output with Julia and found exact byte
agreement; independent final review remains pending. There has been no
observed accept/reject/count/replay/hash dissent.

The deterministic full result is `/tmp/hsm-recovery-flix-runs/full18/stdout.txt`,
SHA-256 `0d0d139589dfe9a39524967ebe543c4316c9343e0e0d4c05966b5a5ef3283c70`
(includes final LF). It reports 18 modes, 264 sample rows, 1,061 forward display
steps/per-edge inverses and 264 complete sample inverses. Captured wall time is
110.354254597 seconds; peak child RSS is 1,311,372 KiB, user CPU 121.225118 seconds
and system CPU 1.708242 seconds. Shared-machine observations are not universal
performance promises.

Final artifact: `proof-checkers/flix-recovery/artifact/flix.jar`, SHA-256
`dd296c1320e42ae3bd7474b67b23f2d1b14f479d1a1c13a8c62aada16435c691`.
Final recovery source SHA-256:
`1dd0ea4cfb8347661fefbf84c09916847091d21e78486bdf48517400ebb6d21f`.
`/tmp/hsm-recovery-flix-runs/build-final.json` describes all actual copied compiler
inputs. The independent reviewer verified those seven hashes against the frozen
source and compiler-input snapshot. Compiler/runtime/wrapper/parser/input pins and
platform details are in `environment.json`; final build wall time is
11.039946592994966 seconds. Build peak RSS was not separately measured.

Final self-tests passed 10 native priority/decimal checks. Final H11 mode16 smoke
passed with explicit `UNKNOWN`/`PARTIAL`. All 39 independent input controls passed:
37 rejected for concrete defects, while an informational-label change and an
exact scientific-notation mean were accepted as partial results. Every control
preserves its actual two input files, stdout/stderr, process command, digest,
exit, wall time and child resource counters under `final-controls/`.

Static review caught two provenance findings before the final measured artifact:
input parsing and hashing originally reopened paths, and build hashes described
origins instead of the copied compiler inputs. Both were fixed in `ac1b6bf`, then
all final controls and smoke runs were repeated. Parsing and hashing now use the
same one-read UTF-8 text; source copies are hashed before build and verified after
build against unchanged origins. The explicit one-million-node capacity guard
protects exact signed-64-bit triple packing. These were static findings, not
actual checker dissent. Earlier runs/build failures are retained separately.

The 301 protected legacy files are unchanged from the baseline checkout,
including the repository's CRLF checkout filter for `flixw.cmd`:
`protected-files.json`. The allowed hash-only corpus audit passed all 195 pins.
New documentation spelling/local links, diff whitespace and Python harness syntax
checks passed. Legacy native execution gates passed in an isolated build: all 195 cases
matched their declared outcomes (131 accepted, 64 rejected; 121 geometry witnesses
replayed), and old `hsm` recovery remained `UNSUPPORTED` with exit 2. The unchanged
46-case HSM corpus received the agreed hash/count audit only, not a repeated
mathematical conformance run. The 195 native aggregate stayed
`2b7474246a94f3ea4788c119b93a292283dd2d40cd2739dcc76978b399fcb661`.
Coordinator comparison: `/tmp/hsm-recovery-native-comparison.json`; both full
outputs are 9,756 bytes with the same SHA-256 above. No dissent.

All captures are local under `/tmp/hsm-recovery-flix-runs`. No branch was pushed,
no protected research path was written by this author, and no PR/merge/deployment
or readiness action was taken. The coordinator owns later evidence publication.

Limitations retained: global print optimality `UNKNOWN`; runtime reachability of
forced poses and minimum-mean period certificates `NOT_CHECKED`. No universal
five-HTM recovery claim is made; forced shortest six-HTM M/H edges are verified.
