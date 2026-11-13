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
the gesture for a whole-cube rotation (deferred, see Open decisions).

## Domain definitions

- **View mode**: drag, trackpad and touch gestures rotate the whole cube (orbit, see [SMART_ROTATION](../../docs/SMART_ROTATION.md)).
- **Play mode**: a gesture that starts on the cube is a move gesture; a gesture that starts outside the cube orbits the
  camera as outside play mode. One state machine owns both.
- **Wide turn**: a turn of all layers between and including two touched layers of the same axis.
- **Net turn**: the layer angle after release, rounded to the nearest quarter turn, as a signed number of quarter turns.

## Requirements

1. The viewer starts in view mode everywhere. Play mode is switched on explicitly; leaving it returns to view mode.
2. Play mode is a viewer toggle. It is also a persisted setting and a `play` URL parameter following the `speed` pattern
   (survives an app switch; an invalid value falls back to the default, which is view mode). Whether toggle, setting or both
   ship is an open decision.
3. The interaction machine has the states Idle, Pending, Orbiting, Turning, Settling. A gesture that starts on the cube
   (raycast in the cube's local frame) starts a move gesture; a gesture that starts outside the cube starts Orbiting.
4. One finger on a sticker (owner decision 1 and 2): the touched sticker is signaled (highlight). Layer and axis are derived
   from the gesture direction after a dead zone of about 8 px; the rule for gestures along sticker edges is to be specified.
   While Turning, the layer follows the finger freely in either direction, including back past the point already passed
   (half turn, three-quarter turn, full turn and more in one gesture).
5. At every 90 degrees a magnet/snap effect is shown (visual; haptics only where the platform has them, iOS has none). On
   release the layer eases to the nearest quarter turn from angle and release speed (rubber band, start value 100 to
   180 ms, tuned on mouse and phone).
5a. Layer choice on N = 4 to 7: by hit depth of the touched sticker. Two fingers on two layers of the same axis turn all
    layers between and including both together (wide turn); fingers on different axes are invalid.
6. One commit per gesture, at release: the net number of quarter turns, applied once. Net 0 commits no move, also when the
   layer is dragged back to the start without releasing. After the commit all bodies are
   re-synced to the computed state.
7. The state after a gesture equals the state after the same move applied through `PwMove`.
8. Touch: no page scroll during a drag (`touch-action`, pointer capture, cancel handling).
9. No new keyboard buttons for moves.
10. Layering: the pure state machine and the move decision belong to the shared core (PuzlWerk); pointer events, raycast and
    pivot binding stay in the TypeScript viewer package. The viewer shows a caller-validated legal selection and angle on a
    temporary turn pivot; controllers own state, deadlines and commit ([VIEWER_RENDERING](../../docs/VIEWER_RENDERING.md)).
11. A cube turned by hand can be reset or solved again. Proposed (not decided): undo history of the session plus one jump to the
    application's target state; no solver call.

## Owner decisions (2026-11-13)

1. **Where a gesture starts.** In play mode a gesture that starts outside the cube orbits the camera (point of view) as outside
   play mode; a gesture that starts on the cube is a move gesture.
2. **One finger on a sticker.** The touched sticker is signaled (highlight). Layer and axis are derived from the gesture
   direction (dead zone about 8 px; the rule for sticker edges is to be specified). The layer follows the finger freely in
   either direction and back. At every 90 degrees a magnet/snap effect (visual; haptics only where available, iOS has none).
   On release the net rotation rounds to the nearest 90 degrees; net 0, also when returning to the start without releasing, is
   no move.
3. **Layer on N = 4 to 7.** By hit depth of the touched sticker.
4. **Wide turns.** Two fingers on two layers of the same axis rotate all layers between and including both together
   (generalized wide turn); fingers on different axes are invalid. Mouse equivalent, proposed and not decided: Shift+drag is a
   wide turn.
5. **Whole-cube rotation is a move (model decision, kept).** Rotations are x/y/z moves in the move list; this changes the move
   model. Consequences: the net turn of a gesture can be a rotation move; the state-equality check (requirement 7) covers
   rotations; view-mode orbit stays presentation only and is not a move. The gesture for it is deferred (Open decisions).
   This replaces the earlier open item on the gesture and on layer choice, which decisions 3 and 4 answer.

## Per-application availability (design draft, not decided)

Applications where the picture is the point (Picture Cube 2 to 7, special cubes) offer play mode fully. Applications whose
state is a date (Calendar7, clock, status cube) either disable it or offer free play with a "reset to the date" action, because
a hand turn leaves the shown date. Counter and clock: no manual moves proposed.

## Open decisions (owner)

1. Reset target for print-bound cubes: home state (solved) or the state the application currently shows?
2. Activation: viewer toggle, persisted setting, or both.
3. Which applications allow manual moves; date applications: disabled or free play with reset.
4. Gesture for a whole-cube rotation. The three-finger gesture is rejected (iOS system gestures). Candidates, not decided: two
   fingers outside the cube; Alt+drag with the mouse.
5. Sticker-edge rule for deriving layer and axis from the gesture direction (to be specified).

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
