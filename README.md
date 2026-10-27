# Cubistry

A browser-first engine for twisty-puzzle artwork and display states.

## Chronocube feasibility spike

Can one immutable sticker printing on a physical 5×5×5 display every valid
2020–2049 calendar date and every minute in both German and English?

**Result: UNSAT for the specified layout and abbreviations.** One invariant
24-sticker wing orbit needs at least 26 printed symbols.

Read [the proof and assumptions](docs/FEASIBILITY.md). The machine-readable
certificate is [results/feasibility.json](results/feasibility.json).

With Node ≥22, npm ≥10, and Python ≥3.10:

```sh
npm ci --cache /tmp/cubistry-npm-cache --ignore-scripts
npm run check
```

The small experiment uses ReScript for display conventions and labeled cubie
geometry, Node for enumeration, and an independent dependency-free Python
verifier. It does not implement a frontend or a move-sequence optimizer.

## License

AGPL-3.0-or-later.
