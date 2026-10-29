#!/usr/bin/env python3
"""Build optional Flix checker and verify the pinned parser artifact before use."""
import argparse
import hashlib
import json
import subprocess
import time
from pathlib import Path
HERE = Path(__file__).resolve().parent

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.output and args.output.exists():
        parser.error("output must be new")
    command = ["./flixw", "build-fatjar", "--threads", "2"]
    started = time.perf_counter_ns()
    subprocess.run(command, cwd=HERE, check=True)
    elapsed = (time.perf_counter_ns() - started) / 1e6
    pin = json.loads((HERE / "parser-pin.json").read_text())
    jars = list((HERE / "lib").glob("**/jackson-core-2.22.4.jar"))
    if not jars or any(sha(p) != pin["sha256"] for p in jars):
        raise RuntimeError("resolved parser differs from its pinned SHA-256")
    jar = HERE / "artifact/flix.jar"
    record = {"command": command, "buildElapsedMs": elapsed,
              "parser": pin["artifact"], "parserSHA256": pin["sha256"],
              "artifactSHA256": sha(jar), "artifactBytes": jar.stat().st_size,
              "sourceSHA256": {str(p.relative_to(HERE)): sha(p) for p in sorted((HERE / "src").glob("*.flix"))}}
    if args.output:
        args.output.write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record, indent=2))

if __name__ == "__main__":
    main()
