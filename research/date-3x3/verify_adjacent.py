"""Independent adjacent-English date proof, reusing only the independent engine.

The earlier four proposal proofs remain immutable and are not reinterpreted.
"""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

from verify_witness import (ROOT, LEXICONS, apply, calendar_patterns, inverse,
                            need, show, source_state)

ADJACENT = ROOT / 'adjacent'
MODES = ('zero', 'unpadded')


def candidate_model(path):
    raw = Path(path).read_bytes()
    candidate = json.loads(raw)
    need(candidate['schema'] == 'cubistry.date-3x3-constructive'
         and type(candidate['version']) is int and candidate['version'] == 1,
         'Exact constructive schema')
    width = candidate['weekdayWidth']
    need(candidate['locale'] == 'EN' and type(width) is int and width in (2, 3),
         'English two- or three-letter weekday print')
    need(candidate['id'] == 'en-adjacent-' + str(width), 'Exact new candidate identity')
    need(candidate['rows'] == ['weekday', 'month', 'day']
         and candidate['dayCells'] == ['blank', 'tens', 'units'],
         'English middle month and adjacent bottom day')
    weekdays = LEXICONS['EN'][width]
    need(candidate['weekdayParts'] == {word: [word, '', ''] for word in weekdays},
         'Uniform whole weekday abbreviation in left sticker')
    need(candidate['monthParts'] == {word: list(word) for word in LEXICONS['EN']['months']},
         'Every month is three individual middle-row letters')
    need(candidate['centerImages'] == ['A', 'E', 'P', 'U', 'C', 'O'],
         'Exactly six immutable English month centers')
    for kind, count, size in [('corners', 8, 3), ('edges', 12, 2)]:
        pieces = candidate['pieces'][kind]
        need(type(pieces) is list and len(pieces) == count, 'Exact rigid-piece inventory')
        for piece in pieces:
            need(type(piece) is list and len(piece) == size, 'Exact sticker count per piece')
            for token in piece:
                need(type(token) is list and len(token) == 2 and type(token[0]) is int
                     and type(token[1]) is str, 'Integral slot and fixed fragment pair')
                slot, image = token
                need(slot == -1 if image == '' else 0 <= slot < 9, 'Blank or visible slot')
    return candidate, hashlib.sha256(raw).hexdigest()


