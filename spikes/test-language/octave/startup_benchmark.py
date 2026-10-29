"""Compare three fresh Octave processes with three identical checks in one process."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--octave", default="octave-cli")
parser.add_argument("--private-prefix")
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
if args.output.exists():
    raise SystemExit("Output must be new; do not overwrite published evidence")
environment = dict(os.environ, OPENBLAS_NUM_THREADS="1")
if args.private_prefix:
    prefix = Path(args.private_prefix)
    environment["OCTAVE_HOME"] = str(prefix)
    environment["LD_LIBRARY_PATH"] = ":".join(map(str, [
        prefix / "lib", prefix / "lib/x86_64-linux-gnu/octave/9.4.0",
        prefix / "lib/x86_64-linux-gnu",
    ]))
flags = [args.octave, "--no-init-file", "--no-site-file", "--no-history", "--quiet"]
expected_state_hash = hashlib.sha256((HERE / "states.json").read_bytes()).hexdigest()


def quoted(path):
    return "'" + str(path).replace("'", "''") + "'"


def run(paths):
    expression = "addpath('spikes/test-language/octave'); " + "; ".join(
        "counter_probe('public/counter-proof.json', " + quoted(path) + ")"
        for path in paths
    ) + ";"
    command = flags + ["--eval", expression]
    started = time.perf_counter()
    process = subprocess.run(command, cwd=ROOT, env=environment, text=True,
                             capture_output=True, timeout=90)
    wall = time.perf_counter() - started
    if process.returncode:
        raise RuntimeError(process.stderr)
    records = [json.loads(line) for line in process.stdout.splitlines() if line]
    assert len(records) == len(paths)
    assert all(row["values"] == row["inverseWords"] == 100
               and row["negativeControls"] == 6 for row in records)
    hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths]
    assert all(value == expected_state_hash for value in hashes)
    return dict(command=command, wallSeconds=wall, exitCode=process.returncode,
                records=records, stderr=process.stderr, stateHashes=hashes)


with tempfile.TemporaryDirectory(prefix="cubistry-octave-startup-") as temporary:
    directory = Path(temporary)
    fresh = [run([directory / f"fresh-{i}.json"]) for i in range(3)]
    batch = run([directory / f"batch-{i}.json" for i in range(3)])
fresh_wall = sum(row["wallSeconds"] for row in fresh)
output = dict(
    scope="Three complete identical probes in each mode; one paired local observation",
    fresh=fresh, batch=batch, freshTotalSeconds=fresh_wall,
    batchTotalSeconds=batch["wallSeconds"],
    batchOverFreshRatio=batch["wallSeconds"] / fresh_wall,
    checksPerMode=dict(values=300, inverseWords=300, negativeControls=18,
                       exportedStickerFrames=7200),
    processesBefore=3, processesAfter=1,
    interpretation="No test is skipped; runtime ratios are not a universal speedup guarantee",
)
args.output.write_text(json.dumps(output, indent=2) + "\n")
print(json.dumps({key: output[key] for key in [
    "freshTotalSeconds", "batchTotalSeconds", "batchOverFreshRatio",
    "checksPerMode", "processesBefore", "processesAfter",
]}, indent=2))
