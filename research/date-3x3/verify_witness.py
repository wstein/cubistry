"""Independent 3x3 date witness verification; standard-library Rodrigues replay.

No generator, solver, JavaScript, or project geometry imports. All 54 immutable
sticker identities and frames are carried through every actual legal move.
"""
import datetime as dt
import hashlib
import itertools
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LEXICONS = {
    'DE': {
        2: ('MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'),
        3: ('MON', 'DIE', 'MIT', 'DON', 'FRE', 'SAM', 'SON'),
        'months': ('JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'),
    },
    'EN': {
        2: ('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'),
        3: ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'),
        'months': ('JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'),
    },
}
VECTORS = tuple(itertools.product((-1, 0, 1), repeat=3))
POSITIONS = tuple(p for p in VECTORS if any(p))
AXES = tuple(tuple(sign if i == axis else 0 for i in range(3))
             for axis in range(3) for sign in (1, -1))
FRONT = tuple((x, y, 1) for y in (1, 0, -1) for x in (-1, 0, 1))
LAYERS = {'R': (0, 1), 'L': (0, -1), 'U': (1, 1),
          'D': (1, -1), 'F': (2, 1), 'B': (2, -1),
          'x': (0, None), 'y': (1, None), 'z': (2, None)}


def need(condition, message):
    if not condition:
        raise AssertionError(message)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def rodrigues(vector, axis, quarters):
    direction = tuple(int(i == axis) for i in range(3))
    cosine, sine = (1, 0, -1, 0)[quarters % 4], (0, 1, 0, -1)[quarters % 4]
    perpendicular, parallel = cross(direction, vector), dot(direction, vector)
    return tuple(vector[i] * cosine + perpendicular[i] * sine
                 + direction[i] * parallel * (1 - cosine) for i in range(3))


ROTATE = {(axis, quarters): {v: rodrigues(v, axis, quarters) for v in VECTORS}
          for axis in range(3) for quarters in range(4)}


def tokens(word, global_only=False):
    need(type(word) is str and len(word) <= 16384, 'Bounded string move word')
    result = word.split()
    need(len(result) <= 1024, 'Bounded move count')
    alphabet = 'xyz' if global_only else 'RLUDFB'
    need(all(re.fullmatch('[' + alphabet + r"](2|')?", token) for token in result),
         'Only explicit legal ' + ('whole-cube' if global_only else 'outer-face') + ' tokens')
    return result


def apply(state, word, global_only=False):
    for token in tokens(word, global_only):
        axis, layer = LAYERS[token[0]]
        amount = 2 if token.endswith('2') else -1 if token.endswith("'") else 1
        quarter = (-amount if layer is None else -layer * amount) % 4
        rotate = ROTATE[axis, quarter]
        state = tuple((identity, cubie, rotate[p], rotate[n], rotate[up], image)
                      if layer is None or p[axis] == layer
                      else (identity, cubie, p, n, up, image)
                      for identity, cubie, p, n, up, image in state)
    return state


def inverse(word):
    return ' '.join(token if token.endswith('2') else token[:-1]
                    if token.endswith("'") else token + "'"
                    for token in reversed(word.split()))


def calendar_patterns():
    current, end = dt.date(2000, 1, 1), dt.date(2400, 1, 1)
    patterns = set()
    days = 0
    while current < end:
        patterns.add((current.weekday(), current.day, current.month))
        current += dt.timedelta(days=1)
        days += 1
    need(days == 146097 and len(patterns) == 2562, 'Complete Gregorian 400-year cycle')
    return patterns


