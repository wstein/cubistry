#!/usr/bin/env python3
"""Compare per-case and batched Python processes with exactly the same checks."""
import argparse
import importlib.util
import json
import statistics
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def check_cases(cases):
    spec = importlib.util.spec_from_file_location("unchanged_oracle", ROOT / "research/counter/verify.py")
    oracle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(oracle)
    results = []
    for path, expected in cases:
        try:
            oracle.check(path)
            status = "accepted"
        except (AssertionError, ValueError, TypeError, KeyError):
            status = "rejected"
        if status != expected:
            raise AssertionError(f"Unexpected result for {path}: {status}")
        results.append({"case": Path(path).name, "status": status})
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--controls", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--case", action="append", nargs=2)
    args = parser.parse_args()
    if args.case:
        print(json.dumps(check_cases(args.case)))
        return
    if not args.controls or not args.output or args.output.exists():
        parser.error("use existing --controls and new --output")
    cases = [(str(ROOT / "public/counter-proof.json"), "accepted")]
    cases += [(str(p), "rejected") for p in sorted(args.controls.glob("*.json"))]
    if len(cases) != 11:
        parser.error("expected ten corruption fixtures plus the valid certificate")
    individual_times, batch_times = [], []
    all_results = []
    for _ in range(3):
        results = []
        started = time.perf_counter()
        for path, expected in cases:
            command = [sys.executable, str(Path(__file__)), "--case", path, expected]
            results += json.loads(subprocess.check_output(command, text=True))
        individual_times.append((time.perf_counter() - started) * 1000)
        started = time.perf_counter()
        command = [sys.executable, str(Path(__file__))]
        for path, expected in cases:
            command += ["--case", path, expected]
        batched = json.loads(subprocess.check_output(command, text=True))
        batch_times.append((time.perf_counter() - started) * 1000)
        assert results == batched
        all_results.append(batched)
    report = {"python": sys.version, "casesPerTrial": len(cases), "results": all_results,
              "perCaseFreshProcessSamplesMs": individual_times,
              "singleBatchProcessSamplesMs": batch_times,
              "perCaseMedianMs": statistics.median(individual_times),
              "batchMedianMs": statistics.median(batch_times),
              "scope": "the same full Python checker on one valid certificate and ten rejected corruptions",
              "existingCINote": "unittest already batches cases; this is not a measured existing-CI improvement"}
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
