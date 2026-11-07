# Plans

Implementation approaches reference specifications and decisions; plans alone do not confer approval.

- [H/M Counter on two cubes, based on the live clock](hm-counter.md) — plan (draft): two HSM cubes with carry, reusing the clock stage and controllers; assumptions, acceptance criteria and open decisions.
- [M/S Timer on two cubes, one-second resolution](ms-timer.md) — plan (draft): Stopwatch and Countdown on two S3 cubes, a 3-PR stack sharing the stage and pair controller with the H/M Counter; owner decisions of 2026-11-01.
- [Replace Cubing.js and twips with cubacle WASM](cubacle-wasm-replacement.md) — plan (draft): staged replacement with measurement, parity and release gates; no runtime fallback; tracked in GitHub Issues.
- [Picture cube support for Cubacle and Cubistry](picture-cube-concept.md) — research concept (draft): data, target and solver model for picture cubes; open owner decisions.
- [One application instead of single-page entry points](unified-application.md) — plan (draft): owner decisions of 2026-11-07, current state, staged plan (contract first, thin) with safety gates, risks and open decisions.

Back to [Home](../Home.md).
