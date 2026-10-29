# Retained capture artifacts

`legacy-direct-2024.*` contains the complete original 4,716-request run at the
source revisions documented in [the baseline note](../BASELINE.md). Raw capture,
manifest and command log bytes are preserved; verification files were added
separately after capture. The generation-time UNKNOWN field is historical.

`kernel-2048.json` and `kernel-2048-replay.json` retain the separate reviewer's
all-center-kernel witness and replay result for the pinned shared provider.
`export-kernel.mjs` and `replay-kernel.py` are the reviewer's execution
helpers, parameterized after review for equivalent local checkouts. Use the pinned
package source root and corpus path shown in [the independent review](../INDEPENDENT_REVIEW.md).
They are separate from the general benchmark CLI.

`consumer-independent.json` and `compaction-smoke-*` retain review results for
the consumer and the bounded pilot, not full new-provider yearly measurements.
`final-providers-2024.*` retains the complete final comparison, author verification, and analysis; `final-comparison-2024.*-independent.json` retains the separate reviewer checks. See [comparison](../COMPARISON.md) for exact revisions and interpretation. No
pilot or kernel result establishes a universal calendar move bound.
