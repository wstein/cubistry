#!/usr/bin/env python3
"""Drive the native Flix checker; Python does no calendar or capacity arithmetic."""
from pathlib import Path
import hashlib
import os
import subprocess

root = Path(__file__).resolve().parent
os.chdir(root)
evidence = root / '../../evidence/calendar-months.tsv'
env = dict(os.environ)
env.setdefault('FLIX_CACHE_HOME', '/workspace/shared/calendar-tooling/flix-cache')
env.setdefault('COURSIER_CACHE', '/workspace/shared/calendar-tooling/coursier-cache')
with open('build.log', 'w') as log:
    subprocess.run(['./flixw', 'build-jar'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
jar = root / 'artifact/flix.jar'
raw = evidence.read_bytes()
rows = raw.splitlines(keepends=True)
negative = {
    'wrong-weekday': raw.replace(b'2026\t1\t3\t31\n', b'2026\t1\t4\t31\n'),
    'leap-length': raw.replace(b'2028\t2\t1\t29\n', b'2028\t2\t1\t28\n'),
    'missing-month': b''.join(rows[:2] + rows[3:]),
    'duplicate-month': b''.join(rows[:2] + [rows[1]] + rows[2:]),
    'invalid-integer': raw.replace(b'2026\t1\t3\t31\n', b'2026\t1x\t3\t31\n'),
    'signed-integer': raw.replace(b'2026\t1\t3\t31\n', b'+2026\t1\t3\t31\n'),
    'out-of-order': b''.join(rows[:1] + [rows[2], rows[1]] + rows[3:]),
    'missing-final-lf': raw[:-1],
    'crlf': raw.replace(b'\n', b'\r\n'),
    'extra-record': raw + rows[-1],
    'invalid-utf8': raw + b'\xff',
}
controls = root / 'negative-controls'
controls.mkdir(exist_ok=True)
report = []
for name, content in [('valid', raw), *negative.items()]:
    assert name == 'valid' or content != raw, f'ineffective mutation: {name}'
    target = evidence if name == 'valid' else controls / f'{name}.tsv'
    if name != 'valid':
        target.write_bytes(content)
    completed = subprocess.run(['java', '-jar', str(jar), str(target)], capture_output=True)
    (root / f'{name}.stdout.tsv').write_bytes(completed.stdout)
    (root / f'{name}.stderr.log').write_bytes(completed.stderr)
    expected = 0 if name == 'valid' else 1
    assert completed.returncode == expected, (name, completed.returncode, completed.stderr)
    report.append(f'{name}\t{completed.returncode}\t{hashlib.sha256(content).hexdigest()}\n')
(root / 'checks.tsv').write_text('case\texit\tinput-sha256\n' + ''.join(report))
oriented = subprocess.run(['java', '-jar', str(jar), 'oriented', str(evidence)], capture_output=True, check=True)
(root / 'oriented.stdout.tsv').write_bytes(oriented.stdout)
(root / 'oriented.stderr.log').write_bytes(oriented.stderr)
month_ink = subprocess.run(['java', '-jar', str(jar), 'oriented-month', str(evidence)], capture_output=True, check=True)
(root / 'oriented-month.stdout.tsv').write_bytes(month_ink.stdout)
(root / 'oriented-month.stderr.log').write_bytes(month_ink.stderr)
yearless = subprocess.run(['java', '-jar', str(jar), 'yearless', str(evidence)], capture_output=True, check=True)
(root / 'yearless.stdout.tsv').write_bytes(yearless.stdout)
(root / 'yearless.stderr.log').write_bytes(yearless.stderr)
compact = subprocess.run(['java', '-jar', str(jar), 'compact', str(evidence)], capture_output=True, check=True)
(root / 'compact.stdout.tsv').write_bytes(compact.stdout)
(root / 'compact.stderr.log').write_bytes(compact.stderr)
compact_prefix = subprocess.run(['java', '-jar', str(jar), 'compact-prefix', str(evidence)], capture_output=True, check=True)
(root / 'compact-prefix.stdout.tsv').write_bytes(compact_prefix.stdout)
(root / 'compact-prefix.stderr.log').write_bytes(compact_prefix.stderr)
(root / 'compact-split-invariant.log').write_text('Native compact: fixed 1+2 for every month.\nNative compact-prefix: fixed 2+1 for every month.\nNo adaptive monthly mixing; separate DE and EN print inventories.\n')
moving = subprocess.run(['java', '-jar', str(jar), 'moving', str(evidence), str(root / '../../evidence/moving-candidates.tsv')], capture_output=True, check=True)
(root / 'moving.stdout.tsv').write_bytes(moving.stdout)
(root / 'moving.stderr.log').write_bytes(moving.stderr)
version = subprocess.run(['java', '--version'], capture_output=True, check=True).stdout.decode()
compiler = subprocess.run(['./flixw', '--version'], env=env, capture_output=True, check=True).stdout.decode()
(root / 'toolchain.log').write_text(version + compiler + '\ncompiler-sha256\t' + hashlib.sha256((root / 'flix.jar').read_bytes()).hexdigest() + '\n')
print(f'PASS: valid TSV accepted; {len(negative)} corrupted TSVs rejected; native Flix inventory/census stdout in valid.stdout.tsv; current moving-month screen in moving.stdout.tsv; compact alternative in compact.stdout.tsv; historical yearless screen in yearless.stdout.tsv; historical orientation boundary in oriented.stdout.tsv')
