---
id: SPEC-PLAY-MODE
title: Play mode (hand-play by dragging layers)
type: spec
status: draft
created: 2026-11-13
---
# Play mode (hand-play by dragging layers)

Source: [wstein/cubistry#461](https://github.com/wstein/cubistry/issues/461) (body, owner update 2026-11-12, owner
requirement and design draft 2026-11-13). This spec restates those texts; it adds no decision. Decisions the owner has not
taken are listed under "Open decisions".

## Scheduling gate

Deferred. Under the binding M1 definition of done in [wstein/cubistry#21](https://github.com/wstein/cubistry/issues/21), the
2x2 Counter MVP is completed and accepted first. Hand-play for 3x3 to 7x7 needs its own owner approval and is not an M1
prerequisite or a CubeAssembler M2 / CubeLab M3 migration authorization. This spec does not authorize implementation.
Technical prerequisites: the cube state runs on the shared PuzlWerk model (wire-v1, SM1) and the Picture Cube sizes run on
PuzlWerk `PwMove` (SM7), so that gestures act on the final state model.

## Scope

In scope: the two interaction modes of the cube viewer, the drag gesture that turns a layer, the commit rule, mode
activation and per-application availability. Out of scope: code, solver changes, keyboard move buttons (none are added),
modifier-key play, hit-decides-layer-or-orbit, the touch split (one finger layer, two fingers orbit); each needs its own
decision.

## Domain definitions

- **View mode**: drag, trackpad and touch gestures rotate the whole cube (orbit, see [SMART_ROTATION](../../docs/SMART_ROTATION.md)).
- **Play mode**: a drag on a cubie turns one layer; a drag on the background orbits. One state machine owns both.
- **Net turn**: the layer angle after release, rounded to the nearest quarter turn, as a signed number of quarter turns.

## Requirements

1. The viewer starts in view mode everywhere. Play mode is switched on explicitly; leaving it returns to view mode.
2. Play mode is a viewer toggle. It is also a persisted setting and a `play` URL parameter following the `speed` pattern
   (survives an app switch; an invalid value falls back to the default, which is view mode). Whether toggle, setting or both
   ship is an open decision.
3. The interaction machine has the states Idle, Pending, Orbiting, Turning, Settling. A hit on a cubie (raycast in the cube's
   local frame) starts Turning; a hit on the background starts Orbiting. The axis is decided after 6 to 10 CSS px of movement.
4. While Turning, the layer follows the pointer by any angle in both directions, including past the point already passed
   (half turn, three-quarter turn, full turn and more in one gesture).
5. On release the layer eases to the nearest quarter turn from angle and release speed (rubber band, start value 100 to
   180 ms, tuned on mouse and phone).
6. One commit per gesture: the net number of quarter turns, applied once; net 0 commits no move. After the commit all bodies are
   re-synced to the computed state.
7. The state after a gesture equals the state after the same move applied through `PwMove`.
8. Touch: no page scroll during a drag (`touch-action`, pointer capture, cancel handling).
9. No new keyboard buttons for moves.
10. Layering: the pure state machine and the move decision belong to the shared core (PuzlWerk); pointer events, raycast and
    pivot binding stay in the TypeScript viewer package. The viewer shows a caller-validated legal selection and angle on a
    temporary turn pivot; controllers own state, deadlines and commit ([VIEWER_RENDERING](../../docs/VIEWER_RENDERING.md)).
11. A cube turned by hand can be reset or solved again. Proposed (not decided): undo history of the session plus one jump to the
    application's target state; no solver call.

## Owner decisions

- **Whole-cube turns are moves (owner, 2026-11-13).** A whole-cube rotation counts as a move, like a layer turn: rotations
  are x/y/z moves in the move list. This changes the move model (rotations are part of the move list, not only presentation).
  Consequences recorded here, no further decision: the net turn of a gesture (requirement 6) can be a rotation move; the
  state-equality check (requirement 7) covers rotations; view-mode orbit stays a presentation change and is not a move. The
  gesture that selects a whole-cube turn, and its interplay with layer choice on N = 4 to 7, are open (Open decisions, item 5).

## Per-application availability (design draft, not decided)

Applications where the picture is the point (Picture Cube 2 to 7, special cubes) offer play mode fully. Applications whose
state is a date (Calendar7, clock, status cube) either disable it or offer free play with a "reset to the date" action, because
a hand turn leaves the shown date. Counter and clock: no manual moves proposed.

## Open decisions (owner)

Items 1 to 4 are unchanged from #461.

1. Layers on N = 4 to 7: single layer by hit depth only, or also wide turns?
2. Reset target for print-bound cubes: home state (solved) or the state the application currently shows?
3. Which applications allow manual moves; date applications: disabled or free play with reset.
4. Activation: viewer toggle, persisted setting, or both.
5. Gesture for a whole-cube turn in play mode, and layer choice on N = 4 to 7 under the owner decision above (not derivable from #461): which hit or gesture selects a whole-cube turn instead of a layer, and how that relates to the single-layer-by-depth question (item 1).

## Invariants

- View mode never turns a layer and never commits a move (orbit is presentation only).
- Puzzle state changes only through one committed move per gesture; the state is never read back from the animation.

## Acceptance criteria

- Unit test of the pure machine: on a 3x3 in an inverted view, grab, drag, drag back (layer returns), release (snaps, one commit).
- Drag 270 degrees and back to 90 degrees commits one quarter turn; drag past a full turn commits the net turn; release between
  quarters snaps to the nearest with the rubber-band animation.
- One browser test of the pointer sequence; same behavior on touch without page scroll.
- Vector comparison with the same move applied via `PwMove`.

## References / decisions

- [wstein/cubistry#461](https://github.com/wstein/cubistry/issues/461), related #110, #120, #85, #21, wstein/puzlwerk specs/006-shared-model (SM1, SM4, SM7)
- [ADR index](../adr/index.md)
