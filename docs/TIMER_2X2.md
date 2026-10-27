# Fixed-print 2×2 timer: exact capacity in the upright-digit model

**SAT:** one fixed 24-sticker print displays every ten-second tick from **00:00
through 59:50**. This includes the required 15-minute timer. **UNSAT:** extending
contiguous coverage to **60:00** under the model below. The exact maximum starting
duration is therefore **59 minutes 50 seconds**, not a full 60 minutes.

## Scope and assumptions

- A standard 2×2×2 has eight rigid corner cubies, each with three permanent
  single-digit stickers. No sticker changes, overlays, or electronic digits.
- A fixed viewing frame reads minute tens/minute units on the upper row and
  second tens/second units on the lower row. Both fields are zero-padded.
- Settled target displays are all multiples of ten seconds, including zero.
  The seconds-units digit is always zero. A 15-minute countdown starts at 15:00
  and ends at 00:00, with 91 settled displays.
- Each digit has a specified upright print frame, as in the existing counter
  proof. A small orientation mark can distinguish otherwise symmetric ink.
  Rotated glyphs cannot stand in for other digits; optical 180-degree symmetry
  is not used to relax upright matching. The upper bound is scoped to this
  model, not every possible numeral design.
- All six face turns, their inverses, and half turns are allowed. All cubies
  may move; intermediate displays need not be readable. The result proves
  reachability, not shortest paths, turn speed, manual ease of use, or completing
  an animation within ten seconds. Fifteen-second ticks remain untested.

## Constructive lower bound

Use two cubies for minute tens, four for minute units, and two for second tens.
The notation below gives each cubie's three immutable sticker roles and digits;
physical positions, normals, and up vectors are in the witness.

| Cubie | Sticker roles and digits |
| --- | --- |
| 0 | minute tens: 0, 1, 2 |
| 1 | minute tens: 3, 4, 5 |
| 2 | minute units: 0, 1, 2 |
| 3 | minute units: 3, 4, 5 |
| 4 | minute units: 6, 7; second units: 0 |
| 5 | minute units: 8, 9; second units: 0 |
| 6 | second tens: 0, 1, 2 |
| 7 | second tens: 3, 4, 5 |

For any target, its three variable digits occupy three distinct cubies because
those roles have disjoint cubie groups. At most one of cubies 4 and 5 is occupied
by the minute-units digit, leaving a seconds-units zero available on the other.
Thus every target selects four distinct physical cubies.

Each sticker is permanently oriented for its assigned front slot. Complete
corner states fill the four hidden positions and correct total corner twist.
The generator asks `cubing@0.66.1` for legal source-to-target move words. This
construction alone is not the certificate: an independent Python implementation
replays all words on all 24 labeled sticker frames, checks the four upright
digits, and verifies exact inverse restoration.

It also replays all 359 descending transitions from 59:50 to zero. For any two
canonical targets A and B, the inverse of A's source word followed by B's source
word connects them. The 360 forward and inverse checks therefore establish all
129,600 ordered transitions by factorization; they are not described as 129,600
separately replayed paths.

| Covered starting duration | Settled displays down to zero | Result |
| --- | ---: | --- |
| 15:00 | 91 | SAT |
| 19:50 | 120 | SAT |
| 29:50 | 180 | SAT |
| 39:50 | 240 | SAT |
| 49:50 | 300 | SAT |
| 59:50 | 360 | SAT |
| 60:00 | 361 required | UNSAT in this model |

The same print supports every SAT row. No reprinting is needed to extend from
15:00 to 59:50. All 24 sticker surfaces are assigned in this maximum-capacity
construction; capacity is a coverage result, not a claim of unused surfaces or
optimal print utilization for a shorter timer.

## Independently checkable upper bound

For a sticker at corner position `p`, with outward normal `n` and print-up vector
`u`, proper rigid rotations preserve both scalar invariants

```text
vertical = dot(p, u)
horizontal = dot(p, cross(u, n))
```

In an upright front display, `u = (0,1,0)` and `n = (0,0,1)`, so these become
`p.y` and `p.x`. The four front positions have four different sign pairs. Hence
a fixed, strictly upright sticker can serve exactly one of the four slots,
regardless of the sequence of legal moves. Equal digit identities at different
slots require different physical stickers.

Coverage through 60:00 requires at least seven minute-tens digits (0–6), ten
minute-units digits (0–9), and six second-tens digits (0–5): **23 variable-role
stickers**. Let `q` be the number of stickers that can show an upright zero in
the seconds-units slot.

- `q = 0`: even 00:00 cannot be displayed.
- `q = 1`: that sticker's cubie must occupy the seconds-units position in every
  settled display. Its other two stickers cannot serve another front position.
  The budget needs at least `23 + 1 + 2 = 26` surfaces.
- `q >= 2`: the variable stickers and the zero copies already require
  `23 + q >= 25` surfaces.

Both nonzero cases exceed 24. This is a proof for all fixed assignments in the
stated upright model, not merely failure of the proposed assignment. The Python
checker verifies the four invariant signatures and the integer-budget cases for
all feasible `q` from 1 through 24. Extra duplicate variable digits only increase
the required budget. Any larger contiguous range includes 60:00 and is excluded.

## Evidence and reproduction

Artifacts are under [research/timer-2x2](../research/timer-2x2/manifest.json):
[fixed print and 360 move words](../research/timer-2x2/witness.json),
[independent checker](../research/timer-2x2/verify.py),
[verification output](../research/timer-2x2/verification.json), and
[negative-control tests](../research/timer-2x2/test_verify.py).

From the repository root, verification uses only Python's standard library:

```sh
python3 research/timer-2x2/verify.py
python3 -m unittest discover -s research/timer-2x2 -p 'test_*.py'
```

To regenerate a separate candidate with Node 24+ and the frozen solver lockfile:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix research/timer-2x2
node research/timer-2x2/generate.mjs /tmp/timer-2x2-candidate.json
python3 research/timer-2x2/verify.py /tmp/timer-2x2-candidate.json
```

The solver may choose different legal move words on another run. Preserve the
committed certificate; compare coverage and independent replay rather than
assuming byte-identical solver output. The manifest records baseline commits,
input/output hashes, versions, commands, timing, and model boundaries. Existing
5×5 and counter certificates were not overwritten. This result does not extend
the 5×5 calendar proofs or implement a timer application.
