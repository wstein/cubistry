# Target changes during physical playback

A changed target replaces obsolete work at the next committed single-turn
boundary. The viewer finishes the current legal face turn once; shared playback
then discards the remaining old route and solves from its authoritative full
cubie state to the latest target. There is at most one latest pending target.
Repeated requests for the same active target do not restart motion.

This applies to Counter, both Timer prints, HSM symbols and bottom-word prints,
and the three-cube live clock. The calendar has its own corresponding
full-state controller. Changing a print or lettering style still requires idle
playback; this behavior never swaps sticker images during a turn.

The last completed numeric display remains `currentValue` during an interrupted
route. An intermediate physical pose is not reported as a completed number.
Returning to that last completed number still requires solving from the partial
pose, rather than treating the request as a no-op. Every actually committed turn
counts in the session total; the new plan starts its own completed/planned count.

Explicit **Stop** retains its separate finish-current-value contract: it drops
pending targets and finishes the active upright display. A later explicit Set,
step, Reset, or changed live target may replace that route as described above.
The controller never freezes an uncommitted half turn or teleports cubies.

HSM's settled blank-and-unit six-HTM bound is not asserted for an interrupted
pose whose blank or letter has moved away. `planFromPose` reuses the same exact
four-corner graph to restore all four requested front stickers; it does not
silently finish the obsolete number first or relabel a moved sticker. Full-state
continuity, actual counts, and exact target replay remain required.

Clock and Timer schedulers retain valid anticipatory deadlines for unchanged
active targets. A stale wall-clock target is replaced after the current turn;
its obsolete deadline is cleared. This is bounded recovery, not a hard real-time
browser guarantee.

Regression coverage lives in [controller tests](../tests/target-interruption.test.mjs),
[progress tests](../tests/move-progress.test.mjs), and
[browser tests](../tests/browser/target-interruption.spec.mjs).
