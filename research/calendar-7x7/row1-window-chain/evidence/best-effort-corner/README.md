<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# February/Sunday/28 on print B: wrong cell (7,1) or (7,7)

Research result, not certified; independent review is pending. Print B is `../print-b` (printing-S2 with April tiles AP and RIL).
The three failing Februaries 2026-02, 2037-02 and 2043-02 have one board. Every legal state of the print shows at least one wrong cell
(Hall set X = {(7,1),(7,7)}, deficiency 1, `../month-list/february_hall.jl`; the witness is verified by all three chain checkers here).

Question: can the one wrong cell be (7,1), not only (7,7)? `../month-list/best-effort-chain.tsv` lists 7,7 because `february_hall.jl`
reports the cell that its matching leaves open, not a chosen one. Earlier evidence for (7,1) was a relaxed front matching
(`../config-coverage/best-effort-feb-sunday-28.tsv`, bodies posed independently, no legal state).

Answer: yes, both. `corner_edge.jl` builds a one-edge chain (root 2026-05 identity pose, list [month], print B, layout of print B)
by replacing cell (R,C) of the month board with the artwork of a corner sticker and solving the modified board with the greedy orbit
solver (legal moves only). Julia `check.jl`, `verify_chain.jl` and the Flix chain checker accept every case with verdict
`BEST_EFFORT` and the edge line `BEST_EFFORT 1 R,C`; Julia and Flix receipts are byte-identical. Directories `MONTH-71` and `MONTH-77`
(wrong cell (7,1) / (7,7)) hold `moves.tsv`, `states/`, `julia.tsv`, `flix.tsv`, `independent.tsv`.

Cost (`costs.tsv`, greedy solver from the identity pose, not minimal, so only an upper bound): (7,1) has nine replacement artworks,
436 to 443 HTM (stored case: `24 red`, 436 HTM, 446 QTM); (7,7) has one, `29 red`, 443 HTM, 456 QTM. Differences of a few HTM lie
within the solver's variance. The cost from the real predecessor month is not computed (no chain through these months exists).

Reproduction (from `research/calendar-7x7`): `julia --startup-file=no --threads=4 row1-window-chain/evidence/best-effort-corner/corner_edge.jl OUT
$P/layout.tsv $P/printing.tsv 2037-02 7 1 cand=3` with `P=row1-window-chain/evidence/print-b`. `julia test_corner_choice.jl` (about 1 minute)
replays the checkers, compares receipts, rejects a wrong listed cell and re-runs the producer. The Flix receipts are stored, not re-run there.
Not decided here: which corner the chain uses (owner), the tie rule (shortest sequence from the predecessor).
