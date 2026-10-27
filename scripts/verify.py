"""Independent, dependency-free verifier; never imports the ReScript/JS code.

Enumerates datetime dates and all times separately (independent quantifiers),
reconstructs physical sticker orbits from the integer lattice, and checks the
saved certificate. Assertion failures are nonzero exits, including under -O.
"""
import collections
import datetime as dt
import itertools
import json
from pathlib import Path


def require(condition, message):
    if not condition:
        raise AssertionError(message)


ROOT = Path(__file__).resolve().parents[1]
r = json.loads((ROOT / 'results/feasibility.json').read_text())
locales = {
    'DE': ('MON DIE MIT DON FRE SAM SON'.split(), 'JAN FEB MÄR APR MAI JUN JUL AUG SEP OKT NOV DEZ'.split()),
    'EN': ('MON TUE WED THU FRI SAT SUN'.split(), 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()),
}
for lang, (weekdays, months) in locales.items():
    require(r['conventions']['weekdays' + lang] == weekdays, 'Weekday convention mismatch')
    require(r['conventions']['months' + lang] == months, 'Month convention mismatch')

# Independent hand-specified 0-based front slots, checked against spatial model below.
slots = {
    'corners': [0, 4, 20, 24],
    'wings': [1, 3, 5, 9, 15, 19, 21, 23],
    'middleEdges': [2, 10, 14, 22],
    'axialCenters': [7, 11, 13, 17],
    'diagonalCenters': [6, 8, 16, 18],
    'fixedCenters': [12],
    'positiveWingStickers': [1, 9, 15, 23],
    'negativeWingStickers': [3, 5, 19, 21],
}
date_max = {n: collections.Counter() for n in slots}
time_max = {n: collections.Counter() for n in slots}
date_sets = {n: set() for n in slots}
time_sets = {n: set() for n in slots}
witnesses = {}
dates = 0
date = dt.date(2020, 1, 1)
while date < dt.date(2050, 1, 1):
    dates += 1
    for lang, (weekdays, months) in locales.items():
        text = weekdays[date.weekday()] + '  ' + f'{date.day:02}' + months[date.month-1] + ' ' + str(date.year) + '─────'
        require(len(text) == 20, 'Unicode codepoint width')
        for name, indices in slots.items():
            projection = ''.join(text[i] for i in indices if i < 20)
            date_sets[name].add(projection)
            histogram = collections.Counter(projection)
            for char, count in histogram.items():
                if count > date_max[name][char]:
                    date_max[name][char] = count
                    if name == 'positiveWingStickers':
                        witnesses[char] = {'language': lang, 'date': str(date), 'dateMultiplicity': count}
    date += dt.timedelta(days=1)
for minute in range(1440):
    text = f'{minute // 60:02}:{minute % 60:02}'
    for name, indices in slots.items():
        projection = ''.join(text[i-20] for i in indices if i >= 20)
        time_sets[name].add(projection)
        time_max[name] |= collections.Counter(projection)

bounds = {name: date_max[name] + time_max[name] for name in slots}
for name in r['orbits']:
    o = r['orbits'][name]
    require(o['frontSlots'] == slots[name], 'Front slot mismatch')
    require(o['symbols'] == bounds[name], f'{name}: incorrect inventory')
    require(o['lowerBound'] == bounds[name].total(), f'{name}: incorrect bound')
    require(o['dateProjections'] == len(date_sets[name]), 'Date projection count')
    require(o['timeProjections'] == len(time_sets[name]), 'Time projection count')
require(dates == r['validDates'] == 10958, 'Date count')
require(r['totalDisplays'] == dates * 1440 * 2 == 31559040, 'Display count')
require(sum(bounds[n].total() for n in r['orbits']) == r['pooledInventoryLowerBound'] == 115, 'Pooled bound')

# Independent lattice construction: every surface position and its exposed normals.
vectors = list(itertools.product(range(-2, 3), repeat=3))
stickers = []
for p in vectors:
    for axis, value in enumerate(p):
        if abs(value) == 2:
            n = tuple((1 if value > 0 else -1) if i == axis else 0 for i in range(3))
            stickers.append((p, n))
require(len(stickers) == 150, 'Physical sticker count')

def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def rotate(v, axis):
    unit = tuple(int(i == axis) for i in range(3))
    return tuple(x + dot(unit, v)*y for x, y in zip(cross(unit, v), unit))


