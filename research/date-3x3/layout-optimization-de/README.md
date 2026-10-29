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
