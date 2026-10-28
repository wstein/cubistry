# Workshop Timer

The separate Timer application uses four permanent digit stickers on its front:
minutes above seconds. It supports 00:00–59:50 in ten-second steps and starts at
15:00. This is a different physical print from Counter; changing applications
configures a different cube, rather than changing ink during a countdown.

## Evidence and configuration

The unchanged source is Cubistry's `research/cube-display-feasibility` commit
`7c05d28e97ecf30848220f5c70cb3100a4f3628d`. The original SAT evidence is commit
`22ad143168f814a1d7513d7ac2349b9c77c97a2d`. The copied evidence and its checksums
are in `research/workshop-timer/provenance.json`. Runtime promotion uses only the
full 59:50 optimized print, not the separate 19:50 candidate. Its 360 complete
physical states and 359 adjacent transitions use 1,324 HTM, at most five per
edge. R, R2 and R′ each count as one committed move.

Initial application configuration establishes its independently replayed
canonical 15:00 state with session count zero. Configuration is excluded from
runtime statistics. The source-to-00:00 proof setup is five moves; it is **not** a
five-move source-to-15:00 setup. The proof route to initial 15:00 is that setup
followed by the first 90 increments. The reverse countdown has 90 edges and
91 displays; its actual controller replay commits 331 HTM, excluding initial
configuration. Reset and catch-up are animated and counted.

Only an exact complete-state match permits a certified adjacent edge. Arbitrary
jumps, reset, and catch-up use the existing shared exactPhysical solver and full
state replay. Matching visible digits alone is insufficient. No new solver,
search, table, or claim of globally optimal display paths is introduced.

## Clock and settling

The clock uses a monotonic absolute deadline. The displayed bucket rounds
remaining time up to ten seconds, without accumulating interval drift. Playback
has one active legal target and one replaceable latest target. An active sequence
always finishes; elapsed ticks can replace the pending target without building a
queue. Pause freezes time immediately, finishes the active target, then settles
to the frozen bucket. Resume starts a new deadline from the frozen remainder.
Reset freezes the clock and queues the configured initial duration. Deadline
zero is reported as elapsed while the physical cube is still settling; completion
requires the verified physical 00:00 state.

The inherited six rotation-speed stops and camera controls are unchanged. Global
rotation speed persists even while Timer is selected; Counter value and format
remain separate. Reload returns to the saved idle Counter and never silently
resumes a Timer deadline. The
current parent UI default is 100 ms per move. Slow playback at two seconds per
move plus rendering overhead can exceed a ten-second tick for a five-move edge;
there is no guarantee that every intermediate display is shown at that speed.
The logical clock remains correct and the bounded latest-target policy catches
up safely.

On this cloud Chromium/SwiftShader run, actual five-move animation commitments
took 685 ms at the 100 ms default, 1,453 ms at the optional 250 ms stop, and 10,147 ms at the slow
2,000 ms setting. These are measured observations, not hardware-independent
guarantees; the slow edge demonstrably exceeded the ten-second tick. Reduced-motion tests do not establish real animation timing budgets.

## Reproduction

```sh
npm run check
python3 research/workshop-timer/evidence/verify.py
python3 research/workshop-timer/evidence/optimization/verify.py
python3 -m unittest discover -s research/workshop-timer/evidence -p test_verify.py
python3 -m unittest discover -s research/workshop-timer/evidence/optimization -p test_verify.py
python3 research/workshop-timer/verify.py test-results/workshop-timer-commits.json
```

This feature is stacked on PR #54 (`feat/53-cube-first-ui`) for issue #30. It
does not modify the protected research branch or the independently owned parent.

Counter Leading Zero is a presentation-only mask inherited from PR #54. Both
Counter formats retain the same certified print and 339-HTM route. Timer always
clears that mask: its four zero glyphs are real, upright digits. Returning to
Counter restores its presentation preference without changing its physical print.
