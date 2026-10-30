# R1 findings and remaining scope

## Evidence boundary

The saved finite words use the unchanged PR #99 printing. Each source is a
legally established complete physical state from its original word DAG. The
finite transition is practical; initialization into that particular source
state is **still existence-only**. These are three separately initialized
examples, not three consecutive edges of one continuously executable calendar.

The selected cases are nonleap February → March transitions with different
weekday alignments. They are deliberately favorable cases. Move statistics
for them must not be extrapolated to all 887 chronological edges.

| Source month | Destination | Canonical source ID | Verified HTM | QTM | Rotations |
|---|---|---:|---:|---:|---:|
| February 2026 | March 2026 | 2 | 48 | 50 | 0 |
| February 2029 | March 2029 | 38 | 57 | 60 | 0 |
| February 2030 | March 2030 | 50 | 62 | 66 | 0 |

All three raw words are independently accepted by native Julia and native Flix,
with byte-identical source/endpoint digests and metrics. Their receipts are
`evidence/julia-YEAR.tsv` and `evidence/flix-YEAR.tsv`. The earlier 50-HTM
candidate is separately accepted by both and retained as historical input.
The independent review records exact commands, code revisions and findings.

For the **three selected verified words**, minimum = 48, median = 57,
maximum = 62, mean = 167/3 ≈ 55.67 HTM. The nearest-rank 90th, 95th and 99th
percentiles are all 62. The frequency distribution is 48:1, 57:1, 62:1. Total
HTM is 167; total QTM is 176. These are sequence lengths, not lower bounds.

## Construction and optimization experiments

The prototype enumerates legal eight-quarter-turn commutators of the form
`a b a^-1 c a b^-1 a^-1 c^-1`. It keeps words whose physical action affects
exactly one chosen cubie orbit. Conjugation by legal setup turns produces
1,008 corner actions and 4,048 actions for each of the two wing orbits.
Every catalog entry is checked against its complete legal permutation;
untargeted orbits must be fixed, not merely look unchanged on the front.

For each front slot, allowed source poses are determined from immutable
rigid-cubie artwork, ink and orientation. Greedy search selects macros improving
the count of satisfied front constraints. If corner search stalls, a bounded
two-macro search attempts to escape the plateau. This enabled the Friday-start
2030 case. Search failure is UNKNOWN, never an impossibility result.

This is staged construction with reusable macros and interchangeable physical
representatives, followed by sequence cancellation and half-turn consolidation.
It does not solve a predetermined canonical destination permutation. Hidden
pieces and all resulting orientations are retained in the endpoint digest.
The three cases reach different physical March states from the prior canonical
March witnesses, which is allowed and is an essential optimization freedom.

| Approach | Observed outcome | Interpretation |
|---|---|---|
| Prior generic group-word construction | Approximately 10¹¹¹ expanded leaves | Legal existence proof; unusable for practical playback; no expansion attempted |
| Initial sparse-macro prototype | 50 HTM for February 2026 | Saved and independently replayed finite word; initial catalog traversal was not deterministic |
| Deterministic macro selection and normalization | 48 HTM for the same transition | Byte-reproducible emitted word, including two half turns |
| Monotonic single-macro search for Friday-start February | Plateau at three of four corner slots | Experimental algorithm limitation |
| Bounded two-macro corner escape | 62 HTM for February 2030 | Broader support; no completeness or optimality claim |

The first deterministic 2026 experiment reported approximately 1.29 seconds to
load the DAG, 0.87 seconds for catalog construction and 1.36 seconds for search
inside the Julia process. These are single-run, JIT- and cache-dependent stage
timings, not a comparative performance study. The original Flix 50-HTM replay
took approximately 5.1 seconds including source DAG evaluation. Exact commands,
versions and later independent run receipts are preserved for reproduction.
The host is x86-64, exposing five virtual CPUs identified as AMD EPYC 9V74.

## Broader experiment and gaps

[`domain-transitions.tsv`](evidence/domain-transitions.tsv) surveys all 887
chronological edges. It includes 73 December-to-January edges and 18 leap
February-to-March edges. Changed front artwork counts range from 6 to 41,
with median 36. **These are not move counts or move-count lower bounds.**

There are 56 nonleap February-to-March edges sharing the weekday grid. The
bounded [same-grid experiment](solver_same_grid.jl) produces 25 candidates
across three source templates, and leaves 31 UNKNOWN because unsupported
physical orbits change. The candidate-only HTM distribution is 9×48, 8×57,
8×62, with mean 55.36 and median 57. This is an experimental subset result,
not independent native confirmation of all 25 raw date-specific inputs.
The [candidate survey](evidence/same-grid-candidates.tsv) intentionally retains
its CANDIDATE/UNKNOWN labels. Three representative words are saved here; the
other generated words can be regenerated into a temporary directory.

Current limitations:

- Only corners and the two wing orbits have constructive macro support. Midges,
  movable centers, core orientations and marked-overflow changes need further
  work. The solver checks the complete destination front and fails if its
  limited orbit coverage is insufficient.
- No December–January or leap-February transition has a practical witness here.
- Practical initialization and compatible physical endpoints across consecutive
  month transitions remain unresolved. Equivalent displayed fronts do not make
  different physical endpoints interchangeable in a chain.
- A systematic benchmark against alternative staged solvers, heuristic search
  and intermediate-state selection is still needed. Current data supports this
  constructive approach, not a claim that it is best.
- No global minimum, all-month 100-HTM guarantee, changed artwork/font profile,
  printable artwork certification or runtime integration is established.

## Roadmap

R2 should add executable macros for remaining piece orbits and orientation
constraints, then carry actual endpoints through all 887 chronological edges.
Boundary cases should be promoted early: December–January, leap February,
sixth-week overflow and the October header relocation.

R3 should select among physically equivalent month states across neighboring
edges, optimizing the maximum edge first and total length second. Beam search,
bounded alternative assignments, macro setup shortening and cancellation can
be compared on identical complete physical starts. Preserve all successful raw
sequences, independent native receipts and explicit timeouts. Keep each follow-up
PR dependent only on the evidence and code it actually requires.