def piece_class(p):
    a = sorted(map(abs, p))
    return {(2,2,2): 'corners', (1,2,2): 'wings', (0,2,2): 'middleEdges',
            (1,1,2): 'diagonalCenters', (0,1,2): 'axialCenters', (0,0,2): 'fixedCenters'}[tuple(a)]


def chirality(sticker):
    p, n = sticker
    m = tuple((v // 2) if abs(v) == 2 and n[i] == 0 else 0 for i, v in enumerate(p))
    q = tuple(v - 2*n[i] - 2*m[i] for i, v in enumerate(p))
    return dot(n, cross(m, q))


# Full connected components of the labeled sticker action; inverse turns are
# powers of these generators. No same-color identification is performed.
adjacency = {s: set() for s in stickers}
for axis in range(3):
    for layer in (-2, -1, 1, 2):
        for s in stickers:
            p, n = s
            target = (rotate(p, axis), rotate(n, axis)) if p[axis] == layer else s
            require(target in adjacency, 'Nonphysical destination')
            adjacency[s].add(target)
            if piece_class(p) == 'wings':
                require(chirality(s) == chirality(target), 'Wing chirality not invariant')
seen, components = set(), []
for s in stickers:
    if s in seen:
        continue
    component, pending = set(), [s]
    while pending:
        t = pending.pop()
        if t in component:
            continue
        component.add(t)
        pending.extend(adjacency[t] - component)
    seen |= component
    front = sorted((2-p[1])*5 + p[0]+2 for p, n in component if n == (0,0,1))
    components.append((piece_class(s[0]), len(component), tuple(front)))
actual = sorted((c['pieceClass'], c['size'], tuple(c['frontSlots'])) for c in r['stickerComponents'])
require(actual == sorted(components), 'Independent sticker components disagree')

for sign, name in [(1, 'positiveWingStickers'), (-1, 'negativeWingStickers')]:
    physical = [s for s in stickers if piece_class(s[0]) == 'wings' and chirality(s) == sign]
    require(len(physical) == 24, 'Chiral orbit capacity')
    front = sorted((2-p[1])*5+p[0]+2 for p, n in physical if n == (0,0,1))
    require(front == slots[name], 'Chiral front positions')
    saved = next(o for o in r['wingStickerOrbits'] if o['chirality'] == sign)
    require(saved['symbols'] == bounds[name], 'Refined symbol inventory')
    require(saved['lowerBound'] == bounds[name].total(), 'Refined bound')
    require(saved['availableStickers'] == 24, 'Refined capacity')
    require(len(date_sets[name]) == saved['dateProjections'], 'Refined date projections')
    require(len(time_sets[name]) == saved['timeProjections'], 'Refined time projections')

# Check the independently reconstructed cubie inventory and permutation signs.
cubies = sorted({p for p, _ in stickers})
by_class = {name: [p for p in cubies if piece_class(p) == name] for name in r['orbits']}
require(r['geometry']['stickerCount'] == 150, 'Geometry sticker count')
require(r['geometry']['cubieCounts'] == {k:len(v) for k,v in by_class.items()}, 'Cubie counts')
expected_generators = []
for axis in range(3):
    for layer in (-2,-1,1,2):
        signs = {}
        for name, positions in by_class.items():
            permutation = [positions.index(rotate(p,axis) if p[axis] == layer else p) for p in positions]
            signs[name] = sum(permutation[i] > permutation[j] for i in range(len(positions)) for j in range(i+1,len(positions))) % 2
        expected_generators.append({'axis':axis, 'layer':layer, 'parity':signs})
require(r['geometry']['generators'] == expected_generators, 'Cubie permutation signs')

# Direct enumeration of the reduced four-slot targets also confirms the
# maxima without using the max(date)+max(time) implementation above.
maximum = collections.Counter()
for date_part in date_sets['positiveWingStickers']:
    for time_part in time_sets['positiveWingStickers']:
        maximum |= collections.Counter(date_part + time_part)
require(maximum == bounds['positiveWingStickers'], 'Cartesian-product reduction mismatch')
require(maximum.total() == 26 > 24, 'No impossibility obstruction')
require(r['obstruction'] == {'chirality':1, 'frontSlots':[1,9,15,23], 'required':26, 'available':24}, 'Obstruction metadata')
require(r['status'] == 'UNSAT', 'Incorrect outcome')
print('VERIFIED UNSAT: 26 required stickers in a 24-sticker invariant orbit.')
print(f'Independently checked {dates} dates in both languages, 1440 minutes, and all 12 move generators.')
print('Double-letter witnesses:', json.dumps({c:witnesses[c] for c in ['I','R']}, ensure_ascii=False))
