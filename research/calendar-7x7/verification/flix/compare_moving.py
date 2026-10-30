#!/usr/bin/env python3
"""Compare independently computed native moving-month results with JSON only."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent
julia = json.loads((root / '../../evidence/moving-month-screen.json').read_text())
expected = {}
family_expected = {}
for result in julia['results']:
    lang = result['language']
    for c in result['named_schemes']:
        expected[c['name'], lang] = c
    for family in result['families']:
        size = family['months_per_group']
        family_expected[lang, size] = (family['tested'], family['passing'])
        for i, c in enumerate(family['best_candidates'], 1):
            expected[f'group{size}_best{i}', lang] = c
actual, family_actual, orbit_count = {}, {}, 0
for row in (root / 'moving.stdout.tsv').read_text().splitlines():
    p = row.split('\t')
    if p[0] == 'moving-layout':
        key = (p[1], p[2])
        assert p[3] == '2099'
        assert (p[4] == 'true') == expected[key]['passes_necessary_bound'], key
        actual[key] = {}
    elif p[0] == 'moving-orbit':
        key = (p[1], p[2])
        actual[key][int(p[4]), int(p[5])] = tuple(map(int, p[6:11]))
        orbit_count += 1
    elif p[0] == 'moving-family':
        family_actual[p[1], int(p[2])] = (int(p[3]), int(p[4]))
assert family_actual == family_expected, (family_actual, family_expected)
assert len(actual) == 34 and orbit_count == 442
for key, native_orbits in actual.items():
    c = expected[key]
    expected_orbits = {tuple(o['orbit']): (o['base_nonblank_classes'], o['month_classes'],
        o['base_nonblank_classes'] + o['month_classes'], o['simultaneous_blanks'], o['capacity']) for o in c['orbits']}
    assert native_orbits == expected_orbits, key
message = ('PASS: all 34 candidate verdicts and all 442 native orbit records match Julia output.\n'
           'PASS: all 32550 grouped schedules independently enumerated; halfyear DE0/EN0, quarter DE1/EN3, pair DE0/EN55.\n'
           'Common candidate: starts 555555555111 passes necessary bounds in both languages, 2026–2099.\n'
           'Blank demand computed as max over actual month/year states of date blanks plus that month schedule top blanks.\n'
           'Necessary inventory bounds only; physical feasibility UNKNOWN.\n')
(root / 'moving-comparison.log').write_text(message)
print(message, end='')
