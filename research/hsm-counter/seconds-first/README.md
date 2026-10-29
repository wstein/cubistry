# Seconds-first H/S/M print

## Claim

**SAT** for a new fixed 24-sticker print, [witness.json](witness.json). The
model is unchanged from the accepted [blank print](../blank/README.md):

- one shared immutable print for all three letters;
- a real blank upper-left sticker, the upright letter upper-right, upright
  tens lower-left, and upright units lower-right;
- eight rigid corners, all 18 outer-face turns, HTM, legal states only;
- no optical aliases and no whole-cube reorientation.

All 180 displays are physically witnessed. Every display is within **six**
HTM of every legal pose, which keeps the accepted general bound.

The seconds objective is the S +1 lap 00→01→…→59→00, counted in a
**recurrent** mode. A saved period is closed over the full hidden pose: all
24 sticker positions, normals, and up vectors. The period can therefore repeat
indefinitely. Every saved edge is a shortest word from its actual source pose.
For a fixed print, the best such mode is the minimum-mean cycle of the complete
graph of legal settled poses, with all shortest edges included.

- The baseline is the app print pinned by `hsm-source.json` on `main`
  (`blank/witness.json`, SHA-256 `13eea2a1…`).
- Its optimal S +1 mode costs **250.5 HTM per lap**. That is 1,002 HTM over a
  four-lap period, mean 4.175 HTM per edge, maximum 5.
- The new print costs **159 HTM per lap**: mean 2.65 HTM per edge, maximum 4,
  and 59→00 in 3 HTM.
- That is a reduction of 36.5 %.

Every M edge stays at most five HTM in both directions, including the wraps.

## Before and after

Laps are optimal recurrent shortest-edge modes. Each is certified by the
independent checker against the complete graph, rebuilt in Python, using an
integer Bellman-Ford potential.

Mean is HTM per edge. A wrap is 59→00 for +1 and 00→59 for −1 (23/11→00 and
00→23/11 for H). When a period spans several laps, the wrap is shown as a
minimum–maximum range.

| Mode | Baseline lap | Mean | Max | Wrap | New lap | Mean | Max | Wrap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S +1 | 250.5 | 4.175 | 5 | 3–5 | **159** | **2.650** | **4** | **3** |
| S −1, inverse of S +1 | 250.5 | 4.175 | 5 | 3–5 | **159** | **2.650** | **4** | **3** |
| S −1, own shortest edges | 250 | 4.167 | 5 | 3 | 171 | 2.850 | 5 | 4 |
| M +1 (cap 5) | 250.5 | 4.175 | 5 | 3–5 | 204 | 3.400 | 5 | 4 |
| M −1 (cap 5) | 250 | 4.167 | 5 | 3 | 204.75 | 3.413 | 5 | 2–4 |
| H 00–23 +1 | 100 | 4.167 | 5 | 3–4 | 82 | 3.417 | 5 | 4 |
| H 00–23 −1 | 99.33 | 4.139 | 5 | 3–5 | 82 | 3.417 | 5 | 4 |
| H 00–11 +1 | 49 | 4.083 | 5 | 4 | 40 | 3.333 | 4 | 4 |
| H 00–11 −1 | 49.5 | 4.125 | 5 | 3–4 | 41.14 | 3.429 | 6 | 3–5 |

The app's current tie policy is policy 13: deterministic greedy shortest
edges, as in the blank witness. On the baseline print it settles into
**268.4** HTM per lap for S +1 and **269.64** for S −1. The generator log
reproduces these numbers exactly from the blank witness's own period data.
They show the realized cost of today's app. The 250.5 is the best possible
mode on the old print.

### The −1 direction

There are two valid answers:

- **Inverse traversal.** Run the S +1 period backward, inverting each word.
  The checker replays it, and it closes the full pose. It costs exactly the
  same as the +1 lap: 159 HTM, maximum 4, 00→59 in 3 HTM.
  - 24 of its 60 edges are not shortest from their sources toward the lower
    display.
  - It is a legal, sustainable schedule. It is not a shortest-edge schedule.
- **Own shortest edges.** S −1 counted by shortest edges has a certified
  optimum of 171. Restricting each step to a shortest word is therefore not
  optimal overall for −1.

For the same reason, schedules with non-shortest S +1 edges are **not**
covered by the certificate. See the limits below.

## The new print

