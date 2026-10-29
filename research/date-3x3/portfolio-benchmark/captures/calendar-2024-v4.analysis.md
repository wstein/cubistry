# Derived consecutive-calendar comparison

Capture SHA256: `1f92d9f6cd67c6ee05c24e1e5f16a0ae6cc1c18cccdc0afce3b270a59a1dda9e`.

| Provider | Print | Direction | Mean HTM | Median | p95 | Max | Mean QTM | Mean xyz | Mean ms | p95 ms | Max ms | Max source tokens |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-center | de-a | inc | 19.822 | 18 | 30 | 34 | 28.546 | 0.194 | 79.42 | 181.61 | 2313.71 | 304 |
| baseline-center | de-a | dec | 19.637 | 18 | 29 | 33 | 27.896 | 0.194 | 71.44 | 181.23 | 314.74 | 328 |
| baseline-center | en-3-zero | inc | 17.074 | 16 | 24 | 33 | 24.809 | 0.041 | 67.86 | 198.23 | 488.58 | 347 |
| baseline-center | en-3-zero | dec | 17.041 | 16 | 24 | 30 | 24.874 | 0.041 | 53.25 | 155.79 | 261.30 | 320 |
| baseline-center | en-3-unpadded | inc | 17.046 | 16 | 24 | 33 | 24.814 | 0.041 | 60.36 | 164.08 | 310.60 | 353 |
| baseline-center | en-3-unpadded | dec | 17.087 | 16 | 24 | 33 | 24.973 | 0.041 | 57.46 | 160.61 | 240.50 | 301 |
| portfolio | de-a | inc | 19.148 | 18 | 30 | 34 | 27.825 | 0.194 | 98.59 | 195.37 | 303.32 | 358 |
| portfolio | de-a | dec | 18.831 | 18 | 29 | 34 | 27.060 | 0.194 | 95.37 | 200.60 | 336.64 | 322 |
| portfolio | en-3-zero | inc | 16.000 | 16 | 19 | 32 | 23.077 | 0.041 | 105.02 | 256.41 | 394.70 | 304 |
| portfolio | en-3-zero | dec | 15.937 | 16 | 19 | 31 | 23.109 | 0.041 | 95.53 | 233.03 | 346.28 | 303 |
| portfolio | en-3-unpadded | inc | 15.956 | 16 | 19 | 33 | 23.049 | 0.041 | 103.37 | 255.09 | 391.45 | 319 |
| portfolio | en-3-unpadded | dec | 16.000 | 16 | 19 | 33 | 23.230 | 0.041 | 96.89 | 226.51 | 309.07 | 310 |

## baseline-center

{
  "requestGroups": 2358,
  "fallbackGroups": 0,
  "obsoletePhysicalTurns": 60,
  "canceledPlans": 60,
  "maximumEndpointReferenceTokens": 353,
  "preturnReferenceReplacements": 353,
  "endpointReferenceReplacements": 228,
  "strictlyImprovedPlans": 1509,
  "totalCandidateMovesSaved": 2527,
  "diagnosticOutcomes": [
    {
      "backend": "direct",
      "attempted": true,
      "status": "unknown",
      "count": 867
    },
    {
      "backend": "center-aware",
      "attempted": true,
      "status": "solved",
      "count": 1509
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
      "total": 36,
      "htm": 34,
      "qtm": 50,
      "global": 2
    },
    "word": "x z2 U2 D' B' D' B2 U' F2 L D R2 B R2 D2 R2 L2 B2 R2 U2 F U2 B U D R2 L2 U' D' F U D R2 L2 U' D'"
  }
}

## portfolio

{
  "requestGroups": 2358,
  "fallbackGroups": 0,
  "obsoletePhysicalTurns": 60,
  "canceledPlans": 60,
  "maximumEndpointReferenceTokens": 358,
  "preturnReferenceReplacements": 380,
  "endpointReferenceReplacements": 182,
  "strictlyImprovedPlans": 1578,
  "totalCandidateMovesSaved": 4759,
  "diagnosticOutcomes": [
    {
      "backend": "direct",
      "attempted": true,
      "status": "unknown",
      "count": 798
    },
    {
      "backend": "center-aware",
      "attempted": true,
      "status": "solved",
      "count": 1578
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
      "total": 36,
      "htm": 34,
      "qtm": 50,
      "global": 2
    },
    "word": "x z2 U2 D' B' D' B2 U' F2 L D R2 B R2 D2 R2 L2 B2 R2 U2 F U2 B' D U L2 R2 D' U' F' D U L2 R2 D' U'"
  }
}

Timings are Node planning and immediate physical commits, not browser animation. Provider outcomes count plan calls (including obsolete requests), not groups. Candidate savings compare each proposal against its own direct candidate at the same actual pose, not against the independently chained direct series. Move optimality and universal move bounds remain UNKNOWN.
