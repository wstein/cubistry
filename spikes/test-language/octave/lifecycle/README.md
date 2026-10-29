# GNU Octave process lifecycle

This capture separates runtime startup, checker loading, the first **complete**
check, three repeated complete checks in the same fresh process, and observed
process exit. It uses Octave 9.4.0 and the unchanged `counter_probe.m` from
prototype commit `4547daae232de537acda15fffa32cd597539c34b`.

| Phase | Local observation |
| --- | ---: |
| Parent process creation to flushed `READY` received | 67.803 ms |
| Child checker metadata/load lookup (`nargin`) | 1.057 ms |
| Parent `READY` receipt to `LOAD` receipt, including wrapper/path setup | 8.065 ms |
| First complete checker call, including export and checksum | 4,332.239 ms |
| Repeated complete call 1 | 4,299.642 ms |
| Repeated complete call 2 | 4,481.538 ms |
| Repeated complete call 3 | 4,352.915 ms |
| Flushed `DONE` received to parent-observed process exit | 9.499 ms |
| Whole observed process | 17,555.673 ms |

`READY` is printed and flushed directly by `--eval` **before** adding the project
path or loading its functions. `LOAD` measures function metadata lookup through
`nargin('counter_probe')`; it is a parse/load probe, not an invented compiler or
JIT stage. The parent ready-to-load interval also includes loading the lifecycle
wrapper and creating its export directory. Installation/download setup is outside
this capture and is documented in the original report and runtime package pins.
A fresh process does not mean a cold operating-system page cache.

Every checker call reparses the input certificate and creates fresh local state,
then runs the original 100 padded witnesses, 100 full-frame inverse checks and
six corruption controls. It exports all 2,400 sticker frames and hashes those
actual output bytes before recording `RESULT`. Four actual exports are retained;
all match the independently Python-checked canonical output. Totals are 400
witnesses, 400 inverse checks, 24 corruption rejections and 9,600 sticker frames.
No negative control, data reset or physical assertion is skipped for warm calls.

The parent driver uses its own monotonic clock for startup and exit observation;
child `tic`/`toc` durations are reported separately and are not subtracted from
parent timestamps. The observed exit tail is **nonzero**. It includes pipe
handling, scheduling and normal runtime cleanup; it is not isolated destructor
CPU time. No garbage collection or cleanup was forced to manufacture that value.
This is one local process observation, not a universal timing guarantee.

## Reproduce

The aggregate spike branch owns `spikes/test-language/lifecycle_driver.py`.
From that checkout with an installed Octave, choose a new output directory:

```sh
python3 spikes/test-language/lifecycle_driver.py --output /tmp/NEW-octave-life --label octave -- octave-cli --no-init-file --no-site-file --no-history --quiet --eval "fprintf('CUBISTRY_PHASE {\"event\":\"READY\"}\n'); fflush(stdout); addpath('spikes/test-language/octave'); lifecycle_probe('public/counter-proof.json', '/tmp/NEW-octave-life/exports', 3);"
python3 spikes/test-language/octave/lifecycle_audit.py /tmp/NEW-octave-life
```

The recorded private runtime uses the same environment and library paths already
saved in `../results.json`. The exact driver hash and actual command are retained
in `report.json`; `stdout.txt` contains the original checker results and flushed
markers. `lifecycle_audit.py` independently compares every actual output frame
with the unchanged Python geometry and checks all four call logs and counts.
The saved `audit.json` passes, and the archived capture can be audited directly:

```sh
python3 spikes/test-language/octave/lifecycle_audit.py spikes/test-language/octave/lifecycle
```

Interpretation: Octave's process startup and observed shutdown are small compared
with this complete interpreted probe. The three repeated calls show no material
warm speed advantage in this capture. Those are results for the finite padded
prototype, not a measurement of the entire production Python suite. Existing
coverage gaps remain: unpadded/chained proofs, full cubie grouping and metadata,
3×3 centers and artwork validation have not been ported.
