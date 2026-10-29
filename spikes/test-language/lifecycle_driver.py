#!/usr/bin/env python3
"""Observe one process lifecycle without comparing clocks across processes."""
import argparse
import hashlib
import json
import os
import selectors
import subprocess
import time
from pathlib import Path

PREFIX = "CUBISTRY_PHASE "


def observe(command, output, label, timeout=180):
    if output.exists():
        raise ValueError("output must be new")
    output.mkdir(parents=True)
    events, lines = [], []
    ready_ns = done_ns = None
    started_ns = time.monotonic_ns()
    with (output / "stderr.txt").open("w") as errors:
        child = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=errors, bufsize=0)
        selector = selectors.DefaultSelector()
        selector.register(child.stdout, selectors.EVENT_READ)
        pending = b""
        deadline = time.monotonic() + timeout
        try:
            while selector.get_map():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError("lifecycle process deadline exceeded")
                for key, _ in selector.select(remaining):
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    pending += chunk
                    while b"\n" in pending:
                        raw, pending = pending.split(b"\n", 1)
                        line = raw.decode("utf8", errors="replace")
                        lines.append(line)
                        if not line.startswith(PREFIX):
                            continue
                        received_ns = time.monotonic_ns()
                        event = json.loads(line[len(PREFIX):])
                        event["parentReceivedMs"] = (received_ns - started_ns) / 1e6
                        if event["event"] == "READY":
                            if ready_ns is not None:
                                raise ValueError("duplicate READY")
                            ready_ns = received_ns
                        elif event["event"] == "DONE":
                            if done_ns is not None:
                                raise ValueError("duplicate DONE")
                            done_ns = received_ns
                        events.append(event)
            if pending:
                lines.append(pending.decode("utf8", errors="replace"))
            exit_code = child.wait(timeout=max(0.01, deadline - time.monotonic()))
            exited_ns = time.monotonic_ns()
        except BaseException:
            child.kill()
            child.wait()
            raise
        finally:
            selector.close()
            child.stdout.close()
            (output / "stdout.txt").write_text("\n".join(lines) + "\n")
    results = [e for e in events if e["event"] == "RESULT"]
    if exit_code or ready_ns is None or done_ns is None or len(results) != 4:
        raise RuntimeError("missing complete lifecycle markers or nonzero exit")
    phases = [event["event"] for event in events]
    expected = ["READY"] + (["LOAD"] if "LOAD" in phases else []) + ["RESULT"] * 4 + ["DONE"]
    if phases != expected:
        raise ValueError("lifecycle phase order must be READY, optional LOAD, four RESULTS, DONE")
    if [r["iteration"] for r in results] != list(range(len(results))):
        raise ValueError("iterations must be contiguous, starting with zero")
    if any(not r.get("checksum") for r in results):
        raise ValueError("each full run must provide a nonempty checksum")
    if len({r["checksum"] for r in results}) != 1:
        raise ValueError("fresh-state validation checksums disagree")
    count_keys = ("values", "inverseChecks", "inverseWords", "negativeControls", "fullStickerFrames", "languageAssertions")
    for key in count_keys:
        if key in results[0] and any(r.get(key) != results[0][key] for r in results):
            raise ValueError("validation coverage changed between iterations: " + key)
    if results[0].get("negativeControls", 0) < 1:
        raise ValueError("each complete run must include negative controls")
    report = {
        "label": label, "command": command, "workingDirectory": str(Path.cwd()),
        "clock": "parent time.monotonic_ns for observed startup/exit; child elapsed durations only",
        "startupToReadyMs": (ready_ns - started_ns) / 1e6,
        "observedDoneToExitMs": (exited_ns - done_ns) / 1e6,
        "totalProcessWallMs": (exited_ns - started_ns) / 1e6,
        "exitCode": exit_code, "events": events,
        "driverSHA256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "limits": ["shared machine; no forced garbage collection", "marker creation/flush, pipe delivery, scheduling and runtime cleanup are included in observed phases", "DONE-to-exit is an observed tail, not isolated destructor CPU time or a zero-cost guarantee"]}
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("provide a child command after --")
    observe(command, args.output, args.label, args.timeout)


if __name__ == "__main__":
    main()
