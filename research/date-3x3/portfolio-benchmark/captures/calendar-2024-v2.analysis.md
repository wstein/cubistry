# Derived consecutive-calendar comparison

Capture SHA256: `c74b7ddb58dd6769ed26aaa0aa18d3f8d58300ab745f18f93c86957152f50b14`.

| Provider | Print | Direction | Mean HTM | Median | p95 | Max | Mean QTM | Mean xyz | Mean ms | p95 ms | Max ms | Max source tokens |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-center | de-a | inc | 20.161 | 18 | 37 | 40 | 29.224 | 0.194 | 72.00 | 145.15 | 2235.34 | 329 |
| baseline-center | de-a | dec | 20.276 | 18 | 38 | 41 | 29.027 | 0.194 | 63.82 | 150.80 | 259.23 | 322 |
| baseline-center | en-3-zero | inc | 17.342 | 16 | 24 | 39 | 25.240 | 0.041 | 60.86 | 168.17 | 361.66 | 353 |
| baseline-center | en-3-zero | dec | 17.451 | 16 | 24 | 39 | 25.410 | 0.041 | 54.99 | 155.85 | 267.37 | 316 |
| baseline-center | en-3-unpadded | inc | 17.273 | 16 | 24 | 40 | 25.120 | 0.041 | 57.86 | 157.90 | 329.69 | 361 |
| baseline-center | en-3-unpadded | dec | 17.434 | 16 | 24 | 40 | 25.317 | 0.041 | 54.04 | 152.05 | 205.94 | 319 |
| portfolio | de-a | inc | 19.587 | 18 | 37 | 40 | 28.738 | 0.194 | 101.71 | 204.25 | 292.33 | 304 |
| portfolio | de-a | dec | 19.120 | 18 | 35 | 41 | 27.738 | 0.194 | 90.74 | 198.53 | 303.15 | 303 |
| portfolio | en-3-zero | inc | 16.033 | 16 | 19 | 38 | 23.164 | 0.041 | 95.67 | 231.58 | 386.92 | 323 |
| portfolio | en-3-zero | dec | 16.016 | 16 | 19 | 38 | 23.273 | 0.041 | 93.57 | 219.36 | 298.86 | 304 |
| portfolio | en-3-unpadded | inc | 16.033 | 16 | 19 | 40 | 23.164 | 0.041 | 98.65 | 242.44 | 402.95 | 319 |
| portfolio | en-3-unpadded | dec | 15.984 | 16 | 19 | 40 | 23.246 | 0.041 | 91.81 | 210.21 | 291.13 | 301 |

## baseline-center

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
    "index": 408,
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

## portfolio

{
  "requestGroups": 2358,
  "fallbackGroups": 0,
  "obsoletePhysicalTurns": 60,
  "canceledPlans": 60,
  "maximumEndpointReferenceTokens": 323,
  "preturnReferenceReplacements": 375,
  "endpointReferenceReplacements": 212,
  "strictlyImprovedPlans": 1580,
  "totalCandidateMovesSaved": 6290,
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
    "index": 2980,
    "design": "de-a",
    "scenario": "year",
    "fromISO": "2024-04-20",
    "toISO": "2024-04-19",
    "counts": {
      "total": 43,
      "htm": 41,
      "qtm": 54,
      "global": 2
    },
    "word": "x z2 U2 B2 D' B2 L2 U2 L2 R2 F2 L2 U' L2 F' R' D2 B U2 F U B2 F R F R' F R F R' F R F R' F R F R' F R F R' F"
  }
}

Timings are Node planning and immediate physical commits, not browser animation. Provider outcomes count plan calls (including obsolete requests), not groups. Candidate savings compare each proposal against its own direct candidate at the same actual pose, not against the independently chained direct series. Move optimality and universal move bounds remain UNKNOWN.
