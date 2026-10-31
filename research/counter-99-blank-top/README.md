# 00-99 counter with a blank top row (2x2x2, fixed frame, HTM)

**Status:** one permanent 24-sticker print (20 upright digit stickers, 4 blank stickers)
supports two counting modes. Both native checkers (Julia and Flix) accept it and their receipts
match byte for byte. **The target "at most 3 HTM on every edge" is NOT reached:** the best
checker-accepted print has a maximum of **4 HTM**. Max 3 is **UNKNOWN**, both for this print
and over all prints. A search-side Julia computation, which no checker has confirmed, finds no max-3
cycle for this print (see below). The only checker-backed fact here is that this route's
4-move edges are at least as long as the exact distance both checkers recompute; for example, LZ 99->00 has exact distance 4.

| Mode | Edges | Max HTM | Edges at 1 / 2 / 3 / 4 | Total HTM | Mean | Setup from printed state |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| LZ (00..99, 99->00) | 100 | 4 | 8 / 9 / 80 / 3 | 278 | 2.78 | none (printed state shows 00) |
| NZ (_0.._9, 10..99, 99->_0) | 100 | 4 | 9 / 13 / 77 / 1 | 270 | 2.70 | `L' U B' U L2 U` (6 HTM) |
| Old titled counter (baseline, 99 edges, no wrap) | 99 | 5 | 6 / 8 / 40 / 28 (+17 at 5) | 339 | 3.424 | `U2 F' L U' R'` |

The baseline row is quoted from `research/counter-2x2-optimization/REPORT.md`, measured by
that folder's JS/Python tooling. It was **not** re-verified with the native checkers here and it has
a different top row: two title fragments instead of blanks, and no 99->00 edge.

Edges at 4 HTM: LZ `00->01`, `06->07`, `99->00`; NZ `_5->_6`. Decrements are the exact inverse
words, so the decrement statistics are identical. The NZ setup word also switches modes: from LZ at 00 to NZ at _0
takes 6 HTM, and the way back is the inverse word. That word is not claimed to be shortest.

## Interpretation (stated assumptions)

- The cube is a 2x2x2 in a fixed frame. The 18 generators are R L U D F B, each as a quarter turn, inverse or half turn,
  and every one counts as 1 HTM. Whole-cube rotations and regrips are not free moves.
- Display = the front face (F, +z), viewed with +y up. Cells: UL (r1c1), UR (r1c2), LL (tens), LR (units).
- **Profile B (primary, required):** UL and UR show a blank sticker in every display.
  - **Mode LZ:** LL shows the tens digit and LR the units digit, both upright, for 00..99.
  - **Mode NZ:** for 0..9, LL also shows a blank and LR shows the digit. From 10 on it works like LZ.
    In displays 0..9, three blanks on three distinct corners are visible at once.
- A digit sticker is upright in exactly one front cell. The proper rotation that brings a sticker to a
  given front cell facing front is unique, and moving between cells rotates the glyph by 90 degrees. Tens and units
  therefore cannot share stickers, so at least 20 digit stickers are needed. With 24 stickers this leaves at most 4
  blanks. NZ needs at least 3 blanks, and two duplicate digits would leave only 2 blanks. The search allowed blank and duplicate-digit
  relabelings (LZ needs at least 2 blanks); the best print found uses 4 blanks and no duplicates.
- Each mode is one closed 100-edge cycle of **full** cube states: the hidden stickers are tracked, and after
  100 increments the cube is back in exactly the starting state, so counting can go on forever.
- **Profile A (optional relaxation, top cells unconstrained):** not searched separately. Every Profile B
  route is also a Profile A route, so the Profile A maximum is at most 4. Search-side cumulative ball sizes
  of the 2-sticker tracked graph (LL and LR only, 504 states) are 1, 13, 114, 396, 504 for radius 0..4; no
  checker computes them. Whether A can reach max 3 or max 2 is UNKNOWN; this is not claimed.

## Files

- `evidence/print.tsv`: the raw print. Each sticker has its position, outward normal, artwork (blank or 0-9) and
  up vector (`-` for blank), in the printed solved state, which shows 00.
- `evidence/routes-lz.tsv`, `evidence/routes-nz.tsv`: 100 edges each. Columns: increment word, HTM, the claimed exact
  shortest distance to *any* state showing the next value, the inverse decrement word, and the decrement's
  shortest distance.
