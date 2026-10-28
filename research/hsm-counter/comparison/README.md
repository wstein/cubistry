# Retained H/S/M candidate comparison

All totals include the final wrap to 00 and exclude initial setup. HTM counts a half turn as one move. Each row is one actual full-pose replay, starting from the candidate’s saved 00 state.

A 00–23–00 pass has 24 transitions; 00–11–00 has 12; 00–59–00 has 60. Reverse replay has identical total cost.

All three retained complete candidates are included. The initial candidate predates the 11→00 objective, the intermediate candidate used 512 combined-objective proposals, and the final candidate used 4,096. Unretained random proposals are not separate verified layouts.

| Candidate | Letter | Max increment | 00–23–00 total / mean | 23→00 | 00–11–00 total / mean | 11→00 | 00–59–00 total / mean | 59→00 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| initial | H | 4 | 78 / 3.2500 | 2 | 40 / 3.3333 | 2 | 197 / 3.2833 | 2 |
| initial | S | 4 | 78 / 3.2500 | 2 | 40 / 3.3333 | 3 | 198 / 3.3000 | 3 |
| initial | M | 4 | 80 / 3.3333 | 2 | 38 / 3.1667 | 3 | 196 / 3.2667 | 3 |
| intermediate | H | 4 | 76 / 3.1667 | 2 | 38 / 3.1667 | 3 | 185 / 3.0833 | 2 |
| intermediate | S | 4 | 77 / 3.2083 | 3 | 37 / 3.0833 | 3 | 188 / 3.1333 | 3 |
| intermediate | M | 4 | 75 / 3.1250 | 3 | 37 / 3.0833 | 3 | 190 / 3.1667 | 3 |
| final | H | 4 | 81 / 3.3750 | 3 | 39 / 3.2500 | 2 | 195 / 3.2500 | 3 |
| final | S | 4 | 80 / 3.3333 | 3 | 40 / 3.3333 | 2 | 197 / 3.2833 | 3 |
| final | M | 4 | 80 / 3.3333 | 3 | 37 / 3.0833 | 2 | 202 / 3.3667 | 3 |

## Equal-weight summary across H, S, and M

The total column sums three passes, one per letter. The mean divides by 72, 36, or 180 transitions respectively; it is not a single-letter cycle total.

| Candidate | 3 × 00–23–00 total / mean | 3 × 00–11–00 total / mean | 3 × 00–59–00 total / mean |
| --- | ---: | ---: | ---: |
| initial | 236 / 3.2778 | 118 / 3.2778 | 591 / 3.2833 |
| intermediate | 228 / 3.1667 | 112 / 3.1111 | 563 / 3.1278 |
| final | 241 / 3.3472 | 116 / 3.2222 | 594 / 3.3000 |

These are single visible cycles. The wrap may leave a different hidden-corner pose from the initial 00; an application must replan subsequent cycles. No indefinitely repeatable cost or global layout optimality is asserted.

Full reset words, exact unrounded means, source hashes, and hidden-pose flags are in [results.json](results.json). See [manifest.json](manifest.json) for provenance and reproduction.
