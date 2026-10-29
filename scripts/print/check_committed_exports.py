"""Verify every committed print preset without regenerating any bytes.

Each file listed in public/print/catalog.json must hash to the catalog value,
then the independent verifier decodes the committed SVG and PDF content. Nothing
here depends on the zlib build that produced the PDFs and ZIPs.
"""
import hashlib, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRINT = ROOT / "public/print"
VERIFIER = Path(__file__).with_name("verify_exports.py")

catalog = json.loads((PRINT / "catalog.json").read_bytes())
failures = []
for entry in catalog["entries"]:
    folder = PRINT / entry["directory"]
    for name, expected in entry["files"].items():
        actual = hashlib.sha256((folder / name).read_bytes()).hexdigest()
        if actual != expected:
            failures.append(f"{entry['id']}/{name}: catalog hash mismatch")
    result = subprocess.run([sys.executable, str(VERIFIER), str(ROOT), str(folder)], capture_output=True, text=True)
    if result.returncode != 0:
        failures.append(f"{entry['id']}: verify_exports failed: " + (result.stdout + result.stderr).strip().splitlines()[-1])
    else:
        print(f"PASS {entry['id']}")
if failures:
    print("\n".join(failures), file=sys.stderr)
    sys.exit(1)
