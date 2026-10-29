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

## Results: preserve the existing print for now

Six prints have **SAT** witnesses for all 2,562 distinct Gregorian front displays,
including exact visible center orientation. The baseline regeneration is identical
to the existing runtime print and every one of its 2,562 complete target poses;
`captures/baseline-equivalence.json` records the independently checked hashes.
The measurements below use regenerated catalogs from the same deterministic
front/body completion algorithm. They compare print/catalog packages under the
same bounded solver; they do not establish globally optimal print assignments.

| Print | Weekday corner pairing | Weekday edge pairing | All fronts | Pilot total / mean / max HTM | Year total / mean / max HTM | Change in year total |
| --- | --- | --- | --- | --- | --- | --- |
| c0-e0 baseline | MD / FS | OI / RA | SAT | 500 / 21.739 / 39 | 14,167 / 19.354 / 41 | baseline |
| c1-e0 | MF / DS | OI / RA | SAT | 442 / 19.217 / 38 | 13,903 / 18.993 / 40 | −1.86% |
| c2-e0 | MS / DF | OI / RA | SAT | 450 / 19.565 / 39 | 13,866 / 18.943 / 40 | −2.12% |
| c0-e1 | MD / FS | OR / IA | SAT | 455 / 19.783 / 36 | 14,481 / 19.783 / 40 | +2.22% |
| c0-e2 | MD / FS | OA / IR | SAT | 499 / 21.696 / 41 | not shortlisted | UNKNOWN |
| c1-e1 | MF / DS | OR / IA | SAT | 491 / 21.348 / 39 | 14,804 / 20.224 / 41 | +4.50% |
| c1-e2 | MF / DS | OA / IR | UNKNOWN | not measured | not measured | UNKNOWN |
| c2-e1 | MS / DF | OR / IA | UNKNOWN | not measured | not measured | UNKNOWN |
| c2-e2 | MS / DF | OA / IR | UNKNOWN | not measured | not measured | UNKNOWN |

The pilot contains 23 requests: daily November counting, a requested date jump,
and leap/month/year boundaries. It deliberately remains a separate result from
the year experiment. Each year measurement is 366 consecutive forward daily
steps from January 1, 2024, through January 1, 2025, followed immediately by 366
reverse steps to the starting date. There is no physical reset at reversal.
All 732 transitions count; initial setup and checked solver warmup are separate.
Each of the five year paths uses 142 whole-cube rotation tokens, reported
separately from HTM. These rotations are not additional face turns.

| Print | Forward total / mean / max HTM | Reverse total / mean / max HTM |
| --- | --- | --- |
| c0-e0 | 7,169 / 19.587 / 40 | 6,998 / 19.120 / 41 |
| c1-e0 | 6,980 / 19.071 / 40 | 6,923 / 18.915 / 40 |
| c2-e0 | 6,944 / 18.973 / 40 | 6,922 / 18.913 / 40 |
| c0-e1 | 7,332 / 20.033 / 40 | 7,149 / 19.533 / 40 |
| c1-e1 | 7,538 / 20.596 / 41 | 7,266 / 19.852 / 40 |

The small full-year gain does not justify changing the default physical print
on this evidence. The apparently stronger pilot gains (c1-e0: 11.6%) do not
generalize to the continuous year. November 3→4, 2026, is 18 HTM on the existing
print and 17 on c1-e0/c2-e0 under both measured pilot source histories. This is a
one-turn print difference; the earlier 37→18 improvement belongs to the solver.
Maximum daily routes remain about 40 HTM with this policy. No short-turn guarantee
has been established by rearranging these weekday labels.

### Conditions and limits

- Application snapshot: `3d4c179308b74b1242eaf17cafd4e1d70400b587`, clean.
  The parent verified that its runtime equals portfolio snapshot `1ef2ffc`;
  the final change updates a browser-test upper-bound assertion only.
- Planner policy: portfolio; default center search then shorter depth-18 attempt,
  each limited to 100,000 nodes, total 200,000; default maximum depth 24,
  direct threshold 14. Node captures use the real application controller and
  planner without simulated animation delays. They do not exercise browser
  scheduling, rendering, or the browser worker's hard eight-second deadline.
- Every transition records its complete actual retained source pose/reference,
  returned word, final pose hash, diagnostics and elapsed planning wall time.
  The independent Rodrigues replay checks all 54 frames, the exact desired date,
  chain continuity and inverse restoration. Eight mutated-capture controls are
  rejected. `results.json` contains per-print totals, timing distributions and
  capture hashes; timing is shared-machine wall time, not isolated CPU cost.
- Color roles and upright glyph positions are preserved on the physical source
  stickers. The candidate assignments change actual printed glyphs, not rendering.
  This research adds no app behavior and changes no production or printable asset.
- Each date has one generated canonical completion. Searching alternative valid
  hidden completions on the **unchanged** print remains a distinct, promising
  optimization track. A global partial-goal solver may reduce these counts without
  reprinting. This experiment does not measure that track or prove its optimum.
- Only one leap-year continuous path and the explicit pilot were timed. Finite
  front feasibility covers all Gregorian display tuples, but move statistics do
  not cover every possible retained source, repeated year, or arbitrary jump.
- Definitions without verified witnesses remain UNKNOWN. A layout not shortlisted
  is not disproved. No capacity argument is presented as a global UNSAT proof.

### Safe center-copy hypothesis (not a measured improvement)

The original center stickers 30 and 43 are blank. German A always displays a
nonblank day-tens center. Replacing those two immutable blank stickers with extra
`0` and `1` centers therefore preserves every old valid date pose and its old
paths, provided the same physical body/orientation is embedded. The new matching
goal set contains the old set, so the *optimal partial-goal distance from an old
pose* cannot increase. It does not follow that a greedy or bounded controller's
chosen future paths improve. Both new center up orientations must be fixed in
an actual candidate and validated, and additional center-compatible completions
must actually be selected before claiming any gain. No such gain is measured
here; blindly replaying the old catalog would not exploit the added labels.
Unused-in-catalog edge stickers do not enjoy the same safe argument: other valid
old completions may already rely on those blanks or duplicate letters.

### Recheck the saved evidence

Run from the repository root; capture input paths are repository-relative:

```sh
python3 research/date-3x3/layout-optimization-de/verify.py baseline /path/to/pinned-app/public/calendar/de-a.json
python3 research/date-3x3/layout-optimization-de/verify.py research/date-3x3/layout-optimization-de/captures/year-four-2024.json
python3 research/date-3x3/layout-optimization-de/verify.py research/date-3x3/layout-optimization-de/captures/year-combined-2024.json
python3 research/date-3x3/layout-optimization-de/test_verify.py research/date-3x3/layout-optimization-de/captures/pilot-five-2026.json
python3 research/date-3x3/layout-optimization-de/summarize.py
```

The first un-warmed investigation pilot was provisional (504 baseline versus 442
c1-e0 HTM). It is superseded by the saved warmed 500-versus-442 pilot, not mixed
into the table. An initial sandbox refusal to spawn local Git was an environment
failure, not a rejected layout. The checked runs used an authorized local-process
execution context. No external service, deployment or printer order was invoked.
