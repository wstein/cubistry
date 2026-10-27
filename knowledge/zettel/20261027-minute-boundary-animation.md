---
id: 20261027-minute-boundary-animation
title: Minute-boundary animation for Chronocube Live Clock
type: zettel
status: fleeting
created: 2026-10-27
tags: [chronocube, live-clock, animation, scheduling]
---

# Minute-boundary animation for Chronocube Live Clock

## Claim

Chronocube is primarily a **live calendar clock**: on each minute transition, the scheduled cube moves should conclude when the new minute begins (wall-clock second 00), rather than begin at that instant. The current proposal is to precompute the next target and its valid move sequence, estimate duration for each move type, and schedule backwards from the next minute boundary.

## Reasoning / evidence

This is a **product design proposal**, not a proved timing guarantee or an implemented feature. Quarter-turns and half-turns may have different configured durations. A first-order planning model is:

`D = Σ duration(move_i) + scheduling/render budget`

`planned_start = next_minute_boundary - D`

Preparation and independent verification of the next reachable cube state must finish before the animation begins. The renderer should advance using timestamp-based progress (monotonic time) rather than a chain of accumulating timeout intervals. Wall-clock alignment requires resynchronization after clock adjustments, sleep/wake and browser tab suspension.

An exact visible completion on second 00 cannot be guaranteed in a browser across all frame rates, background tabs or OS scheduling conditions. Define and measure a tolerance, and fall back to presenting the correct target state at the boundary or on resume if the available animation budget is insufficient.

## Implications

- Separate solver/preparation latency, move-time budget, rendering latency and wall-clock synchronization.
- Define distinct configurable durations for quarter- and half-turns; extend the model if move types require it.
- Preserve cube-state correctness: a camera motion (including optional rubber-band return) must not change the scheduled cube state.
- Prefer the correct live time to a late or misleading animation; choose a deterministic fallback when deadlines cannot be met.
- Test simulated minute boundaries, long sequences, delayed computation, frame stalls, clock jumps, DST transitions and tab resume.

## Open questions

- Timing defaults and acceptable completion tolerance after benchmarking the selected 3D viewer.
- Whether time-limited playback should compress durations, omit moves visually or snap to the target state.
- Whether to surface an explicit transition indicator while the front face is not fully readable.

## Connections

- [Live Clock timing implementation issue #13](https://github.com/wstein/cubistry/issues/13)
- [Functional Pilot issue #12](https://github.com/wstein/cubistry/issues/12)
- [Zettelkasten index](index.md)
