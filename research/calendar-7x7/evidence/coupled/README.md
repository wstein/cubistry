# Exploratory coupled-front synthesis

These solver models are **not full-cube SAT certificates**. They ask whether a
fresh immutable printing can be assigned to coupled pieces so that each required
front has an injective piece matching. They do not prove legal reachability,
simultaneous whole-cube completion or the required canonical proof profile.

`results.json` retains bounded solver outcomes and extracted candidate printing
assignments, checked by a separate Julia augmenting-path matching routine. The
independent EN wing1 candidate is under `../../physical-review/` instead.

The inputs are losslessly gzip-compressed; `archive-manifest.json` records both
raw and compressed SHA-256. The hashes in result records refer to **raw SMT**.
`coupled_synthesis.jl` regenerates the inputs and uses the locally available
Z3 4.13.3 shared library through Julia's C API. No production dependency was added.

- `parser-attempt1-DE-corner.smt2.gz` is a **failed parser experiment** using a
  cardinality extension unsupported by this API. It produced no usable model.
- Later inputs use ordinary Boolean clauses for sequential at-most-one encoding.
- Each initial component solver call was bounded to 60 seconds. A timeout is
  UNKNOWN, never UNSAT.
- Tight-wing attempts used 30 seconds per branch. That exploratory search was
  stopped after an independent direct obstruction was found for DE and a
  front-matching candidate for EN. An input without a matching result record is
  an interrupted experiment, not a solver outcome.

The final DE contradiction does not depend on Z3 or these incomplete searches.
Its small raw certificate and native Julia/Flix checkers are in
`../../physical-review/` and `../../verification/flix/`.
