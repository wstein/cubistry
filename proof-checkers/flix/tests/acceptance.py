#!/usr/bin/env python3
"""Invoke the Flix raw-input CLI; never preprocess its certificate inputs."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
PIN = "c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--jar", type=Path, default=ROOT / "proof-checkers/flix/artifact/flix.jar")
    args = parser.parse_args()
    manifest_bytes = (ROOT / "proof-checkers/conformance/manifest.json").read_bytes()
    assert hashlib.sha256(manifest_bytes).hexdigest() == PIN
    manifest = json.loads(manifest_bytes)
    assert len(manifest["cases"]) == 195
    accepted = rejected = 0
    for case in manifest["cases"]:
        command = "counter" if case["group"] == "counter" else "state3"
        cmd = ["java", "-Xmx768m", "-jar", str(args.jar), command, str(ROOT / case["path"])]
        if command == "counter":
            cmd.append(str(ROOT))
        process = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        result = json.loads(process.stdout)
        assert result["valid"] is case["expectedValid"], (case["name"], result)
        if case["expectedValid"]:
            accepted += 1
            assert process.returncode == 0 and result["status"] == "VALID", (case["name"],result)
            if command == "counter":
                assert result["canonicalStateSHA256"] == case["canonicalStateSHA256"]
                assert [result[k] for k in ("values","inverseChecks","chainedTransitionsPerFormat","hubOrderedTransitions")] == [100,100,800,10000]
            else:
                wire = json.dumps(result["state"], ensure_ascii=True, separators=(",", ":")).encode()
                assert hashlib.sha256(wire).hexdigest() == case["expectedStateSHA256"] == result["stateSHA256"]
                if "expectedGoalMatches" in case:
                    assert result["goalMatches"] is case["expectedGoalMatches"]
        else:
            rejected += 1
            assert process.returncode in (1,2) and result["status"] in ("INVALID","INVALID_JSON","UNSUPPORTED"), (case["name"],result,process.returncode)
            assert isinstance(result["reason"], str) and result["reason"]
    assert (accepted,rejected)==(131,64)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "proof-checkers/conformance"
        path.mkdir(parents=True)
        (path / "counter-chain.json").write_text("[0]")
        process = subprocess.run(["java","-jar",str(args.jar),"counter",str(ROOT/"public/counter-proof.json"),tmp],capture_output=True,text=True)
        assert process.returncode == 3 and json.loads(process.stdout)["status"] == "ERROR"
    for extra, code, status in ((["unknown"],2,"UNSUPPORTED"),(["state3","/nonexistent/cubistry-proof-input.json"],3,"ERROR")):
        process = subprocess.run(["java","-jar",str(args.jar)]+extra,capture_output=True,text=True)
        assert process.returncode==code and json.loads(process.stdout)["status"]==status
    print(json.dumps({"status":"PASS","cases":195,"accepted":accepted,"rejected":rejected,"protocolControls":3}))

if __name__ == "__main__":
    main()