Print code: one triple per corner, corner `c` at home position
`((x>0)<<2 | (y>0)<<1 | (z>0))`, stickers on its x, y, and z faces.

- `Tn` is a tens digit upright lower-left.
- `Un` is a units digit upright lower-right.
- `H`, `S`, and `M` are upright upper-right.
- `_` is blank.

```text
T0 T2 T4 | T1 T3 T5 | U3 U1 U9 | U8 S U5 | U2 U7 S | U4 U0 U6 | S H M | _ _ _
```

It keeps one fully blank corner, six single tens glyphs, and ten single units
glyphs. Compared with the baseline, it drops the duplicate units 0 and 9
stickers and prints **three S stickers** on three different corners. With extra
S stickers, an R-type turn can bring a different S corner into the
upper-right cell while the units cell changes. That is how 12 of the 60 S +1
edges cost a single HTM.

The edge profile per lap is twelve 1-HTM, six 2-HTM, thirty-three 3-HTM, and
nine 4-HTM edges.

### Sticker changes versus the app print

The print is expressed in the relabeling, by a legal assembly state, that
changes the fewest stickers of the pinned app print. The blank corner's twist
is a symmetry. **14 of 24 sticker identities change**; ids 0, 5, 7, 11, 13, 16,
20, 21, 22, and 23 are unchanged.

| Id | Corner | Normal | App print | New print |
| ---: | ---: | --- | --- | --- |
| 1 | 0 | (0,−1,0) | tens 1 | tens 2 |
| 2 | 0 | (0,0,−1) | tens 2 | tens 4 |
| 3 | 1 | (−1,0,0) | tens 3 | tens 1 |
| 4 | 1 | (0,−1,0) | tens 4 | tens 3 |
| 6 | 2 | (−1,0,0) | units 0 | units 3 |
| 8 | 2 | (0,0,−1) | units 2 | units 9 |
| 9 | 3 | (−1,0,0) | units 3 | units 8 |
| 10 | 3 | (0,1,0) | units 4 | **S** |
| 12 | 4 | (1,0,0) | units 6 | units 2 |
| 14 | 4 | (0,0,−1) | units 8 | **S** |
| 15 | 5 | (1,0,0) | units 9 | units 4 |
| 17 | 5 | (0,0,1) | units 9 | units 6 |
| 18 | 6 | (1,0,0) | H | S |
| 19 | 6 | (0,1,0) | S | H |

[verification.json](verification.json) (`versusAppPrint`) lists the exact
print-up vectors of every change. The two new S stickers replace units
glyphs, so their up vectors change as well. Nothing in the app, sticker art,
print bundles, or `main` was changed.

## What is proved and what is only best-found

**Proved**, by the independent Python checker, which imports no generator code:

- The print is valid and a SAT witness for all 180 displays, with full
  24-frame replays of every route, both directions, and every wrap.
- Every display is within six HTM of every legal pose. This is an exhaustive
  pruned search over legal corner assignments. The same prover finds genuine
  counterexamples for a bound of four or five.
- Every saved edge is shortest from its actual pose, and all periods close
  exactly. M ≤ 5 holds on every edge of both M periods.
- For **this print**, 159 is the minimum per-lap cost of any recurrent S +1
  schedule whose edges are all shortest. The same kind of certificate holds
  for all eight modes and for the baseline numbers. The Python graph sizes
  equal the C generator's (for example 303,264 nodes and 696,420 edges for
  S +1).
- Conditional lower bound: any print with a single S sticker, a single
  sticker per tens digit, and all blanks on one fully blank corner needs at
  least **168** HTM per S lap. This holds for any route, recurrent or not:
  units-only edges cost at least 3 and decade edges at least 1 under those
  assumptions (`physicalFloor`). Beating 168 therefore requires duplicate S,
  tens, or blank stickers. The new print uses duplicate S stickers.

**Best-found only (UNKNOWN):**

- **Global print optimality is UNKNOWN.** The search is heuristic. The only
  unconditional lower bound is the trivial 60 HTM per lap: every edge changes
  the display. The per-print floor for the new print is also 60, because
  each edge has some pose where it costs one move.
- The print is a **local optimum** for every single-sticker swap, cyclic
  corner turn, and reprint of one sticker as any glyph or blank (`polish.c`).
  This was checked by the C engine only.
  - Among equal-S neighbors, none improves the tie-break key (S max, M +1,
    M −1, H 00–23, H 00–11) (`tiebreak.c`).
