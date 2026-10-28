# Independent H/S/M counter proof review

Verdict: **SAT** for one fixed, upright, 24-sticker 2×2×2 print with all 180
combinations of H/S/M and 00–59. The front frame is fixed: upper-right letter,
lower-left tens, lower-right units. Upper-left is unconstrained. Only the 18
outer-face moves R/L/U/D/F/B with quarter, inverse-quarter, and half turns are
allowed; each is one HTM. Glyphs are immutable and remain on rigid corner bodies.
This is a settled-display claim; intermediate animation frames need not display
the letter or number correctly.

Reviewed witness SHA-256:
`7ec93660867a367ad79d7af28acb2b0f1035450bcac76d0c1afaa7bcdac93cd5`.
The checker imports no generator, solver, JavaScript, or project geometry. Its
integer Rodrigues rotation engine retains all sticker identities, physical
positions, outward normals, and print-up vectors through every move.

## Independently checked results

| Letter | Increment edges | Total HTM | Maximum HTM | 23→00 HTM | 11→00 HTM | Setup HTM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| H | 59 | 192 | 4 | 3 | 2 | 4 |
| S | 59 | 194 | 4 | 3 | 2 | 5 |
| M | 59 | 199 | 4 | 3 | 2 | 4 |

All 180 settled displays, 177 forward edges, 177 inverse decrement edges, and
three 23→00 and three 11→00 transitions pass independent physical replay. Every forward word's
inverse restores the complete prior 24-sticker state. The complete reverse
traversals and setup inverses also restore exact full states.

An independently rebuilt three-sticker breadth-first graph has 9,072 reachable
states with distance histogram `0:1, 1:15, 2:177, 3:1397, 4:4981, 5:2497, 6:4`.
This graph ignores hidden-corner poses, as required for shortest paths to a
partial front display. For each actual reached source state the checker
enumerates every matching upright sticker selection, excludes repeated corner
bodies, and checks the minimum graph distance against the saved word length.
All 177 forward edges, three setups, and all six reset words are shortest for
their respective source states and the fixed print.

The inverse decrement route has the same maximum and total lengths. Its
shortest path to *any* partial display is not asserted: duplicate digits may
allow a different target full state. Global print optimality and global
traversal optimality remain **UNKNOWN**. The bounded generator's search is not
an exhaustive proof of either stronger optimization claim.

The disjoint corner-group construction is consistent: two corners provide
tens 0–5, four provide units 0–9 with duplicates, one provides H/S/M, and the
remaining corner provides spare digits. Thus the three requested visible
stickers can always be selected from distinct corner groups. Capacity alone
is not used as a reachability proof; the legal-move witnesses establish it.

## Reproduction

From the Research branch root, using standard-library Python 3:

```sh
python3 research/hsm-counter/verify.py research/hsm-counter/witness.json
python3 -m unittest discover -s research/hsm-counter -p 'test_*.py' -v
```

Both commands pass. The unittest suite runs a valid-witness test and 18
negative controls, including missing/duplicate physical identities, invalid
frames, missing/reprinted glyphs, missing displays, illegal moves, wrong
settled states, incorrect resets, incorrect aggregate metrics, an incorrect
graph size, and legal but padded nonshortest resets of both types. All corruptions are
rejected. The structured acceptance result is [verification.json](verification.json).

No blocking proof findings remain under the stated model. No application,
browser timing, physical print production, or device performance claim is
included in this review. Review follows the project's independent
`proof-review` workflow, read from `.agents/skills/proof-review/SKILL.md` in
the implementation worktree; that instruction file is not present on this
historical Research branch.
