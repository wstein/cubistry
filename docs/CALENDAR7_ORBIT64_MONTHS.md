# Calendar7 chain as an Orbit64 V2 monthly file (spec and plan)

Status: plan only. No generator and no data file exist. Nothing here is certified; the chain it describes is a research
candidate ([CALENDAR7_CHAIN_C.md](CALENDAR7_CHAIN_C.md)).

## Definition used here

"Orbit64 V2 monthly file" is the owner's working name (decision 2026-11-13: spec and plan only until the root is final). No
earlier document defines it. This plan reads it as: one record per Calendar7 chain month, holding the
[Orbit64 V2](https://github.com/wstein/flix-orbit64/blob/main/FORMAT-V2.md) token of that month's 7x7x7 cube state.
The owner confirmed this reading on 2026-11-13.

## Inputs that exist

- The chain data January 1980 to January 2036: 673 states, 672 edges, root = solved cube = January 1980 (print D), pinned by
  SHA-256 in `public/calendar7/chain-c/` (wstein/cubistry#470, wstein/cubistry#471). The states are replayed from the root pose and the move words.
- Orbit64 V2 entries for 7x7x7 in the picture model: entry 20 (canonical) and entry 21 (framed), both 118 characters
  ([FORMAT-V2.md](https://github.com/wstein/flix-orbit64/blob/main/FORMAT-V2.md), registry table). The picture facelet bridge is
  merged (wstein/flix-orbit64#15, wstein/cubacle#20). The picture model is needed because the calendar stickers are distinct.
- Six months are best effort (1981-02, 1987-02, 1998-02, 2009-02, 2015-02, 2026-02): the cube state is the chain state, and it
  differs from the displayed month in cell (7,1). The token encodes the cube state, not the display. The composed chain
  1900-01 to 2036-01 is expected to have 14 best-effort months (13 from the backward chain plus 2026-02); UNKNOWN until the
  root change ran.


## Decided (owner, 2026-11-13)

1. Reading: one record per chain month with the Orbit64 V2 token of the 7x7x7 picture cube.
2. Token form: framed (entry 21) and canonical (entry 20) as a second column.
3. Form: one TSV with `manifest.sha256`, independent Julia and Flix verification.
4. Home: this repository, next to `chain-c/` (decided = cubistry, not wstein/flix-orbit64). Format and decoder stay in
   wstein/flix-orbit64; no change to FORMAT-V2 is needed.
5. Final root (owner had no preference, recommendation used): the backward chain to 1900-01 and the root change that belongs
   to it. The root change yields a new print' (the 1900-01 print), and that print' is the one to freeze. Print D (print C
   relabeled to the 1980 root) is meant only where the 1980 root is meant. The 2100 forward extension is added later as an additive file part and does not move the root.

## Decidable now

1. Record content per month: `month` (`YYYY-MM`), `state_sha256` (the chain node digest, links the record to the chain),
   `orbit64_v2_framed` (entry 21) and `orbit64_v2_canonical` (entry 20). The digest lets a reader prove that a token belongs to
   a chain state. Converting framed to canonical is total and drops the frame; the reverse sets the frame rank to 0 on odd
   cubes (FORMAT-V2, frames), so both columns are kept.
2. Verification contract (independent of the generator): decode each token with the Flix reference decoder to facelets, re-derive
   the facelets from the chain state with the Julia side, and compare; require the token count to equal the month count, the
   canonical token to equal the conversion of the framed token, and a round trip token to
   facelets to token to be the identity.
3. File: UTF-8 TSV, header line, one row per month in chronological order, plus `manifest.sha256` like `chain-c` and a
   `NOTICE.txt` reference. The 2100 extension is a further part of the same form (additive file), not an edit of existing rows.
4. Size, two token columns: a row is 7 + 64 + 118 + 118 = 307 characters plus 3 tabs = 310, plus a line feed = 311 bytes
   (ASCII). 673 rows today: 209,303 bytes; 1633 rows for 1900-01 to 2036-01: 507,863 bytes (about 508 KB); each plus one
   header line (my arithmetic, not measured).
5. Distinctness: all tokens distinct per column is an expectation for the canonical column (the prototype covered 589 months
   only); the generator check decides.

## Waits on the final root

- Token values. The state of a month is its pose relative to the root. Changing the root is a transformation of the whole chain
  (print identities, digests), so every token and `state_sha256` changes with it.
- Row count and range: now 1980-01 to 2036-01; the final file starts at 1900-01 after `root_change.jl` ran over all segments.
- The pins (`manifest.sha256`, `source.sha256`), the best-effort list, and the 1900-01 print', which is not frozen.
- State of the 1900-01 backward chain (2026-11-14): computed, not committed. Window-chain run 43542652089 (success) computed
  2019-01 back to 1900-01 on print C: 1428 edges, 1429 months, complete, 23 segment runs, width 40, lambda 3, Julia and Flix
  tables byte-identical, 1415 exact and 13 best-effort months, no greedy edges, independent root check ACCEPT. The result is not
  yet committed to the research branch, `root_change.jl` has not run on it, no print is frozen, and the forward chain 2036 to
  2100 has not started. The remaining blockers: commit the evidence, run the root change, freeze the resulting 1900-01 print'.

## Prototype evidence (not part of the repository)

An earlier scratch run (outside the repository, not re-run for this document) encoded 589 months of the 1987 to 2036 stage
states into entry 20 and 21 tokens: 589 distinct tokens of 118 characters in both entries, round trips accepted by the script.
It is feasibility evidence only and used the previous root.

## Plan after the root is final

1. Freeze the 1900-01 print', its range and the root; record the final pins.
2. Generator `scripts/export-calendar7-orbit64-months.mjs` with `--check` (regenerates byte for byte), as for `chain-c`.
3. Independent Julia check of the tokens against the chain states, Flix decode of every token; both must accept; any dissent means
   UNKNOWN.
4. Data PR with the file, manifest and tests (count, order, distinctness, round trip).


## Open questions for the owner

None from the 2026-11-13 answers. Open item outside this document: committing the 1900-01 backward chain evidence, the root
change and the freeze of the resulting 1900-01 print' are prerequisites, not decisions.
