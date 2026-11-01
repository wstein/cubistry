# Counter 0-99 usage

How the Counter 0-99 application behaves: controls, routes and the alternative print. Back to the [README](../README.md).

The first local MVP is a **real fixed-print
2×2 counter**: two constant upper title stickers and two lower digits, 0–99.

The shared chooser in the header offers **Counter 0–99**, starting at 00 with the
certified print. **Set** moves directly to the target; **Run** counts toward it
by one per second, automatically choosing up or down. Editing the input alone
does not change a running target. Set or a manual step interrupts Run. **Stop**
finishes the active complete physical value. Slow animation delays progression
instead of skipping values. Reload restores the last completed value without
restarting Run.

Manual −10/−1/+1/+10 actions clamp at the bounds unless **Wrap 99 ↔ 0** is
checked. Run always follows the direct numeric route, regardless of Wrap.
**Leading Zero** only shows or hides the leading 0 in the existing optimized
layout. It never selects a legacy print or resets the value, physical state,
Run, move counters, or camera. Both checkbox states use the same certified
339-HTM traversal. The unchecked option is screen formatting; the permanent
print/sticker identities remain unchanged.

Drag to orbit and scroll to zoom. **Rotation Speed** has seven stops: 2 s, 1 s,
500 ms, 250 ms, 100 ms (default), 50 ms, and 10 ms per HTM move. It changes animation
only. The same **Run** button changes to **Stop** in place while work is active.
Current state, session moves, the current move sequence, and **Reset session
moves** are always visible together below the cube, above Rotation Speed.
The 60-minute timer is a separate application
([Workshop timer](WORKSHOP_TIMER.md); background in
[issue #30](https://github.com/wstein/cubistry/issues/30)). See
[cube-first controls and verification](CUBE_FIRST_UI.md).

The [certified route](COUNTER_CERTIFIED_TRAVERSAL.md) retains 339 committed
HTM over 99 adjacent increments, maximum five per edge, excluding setup.
The Counter's **Sticker print** control also offers the
[blank-top 00–99 print](COUNTER_BLANK_TOP.md): blank top cells, a physical
LZ/NZ mode on the checkbox labeled *Leading zero mode (physical)* there, Wrap
on by default, cyclic routes of 278 (LZ) and 270 (NZ) HTM with at
most 4 HTM per edge, pinned from research PR #134. It needs its own stickers;
the titled print stays the default.
[Exact-frame arbitrary-jump planning](COUNTER_ARBITRARY_JUMPS.md) reuses the
same shared solver while correcting coordinate-frame bias; it does not claim
global exactPhysical optimality or an arbitrary-path 339-HTM bound.
