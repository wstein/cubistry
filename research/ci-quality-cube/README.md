# CI Quality Cube: fixed-print 2×2 research

Evidence status: **UNKNOWN** until the generated witnesses and finite checks have
been independently executed and reviewed. This is research, not an application
change or an accepted replacement for the existing Status Cube.

## Question and physical assumptions

One fixed 2×2 print must show four upright category tiles at the front:
Build / Test / Analyze / Review in row-major order. The baseline has four states:
open, running, OK, and error, giving **16 distinct tile artworks and 256 requested
combined displays**. The priority extension adds blocked, giving **20 distinct
tile artworks and 625 requested combined displays**. Blocked means a prerequisite
prevents work; error means an attempted check failed. Each artwork includes its category, status word,
and icon. The agreed running icon is a circular arrow. Color supplements text;
it does not replace text. Artwork rendering and final print typography are outside
this mathematical experiment.

Every sticker has a permanent identity, source normal, source up vector, and
artwork reference. Only the 18 outer-face moves R/L/U/D/F/B, their inverses and
half turns are permitted. HTM counts a half turn once; QTM counts it twice.
Whole-cube rotations are not free operations. Front-up is exact, including for
apparently symmetric icons, because the printed words are asymmetric.

The construction assigns two of the eight corner bodies to each category. Their
six physical stickers provide candidate positions for the four state artworks.
This prevents two categories from demanding different stickers on the same body
at the same time. It is a construction hypothesis, not by itself a reachability
proof.

Compare these explicitly different print restrictions:

- **Four unique + two neutral:** four distinct category/state tiles on each
  category's body pair and two neutral stickers; 16 labeled and eight neutral
  stickers in total.
- **Six labeled:** all six stickers on each category pair carry one of its four
  state artworks, allowing repeated artwork but never repeated physical IDs.
  This still has 16 distinct artworks and 256 logical displays. It may make
  nearer physical representations available.

For the five-state variant compare five unique + one neutral sticker per category
pair against six labeled stickers (one repeated state). There are 20 distinct
artworks either way; extra copies never create new logical states. Candidate
comparison must not confuse the number of artworks with the number of displays.

## Transition objective

First optimize single-category changes, leaving the other three displayed
results unchanged. Directed logical edges are open→running, running→OK,
running→error, error→running, OK→running, open→error, and reset from any non-open
state to open. Duplicate edges are removed. Categories and directed edges receive
equal weight; no observed production event frequencies are assumed.

The blocked extension additionally considers open→blocked, running→blocked,
blocked→running, and blocked→open. Directed duplicates are removed.

Rank candidates by maximum HTM first, then arithmetic mean HTM. Report arbitrary
multi-category jumps separately. Preserve an actual complete physical pose
through every saved sequence; setup words and hidden back-corner arrangements
must not silently reset between transitions.

## Finite model and planned checks

The Julia model uses the 24 proper rigid corner poses and the canonical 18-move
action. Four labeled tracked corners have 8P4 × 3⁴ = 136,080 partial poses.
Tracking four corners does not quotient global cube rotations. A fixed front
display leaves four back bodies, hence 4! × 3³ = 648 possible physical
completions, subject to independently checking the orientation convention.

The pose coordinates use M = R_position C^twist, where C cycles the three axes
around (1,1,1). A move updates twist by a position-dependent additive offset.
Subtracting a constant target twist from each tracked corner commutes with all
moves. If executable checks confirm this, one BFS to the canonical front target
can supply exact distances to every fixed four-sticker target, without solving
256 separate full-cube problems.

The generator and reviewer must check rank/unrank bijection, all legal transition
edges, inverse restoration, complete BFS coverage, distance recurrence, saved
legal paths, all 256 upright displays, immutable IDs, and comparison with the
existing pinned Cubistry mechanics. An upper-bound policy that preserves the
three unchanged physical front stickers must be distinguished from a globally
shortest route that may replace them with equal-artwork copies.

No universal five-move bound, global print-layout optimality, or SAT conclusion is
claimed in advance. New proof code uses Julia, not Python. The JSON dependency
and lock follow the already pinned independent Julia checker setup; they do not
reuse its verifier implementation.

Baseline research commit: `7c05d28e97ecf30848220f5c70cb3100a4f3628d`.
Canonical application mechanics for cross-checking must be supplied as an
explicit pinned checkout, not silently followed from a mutable branch.
