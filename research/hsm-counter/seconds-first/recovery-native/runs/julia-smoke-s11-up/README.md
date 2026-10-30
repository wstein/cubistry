# Julia single-mode smoke result

**UNKNOWN / NOT CONFIRMED**. This run checked only S 00–11 counting up;
its successful harness exit is not a full-profile acceptance. The deterministic
verdict explicitly says `valid: false`, `status: UNKNOWN` and `PARTIAL`.

It independently enumerated 62,208 legal settled poses and rebuilt 1,308,546
recovery edges. All recorded metrics and 14 sample replays (54 steps) plus edge
and complete-path inverses matched for this one mode. Fresh-process elapsed time
was 77.119 seconds; maximum resident memory was 563,240 KiB. Setup and dependency
installation are not included in that invocation.

The [capture](capture.json) records the actual command, working directory, input
and source hashes, process status, timing and resource usage. `capture.py` is
subprocess/resource/hash instrumentation, not a proof verifier. The exact source
snapshot under `source/` matches the captured module digest; it preceded the
later resource-guard and phase-log commit used for the full eighteen-mode run.
The original runner retains historical absolute workspace and input paths; to
reproduce elsewhere, restore the source snapshot into a separate project,
provide the two unchanged raw inputs identified by the parent manifest, and
adapt paths only. Use Julia 1.13.3 and the retained project/manifest files.

No Flix acceptance or full eighteen-mode Julia acceptance is claimed here.
