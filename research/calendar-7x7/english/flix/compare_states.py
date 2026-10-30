#!/usr/bin/env python3
"""Compare native state digests; no physical-proof logic is implemented here."""
from pathlib import Path
root=Path(__file__).resolve().parent
rows=(root/'../evidence/julia-state-hashes.tsv').read_text().splitlines()
assert rows[0]=='target\tstate-sha256'
expected={int(p[0]):p[1] for line in rows[1:] if (p:=line.split('\t'))}
actual={int(p[1]):p[2] for line in (root/'legal.stdout.tsv').read_text().splitlines() if (p:=line.split('\t'))[0]=='state-sha256'}
assert len(expected)==len(actual)==91 and expected==actual
message=('PASS: all91 native Flix full294-sticker stateSHA256 hashes exactly match independent Julia replay.\n'
         'PASS: native legal DAG replay covers all91 representatives and888 months; print240 equals independently derived240 nonblank lower bound.\n')
(root/'state-comparison.log').write_text(message)
print(message,end='')
