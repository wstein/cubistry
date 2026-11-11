<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Window print for May 2026 through January 2037

Evidence for the long-chain workflow, whose default print path is
`research/calendar-7x7/row1-window-chain/evidence/window-2037-01/printing.tsv`.
Research candidate, not certified. Independent review is pending.

## What is committed

| File | Bytes | SHA-256 |
|---|---:|---|
| `printing.tsv` | 10308 | `2b5a068d2fe26d2813f643d61bddc7adcb43d50ced881acb6dd8ed7b9c4c23c6` |
| `front-matches.tsv` | 233751 | `5b60a91873da252f8e181a28d01f28eb1e41a7c32844c5191931c050bb16699a` |
| `print-julia.tsv`, `print-flix.tsv` | 11335 each | `b535d4b5781a485e8b0399b336b681d41745f620320f2ab56cbd860da78ac8a5` |
| `corner-2037-02-julia.tsv`, `corner-2037-02-flix.tsv` | 10669 each | `e402d1a2f9e0b4a217bdd8e0fdcd106b10db487cb53a87a73c0f7f030530808b` |
| `corner-2037-01-julia.tsv`, `corner-2037-01-flix.tsv` | 10607 each | `450d2b07172c33231817f23b2b758cb338467166fc3f20ead6e59cde536a3f5e` |

`printing.tsv` is one fixed print of all 294 surfaces on 218 bodies, in the format of
[window-2029-12](../window-2029-12/printing.tsv). `front-matches.tsv` lists 129 months times 49
cells (6321 rows): May 2026 through January 2037, start May 2026, window end 2037-01.
No chain is committed here. The greedy chain computed for this print (44342 HTM, about 2 MB with
its 129 snapshots) is not stored; it is to be replaced by a beam chain.

## What is established

- Fixed-print rigid front matching of all 129 months: Julia and Flix accept (`print-julia.tsv` and
  `print-flix.tsv` are byte-identical, verdict `SAT fixed-print-rigid-front-matching 129 6321
  legal-states=UNKNOWN chain=NOT_RUN`). The print checker alone does not establish legal states or a chain.
- Corner-lemma ceiling, window domain, profile `names-band`, start May 2026, from the
  [corner-coupling check](../../../row1-corner-coupling/README.md): for window end 2037-02 (130 months)
  the corner demand is 24 with band peak 1 in all 130 targets, and 23 > 21. Julia and Flix report
  `UNSAT fixed-print-corner-body-matching unique-always-visible-face`; the receipts are byte-identical.
  Within that model no permanent print covers the 130 targets May 2026 through February 2037.
- Corollary by monotonicity of the target set (the lemma is a subset certificate): any window whose
  targets contain all 130 of these (start January 2026 through May 2026, end 2037-02 or later) also
  has no permanent print in this model (UNSAT), because a print for it would be a print for the
  130 targets. The receipts prove only the 130-target case directly; this extension is an argument
  from containment, not a separate receipt. For 2037-01 the demand is 23 and the lemma does not apply (`UNKNOWN
  lemma-not-applicable`, receipts byte-identical); that says nothing against the print above.
- The UNSAT status is by the rule of `proof-checkers/AUTHORITY.md` (both native checkers accept) with
  one caveat: the committed Flix sources fix the window length (corner checker 21 months, print
  checker 21 months and 1029 cells). The receipts above come from Flix builds in which only that
  constant was changed (see Reproduction). The patched sources are not committed.

## UNKNOWN

- Windows that do not contain all 130 targets: starts after May 2026 (any end), and starts January
  through April 2026 with an end before 2037-02. Any ceiling claimed for them comes from a
  Julia-only demand scan with no Flix confirmation: UNKNOWN.
- Legal retained states and a move chain for this print: not covered by this directory.
- Provenance of `corner-2037-01-flix.tsv`: copied from the reviewer scratch of the frontier work (equal to the copy from the earlier jan2028-upward scratch). The author did not rebuild a 129-month corner jar; an independent reviewer did and reproduced it byte for byte.

## How the print was generated

`design.jl` (untrusted candidate producer, committed at `../../../row1-window-print/design.jl`; Z3 5.4.0 via
the native library, not committed) with an added seeding patch: the print for each end month was seeded from the print of the previous
SAT end (2033-12, 2034-12, 2035-12, 2036-04, 2036-11, then 2037-01), freezing a hash-selected
fraction of faces (0.8, salt 0 for 2037-01) to the seed artwork class. Z3 output is not evidence;
only the native checkers above validate the print. Only the seeding patch is not in the repository.

## Reproduction

Run from `research/calendar-7x7` with Julia 1.11.5 and JDK 21.

```sh
E=row1-window-chain/evidence/window-2037-01   # this directory
WINDOW_END=2037-01 julia --startup-file=no row1-window-print/check.jl row1-revision/layout.tsv \
  $E/printing.tsv $E/front-matches.tsv | cmp - $E/print-julia.tsv
WINDOW_END=2037-02 julia --startup-file=no row1-corner-coupling/check.jl row1-revision/layout.tsv \
  names-band window | cmp - $E/corner-2037-02-julia.tsv
```

Flix: copy `row1-window-print/flix/src/Main.flix` and `row1-corner-coupling/flix/src/Main.flix`
to a scratch tree and change the constants. Print checker: in the window `Main.flix`, 21 to 129
and 1029 to 6321 (the three lines that state them); in the corner `Main.flix`, `coupledGoalsN(labels,profile,
domain,oldRoot,21)` to `...,129)`. Corner checker for 2037-02: the same call with `130`. Build with
the existing `flix/build.sh` scripts and run the jar with `layout.tsv names-band window EVIDENCE`
(corner) or `layout.tsv printing.tsv front-matches.tsv EVIDENCE` and `WINDOW_END=2037-01`
(print). EVIDENCE is `research/calendar-7x7/english/evidence`. `WINDOW_END` has no effect on the Flix
jars (Flix reads no environment variable; the window length is the patched constant). Outputs must
equal the committed receipts.
