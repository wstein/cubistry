#!/usr/bin/env python3
"""Cross-check lifecycle counts and numeric audit checksum with the Python oracle."""
import argparse
import importlib.util
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("oracle", ROOT / "research/counter/verify.py")
    oracle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(oracle)
    data = json.loads((ROOT / "public/counter-proof.json").read_text())
    source = tuple((s["id"],s["cubie"],tuple(s["p"]),tuple(s["n"]),tuple(s["up"]),s["image"]) for s in data["printing"])
    expected = 0
    weights = (1,3,7,11,17,23,29,31,37)
    for witness in data["witnesses"]:
        for i,c,p,n,u,image in oracle.apply(source,witness["word"]):
            expected += (i+1)*sum(a*b for a,b in zip(p+n+u,weights))+c+len(image)
    report = json.loads(args.report.read_text())
    results = [e for e in report["events"] if e["event"] == "RESULT"]
    assert report["exitCode"] == 0 and len(results) == 4
    for iteration, result in enumerate(results):
        assert result["iteration"] == iteration
        assert result["checksum"] == expected
        assert result["canonicalStates"] == 100
        assert result["inverseChecks"] == 100
        assert result["negativeControls"] == 6
        assert result["auditReplays"] == 100
        assert result["passed"] is True and result["elapsedNs"] >= 0
    print(json.dumps({"status":"PASS", "completeInvocations":4, "expectedAuditChecksum":expected}))

if __name__ == "__main__":
    main()
