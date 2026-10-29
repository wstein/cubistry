#!/usr/bin/env python3
"""Measure a bounded independent Julia port against the unchanged Python checker."""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
import platform
import statistics
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--julia", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--repetitions", type=int, default=20)
    args = parser.parse_args()
    if args.output.exists() or args.repetitions < 1:
        parser.error("output must be new and repetitions positive")
    args.output.mkdir(parents=True)
    cases = args.output / "controls"
    cases.mkdir()
    witness = ROOT / "public/counter-proof.json"
    oracle_path = ROOT / "research/counter/verify.py"
    spec = importlib.util.spec_from_file_location("unchanged_python_oracle", oracle_path)
    oracle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(oracle)
    data = json.loads(witness.read_text())

    def corrupt(name, edit):
        changed = copy.deepcopy(data)
        edit(changed)
        (cases / (name + ".json")).write_text(json.dumps(changed))

    corrupt("boolean-schema", lambda d: d.update(schema=True))
    corrupt("boolean-vector", lambda d: d["printing"][0]["p"].__setitem__(0, True))
    corrupt("fractional-normal", lambda d: d["printing"][0].update(n=[2/3, 2/3, -1/3]))
    corrupt("out-of-range-identity", lambda d: d["printing"][0].update(id=10**100))
    corrupt("out-of-range-position", lambda d: d["printing"][0].update(p=[2, 1, 1]))
    corrupt("duplicate-identity", lambda d: d["printing"].__setitem__(1, copy.deepcopy(d["printing"][0])))
    corrupt("rotated-print-up", lambda d: d["printing"][0].update(up=[-v for v in d["printing"][0]["up"]]))
    corrupt("illegal-token", lambda d: d["witnesses"][0].update(word="Rw"))
    corrupt("wrong-target", lambda d: d["witnesses"][1].update(word=d["witnesses"][0]["word"]))
    corrupt("repainted-unpadded", lambda d: d["unpaddedPrinting"][0].update(image="9"))

    started = time.perf_counter()
    full_python = oracle.check(witness)
    full_python_ms = (time.perf_counter() - started) * 1000
    python_controls = []
    for path in sorted(cases.glob("*.json")):
        try:
            oracle.check(path)
        except (AssertionError, ValueError, TypeError, KeyError) as error:
            python_controls.append({"case": path.name, "rejected": True, "reason": str(error)})
        else:
            raise AssertionError("Python accepted corruption: " + path.name)
    source = tuple((s["id"], s["cubie"], tuple(s["p"]), tuple(s["n"]), tuple(s["up"]), s["image"]) for s in data["printing"])
    words = [w["word"] for w in data["witnesses"]]
    expected = json.loads(json.dumps([oracle.apply(source, word) for word in words]))
    python_times = []
    checksum = 0
    for _ in range(5):
        started = time.perf_counter()
        for _ in range(args.repetitions):
            for word in words:
                frame = oracle.apply(source, word)[0]
                checksum += sum(a*b for a,b in zip(frame[2] + frame[4], (1,3,7,11,17,23)))
        python_times.append((time.perf_counter() - started) * 1000)
    output = args.output / "julia.json"
    command = [args.julia, "--startup-file=no", "--project=" + str(HERE / "julia"),
               str(HERE / "julia/checker.jl"), str(witness), str(cases), str(output), str(args.repetitions)]
    started = time.perf_counter()
    process = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=180)
    process_ms = (time.perf_counter() - started) * 1000
    (args.output / "julia.stdout.txt").write_text(process.stdout)
    (args.output / "julia.stderr.txt").write_text(process.stderr)
    if process.returncode:
        raise RuntimeError(f"Julia exited {process.returncode}; see saved stdout/stderr")
    result = json.loads(output.read_text())
    assert result["inputSHA256"] == digest(witness)
    assert result["canonicalStates"] == expected, "full physical state differs"
    assert result["checksum"] == checksum
    assert [c["case"] for c in result["corruptionControls"]] == [c["case"] for c in python_controls]
    assert all(c["rejected"] for c in result["corruptionControls"])
    (args.output / "python-states.json").write_text(json.dumps(expected, separators=(",", ":")))
    tracked = [witness, oracle_path, Path(__file__), HERE / "julia/checker.jl", HERE / "julia/Project.toml", HERE / "julia/Manifest.toml"]
    report = {
        "scope": "100 full canonical states; padded/unpadded displays and exact inverse frames; ten corruptions",
        "status": "PASS_FINITE_SCOPE",
        "notEstablished": ["all Python verifier schemas", "large certificate throughput", "full migration equivalence", "formal proof of checker correctness"],
        "baseline": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "gitStatus": subprocess.check_output(["git", "status", "--short"], cwd=ROOT, text=True).splitlines(),
        "platform": platform.platform(), "cpu": platform.processor(), "python": sys.version,
        "inputSHA256": digest(witness), "codeSHA256": {str(p.relative_to(ROOT)): digest(p) for p in tracked},
        "fullPythonProductionCheckerMs": full_python_ms,
        "fullPythonProductionCheckerResult": full_python,
        "pythonControls": python_controls, "juliaCommand": command, "juliaExitCode": process.returncode,
        "juliaFreshProcessIncludingCompilationAndAllSamplesMs": process_ms,
        "juliaValidationIncludingJITMs": result["validationIncludingJITMs"],
        "kernelWordsPerSample": 100 * args.repetitions,
        "pythonWarmKernelSamplesMs": python_times, "juliaWarmKernelSamplesMs": result["warmKernelSamplesMs"],
        "pythonWarmMedianMs": statistics.median(python_times),
        "juliaWarmMedianMs": statistics.median(result["warmKernelSamplesMs"]),
        "all100FullStatesEqual": True, "negativeControlsRejectedByBoth": len(python_controls),
    }
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k in ("status", "all100FullStatesEqual", "negativeControlsRejectedByBoth", "pythonWarmMedianMs", "juliaWarmMedianMs", "juliaFreshProcessIncludingCompilationAndAllSamplesMs")}, indent=2))


if __name__ == "__main__":
    main()
