# One fixed print for the short month-name window

Research candidate, not certified. Julia and Flix accept **SAT only for fixed
printing and rigid front matchability of the 21 months May 2026–January 2028**.
Independent review is pending. Legal states and a chronological move chain are
still UNKNOWN / NOT_RUN; front matching alone does not establish either.

This print is not claimed to cover all 91 targets or January 2000–January 2100.
The separate [corner-body obstruction](../row1-corner-coupling/README.md) prevents
that global claim under the same distinct-band model.

## Immutable physical data

The [printing table](evidence/printing.tsv) fixes all 294 surfaces on the same
218 physical bodies. Every surface ID, body ID, home, outward normal and tangent
up is explicit. The one table is reused unchanged for all targets; there is no
per-month repaint or hidden-face exception. Empty row-one band surfaces retain
ink `band` and line orientation, while empty dates use `blank`. Whole labels,
strict upright text, the six/nine twin and distinct O/zero rules are preserved.

The [front-match witness](evidence/front-matches.tsv) lists 1029 cells: 49 for
each target. For each cell it gives a physical body and one proper rigid rotation
through its three axis images. Both native verifiers derive the geometry
independently and check:

- the exact 294-surface schema and fixed body/home/normal identities;
- unit tangent artwork up, including empty band's asymmetric line;
- 24 proper rotations, with no reflections or independently twisted surfaces;
- 49 distinct source bodies reaching the declared front positions per target;
- the actual facing surface's exact glyph, ink and orientation for every cell.

The May 2026 witness uses the identity poses of the reference print. Other
witness poses are not asserted to extend to legal complete states. Arbitrary
proper front poses are a matching relaxation, not legal generator words.

## Candidate generation and replay

`design.jl` is an **untrusted** bounded designer. It uses the existing research
SMT matching construction for all four multi-face body groups, with the new
band artwork and explicit May 2026 reference-front bindings. It deliberately
omits symmetry constraints that would conflict with those physical bindings.
The seven single-face groups are allocated by exact class-peak demand.
The extracted labels are placed on actual physical faces and replayed by a
separate raw witness check; solver assignment booleans are never accepted as
verification evidence.

Each of the four SMT calls has a 45-second deadline. The initial trial took
18.75 seconds including Julia setup. It used an official, hash-verified native
[Z3 5.4.0 release](https://github.com/Z3Prover/z3/releases/tag/z3-5.4.0) in local
workspace scratch, without a system installation or Python verifier. Generator
library provenance is in the experiment manifest. No Z3 binary is committed,
and the native validators do not depend on Z3.

The native [Julia receipt](evidence/julia.tsv) and [Flix receipt](evidence/flix.tsv)
agree byte for byte. Their snapshot hashes include actual body positions,
surface normals, artwork up, text and ink. Fifteen targeted raw mutations test
band rotation, band/blank separation, body duplication, reflection, source
identity, missing back surfaces, dates, letter/zero aliases and canonical input.
A positive six/nine twin control must remain accepted.

## Reproduction

From the repository root, with Julia 1.11.5, Flix 0.79.0 and JDK 21:

```sh
cal=research/calendar-7x7
out=/Users/werner/whr/cubing/scratch/calendar7-window-print-reproduction
mkdir -p "$out"
CALENDAR7_WINDOW_FLIX_BUILD_DIR="$out/flix" bash "$cal/row1-window-print/flix/build.sh"
bash "$cal/row1-window-print/run_checks.sh" "$(command -v julia)" "$(command -v java)" "$out/flix/artifact/flix.jar" "$out/checks"
```

Use `--mutations` as the final checks argument for the targeted negative cases.
The default run reports that mutations were not run. A new candidate can be
generated with `design.jl LAYOUT_TSV NATIVE_Z3_LIBRARY OUTPUT_DIRECTORY`, bounded
externally to 290 seconds. A generator timeout or failure means UNKNOWN; it
never certifies impossibility.

Next gates are independent review, legal state generation and the retained-state
20-edge chain, including native replay and inverses. Old prints, strict root
words, source pins and shipped app data remain unchanged. No app JSON, optional
`surface: face` state file, print sheet, chain or publication is generated here.
