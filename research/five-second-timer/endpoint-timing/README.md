# Five-second endpoint observations

These measurements concern the final-turn endpoint implementation in feature commit [3178145](https://github.com/wstein/cubistry/commit/31781457631d9b45b34417813d50f159d80251ef), rebased onto workshop parent `9036675`. They supplement the earlier direct-viewer animation benchmark, which predates endpoint timing and cannot establish this endpoint contract.

Each current observation starts a 00:05 countdown and commits the six legal inverse moves to 00:00. The selected preference remains unchanged; the scheduler adapts its effective duration and times the last legal turn to the five-second target instant. The trace includes setup moves from the initial 30:00 state so every actual presentation can be independently replayed; the six scheduled moves are accounted separately.

| Preferred duration | Effective duration | Observed commit minus target instant |
| --- | --- | --- |
| 250 ms | 250 ms | +2.0 ms |
| 2,000 ms | 337 ms | +3.0 ms |
| 10 ms | 10 ms | +2.5 ms |

All three current cases pass the documented 20-ms observation tolerance and 2,500-ms half-interval budget. These are serialized local Chromium 141 / SwiftShader measurements at 800×700, with real animation and no reduced motion. They are samples, not universal browser/OS deadline guarantees. The manifest pins source hashes, runtime integrity, observation hashes and environment.

The historical negative file preserves an earlier, unpublished local pre-rebase experiment at `6d08693`, based on parent `89830b8`, before final-turn endpoint timing was implemented. Under concurrent software-rendering load at 1280×1000, its 10-ms preference committed about 108 ms late. That trace is retained rather than erased, but it is **not** a measurement of the current endpoint implementation or evidence against the current timing revision. Its permanent sticker states and actual moves remain independently checkable; its old implementation revision was local and is explicitly not claimed as a published reproducible runtime source.

From the Research checkout:

```sh
python3 research/five-second-timer/verify_endpoints.py
```

From the feature checkout at the pinned commit, with its setup and Chromium installed:

```sh
PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers npm run test:e2e -- tests/browser/five-second-timer.spec.mjs --grep 'six-move sequence'
```

Each case writes `deadline-observation.json` to its Playwright result directory. Source hashes can be compared using `git show COMMIT:PATH` and SHA-256. Reruns reproduce the checks and physical paths, not identical performance timestamps. The independent physical checker verifies all intermediate committed poses. It does not authenticate wall-clock timestamps or prove performance for untested devices. No merge or deployment is authorized by these observations.
