"""Selected new-layout verification using the existing independent Rodrigues engine.

No solver or generator geometry is imported. Fixed style is checked by source ID.
"""
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
from verify_witness import (FRONT, LEXICONS, apply, calendar_patterns, inverse,
                            need, show, source_state)


def load_model(path):
    raw = Path(path).read_bytes()
    c = json.loads(raw)
    m = re.fullmatch(r'de-weekend-c([12])-([23])', c['id'])
    need(m and c['schema'] == 'cubistry.date-3x3-constructive' and c['version'] == 1,
         'Exact new candidate schema')
    layout, width = map(int, m.groups())
    need(c['locale'] == 'DE' and c['weekdayWidth'] == width, 'German whole weekday width')
    lex = LEXICONS['DE']
    need(c['rows'] == (['weekday', 'day', 'month'] if layout == 1 else ['weekday', 'month', 'day'])
         and c['dayCells'] == ['blank', 'tens', 'units'], 'Explicit new rows and adjacent padded day')
    need(c['weekdayParts'] == {w: [w, '', ''] for w in lex[width]}
         and c['monthParts'] == {w: [w, '', ''] for w in lex['months']},
         'Uniform complete weekday/month labels in left sticker; no irregular fragments')
    need(c['fixedWeekendWords'] == list(lex[width][5:]), 'Exactly both weekend words')
    need(c['centerImages'] == (['0', '1', '2', '3', '', ''] if layout == 1 else ['']*6),
         'Fixed six centers for selected layout')
    art = {'weekday': {'color': '#25343e', 'weight': 600},
           'weekend': {'color': '#ba302c', 'weight': 800},
           'month': {'color': '#925a32', 'weight': 600},
           'day': {'color': '#315d4e', 'weight': 600}}
    need(c['artwork'] == art, 'Fixed glyph palette and weekend bold weight')
    allowed = {0: set(lex[width]), (6 if layout == 1 else 3): set(lex['months']),
               (5 if layout == 1 else 8): set('0123456789')}
    if layout == 2:
        allowed[7] = set('0123')
    for kind, count, size in [('corners', 8, 3), ('edges', 12, 2)]:
        need(len(c['pieces'][kind]) == count, 'Exact source body inventory')
        for body in c['pieces'][kind]:
            need(len(body) == size, 'Exact face count per body')
            for slot, text in body:
                need(type(slot) is int and type(text) is str, 'Fixed slot and image')
                need((slot, text) == (-1, '') or (slot in allowed and text in allowed[slot]),
                     'Only declared fixed label vocabulary')
                if text:
                    need(sum(bool(v) for v in FRONT[slot]) == size, 'Correct corner/edge position class')
    return c, layout, width, hashlib.sha256(raw).hexdigest()


def expected_style(c, text, slot):
    if not text:
        return None
    role = ('weekend' if text in c['fixedWeekendWords'] else 'weekday') if slot == 0 else (
        'day' if re.fullmatch('[0-9]', text) else 'month')
    return c['artwork'][role]


def verify(witness_path, candidate_path):
    raw = Path(witness_path).read_bytes()
    w = json.loads(raw)
    c, layout, width, model_hash = load_model(candidate_path)
    need(w['schema'] == 'cubistry.date-3x3-witness' and w['version'] == 1
         and (w['candidateId'], w['locale'], w['weekdayWidth']) == (c['id'], 'DE', width),
         'Exact witness-to-model identity')
    source = source_state(w['printing'], c)
    for s in w['printing']:
        need(s.get('style') == expected_style(c, s['image'], s['slot']),
             'Every source sticker has the immutable required color and weight')
    patterns = calendar_patterns()
    need(w['complete'] is True and w['totalTargets'] == len(patterns)
         and len(w['targets']) == len(patterns), 'Complete 400-year target coverage')
    observed, costs, rotations, corrections = set(), [], [], []
    weekdays, months = LEXICONS['DE'][width], LEXICONS['DE']['months']
    for t in w['targets']:
        pattern = t['weekday'], t['day'], t['month']
        need(all(type(x) is int for x in pattern) and pattern in patterns and pattern not in observed,
             'Valid unique Gregorian date pattern')
        observed.add(pattern)
        wd, day, month = pattern
        values = {'weekday': [weekdays[wd], '', ''],
                  'month': [months[month-1], '', ''], 'day': ['', *f'{day:02d}']}
        cells = sum((values[row] for row in c['rows']), [])
        need(t['cells'] == cells, 'Independent complete-label lexicon and leading-zero date')
        state = apply(source, t['prelude'], global_only=True)
        state = apply(state, t['word'])
        state = apply(state, t['centerCorrection'])
        show(state, cells)
        for slot, position in enumerate(FRONT):
            s = next(s for s in state if s[2] == position and s[3] == (0, 0, 1))
            need(w['printing'][s[0]]['style'] == expected_style(c, cells[slot], slot),
                 'Visible style is carried by actual source identity, not overwritten by date')
        restored = apply(state, inverse(t['centerCorrection']))
        restored = apply(restored, inverse(t['word']))
        restored = apply(restored, inverse(t['prelude']), global_only=True)
        need(restored == source, 'Full inverse restores every identity and frame')
        costs.append(len(t['word'].split()) + len(t['centerCorrection'].split()))
        rotations.append(len(t['prelude'].split()))
        corrections.append(len(t['centerCorrection'].split()))
    need(observed == patterns, 'Exact complete calendar pattern set')
    return {'status': 'SAT', 'candidate': c['id'], 'verifiedTargets': len(observed),
            'gregorianDomainDays': 146097, 'physicalBodies': 26, 'physicalStickers': 54,
            'fixedWeekendStyle': c['artwork']['weekend'], 'exactUprightNonblankFrames': True,
            'visibleCenterOrientation': 'verified (blank orientation ignored)',
            'fullInverseRestorations': len(observed),
            'sourceToTargetHTM': {'min': min(costs), 'max': max(costs), 'sum': sum(costs),
                                  'mean': sum(costs)/len(costs)},
            'wholeCubePreludeTokens': {'min': min(rotations), 'max': max(rotations)},
            'centerCorrectionHTMHistogram': dict(Counter(corrections)),
            'candidateSHA256': model_hash, 'witnessSHA256': hashlib.sha256(raw).hexdigest(),
            'shortestTransitions': 'UNKNOWN', 'independentAgentReview': 'pending'}


if __name__ == '__main__':
    print(json.dumps(verify(*sys.argv[1:]), ensure_ascii=False, indent=2))
