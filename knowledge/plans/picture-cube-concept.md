---
id: PLAN-PICTURE-CUBE-CONCEPT
title: Picture cube support for Cubacle and Cubistry
type: plan
status: draft
created: 2026-10-31
---
# Picture cube support for Cubacle and Cubistry

**Status: research concept, not a decision.** This plan describes an approach. It
does not change an accepted ADR or spec, and it confers no approval. No claim in
this document has been CONFIRMED by both the Flix and the Julia proof checkers
(see [proof-checkers/AUTHORITY.md](../../proof-checkers/AUTHORITY.md)). Every
feasibility, optimality, bound or solver-performance statement below is
therefore **UNKNOWN** unless it says otherwise. Python verifiers play no role in
any of these claims.

## Sources and markers

Snapshot of 2026-10-31. The sources are not all on this branch:

- **Cubacle** `develop` at `9a03c0f`. Paths such as `src/engines/...` and
  `docs/design/...` refer to that repository.
- **Cubistry** branch `research/calendar7-dual-dates` at `c0b37c9`. Paths such
  as `english/...`, `dual-dates/...`, `practical/...`, `minimax/...` and
  `orientation_screen.jl` are relative to `research/calendar-7x7/` on that
  branch. `research/date-3x3/` and `research/hsm-counter/` are also on research
  branches, not on `main`.
