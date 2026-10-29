# Derived consecutive-calendar comparison

Capture SHA256: `3753b6ec0aec44068fd2dc9aa23481c7abf001f6b6f025265f60f0a6ff96af84`.

| Provider | Print | Direction | Mean HTM | Median | p95 | Max | Mean QTM | Mean xyz | Mean ms | p95 ms | Max ms | Max source tokens |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| legacy | de-a | inc | 66.396 | 62 | 80 | 82 | 97.831 | 0.194 | 5.21 | 6.68 | 22.24 | 43 |
| legacy | de-a | dec | 66.396 | 62 | 80 | 82 | 97.831 | 0.194 | 5.18 | 6.62 | 14.59 | 42 |
| legacy | en-3-zero | inc | 64.052 | 60 | 80 | 82 | 91.962 | 0.041 | 6.78 | 11.22 | 13.86 | 42 |
| legacy | en-3-zero | dec | 64.052 | 60 | 80 | 82 | 91.962 | 0.041 | 5.95 | 7.81 | 18.59 | 42 |
| legacy | en-3-unpadded | inc | 64.101 | 61 | 79 | 82 | 93.230 | 0.041 | 5.93 | 7.76 | 9.19 | 42 |
| legacy | en-3-unpadded | dec | 64.101 | 61 | 79 | 82 | 93.230 | 0.041 | 6.18 | 8.28 | 20.04 | 42 |
| direct | de-a | inc | 21.981 | 19 | 38 | 41 | 32.180 | 0.194 | 42.24 | 105.20 | 282.47 | 307 |
| direct | de-a | dec | 22.148 | 19 | 38 | 40 | 32.705 | 0.194 | 51.94 | 148.29 | 414.21 | 325 |
| direct | en-3-zero | inc | 18.530 | 17 | 35 | 39 | 27.290 | 0.041 | 75.34 | 174.68 | 775.85 | 322 |
| direct | en-3-zero | dec | 18.615 | 17 | 36 | 39 | 27.421 | 0.041 | 43.77 | 93.50 | 627.52 | 352 |
| direct | en-3-unpadded | inc | 18.743 | 17 | 37 | 40 | 27.596 | 0.041 | 52.81 | 111.47 | 736.44 | 334 |
| direct | en-3-unpadded | dec | 18.432 | 17 | 36 | 40 | 27.169 | 0.041 | 46.28 | 96.77 | 433.24 | 339 |
| center-aware | de-a | inc | 20.161 | 18 | 37 | 40 | 29.224 | 0.194 | 73.39 | 162.44 | 2262.73 | 329 |
| center-aware | de-a | dec | 20.276 | 18 | 38 | 41 | 29.027 | 0.194 | 82.31 | 203.91 | 403.58 | 322 |
| center-aware | en-3-zero | inc | 17.342 | 16 | 24 | 39 | 25.240 | 0.041 | 61.17 | 170.43 | 434.03 | 353 |
| center-aware | en-3-zero | dec | 17.451 | 16 | 24 | 39 | 25.410 | 0.041 | 54.31 | 153.56 | 244.46 | 316 |
| center-aware | en-3-unpadded | inc | 17.273 | 16 | 24 | 40 | 25.120 | 0.041 | 67.53 | 197.96 | 419.30 | 361 |
| center-aware | en-3-unpadded | dec | 17.434 | 16 | 24 | 40 | 25.317 | 0.041 | 66.75 | 195.53 | 449.88 | 319 |

## legacy

{
  "requestGroups": 2358,
  "fallbackGroups": 2358,
  "obsoletePhysicalTurns": 60,
  "canceledPlans": 0,
  "maximumEndpointReferenceTokens": 42,
  "preturnReferenceReplacements": 0,
  "endpointReferenceReplacements": 0,
  "strictlyImprovedPlans": 0,
  "totalCandidateMovesSaved": 0,
  "diagnosticOutcomes": [
    {
      "backend": null,
      "attempted": null,
      "status": null,
      "count": 2478
    }
  ],
  "maximumHTMGroup": {
    "index": 32,
    "design": "de-a",
    "scenario": "year",
    "fromISO": "2024-02-02",
    "toISO": "2024-02-03",
    "counts": {
      "total": 82,
      "htm": 82,
      "qtm": 102,
      "global": 0
    },
    "word": "F' R F' R' F' R F' R' F' R F' R' F' R F' R' F' R F' R' U F2 D' F' U' F L' U L F2 B2 L2 F2 U' L2 D F2 U L2 U2 F2 U' F2 L2 R2 D' L2 U2 R2 F2 R2 B2 U' L D F' L' D' L F' L2 D R F R' F R F R' F R F R' F R F R' F R F R' F"
  }
}

## direct

{
  "requestGroups": 2358,
  "fallbackGroups": 0,
  "obsoletePhysicalTurns": 60,
  "canceledPlans": 60,
  "maximumEndpointReferenceTokens": 352,
  "preturnReferenceReplacements": 374,
  "endpointReferenceReplacements": 230,
  "strictlyImprovedPlans": 0,
  "totalCandidateMovesSaved": 0,
  "diagnosticOutcomes": [
    {
      "backend": "direct",
      "attempted": false,
      "status": "not-attempted",
      "count": 2418
    },
    {
      "backend": null,
      "attempted": null,
      "status": null,
      "count": 60
    }
  ],
  "maximumHTMGroup": {
    "index": 2681,
    "design": "de-a",
    "scenario": "year",
    "fromISO": "2024-11-19",
    "toISO": "2024-11-20",
    "counts": {
      "total": 43,
      "htm": 41,
      "qtm": 52,
      "global": 2
    },
    "word": "x z2 R B2 U2 R2 F2 U' F2 U2 R2 D' B2 D B2 L B L2 D2 L' F' L' F' R F R' F R F R' F R F R' F R F R' F R F R' F"
  }
}

## center-aware

{
  "requestGroups": 2358,
  "fallbackGroups": 0,
  "obsoletePhysicalTurns": 60,
  "canceledPlans": 60,
  "maximumEndpointReferenceTokens": 361,
  "preturnReferenceReplacements": 347,
  "endpointReferenceReplacements": 237,
  "strictlyImprovedPlans": 1516,
  "totalCandidateMovesSaved": 3595,
  "diagnosticOutcomes": [
    {
      "backend": "direct",
      "attempted": true,
      "status": "unknown",
      "count": 860
    },
    {
      "backend": "center-aware",
      "attempted": true,
      "status": "solved",
      "count": 1516
    },
    {
      "backend": "direct",
      "attempted": false,
      "status": "not-attempted",
      "count": 42
    },
    {
      "backend": null,
      "attempted": null,
      "status": null,
      "count": 60
    }
  ],
  "maximumHTMGroup": {
    "index": 5124,
    "design": "de-a",
    "scenario": "year",
    "fromISO": "2024-11-20",
    "toISO": "2024-11-19",
    "counts": {
      "total": 43,
      "htm": 41,
      "qtm": 52,
      "global": 2
    },
    "word": "x z2 D R D R F2 R2 U' R' U2 F' U2 F L2 B2 D2 B D2 L2 B2 U2 L' R F R' F R F R' F R F R' F R F R' F R F R' F"
  }
}

Timings are Node planning and immediate physical commits, not browser animation. Provider outcomes count plan calls (including obsolete requests), not groups. Candidate savings compare each proposal against its own direct candidate at the same actual pose, not against the independently chained direct series. Move optimality and universal move bounds remain UNKNOWN.
