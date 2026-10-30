# English printing optimization: nonblank sticker surfaces

**Complete physical feasibility remains UNKNOWN.** This directory minimizes
glyph-bearing sticker surfaces in the coupled-front matching relaxation. It does
not prove legal whole-cube reachability or claim canonical proof confirmation.

The fixed profile is EN Sunday-first, red weekend headers/dates, no printed year,
three separate uppercase month letters at columns 5–7 in January–September and
columns 1–3 in October–December, every month in 2026–2099, marked overflow, and the
declared orientation-aware artwork equivalences. No layout, color or font rule
is changed for optimization.

## Objective and result

Count a surface as nonblank if its immutable artwork contains a glyph. Minimize
this count across all 294 physical sticker surfaces. The count does not describe
printing background colors, fabrication cost, the number of distinct glyph
designs, or the number of moves between displays.

Every distinct oriented artwork class needs enough fixed physical copies for
its largest simultaneous demand. Summing the nonblank requirements over the
13 disjoint sticker orbits gives a **240-surface lower bound**. A 294-row printing
with exactly 240 nonblank and 54 blank surfaces attains it in the checked
coupled-front model. Conditional on successful complete legal-state validation,
this would also certify minimum nonblank printing under the fixed profile.

| Component | Baseline nonblank | Optimized nonblank | Optimized blank |
|---|---:|---:|---:|
| Corners | 21 | 20 | 4 |
| Midges | 21 | 18 | 6 |
| Inner-distance wings | 43 | 43 | 5 |
| Outer-distance wings | 40 | 34 | 14 |
| Movable centers | 119 | 119 | 25 |
| Fixed centers | 6 | 6 | 0 |
| **Total** | **250** | **240** | **54** |

This removes ten unnecessary nonblank copies, a 4% reduction from the assembled
baseline. That baseline combines the original saved corner/midge/outer-wing
models, the existing constructive inner-wing pairing, and the same minimum
center inventories. It is a front-matching baseline, not a previous legal SAT
certificate.

The 54 blank surfaces are not all freely reusable: calendar targets require
blanks and physical coupling can constrain which copies must remain blank.
Per-orbit necessary blank maxima sum to 17, leaving a separate aggregate
inventory slack of 37 surfaces, but this is not a guarantee that arbitrary 37
blank stickers may be repainted.

## Fixed print format

`minimum-print.tsv` has one header and exactly 294 rows:

```text
component piece face orbit-x orbit-y text quarter-turn ink
```

Fields are tab-separated; empty text is a blank. Piece and face numbers are
one-based. Corners have eight pieces with three faces; midges have twelve with
two; each wing distance has 24 with two. Wing face 1 is the negative-second-
coordinate orbit and face 2 the positive counterpart. Each movable-center
component has 24 pieces with one face; `core` has six.

The tuple `(text, quarter-turn, ink)` is canonical artwork at the lexicographic
front orbit reference `(orbit-x, orbit-y, 3)`, normal `(0,0,1)`. Its up vector is
the reference up `(0,1,0)` rotated counterclockwise by that many quarter-turns.
Some canonical strings reverse glyph order or use 6 in place of 9 because the
declared optical normal form permits it. The tuple is not an instruction to
change ink, glyphs or sticker identity at runtime.

The file specifies component-local piece identity and complete immutable sticker
assignments. A full physical witness must additionally embed each piece and
face into home coordinates/normals, transport its fixed print-up direction,
and supply independently replayed legal target states.

## Generation and validation

`optimize.jl` obtains minimum front-matching models through the existing native
Z3 C API wrapper. Solver runs for corners, midges and outer wings took about
41.24 s, 1.07 s and 31.96 s in this session. No production dependency was added.
The inner-wing model is the earlier independently constructed candidate.
Movable-center and core inventories are filled with exactly the required
nonblank artwork and remaining blank surfaces.

`assemble_and_check.jl` reads the saved printing without solver assignment
variables. It reconstructs the target requirements and checks:

- exactly 294 distinct component/piece/face records and the correct orbit sizes;
- every coupled corner/midge/wing front has an injective piece matching;
- every center inventory covers its actual target demand;
- every required nonblank class has exactly its minimum number of copies;
- the resulting total is 240 nonblank / 54 blank.

Seven native Julia mutation controls reject missing rows, duplicate identities,
repainted glyphs, wrong orientation, wrong ink, invalid center identity, and wrong
orbit. These are research-local checks; an independent Flix check and complete
legal physical replay remain separate requirements.

## Reproduce

From the repository root, using Julia 1.13.3:

```sh
julia --startup-file=no research/calendar-7x7/en-print-optimization/optimize.jl
julia --startup-file=no research/calendar-7x7/en-print-optimization/assemble_and_check.jl
julia --startup-file=no research/calendar-7x7/en-print-optimization/assemble_and_check.jl --assemble-baseline
julia --startup-file=no research/calendar-7x7/en-print-optimization/negative_controls.jl
```

The optimizer requires the already available Z3 4.13.3 shared library at the
path declared in `coupled_synthesis.jl`. The saved-print check uses native Julia
and does not call the solver. SMT inputs are losslessly compressed, with raw and
compressed hashes in the manifest; the optimizer regenerates the raw inputs.
Historical baseline evidence is not modified.
