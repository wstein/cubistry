# Completed Julia validation

Julia accepted the complete eighteen-mode raw recovery proof at native source
`249df9d31b1d2c6daa617e88f898ff0c25906300`. Overall confirmation remains
**UNKNOWN**, pending independent Flix validation and final review.

The readable [native output](positive.jsonl), [process capture](positive-capture.json)
and [summary](summary.json) describe 1,722,384 nodes and 28,747,368 edges summed
across the eighteen mode graphs, 264 sample paths and 1,061 forward steps with
edge and full-path inverses. Fresh-process elapsed time was 1,489.607 seconds;
maximum resident memory was 657,952 KiB. The result excludes global print
optimality and runtime reachability of forced poses.

The [evidence archive](evidence.tar.gz) retains all 110 payload files described by
its [manifest](manifest.json): source snapshots, exact inputs, commands, runtime
and driver hashes, raw outputs, controls, regressions, the initial partial smoke,
the documented decimal root cause and the interrupted obsolete baseline. Archive
SHA-256: `6832386c1400c9e90e2546262ae8d9a3c54872d810819509ff94b15e171758e5`.

Native controls passed: 23 exact-parser assertions, 78 semantic assertions and
eight raw CLI mutation cases. Existing native Julia 195-case conformance passed;
the old HSM command still rejects recovery as UNSUPPORTED. The old 46 HSM case
files passed a data-pin audit only; their full native semantic suite was not
rerun. Python instrumentation and data audits do not decide proof validity.
