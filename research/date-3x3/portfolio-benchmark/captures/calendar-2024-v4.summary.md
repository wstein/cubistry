# Consecutive calendar measurements

Evidence status: UNKNOWN; independent replay pending. Complete: true.

| Provider | Print | Scenario | Direction | Cases | Mean HTM | Max HTM | Mean elapsed ms | P95 elapsed ms |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| baseline-center | de-a | year | 1 | 366 | 19.82 | 34 | 79.42 | 181.61 |
| baseline-center | de-a | year | -1 | 366 | 19.64 | 33 | 71.44 | 181.23 |
| baseline-center | de-a | jumps | 0 | 14 | 23.50 | 34 | 116.29 | 204.57 |
| baseline-center | de-a | interrupt-move | 0 | 20 | 21.10 | 29 | 180.98 | 246.71 |
| baseline-center | de-a | interrupt-planning | 0 | 20 | 21.10 | 33 | 123.34 | 206.58 |
| baseline-center | en-3-zero | year | 1 | 366 | 17.07 | 33 | 67.86 | 198.23 |
| baseline-center | en-3-zero | year | -1 | 366 | 17.04 | 30 | 53.25 | 155.79 |
| baseline-center | en-3-zero | jumps | 0 | 14 | 23.43 | 34 | 114.44 | 239.51 |
| baseline-center | en-3-zero | interrupt-move | 0 | 20 | 20.00 | 31 | 161.55 | 331.97 |
| baseline-center | en-3-zero | interrupt-planning | 0 | 20 | 18.30 | 31 | 108.97 | 222.29 |
| baseline-center | en-3-unpadded | year | 1 | 366 | 17.05 | 33 | 60.36 | 164.08 |
| baseline-center | en-3-unpadded | year | -1 | 366 | 17.09 | 33 | 57.46 | 160.61 |
| baseline-center | en-3-unpadded | jumps | 0 | 14 | 20.50 | 33 | 125.53 | 197.99 |
| baseline-center | en-3-unpadded | interrupt-move | 0 | 20 | 19.15 | 30 | 158.32 | 356.06 |
| baseline-center | en-3-unpadded | interrupt-planning | 0 | 20 | 17.65 | 25 | 105.07 | 182.61 |
| portfolio | de-a | year | 1 | 366 | 19.15 | 34 | 98.59 | 195.37 |
| portfolio | de-a | year | -1 | 366 | 18.83 | 34 | 95.37 | 200.60 |
| portfolio | de-a | jumps | 0 | 14 | 23.36 | 34 | 161.33 | 250.39 |
| portfolio | de-a | interrupt-move | 0 | 20 | 20.60 | 25 | 241.46 | 317.41 |
| portfolio | de-a | interrupt-planning | 0 | 20 | 20.95 | 33 | 162.84 | 271.20 |
| portfolio | en-3-zero | year | 1 | 366 | 16.00 | 32 | 105.02 | 256.41 |
| portfolio | en-3-zero | year | -1 | 366 | 15.94 | 31 | 95.53 | 233.03 |
| portfolio | en-3-zero | jumps | 0 | 14 | 23.43 | 34 | 155.95 | 252.58 |
| portfolio | en-3-zero | interrupt-move | 0 | 20 | 19.70 | 32 | 245.21 | 400.62 |
| portfolio | en-3-zero | interrupt-planning | 0 | 20 | 17.90 | 31 | 159.32 | 268.93 |
| portfolio | en-3-unpadded | year | 1 | 366 | 15.96 | 33 | 103.37 | 255.09 |
| portfolio | en-3-unpadded | year | -1 | 366 | 16.00 | 33 | 96.89 | 226.51 |
| portfolio | en-3-unpadded | jumps | 0 | 14 | 20.50 | 33 | 189.11 | 276.07 |
| portfolio | en-3-unpadded | interrupt-move | 0 | 20 | 18.90 | 27 | 220.79 | 396.61 |
| portfolio | en-3-unpadded | interrupt-planning | 0 | 20 | 17.25 | 20 | 170.05 | 283.42 |

Node timings include planning and immediate physical-commit verification, not browser animation. Fallback includes an equally short existing reference, not necessarily solver failure. No universal move bound or optimality is established.
