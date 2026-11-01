# Single-digit `0–9` counter at `r2c1` with 1 touching move + preparing moves (2×2×2, fixed frame, HTM)

**Status:** **SAT and tight in every operating mode.** Two permanent 24-sticker prints (`closed` and `wrap1`, each with 10 upright digit stickers `0–9` and 14 blank stickers) establish the exact minimum preparing-move and total-HTM bounds for counting `0..9` in the lower-left front cell `r2c1` (`LL = (-1, -1, 1)`) while the other three front cells (`UL`, `UR`, `LR`) show empty space (blank). Both native checkers ([Julia](julia/check.jl) and [Flix](flix/src/Main.flix)) accept both witnesses with **byte-identical receipts** ([`receipt-julia-closed.tsv`](evidence/receipt-julia-closed.tsv), [`receipt-flix-closed.tsv`](evidence/receipt-flix-closed.tsv), [`receipt-julia-wrap1.tsv`](evidence/receipt-julia-wrap1.tsv), [`receipt-flix-wrap1.tsv`](evidence/receipt-flix-wrap1.tsv)) and reject all 11 negative controls with identical messages ([`negative-controls.tsv`](evidence/negative-controls.tsv)).

| Mode / Witness | Edges | Max HTM / edge | Max Prep / edge | Edges at 1 / 2 / 3 HTM | Total Prep Moves | Total HTM | Mean HTM | Closure | Setup |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| **0-Prep baseline** (`1 HTM` only, no prep) | 8 (max 9 displays `0..8`) | 1 | 0 | 8 / 0 / 0 | 0 | 8 | 1.000 | **UNSAT for 10 displays (`0..9`)** | — |
| **`wrap1` (open `0..9` prefix, 9 edges)** | 9 | **2** | **1** | 8 / 1 / 0 | **1** (tight min) | **10** | **1.111** | Open (`0 -> 9`) | none (`0` printed) |
| **`wrap1` (1-lap display wrap `0..9->0`)** | 10 | **2** | **1** | 9 / 1 / 0 | **1** (tight min) | **11** | **1.100** | Display-wrapped (`0` restored at `r2c1`) | none (`0` printed) |
| **`closed` (open `0..9` prefix, 9 edges)** | 9 | **2** | **1** | 7 / 2 / 0 | 2 | 11 | 1.222 | Prefix of exact cycle | none (`0` printed) |
| **`closed` (primary, exact full-state cycle `0..9->0`)** | 10 | **2** | **1** | 7 / 3 / 0 | **3** (tight min) | **13** | **1.300** | **Exact full 24-sticker closure (Period 1)** | none (`0` printed) |

Even though up to **2 preparing moves** per transition were allowed by the specification (`1–2 preparing moves`), **2 preparing moves on a single step are never needed**: every transition in both witnesses uses **1 touching move (`L` or `D`)** preceded by **0 or 1 back-face preparing move (`B` or `B2`)**.

---

## 1. Model and geometric partition

- **Cube and frame:** A standard 2×2×2 in a fixed viewing frame with Front = `+z` and Up = `+y`. The 18 HTM generators are `R, L, U, D, F, B` with quarter turns, inverses (`'`), and half turns (`2`), each counting as 1 HTM.
- **Front display cells:**
  - `UL` (`r1c1`) = `(-1, 1, 1)` → must show `blank`
  - `UR` (`r1c2`) = `(1, 1, 1)` → must show `blank`
  - `LL` (`r2c1`) = `(-1, -1, 1)` → must show digit `0..9` upright (`up = (0, 1, 0)`)
  - `LR` (`r2c2`) = `(1, -1, 1)` → must show `blank`
