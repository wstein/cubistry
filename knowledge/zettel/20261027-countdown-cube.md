---
id: 20261027-countdown-cube
title: Countdown Cube – configurable event countdown
type: zettel
status: fleeting
created: 2026-10-27
tags: [chronocube, countdown, application, concept]
---

# Countdown Cube – configurable event countdown

## Claim

The Cubistry/Chronocube framework could support a **virtual countdown cube**
for a freely chosen event: remaining **days (ideally four digits), hours, and
minutes** as readable information on its front face. This is a **product
concept**, not a proven 4×4×4 sticker/solver construction.

## Concept

- Target events include concerts, the new year, the Olympics, or a personal event.
- Freely chosen **title**, such as "Until the concert," **not** encoded in the
  physical sticker print or wordmark; probably an independent HTML/UI overlay
  above or beside the cube.
- Optional color schemes from URL configuration.
- A standalone, statically hostable web application, for example on GitHub Pages,
  with client-side time calculation and a shareable rendered URL.
- **No seconds on the cube**; update at minute boundaries. Define timezone/DST
  and behavior after the event explicitly.
- **4×4×4 is a candidate**, not a proven solution. Consider 5×5×5 or a different
  display if needed.

## Open feasibility questions

1. Can four day digits plus hours and minutes fit on one 4×4 front under real
   cubie, sticker, and orientation constraints? A 4×4 has only 16 front positions;
   start with an explicit capacity and legality analysis.
2. Can **one fixed sticker print** cover the required values and transitions
   without damaging other front information?
3. Is a large day range, such as the desired but unproven 0–9999, achievable with
   legal moves and satisfactory legibility?
4. Can countdown partial transitions be precomputed/composed? Distinguish equal
   front displays from equal complete cube states; see the precomputed calendar
   transitions discussion in issue #15.
5. Is an external event title preferable so that it remains freely editable?
6. What are the defaults for a UTC target and display timezone? How are past
   targets, synchronization, and tab resume handled?
7. Are URL parameters robust with respect to length, encoding, validation,
   sharing, potentially sensitive event titles, and allowed themes?

## Possible URL (illustrative, not a contract)

`?at=2027-01-01T00%3A00%3A00%2B01%3A00&title=NewYear&theme=coral`

## Consequences

- Countdown could be an optional **framework demo**, without diluting the main
  Chronocube live calendar/clock function.
- Keep configurable text outside the physical sticker logic distinct from
  the cube state.
- Before implementation planning, run a focused 4×4 solver/layout spike. If it
  fails, evaluate a larger cube or splitting the UI.
- This concept is **not an implementation issue**; prioritize executable work
  through a GitHub Issue first.

## Connections

- [Knowledge conventions](../CONVENTIONS.md)
- [Composable calendar transitions (issue #15)](https://github.com/wstein/cubistry/issues/15)
- [Functional pilot (issue #12)](https://github.com/wstein/cubistry/issues/12)
