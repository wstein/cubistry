# M/S counter

The separate **M/S Counter 00–59** application runs a minutes counter or a
seconds counter (M or S in the upper-right cell, two digits below, a genuinely
unprinted upper-left sticker) on print **S3** from research PR #138,
`research/ms-counter-3move`. Choose the unit, then use Set, single steps,
Reset, or Run/Stop. Run counts one step per second, up or down, wrapping
through 00. Changing the unit sets up a fresh 00 display; that setup is not a
counted step.

The research also accepts a second print, **M3** (minutes within 3 HTM,
seconds max 4 with 3 edges at 4). M3 exists in research PR #138 but is not in
the application: its files are neither copied nor pinned here, and the panel
has no print chooser.

## What is established

From the research README at the pinned commit, for S3 (the research's primary
witness):

- **Max 4 HTM per increment and per decrement, with only 3 edges at 4 HTM.**
  The seconds stay entirely within 3 HTM.
- **Max 3 HTM for both units is `UNKNOWN`.** It was not found and is not
  proven infeasible.

| Unit | Period |
| --- | --- |
| M (minutes) | 1 lap, 177 HTM, max 4 (3 edges at 4: 14→15, 35→36, 55→56) |
| S (seconds) | **2 laps** (120 edges), 324 HTM, max 3 |

The application's tests read these numbers from the converted runtime and
compare them with the README values.

## How the application counts

Each unit has one closed period of full poses (hidden stickers
included). Node *i* shows *i* mod 60. +1 plays the node's saved research word;
−1 plays the previous word inverted (reversed, every turn undone), which is the
exact inverse traversal that the research checkers replay. Down therefore
mirrors up, the 00 → 59 wrap included.

S3's seconds period has two laps: after 60 steps the display reads 00 again,
but the full pose differs; only after 120 steps does it return to the start.
The application follows the period node by node and shows the lap
("lap 1 of 2") under the controls.

Set and Reset walk the saved period, step by step, in the direction with fewer
HTM, to a node that shows the target (on S3's seconds, either lap). A route
that a newer target interrupts stops between two turns of a saved word. The
research words often cancel across step boundaries, so that pose can also lie
inside other steps, or be a period node itself. The planner records every such
place and continues from the one with the least HTM: it finishes or undoes the
partial word of that place, then walks whole steps either way round. The tests
compare every interrupted step of both units with an independent replay of all
shared poses. The application never plays a turn that is not a turn of a saved
word or of its inverse, so every settled display is a period node.

## Data and provenance

[ms-source.json](../ms-source.json) pins PR #138 at commit
`ee88e5725be8e5e1acf554d924ae9a6d5da43de3` with the SHA-256 of the README, the
S3 witness, its Julia and Flix receipts, its checks file, and both checkers. The
witness, receipts and checks file are byte-identical copies under
`data/ms/research/`.

`scripts/ms/convert-witness.mjs` replays the witness with its own integer
rotation model, checks every display, the inverse of every word, closure at the
claimed period and its minimality, and cross-checks both receipts (byte
identity, witness digest, per-letter totals, maxima, setups, inverse verdicts)
and the checks file (identical receipt digest; every negative control rejected
by both checkers with the same message). `scripts/prepare-ms.mjs` writes the
runtime `public/ms-counter.v1.json` and its digest; nothing in it is edited by
hand.

```sh
node scripts/prepare-ms.mjs --check --require-commit   # or: npm run verify:ms
node scripts/prepare-ms.mjs --pin <commit>             # re-pin in one command
```

The app loads the runtime only when its SHA-256 equals the pin, then replays
every period with the application's own cube mechanics before use.

## Boundaries

- The conversion is a data-integrity gate, not a proof. The research Julia and
  Flix checkers are the authority. The application's tests do not run them;
  they were re-run once at the pinned commit with
  `checker/run-checks.sh` (Julia 1.13.3, Flix 0.79.0 on Java 21). Both
  accepted S3 (and M3, which the app does not use), and the S3 receipts and
  checks file they produced were byte-identical to the pinned copies.
- The research README lists each corner's faces in the generator's order. The
  converted print code follows the witness's x, y, z faces; the per-corner
  sticker sets agree, which a test checks.
- No sticker sheets are generated for S3 yet.
- Letter switching at values other than 00 is not optimized (as in the research).
