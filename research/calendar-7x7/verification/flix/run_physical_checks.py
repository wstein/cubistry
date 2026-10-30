#!/usr/bin/env python3
"""Build/invoke native Flix proof authority; Python only mutates/drives bytes."""
from pathlib import Path
import hashlib
import os
import subprocess
root = Path(__file__).resolve().parent
os.chdir(root)
env = dict(os.environ)
env.setdefault('FLIX_CACHE_HOME', '/workspace/shared/calendar-tooling/flix-cache')
env.setdefault('COURSIER_CACHE', '/workspace/shared/calendar-tooling/coursier-cache')
with open('physical-build.log', 'w') as log:
    subprocess.run(['./flixw', 'build-jar'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
calendar = root / '../../evidence/calendar-months.tsv'
certificate = root / '../../physical-review/DE-blank-obstruction.tsv'
raw = certificate.read_bytes()
lines = raw.splitlines(keepends=True)
negative = {
    'wrong-inventory': raw.replace(b'inventory\tA\t24\t23\n', b'inventory\tA\t23\t23\n'),
    'wrong-blank-quota': raw.replace(b'class\tA\t1\t\t0\tblank\t2\n', b'class\tA\t1\t\t0\tblank\t1\n'),
    'wrong-peak-witness': raw.replace(b'excluded-partner\t1\t2028\t2\t2\t2\n', b'excluded-partner\t1\t2026\t2\t2\t2\n'),
    'missing-exclusion': b''.join(line for line in lines if not line.startswith(b'excluded-partner\t1\t')),
    'wrong-allowed-partner': raw.replace(b'allowed-partner\t3\n', b'allowed-partner\t4\n'),
    'wrong-obstruction-month': raw.replace(b'obstruction\t2026\t11\t1\t1\n', b'obstruction\t2026\t10\t1\t1\n'),
    'wrong-target-glyph': raw.replace(b'obstruction-cell\tA\t5\t1\t18\t9\tdark\n', b'obstruction-cell\tA\t5\t1\t18\t8\tdark\n'),
    'wrong-profile': raw.replace(b'marked-overflow\tno-year', b'unmarked-overflow\tno-year'),
    'missing-final-lf': raw[:-1],
}
controls = root / 'physical-negative-controls'
controls.mkdir(exist_ok=True)
report = []
for name, content in [('valid', raw), *negative.items()]:
    assert name == 'valid' or content != raw, f'ineffective mutation: {name}'
    path = certificate if name == 'valid' else controls / f'{name}.tsv'
    if name != 'valid': path.write_bytes(content)
    command = ['java', '-jar', str(root / 'artifact/flix.jar'), 'physical-de-check', str(calendar), str(path)]
    result = subprocess.run(command, capture_output=True)
    (root / f'physical-{name}.stdout.tsv').write_bytes(result.stdout)
    (root / f'physical-{name}.stderr.log').write_bytes(result.stderr)
    assert result.returncode == (0 if name == 'valid' else 1), (name, result.returncode, result.stderr)
    report.append(f'{name}\t{result.returncode}\t{hashlib.sha256(content).hexdigest()}\n')
(root / 'physical-checks.tsv').write_text('case\texit\tcertificate-sha256\n' + ''.join(report))
metadata = ['Native authority: Flix physical-de-check; strict canonical certificate regeneration and direct universal obstruction.\n',
            'Scope: DE,2026–2099,fixed555555555111,marked overflow,no printed year,declared font/rotation profile.\n']
for path in ['src/PhysicalDe.flix', 'src/Oriented.flix', 'src/Main.flix', 'flix.jar', 'artifact/flix.jar']:
    metadata.append(f'sha256\t{path}\t{hashlib.sha256((root/path).read_bytes()).hexdigest()}\n')
metadata.append(subprocess.run(['java', '--version'],capture_output=True,check=True).stdout.decode())
metadata.append(subprocess.run(['./flixw', '--version'],env=env,capture_output=True,check=True).stdout.decode())
(root / 'physical-toolchain.log').write_text(''.join(metadata))
print('PASS: native Flix validates independent geometry, tight quotas,20 exclusions,all3 allowed partners and Nov2026 obstruction; valid certificate accepted,9 corrupt certificates rejected.')