- **Orbit64**: [FORMAT.md](https://github.com/wstein/flix-orbit64/blob/main/FORMAT.md)
  (V1) and [FORMAT-V2.md](https://github.com/wstein/flix-orbit64/blob/main/FORMAT-V2.md)
  (V2, draft) in `wstein/flix-orbit64`, read at `8b27fb2`.

Markers:

- **[V]** the statement appears in the named file. This is a citation, not an
  independent check.
- **[A]** our own derivation, not stated in the files. Status UNKNOWN.
- **[L]** literature or a result quoted in the repository. Status as quoted;
  not re-checked here.
- **[–]** looked for and not found.

## Core observation

With the standard color scheme, colors fix the identity and placement of every
corner, midge and wing. A wing key is an ordered color pair (Cubacle
`src/puzzle/relative.rs:87-89` [V]). A picture cube adds exactly two things:

1. the **identity of same-colored movable centers**, and
2. the **Z4 rotation of the fixed centers** on odd cubes.

A movable center has exactly one orientation in a given slot (Cubistry
`english/prepare_physical.jl:59`: one rotation, only the core has four [V]).
Its picture angle therefore follows from (identity, slot). Orbit64 V2 states the
same fact: every wing and non-fixed center has its orientation "determined by
the position alone", and only corners, midges and fixed centers have a point
stabilizer (FORMAT-V2.md, "Pieces and orbits" [V]). Everything else belongs to
the target model (sections "Data model" and "Target model").

## 1. Current state

| Size | Cubacle: modeled | Cubacle: missing | Cubistry |
|---|---|---|---|
| 2×2 | `PocketSolver`, rotation quotient (`docs/design/fixed-frame-proofs.md:67-72` [V]). A **fixed-frame 2×2** with a print (id, cubie, p, n, up, image) and `FrameGoal` (rules `ids`/`image`, optional `up`) is in code on `develop` (`src/engines/two/fixed/goal.rs:1-30`, `src/puzzle/frame/mod.rs` [V]); the design still calls it "planned until merged" (`fixed-frame-proofs.md:12-14` [V]). | `image` is exact string equality only (`fixed-frame-proofs.md:157` [V]): no symmetry, no 6/9 or O/0 equality. | H/S/M counter on the 2×2 with independent checkers (`research/hsm-counter/README.md` [V]). |
| 3×3 | Two-phase on colors; target-set IDA* with internal **identity views** (54-bit mask per position), 24 views for free orientation (`docs/design/dont-care-targets.md:393-405`, `src/engines/three/partial/goal.rs:1-8` [V]). | Center twist: a view is discarded when a center is not "itself", and twist is never checked (`goal.rs:80-87` [V]); explicitly "slice 2" (`dont-care-targets.md:415` [V]). Cubacle's Orbit64 support is V1 only: it carries the frame digit (24) and no center twist (`src/notation/orbit64/coords.rs:4-9` [V]). | `date-3x3`: pure center-correction macros of 18/20/18 HTM (`research/date-3x3/README.md:103-107` [V]); 2048 residual twists, diameter of the full picture cube UNKNOWN (`date-3x3/center-bound-investigation/README.md:5-24` [L]). On `main`, the 3×3 Super Picture Cube solves all six center rotations with a pinned reference provider ([SUPER_PICTURE_CUBE.md](../../docs/SUPER_PICTURE_CUBE.md) [V]); that route makes no optimality claim. |
| 4×4, 5×5 | Reduction (TPR, cube555); wing identity from colors; centers by color only, freely paired (`relative.rs:131-137` [V]); decision "no strict mode" (`notes/Same-colored inner pieces are equal and there is no strict mode.md` [V]); centers-only and mixed-center routes (`dont-care-targets.md:383-389` [V]). | Center identity; 5×5 core twist (follows from facelets = colors, `src/puzzle/facelets.rs:79-93` [A]). | [–] no 4×4/5×5 picture research. |
| 6×6, 7×7 | dwalton reduction, 7×7 mean **189.05 moves** (`docs/design/dwalton-port.md:80` [V]), counted as `moves N`: `Rw` and `2R` count 1 each (`docs/metrics.md:113` [V]); centers-only target. | As 4×4/5×5; no partial targets except `centers`. | 7×7 fully physical: 294 stickers, 218 cubies, home/normal/up/text/ink (`english/replay_legal.jl:24-46` [V]); front comparison by `image_normal` (`replay_legal.jl:66-77` [V]); existence DAG of about 10^111 leaves (`english/README.md` [V]); practical solvers use pure commutators on **one** orbit, and untargeted orbits must stay fixed (`practical/RESULTS.md:34-39` [V]); minimax 358 to 446 HTM per month edge, mean 305.4 (`minimax/verification/README.md:13-14` [V]). |

Weaknesses of the Cubistry solver [V/A]: single-orbit macros only (above); cost
is roughly the sum of orbit costs (ranking by actual HTM, but no admissible
bound, `minimax/SEARCH-POLICY.md:9-18` [V]); no optimality claim. The figure
"about 9 HTM per differing piece" does **not** appear in the files [–]. Order of
magnitude [A]: 6 to 41, median 36 changed front cells per edge
(`practical/RESULTS.md:74-75` [V]) against 358 to 446 HTM, about 10 to 12 HTM per
cell.

**Metric caveat [A].** Cubacle's 189 counts block moves as 1 and applies to
random scrambles. Cubistry counts every non-central single layer as 1 HTM in a
21-generator alphabet (`english/README.md`, section "Legal reachability" [V]).
Comparing 189 with 358 to 446 is meaningless until both are converted to one
metric.

## 2. State tokens: Orbit64 V1 and V2

An earlier draft of this concept proposed carrying the picture refinement in a
V1 token extension. That idea is withdrawn. Orbit64 now has a separate V2 format
with explicit picture models:

- **V1 stays color-based.** A V1 state token is a color state with a whole-cube
  frame ([FORMAT.md](https://github.com/wstein/flix-orbit64/blob/main/FORMAT.md),
  "State" [V]). Nothing in V2 changes what V1 tokens mean (FORMAT-V2.md,
  introduction [V]).
- **V2 is an append-only registry** without V1's class bits. Entries are only
  appended, never removed, reordered or changed (FORMAT-V2.md, "Growth rules"
  [V]). The initial registry holds the `n x n x n` cube for `n = 2..15` in a
  **color** and a **picture** sticker model, each in a **canonical** and a
  **framed** pose variant. The 2×2 picture model equals its color model and is
  not registered separately (FORMAT-V2.md, "The n x n x n cube types" [V]).
- **Picture model** (FORMAT-V2.md, "Sticker models" and "Conventions" [V]): every
  sticker is distinguishable, center pieces are numbered by their home slot, and
  each fixed center records its rotation `r_f` in `0..3` against a per-face
  reference direction. The six rotations take radix `2^11`, since the parity of
  `r_B` is forced (FORMAT-V2.md, "Digit layout", digit 7 [V]).
- **Partial distinguishability**, for example a logo on one center only, is a
  future registry entry, not part of the initial registry (FORMAT-V2.md,
  "Extensions" [V]).

Picture rows of the initial V2 registry, copied from FORMAT-V2.md, "Initial
registry" [V]:

| Cube | Picture canonical (bits, chars) | Picture framed (bits, chars) |
|---|---|---|
| 3×3×3 | 76.23, 13 | 80.81, 14 |
| 4×4×4 | 178.88, 30 | 183.47, 31 |
| 5×5×5 | 311.34, 52 | 315.93, 53 |
| 6×6×6 | 492.03, 83 | 496.62, 83 |
| 7×7×7 | 702.53, 118 | 707.12, 118 |

V2's state counts and parity relations are checked by the Julia program
`tools/format-v2/proof_obligations.jl` in `wstein/flix-orbit64`
(FORMAT-V2.md, "Proof obligations" [V]). That is not one of Cubistry's native
proof checkers, and this plan has not rerun it. V2 is still a draft, and its own
open items put porting other implementations, Cubacle among them, after the
facelet bridge and CI checks (FORMAT-V2.md, "Open items before V2 leaves draft",
item 4 [V]).

**Cubacle today supports V1 only** (`src/notation/orbit64/*.rs`; the module doc
in `mod.rs` cites `FORMAT.md` [V]). Without a picture model in Cubacle, a picture
state there needs a separate field next to the V1 token, or it is given as
`{"moves": ...}` over a print, as the fixed-frame 2×2 does, because a camera does
not read identity. Without a print file, everything stays color-based.

A V2 token must be labeled wherever a V1 decoder might see it, for example by
a field name or an `orbit64v2:` prefix, because a V1 decoder can misread it as a
move sequence or algorithm (FORMAT-V2.md, "Relation to V1" [V]).

## 3. Rotation equality is a print/target property, not a state property

Glyph symmetry, such as `6`/`9`, `0`, `8`, `H`, `N`, `S`, `X` and `Z` reading the
same after a turn, says how a *printed sticker looks*. It does not change *where
a piece is or how it is turned*. It therefore belongs to the **print and target
layer**, not to the state token:

- The state token records the physical state: piece identities and fixed-center
  rotations. V2 says so explicitly: "Symmetries of a sticker's design, such as a
  `0` that looks the same after a half turn, belong in a goal or target
  definition, not in the token" (FORMAT-V2.md, "Extensions" [V]).
- In Cubistry the equality is implemented on the print side today:
  `image_normal` maps (text, quarter turns, ink) to a canonical key
  (`english/prepare_physical.jl:12-21` [V]), using the `HALF` table of
  half-turn-equal glyphs `0 1 2 5 8 H N S X Z` and the swap `6`↔`9`
  (`orientation_screen.jl:6-7` [V]). A multi-character label whose characters
  are all in the table is reversed and mapped character by character. `O` and `I` are aliased to `0` and `1`. Ink is
  part of the key.
- A per-sticker **symmetry period** (see the artwork table below) is the
  general form of the same idea. It lives in the print profile, next to text,
  ink and reference `up`.

Keeping symmetry out of the state means one state can be scored against
different prints and fonts without re-encoding it, and the state count stays
exact.

**Open owner decision: is `0` quarter-turn-equal or half-turn-equal?** The code
treats `0` as equal under every quarter turn: `image_normal` returns the same key
for `"0"` regardless of angle (`english/prepare_physical.jl:15` [V]; same rule in
`orientation_screen.jl`). The owner described half-turn symmetry. V2's example
also calls `0` half-turn symmetric. This is **undecided**. A quarter-turn-equal
`0` enlarges every target set that contains a `0`, so any result that relies on
it would need to be rechecked once this is decided.

## 4. Data model (opt-in picture mode)

Three layers [A] that generalize today's Cubistry code:

1. **Physical identity** = home facelet (position and normal) plus reference
   `up`, as in Cubistry's `physical-print.tsv` and Cubacle's "identity = home
   position" (`goal.rs:6-8` [V]). This matches the V2 picture model's piece
   numbering by home slot.
2. **Artwork table.** Artwork = (text, ink). Symmetry period
   p ∈ {1, 2, 4} quarter turns (1 = quarter-turn-equal, 2 = half-turn-equal,
   4 = asymmetric); aliases at the same angle (O = 0, I = 1); cross-equalities
   `(a, q) = (b, r)` (6@2 = 9@0). Closure: (a, q) ≡ (b, r) implies
   (a, q+t) ≡ (b, r+t); union-find over artwork × Z4. The **canonical picture
   key** is the minimum of the equivalence class, which is exactly what
   `image_normal` hard-codes today (`english/prepare_physical.jl:12-21`, `HALF`
   in `orientation_screen.jl:6-7` [V]).
3. **Read table** `read(s, q) → key`, with q the current picture angle relative
   to the cell's reference `up` (Cubistry: `IMAGE_UPS`,
   `prepare_physical.jl:8` [V]). Dual-label stickers (1/8, 24/31) are a special
   case: at most one active label per q (`dual-dates/oriented_common.jl:17-27`
   [V]). Optionally, a per-sticker period override (owner request "per
   sticker").

Cubistry today [V]: O→0, I→1 (substitution); `0` under every quarter turn;
half-turn-equal `0 1 2 5 8 H N S X Z` and 6↔9, multi-character labels reversed
and mapped; ink is part of the key; blank = `("",0,"blank")`
(`coupled_synthesis.jl:5`). This is an "optimistic font profile", not a font
certification (`orientation_screen.jl:2-3`, `english/README.md:19-21` [V]).

**State in picture mode.** The color state is refined by, per center orbit, the
permutation within each color class, and on odd cubes by the six fixed-center
rotations. This is the V2 picture model (section 2). Per orbit, the refinement
has at most 4!⁶ = 191,102,976 choices [A, arithmetic]; on the 3×3 the reachable
fixed-center rotations number 2048 [L], consistent with V2's `2^11` radix for
digit 7 [V].

**Formats.** Print: Cubistry's `physical-print.tsv` unchanged (header
`sticker piece home normal up text ink`, `replay_legal.jl:29` [V]), with an
optional `period` column. Artwork profile as TOML (illustrative only; the format
name is a placeholder):

```toml
# 3x3, only the fixed centers carry pictures (edges/corners: identity from colors)
format = "cubacle.picture.v1"
size = 3
pieces = "standard-colors"
[center]          # reference up = row direction of the facelet layout
U = { art = "logo", period = 4 }
F = { art = "H",    period = 2 }
R = { art = "",     period = 1 }   # blank: any angle
```

```toml
# 7x7 calendar EN (excerpt); print = english/evidence/physical-print.tsv
format = "cubacle.picture.v1"
size = 7
print = "physical-print.tsv"        # 294 rows, 54 blank, duplicates = several rows
alias  = { "O" = "0", "I" = "1" }
period = { "0" = 1, "1" = 2, "2" = 2, "5" = 2, "8" = 2, "H" = 2, "N" = 2, "S" = 2, "X" = 2, "Z" = 2 }
equal  = [ ["6@2", "9@0"] ]         # per ink
[dual]                              # orientation choice, dual-art.tsv
255 = ["8@0", "1@1"]
281 = ["31@0", "24@1"]
```

The `period = { "0" = 1 }` entry encodes today's code behavior and is subject to
the open decision in section 3.

## 5. Target model

A target is a list of cells (position, normal), each with an allowed **key
set** or `*`. It compiles per cell to A(c) ⊆ {(sticker, angle)}. For non-center
cells the angle is determined by (sticker, cell), so A(c) becomes a sticker set
(impossible rules are reported like `deadRules`, `fixed-frame-proofs.md:246-250`
[V]); for core centers, A(c) ⊆ Z4. Distinct bodies are automatic
(`fixed-frame-proofs.md:251` [V]).

| Aspect | Rule |
|---|---|
| Fixed frame | Fixed-frame semantics, rotation ≠ move (`fixed-frame-proofs.md:121-145` [V]) |
| Free whole-cube rotation | Union of 24 rotated views (`goal.rs`, `rotated` [V]); the calendar allows any face as the front (`english/README.md:22` [V]); costs 0 moves |
| Partial target | Unnamed cells are `*`; the target depends only on the tracked bodies (projection lemma, `fixed-frame-proofs.md:271-279` [V]) |
| Narrowing | Exact stickers plus upright: smaller target set, smaller seed for distance tables |
| Widening | Duplicates, blanks, p ∈ {1, 2}, 6/9, dual labels: more (sticker, angle) pairs per cell; union semantics in **one** multi-source search instead of a minimum over choices (`fixed-frame-proofs.md:252-254` [V]) |

Caveat: the 54 blanks are inventory, "not 54 unconditionally free positions"
(`english/README.md:49-50` [V]).

## 6. Solver architecture per size

All "Exact?" entries describe intended properties of a design that does not
exist yet. They are UNKNOWN until implemented and checked.

| Size | Method | Exact? | Risk |
|---|---|---|---|
| 2×2 | Fixed-frame BFS over tracked bodies (N₄ = 136,080 … N₇ = 88,179,840, `fixed-frame-proofs.md:189-231` [V]); the artwork profile compiles to rule unions `{image, up}`, with **no engine change** [A] | intended: yes, with certificate | low |
| 3×3 | Extend target-set IDA* with `ct[6] ∈ Z4` (each face turn adds its quarter to its own center); each view gets a 4-bit mask per center; the bound max(corner, edge, **twist table of 4^6 = 4096 states**) stays admissible [A] | intended: proven shortest | low; full-picture two-face (all 54 plus twists) only heuristic, upper bound 41 HTM [L] |
| 4×4, 5×5 | Switch the center stage to target sets: named slots allow identity sets, the rest only color; an exact center search up to 12 moves exists (`dont-care-targets.md:387` [V]); 5×5 core twist in the 3×3 final stage with the twist-aware IDA* (partial targets only) | staged, not global | **medium**: parity coupling between center permutation and wings [A]; a full strict mode (×4!⁶ per orbit) is out of scope |
| 6×6, 7×7 | **Target-set search on the front projection**: per orbit, one table over the positions of candidate pieces, seeded with all accepted placements; h = maximum (a sum would be inadmissible, since one move acts on many orbits) | no | **high** |

7×7 front projection (49 cells) [A, arithmetic]: corners, 4 cells,
8·7·6·5·3⁴ = 136,080; midges, 4 cells, 12·11·10·9·2⁴ = 190,080; each wing orbit,
8 cells, two halves of 24·23·22·21 = 255,024; each movable center orbit (6), 4
cells, 255,024 each (fewer with duplicates); core Z4. Total table size is
estimated as small (tens of MB), UNKNOWN until built. Alphabet 18 layers × 3 =
54 moves: exact IDA* beyond depth about 10 is expected to be impractical [A].

In practice: **staged target-set search with side effects**. Stage i only
requires the front cells of stages ≤ i to be correct; hidden pieces and later
orbits may be disturbed freely (instead of "untargeted orbits must be fixed",
`practical/RESULTS.md:38-39` [V]). Order: centers (inner layers) → wings →
corners/midges/core, each stage beam search or IDA* with the projection tables.
Fallback: pick one completion and run dwalton (189) plus an identity fix-up,
overdetermined but an immediate baseline. Whether side-effect search beats
358 to 446 HTM by a clear margin is **UNKNOWN**.

## 7. Applications

- **7×7 calendar**: 49 cells, 24 views, profile from section 4. The dual-label
  profile 1/8, 24/31 is directly a read table: cell "1" accepts
  (255, q ∈ {1, 3}) plus every other dark "1" at its angles. The README claims no
  move savings (`dual-dates/README.md:40-42` [V]). Chains: the end state of one
  edge is the start of the next; keep non-dominated end states
  (`minimax/SEARCH-POLICY.md:20-23` [V]); the solver returns several endpoints.
- **3×3 H/S/M counter**: a letter plus two digits on the front; center twist is
  needed only when the middle cell carries a picture. Exact per transition with
  the twist IDA* (intended, UNKNOWN). A 3×3 variant in Cubistry: [–] (2×2 only,
  `research/hsm-counter/README.md` [V]).
- **Logo cube**: 3×3 = color state plus 6 twists (2048 cases, residual twist
  group [L]); from 4×4 on, a full-face logo needs full center identity, which
  is a strict target and a research risk. A logo on some centers only is V2's
  future "partial distinguishability" entry (section 2).
- **Joint optimization of print and moves**: outer loop over prints (swaps
  within an orbit, blanks as extra duplicates of frequent digits), inner score
  per edge from a cheap lower bound (h_max of the projections) and the staged
  length; objective as in minimax: largest edge, then sum
  (`minimax/README.md:8-9` [V]). Cubistry today optimizes only the sticker
  count (240 = minimum, `english/README.md:29-47` [V]), not moves.

## 8. Verification and certification

- Cubacle outputs are **candidates**. A result is accepted only when the native
  Julia and Flix replays (`replay_legal.jl`, `decode_physical`,
  `validate_front` [V]) both accept it with byte-identical receipts. Cubacle runs
  only as an external process in optional tests (`fixed-frame-proofs.md:102-103`
  [V]). Python verifiers never accept, reject or break ties.
- Interface [A]: a raw move word in the 21-generator alphabet (or losslessly
  convertible) plus an end-state hash in `state_digest` format
  (`replay_legal.jl:78-84` [V]).
- The artwork profile must become **data** that both checkers parse
  independently (today it is hard-coded in `HALF` and `image_normal`).
- Negative controls (pattern of `dual-dates/negative_checks.sh` [V]): change a
  period, remove the 6/9 equality, remove an alias, flip one sticker's `up`, make
  both dual labels active at once, a dead rule, core twist ±1, a target with a
  swapped front.
- Lower bounds: 2×2 exact with certificate; 3×3 and up only as a consistent
  potential (projection table), checkable locally
  (`fixed-frame-proofs.md:325-335` [V]).
- **Remains UNKNOWN**: the 7×7 optimum and the 100–120 / 200 HTM goals; the
  diameter of the full 3×3 picture cube; strict feasibility from 4×4 on; font
  and print certification; whether every month can be placed on both sides.

## 9. Phase plan (small, independently checkable steps)

| # | Step | Acceptance test |
|---|---|---|
| P1 | Artwork profile `cubacle.picture.v1` and compilation to a read table (Rust), with the same parser in Julia | The Cubistry profile reproduces `image_normal` byte for byte on all 294 × 4 (sticker, angle) pairs |
| P2 | 2×2: profile → `FrameGoal` rules | H/S/M goldens unchanged; a 6/9 target = union of two rules |
| P3 | 3×3: `ct[6]` and twist table in target-set IDA* | `date-3x3`'s 18/20/18 HTM corrections are shown shorter or equal; spike cases 7–11 unchanged without twist |
| P4 | Picture state (colors + center permutation + twist), input as print + moves | Round trip moves → state → hash equals Julia `state_digest` |
| P5 | 7×7 front projection tables, bounds only | h ≤ known edge length on all 5 minimax chains; tables deterministic |
| P6 | 7×7 staged side-effect search | 5 minimax edges: result accepted by both Julia and Flix; length reported, no success threshold set in advance |
| P7 | 4×4/5×5 center target-set stage | Partial targets with identity: replay correct; color targets byte-identical to today |
| P8 | Print/move optimization (research) | Candidates only, each accepted independently |

## Open owner decisions

1. **Should Cubacle adopt Orbit64 V2?** Cubacle supports V1 only today. V2 is a
   draft and itself defers ports until its open items are done (section 2).
   Until then, picture state in Cubacle needs a side field or a print + moves
   form.
2. **Is `0` quarter-turn-equal or half-turn-equal?** The code says quarter, the
   owner described half (section 3). Undecided.
3. Lift "no strict mode" only inside the opt-in picture mode?
4. Which glyphs are quarter-turn-equal in general (today only `0`; `H`, `X`, `8`
   only half)? Per sticker or per artwork?
5. A shared metric for the calendar (single-layer HTM, rotations counted
   separately?). Required before any comparison with 189.
6. May the 7×7 solver use partial paths with a middle layer (= rotation + 6
   layers)?
7. Priority: 3×3 twist (small, exact) before the 7×7 projection?
8. Should Cubacle read Cubistry's `physical-print.tsv` directly (format binding)
   or use its own format with a converter?

## Connections

- [3×3 Super Picture Cube](../../docs/SUPER_PICTURE_CUBE.md)
- [Picture Puzzle Playground](../../docs/PICTURE_PLAYGROUND.md)
- [Proof checker authority](../../proof-checkers/AUTHORITY.md)
- [Orbit64 V2 format](https://github.com/wstein/flix-orbit64/blob/main/FORMAT-V2.md)