def candidate_model(path):
    raw = Path(path).read_bytes()
    candidate = json.loads(raw)
    need(candidate['schema'] == 'cubistry.date-3x3-constructive'
         and type(candidate['version']) is int and candidate['version'] == 1,
         'Exact constructive schema')
    locale, width = candidate['locale'], candidate['weekdayWidth']
    need(locale in LEXICONS and type(width) is int and width in (2, 3), 'Supported locale and width')
    need(candidate['id'] == locale.lower() + '-' + str(width), 'Exact candidate identity')
    expected_rows = ['weekday', 'day', 'month'] if locale == 'DE' else ['weekday', 'month', 'day']
    expected_day = ['blank', 'tens', 'units'] if locale == 'DE' else ['tens', 'blank', 'units']
    need(candidate['rows'] == expected_rows and candidate['dayCells'] == expected_day,
         'User-confirmed language-specific row/day layout')
    lexicon = LEXICONS[locale]
    for key, words in [('weekdayParts', lexicon[width]), ('monthParts', lexicon['months'])]:
        mapping = candidate[key]
        need(type(mapping) is dict and set(mapping) == set(words), 'Exact independent lexicon coverage')
        for word in words:
            parts = mapping[word]
            need(type(parts) is list and len(parts) == 3
                 and all(type(part) is str for part in parts) and ''.join(parts) == word,
                 'Fragments reproduce exact requested word')
            if key == 'weekdayParts':
                need(bool(parts[0]), 'Weekday starts in left column')
                if width == 2:
                    need(parts[2] == '', 'Two-letter weekday leaves third cell blank')
            if key == 'monthParts' and locale == 'EN':
                need(parts == list(word), 'English month is three separate middle-row letters')
    for kind, count, size in [('corners', 8, 3), ('edges', 12, 2)]:
        pieces = candidate['pieces'][kind]
        need(type(pieces) is list and len(pieces) == count, 'Exact physical piece inventory')
        for piece in pieces:
            need(type(piece) is list and len(piece) == size, 'Whole-piece sticker count')
            for token in piece:
                need(type(token) is list and len(token) == 2 and type(token[0]) is int
                     and type(token[1]) is str, 'Versioned slot/image pair')
                slot, image = token
                need(slot == -1 if image == '' else 0 <= slot < 9, 'Blank or fixed visible slot')
                if image:
                    need(sum(bool(v) for v in FRONT[slot]) == size, 'Correct corner/edge target type')
    centers = candidate['centerImages']
    expected_centers = ['0', '1', '2', '3', '', ''] if locale == 'DE' else ['A', 'E', 'P', 'U', 'C', 'O']
    need(centers == expected_centers, 'Explicit six immutable center images')
    return candidate, hashlib.sha256(raw).hexdigest()


def source_state(printing, candidate):
    need(type(printing) is list and len(printing) == 54, 'Exactly 54 fixed stickers')
    need(all(type(s['id']) is int and s['id'] == index and type(s['cubie']) is int
             for index, s in enumerate(printing)), 'Unique integral ordered sticker identities')
    expected_lattice = {(p, n) for p in POSITIONS for n in AXES if dot(p, n) == 1}
    observed, bodies = set(), {}
    for sticker in printing:
        for field in ('p', 'n', 'up'):
            vector = sticker[field]
            need(type(vector) is list and len(vector) == 3
                 and all(type(v) is int for v in vector), 'Integral 3D frame')
        p, n, up = (tuple(sticker[field]) for field in ('p', 'n', 'up'))
        need(p in POSITIONS and n in AXES and up in AXES
             and dot(p, n) == 1 and dot(n, up) == 0, 'Outward normal and tangent print-up')
        need(type(sticker['image']) is str and len(sticker['image']) <= 3, 'One immutable fragment image')
        observed.add((p, n))
        bodies.setdefault(sticker['cubie'], []).append(sticker)
    need(observed == expected_lattice, 'Complete 54-facelet lattice without duplicate facelets')
    need(sorted(bodies) == list(range(26)), 'Exactly 26 physical body identities')
    need(Counter(len(piece) for piece in bodies.values()) == {3: 8, 2: 12, 1: 6},
         'Eight corners, twelve edges, and six centers')
    for cubie, position in enumerate(POSITIONS):
        body = bodies[cubie]
        need(all(tuple(s['p']) == position for s in body), 'Rigid body source position')
        normals = [n for n in AXES if dot(position, n) == 1]
        need([tuple(s['n']) for s in body] == normals, 'Canonical complete source body facelets')
        size = sum(bool(v) for v in position)
        if size == 1:
            center_positions = [p for p in POSITIONS if sum(bool(v) for v in p) == 1]
            expected_tokens = [[4, candidate['centerImages'][center_positions.index(position)]]]
        else:
            kind = 'corners' if size == 3 else 'edges'
            kind_positions = [p for p in POSITIONS if sum(bool(v) for v in p) == size]
            expected_tokens = candidate['pieces'][kind][kind_positions.index(position)]
        for sticker, (slot, image) in zip(body, expected_tokens):
            need(type(sticker['slot']) is int and (sticker['slot'], sticker['image']) == (slot, image),
                 'Immutable sticker exactly matches constructive piece token')
            if image:
                p, n, up = (tuple(sticker[field]) for field in ('p', 'n', 'up'))
                # Rigid rotations preserve these dot/cross products. At an
                # upright front target they are exactly the target y/x values.
                signature = dot(p, up), dot(p, cross(up, n))
                need(signature == (FRONT[slot][1], FRONT[slot][0]),
                     'Printed fragment has the correct rigid upright slot class')
    return tuple((s['id'], s['cubie'], tuple(s['p']), tuple(s['n']), tuple(s['up']), s['image'])
                 for s in printing)