- **Generator partition relative to the `r2c1` (`LL = (-1, -1, 1)`) cubie:**
  - **9 Touching (Action) moves** ($\text{dot}((-1,-1,1), a) > 0$):
    $$\mathcal{T} = \{L, L', L2, D, D', D2, F, F', F2\}$$
  - **9 Preparing (Non-Touching) moves** ($\text{dot}((-1,-1,1), a) < 0$):
    $$\mathcal{P} = \{R, R', R2, U, U', U2, B, B', B2\}$$
    Moves in $\mathcal{P}$ never move or twist the `r2c1` (`LL`) corner cubie. During any sequence of preparing moves at the start of an increment $v \to w$, the `r2c1` corner remains completely stationary, continuing to display digit $v$ upright until the single touching move $t \in \mathcal{T}$ snaps digit $w$ into `r2c1`.
  - **3 Back-Only Preparing moves** ($\mathcal{P}_B = \{B, B', B2\} \subset \mathcal{P}$):
    Because `B` acts on $z = -1$ while all four front cells lie on $z = +1$, moves in $\mathcal{P}_B$ touch **zero front stickers**. During a `B`-face preparing move, the **entire 2×2 front face (`UL, UR, LL, LR`) remains 100% motionless**.

---

## 2. Three structural theorems (why preparing moves are required and why `B` + `{L, D}` is optimal)

### Theorem 1: The Front-Spill Obstruction ($F, F', F2$ cannot terminate a step)
In any `Prep-then-Touch` step $w = p_1 \dots p_k \, t$ ($p_i \in \mathcal{P}, t \in \mathcal{T}$), the preparing moves $p_1 \dots p_k$ leave the current digit $v$ at `LL` (`(-1, -1, 1)`) on the `+z` front face. If the final move is $t \in \{F, F', F2\}$, then $t$ cycles the four `+z` front facelets among themselves:
- $F$ moves digit $v$ from `LL` to `UL` (`r1c1`);
- $F'$ moves digit $v$ from `LL` to `LR` (`r2c2`);
- $F2$ moves digit $v$ from `LL` to `UR` (`r1c2`).

In all three cases, digit $v$ remains visible on the front face in a cell that must show empty space (`blank`). Consequently, $t$ must belong to the **6 moves $\{L, L', L2, D, D', D2\}$**, each of which immediately rotates the old digit off the `+z` front face while bringing the new digit onto `r2c1`.

### Theorem 2: The 9-Display Ceiling for 0 Preparing Moves (`0..9` is UNSAT without prep moves)
If 0 preparing moves are used on every step, Theorem 1 restricts every move to the 2-generator subgroup $\langle L, D \rangle$:
1. Both `UR = (1, 1, 1)` and `UBR = (1, 1, -1)` satisfy $x = +1, y = +1$ and are **completely fixed** by $\langle L, D \rangle$. Only 6 corners (18 facelets) can ever move.
2. At every settled state, 2 of those 6 active corners occupy `UL` and `LR`, forcing their `+z` facelets to be `blank`.
3. Exhaustive DFS in [`search/search.jl`](search/search.jl) over all conflict-free 0-prep walks of $N$ displayed values ($N = 1 \dots 11$) yields exact path counts:

| Displayed values $N$ | Transitions ($N-1$) | Conflict-free 0-prep walks | Status |
| ---: | ---: | ---: | --- |
| 1 | 0 | 1 | SAT |
| 2 | 1 | 6 | SAT |
| 3 | 2 | 30 | SAT |
| 4 | 3 | 122 | SAT |
| 5 | 4 | 384 | SAT |
| 6 | 5 | 866 | SAT |
| 7 | 6 | 1,250 | SAT |
| 8 | 7 | 928 | SAT |
| 9 (`0..8`) | 8 | 234 | **Maximum 0-prep capacity** |
| **10 (`0..9`)** | **9** | **0** | **UNSAT** |

Every 0-prep walk exhausts its uncorrupted facelets after at most **9 displayed values (`0..8`)**. At least **1 preparing move** is therefore mathematically required to display all 10 digits `0..9`.

### Theorem 3: Tight Minimum Preparing-Move Bounds (`1` for open/wrapped, `3` for exact full-state cycle)
Exhaustive search and meet-in-the-middle verification ([`evidence/bounds-summary.tsv`](evidence/bounds-summary.tsv)) establish the exact number of valid routes by total preparing-move budget across all 10 steps:

| Total Prep Budget | Step Model | Open 9-Edge (`0..9`) | 1-Lap Display-Wrapped (`0..9->0`) | Exact Full-State Closed 10-Cycle |
| ---: | --- | ---: | ---: | ---: |
| **0** | `T` only (`L/D/F`) | 0 | 0 | 0 |
| **1** | `P* T` (`B`-only prep) | **22,368** | **1,928** | 0 |
| **1** | `P* T` (`R/U/B` prep) | **23,088** | **2,302** | 0 |
| **1** | `P* T P*` (any order) | **46,176** | **4,604** | 0 |
| **2** | `P* T` (`R/U/B` prep) | 1,577,116 | 213,962 | 0 |
| **3** | `P* T` (`B`-only prep) | — | — | **20** (all 13 HTM) |
| **3** | `P* T` (`R/U/B` prep) | — | — | **127** (all 13 HTM) |

Remarkably, the 20 `B`-only exact-closed 13-HTM cycles consist of the 10 cyclic shifts of a single canonical rhythm (`L | D | L | B L | D | L | B2 D | L | D | B D`) and the 10 cyclic shifts of its mirror dual under $L \leftrightarrow D', B \leftrightarrow B'$.

---

## 3. Certified witnesses

### Primary witness: `closed` (13 HTM exact full-state 10-cycle, 3 back-face preps)
- **Files:** [`evidence/print-closed.tsv`](evidence/print-closed.tsv), [`evidence/routes-closed.tsv`](evidence/routes-closed.tsv), [`evidence/setup-closed.tsv`](evidence/setup-closed.tsv)
- **Receipts:** [`evidence/receipt-julia-closed.tsv`](evidence/receipt-julia-closed.tsv) and [`evidence/receipt-flix-closed.tsv`](evidence/receipt-flix-closed.tsv) (byte-identical)
- **Properties:**
  - **10 edges (`0->1` .. `9->0`):** 7 edges cost **1 HTM** (`0 prep`), 3 edges cost **2 HTM** (`1 back-prep` + `1 touch`), 0 edges cost 3 HTM.
  - **Total:** **13 HTM** (mean **1.30 HTM/edge**, max **2 HTM/edge**).
  - **Exact full-state closure:** After `9->0` (`B D`), all 24 stickers return to their exact initial positions and orientations (`Period 1`). Decrements are the exact inverse words (`D' B'`, `D'`, `L'`, …) with identical move counts.
  - **Open `0..9` prefix:** Because the third preparing move sits on the `9->0` wrap edge (`B D`), counting `0 -> 9` from the printed state (`setup = 0`) uses **only 2 preparing moves** (**11 HTM across 9 edges**).
  - **Zero front flicker during prep:** Every preparing move is on `B` (`B` or `B2`), so `UL, UR, LL, LR` remain completely stationary during preparation. Corner `1` (`UR = (1, 1, 1)`) never moves during the entire cycle.

| Step | Transition | Increment (`P* T`) | HTM | Prep | Touch | Unrestricted Shortest HTM | Decrement (`T^-1 P*^-1`) |
| ---: | :---: | --- | ---: | ---: | ---: | ---: | --- |
| 0 | `0 -> 1` | `L` | 1 | 0 | 1 | 1 | `L'` |
| 1 | `1 -> 2` | `D` | 1 | 0 | 1 | 1 | `D'` |
| 2 | `2 -> 3` | `L` | 1 | 0 | 1 | 1 | `L'` |
| 3 | `3 -> 4` | `B L` | 2 | 1 | 1 | 1 | `L' B'` |
| 4 | `4 -> 5` | `D` | 1 | 0 | 1 | 1 | `D'` |
| 5 | `5 -> 6` | `L` | 1 | 0 | 1 | 1 | `L'` |
| 6 | `6 -> 7` | `B2 D` | 2 | 1 | 1 | 2 | `D' B2` |
| 7 | `7 -> 8` | `L` | 1 | 0 | 1 | 1 | `L'` |
| 8 | `8 -> 9` | `D` | 1 | 0 | 1 | 1 | `D'` |
| 9 | `9 -> 0` | `B D` | 2 | 1 | 1 | 2 | `D' B'` |

#### Cubie assignment for `print-closed.tsv` (10 digit stickers, 14 blank stickers)
| Cubie | Home Corner | `-x / +x` Sticker | `-y / +y` Sticker | `-z / +z` Sticker | Summary |
| ---: | :---: | --- | --- | --- | --- |
| 0 | `(-1, 1, 1)` (`UL`) | `blank` | `1` (`up = (0,0,-1)`) | `blank` | 1 digit, 2 blanks |
| 1 | `(1, 1, 1)` (`UR`) | `blank` | `blank` | `blank` | 0 digits, 3 blanks (stationary) |
| 2 | `(-1, -1, 1)` (`LL`) | `2` (`up = (0,0,-1)`) | `blank` | `0` (`up = (0,1,0)`) | 2 digits (`0, 2`), 1 blank |
| 3 | `(1, -1, 1)` (`LR`) | `9` (`up = (0,1,0)`) | `7` (`up = (0,0,-1)`) | `blank` | 2 digits (`7, 9`), 1 blank |
| 4 | `(-1, 1, -1)` (`UBL`) | `5` (`up = (0,0,1)`) | `blank` | `3` (`up = (0,-1,0)`) | 2 digits (`3, 5`), 1 blank |
| 5 | `(1, 1, -1)` (`UBR`) | `blank` | `blank` | `6` (`up = (-1,0,0)`) | 1 digit (`6`), 2 blanks |
| 6 | `(-1, -1, -1)` (`DBL`) | `blank` | `4` (`up = (0,0,1)`) | `blank` | 1 digit (`4`), 2 blanks |
| 7 | `(1, -1, -1)` (`DBR`) | `blank` | `blank` | `8` (`up = (0,1,0)`) | 1 digit (`8`), 2 blanks |

---

### Secondary witness: `wrap1` (11 HTM display-wrapped `0..9->0` / 10 HTM open `0..9`, only 1 prep move total)
- **Files:** [`evidence/print-wrap1.tsv`](evidence/print-wrap1.tsv), [`evidence/routes-wrap1.tsv`](evidence/routes-wrap1.tsv), [`evidence/setup-wrap1.tsv`](evidence/setup-wrap1.tsv)
- **Receipts:** [`evidence/receipt-julia-wrap1.tsv`](evidence/receipt-julia-wrap1.tsv) and [`evidence/receipt-flix-wrap1.tsv`](evidence/receipt-flix-wrap1.tsv) (byte-identical)
- **Route:** `D | D | D | L | L | D | B D | L | L | D`
- **Properties:**
  - Achieves the **absolute mathematical minimum of 1 preparing move (`B` on `6->7`)** across the entire 10-edge `0..9->0` pass (**11 HTM** for `0..9->0`, or **10 HTM** for open `0..9`).
  - **10 out of 10 increments match the unrestricted shortest HTM distance (`inc_shortest = 10/10`)** in the 136,080-state tracked front-corner graph.

---

## 4. Reproduce verification

Both native checkers rebuild the 136,080-state tracked 4-front-corner BFS graph (diameter 7), verify all 24 sticker frames, check the `1-touch + (0..2)-prep` structure and intermediate `r2c1` invariance on every edge, compare receipts byte for byte, and verify all 11 negative controls:

```sh
research/counter-r2c1-0to9/evidence/run.sh
```

