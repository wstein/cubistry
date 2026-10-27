# Cubistry

A browser-first engine for twisty-puzzle artwork and display states.

## Chronocube feasibility spike

Can one immutable sticker printing on a physical 5×5×5 display every valid
2020–2049 calendar date and every minute in both German and English?

Results for the specified layout, abbreviations, and **binding row colors**:

- **Combined DE+EN: UNSAT**.
- **English alone: UNSAT**: at least 26 coupled wing cubies would be required.
- **German alone: UNSAT**: at least 25 would be required; the cube has 24.

These proofs permit all glyph rotations; optical symmetry is not prohibited.
Read the [current color-aware proofs](docs/SINGLE_LANGUAGE.md) and
[combined proof](docs/FEASIBILITY.md).

The earlier [one-color investigation](docs/MONOCHROME.md) is preserved:
German is SAT if the row-color requirement is removed, using a circular zero.
That construction does **not** satisfy the required colors.
Machine-readable current and reference results are in [results](results/).

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
