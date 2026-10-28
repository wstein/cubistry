# H/S/M counter: 00–59 with short resets

## Claim and result

**SAT**: one fixed 2×2×2 print supports all 180 combinations of H, S, or M
and the integers 00 through 59, including leading zeros. The front frame is
fixed: upper-right is the letter, lower-left is the tens digit, lower-right is
the units digit, and upper-left is unconstrained. All three required glyphs
are upright. There are 24 immutable stickers on eight rigid corners, with no
optical aliases, replacement stickers, or whole-cube reorientation shortcuts.

The user confirmed these positions and all 180 combinations, and subsequently
added the request for a short 11→00 transition alongside 23→00.

| Property | Independently checked final witness |
| --- | --- |
| Coverage | 3 letters × 60 numbers = 180 displays |
| Increment route | 177 edges, maximum 4 HTM |
| Decrement route | Exact inverse traversal, maximum 4 HTM |
| Increment total | 585 HTM; mean 3.3051 per edge |
| 23→00 | 3 HTM for each letter |
| 11→00 | 2 HTM for each letter |
| Initial setup | H: 4, S: 5, M: 4 HTM; excluded from edge totals |

HTM counts each outer face turn, including a half turn, as one move.
All 18 generators R/L/U/D/F/B with quarter, inverse quarter, and half turns
are allowed. If counting quarter turns instead, either reset still uses at
most four moves.

The final reset words, starting from their corresponding reached counting
states, are:

| Letter | 23→00 | 11→00 | 00→59 route total |
| --- | --- | --- | --- |
| H | `L B2 D` | `L' D2` | 192 HTM |
| S | `D2 L' D` | `B2 D2` | 194 HTM |
| M | `B L' D` | `L2 D2` | 199 HTM |

An earlier candidate had two-move 23→00 resets before the 11→00 requirement
was added. The table above describes the final combined-objective print;
it does not combine measurements from different layouts.

## Constructive proof and independent validation

The starting construction dedicates two corners to six tens glyphs, four
corners to ten units glyphs plus duplicates, and one corner to H/S/M. The
eighth corner supplies additional tens glyphs. These groups supply distinct
physical corners for every required triple. This allocation is a construction
idea, not sufficient proof by itself.

The generator builds the legal three-corner orientation graph and chooses
shortest routes to matching displays. A separate Python checker uses integer
Rodrigues rotations and imports no generator, JavaScript, solver, or project
geometry. It validates the complete physical print and replays all 24 sticker
frames through every setup, increment, inverse decrement, and both reset types.
It also reconstructs the 9,072-state graph independently and verifies that the
saved forward steps, setups, and resets are shortest from their actual source
poses to any matching target display for this print.

The 9,072 states equal 8×7×6 distinct ordered corner positions times 3³ corner
orientations. Their graph has maximum distance six to a fixed oriented target
triple. Thus the model also permits replanning to any required display from
any legal pose in at most six HTM; the stronger four-, three-, and two-move
figures above refer to the saved witness paths. They are not promises for
arbitrary transitions following a reset or letter change.

## Reproduce

Run from the repository root with Node.js 24 and Python 3. No npm packages or
network access are needed:

```sh
node research/hsm-counter/generate.mjs /tmp/hsm-counter-new.json
python3 research/hsm-counter/verify.py research/hsm-counter/witness.json
python3 research/hsm-counter/test_verify.py
```

The output path for generation must not already exist. The seed is 281028;
the bounded search evaluates 4,096 proposals. The objective first minimizes
the maximum edge/reset cost, then the worst reset, then their summed maxima,
and finally the total forward route cost. The manifest records source and
evidence hashes. Reproduction produces identical witness content after removing
the measured `runtimeSeconds` field.

See [witness.json](witness.json), [manifest.json](manifest.json),
[verification.json](verification.json), and the independent [review](REVIEW.md).

## Limits

Global print and whole-route move optimality are **UNKNOWN**. The reverse
traversal is validated and has the same cost as the forward traversal, but
individual reverse paths are not claimed shortest to a partial display.
Reset words apply to the saved reached source states. Their destination has
the required 00 display but need not reproduce the original hidden pose;
an application must retain the full pose and replan subsequent moves.
The free upper-left sticker can show an arbitrary glyph. No blank requirement,
font artwork, physical timing guarantee, or application implementation is
included in this mathematical result. No deployment or feature branch changed.
