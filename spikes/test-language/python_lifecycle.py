#!/usr/bin/env python3
"""Repeat the unchanged full Python oracle and all ten controls in one process."""
import json
import sys
import time
from pathlib import Path


def emit(value):
    print("CUBISTRY_PHASE " + json.dumps(value), flush=True)


emit({"event": "READY"})
load_started = time.perf_counter_ns()
import hashlib
import importlib.util
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("lifecycle_oracle", ROOT / "research/counter/verify.py")
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)
emit({"event": "LOAD", "elapsedMs": (time.perf_counter_ns() - load_started) / 1e6,
      "scope": "load unchanged Python oracle and its standard-library modules"})
controls = Path(sys.argv[1])
paths = sorted(controls.glob("*.json"))
if len(paths) != 10:
    raise ValueError("ten corruption fixtures required")
for iteration in range(4):
    started = time.perf_counter_ns()
    result = oracle.check(ROOT / "public/counter-proof.json")
    # Fresh fixtures and a fresh source are parsed on every complete run.
    outcomes = []
    for path in paths:
        try:
            oracle.check(path)
        except (AssertionError, ValueError, TypeError, KeyError):
            outcomes.append(path.name)
        else:
            raise AssertionError("corruption accepted: " + path.name)
    data = json.loads((ROOT / "public/counter-proof.json").read_text())
    source = tuple((s["id"], s["cubie"], tuple(s["p"]), tuple(s["n"]), tuple(s["up"]), s["image"]) for s in data["printing"])
    states = [oracle.apply(source, w["word"]) for w in data["witnesses"]]
    checksum = hashlib.sha256(json.dumps(states, separators=(",", ":")).encode()).hexdigest()
    emit({"event": "RESULT", "iteration": iteration,
          "elapsedMs": (time.perf_counter_ns() - started) / 1e6,
          "values": result["valuesVerified"], "inverseChecks": result["inverseWordsReplayed"],
          "negativeControls": len(outcomes), "fullStickerFrames": 24 * len(states),
          "checksum": checksum, "scope": "unchanged full checker, chains/proof checks, ten corruptions and full-state audit"})
emit({"event": "DONE", "completedRuns": 4})
