#!/usr/bin/env python3
"""Raw CLI regressions for paired input order and decoded integer IDs."""
import copy
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
JAR = ROOT / 'proof-checkers/flix/artifact/flix.jar'


def main():
    source = json.loads((ROOT / 'public/counter-proof.json').read_text())
    one = copy.deepcopy(source)
    one['unpaddedPrinting'].reverse()
    both = copy.deepcopy(source)
    both['printing'].reverse()
    both['unpaddedPrinting'].reverse()
    zero = json.dumps(source, separators=(',', ':')).replace('"id":0,', '"id":-0,', 1)
    cases = [('unpadded-only', json.dumps(one), False),
             ('both-permuted', json.dumps(both), True),
             ('equivalent-negative-zero', zero, True)]
    with tempfile.TemporaryDirectory() as tmp:
        for name, raw, valid in cases:
            path = Path(tmp) / (name + '.json')
            path.write_text(raw)
            process = subprocess.run(['java', '-Xmx768m', '-jar', str(JAR),
                                      'counter', str(path), str(ROOT)],
                                     capture_output=True, text=True, timeout=60)
            result = json.loads(process.stdout)
            assert result['valid'] is valid, (name, result)
            assert process.returncode == (0 if valid else 1), (name, process.returncode)
            assert result['status'] == ('VALID' if valid else 'INVALID'), (name, result)
    print(json.dumps({'status': 'PASS', 'counterOrderControls': len(cases)}))


if __name__ == '__main__':
    main()
