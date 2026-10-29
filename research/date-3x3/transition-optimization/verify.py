"""Independent Rodrigues replay for optimized calendar transitions.

No JavaScript planner, generator geometry, KPattern, or solver imports.
"""
import collections
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
from verify_witness import apply, source_state, show, inverse, need, desired_cells as german_cells
from verify_adjacent import desired_cells as english_cells

SOURCES = {
    'de-a': ('../witnesses/de-2.json', '../constructive/de-2.json'),
    'en-3-zero': ('../adjacent/witnesses/en-adjacent-3-zero.json', '../adjacent/constructive/en-adjacent-3.json'),
    'en-3-unpadded': ('../adjacent/witnesses/en-adjacent-3-unpadded.json', '../adjacent/constructive/en-adjacent-3.json'),
}


def replay(state, word):
    need(type(word) is str and len(word) < 16384, 'Bounded legal transition word')
    for token in word.split():
        need(re.fullmatch(r"[RLUDFBxyz](2|')?", token), 'Legal physical move token')
        state = apply(state, token, global_only=token[0] in 'xyz')
    return state


def reduced(word):
    out = []
    for token in word.split():
        if out and out[-1][0] == token[0]:
            previous = out.pop()
            amount = lambda t: 2 if t.endswith('2') else 3 if t.endswith("'") else 1
            value = (amount(previous) + amount(token)) % 4
            if value:
                out.append(token[0] + ('2' if value == 2 else "'" if value == 3 else ''))
        else:
            out.append(token)
    return ' '.join(out)


def counts(word):
    moves = word.split()
    outer = [m for m in moves if m[0] in 'RLUDFB']
    return {'total': len(moves), 'htm': len(outer),
            'qtm': sum(2 if m.endswith('2') else 1 for m in outer),
            'global': len(moves) - len(outer)}


def canonical_word(target):
    return ' '.join(target[k] for k in ('prelude', 'word', 'centerCorrection') if target[k])


def date_pattern(date):
    return date.weekday(), date.day, date.month


def expected_edges():
    result = collections.Counter()
    day, end = dt.date(2000, 1, 1), dt.date(2400, 1, 1)
    while day < end:
        following = day + dt.timedelta(days=1)
        result[(date_pattern(day), date_pattern(following))] += 1
        day = following
    return result


def validate(document, require_complete=True):
    need(document['schema'] == 'cubistry.calendar-transition-optimization'
         and type(document['version']) is int and document['version'] == 1,
         'Exact transition witness schema')
    edges = expected_edges()
    need(document['calendarDaysEnumerated'] == 146097
         and document['uniqueForwardPairs'] == len(edges)
         and document['expectedCases'] == len(edges) * 6, 'Exact Gregorian domain')
    if require_complete:
        need(document['complete'] is True and len(document['cases']) == len(edges) * 6,
             'Every distinct forward and reverse transition for all three formats')
    sources, states = {}, {}
    for spec in document['sources']:
        need(spec['id'] in SOURCES and spec['file'] == SOURCES[spec['id']][0], 'Pinned allowlisted source')
        raw = (ROOT / spec['file']).read_bytes()
        need(hashlib.sha256(raw).hexdigest() == spec['sha256'], 'Exact original witness hash')
        witness = json.loads(raw)
        candidate = json.loads((ROOT / SOURCES[spec['id']][1]).read_text())
        source = source_state(witness['printing'], candidate)
        sources[spec['id']] = witness, candidate, source
    need(len(sources) == len(document['sources']), 'Unique source designs')
    if require_complete:
        need(set(sources) == set(SOURCES), 'All selected formats retained')
    seen, verified, over20 = set(), 0, 0
    totals = collections.defaultdict(lambda: {'count': 0, 'before': 0, 'after': 0, 'over20': 0, 'improved': 0})
    for row in document['cases']:
        identity, direction = row['id'], row['direction']
        need(identity in sources and type(direction) is int and direction in (-1, 1), 'Selected direction and print')
        witness, candidate, source = sources[identity]
        need(type(row['from']) is int and type(row['to']) is int
             and 0 <= row['from'] < 2562 and 0 <= row['to'] < 2562, 'Valid exact target indices')
        a, b = (witness['targets'][row[k]] for k in ('from', 'to'))
        p, q = tuple(a[k] for k in ('weekday', 'day', 'month')), tuple(b[k] for k in ('weekday', 'day', 'month'))
        edge = (p, q) if direction == 1 else (q, p)
        case_key = identity, direction, p, q
        need(edge in edges and row['occurrences'] == edges[edge] and case_key not in seen,
             'Unique valid day edge with exact 400-year multiplicity')
        seen.add(case_key)
        from_date, to_date = (dt.date.fromisoformat(row[k]) for k in ('fromISO', 'toISO'))
        need(to_date - from_date == dt.timedelta(days=direction)
             and date_pattern(from_date) == p and date_pattern(to_date) == q, 'Actual Gregorian adjacent dates')
        cells = german_cells(candidate, *q) if identity == 'de-a' else english_cells(3, 'unpadded' if identity.endswith('unpadded') else 'zero', *q)
        need(b['cells'] == cells, 'Independently formatted target cells')
        state_key = identity, row['from']
        if state_key not in states:
            states[state_key] = replay(source, canonical_word(a))
        start = states[state_key]
        before_word = reduced(inverse(canonical_word(a)) + ' ' + canonical_word(b))
        need(row['baselineCounts'] == counts(before_word), 'Exact original full-pose baseline cost')
        result = replay(start, row['word'])
        show(result, cells)
        need(replay(result, inverse(row['word'])) == start, 'All 54 immutable frames restore through the inverse')
        observed = counts(row['word'])
        need(observed == row['counts'] and observed['total'] <= row['baselineCounts']['total'], 'No hidden or miscounted moves; never longer than baseline')
        need(row['optimized'] == (row['word'] != before_word), 'Honest optimized flag')
        if row['optimized']:
            need(observed['total'] < row['baselineCounts']['total'], 'Strictly fewer total physical moves')
        out = totals[identity, direction]
        out['count'] += row['occurrences']
        out['before'] += row['occurrences'] * row['baselineCounts']['total']
        out['after'] += row['occurrences'] * observed['total']
        out['over20'] += row['occurrences'] * (observed['total'] > 20)
        out['improved'] += int(row['optimized'])
        verified += 1
        over20 += observed['total'] > 20
    if require_complete:
        need(verified == len(edges) * 6, 'Complete selected transition coverage')
        need(all(r['count'] == 146097 for r in totals.values()), 'Full weighted 400-year direction coverage')
    for stat in document['statistics']:
        r = totals[stat['id'], stat['direction']]
        need((stat['representedCalendarTransitions'], stat['totalBefore'], stat['totalAfter'], stat['over20Weighted'], stat['strictlyImprovedUnique'])
             == (r['count'], r['before'], r['after'], r['over20'], r['improved']), 'Reported statistics match independently replayed routes')
    return {'status': 'SAT' if require_complete else 'PASS_PARTIAL', 'scope': document['scope'],
            'uniqueTransitionsVerified': verified, 'calendarTransitionsRepresented': sum(v['count'] for v in totals.values()),
            'allImmutableFramesInverseVerified': True, 'allVisibleNonblankFramesIncludingCenterUpright': True,
            'overTwentyUnique': over20, 'optimality': 'UNKNOWN', 'universalTwentyMoveBound': 'UNKNOWN'}


if __name__ == '__main__':
    file = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'daily-witness.json'
    print(json.dumps(validate(json.loads(file.read_bytes())), indent=2))
