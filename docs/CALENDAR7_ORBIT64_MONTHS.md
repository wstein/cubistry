# Calendar7 chain as an Orbit64 V2 monthly file (spec and plan)

Status: plan only. No generator and no data file exist. Nothing here is certified; the chain it describes is a research
candidate ([CALENDAR7_CHAIN_C.md](CALENDAR7_CHAIN_C.md)).

## Definition used here

"Orbit64 V2 monthly file" is the owner's working name (decision 2026-11-13: spec and plan only until the root is final). No
earlier document defines it. This plan reads it as: one record per Calendar7 chain month, holding the
[Orbit64 V2](https://github.com/wstein/flix-orbit64/blob/main/FORMAT-V2.md) token of that month's 7x7x7 cube state. If the owner
meant something else, only the "Export form" section changes.

## Inputs that exist

- The chain data January 1980 to January 2036: 673 states, 672 edges, root = solved cube = January 1980 (print D), pinned by
  SHA-256 in `public/calendar7/chain-c/` (wstein/cubistry#470, #471). The states are replayed from the root pose and the move words.
- Orbit64 V2 entries for 7x7x7 in the picture model: entry 20 (canonical) and entry 21 (framed), both 118 characters
  ([FORMAT-V2.md](https://github.com/wstein/flix-orbit64/blob/main/FORMAT-V2.md), registry table). The picture facelet bridge is
  merged (wstein/flix-orbit64#15, wstein/cubacle#20). The picture model is needed because the calendar stickers are distinct.
- Six months are best effort (1981-02, 1987-02, 1998-02, 2009-02, 2015-02, 2026-02): the cube state is the chain state, and it
  differs from the displayed month in cell (7,1). The token encodes the cube state, not the display.

## Decidable now

1. Record content per month: `month` (`YYYY-MM`), `state_sha256` (the chain node digest, links the record to the chain),
   `orbit64_v2` token. The digest lets a reader prove that a token belongs to a chain state.
2. Entry choice. Recommendation: publish the framed token (entry 21), because the root frame (solved cube, upright) is part of the
   month's identity and a canonical token (entry 20) loses the whole-cube orientation; add the canonical token as a second column
   only if a consumer asks for it. Converting framed to canonical is total and drops the frame; the reverse sets the frame rank to 0 on odd cubes (FORMAT-V2, frames).
3. Verification contract (independent of the generator): decode each token with the Flix reference decoder to facelets, re-derive
   the facelets from the chain state with the Julia side, and compare; require the token count to equal the month count, all
   tokens distinct, and a round trip token to facelets to token to be the identity.
4. Form. Recommendation: one UTF-8 TSV, header line, one row per month in chronological order, fields as in item 1, plus a
   `manifest.sha256` pin like `chain-c` and a `NOTICE.txt` reference. TSV is diff-friendly and consistent with the existing
   evidence files. JSON is the alternative if a browser must read it (the app uses `cubistry.calendar7.*` v1 JSON).
5. Home. Recommendation: data and its export script in this repository next to `chain-c/` (it derives from the chain pins);
   format and decoder stay in wstein/flix-orbit64. No change to FORMAT-V2 is needed.
6. Size: 673 rows of about 190 characters, roughly 130 KB uncompressed.

## Waits on the final root

- Token values. The state of a month is its pose relative to the root. Changing the root is a transformation of the whole chain
  (print identities, digests), so every token and `state_sha256` changes with it.
- Row count and range: now 1980-01 to 2036-01; the plan extends to 1900-01 backward and 2100-01 forward by running
  `root_change.jl` over all segments. The file covers the range that exists when the root is declared final.
- The pins (`manifest.sha256`, `source.sha256`), the best-effort list, and print D itself, which is not frozen.
- Definition of "final": print D frozen and the owner's statement of the range. Open question to the owner: does the 1980 root
  stay when the chain extends to 1900 and 2100, or can a later extension move it?

## Prototype evidence (not part of the repository)

An earlier scratch run (outside the repository, not re-run for this document) encoded 589 months of the 1987 to 2036 stage
states into entry 20 and 21 tokens: 589 distinct tokens of 118 characters in both entries, round trips accepted by the script.
It is feasibility evidence only and used the previous root.

## Plan after the root is final

1. Freeze root, range and print; record the final pins.
2. Generator `scripts/export-calendar7-orbit64-months.mjs` with `--check` (regenerates byte for byte), as for `chain-c`.
3. Independent Julia check of the tokens against the chain states, Flix decode of every token; both must accept; any dissent means
   UNKNOWN.
4. Data PR with the file, manifest and tests (count, order, distinctness, round trip).

## Open questions for the owner

1. Is the reading of "monthly file" above right (one token per chain month)?
2. Framed only (recommended), canonical only, or both columns?
3. TSV (recommended) or JSON?
4. Data in this repository (recommended) or in wstein/flix-orbit64?
5. What makes the root final: print D freeze, or also the 1900 and 2100 extension?
