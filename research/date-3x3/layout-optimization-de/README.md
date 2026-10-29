# German A fixed-print move optimization

Status: **UNKNOWN**. This experiment asks whether a new immutable sticker
assignment can reduce continuous German calendar move counts while retaining
German A's exact front grammar: two left-aligned weekday letters, a middle-row
leading-zero day, and three separate bottom-row month letters. All nonblank
images stay upright. No runtime relabeling, digit aliases or hidden overlays are
allowed.

The existing colored weekday/day/month roles remain the primary print model.
Letter-monochrome experiments, if any, are separate aesthetic tradeoffs. Capacity
and heuristic scores are not feasibility or move-count proofs.

Baseline source is the pinned `de-a.json` print and 2,562 target words in the
application checkout. The new bounded portfolio planner is a separate baseline:
its already demonstrated 18-turn November 3→4 route cannot be credited to a new
print. Existing evidence remains immutable.

Research proceeds by inventorying actual front usage and immutable labels, then
checking candidate print changes against all original target words. New matching
goal completions must be independently replayed before reporting improved moves.
Adding unused glyphs alone does not establish a speedup. Final candidates need
continuous counting, wrap cases, source hashes and the same search policy/budget.

Run the inventory with Node 24:

```sh
node research/date-3x3/layout-optimization-de/inventory.mjs /path/to/de-a.json /tmp/NEW-inventory.json
```

No production printing, application, workflow or deployment is changed here.

## Exact structural restriction

For an upright nonblank front sticker, the two rigid invariants
`p·up` and `p·(up×n)` equal its front row and column coordinates. A
weekday glyph cannot become a bottom-row month glyph merely by using the same
ink. Blank stickers are the exception because their up direction is unconstrained.
The independent finite checker validates all 216 oriented facelet frames against
all 24 proper rotations.

The German front requires four weekday-prefix corner tokens and 18 distinct
month/corner-position tokens. Every prefix co-occurs with every month token, so
the two classes cannot share physical corner bodies. Six bodies are needed for
months, leaving exactly two for weekdays and blanks. An exhaustive 1,440-case
assignment check rejects the one-blank possibility. The valid two-blank
assignments reduce to exactly three pairings: `MD|FS`, `MF|DS`, `MS|DF`.
This fixes only the weekday-body partition under the stated grammar; it does not
prove the original print globally optimal, nor exhaust month grouping, chirality,
edge pairing, center copies or move trajectories.

```sh
python3 research/date-3x3/layout-optimization-de/check_structure.py
```

## Candidate and measurement boundaries

Canonical variants change only the four weekday-prefix corner labels and/or the
four weekday-second-letter edge labels. `c0/c1/c2` mean `MD|FS`, `MF|DS`,
`MS|DF`; `e0/e1/e2` mean `OI|RA`, `OR|IA`, `OA|IR`. The current month/day
printing, colors, front grammar and permanent glyph orientations remain fixed.
A definition without a saved, independently checked witness is still UNKNOWN.

The witness generator is a research-only adaptation of the existing date witness
generator; it uses the installed application's pinned cubing dependency. The
separate Python validator calls the unchanged standard-library Rodrigues checker,
then verifies captured retained-pose paths, all 54 frames and inverses.

```sh
CUBISTRY_APP_ROOT=/path/to/pinned-app node research/date-3x3/layout-optimization-de/generate-witness.mjs research/date-3x3/layout-optimization-de/candidates/c1-e0/constructive.json /tmp/NEW-witness.json 2562
python3 research/date-3x3/layout-optimization-de/verify.py coverage research/date-3x3/layout-optimization-de/candidates/c1-e0
node research/date-3x3/layout-optimization-de/measure.mjs /path/to/pinned-app /tmp/NEW-pilot.json research/date-3x3/layout-optimization-de/candidates/c0-e0/witness.json research/date-3x3/layout-optimization-de/candidates/c1-e0/witness.json
python3 research/date-3x3/layout-optimization-de/verify.py /tmp/NEW-pilot.json
DE_YEAR=1 node research/date-3x3/layout-optimization-de/measure.mjs /path/to/pinned-app /tmp/NEW-year.json research/date-3x3/layout-optimization-de/candidates/c0-e0/witness.json research/date-3x3/layout-optimization-de/candidates/c1-e0/witness.json
```

Each measured variant gets a separate, checked October 28→29 warmup, recorded
outside the counted paths. The year path is 366 forward plus 366 reverse steps
without resetting at reversal; the leap/year boundary is included. Every print
uses the same portfolio policy and node limits. Physical source references and
actual move words are retained. Timing and solver soft-budget effects remain
machine-dependent. Finite path results do not prove global print optimality.
