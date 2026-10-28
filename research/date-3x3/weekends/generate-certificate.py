"""Generate date coverage and the finite edge-blank case split, without a solver."""
import datetime as dt
import hashlib
import itertools
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
model_bytes = (ROOT / 'model.json').read_bytes()
model = json.loads(model_bytes)
start = dt.date.fromisoformat(model['domain']['from'])
end = dt.date.fromisoformat(model['domain']['untilExclusive'])
coverage = {}
for offset in range((end - start).days):
    date = start + dt.timedelta(days=offset)
    weekday = model['weekdays'][date.weekday()]
    style = 'weekend' if date.weekday() >= 5 else 'regularWeekday'
    triple = (f'weekday:{weekday[1]}:{style}',
              f'month:{model["months"][date.month - 1][1]}',
              f'units:{date.day % 10}')
    coverage.setdefault(triple, date.isoformat())
fields = {name: sorted({triple[i] for triple in coverage})
          for i, name in enumerate(('weekday', 'month', 'units'))}
labels = [label for field in fields.values() for label in field]
field_of = {label: i for i, field in enumerate(fields.values()) for label in field}
blank_pairs = []
for first, second in itertools.combinations(labels, 2):
    counts = list(map(len, fields.values()))
    if field_of[first] != field_of[second]:
        reason = 'Both unique labels occur together and occupy both blank-bearing bodies'
    else:
        counts[field_of[first]] -= 2
        reason = 'Remaining unique faces cannot pair within their fields: odd counts remain'
    blank_pairs.append({'otherLabels': [first, second],
                        'remainingFieldCounts': counts, 'obstruction': reason})
certificate = {
    'schema': 'cubistry.calendar-weekend-edge-certificate', 'version': 1,
    'modelSHA256': hashlib.sha256(model_bytes).hexdigest(),
    'status': 'UNSAT',
    'scope': 'Only the explicit German A layout/style model in model.json',
    'sourceDates': (end - start).days,
    'fields': fields,
    'productSize': len(list(itertools.product(*fields.values()))),
    'coverage': [{'labels': list(triple), 'date': date}
                 for triple, date in sorted(coverage.items())],
    'edgeBlankCases': {
        'zero': 'No blank front edge can be shown',
        'one': {'remainingFaces': 22, 'fieldCounts': list(map(len, fields.values())),
                'reason': 'Remove the sole blank-bearing edge; all 22 mandatory labels must remain, once each'},
        'twoOnOneBody': {'remainingFaces': 22, 'fieldCounts': list(map(len, fields.values())),
                         'reason': 'Remove the blank-only body; all mandatory labels remain unique'},
        'twoOnDifferentBodies': blank_pairs,
        'threeOrMore': {'minimumMandatoryFaces': len(labels) + 3,
                        'availableFaces': model['geometry']['edgeBodies'] * model['geometry']['facesPerEdge']}
    },
    'limitations': ['Not a theorem about arbitrary German layouts, fragments or palettes',
                    'SAT is not claimed for any replacement layout',
                    'Independent review is required before publishing this result']
}
(ROOT / 'certificate.json').write_text(json.dumps(certificate, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': certificate['status'], 'dates': certificate['sourceDates'],
                  'coverage': len(coverage), 'fieldSizes': list(map(len, fields.values())),
                  'twoBlankPairs': len(blank_pairs)}))
