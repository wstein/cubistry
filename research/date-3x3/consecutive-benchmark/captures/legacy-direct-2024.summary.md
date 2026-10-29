# Consecutive calendar measurements

Evidence status: UNKNOWN; independent replay pending. Complete: true.

| Provider | Print | Scenario | Direction | Cases | Mean HTM | Max HTM | Mean elapsed ms | P95 elapsed ms |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| legacy | de-a | year | 1 | 366 | 66.40 | 82 | 6.06 | 9.01 |
| legacy | de-a | year | -1 | 366 | 66.40 | 82 | 6.30 | 8.84 |
| legacy | de-a | jumps | 0 | 14 | 74.29 | 80 | 9.47 | 20.75 |
| legacy | de-a | interrupt-move | 0 | 20 | 68.35 | 80 | 7.73 | 9.25 |
| legacy | de-a | interrupt-planning | 0 | 20 | 68.35 | 80 | 8.14 | 10.03 |
| legacy | en-3-zero | year | 1 | 366 | 64.05 | 82 | 6.04 | 8.02 |
| legacy | en-3-zero | year | -1 | 366 | 64.05 | 82 | 5.83 | 7.40 |
| legacy | en-3-zero | jumps | 0 | 14 | 57.86 | 79 | 5.48 | 7.73 |
| legacy | en-3-zero | interrupt-move | 0 | 20 | 64.45 | 81 | 7.01 | 8.65 |
| legacy | en-3-zero | interrupt-planning | 0 | 20 | 64.45 | 81 | 7.54 | 8.89 |
| legacy | en-3-unpadded | year | 1 | 366 | 64.10 | 82 | 5.81 | 7.58 |
| legacy | en-3-unpadded | year | -1 | 366 | 64.10 | 82 | 5.99 | 7.88 |
| legacy | en-3-unpadded | jumps | 0 | 14 | 60.29 | 79 | 5.64 | 7.20 |
| legacy | en-3-unpadded | interrupt-move | 0 | 20 | 59.35 | 80 | 6.99 | 8.79 |
| legacy | en-3-unpadded | interrupt-planning | 0 | 20 | 59.35 | 80 | 6.36 | 8.44 |
| direct | de-a | year | 1 | 366 | 21.98 | 41 | 138.09 | 323.76 |
| direct | de-a | year | -1 | 366 | 22.15 | 40 | 410.03 | 578.88 |
| direct | de-a | jumps | 0 | 14 | 27.50 | 39 | 88.17 | 171.82 |
| direct | de-a | interrupt-move | 0 | 20 | 27.35 | 40 | 94.96 | 186.24 |
| direct | de-a | interrupt-planning | 0 | 20 | 24.50 | 39 | 91.33 | 181.76 |
| direct | en-3-zero | year | 1 | 366 | 18.53 | 39 | 148.75 | 275.41 |
| direct | en-3-zero | year | -1 | 366 | 18.64 | 39 | 390.41 | 515.68 |
| direct | en-3-zero | jumps | 0 | 14 | 27.36 | 40 | 65.73 | 160.09 |
| direct | en-3-zero | interrupt-move | 0 | 20 | 24.10 | 40 | 68.84 | 118.64 |
| direct | en-3-zero | interrupt-planning | 0 | 20 | 19.70 | 37 | 61.41 | 126.95 |
| direct | en-3-unpadded | year | 1 | 366 | 18.74 | 40 | 108.77 | 241.94 |
| direct | en-3-unpadded | year | -1 | 366 | 18.43 | 40 | 222.39 | 337.91 |
| direct | en-3-unpadded | jumps | 0 | 14 | 23.57 | 41 | 64.17 | 146.66 |
| direct | en-3-unpadded | interrupt-move | 0 | 20 | 22.35 | 38 | 55.69 | 85.64 |
| direct | en-3-unpadded | interrupt-planning | 0 | 20 | 18.65 | 33 | 48.35 | 98.13 |

Node timings include planning and immediate physical-commit verification, not browser animation. Fallback includes an equally short existing reference, not necessarily solver failure. No universal move bound or optimality is established.
