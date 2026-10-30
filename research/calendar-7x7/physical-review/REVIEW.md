# Independent physical-model review

Date: 2026-10-30. Scope: the German 7×7 monthly calendar, 2026–2099,
three separate uppercase month letters at starts `555555555111`, no year,
Monday-first columns, red weekends, fixed artwork, explicit marked overflow.

## Result

No blocking mathematical finding remains in the **scoped paired-wing obstruction**.
The separate capacity bound passes, but the stronger coupled physical-piece
constraint fails. The negative argument does not require a full-cube solver:
if the front cannot be assigned to distinct physical wings, legal reachability
is impossible as well.

The research-local Julia and Flix checkers both accepted the same raw certificate:

`a567f89f2c13dcd37e3dc22507c49f96a27da510bec6efe8449f92db32b7129b`

Existing canonical counter/state3 checker profiles do not support the new format.
No canonical CONFIRMED status, production print certification, positive SAT
claim, or English impossibility claim is made by this review.

## Independently reconstructed geometry

`geometry_audit.jl` enumerates all 24 determinant-positive signed-permutation
rotations without importing the author's orbit function. It verifies:

- 218 visible physical cubies and 294 stickers;
- 13 sticker orbits, twelve of size 24 and one fixed-center orbit of size 6;
- 24 wing-distance-1 pieces each pairing A(-3,-1) with B(-3,1);
- 24 wing-distance-2 pieces each pairing (-3,-2) with (-3,2);
- 12 midges carrying two surfaces in (-3,0);
- 8 corners carrying three surfaces in (-3,-3).

The noncentral single-sticker pose stabilizer is trivial; fixed-center poses
have four residual in-plane rotations. This supports the orientation-sensitive
artwork orbit interpretation. `parity_audit.jl` additionally checks necessary
parity equations for 18 noncentral layer quarter-turn generators. Those equations
were not used as an unproved sufficient reachability criterion.

## Independent finite proof

The reviewer's Julia certificate implementation uses its own `Dates` targets,
3D rotation normalization, and physical coupling. It imports no root target
generator, artwork routine, SMT encoding, or SAT solver.

It independently derives exact 24/24 inventories, 20 simultaneous-peak
exclusions, and three remaining A partners for the two B-blank pieces. Each
remaining A class has exactly one physical copy. All three are demanded in
November 2026, while B-blank is also demanded. Thus the two B-blank pieces cannot
serve the required blank because their unique A sides must already be visible.

`BLANK-OBSTRUCTION.md` gives the human-readable argument and precise cell list.
The allowed 6/9 reuse is explicitly retained: the Monday 9 has canonical artwork
class ("6",2,"dark").

## Reviewed author source snapshots

| Source | SHA256 |
|---|---|
| `../blank_obstruction.jl` | `95168d098bc41f87d65ebcbb8751a0a1ad313093a66e68b6274b6f126515fd50` |
| `../coupled_synthesis.jl` | `bdb4c477aac5c7bea32c01f6e74ae10b19a4319d6c249a4c50e131119152fcb2` |

The author's direct obstruction logic agrees. Its tight-inventory guard is
essential. Sorting interchangeable piece labels and within-one-orbit faces is
safe for its necessary front-matching relaxation, but is not itself a full-state
physical construction. The replacement Sinz at-most-one Boolean encoding is
correct. The earlier unsupported `at-most` SMT parser attempt produced no usable
result and must remain excluded from evidence.

Later source changes require review of their diff; these hashes identify what
was actually inspected.

## Executed checks

```sh
julia --startup-file=no research/calendar-7x7/physical-review/geometry_audit.jl
julia --startup-file=no research/calendar-7x7/physical-review/parity_audit.jl
julia --startup-file=no research/calendar-7x7/physical-review/blank_obstruction_certificate.jl check research/calendar-7x7/physical-review/DE-blank-obstruction.tsv
julia --startup-file=no research/calendar-7x7/physical-review/negative_certificate_checks.jl
```

Julia 1.13.3: valid certificate accepted; all 10 corrupt controls rejected.
Evidence is in `geometry-audit.tsv`, `parity-audit.tsv`,
`blank-obstruction-check.log`, and `negative-certificate-checks.log`.

The separate Flix 0.79.0 implementation independently derives the geometry,
targets, inventories and obstruction, accepts the raw canonical certificate,
and rejects all 9 corrupt controls. Exact exit codes and input hashes were
inspected in `../verification/flix/physical-checks.tsv`; its valid certificate
hash matches the Julia input exactly. Java is OpenJDK 21.0.12.1.

## Boundaries

- 2026 alone has A24/B23, so this tight-inventory proof does not apply to it.
- English has a candidate wing printing but no complete physical SAT proof.
- Arbitrary header schedules, two-sticker month formats, other fonts/colors,
  and general 7×7 calendars are outside this negative conclusion.
- The full-cube completion/group-membership problem remains unresolved for
  positive candidates; no parity-only sufficiency claim is accepted.
- Canonical checker registration, conformance pin audit and any CONFIRMED label
  are separate repository-governance work, not silently supplied by this new
  research-local profile.

No main, protected branch, remote history, deployment, or production behavior was
changed by the reviewer. Files were left for the root author to commit atomically.
