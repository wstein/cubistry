# Consecutive calendar measurements

Evidence status: UNKNOWN; independent replay pending. Complete: true.

| Provider | Print | Scenario | Direction | Cases | Mean HTM | Max HTM | Mean elapsed ms | P95 elapsed ms |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| baseline-center | de-a | year | 1 | 366 | 20.05 | 35 | 79.53 | 164.00 |
| baseline-center | de-a | year | -1 | 366 | 19.75 | 34 | 62.52 | 149.63 |
| baseline-center | de-a | jumps | 0 | 14 | 23.93 | 34 | 119.44 | 214.67 |
| baseline-center | de-a | interrupt-move | 0 | 20 | 21.20 | 31 | 176.43 | 241.58 |
| baseline-center | de-a | interrupt-planning | 0 | 20 | 21.25 | 34 | 131.67 | 233.61 |
| baseline-center | en-3-zero | year | 1 | 366 | 17.13 | 34 | 65.33 | 185.72 |
| baseline-center | en-3-zero | year | -1 | 366 | 17.14 | 31 | 55.89 | 152.14 |
| baseline-center | en-3-zero | jumps | 0 | 14 | 23.71 | 35 | 106.24 | 180.34 |
| baseline-center | en-3-zero | interrupt-move | 0 | 20 | 20.00 | 31 | 159.23 | 343.18 |
| baseline-center | en-3-zero | interrupt-planning | 0 | 20 | 18.65 | 33 | 94.99 | 187.24 |
| baseline-center | en-3-unpadded | year | 1 | 366 | 17.05 | 34 | 59.62 | 155.44 |
| baseline-center | en-3-unpadded | year | -1 | 366 | 17.18 | 34 | 58.49 | 167.92 |
| baseline-center | en-3-unpadded | jumps | 0 | 14 | 20.50 | 33 | 111.89 | 179.83 |
| baseline-center | en-3-unpadded | interrupt-move | 0 | 20 | 19.15 | 30 | 152.19 | 316.30 |
| baseline-center | en-3-unpadded | interrupt-planning | 0 | 20 | 17.90 | 30 | 100.04 | 175.33 |
| portfolio | de-a | year | 1 | 366 | 19.19 | 35 | 99.41 | 191.01 |
| portfolio | de-a | year | -1 | 366 | 18.91 | 34 | 96.81 | 206.53 |
| portfolio | de-a | jumps | 0 | 14 | 23.79 | 34 | 167.87 | 293.97 |
| portfolio | de-a | interrupt-move | 0 | 20 | 20.60 | 25 | 247.54 | 327.62 |
| portfolio | de-a | interrupt-planning | 0 | 20 | 21.10 | 34 | 173.00 | 325.96 |
| portfolio | en-3-zero | year | 1 | 366 | 16.01 | 32 | 103.87 | 256.33 |
| portfolio | en-3-zero | year | -1 | 366 | 15.95 | 33 | 95.68 | 239.63 |
| portfolio | en-3-zero | jumps | 0 | 14 | 23.71 | 35 | 180.05 | 297.40 |
| portfolio | en-3-zero | interrupt-move | 0 | 20 | 19.80 | 34 | 259.11 | 401.35 |
| portfolio | en-3-zero | interrupt-planning | 0 | 20 | 18.00 | 33 | 167.00 | 279.91 |
| portfolio | en-3-unpadded | year | 1 | 366 | 15.96 | 34 | 109.49 | 266.15 |
| portfolio | en-3-unpadded | year | -1 | 366 | 16.01 | 34 | 96.40 | 228.65 |
| portfolio | en-3-unpadded | jumps | 0 | 14 | 20.50 | 33 | 192.04 | 320.45 |
| portfolio | en-3-unpadded | interrupt-move | 0 | 20 | 19.05 | 30 | 242.21 | 421.69 |
| portfolio | en-3-unpadded | interrupt-planning | 0 | 20 | 17.25 | 20 | 166.88 | 312.08 |

Node timings include planning and immediate physical-commit verification, not browser animation. Fallback includes an equally short existing reference, not necessarily solver failure. No universal move bound or optimality is established.