def desired_cells(candidate, weekday, day, month):
    locale, width = candidate['locale'], candidate['weekdayWidth']
    lexicon = LEXICONS[locale]
    weekday_cells = candidate['weekdayParts'][lexicon[width][weekday]]
    month_cells = candidate['monthParts'][lexicon['months'][month - 1]]
    digits = f'{day:02d}'
    day_cells = ['', digits[0], digits[1]] if locale == 'DE' else [digits[0], '', digits[1]]
    return weekday_cells + day_cells + month_cells if locale == 'DE' else weekday_cells + month_cells + day_cells


def show(state, cells):
    front = {p: (up, image) for identity, cubie, p, n, up, image in state if n == (0, 0, 1)}
    for position, image in zip(FRONT, cells):
        need(position in front and front[position][1] == image, 'Exact immutable front fragment')
        if image:
            need(front[position][0] == (0, 1, 0), 'Every nonblank glyph upright, including visible center')


def validate(path, candidate_path=None):
    raw = Path(path).read_bytes()
    witness = json.loads(raw)
    need(witness['schema'] == 'cubistry.date-3x3-witness'
         and type(witness['version']) is int and witness['version'] == 1, 'Exact witness schema')
    identity = witness['candidateId']
    need(identity in ('de-2', 'de-3', 'en-2', 'en-3'), 'Known candidate identity')
    candidate, candidate_hash = candidate_model(candidate_path or ROOT / 'constructive' / (identity + '.json'))
    need((identity, witness['locale'], witness['weekdayWidth'])
         == (candidate['id'], candidate['locale'], candidate['weekdayWidth']), 'Exact witness model')
    need(type(witness['weekdayWidth']) is int, 'Integral weekday width')
    source = source_state(witness['printing'], candidate)
    patterns = calendar_patterns()
    need(witness['complete'] is True and type(witness['totalTargets']) is int
         and witness['totalTargets'] == len(patterns), 'Complete 400-year coverage declared')
    targets = witness['targets']
    need(type(targets) is list and len(targets) == len(patterns), 'All target witnesses retained')
    observed = set()
    htm, preludes, corrections = [], [], []
    for target in targets:
        need(all(type(target[key]) is int for key in ('weekday', 'day', 'month')), 'Integral date pattern')
        pattern = target['weekday'], target['day'], target['month']
        need(pattern in patterns and pattern not in observed, 'Valid unique Gregorian date pattern')
        observed.add(pattern)
        cells = desired_cells(candidate, *pattern)
        need(target['cells'] == cells, 'Independent lexicon, row placement and leading-zero target')
        prelude, word, correction = (target[key] for key in ('prelude', 'word', 'centerCorrection'))
        state = apply(source, prelude, global_only=True)
        state = apply(state, word)
        state = apply(state, correction)
        show(state, cells)
        restored = apply(state, inverse(correction))
        restored = apply(restored, inverse(word))
        restored = apply(restored, inverse(prelude), global_only=True)
        need(restored == source, 'Inverse restores every original 54-sticker identity and frame')
        htm.append(len(word.split()) + len(correction.split()))
        preludes.append(len(prelude.split()))
        corrections.append(len(correction.split()))
    need(observed == patterns, 'Exact exhaustive calendar target set')
    return {'status': 'SAT', 'candidate': identity, 'locale': candidate['locale'],
            'weekdayWidth': candidate['weekdayWidth'], 'physicalStickers': 54,
            'gregorianDaysEnumerated': 146097, 'datePatternsVerified': len(observed),
            'allNonblankFramesUpright': True, 'visibleCenterOrientationVerified': True,
            'blankUpIgnored': True, 'fullInverseRestorations': len(targets),
            'sourceToTargetHTM': {'minimum': min(htm), 'maximum': max(htm),
                                  'total': sum(htm), 'mean': sum(htm) / len(htm)},
            'wholeCubePreludeTokens': {'minimum': min(preludes), 'maximum': max(preludes)},
            'centerCorrectionHTMHistogram': dict(sorted(Counter(corrections).items())),
            'witnessSHA256': hashlib.sha256(raw).hexdigest(),
            'constructiveSHA256': candidate_hash,
            'globalMoveOptimality': 'UNKNOWN',
            'scope': 'One immutable 3x3 print per candidate; outer-face turns plus explicit '
                     'whole-cube preludes; fixed fragments; exact nonblank upright frames; '
                     'all weekday/day/month patterns in the Gregorian 2000..2399 cycle.'}


