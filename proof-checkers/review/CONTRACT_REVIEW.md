# Independent Issue 74 contract and corpus review

Reviewed frozen contract/corpus through
`45b54b5ee862c9fc1a0597734b76b403773b6c06` in a detached checkout. No author source
files were changed. Engine implementations are not yet covered by this report.

## Verified data and mathematical scope

Final corpus manifest SHA-256:
`c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01`.
Independent pin audit passes 195 raw fixtures: 41 counter cases and 154 marked
3×3 cases, plus the exact 801-value/800-transition chain, 36 center generators
and all 2,048 even-parity center kernel references.

The reviewer independently implemented full-body rigidity, proper-frame center
normalization, ordered corner twist/edge flip extraction, corner/edge permutation
parity, physical center parity and optical period checks, using only the historical
independent Rodrigues primitive for legal group actions. No production solver,
checker implementation or generator engine was imported. It agrees with all
129 valid and 25 invalid marked fixtures. All 36 generators and 2,048 kernel words
match pinned complete-frame digests, center tuples, inverse restoration and physical
reachability checks. Both oracle source bytes match their frozen provenance hashes.

All 41 counter incumbent outcomes were independently rerun; two accepted cases
produce their exact expected full-state digests. The six stricter-policy differences
match the disclosed ledger exactly: Boolean unpadded coordinate, duplicate key,
exponent/float schema and rounded/underflow witness values. The exact historical
chain was independently regenerated and compared, rather than trusting a length
alone. Reordered witnesses with every specified Python whitespace separator still
pass the unchanged incumbent checker.

## Findings resolved before engine hardening

1. Arbitrary image strings were allowed, but canonical hash escaping was defined
   only for ASCII fixtures. The contract now specifies exact compact ASCII JSON
   escaping, consistent with Python `ensure_ascii=True`: lowercase Unicode escapes
   and UTF-16 surrogate-pair escapes for supplementary scalar values, no Unicode
   normalization. Invalid UTF-8 and unpaired decoded surrogates are rejected.
   BMP/supplementary, quote/backslash/control/DEL fixtures and literal-versus-escaped
   UTF-8 aliases now pin this policy. Independently verified both aliases decode to
   identical states and expected hashes while their raw file hashes differ.
2. Whitespace tokenization was language-dependent. The contract now pins the exact
   incumbent Python separator set and tests it in a valid raw counter certificate.
3. Parser resource boundaries now explicitly count the root container as depth one
   and numeric token length including sign/fraction/exponent punctuation. The
   independent implementation review will test these boundaries separately.

No unresolved contract or corpus blocker remains. The contract properly distinguishes
complete ports of the two named groups from unsupported proof formats, arbitrary
solver claims or a replacement of existing Python/CI gates. Optical equivalence
cannot erase physical center parity. Kernel reference length is provenance, not an
optimality or animation bound. XYZ actions remain physically replayed/countable.

## Additional implementation probes prepared

Ten reviewer-owned probes outside the shared corpus exercise reversed input arrays,
permuted sticker/body labels, arbitrary reference print-up, combined Unicode escaping,
64/65 total container depth and 128/129-byte numeric tokens in ignored metadata.
These do not modify corpus pins or expand the authorized two-group scope.

Executable Julia/Flix review, independent raw-CLI/full-state comparisons and complete
conformance lifecycle measurements remain pending. No review publication, Ready
transition, merge, deployment or producer/solver adaptation was performed.
