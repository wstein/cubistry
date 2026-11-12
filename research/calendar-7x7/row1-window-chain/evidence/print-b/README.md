<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Print B: printing-S2 with April tiles AP and RIL

Research candidate, not certified; independent review is pending. Whether the print is frozen is the owner's decision.

`printing.tsv` is [`../window-skip/printing-S2.tsv`](../window-skip/printing-S2.tsv) with two sticker texts renamed, `APR` to `AP`
and `IL` to `RIL` (one sticker each, same bodies). `layout.tsv` is `../../../row1-revision/layout.tsv` with only the April row
changed (byte-identical to [`../window-2037-01/layout.tsv`](../window-2037-01/layout.tsv)). The front matches
(`../month-list/front-matches-S2.tsv`) and month lists hold no label text and are reused. SHA-256 values: `sha256.txt`.

Receipts (Julia = Flix, byte-identical): `print-B-{julia,flix}.tsv` (286 months, SAT, legal states UNKNOWN, chain NOT_RUN) and
`corner-{S2,S2-chain,2026-02,2043-02}-{julia,flix}.tsv`. They differ from `../month-list` only in the layout hash on the `input`
line and in the hashes of the April targets.

`julia test_print_b.jl` checks the bijection, the layout, the hash file and replays the Julia receipts (about 20 s).
Reproduction, from `research/calendar-7x7` (`ML=row1-window-chain/evidence/month-list`, `P=row1-window-chain/evidence/print-b`):

```sh
CAL7_WINDOW_MONTHS=$ML/months-S2.tsv CAL7_WINDOW_MONTHS_SHA256=$(awk '$2=="months-S2.tsv"{print $1}' $ML/sha256.txt) \
  julia --startup-file=no row1-window-print/check.jl $P/layout.tsv $P/printing.tsv $ML/front-matches-S2.tsv | cmp - $P/print-B-julia.tsv
```

Corner receipts use `row1-corner-coupling/check.jl $P/layout.tsv names-band window` with the month list and pin of the
same name in `$ML`. Flix: the jars of `row1-window-print/flix/build.sh` and `row1-corner-coupling/flix/build.sh` with the
arguments of `run_month_list_receipts.sh` part B and `$P/layout.tsv` / `$P/printing.tsv` in place of the old files.