- Schedules whose edges are not shortest might beat 159 for S +1. They are
  outside the certificate; the inverse −1 traversal shows that such schedules
  can matter.
- Physical limits: a face turn moves four of the eight corners and
  always changes two front cells, or all four for F. A 1-HTM edge is only
  possible when a duplicate sticker arrives in the moved cell. Most units steps
  stay at three moves; the 3-HTM units-only floor above explains why.

## Search provenance

The search engine is `engine.h` (C, generator side). Its key parts:

- The 4-corner distance table has 136,080 states.
- It enumerates legal full poses with a corner-twist invariant.
- It enumerates all shortest words, finds minimum-mean cycles with Howard
  policy iteration, and checks them with an integer Bellman-Ford
  certificate.
- The deterministic greedy simulation reproduces the blank witness's
  policy-13 periods exactly. This cross-checks the engine against the
  original JavaScript generator.

Annealing (`search.c`) minimizes the exact S +1 lap. Feasibility requires all
180 displays, at most 64 sticker selections per display (a search limit), a
recurrent M cycle with every edge ≤ 5 in both directions, and the universal
six bound. Seeds follow the repository's 281028 convention. The logs are in
[logs/](logs/).

| Run | Command | Result |
| --- | --- | --- |
| A | `search BASELINE 281028 6000 1 0.03` | 162 at iteration 3,028 (last logged progress 3,500; stopped by the 2 h job limit) |
| B | `search BASELINE 281029 6000 1 0.03` | **159** at iteration 3,797 (last logged progress 4,000; stopped by the 2 h job limit) |
| C | `search P159 281030 3000 0.3 0.02` | no improvement on 159 through logged iteration 1,000 (stopped manually under machine load) |
| D | `search BASELINE 281031 3500 1 0.03` | 173 at iteration 1,435 (stopped manually under machine load) |
| polish | `polish P159` | local optimum; 268 neighbors passed the display filters, none improved |
| tiebreak | `tiebreak P159` | 12 plateau neighbors, none better |

`BASELINE` is the app print code. `P159` is
`T0 T2 T4 | T5 T1 T3 | U9 U3 U1 | U6 U4 U0 | U5 S U8 | S H M | U2 S U7 | _ _ _`.
`inspect` relabels P159 to the saved print above, with 14 changes. The search
is deterministic for a given command, but the runs were stopped by wall-clock
limits. An earlier, interrupted attempt with an older build reached 162 and
165. Its unretained output was used only as context; no claim depends on it.

## Reproduce

From the Research branch root, with gcc and standard-library Python 3:

```sh
cd research/hsm-counter/seconds-first
gcc -O2 -o /tmp/sf-generate generate.c -lm
gcc -O2 -o /tmp/sf-inspect inspect.c -lm
/tmp/sf-generate "T0 T2 T4 | T1 T3 T5 | U3 U1 U9 | U8 S U5 | U2 U7 S | U4 U0 U6 | S H M | _ _ _" NEW.json seconds-first-best
/tmp/sf-generate "T0 T1 T2 | T3 T4 T5 | U0 U1 U2 | U3 U4 U5 | U6 U7 U8 | U9 U0 U9 | H S M | _ _ _" NEW-BASE.json current-app-print
python3 verify.py witness.json --certify all
python3 verify.py baseline-witness.json --certify all
python3 -m unittest discover -s . -p 'test_verify.py' -v
```

The generator refuses to overwrite an existing output. Its output equals the
saved witnesses byte for byte.

- Search: `gcc -O2 -o /tmp/sf-search search.c -lm`, then the commands in the
  table.
- Local checks: build `polish.c` and `tiebreak.c` the same way.

Full verification with all eight certificates takes about one minute of CPU
per witness. The test suite takes a few minutes.

## Limits

- The setup word from the solved print to the period start is excluded from
  lap totals (8–10 HTM). Five-move M and the stated laps apply to the saved
  full-pose periods. After a manual Set, a letter change, or a direction
  change, an application must replan to the period start. The general bound
  for such replanning stays six.
- H 00–11 −1 has one 6-HTM edge in its optimal period. It is within the
  general six bound; H has the lowest priority.
- This is a settled-display mathematical result. No artwork, typography,
  browser timing, or application change is included.
- See [manifest.json](manifest.json) for hashes and the environment.
