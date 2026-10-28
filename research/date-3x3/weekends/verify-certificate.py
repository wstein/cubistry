"""Check the conditional German A obstruction without importing the generator.

Uses Gregorian integer arithmetic rather than the generator's datetime engine.
The finite blank-face cases are checked from mandatory-label incidence and parity.
"""
import hashlib
import itertools
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def need(condition, message):
    if not condition:
        raise AssertionError(message)


def weekday(year, month, day):
    # Gregorian integer formula: Sunday=0, converted to Monday=0.
    y = year - int(month < 3)
    offsets = (0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4)
    return (y + y // 4 - y // 100 + y // 400 + offsets[month - 1] + day + 6) % 7


def month_days(year, month):
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    return (31, 28 + leap, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)[month - 1]


def labels(model, year, month, day):
    day_of_week = weekday(year, month, day)
    word = model['weekdays'][day_of_week]
    style = 'weekend' if day_of_week in (5, 6) else 'regularWeekday'
    return (f'weekday:{word[1]}:{style}', f'month:{model["months"][month - 1][1]}',
            f'units:{day % 10}')


def verify(model_path=ROOT / 'model.json', certificate_path=ROOT / 'certificate.json'):
    raw = Path(model_path).read_bytes()
    model = json.loads(raw)
    cert = json.loads(Path(certificate_path).read_bytes())
    need(model['schema'] == 'cubistry.calendar-weekend-model' and model['version'] == 1,
         'Exact model schema')
    need(cert['schema'] == 'cubistry.calendar-weekend-edge-certificate'
         and cert['version'] == 1 and cert['modelSHA256'] == hashlib.sha256(raw).hexdigest(),
         'Exact certificate and pinned model')
    need(model['geometry'] == {'size': 3, 'edgeBodies': 12, 'facesPerEdge': 2,
                              'frontEdgeSlots': [1, 3, 5, 7]}, 'Twelve two-face edges')
    need(model['front'] == {'weekdayRight': 1, 'blank': 3, 'dayUnits': 5, 'monthMiddle': 7},
         'Fixed selected German A edge fields')
    need(model['weekdays'] == ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO']
         and model['months'] == ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL',
                                 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'], 'Exact German lexicons')
    need(model['domain'] == {'from': '2000-01-01', 'untilExclusive': '2400-01-01',
                            'calendar': 'proleptic Gregorian'}, 'Complete 400-year cycle')
    need(model['regularWeekday'] == {'color': '#25343e', 'weight': 600}
         and model['weekend'] == {'color': '#ba302c', 'weight': 800}
         and model['month'] == {'color': '#925a32', 'weight': 600}
         and model['day'] == {'color': '#315d4e', 'weight': 600}, 'Fixed role palettes and weights')
    observed, dates = set(), 0
    for year in range(2000, 2400):
        for month in range(1, 13):
            for day in range(1, month_days(year, month) + 1):
                observed.add(labels(model, year, month, day))
                dates += 1
    fields = [sorted({triple[i] for triple in observed}) for i in range(3)]
    need([len(field) for field in fields] == [5, 7, 10], 'Exact mandatory field sizes')
    need(cert['fields'] == dict(zip(('weekday', 'month', 'units'), fields)), 'Pinned field labels')
    product = set(itertools.product(*fields))
    need(observed == product and len(product) == 350, 'All 350 simultaneous edge combinations occur')
    need(cert['sourceDates'] == dates == 146097 and cert['productSize'] == len(product),
         'Exact domain and product coverage')
    representatives = {}
    for row in cert['coverage']:
        year, month, day = map(int, row['date'].split('-'))
        need(2000 <= year < 2400 and 1 <= month <= 12
             and 1 <= day <= month_days(year, month), 'Real representative date')
        triple = tuple(row['labels'])
        need(triple == labels(model, year, month, day) and triple not in representatives,
             'Unique correctly styled representative')
        representatives[triple] = row['date']
    need(set(representatives) == product, 'Complete retained coverage witnesses')
    # No implicit role aliases: verify all 22 labels are different permanent images.
    images = {}
    for word, day_of_week in zip(model['weekdays'], range(7)):
        style = 'weekend' if day_of_week >= 5 else 'regularWeekday'
        images[f'weekday:{word[1]}:{style}'] = (word[1], model[style]['color'], model[style]['weight'])
    for word in model['months']:
        images[f'month:{word[1]}'] = (word[1], model['month']['color'], model['month']['weight'])
    for n in range(10):
        images[f'units:{n}'] = (str(n), model['day']['color'], model['day']['weight'])
    need(len(images) == len(set(images.values())) == 22, 'Distinct glyph/color/weight images')
    # k=1, or k=2 on one body: the blank-bearing body cannot be used for any
    # simultaneous active label. Remove it: 22 faces must cover 22 labels once.
    # Different-field pairs cannot share a body because their product occurs.
    # Thus each edge pairs within one field, contradicting odd field sizes.
    cases = cert['edgeBlankCases']
    need(cases['zero'] == 'No blank front edge can be shown', 'Zero-blank obstruction')
    for case in ('one', 'twoOnOneBody'):
        need(cases[case]['remainingFaces'] == 22
             and cases[case]['fieldCounts'] == [5, 7, 10], 'One removed edge case')
        need(any(len(field) % 2 for field in fields), 'Within-field matching parity contradiction')
    # k=2 on distinct bodies: all 22 nonblank faces are unique mandatory labels.
    # If their partners belong to different fields, some target occupies both
    # blank-bearing edges, leaving no blank available. Otherwise remove both
    # partner labels from one field; its parity and the other odd field remain.
    label_list = [label for field in fields for label in field]
    field_of = {label: i for i, field in enumerate(fields) for label in field}
    claimed_pairs = cases['twoOnDifferentBodies']
    need(len(claimed_pairs) == 231, 'All two-blank partner pairs')
    verified = set()
    cross_field, parity = 0, 0
    for row in claimed_pairs:
        pair = tuple(row['otherLabels'])
        need(len(pair) == 2 and pair[0] != pair[1] and all(p in field_of for p in pair),
             'Two distinct mandatory partners')
        key = frozenset(pair)
        need(key not in verified, 'No duplicate partner case')
        verified.add(key)
        counts = list(map(len, fields))
        a, b = map(field_of.__getitem__, pair)
        if a != b:
            need(any(pair[0] in target and pair[1] in target for target in product),
                 'A target simultaneously needs both unique partners and a blank')
            cross_field += 1
        else:
            counts[a] -= 2
            need(any(count % 2 for count in counts), 'Remaining within-field parity contradiction')
            parity += 1
        need(row['remainingFieldCounts'] == counts, 'Exact remaining field cardinalities')
    need(verified == {frozenset(pair) for pair in itertools.combinations(label_list, 2)},
         'Exhaustive partner case split')
    need(cases['threeOrMore']['minimumMandatoryFaces'] == 25
         and cases['threeOrMore']['availableFaces'] == 24 and 22 + 3 > 24,
         'Three or more blanks exceed the face budget')
    need(cert['status'] == 'UNSAT', 'Conditional impossibility verdict')
    return {'status': 'UNSAT', 'scope': 'German A fixed layout/styles only',
            'dates': dates, 'combinations': len(product), 'mandatoryLabels': 22,
            'crossFieldBlankPairs': cross_field, 'sameFieldParityPairs': parity}


if __name__ == '__main__':
    print(json.dumps(verify(*(sys.argv[1:])), ensure_ascii=False, indent=2))
