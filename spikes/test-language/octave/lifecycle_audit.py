"""Independently audit every exported frame from one live Octave lifecycle capture."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("capture", type=Path)
args = parser.parse_args()
report = json.loads((args.capture / "report.json").read_text())
checker_path = ROOT / "research/counter/verify.py"
spec = importlib.util.spec_from_file_location("existing_checker", checker_path)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
proof_path = ROOT / "public/counter-proof.json"
proof = json.loads(proof_path.read_text())


def frame(sticker):
    return (sticker["id"], sticker["cubie"], tuple(sticker["p"]),
            tuple(sticker["n"]), tuple(sticker["up"]), sticker["image"])


source = tuple(map(frame, proof["printing"]))
expected = [checker.apply(source, item["word"]) for item in proof["witnesses"]]
reference_hash = hashlib.sha256((HERE / "states.json").read_bytes()).hexdigest()
events = report["events"]
assert [item["event"] for item in events] == [
    "READY", "LOAD", "RESULT", "RESULT", "RESULT", "RESULT", "DONE",
]
assert report["exitCode"] == 0
assert report["startupToReadyMs"] >= 0 and report["observedDoneToExitMs"] >= 0
assert all(left["parentReceivedMs"] <= right["parentReceivedMs"]
           for left, right in zip(events, events[1:]))
raw_results = [json.loads(line) for line in
               (args.capture / "stdout.txt").read_text().splitlines()
               if line.startswith("{")]
assert len(raw_results) == 4
audits = []
for iteration, event in enumerate(events[2:6]):
    assert event["iteration"] == iteration and event["elapsedMs"] > 0
    assert event["values"] == event["inverseChecks"] == 100
    assert event["negativeControls"] == 6 and event["fullStickerFrames"] == 2400
    assert raw_results[iteration]["negativeControls"] == 6
    assert raw_results[iteration]["values"] == raw_results[iteration]["inverseWords"] == 100
    path = args.capture / "exports" / f"lifecycle-{iteration}.json"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == event["checksum"] == reference_hash
    actual = json.loads(path.read_text())
    assert len(actual) == len(expected) == 100
    for value, state in enumerate(actual):
        assert tuple(map(frame, state)) == expected[value], (iteration, value)
    audits.append(dict(iteration=iteration, states=100, stickerFrames=2400,
                       negativeControls=6, stateSHA256=digest))
print(json.dumps(dict(
    status="PASS", calls=audits, totalStates=400, totalStickerFrames=9600,
    totalInverseChecks=400, totalNegativeControls=24,
    proofSHA256=hashlib.sha256(proof_path.read_bytes()).hexdigest(),
    pythonCheckerSHA256=hashlib.sha256(checker_path.read_bytes()).hexdigest(),
    scope="Actual frame exports replayed with unchanged Python geometry; counts checked against complete checker logs",
), indent=2))
