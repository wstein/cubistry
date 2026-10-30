#!/usr/bin/env python3
"""Compare native yearless evidence with Julia output, not implementation."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent
julia = json.loads((root / '../../evidence/yearless-screen.json').read_text())
layouts, orbits = {}, {}
for row in (root / 'yearless.stdout.tsv').read_text().splitlines():
    p = row.split('\t')
    key = (p[1], int(p[2]), int(p[3]), tuple(map(int, p[4].split(','))))
    if p[0] == 'yearless-layout':
        layouts[key] = (p[5] == 'true', int(p[6]))
    elif p[0] == 'yearless-orbit':
        orbits[key, int(p[5]), int(p[6])] = tuple(map(int, p[7:10]))
seen_layouts, seen_orbits = set(), set()
for c in julia['candidates']:
    key = (c['language'], c['first_year'], c['last_year'], tuple(c['month_columns']))
    assert layouts[key] == (c['contiguous_month'], len(c['violations'])), key
    seen_layouts.add(key)
    for o in c['orbits']:
        key2 = (key, *o['orbit'])
        assert orbits[key2] == (o['nonblank_classes'], o['simultaneous_blanks'], o['capacity']), key2
        seen_orbits.add(key2)
assert len(seen_layouts) == len(layouts) == 140
assert len(seen_orbits) == len(orbits) == 1820
message = ('PASS: all 140 yearless layouts and all 1820 orbit triples match Julia output.\n'
           'DE/EN 2026–2099: no contiguous placement passes; exactly columns 2,6,7 pass each language.\n'
           'Physical feasibility UNKNOWN; specified font profile and top-row family only.\n')
(root / 'yearless-comparison.log').write_text(message)
print(message, end='')
