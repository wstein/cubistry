---
id: SPEC-PLAY-MODE
title: Play mode (hand-play by dragging layers)
type: spec
status: draft
created: 2026-11-13
---
# Play mode (hand-play by dragging layers)

Sources: [wstein/cubistry#461](https://github.com/wstein/cubistry/issues/461) (body and comments up to 2026-11-13: owner
update 2026-11-12, owner requirement and design draft 2026-11-13) and the
[owner decision comment of 2026-11-13](https://github.com/wstein/cubistry/issues/461#issuecomment-6866210592), cited below as "decision comment".
This spec restates those texts. Each decision is marked **owner** (stated by the owner) or **proposal accepted** (proposed by
the coordinator, accepted by the owner in conversation). Text marked "rationale" or "derived" is the author's, not a decision.
Whatever is undecided is listed under "Open decisions".

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
- **Net turn**: the signed number of quarter turns committed for a gesture: the layer angle at release rounded to the nearest
  90 degrees (D8a).

## Requirements

1. The viewer starts in view mode everywhere. Play mode is switched on explicitly; leaving it returns to view mode.
2. Play mode is a viewer toggle and is not persisted: every page load starts outside play mode (D6). Whether a `play` URL
   parameter is allowed is open (Open decisions, item 4).
3. The interaction machine has the states Idle, Pending, Orbiting, Turning, Settling. A gesture that starts on the cube
   (raycast in the cube's local frame) starts a move gesture; a gesture that starts outside the cube starts Orbiting (D1).
4. One finger on a sticker (D2): the touched sticker is signaled (highlight). Layer and axis are derived from the gesture
   direction after a dead zone of about 8 px (D8b); the rule for gestures along sticker edges is open. While Turning, the layer
   follows the finger freely in either direction, including back past the point already passed (half turn, three-quarter turn,
   full turn and more in one gesture).
5. At every 90 degrees a magnet/snap effect is shown (D2), visual; haptics only where the platform provides them (rationale:
   iOS provides none; not in the decision comment). On release the layer eases to the nearest quarter turn (D8a; rubber band,
   start value 100 to 180 ms, tuned on mouse and phone, from the owner update of 2026-11-12). The owner update also names
   release speed as an input; its effect on the target is not decided (Open decisions, item 6).
6. Layer choice on N = 4 to 7: by hit depth of the touched sticker (D8c). Two fingers on two layers of the same axis turn all
   layers between and including both together (wide turn, D3). Two fingers on different axes are invalid (D8d).
7. One commit per gesture, at release: the net number of quarter turns, applied once. Nothing is committed while dragging. Net 0
   commits no move, including when the layer was dragged back to the start (D2). After the commit all bodies are re-synced to
   the computed state.
8. The state after a gesture equals the state after the same move applied through `PwMove`.
9. Touch: no page scroll during a drag (`touch-action`, pointer capture, cancel handling).
10. No new keyboard buttons for moves.
11. Layering: the pure state machine and the move decision belong to the shared core (PuzlWerk); pointer events, raycast and
    pivot binding stay in the TypeScript viewer package. The viewer shows a caller-validated legal selection and angle on a
    temporary turn pivot; controllers own state, deadlines and commit ([VIEWER_RENDERING](../../docs/VIEWER_RENDERING.md)).
12. Reset on print-bound cubes returns to the state shown when play mode started (entry state, D5). Whether this is one jump or
    an undo history is open (Open decisions, item 3). Reset for cubes that are not print-bound is not decided (Open decisions, item 7). No
    solver call.

## Decisions (2026-11-13)

Source for all: the decision comment.

D1. **owner** Where a gesture starts. In play mode a gesture that starts outside the cube changes the camera as outside play
   mode; a gesture that starts on the cube is a move gesture.
D2. **owner** One finger on a sticker. The touched sticker is signaled; layer and axis follow from the gesture direction; the layer
   follows the finger freely in both directions and back; a magnet effect at every 90 degrees; returning to the start without
   releasing counts as no move.
D3. **owner** Two fingers on two layers rotate all layers between them (generalized wide turn).
D4. **owner** Whole-cube rotation counts as a move. Its gesture is
   deferred; the three-finger gesture is rejected; a solution is still to be found. Candidate to investigate, not decided: two
   fingers outside the cube.
   - Derived, not decided: rotations are x/y/z moves in the move list, which changes the move model; the net turn of a gesture can then be a rotation move; the equality check (requirement 8) covers
     rotations; view-mode orbit stays presentation only. Rationale (author's): the three-finger gesture collides with iOS system
     gestures; two fingers outside the cube collide with camera pinch-zoom and need a rule.
D5. **owner** Reset target on print-bound cubes: the state shown when play mode started.
D6. **owner** Activation: viewer toggle, not persisted.
D7. **owner** First apps: Playground and Picture Cube. (Derived, not in the decision comment: other apps later, calendar apps not yet.)
D8. **proposal accepted** ("we agree on the new gesture control"): (a) release rounds to the nearest 90 degrees; (b) dead zone of
   about 8 px; (c) layer choice on N >= 4 by hit depth; (d) two fingers on different axes are invalid.
   Proposal only, not decided: (e) Shift+drag is the mouse equivalent of the wide turn.

## Per-application availability

First release: Playground and Picture Cube (D7). Other applications follow later; calendar apps (Calendar7, calendar,
clock, status cube) are not yet in scope, so the "reset to the date" question does not arise for now.

## Open decisions (owner)

1. Sticker-edge rule for deriving layer and axis from the gesture direction (implementation step).
2. Gesture for a whole-cube rotation (deferred). Candidate to investigate: two fingers outside the cube, counted as an x/y/z
   move in 90 degree steps; it conflicts with camera pinch-zoom and needs a rule. Alt+drag with the mouse is a candidate from
   the earlier coordinator draft, not from the decision comment.
3. Reset as one jump or as an undo history of the session.
4. Whether a `play` URL parameter is allowed (the owner has decided only that play mode is not persisted).
5. Mouse equivalent of the wide turn: Shift+drag is a proposal only (D8e).
6. How release speed affects the target quarter turn (the owner update of 2026-11-12 names it; D8a rounds by angle).
7. Reset for cubes that are not print-bound (Playground is one of the first apps).

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

- [wstein/cubistry#461](https://github.com/wstein/cubistry/issues/461), related wstein/cubistry#110, wstein/cubistry#120, wstein/cubistry#85, wstein/cubistry#21, wstein/puzlwerk specs/006-shared-model (SM1, SM4, SM7)
- [ADR index](../adr/index.md)
