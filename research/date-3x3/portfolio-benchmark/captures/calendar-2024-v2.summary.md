# Consecutive calendar measurements

Evidence status: UNKNOWN; independent replay pending. Complete: true.

| Provider | Print | Scenario | Direction | Cases | Mean HTM | Max HTM | Mean elapsed ms | P95 elapsed ms |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| baseline-center | de-a | year | 1 | 366 | 20.16 | 40 | 72.00 | 145.15 |
| baseline-center | de-a | year | -1 | 366 | 20.28 | 41 | 63.82 | 150.80 |
| baseline-center | de-a | jumps | 0 | 14 | 24.93 | 40 | 117.99 | 215.53 |
| baseline-center | de-a | interrupt-move | 0 | 20 | 21.60 | 39 | 168.59 | 226.30 |
| baseline-center | de-a | interrupt-planning | 0 | 20 | 23.10 | 39 | 114.89 | 178.51 |
| baseline-center | en-3-zero | year | 1 | 366 | 17.34 | 39 | 60.86 | 168.17 |
| baseline-center | en-3-zero | year | -1 | 366 | 17.45 | 39 | 54.99 | 155.85 |
| baseline-center | en-3-zero | jumps | 0 | 14 | 25.14 | 40 | 107.18 | 176.14 |
| baseline-center | en-3-zero | interrupt-move | 0 | 20 | 20.65 | 38 | 155.63 | 325.93 |
| baseline-center | en-3-zero | interrupt-planning | 0 | 20 | 19.00 | 37 | 93.80 | 158.13 |
| baseline-center | en-3-unpadded | year | 1 | 366 | 17.27 | 40 | 57.86 | 157.90 |
| baseline-center | en-3-unpadded | year | -1 | 366 | 17.43 | 40 | 54.04 | 152.05 |
| baseline-center | en-3-unpadded | jumps | 0 | 14 | 21.00 | 40 | 111.52 | 169.36 |
| baseline-center | en-3-unpadded | interrupt-move | 0 | 20 | 19.45 | 36 | 151.14 | 310.24 |
| baseline-center | en-3-unpadded | interrupt-planning | 0 | 20 | 18.05 | 33 | 99.00 | 183.32 |
| portfolio | de-a | year | 1 | 366 | 19.59 | 40 | 101.71 | 204.25 |
| portfolio | de-a | year | -1 | 366 | 19.12 | 41 | 90.74 | 198.53 |
| portfolio | de-a | jumps | 0 | 14 | 24.79 | 40 | 170.79 | 299.87 |
| portfolio | de-a | interrupt-move | 0 | 20 | 20.60 | 25 | 226.78 | 300.21 |
| portfolio | de-a | interrupt-planning | 0 | 20 | 22.95 | 39 | 154.07 | 274.74 |
| portfolio | en-3-zero | year | 1 | 366 | 16.03 | 38 | 95.67 | 231.58 |
| portfolio | en-3-zero | year | -1 | 366 | 16.02 | 38 | 93.57 | 219.36 |
| portfolio | en-3-zero | jumps | 0 | 14 | 25.14 | 40 | 171.80 | 298.06 |
| portfolio | en-3-zero | interrupt-move | 0 | 20 | 20.35 | 38 | 241.51 | 426.63 |
| portfolio | en-3-zero | interrupt-planning | 0 | 20 | 18.20 | 37 | 160.36 | 274.35 |
| portfolio | en-3-unpadded | year | 1 | 366 | 16.03 | 40 | 98.65 | 242.44 |
| portfolio | en-3-unpadded | year | -1 | 366 | 15.98 | 40 | 91.81 | 210.21 |
| portfolio | en-3-unpadded | jumps | 0 | 14 | 21.00 | 40 | 174.40 | 271.30 |
| portfolio | en-3-unpadded | interrupt-move | 0 | 20 | 19.45 | 38 | 216.87 | 368.87 |
| portfolio | en-3-unpadded | interrupt-planning | 0 | 20 | 17.25 | 20 | 150.55 | 271.85 |

Node timings include planning and immediate physical-commit verification, not browser animation. Fallback includes an equally short existing reference, not necessarily solver failure. No universal move bound or optimality is established.
