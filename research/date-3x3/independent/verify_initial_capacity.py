"""Independent validation of the superseded strict single-character bounds.

No author analyzer/model code imports. Prints a qualified historical review;
does not change the old results or assert anything about fragment feasibility.
"""
import datetime
import hashlib
import itertools
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEX = {
    'DE': {
        2: ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'],
        3: ['MON', 'DIE', 'MIT', 'DON', 'FRE', 'SAM', 'SON'],
        'months': ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'],
    },
    'EN': {
        2: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
        3: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        'months': ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    },
}


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def signature(p, n, up):
    return dot(p, up), dot(p, cross(up, n))


def validate():
    model_raw, result_raw = (ROOT / 'model.json').read_bytes(), (ROOT / 'capacity.json').read_bytes()
    model, result = json.loads(model_raw), json.loads(result_raw)
    assert result['modelSHA256'] == hashlib.sha256(model_raw).hexdigest()
    for locale in LEX:
        for width in (2, 3):
            assert model['languages'][locale]['weekdays' + str(width)] == LEX[locale][width]
        assert model['languages'][locale]['months'] == LEX[locale]['months']
    assert model['rows'] == ['weekday', 'two-digit day with leading zero', 'three-letter month']
    assert model['dayLayouts'] == {'right': ['blank', 'tens', 'units'],
                                  'split': ['tens', 'blank', 'units'],
                                  'left': ['tens', 'units', 'blank']}
    axes = tuple(tuple(s if i == axis else 0 for i in range(3))
                 for axis in range(3) for s in (-1, 1))
    rotations = [(a, b, cross(a, b)) for a in axes for b in axes if dot(a, b) == 0]
    assert len(rotations) == 24
    front = [(x, y, 1) for y in (1, 0, -1) for x in (-1, 0, 1)]
    signatures = [signature(p, (0, 0, 1), (0, 1, 0)) for p in front]
    assert len(set(signatures)) == 9
    frame_checks = 0
    for p in itertools.product((-1, 0, 1), repeat=3):
        for n in axes:
            if dot(p, n) != 1:
                continue
            for up in axes:
                if dot(n, up):
                    continue
                before = signature(p, n, up)
                assert before in signatures
                for rotation in rotations:
                    def rotate(v):
                        return tuple(sum(v[j] * rotation[j][i] for j in range(3)) for i in range(3))
                    assert signature(rotate(p), rotate(n), rotate(up)) == before
                    frame_checks += 1
    assert frame_checks == 5184
    patterns = set()
    day, end = datetime.date(2000, 1, 1), datetime.date(2400, 1, 1)
    days = 0
    while day != end:
        patterns.add((day.weekday(), day.day, day.month))
        day += datetime.timedelta(days=1)
        days += 1
    assert days == result['calendarDates'] == 146097
    assert len(patterns) == result['distinctWeekdayDayMonthPatterns'] == 2562
    expected_keys = set(itertools.product(('DE', 'EN', 'DE+EN'), (2, 3), ('right', 'split', 'left')))
    observed, rows = set(), []
    for row in result['rows']:
        locale, width, layout = row['language'], row['weekdayWidth'], row['dayLayout']
        key = locale, width, layout
        assert key in expected_keys and key not in observed
        observed.add(key)
        inventory = [set() for _ in range(9)]
        for language in ('DE', 'EN') if locale == 'DE+EN' else (locale,):
            for weekday, number, month in patterns:
                wd = LEX[language][width][weekday]
                first = list(wd) + [''] * (3 - len(wd))
                digits = str(number // 10), str(number % 10)
                middle = {'right': ['', *digits], 'split': [digits[0], '', digits[1]],
                          'left': [*digits, '']}[layout]
                text = first + middle + list(LEX[language]['months'][month - 1])
                for cell, image in enumerate(text):
                    inventory[cell].add(image or ' ')
        assert row['slotInventories'] == [''.join(sorted(s)) for s in inventory]
        corner_slots, edge_slots = (0, 2, 6, 8), (1, 3, 5, 7)
        corner_count = sum(len(inventory[s]) for s in corner_slots)
        edge_count = sum(len(inventory[s]) for s in edge_slots)
        center_count = len(inventory[4])
        # Blanks need no geometric up vector. In this old model, however,
        # each orbit has at most one required blank position, so counting one
        # blank image does not spuriously split an unoriented blank by slot.
        assert sum(' ' in inventory[s] for s in edge_slots) <= 1
        cases = []
        if width == 2:
            assert [s for s in corner_slots if ' ' in inventory[s]] == [2]
            nonblank = corner_count - 1
            for copies in range(1, 25):
                # One blank forces its corner to TR on every display, making
                # its other two physical stickers unavailable for other roles.
                # Two or more blanks require copies actual physical stickers;
                # dropping any further conflicts is a safe lower relaxation.
                budget = nonblank + copies + (2 if copies == 1 else 0)
                cases.append({'blankCopies': copies, 'minimumStickerBudget': budget})
            assert row['blankCopyCases'] == cases
            corner_bound = min(case['minimumStickerBudget'] for case in cases)
        else:
            assert not any(' ' in inventory[s] for s in corner_slots)
            assert row['blankCopyCases'] == []
            corner_bound = corner_count
        assert (row['cornerTypeCount'], row['cornerLowerBound'], row['edgeTypeCount'], row['centerTypeCount']) \
            == (corner_count, corner_bound, edge_count, center_count)
        reasons = []
        if corner_bound > 24:
            reasons.append(f'corner lower bound {corner_bound} exceeds 24')
        if edge_count > 24:
            reasons.append(f'edge upright-slot types {edge_count} exceed 24')
        if center_count > 6:
            reasons.append(f'center glyphs {center_count} exceed 6')
        status = 'UNSAT' if reasons else 'UNKNOWN'
        assert row['status'] == status and row['contradictions'] == reasons
        rows.append({'language': locale, 'weekdayWidth': width, 'dayLayout': layout,
                     'cornerLowerBound': corner_bound, 'edgeTypeCount': edge_count,
                     'centerTypeCount': center_count, 'validatedStatus': status})
    assert observed == expected_keys and len(rows) == 18
    assert sum(row['validatedStatus'] == 'UNSAT' for row in rows) == 17
    return {'schema': 'cubistry.historical-capacity-independent-review', 'version': 1,
            'reviewStatus': 'PASS', 'rowsChecked': 18, 'qualifiedUNSATRows': 17,
            'capacitySurvivorRows': 1, 'properRigidRotationsChecked': 24,
            'frameInvariantChecks': frame_checks, 'calendarDays': days,
            'datePatterns': len(patterns), 'blankCopyCasesChecked': 9 * 24,
            'modelSHA256': hashlib.sha256(model_raw).hexdigest(),
            'capacitySHA256': hashlib.sha256(result_raw).hexdigest(), 'rows': rows,
            'strictAssumptions': ['Historical model.json: weekday/day/month rows in both languages',
                                  'Exactly one character per nonblank sticker; no word fragments',
                                  'Every nonblank glyph requires the exact geometric upright frame, '
                                  'including O and I; no self-rotation or cross-glyph optical aliases',
                                  'Blank images are actual unprinted stickers; blank up is irrelevant',
                                  'Rigid corner/edge/center orbits; proper outer-face and whole-cube rotations'],
            'argument': 'The invariant (p dot up, p dot (up cross normal)) uniquely fixes an '
                        'upright nonblank sticker front slot. Each corner/edge has at most '
                        '24 stickers in its orbit and centers have six. For the sole TR blank, '
                        'one copy wastes the other two stickers of its always-occupied corner; '
                        'all copy counts1..24 are exhausted as necessary budget lower bounds.',
            'scopeWarning': 'These are conditional UNSAT proofs for a superseded strict model. '
                            'They do not exclude current word-fragment prints, revised English '
                            'row orders, or unrestricted bilingual proposals. The single surviving '
                            'capacity row remains UNKNOWN here, not SAT.'}


if __name__ == '__main__':
    print(json.dumps(validate(), indent=2, ensure_ascii=False))
