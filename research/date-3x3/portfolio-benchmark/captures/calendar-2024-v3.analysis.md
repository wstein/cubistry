# Derived consecutive-calendar comparison

Capture SHA256: `3262fd53e0444312b3cb79c67792724c823eaa5bd5e2ed55ba0ee4a3c47dd6b7`.

| Provider | Print | Direction | Mean HTM | Median | p95 | Max | Mean QTM | Mean xyz | Mean ms | p95 ms | Max ms | Max source tokens |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-center | de-a | inc | 20.055 | 18 | 32 | 35 | 28.842 | 0.194 | 79.53 | 164.00 | 2370.06 | 324 |
| baseline-center | de-a | dec | 19.749 | 18 | 32 | 34 | 28.016 | 0.194 | 62.52 | 149.63 | 283.31 | 304 |
| baseline-center | en-3-zero | inc | 17.134 | 16 | 24 | 34 | 24.907 | 0.041 | 65.33 | 185.72 | 321.72 | 334 |
| baseline-center | en-3-zero | dec | 17.139 | 16 | 24 | 31 | 24.989 | 0.041 | 55.89 | 152.14 | 259.29 | 355 |
| baseline-center | en-3-unpadded | inc | 17.055 | 16 | 24 | 34 | 24.869 | 0.041 | 59.62 | 155.44 | 285.06 | 317 |
| baseline-center | en-3-unpadded | dec | 17.183 | 16 | 24 | 34 | 25.104 | 0.041 | 58.49 | 167.92 | 257.49 | 349 |
| portfolio | de-a | inc | 19.186 | 18 | 31 | 35 | 27.880 | 0.194 | 99.41 | 191.01 | 294.25 | 340 |
| portfolio | de-a | dec | 18.907 | 18 | 31 | 34 | 27.240 | 0.194 | 96.81 | 206.53 | 312.76 | 305 |
| portfolio | en-3-zero | inc | 16.011 | 16 | 19 | 32 | 23.066 | 0.041 | 103.87 | 256.33 | 421.11 | 340 |
| portfolio | en-3-zero | dec | 15.951 | 16 | 19 | 33 | 23.120 | 0.041 | 95.68 | 239.63 | 321.22 | 306 |
| portfolio | en-3-unpadded | inc | 15.964 | 16 | 19 | 34 | 23.055 | 0.041 | 109.49 | 266.15 | 456.05 | 319 |
| portfolio | en-3-unpadded | dec | 16.008 | 16 | 19 | 34 | 23.240 | 0.041 | 96.40 | 228.65 | 287.53 | 310 |

## baseline-center

{
  "requestGroups": 2358,
  "fallbackGroups": 0,
  "obsoletePhysicalTurns": 60,
  "canceledPlans": 60,
  "maximumEndpointReferenceTokens": 355,
  "preturnReferenceReplacements": 346,
  "endpointReferenceReplacements": 235,
  "strictlyImprovedPlans": 1516,
  "totalCandidateMovesSaved": 2712,
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
    "index": 109,
    "design": "de-a",
    "scenario": "year",
    "fromISO": "2024-04-19",
    "toISO": "2024-04-20",
    "counts": {
      "total": 37,
      "htm": 35,
      "qtm": 52,
      "global": 2
    },
    "word": "x z2 U2 D' B' D' B2 U' F2 L D R2 B R2 D2 R2 L2 B2 R2 U2 F U2 B2 F U D R2 L2 U' D' B' U D R2 L2 U' D'"
  }
}

## portfolio

{
  "requestGroups": 2358,
  "fallbackGroups": 0,
  "obsoletePhysicalTurns": 60,
  "canceledPlans": 60,
  "maximumEndpointReferenceTokens": 340,
  "preturnReferenceReplacements": 369,
  "endpointReferenceReplacements": 216,
  "strictlyImprovedPlans": 1580,
  "totalCandidateMovesSaved": 4995,
  "diagnosticOutcomes": [
    {
      "backend": "direct",
      "attempted": true,
      "status": "unknown",
      "count": 796
    },
    {
      "backend": "center-aware",
      "attempted": true,
      "status": "solved",
      "count": 1580
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
    "index": 2467,
    "design": "de-a",
    "scenario": "year",
    "fromISO": "2024-04-19",
    "toISO": "2024-04-20",
    "counts": {
      "total": 37,
      "htm": 35,
      "qtm": 52,
      "global": 2
    },
    "word": "x z2 U2 D' B' D' B2 U' F2 L D R2 B R2 D2 R2 L2 B2 R2 U2 F U2 B2 D U L2 R2 D' U' B D U L2 R2 D' U' F'"
  }
}

Timings are Node planning and immediate physical commits, not browser animation. Provider outcomes count plan calls (including obsolete requests), not groups. Candidate savings compare each proposal against its own direct candidate at the same actual pose, not against the independently chained direct series. Move optimality and universal move bounds remain UNKNOWN.
