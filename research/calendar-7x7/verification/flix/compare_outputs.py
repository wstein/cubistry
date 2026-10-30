#!/usr/bin/env python3
"""Compare already-computed independent native evidence with Julia output only."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
julia = json.loads((root / '../../evidence/analysis.json').read_text())
native = {}
for row in (root / 'valid.stdout.tsv').read_text().splitlines():
    p = row.split('\t')
    if p[0] == 'orbit':
        native[p[1], int(p[2]), int(p[3]), int(p[4]), int(p[5])] = tuple(map(int, p[6:9]))
seen = set()
for layout in julia['contiguous_month_header_bounds']:
    if layout['first_year'] != 2026:
        continue
    for orbit in layout['orbits']:
        key = (layout['language'], layout['last_year'], layout['month_start_column'], *orbit['orbit'])
        if key in native:
            assert native[key] == (orbit['nonblank_classes'], orbit['simultaneous_blanks'], orbit['capacity']), key
            seen.add(key)
assert len(seen) == len(native) == 780

screen = json.loads((root / '../../evidence/oriented-header-screen.json').read_text())
expected_counts = {(x['language'], x['last_year']): x['passing_relaxations']
                   for x in screen['prefix_results'] if x['last_year'] in [2030, 2031]}
expected_passes = {}
for lang, candidates in screen['largest_passing_prefixes'].items():
    for c in candidates:
        assert c['last_year'] == 2030
        key = (lang, 2030, ','.join(map(str, c['month_columns'])), ','.join(map(str, c['year_columns'])), c['year_ink'], str(c['prefix']).lower())
        expected_passes[key] = {tuple(o['orbit']): (o['nonblank_classes'], o['simultaneous_blanks'], o['capacity']) for o in c['orbits']}
actual_passes = {}
actual_counts = {}
for row in (root / 'oriented.stdout.tsv').read_text().splitlines():
    p = row.split('\t')
    if p[0] == 'oriented-boundary':
        actual_counts[p[1], int(p[2])] = int(p[3])
    elif p[0] == 'oriented-pass':
        actual_passes[p[1], int(p[2]), *p[3:7]] = {}
    elif p[0] == 'oriented-orbit':
        key = (p[1], int(p[2]), *p[3:7])
        actual_passes[key][int(p[7]), int(p[8])] = tuple(map(int, p[9:12]))
assert actual_counts == expected_counts, (actual_counts, expected_counts)
assert actual_passes == expected_passes
message = ('PASS: all 780 baseline orbit triples agree.\n'
           'PASS: 2030/2031 orientation-screen counts agree: DE 6/0, EN 9/0.\n'
           'PASS: all 15 passing candidate identities and all 195 candidate orbit triples agree.\n'
           'Scope: specified font profile and searched header family; physical feasibility UNKNOWN.\n')
(root / 'baseline-comparison.log').write_text(message)
print(message, end='')
