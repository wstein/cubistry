# Cubistry

A browser-first engine for twisty-puzzle artwork and display states.

## Chronocube feasibility spike

Can one immutable sticker printing on a physical 5×5×5 display every valid
2020–2049 calendar date and every minute in both German and English?

**Historical-year layout:** with the year split as `19·89` / `20·26`
(the dot is an unprinted fixed center), one printing supports thousands blank/1/2
and hundreds **0,9,8,7**. Two further candidates support an additional **6**
or **1**. All are independently SAT with the original colors and wordmark.
The exact maximum is five complete hundreds classes in this layout; six require
25 axial centers but only 24 exist. See [the ranges and proof](docs/SPLIT_CENTURY.md).

**Year extension:** a single fixed colored wordmark printing now covers
**2000–2099**, independently verified. Seven additional gray decade stickers
suffice. See [year capacity and the fixed-center limit](docs/YEAR_CAPACITY.md)
for historical-year implications and the remaining four unprinted axial centers.

**New result: zero-padded German dates (`09OKT`) also work with the wordmark,
two-digit hours, red date digits, blue time digits, and blank outer row-4 cells.**
A new 24-wing printing is independently certified SAT for every date/minute.
See [the constructive proof and printing plan](docs/ZERO_DAY_WORDMARK.md).
The following earlier space-day results and their reserve claims remain separate.

**Branding extension:** the preferred German design also remains SAT with
three distinct upright wordmark image fragments across row 4's interior centers.
Outer cells stay blank, original calendar/time colors and 22 verified reserve
printing positions are retained. See [WORDMARK.md](docs/WORDMARK.md) for the
new proof, full printing plan, orientation requirements, and artwork scope.

**Space-day matrix: with space-padded dates (` 3OKT`), all four hour/separator
combinations are SAT for German with the original separate row colors.**

| Hours | Separator | DE | EN | EN+DE |
| --- | --- | --- | --- | --- |
| `09:37` | `─────` | SAT | UNSAT | UNSAT |
| ` 9:37` | `─────` | SAT | UNSAT | UNSAT |
| `09:37` | `·───·` | SAT | UNSAT | UNSAT |
| ` 9:37` | `·───·` | SAT | UNSAT | UNSAT |

Dots mean unprinted blanks. EN/EN+DE verdicts are scoped to the documented
configurations; they are not general calendar-cube impossibility claims.
Read the [matrix, full proof review, reserve counts, and printing plans](docs/COMPACT_FORMAT.md).
The two-digit-hour/short-separator variant is certified, with at least 22
simultaneously reservable printing positions (a conservative bound).

Every DE row also has a seven-component-ink witness. All nonfixed printed
glyphs may remain upright; rotational reuse uses blanks. A circular front
fixed-center zero remains part of the font model.

Previous [day-padding](docs/DAY_PADDING.md), [palette](docs/PALETTE.md),
[original row-color](docs/SINGLE_LANGUAGE.md), [monochrome](docs/MONOCHROME.md),
and [combined](docs/FEASIBILITY.md) results retain their explicit scopes.
Machine-readable certificates and 150-sticker CSV plans are in [results](results/).

With Node ≥22, npm ≥10, Python ≥3.10, and SymPy 1.14.0:

```sh
python3 -m venv --system-site-packages .venv
. .venv/bin/activate
python3 -m pip install --cache-dir /tmp/cubistry-pip-cache -r requirements-verifier.txt
npm ci --cache /tmp/cubistry-npm-cache --ignore-scripts
npm run check
```

The small experiment uses ReScript for display conventions and labeled cubie
geometry, Node for enumeration, and independent Python verifiers with exact SymPy group calculations. It does not implement a frontend or a move-sequence optimizer.

## License

AGPL-3.0-or-later.
