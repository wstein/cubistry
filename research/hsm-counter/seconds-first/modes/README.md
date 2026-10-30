# Seconds-first print: all 18 counting modes and recovery

## Claim

**SAT** for every one of the 18 application counting modes (H, S and M;
ranges 00–59, 00–23 and 00–11; counting up and down) on the **unchanged**
seconds-first print of [../witness.json](../witness.json) (SHA-256
`f71d4237…`; the same 24 sticker records and print code). For each mode,
[witness.json](witness.json) holds a period that:

- is closed over the full hidden pose (all 24 sticker positions, normals and up
  vectors), so it repeats indefinitely;
- shows every display of its range;
- has **no edge above five HTM** (a half turn is one HTM).

No mode needs an edge of six. Nothing is UNSAT or UNKNOWN.

The model is the one of [../README.md](../README.md): eight rigid corners, all 18
outer-face turns, legal states only, no optical aliases, no whole-cube
reorientation.

[recovery.json](recovery.json) adds the return onto the period from any settled
pose of a mode, for an application after a free jump, a catch-up or an
interrupted route (see [Recovery](#recovery)).

## Application modes

Each application mode takes the +1 period, run forward when counting up and
backward with every word inverted when counting down. The opposite direction's
own period would be used instead if it were strictly cheaper per lap, or equal
with a smaller maximum edge. It never is, so every −1 mode is the inverse of
the +1 period. It visits the same full poses and costs the same HTM.

| Mode | Lap HTM (up = down) | Max edge | Wrap HTM | Period edges | Laps per period | Setup HTM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| S 00–59 | 159 | 4 | 3 | 60 | 1 | 9 |
| S 00–23 | 68 | 5 | 5 | 24 | 1 | 10 |
| S 00–11 | 32 | 4 | 4 | 12 | 1 | 9 |
| M 00–59 | 204 | 5 | 4 | 120 | 2 | 9 |
| M 00–23 | 82 | 5 | 4 | 48 | 2 | 9 |
| M 00–11 | 40 | 4 | 4 | 12 | 1 | 9 |
| H 00–59 | 204 | 5 | 4 | 120 | 2 | 10 |
| H 00–23 | 82 | 5 | 4 | 48 | 2 | 9 |
| H 00–11 | 40 | 4 | 4 | 12 | 1 | 8 |

The wrap is 59→00 (23→00, 11→00) counting up and 00→59 (00→23, 00→11)
counting down. Every value is for the saved period. Other optimal periods can
have other wraps.

Own periods. These are shortest-edge minimum-mean cycles, each with an integer
Bellman-Ford certificate:

| Mode | +1 lap | +1 max | −1 own lap | −1 own max | −1 used |
| --- | ---: | ---: | ---: | ---: | --- |
| S 00–59 | 159 | 4 | 171 | 5 | inverse, 159 |
| S 00–23 | 68 | 5 | 70.25 | 5 | inverse, 68 |
| S 00–11 | 32 | 4 | 33.75 | 5 | inverse, 32 |
| M 00–59 | 204 | 5 | 204.75 | 5 | inverse, 204 |
| M 00–23 | 82 | 5 | 82 | 5 | inverse, 82 (tie) |
| M 00–11 | 40 | 4 | 41.2 | 5 | inverse, 40 |
| H 00–59 | 204 | 5 | 204.75 | 5 | inverse, 204 |
| H 00–23 | 82 | 5 | 82 | 5 | inverse, 82 (tie) |
| H 00–11 | 40 | 4 | 41.2 | 5 | inverse, 40 |

The M and H figures coincide range for range. Their recovery tables below
are identical as well. Only the figures were compared; no symmetry of the
print is claimed.

### What is certified

- **Proved by the independent Python checker:**
  - every own period is shortest-edge and closed;
  - its mean is the minimum over all recurrent shortest-edge schedules of
    that direction within its letter cap. The cap is 6 for S and H, except 5
    for H 00–11 −1, and 5 for M. Each cycle's maximum is at most five, so it
    is also the minimum within cap five;
  - every application period replays, closes, shows its range, and has no
    edge above five.
- **The −1 application periods** are inverse traversals. Their edges are not
  necessarily shortest toward the lower display. Their lap equals the
  certified +1 minimum. They are certified optimal over the union of two
  classes:
  - shortest-edge −1 schedules;
  - inverses of shortest-edge +1 schedules.
- **Not covered:** schedules mixing longer, non-shortest edges in other ways.
  These might be cheaper. That is UNKNOWN, as in [../README.md](../README.md).
- The seven own periods published first in [../witness.json](../witness.json) are
  reproduced byte for byte: S, M 00–59, H 00–23 and H 00–11 up, and S, M
  00–59 and H 00–23 down. The eighth, H 00–11 −1, had one six-HTM edge
  there. It is replaced here by the cap-five optimum, 41.2 per lap.

Under `proof-checkers/AUTHORITY.md` on `main`, none of
this is CONFIRMED until both the Flix and the Julia checker accept it. The Python
checker is research evidence only.

## Recovery

An application that leaves a period has to return to it, after:

- a free jump (Set, Reset, a range change);
- a live-clock catch-up after a suspended tab or a wall-clock jump;
- an interrupted route.

Recovery keeps counting: each step shows the next value, exactly as ordinary
counting does. A step may use **any** legal word of at most five HTM, not
only a shortest one. It must end on a node of the mode's application period.

For each application mode the generator builds a complete graph:

- **Nodes:** every legal settled full pose that shows a display of the
  range.
- **Edges:** every word of at most five HTM to the next display. A pose with
  no such word, because its shortest route to the next display is six, keeps
  only its shortest words.

It then computes the lexicographically least route for every pose: first
edges above five, then steps, then HTM.

| Mode | Poses | Edges | Poses without a ≤5 step | Max steps up / down | Mean steps up / down | Max recovery HTM up / down |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| S 00–59 | 303,264 | 6,377,508 | 0 | 6 / 6 | 3.336 / 3.403 | 28 / 27 |
| S 00–23 | 122,472 | 2,549,178 | 0 | 6 / 6 | 3.342 / 3.401 | 26 / 27 |
| S 00–11 | 62,208 | 1,308,546 | 0 | 5 / 6 | 3.320 / 3.414 | 24 / 26 |
| M 00–59 | 116,640 | 1,301,508 | 756 | 7 / 6 | 3.570 / 3.563 | 32 / 30 |
| M 00–23 | 46,656 | 514,026 | 252 | 6 / 7 | 3.577 / 3.643 | 30 / 32 |
| M 00–11 | 23,328 | 253,692 | 252 | 7 / 7 | 3.868 / 3.872 | 35 / 32 |
| H 00–59 | 116,640 | 1,301,508 | 756 | 7 / 6 | 3.570 / 3.563 | 32 / 30 |
| H 00–23 | 46,656 | 514,026 | 252 | 6 / 7 | 3.577 / 3.643 | 30 / 32 |
| H 00–11 | 23,328 | 253,692 | 252 | 7 / 7 | 3.868 / 3.872 | 35 / 32 |

Edge counts are the same up and down. Every one of these poses reaches the
period. The worst edge is five, with one exception:

- A pose of M or H whose shortest route to the next display is six HTM must
  take that six-HTM step. No planner can avoid it.
- Such a step comes first and only once; after it, every step is at most
  five. A route never passes through another such pose.
- S has none.

An application can avoid these poses entirely: a free jump can choose a least
route that lands on a pose with a five-HTM next step. That is the
application's job, not part of this table.

**Proved by the independent Python checker:**

- `--recovery-full all` recomputes every table above from scratch and
  requires equality:
  - all nodes;
  - all words of at most five HTM;
  - the lexicographic Dijkstra;
  - poses, edges, forced poses, the step and edge-above-five histograms, the
    maximum and mean steps, and the maximum HTM.
- The forced-pose count equals the cost histogram of the independent
  shortest-edge certificate.
- Each saved sample path is replayed physically. The samples are the
  worst-steps pose, the most-HTM pose, the first forced pose, and twelve
  pseudo-random poses per mode.

## Witness format (for the native checkers)

Two additive JSON schemas; the existing `cubistry.hsm-seconds-first` is unchanged.

**`cubistry.hsm-seconds-first-modes`, version 1** ([witness.json](witness.json)):

| Field | Meaning |
| --- | --- |
| `schema`, `version`, `label`, `printCode` | As in `cubistry.hsm-seconds-first`. `printCode` and `printing` must equal the base witness. |
| `universalArbitrarySourceHTM` | 6, the general bound of the base witness. |
| `edgeLimitHTM` | 5, the per-edge limit every application period obeys. |
| `printing` | 24 sticker records `{id, cubie, p, n, slot, image, up}`, identical to the base witness. |
| `modes` | 18 own periods in the order S, M, H × 59, 23, 11 × +1, −1. The entry format is that of `cubistry.hsm-seconds-first`. |
| `appModes` | 18 entries in the same order. |

Each `modes` entry has these fields:

- `letter`, `maximum` and `direction`;
- `htmCap`, the cap the certificate uses;
- `graphNodes`, `graphEdges` and `certificatePasses`;
- `optimalMeanHTM` (a fraction), `periodHTM`, `periodEdges` and
  `maximumHTM`;
- `appPolicy13`, a comparison only;
- `setup`, a word from the solved print to node 0, which shows 00;
- `periodStart` = 0;
- `periodStartFrames`, the 24 sticker frames of node 0;
- `steps`, a list of `{from, to, word}`. Node `i` shows
  `(direction · i) mod (maximum + 1)`, and `word` is a shortest word from the
  actual pose.

Each `appModes` entry has these fields:

- `letter`, `maximum` and `direction`;
- `sourceDirection`, the own period used;
- `traversal`: `"forward"`, or `"inverse"` (the steps reversed, every word
  inverted, the same setup and node 0);
- `periodHTM`, `periodEdges`, `perLapHTM` (a fraction) and `maximumHTM`, all
  ≤ 5.

**`cubistry.hsm-seconds-first-recovery`, version 1** ([recovery.json](recovery.json)):

The top level has `schema`, `version`, `label`, `printCode`,
`edgeLimitHTM` = 5, `objective` and `modes` (18, in the same order). Each
`modes` entry has these fields:

- `letter`, `maximum`, `direction`, `sourceDirection` and `traversal`;
- `graphNodes`, `edgesAtMostLimitOrForced`, `periodNodes` and
  `unreachable` = 0;
- `poseWithoutEdgeAtMostLimit`;
- `stepsHistogram` and `edgesAboveLimitHistogram`, objects from string
  counts to pose counts;
- `maximumSteps`, `meanSteps` and `maximumRecoveryHTM`;
- `samples`, a list of
  `{fromValue, setupFromSolved, steps, words}`:
  - `setupFromSolved` is a word from the solved print to the start pose;
  - `words` are the recovery steps; step `k` shows
    `fromValue + k · direction`.

Moves use `R L U D F B` with `''`, `2` and `'` in the standard sense.

## Reproduce

From the Research branch root, with gcc and standard-library Python 3:

```sh
cd research/hsm-counter/seconds-first/modes
gcc -O2 -o /tmp/sf-modes generate_modes.c -lm
/tmp/sf-modes "T0 T2 T4 | T1 T3 T5 | U3 U1 U9 | U8 S U5 | U2 U7 S | U4 U0 U6 | S H M | _ _ _" NEW-W.json NEW-R.json seconds-first-modes 12
python3 verify_modes.py --certify all --recovery-full all
python3 -m unittest discover -s . -p 'test_verify_modes.py' -v
```

Running the generator takes about 75 s; it refuses to overwrite and reproduces both files byte
for byte. [logs/generate-modes.log](logs/generate-modes.log) is its standard error. Full
verification takes about 13 minutes of CPU; its output is
[verification.json](verification.json). The unit tests take about one minute and
include adversarial controls:

- an own-period edge that is not shortest;
- a selection-rule violation;
- understated maxima and laps;
- a dropped or unclosed period;
- a changed print;
- a recovery edge above five;
- a recovery that stops short;
- understated step counts;
- incomplete histograms;
- hidden forced poses;
- a wrong traversal;
- a wrong full table.

[manifest.json](manifest.json) records hashes and the environment.

## Limits

- This is a settled-display mathematical result: no timing, artwork or
  application change.
- The setup word (8–10 HTM) is excluded from laps.
- Global print optimality stays UNKNOWN; see [../README.md](../README.md).
