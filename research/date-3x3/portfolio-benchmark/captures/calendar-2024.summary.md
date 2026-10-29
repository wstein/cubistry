# Consecutive calendar measurements

Evidence status: UNKNOWN; independent replay pending. Complete: true.

| Provider | Print | Scenario | Direction | Cases | Mean HTM | Max HTM | Mean elapsed ms | P95 elapsed ms |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| baseline-center | de-a | year | 1 | 366 | 20.16 | 40 | 75.36 | 166.01 |
| baseline-center | de-a | year | -1 | 366 | 20.28 | 41 | 71.34 | 173.09 |
| baseline-center | de-a | jumps | 0 | 14 | 24.93 | 40 | 121.32 | 214.63 |
| baseline-center | de-a | interrupt-move | 0 | 20 | 21.60 | 39 | 173.02 | 228.23 |
| baseline-center | de-a | interrupt-planning | 0 | 20 | 23.10 | 39 | 123.38 | 226.54 |
| baseline-center | en-3-zero | year | 1 | 366 | 17.34 | 39 | 61.98 | 184.70 |
| baseline-center | en-3-zero | year | -1 | 366 | 17.45 | 39 | 57.36 | 159.83 |
| baseline-center | en-3-zero | jumps | 0 | 14 | 25.14 | 40 | 110.21 | 188.18 |
| baseline-center | en-3-zero | interrupt-move | 0 | 20 | 20.65 | 38 | 173.99 | 357.48 |
| baseline-center | en-3-zero | interrupt-planning | 0 | 20 | 19.00 | 37 | 99.23 | 180.47 |
| baseline-center | en-3-unpadded | year | 1 | 366 | 17.27 | 40 | 60.74 | 165.89 |
| baseline-center | en-3-unpadded | year | -1 | 366 | 17.43 | 40 | 54.92 | 149.09 |
| baseline-center | en-3-unpadded | jumps | 0 | 14 | 21.00 | 40 | 116.77 | 184.78 |
| baseline-center | en-3-unpadded | interrupt-move | 0 | 20 | 19.45 | 36 | 155.15 | 311.41 |
| baseline-center | en-3-unpadded | interrupt-planning | 0 | 20 | 18.05 | 33 | 97.21 | 168.00 |
| portfolio | de-a | year | 1 | 366 | 19.59 | 40 | 126.81 | 271.39 |
| portfolio | de-a | year | -1 | 366 | 19.12 | 41 | 108.37 | 249.50 |
| portfolio | de-a | jumps | 0 | 14 | 24.79 | 40 | 176.32 | 260.97 |
| portfolio | de-a | interrupt-move | 0 | 20 | 20.60 | 25 | 293.18 | 404.96 |
| portfolio | de-a | interrupt-planning | 0 | 20 | 22.95 | 39 | 170.52 | 267.31 |
| portfolio | en-3-zero | year | 1 | 366 | 16.03 | 38 | 120.16 | 302.43 |
| portfolio | en-3-zero | year | -1 | 366 | 16.02 | 38 | 113.19 | 281.81 |
| portfolio | en-3-zero | jumps | 0 | 14 | 25.14 | 40 | 178.83 | 300.46 |
| portfolio | en-3-zero | interrupt-move | 0 | 20 | 20.35 | 38 | 310.70 | 665.14 |
| portfolio | en-3-zero | interrupt-planning | 0 | 20 | 18.20 | 37 | 204.84 | 324.67 |
| portfolio | en-3-unpadded | year | 1 | 366 | 16.03 | 40 | 125.53 | 311.20 |
| portfolio | en-3-unpadded | year | -1 | 366 | 15.98 | 40 | 114.87 | 289.32 |
| portfolio | en-3-unpadded | jumps | 0 | 14 | 21.00 | 40 | 199.77 | 346.97 |
| portfolio | en-3-unpadded | interrupt-move | 0 | 20 | 19.45 | 38 | 284.82 | 598.15 |
| portfolio | en-3-unpadded | interrupt-planning | 0 | 20 | 17.25 | 20 | 186.65 | 307.67 |

Node timings include planning and immediate physical-commit verification, not browser animation. Fallback includes an equally short existing reference, not necessarily solver failure. No universal move bound or optimality is established.
