# Cubistry

A browser-first engine for twisty-puzzle artwork and display states.

## Chronocube feasibility spike

Can one immutable sticker printing on a physical 5×5×5 display every valid
2020–2049 calendar date and every minute in both German and English?

**Latest result: German is SAT with the original separate row colors if
single-digit days use a leading space (` 3OKT`) instead of zero (`03OKT`).**
No date/time ink merger is needed in that mode. The fixed 150-sticker printing
and exact simultaneous physical reachability are independently verified.
English and combined DE+EN remain UNSAT.

Read [the day-padding proof and new printing plan](docs/DAY_PADDING.md).
The quarter-turn reuse now concerns blanks; movable printed characters can
all remain upright. The shared font still uses a circular fixed-center zero.

For the original `03OKT` format, the [palette investigation](docs/PALETTE.md)
shows that merging only date/time digit ink suffices for German. Year digits,
letters, separator, and colon may retain separate colors; A/B/C each have a
SAT witness. Keeping distinct date/time digit inks is impossible in the
documented glyph model. All 150 source print angles are supplied for both modes.

The [original row-color proofs](docs/SINGLE_LANGUAGE.md),
[one-color reference](docs/MONOCHROME.md), and
[combined impossibility](docs/FEASIBILITY.md) remain scoped to zero padding.
Machine-readable certificates and printing CSVs are in [results](results/).

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
