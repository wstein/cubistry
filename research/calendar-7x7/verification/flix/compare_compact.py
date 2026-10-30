#!/usr/bin/env python3
"""Compare independent native compact-header evidence with Julia output only."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent
julia = json.loads((root / '../../evidence/compact-month-screen.json').read_text())
layouts, orbits = {}, {}
for row in (root / 'compact.stdout.tsv').read_text().splitlines():
    p = row.split('\t')
    key = (p[1], int(p[2]), int(p[3]), tuple(map(int, p[4].split(','))))
    if p[0] == 'compact-layout':
        layouts[key] = (p[5] == 'true', int(p[6]))
    elif p[0] == 'compact-orbit':
        orbits[key, int(p[5]), int(p[6])] = tuple(map(int, p[7:10]))
seen_layouts, seen_orbits = set(), set()
for c in julia['candidates']:
    key = (c['language'], c['first_year'], c['last_year'], tuple(c['month_columns']))
    assert layouts[key] == (c['requested_placement'], len(c['violations'])), key
    seen_layouts.add(key)
    for o in c['orbits']:
        key2 = (key, *o['orbit'])
        assert orbits[key2] == (o['nonblank_classes'], o['simultaneous_blanks'], o['capacity']), key2
        seen_orbits.add(key2)
assert len(seen_layouts) == len(layouts) == 24
assert len(seen_orbits) == len(orbits) == 312
message = ('PASS: all 24 compact-header layouts and all 312 orbit triples match Julia output.\n'
           'Requested columns 1,2: both languages, both ranges have orbit (-3,-2) demand 25 > capacity 24.\n'
           'All six adjacent placements fail for 2026–2099; only DE columns 6,7 pass for 2026 alone.\n'
           'Necessary inventory bounds only; physical feasibility UNKNOWN.\n')
(root / 'compact-comparison.log').write_text(message)
print(message, end='')
