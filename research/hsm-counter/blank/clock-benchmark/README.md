# Live clock playback measurement

Recorded by `tests/browser/live-clock.spec.mjs` from implementation commit
`9a28519` on `feat/live-hms-clock`. The trace contains 33 actual physical move
presentations and three midnight endpoint states, with their common requested
monotonic endpoint. The observed hour/minute/second lateness was 2.4/0.7/56.1 ms.
These are measurements from one Chromium/SwiftShader run, not a universal
real-time guarantee. The original blank-print feasibility proof is unchanged.

The standalone benchmark is retained here because research evidence belongs on
this branch. The feature branch owns the runnable browser regression.
