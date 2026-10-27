# Cubistry

A browser-first engine for twisty-puzzle artwork and display states.

## Chronocube feasibility spike

Can one immutable sticker printing on a physical 5×5×5 display every valid
2020–2049 calendar date and every minute in both German and English?

Results for the specified layout and abbreviations:

- **Combined DE+EN: UNSAT**, by a 26-in-24 sticker-orbit contradiction.
- **English alone: UNSAT**, even allowing arbitrary glyph orientations.
- **German alone: SAT**, with one fixed printing using a circular zero and
  independently verified simultaneous physical reachability.

Read the [combined proof](docs/FEASIBILITY.md) and
[single-language proofs and construction](docs/SINGLE_LANGUAGE.md).
Machine-readable results and the full physical design are in
[results](results/). The optical rules are shared by both languages.

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
