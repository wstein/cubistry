# Fixed-print 2×2 counter feasibility

Issue [#18](https://github.com/wstein/cubistry/issues/18) is evaluated before the
interactive implementation. The numeric range is 0–99, the lower two front
stickers show the digits, and the upper two show a once-configured arbitrary
two-fragment title. Every completed target is upright in the same world frame.

| Numeric printing | Title condition | Verdict |
| --- | --- | --- |
| 00–99 | Same images, movable/repeated title cubies | **SAT** |
| 0–99, blank tens below 10 | Same images, movable/repeated title cubies | **SAT** |
| Either numeric printing | Same two upper cubies never move | **UNSAT** |
| Either numeric printing | Same two upper cubies must occupy top at every target | **UNSAT** |

The two numeric formats are **different fixed prints**, not a display-time
replacement of the same sticker. The title fragments are duplicated twice on
physical stickers. They may separate or turn during animations and are restored
at every completed display. A UI overlay is not used to replace the title.
Removing title constraints for an optional external overlay is a weaker target
already covered by these legal states, but that is not the implemented design.
The empty-upper-sticker fallback is not investigated because the text succeeds.

## Construction and exact legal evidence

Split the eight corner cubies into two groups of four. Each corner has three
physical faces. The first group carries the tens digits and two left-title
copies; the other carries units and two right-title copies:

```text
T0 = [left title, 0, 1]   U0 = [right title, 0, 1]
T1 = [left title, 2, 3]   U1 = [right title, 2, 3]
T2 = [4, 5, 6]           U2 = [4, 5, 6]
T3 = [7, 8, 9]           U3 = [7, 8, 9]
```

For every digit pair, the tens and units select one cubie in their respective
group. Each group has another cubie carrying its title, so the four visible
positions can always use four distinct physical cubies. Print-up vectors are
fixed per source sticker using a proper rigid rotation into its assigned front
position. All 24 sticker identities and frames are in
[`public/counter-proof.json`](../public/counter-proof.json).
The unpadded design permanently replaces the tens-zero sticker with a blank.

This argument motivates a candidate; it is not itself the reachability claim.
The generator maps actual corner positions/orientations into the existing
`cubing` 0.66.1 KPuzzle model, completes each target with hidden corners, and
uses `experimentalSolve2x2x2` to obtain a legal word. The solver uses U,F,L,R,
not the three-face generator set that would immobilize one corner. Each returned
word is checked against the **exact solved frame**, not only modulo rotation.
The inverse words produce 100 complete target states.

The separate Python standard-library checker imports no generator or solver.
It independently rebuilds the geometry and replays R,L,U,D,F,B layer turns on
24 individually labeled sticker positions, normals, and print-up vectors. It
checks both fixed prints, all 100 displayed values, and a negative control that
rotates an actual title sticker. Every goal word and inverse returns to the
same complete source state. Thus `inverse(word[A]) + word[B]` is legal for
**all 10,000 ordered transitions**, including A=B. Eight hundred sequential
transitions are additionally replayed without resetting state. No claim of
shortest paths to a display or shortest arbitrary transitions is made.

The stronger fixed-cubie condition is impossible independently of solver choice:
the two immovable upper cubies cannot supply any of their six stickers to the
lower target positions. The other six corners have only 18 sticker faces.
Padded digits require two distinct physical copies of each digit because dd
must be possible: 20 faces. Unpadded digits require two copies of 1–9, one zero,
and one blank: also 20. Therefore 20>18. This remains true if the same upper
cubies may move temporarily but must return at every target.

## Reproduction and limits

```sh
npm ci --cache /tmp/cubistry-npm-cache
node research/counter/generate.mjs
python3 research/counter/verify.py
```

The committed [independent result](../research/counter/verification.json) and
[manifest](../research/counter/manifest.json) record hashes and versions. No
traditional cube colors are assumed: these are actual immutable custom images.
Glyph recognition is symbolic here; the browser renderer must preserve the
same source frames and use the same move replayer. Title artwork is instantiated
once per print configuration, including both copies; changing the configuration
creates a new print rather than changing stickers during counting.

The solver is an existing independent implementation, not a new optimal solver.
Its API is experimental and pinned. The app uses the small verified words,
not a runtime solver or a full state lookup table. Re-generating words can
change hidden states or paths; the independent checker must be rerun. The
physical evidence concerns each word and its actual print, not a screenshot.
