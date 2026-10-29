# Consecutive calendar measurements

Evidence status: UNKNOWN; independent replay pending. Complete: true.

| Provider | Print | Scenario | Direction | Cases | Mean HTM | Max HTM | Mean elapsed ms | P95 elapsed ms |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| legacy | de-a | year | 1 | 366 | 66.40 | 82 | 5.21 | 6.68 |
| legacy | de-a | year | -1 | 366 | 66.40 | 82 | 5.18 | 6.62 |
| legacy | de-a | jumps | 0 | 14 | 74.29 | 80 | 7.94 | 14.52 |
| legacy | de-a | interrupt-move | 0 | 20 | 68.35 | 80 | 7.83 | 9.49 |
| legacy | de-a | interrupt-planning | 0 | 20 | 68.35 | 80 | 7.65 | 9.54 |
| legacy | en-3-zero | year | 1 | 366 | 64.05 | 82 | 6.78 | 11.22 |
| legacy | en-3-zero | year | -1 | 366 | 64.05 | 82 | 5.95 | 7.81 |
| legacy | en-3-zero | jumps | 0 | 14 | 57.86 | 79 | 6.01 | 8.03 |
| legacy | en-3-zero | interrupt-move | 0 | 20 | 64.45 | 81 | 7.44 | 9.26 |
| legacy | en-3-zero | interrupt-planning | 0 | 20 | 64.45 | 81 | 8.48 | 10.14 |
| legacy | en-3-unpadded | year | 1 | 366 | 64.10 | 82 | 5.93 | 7.76 |
| legacy | en-3-unpadded | year | -1 | 366 | 64.10 | 82 | 6.18 | 8.28 |
| legacy | en-3-unpadded | jumps | 0 | 14 | 60.29 | 79 | 7.49 | 23.24 |
| legacy | en-3-unpadded | interrupt-move | 0 | 20 | 59.35 | 80 | 7.69 | 9.49 |
| legacy | en-3-unpadded | interrupt-planning | 0 | 20 | 59.35 | 80 | 6.73 | 8.36 |
| direct | de-a | year | 1 | 366 | 21.98 | 41 | 42.24 | 105.20 |
| direct | de-a | year | -1 | 366 | 22.15 | 40 | 51.94 | 148.29 |
| direct | de-a | jumps | 0 | 14 | 27.50 | 39 | 174.42 | 333.28 |
| direct | de-a | interrupt-move | 0 | 20 | 27.35 | 40 | 151.29 | 276.02 |
| direct | de-a | interrupt-planning | 0 | 20 | 24.50 | 39 | 130.54 | 268.59 |
| direct | en-3-zero | year | 1 | 366 | 18.53 | 39 | 75.34 | 174.68 |
| direct | en-3-zero | year | -1 | 366 | 18.61 | 39 | 43.77 | 93.50 |
| direct | en-3-zero | jumps | 0 | 14 | 27.36 | 40 | 118.70 | 299.15 |
| direct | en-3-zero | interrupt-move | 0 | 20 | 24.10 | 40 | 137.07 | 223.71 |
| direct | en-3-zero | interrupt-planning | 0 | 20 | 19.70 | 37 | 96.17 | 158.01 |
| direct | en-3-unpadded | year | 1 | 366 | 18.74 | 40 | 52.81 | 111.47 |
| direct | en-3-unpadded | year | -1 | 366 | 18.43 | 40 | 46.28 | 96.77 |
| direct | en-3-unpadded | jumps | 0 | 14 | 23.57 | 41 | 139.45 | 369.85 |
| direct | en-3-unpadded | interrupt-move | 0 | 20 | 22.35 | 38 | 90.56 | 126.12 |
| direct | en-3-unpadded | interrupt-planning | 0 | 20 | 18.65 | 33 | 75.41 | 146.13 |
| center-aware | de-a | year | 1 | 366 | 20.16 | 40 | 73.39 | 162.44 |
| center-aware | de-a | year | -1 | 366 | 20.28 | 41 | 82.31 | 203.91 |
| center-aware | de-a | jumps | 0 | 14 | 24.93 | 40 | 117.66 | 197.23 |
| center-aware | de-a | interrupt-move | 0 | 20 | 21.60 | 39 | 172.05 | 232.22 |
| center-aware | de-a | interrupt-planning | 0 | 20 | 23.10 | 39 | 114.37 | 178.57 |
| center-aware | en-3-zero | year | 1 | 366 | 17.34 | 39 | 61.17 | 170.43 |
| center-aware | en-3-zero | year | -1 | 366 | 17.45 | 39 | 54.31 | 153.56 |
| center-aware | en-3-zero | jumps | 0 | 14 | 25.14 | 40 | 98.50 | 162.36 |
| center-aware | en-3-zero | interrupt-move | 0 | 20 | 20.65 | 38 | 156.19 | 341.74 |
| center-aware | en-3-zero | interrupt-planning | 0 | 20 | 19.00 | 37 | 92.50 | 162.26 |
| center-aware | en-3-unpadded | year | 1 | 366 | 17.27 | 40 | 67.53 | 197.96 |
| center-aware | en-3-unpadded | year | -1 | 366 | 17.43 | 40 | 66.75 | 195.53 |
| center-aware | en-3-unpadded | jumps | 0 | 14 | 21.00 | 40 | 111.15 | 179.20 |
| center-aware | en-3-unpadded | interrupt-move | 0 | 20 | 19.45 | 36 | 152.60 | 309.07 |
| center-aware | en-3-unpadded | interrupt-planning | 0 | 20 | 18.05 | 33 | 97.11 | 171.16 |

Node timings include planning and immediate physical-commit verification, not browser animation. Fallback includes an equally short existing reference, not necessarily solver failure. No universal move bound or optimality is established.