def verify_center_helpers(path=ROOT / 'center-corrections.json'):
    helpers = json.loads(Path(path).read_bytes())
    need(helpers['schema'] == 'cubistry.3x3-center-corrections'
         and type(helpers['version']) is int and helpers['version'] == 1,
         'Exact center-helper schema')
    candidate, _ = candidate_model(ROOT / 'constructive/de-2.json')
    witness = json.loads((ROOT / 'witnesses/de-2.json').read_bytes())
    source = source_state(witness['printing'], candidate)
    fixed = tuple(s for s in source if sum(bool(v) for v in s[2]) > 1)
    center = next(s for s in source if s[2] == (0, 0, 1) and s[3] == (0, 0, 1))
    need(center[4] == (0, 1, 0), 'Canonical upright front-center source')
    observed, rows = {(0, 1, 0)}, []
    for helper in helpers['witnesses']:
        need(helper['frontCenterSourceUp'] == [0, 1, 0], 'Declared front-center source')
        state = apply(source, helper['word'])
        need(tuple(s for s in state if sum(bool(v) for v in s[2]) > 1) == fixed,
             'Helper restores every noncenter physical identity and frame')
        target = next(s for s in state if s[0] == center[0])
        need(target[2:4] == center[2:4]
             and list(target[4]) == helper['frontCenterFinalUp'], 'Exact claimed visible-center turn')
        need(type(helper['htm']) is int and helper['htm'] == len(helper['word'].split()),
             'Exact helper HTM')
        need(apply(state, inverse(helper['word'])) == source, 'Full helper inverse')
        observed.add(target[4])
        rows.append({'htm': helper['htm'], 'frontCenterFinalUp': list(target[4])})
    need(observed == {(0, 1, 0), (1, 0, 0), (0, -1, 0), (-1, 0, 0)},
         'All four visible-center orientation corrections available')
    return {'status': 'PASS', 'noncenterFramesRestored': True, 'helpers': rows,
            'hiddenCenterOrientations': 'Unconstrained'}


if __name__ == '__main__':
    print(json.dumps(validate(sys.argv[1]), indent=2))
