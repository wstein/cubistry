---
id: 20261027-two-digit-cube-counter
title: Two-digit Cube Counter – a small universal counter
type: zettel
status: fleeting
created: 2026-10-27
tags: [cubistry, counter, countdown, 2x2, application]
---

# Two-digit Cube Counter – a small universal counter

## Claim

A virtual **2×2×2 cube** is the preferred candidate for a flexible **two-digit
counter from 00 to 99**: increment, decrement, and arbitrary jumps by multiple
units. A 3×3 is **not an accepted substitute**. Physical feasibility of one fixed
sticker printing for all 100 values still needs proof.

## Applications

- Break timer for training sessions, meetings, and online events, such as a
  10- or 15-minute countdown.
- Count arbitrary quantities, such as visitors or cups of coffee served.
- Two modes on the same framework: **countdown**, using a clock as its time
  source, and a **manual counter**, without a relationship to minutes.

## Interaction and display

- Configurable initial value (00–99), displayed on the cube's front face.
- **Increment/decrement** by 1 and freely chosen steps; include **+10 / −10**
  examples and optional direct value entry or a jump to a target value.
- UI controls through buttons, keyboard, and/or URL configuration; the exact
  interface remains open.
- Individually configurable labels, optionally **two lines**, **above or below**
  the cube as a separate UI element, not necessarily part of the sticker print.
- Countdowns up to 99 minutes, without seconds on the cube; update the display
  at minute boundaries.
- Define boundaries and overflow explicitly: 00 for countdown, 99 for increment,
  clamp versus wrap, pause, resume, and reset.
- Values outside 00–99 would need a different model. That extension remains
  open and is **not a decision to use 3×3**.

## Research question: solvers and tables

Efficient solvers and precomputed tables exist for the standard 2×2×2. Prefer
reuse after reviewing their licenses and models. They might permit spontaneous
counter steps **without offline preparation of every counter transition**.

**Not automatically proven:** standard 2×2 solution-to-solved tables or state
heuristics guarantee neither a suitable **fixed counter print** nor optimal
sequences to a target **display** with many possible complete cube states.
An optimal sequence from state A to display B is not necessarily the sequence
from A to a particular canonical cube state B. The spike must test this
distinction explicitly.

## Open proof obligations

1. Can a 2×2 front with **four visible facelets** display every decimal value
   00–99 using one **fixed** print and legal cube states? Specify digit glyphs,
   orientations, duplicate usage, and legibility.
2. If not, which minimally changed display (overlay, external labels, alternate
   character encoding) preserves the 2×2 idea without false technical claims?
3. For every value, prove legal reachable target states and sequences for
   +1, −1, ±10, and arbitrary jumps (0–99), including chained transitions.
4. Can an existing 2×2 solver/table be reused with unchanged move notation,
   orientation model, and a reasonable browser payload? Distinguish optimal
   solutions from best-known ones.
5. For countdown, verify clock-driven updates and correct display after a
   background tab, restart, or clock jump.

## Connections

- [Countdown Cube – event countdown (PR #16)](https://github.com/wstein/cubistry/pull/16)
- [Composable calendar transitions, spike #15](https://github.com/wstein/cubistry/issues/15)
- [Knowledge conventions](../CONVENTIONS.md)

## Status

Product concept, not a decision about 2×2 feasibility or an implementation
assignment. Track actionable scope and status in GitHub Issues.
