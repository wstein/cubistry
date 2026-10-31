# Exact-frame jump planning

Issue #44's eight observations reproduce exactly on the certified canonical
states: 11, 15, 13, 14, 15, 12, 13 and 13 HTM. Preview/session counts were honest;
there was no animation duplication or metric mismatch. The pinned provider
computes an optimal rotation-quotient route of 9, 9, 9, 10, 9, 8, 9 and 9 HTM,
then appends 2–6 physical face turns to restore the exact printed frame. Its
`exactPhysical` result explicitly does not guarantee optimality.

The familiar 11-HTM bound describes the rotation-quotiented ordinary 2×2 puzzle;
it is not an automatic guarantee about shortest paths between every fixed,
image-oriented physical frame. Nevertheless, the reported 06→16→06 endpoints
are exact inverses: reversing the outbound path already proves the old 15-turn
return nonoptimal. The fixtures pin all eight full states, print identities,
raw words, quotient/correction counts and selected words in
[arbitrary-jumps.json](../tests/fixtures/arbitrary-jumps.json).

For certified arbitrary jumps, the consumer now asks the same pinned solver in
24 proper virtual coordinate frames, in both directions, maps each candidate
back to original physical face names, combines commuting opposite-face blocks,
and deterministically selects the shortest actual HTM candidate. Every candidate
is replayed through shared Cubistry mechanics against the exact original full
target. These coordinate transformations are calculation only: zero setup or
regrip moves are executed or omitted from accounting. There is no new solver,
search table, changed target state or protected research change.

Selected counts for the reported rows are **9, 9, 9, 10, 9, 8, 9 and 9 HTM**.
An independent Python engine verifies both raw and selected words, inverses,
all sticker identities and orientation frames. These bounded fixture results
are not a universal exactPhysical optimality or eleven-turn guarantee.

The [blank-top print variant](COUNTER_BLANK_TOP.md) uses the same planner and
solver adapter with its own canonical states and blank-top display targets. The
fixture counts above were measured on the titled print only.
The original print retains its existing provider route; certified adjacent
moves retain the unchanged 339-HTM traversal, 99 edges and maximum five per edge.
