# Derived consecutive-calendar comparison

Capture SHA256: `235b91c60b3e9521ff62cb10807e16067f59a57b5cc035f21c0076d4f4187952`.

| Provider | Print | Direction | Mean HTM | Median | p95 | Max | Mean QTM | Mean xyz | Mean ms | p95 ms | Max ms | Max source tokens |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-center | de-a | inc | 20.161 | 18 | 37 | 40 | 29.224 | 0.194 | 75.36 | 166.01 | 2474.39 | 329 |
| baseline-center | de-a | dec | 20.276 | 18 | 38 | 41 | 29.027 | 0.194 | 71.34 | 173.09 | 345.30 | 322 |
| baseline-center | en-3-zero | inc | 17.342 | 16 | 24 | 39 | 25.240 | 0.041 | 61.98 | 184.70 | 372.96 | 353 |
| baseline-center | en-3-zero | dec | 17.451 | 16 | 24 | 39 | 25.410 | 0.041 | 57.36 | 159.83 | 273.52 | 316 |
| baseline-center | en-3-unpadded | inc | 17.273 | 16 | 24 | 40 | 25.120 | 0.041 | 60.74 | 165.89 | 361.66 | 361 |
| baseline-center | en-3-unpadded | dec | 17.434 | 16 | 24 | 40 | 25.317 | 0.041 | 54.92 | 149.09 | 231.13 | 319 |
| portfolio | de-a | inc | 19.587 | 18 | 37 | 40 | 28.738 | 0.194 | 126.81 | 271.39 | 515.34 | 304 |
| portfolio | de-a | dec | 19.120 | 18 | 35 | 41 | 27.738 | 0.194 | 108.37 | 249.50 | 497.08 | 303 |
| portfolio | en-3-zero | inc | 16.033 | 16 | 19 | 38 | 23.164 | 0.041 | 120.16 | 302.43 | 556.61 | 323 |
| portfolio | en-3-zero | dec | 16.016 | 16 | 19 | 38 | 23.273 | 0.041 | 113.19 | 281.81 | 406.44 | 304 |
| portfolio | en-3-unpadded | inc | 16.033 | 16 | 19 | 40 | 23.164 | 0.041 | 125.53 | 311.20 | 514.53 | 319 |
| portfolio | en-3-unpadded | dec | 15.984 | 16 | 19 | 40 | 23.246 | 0.041 | 114.87 | 289.32 | 510.34 | 301 |

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
