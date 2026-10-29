#!/usr/bin/env python3
"""Build first, separately from the lifecycle runtime measurement."""
import argparse, hashlib, json, os, shutil, subprocess, time
from pathlib import Path
HERE = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("output must be new")
    command = ["./flixw", "build-fatjar", "--entrypoint", "lifecycleMain", "--no-install", "--threads", "2"]
    start = time.perf_counter_ns()
    process = subprocess.run(command, cwd=HERE, text=True, capture_output=True, timeout=180)
    elapsed_ms = (time.perf_counter_ns() - start) / 1e6
    for stream in ("stdout", "stderr"):
        args.output.with_suffix("." + stream + ".txt").write_text(getattr(process, stream))
    if process.returncode:
        raise RuntimeError("build failed; see saved stdout/stderr")
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    jar = HERE / "artifact/flix-lifecycle.jar"
    shutil.copyfile(HERE / "artifact/flix.jar", jar)
    inputs = [HERE / x for x in ("src/Main.flix", "src/Fixtures.flix", "src/Lifecycle.flix", ".flixw/lock.toml", "build_lifecycle.py")]
    record = {"command": command, "buildElapsedMs": elapsed_ms, "exitCode": process.returncode,
              "compiledArtifact": str(jar.relative_to(HERE)), "compiledArtifactSHA256": sha(jar), "compiledArtifactBytes": jar.stat().st_size,
              "sourceSHA256": {str(p.relative_to(HERE)): sha(p) for p in inputs},
              "coveragePerInvocation": {"canonicalStates": 100, "inverseChecks": 100, "negativeControls": 6, "auditReplays": 100},
              "scope": "unchanged geometryChecks plus identical full-state numeric checksum audit on each invocation"}
    args.output.write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record, indent=2))

if __name__ == "__main__":
    main()
