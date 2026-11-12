<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Print C: printing-C1980 with April tiles AP and RIL (long chain)

Research candidate, not certified; independent review is pending. Whether the print is frozen is the owner's decision.

`printing.tsv` is [`../config-coverage/printing-C1980.tsv`](../config-coverage/printing-C1980.tsv) with two sticker texts renamed:
sticker 63 `APR` to `AP` and sticker 235 `IL` to `RIL` (one sticker each, same bodies, same cubie assignment; no other byte differs).
`layout.tsv` is [`../print-b/layout.tsv`](../print-b/layout.tsv) (same bytes, April = AP, RIL; SHA-256 `e9a409ea...2b62a`).
SHA-256 values: `sha256.txt`. The old evidence files are unchanged.

Root of the long chain: the solved cube, January 2019 (first chain January 2019 to January 2036). The identity front of this print
is the January/Tuesday/31 board; January 1980, January 2019 and January 2030 share that configuration. `months.jl` accepts months from
2026-01 only, so the test builds the identity board with 2030-01 (same configuration) and checks weekday and length of 2019-01 and
1980-01 with `Dates`. No run with root 2019-01 was made.

Receipt `print-config-C-julia.tsv`: the repository print checker (`../window-skip/skip_check.jl print`) on the new layout and print,
with the 90 months of `../config-coverage/front-matches-config-C1980.tsv` (one month per matchable configuration): SAT, 90 targets,
4410 cells. The match file is reused unchanged: recomputing all matchings with the new layout and print (`ConfigTable.build`)
gives a byte-identical `front-matches-config-C1980.tsv`. The receipt differs from `../config-coverage/print-config-C1980-julia.tsv`
only in the `input` line (layout and print hash) and in the seven April target hashes.
February/Sunday/28 stays NOMATCH (best effort), as in `config-table.tsv` column `C1980_status`; not recomputed here.

Not verified: Flix receipts (a separate later PR; nothing here is Flix-confirmed, so it is UNKNOWN as evidence); legal cube states;
any chain run (root 2019-01 or other); the 286-month matching of the designer; the best-effort cells of February/Sunday/28 on this
print; spelling and link checks, CI, workflows.

`julia test_print_c.jl` (Julia 1.11.5 or 1.13.3, about 50 s) checks the two-row difference, the layout pin, the hash file, the identity
front and replays the receipt.
