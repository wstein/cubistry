# Content identifiers in the HSM recovery evidence

The evidence under `hsm-recovery-final/` and `hsm-recovery-julia-component/` is
identified by file content (SHA-256), not by git commit hashes. Commit hashes
change when history is rewritten; content digests do not.

## Path-digest

A path-digest is the SHA-256 of a text made of one line `<path> <sha256>` per
file (a single space, LF line ends, a final LF), where `<sha256>` is the
SHA-256 of the file bytes, `<path>` is the repository-relative path and the
lines are sorted bytewise by path (`LC_ALL=C sort`).

```sh
# example: path-digest of files listed in a text file with "path sha256" lines
LC_ALL=C sort lines.txt | shasum -a 256
```

## Identifiers

- `sourceSnapshotId` (`hsm-recovery-final/julia-full-context.json`) and
  `juliaMathematicalSourceId` (`hsm-recovery-final/manifest.json`) and
  `mathematicalSourceId` (`hsm-recovery-julia-component/manifest.json`):
  path-digest over the seven entries of `sourceSnapshotSHA256` with the prefix
  `proof-checkers/julia/` added to each name (`Checker.jl`, `Conformance.jl`,
  `Hsm.jl`, `Manifest.toml`, `Project.toml`, `Recovery.jl`, `recovery-main.jl`).
  The entry script was named `recovery.jl` when the run was recorded; it was
  renamed to `recovery-main.jl` (same bytes, same SHA-256) so that no two
  tracked paths differ only by case.
- `integrationSnapshotId` (`hsm-recovery-final/manifest.json`): path-digest over
  the seven entries above plus
  `proof-checkers/flix-recovery/src/RecoveryMain.flix`.
- `flixRecoveryMainSHA256` (`hsm-recovery-final/manifest.json`): SHA-256 of
  `proof-checkers/flix-recovery/src/RecoveryMain.flix`.
- `reviewedSourceAndInputId` (`hsm-recovery-julia-component/manifest.json`):
  path-digest over the eight entries of its `sourceAndInputSHA256` as recorded
  there (keys are the paths; the profile entry is the document version before
  the wire clarification).

Earlier versions of these files named the same state by git revision
(`sourceCommit`, `reviewedRevision`, `mathematicalRevision`,
`juliaMathematicalSource`, `flixMathematicalSource`, `integrationSnapshot`, and
a `commit` field of the documentation clarification). Recorded outputs,
timings, counts and runtime versions are unchanged. The `artifactSHA256` entries
of `hsm-recovery-final/manifest.json` for `julia-full-capture.json` and
`julia-full-context.json` were recomputed after these edits.