- `evidence/setup-lz.tsv`, `evidence/setup-nz.tsv`: setup words from the printed state.
- `evidence/receipt-{julia,flix}-{lz,nz}.tsv`: checker receipts (identical per mode).
- `evidence/negative-controls.tsv`, `evidence/controls/`: mutated inputs and how they were rejected.
- `evidence/exact-k3.tsv`: search-side max-3 computation for this print (no checker confirms it).
- `julia/check.jl`: native Julia checker. `flix/src/Main.flix` and `flix/build.sh`: native Flix checker
  (Flix 0.79.0 via the repository's flixw scaffolding, Java 21).
- `search/`: Julia generator (word index, layered DP, annealing, exact reach, export). It is not proof
  authority.

## Verification

The two checkers share no code; each replays the moves on its own sticker vectors. Each one:
1. parses the raw print (24 distinct facelets, outward normals, tangent unit up vectors, blank has no up);
2. replays the setup and all 100 increments, rotating every sticker's position, normal and up vector,
   hidden stickers included;
3. at every display, checks that UL and UR are blank, that LL is blank (NZ 0..9) or shows the tens digit upright, and that LR shows the units digit upright;
4. checks that each claimed HTM equals the word length, that each decrement is literally the inverse word and restores
   the exact previous full state, and that the cycle closes on the exact start state;
5. rebuilds the tracked four-front-corner graph by BFS (136,080 states, diameter 7) and computes, for
   every edge and both directions, the exact distance from the actual state to the nearest state
   showing the target. The claimed `*_shortest` column must equal it.

**Independence limitation (common mode):** the Flix checker is a port of the Julia checker. It has the same
check order, the same data model (sticker position, normal and up vectors), the same tracked-graph BFS and the same
messages, written by the same author. The two languages and implementations guard against coding slips, but not against
a rule that was misread in the shared design: such a misreading would most likely show up in both. The following
rules were checked by hand against the repository's existing counter work rather than by a second design:
- clockwise turn convention, v -> (v.n)n - n x v about the outward normal (R carries front to up);
- cell layout: front = +z viewed with +y up, so UL = (-1,1,1), UR = (1,1,1), LL = (-1,-1,1), LR = (1,-1,1);
- upright rule: up vector = +y, blank carries no orientation;
- HTM counting: one move per face turn, half turns included.

The old print's sticker up vectors, read with these conventions, are upright exactly in their declared
slots after its published setup `U2 F' L U' R'`, which shows 00 with title stickers on top. This is a
consistency check of the conventions only. No rule check was made structurally different in Flix.

LZ: 63 of 100 increments and 72 of 100 decrements are shortest to any matching display. NZ: 69 and 70.
The rest are longer on purpose: they keep the hidden state on a repeatable cycle. Words of length up to 5
were allowed, and every used word is at most 4.

Negative controls (both checkers reject each one with the same intended message, see
`evidence/negative-controls.tsv`): wrong glyph, wrong up vector, non-blank sticker in a top cell,
non-blank sticker in the NZ tens cell, wrong route move, claimed distance too small, and a decrement that is not
the inverse word, plus a hidden glyph reprint (units 5 printed as 6) that makes display 05 unreachable.

Reproduce (no Python anywhere):

```sh
JULIA=/path/to/julia research/counter-99-blank-top/evidence/run.sh   # builds the Flix jar via flix/build.sh
```

## Max 3: what is known

Max 3 is **UNKNOWN** for this print and for all prints. The checkers confirm only per-edge exact
distances along the stored route: for example, the LZ 99->00 edge starts from the actual state, and the
nearest state showing 00 is exactly 4 HTM away. A different hidden state at 99 is not covered by that check.

- **This print (search side, not checker-confirmed):** `search/exact_report.jl` enumerates every legal full state
  showing value 0 (LZ 3,888, NZ 15,552). It then propagates the complete set of reachable states with
  words of at most 3 HTM, without a beam. LZ dies at the 99->00 edge: every edge 00->...->99 can
  be done in 3 or fewer, but the computation finds no route that also wraps in 3 or fewer. NZ survives one full lap but dies 40
  edges into the second, so the computation finds no closed (repeatable) max-3 cycle. This rests only on the
  generator code (`search/exact.jl`, `search/c99_reach.jl`); neither native checker covers it, so it
  is not a proof of infeasibility.
- **Over all prints:** UNKNOWN. Search-side cumulative ball sizes of the 4-sticker tracked graph (radius 0..4: 1, 16, 214, 2,244, 17,640 of
  136,080) show that max 3 is a tight target, but no counting bound rules it out. Simulated annealing over
  sticker labels, scored by exact max-3 reach, warm-started from the old print and
  reheated, plateaued at "all edges except 99->00" for LZ. Random restarts did much worse (about 33 layers).
- Two of the three LZ 4-move edges come from closing the cycle (choosing hidden states). The open path
  needs only the 99->00 edge at 4.

## Not established

Max 3 for any print (UNKNOWN, not infeasible); global optimality of the print or the routes; Profile A
bounds beyond inheritance; shortest mode-switch word; physical build, print scaling, or human timing.
