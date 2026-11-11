<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Window print for May 2026 through January 2037

Evidence for the long-chain workflow, whose default print path is
`research/calendar-7x7/row1-window-chain/evidence/window-2037-01/printing.tsv`.
Research candidate, not certified. Independent review is pending.

## What is committed

| File | Bytes | SHA-256 |
|---|---:|---|
| `printing.tsv` | 10308 | `5293fb1c525de83439e7b772f8132ae1695b17a1456fd025c56078efc15e844c` |
| `layout.tsv` | 226 | `e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a` |
| `front-matches.tsv` | 233751 | `5b60a91873da252f8e181a28d01f28eb1e41a7c32844c5191931c050bb16699a` |
| `print-julia.tsv`, `print-flix.tsv` | 11335 each | `c61a6123a8583e3fe9edc46ec152bb5d6195a78e86c2793b2430f2a50a6b5406` |
| `corner-2037-02-julia.tsv`, `corner-2037-02-flix.tsv` | 10658 each | `929bcccf04c0d0702be0b5e236f88e9597be094ed799ec6aa3c4cd54498da337` |
| `corner-2037-01-julia.tsv`, `corner-2037-01-flix.tsv` | 10596 each | `fadc842d56174c66baac1cca7093d92f79bfec6692dc50986d3a894d098656ea` |

`printing.tsv` is one fixed print of all 294 surfaces on 218 bodies, in the format of
[window-2029-12](../window-2029-12/printing.tsv). `front-matches.tsv` lists 129 months times 49
cells (6321 rows): May 2026 through January 2037, start May 2026, window end 2037-01.
No chain is committed here. The greedy chain computed for this print (44342 HTM, about 2 MB with
its 129 snapshots) is not stored; it is to be replaced by a beam chain.

## April labels (label-only change)

The owner changed the April month-name tiles from `APR`, `IL` to `AP`, `RIL`. The cubie assignment is
unchanged and nothing was recomputed: `printing.tsv` is the earlier print (sha256
`2b5a068d2fe26d2813f643d61bddc7adcb43d50ced881acb6dd8ed7b9c4c23c6`, kept for traceability) with two sticker texts
renamed, `APR` to `AP` (1 sticker) and `IL` to `RIL` (1 sticker), a bijection on the same bodies. No other
tile uses `AP` or `RIL`. `front-matches.tsv` holds no label text and is unchanged. The checkers read the target
text from the layout, so this directory carries `layout.tsv`: `../../../row1-revision/layout.tsv` with only the
April row changed to `AP`, `RIL`. The shared layout is not changed. Both checkers compare text by equality
(the half-turn table holds only `0`, `6`, `9`; `AP` and `RIL` use none of them), so artwork classes and matching
are unchanged by the rename. The receipts differ from the earlier ones only in the layout hash on the `input` line,
the hashes of the 10 April targets (they cover the front text), and the text `APR` to `AP` in the corner receipts.
`check-april-labels.sh` (run from the repository root) checks these statements against the earlier print.

The other chain evidence (`window-2029-12`, `beam-chain-2026-06`, the demo) stays on the earlier labels
`APR`, `IL`; its pins reference the earlier print (sha256 above) and the shared layout.

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
- Provenance of the Flix receipts: produced with the reviewer-built patched jars of the earlier review of this directory (Flix print checker 129 months, corner checker 129 and 130 months; their sources equal the committed ones except the constants). The author did not rebuild the jars.

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
WINDOW_END=2037-01 julia --startup-file=no row1-window-print/check.jl $E/layout.tsv \
  $E/printing.tsv $E/front-matches.tsv | cmp - $E/print-julia.tsv
WINDOW_END=2037-02 julia --startup-file=no row1-corner-coupling/check.jl $E/layout.tsv \
  names-band window | cmp - $E/corner-2037-02-julia.tsv
```

Flix: copy `row1-window-print/flix/src/Main.flix` and `row1-corner-coupling/flix/src/Main.flix`
to a scratch tree and change the constants. Print checker: in the window `Main.flix`, 21 to 129
and 1029 to 6321 (the three lines that state them); in the corner `Main.flix`, `coupledGoalsN(labels,profile,
domain,oldRoot,21)` to `...,129)`. Corner checker for 2037-02: the same call with `130`. Build with
the existing `flix/build.sh` scripts and run the jar with `$E/layout.tsv names-band window EVIDENCE`
(corner) or `$E/layout.tsv printing.tsv front-matches.tsv EVIDENCE` and `WINDOW_END=2037-01`
(print). EVIDENCE is `research/calendar-7x7/english/evidence`. `WINDOW_END` has no effect on the Flix
jars (Flix reads no environment variable; the window length is the patched constant). Outputs must
equal the committed receipts.
