# Evidence and checks

Commands that verify the repository and the evidence behind the counter claims. Back to the [README](../README.md).

```sh
npm run typecheck
npm test
npm run test:proof
python3 research/counter/verify.py
python3 research/architecture/verify_design.py
npm run build
npx playwright install chromium
npm run test:e2e
```

In a cloud sandbox with an unwritable home cache, use
`npm_config_cache=/tmp/cubistry-npm-cache npm run setup` and set
`PLAYWRIGHT_BROWSERS_PATH=/tmp/cubistry-playwright` for browser installation/tests.

[The independent feasibility proof](COUNTER_FEASIBILITY.md) establishes
both padded and unpadded fixed prints as SAT, and permanently fixed upper cubies
as UNSAT under the distinct-upright-glyph model. [The reuse audit](COUNTER_REUSE.md)
records existing renderer/solver choices, licenses, and sizes. The
[knowledge base](../knowledge/Home.md) preserves product concepts and findings.

The UI uses actual image stickers on eight rigid corner cubies. Title text is
not a front-face HTML overlay. Solver-generated move words are independently
replayed. Transitions now solve from the actual complete physical state directly
to the selected complete target, including exact print orientation. The shared
solver plus any frame correction is not claimed HTM-optimal. No deployment is required.
