"""Check the explicit fixed-front orbit-capacity obstruction; no solver needed."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
source = ROOT.parent / 'constructive/de-2.json'
raw = source.read_bytes()
model = json.loads(raw)
assert model['rows'] == ['weekday', 'day', 'month']
assert model['dayCells'] == ['blank', 'tens', 'units']
months = model['monthParts']
assert set(months) == set('JAN FEB MÄR APR MAI JUN JUL AUG SEP OKT NOV DEZ'.split())
assert all(parts == list(name) and len(parts) == 3 for name, parts in months.items())
weekdays = set('MON DIE MIT DON FRE SAM SON'.split())
corner_months = {parts[i] for parts in months.values() for i in (0, 2)}
edge_months = {parts[1] for parts in months.values()}
units = set('0123456789')
assert len(corner_months) == 17 and len(edge_months) == 7
# One immutable sticker image may serve multiple positions, so use a UNION.
# This deliberately allows every possible reuse across roles and dates.
corner_required = weekdays | corner_months | {''}
edge_required = weekdays | edge_months | units | {''}
assert len(corner_required) == 25 > 8 * 3
assert len(edge_required) == 25 > 12 * 2
result = {
    'status': 'UNSAT',
    'sourceSHA256': hashlib.sha256(raw).hexdigest(),
    'scope': 'Whole three-letter weekday on one top-row sticker, other top cells genuinely blank; existing German A day and month rows retained',
    'imageModel': 'Exact immutable upright glyph images; no rotated-glyph reinterpretation or shared O/0 image',
    'weekdayAtR1C1OrR1C3': {
        'orbit': 'corners', 'availableFaces': 24,
        'requiredDistinctImages': len(corner_required),
        'monthCornerAlphabet': sorted(corner_months),
        'reason': 'Whole weekday + month outer letters + blank opposite top corner',
    },
    'weekdayAtR1C2': {
        'orbit': 'edges', 'availableFaces': 24,
        'requiredDistinctImages': len(edge_required),
        'monthMiddleAlphabet': sorted(edge_months),
        'reason': 'Whole weekday + month middle letters + day units + blank R2C1',
    },
    'doesNotProve': ['Distributed weekday letters', 'Different day layout', 'Different row order', 'Word fragments or alternative month lexicon'],
}
print(json.dumps(result, ensure_ascii=False, indent=2))