def desired_cells(width, padding, weekday, day, month):
    weekday_word = LEXICONS['EN'][width][weekday]
    month_word = LEXICONS['EN']['months'][month - 1]
    tens = str(day // 10) if day >= 10 or padding == 'zero' else ''
    return [weekday_word, '', ''] + list(month_word) + ['', tens, str(day % 10)]


def validate(path, candidate_path=None):
    raw = Path(path).read_bytes()
    witness = json.loads(raw)
    need(witness['schema'] == 'cubistry.date-3x3-witness'
         and type(witness['version']) is int and witness['version'] == 1,
         'Exact physical witness schema')
    identity, padding = witness['candidateId'], witness['paddingMode']
    need(identity in ('en-adjacent-2', 'en-adjacent-3') and padding in MODES,
         'Known adjacent candidate and explicit padding mode')
    candidate, candidate_hash = candidate_model(candidate_path or ADJACENT / 'constructive' / (identity + '.json'))
    width = candidate['weekdayWidth']
    need(witness['locale'] == 'EN' and type(witness['weekdayWidth']) is int
         and witness['weekdayWidth'] == width, 'Exact witness locale and weekday width')
    source = source_state(witness['printing'], candidate)
    patterns = calendar_patterns()
    need(witness['complete'] is True and type(witness['totalTargets']) is int
         and witness['totalTargets'] == 2562, 'Complete calendar witness declared')
    targets = witness['targets']
    need(type(targets) is list and len(targets) == len(patterns), 'Every actual target retained')
    observed, costs, preludes, corrections = set(), [], [], []
    for target in targets:
        need(all(type(target[key]) is int for key in ('weekday', 'day', 'month')), 'Integral date pattern')
        pattern = target['weekday'], target['day'], target['month']
        need(pattern in patterns and pattern not in observed, 'Valid unique Gregorian date pattern')
        observed.add(pattern)
        cells = desired_cells(width, padding, *pattern)
        need(target['cells'] == cells, 'Independent uniform weekday, adjacent day and padding target')
        prelude, word, correction = (target[key] for key in ('prelude', 'word', 'centerCorrection'))
        state = apply(source, prelude, global_only=True)
        state = apply(state, word)
        state = apply(state, correction)
        show(state, cells)
        state = apply(state, inverse(correction))
        state = apply(state, inverse(word))
        state = apply(state, inverse(prelude), global_only=True)
        need(state == source, 'Every original 54-sticker identity and frame restored')
        costs.append(len(word.split()) + len(correction.split()))
        preludes.append(len(prelude.split()))
        corrections.append(len(correction.split()))
    need(observed == patterns, 'Exact Gregorian 400-year target coverage')
    print_bytes = json.dumps(witness['printing'], sort_keys=True, separators=(',', ':')).encode()
    return {'status': 'SAT', 'candidate': identity, 'paddingMode': padding,
            'weekdayWidth': width, 'physicalStickers': 54,
            'datePatternsVerified': len(patterns), 'gregorianDaysEnumerated': 146097,
            'dayColumns': ['blank', 'tens-or-unprinted', 'units'],
            'uniformWeekdayInTopLeft': True, 'monthThreeCharactersInMiddle': True,
            'nonblankFramesIncludingCenterUpright': True, 'blankUpIgnored': True,
            'fullInverseRestorations': len(targets),
            'sourceToTargetHTM': {'minimum': min(costs), 'maximum': max(costs),
                                  'total': sum(costs), 'mean': sum(costs) / len(costs)},
            'wholeCubePreludeTokens': {'minimum': min(preludes), 'maximum': max(preludes)},
            'centerCorrectionHTMHistogram': dict(sorted(Counter(corrections).items())),
            'sourcePrintDefinitionSHA256': hashlib.sha256(print_bytes).hexdigest(),
            'witnessSHA256': hashlib.sha256(raw).hexdigest(),
            'constructiveSHA256': candidate_hash, 'dailyTransitionOptimality': 'UNKNOWN'}


def validate_family(directory=ADJACENT / 'witnesses'):
    directory = Path(directory)
    expected = [f'en-adjacent-{width}-{mode}' for width in (2, 3) for mode in MODES]
    need({p.stem for p in directory.glob('*.json')} == set(expected),
         'Both physical prints and both padding modes must be present')
    rows = [validate(directory / (name + '.json')) for name in expected]
    for width in (2, 3):
        modes = [row for row in rows if row['weekdayWidth'] == width]
        need({row['paddingMode'] for row in modes} == set(MODES)
             and len({row['sourcePrintDefinitionSHA256'] for row in modes}) == 1,
             'The same exact immutable source print supports both padding modes')
    return {'schema': 'cubistry.adjacent-calendar-independent-review', 'version': 1,
            'status': 'SAT', 'physicalPrints': 2, 'paddingModesPerPrint': 2,
            'datePatternsVerified': sum(row['datePatternsVerified'] for row in rows),
            'sameImmutablePrintAcrossPaddingModes': True, 'variants': rows,
            'scope': 'English only: whole weekday TL, month across middle, '
                     'adjacent tens/units BM/BR; the tens sticker is blank for unpadded days 1..9.',
            'limitations': 'No global print optimum, shortest daily-transition claim, '
                           'application, print-sheet export, or bilingual feasibility assertion.'}


if __name__ == '__main__':
    result = validate_family() if len(sys.argv) == 1 else validate(sys.argv[1])
    print(json.dumps(result, indent=2))
