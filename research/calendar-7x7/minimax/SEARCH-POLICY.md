# Bounded minimax search policy after checkpoint review

This follow-up corrects the experimental solver at checkpoint
`ca3b918`. The saved checkpoint evidence is unchanged. New output remains a
candidate until both unchanged native chain validators accept its raw input.
There is no completeness, global optimality, 100–120 HTM, or 200-HTM guarantee.

## Prefix costs and labels

Each expanded node retains its actual normalized legal word. Its ranking cost is
that word's HTM, rather than the sum of isolated macro costs. Neither additive
macro cost nor normalized prefix HTM is a lower bound on a continuation: a later
macro may cancel a suffix. Neither value is used to prune against the incumbent.

Orbit search distinguishes exact normalized-prefix labels even at an identical
physical endpoint. Different prefixes can cancel differently with a continuation.
The finite beam width, depth and expansion budget can still discard useful
candidates. The ranking heuristic is not an admissible optimality certificate.

At month boundaries, complete physical endpoints share future possibilities.
Their trajectory labels contain maximum edge HTM, total HTM and the sum of
squared edge HTM. Componentwise dominated labels are removed; nondominated labels
are retained before the global chain-width cap. Keeping only the first endpoint
or its smallest current maximum would lose useful total-cost tradeoffs.

The frozen, native-verified R3 chain is always an incumbent. A bounded search
that fails or returns a worse trajectory cannot silently replace it with the
older, longer R2 baseline. Search failure is reported separately from exporting
a retained checkpoint. The supplemental midge probe follows the same rule.

## Resource budgets

`budget` counts **beam action expansions per orbit-search call**. It does not
include the greedy incumbent, catalogue construction or relaxation, calendar
validation, sequence normalization outside beam expansion, or export.

The greedy incumbent can scan all actions up to 24 times. `SearchStats` separately
counts greedy action scans, beam attempts and beam normalizations. A zero beam
budget therefore does not imply zero computation. The catalogue relaxation
budget is separate and is applied independently to orbits 4, 7 and 10.

Allocation figures count cumulative allocated bytes; they are not peak resident
memory. Timings and memory must be recorded again after a solver change and must
not be copied from the pre-correction checkpoint experiments.

## Regression checks

The tests exercise legal two-macro words whose individually counted cost is four
HTM but whose concatenation simplifies to two HTM, below a three-HTM incumbent.
A second case begins with a four-HTM prefix and reaches the same two-HTM result.
They also check endpoint Pareto tradeoffs and pre-export length validation.
Length mismatches must fail before opening a file, preserving existing evidence.

Both the unrelaxed catalogue and the actual 60,000-attempt relaxation budget are
checked against legal generator replay, immutable orbit actions and native move
metrics. These are solver software tests, not substitutes for Julia and Flix
verification of adopted calendar chains.
