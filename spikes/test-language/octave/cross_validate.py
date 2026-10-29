"""Compare actual Octave frames with the existing independent Python checker."""
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
checker_path = ROOT / "research/counter/verify.py"
spec = importlib.util.spec_from_file_location("existing_checker", checker_path)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
proof_path = ROOT / "public/counter-proof.json"
proof = json.loads(proof_path.read_text())
states_path = HERE / "states.json"
states = json.loads(states_path.read_text())


def frame(sticker):
    return (sticker["id"], sticker["cubie"], tuple(sticker["p"]),
            tuple(sticker["n"]), tuple(sticker["up"]), sticker["image"])


source = tuple(map(frame, proof["printing"]))
assert len(states) == len(proof["witnesses"]) == 100
for value, word in enumerate(proof["witnesses"]):
    expected = checker.apply(source, word["word"])
    actual = tuple(map(frame, states[value]))
    assert actual == expected, f"Complete physical frame mismatch at {value}"
print(json.dumps({
    "status": "PASS", "states": len(states), "stickerFrames": len(states) * 24,
    "proofSHA256": hashlib.sha256(proof_path.read_bytes()).hexdigest(),
    "pythonCheckerSHA256": hashlib.sha256(checker_path.read_bytes()).hexdigest(),
    "octaveStatesSHA256": hashlib.sha256(states_path.read_bytes()).hexdigest(),
}, indent=2))
