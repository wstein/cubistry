"""Independent standard-library replay of consecutive actual calendar poses.

Imports only the historical Rodrigues verifier, never JavaScript planner geometry,
controller, KPattern, or the solver. Timing is measured evidence, not a proof.
"""
from collections import defaultdict
from datetime import date, timedelta
from hashlib import sha256
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
import verify_witness as W

SOURCES = {
    'de-a': ('../witnesses/de-2.json', '../constructive/de-2.json', '1f5ecf89f4127ac1dd27e662c51193ca7d24677ba49abbca2737e306dc9cef56'),
    'en-3-zero': ('../adjacent/witnesses/en-adjacent-3-zero.json', '../adjacent/constructive/en-adjacent-3.json', 'cb6a556d02f03806b1742bf7720216222934bc0652dd4ace12dcd97de876da0c'),
    'en-3-unpadded': ('../adjacent/witnesses/en-adjacent-3-unpadded.json', '../adjacent/constructive/en-adjacent-3.json', '156e6b4d642f9737ee03597bf84a940b3d36f0271c46345bac4083eb99a36022'),
}
JUMPS = ['2024-02-29', '2024-03-01', '2024-12-31', '2025-01-01', '2000-02-29', '1900-03-01', '2100-03-01', '9999-12-31', '0001-01-01', '2026-10-28', '2026-10-29', '2026-10-30', '2026-01-01', '2025-12-31']
SCENARIOS = ('year', 'jumps', 'interrupt-move', 'interrupt-planning')


def need(ok, why):
    if not ok:
        raise AssertionError(why)


def serialized(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def state_hash(state):
    return sha256(serialized(state)).hexdigest()


def replay(state, word):
    need(type(word) is str and len(word) < 2_000_000, 'Bounded physical route')
    for token in word.split():
        need(re.fullmatch(r"[RLUDFBxyz](2|')?", token), 'Legal face or explicit whole-cube move')
        state = W.apply(state, token, global_only=token[0] in 'xyz')
    return state


def reduced(word):
    out = []
    for token in word.split():
        if out and out[-1][0] == token[0]:
            previous = out.pop()
            amount = lambda value: 2 if value.endswith('2') else 3 if value.endswith("'") else 1
            n = (amount(previous)+amount(token)) % 4
            if n:
                out.append(token[0]+('2' if n == 2 else "'" if n == 3 else ''))
        else:
            out.append(token)
    return ' '.join(out)


def canonical(target):
    return ' '.join(target[k] for k in ('prelude', 'word', 'centerCorrection') if target[k])


def counts(word):
    moves = word.split()
    outer = [t for t in moves if t[0] in 'RLUDFB']
    return {'total': len(moves), 'htm': len(outer), 'qtm': sum(2 if t.endswith('2') else 1 for t in outer), 'global': len(moves)-len(outer)}


def cells(identity, iso):
    d = date.fromisoformat(iso)
    locale = W.LEXICONS['DE' if identity == 'de-a' else 'EN']
    digits = ['', *f'{d.day:02}']
    if identity == 'en-3-unpadded' and d.day < 10:
        digits[1] = ''
    month = list(locale['months'][d.month-1])
    if identity == 'de-a':
        return [*locale[2][d.weekday()], ''] + digits + month
    return [locale[3][d.weekday()], '', ''] + month + digits


def key(iso):
    d = date.fromisoformat(iso)
    return [d.weekday(), d.day, d.month]


def metric(values):
    ordered = sorted(values)
    q = lambda p: ordered[min(len(ordered)-1, math.ceil(len(ordered)*p)-1)] if ordered else None
    return {'mean': sum(values)/len(values) if values else None, 'median': q(.5), 'p95': q(.95), 'maximum': max(values) if values else None, 'total': sum(values)}


def verify(document):
    need(document['schema'] == 'cubistry.calendar-consecutive-benchmark' and document['version'] == 1, 'Exact benchmark schema')
    need(document['complete'] is True and document['stopReason'] is None, 'Complete run, not a partial budget output')
    m = document['manifest']
    days, groups, providers = m['parameters']['days'], m['parameters']['interruptionGroups'], m['parameters']['providers']
    need(type(days) is int and 1 <= days <= 366 and type(groups) is int and 1 <= groups <= 100, 'Bounded benchmark domain')
    need(len(providers) == len(set(providers)) and {'legacy', 'direct'} <= set(providers), 'Distinct baseline/direct providers')
    expected_cases = len(providers)*3*(2*days+len(JUMPS)+2*groups)
    need(document['expectedCases'] == expected_cases and len(document['cases']) == expected_cases, 'Exact complete request coverage')
    sources, goals = {}, {}
    for spec in m['sources']:
        identity = spec['id']
        need(identity in SOURCES and identity not in sources and spec['sha256'] == SOURCES[identity][2], 'Pinned unchanged runtime source')
        source, model, _ = SOURCES[identity]
        witness = json.loads((ROOT/source).read_text())
        candidate = json.loads((ROOT/model).read_text())
        original = W.source_state(witness['printing'], candidate)
        observed = W.source_state(spec['printing'], candidate)
        need(observed == original, 'Exact immutable source printing and physical frames')
        sources[identity] = original
        goals[identity] = {(t['weekday'], t['day'], t['month']): canonical(t) for t in witness['targets']}
    need(set(sources) == set(SOURCES), 'All selected prints')
    seen_series, observed_indices, statistics = set(), [], []
    obsolete_turns = 0
    for series in document['series']:
        provider, identity, scenario = series['provider'], series['design'], series['scenario']
        sid = provider, identity, scenario
        need(provider in providers and identity in SOURCES and scenario in SCENARIOS and sid not in seen_series, 'Unique allowed series')
        seen_series.add(sid)
        initial_iso = '2024-01-01' if scenario == 'year' else '2024-02-28'
        need(series['initialISO'] == initial_iso, 'Known independent starting date')
        need(series['initialWord'] == goals[identity][tuple(key(initial_iso))], 'Canonical setup is used only once at the start')
        reference = series['initialWord']
        state = replay(sources[identity], reference)
        W.show(state, cells(identity, initial_iso))
        need(state_hash(state) == series['initialStateHash'], 'Exact complete initial pose')
        current = date.fromisoformat(initial_iso)
        rows = []
        for step, index in enumerate(series['rowIndexes']):
            need(type(index) is int and index == len(observed_indices), 'Contiguous stream; no omitted or repeated rows')
            observed_indices.append(index)
            row = document['cases'][index]
            need((row['index'], row['provider'], row['design'], row['scenario']) == (index, provider, identity, scenario), 'Exact row-to-series identity')
            if scenario == 'year':
                direction = 1 if step < days else -1
                requests = [(current + timedelta(days=direction)).isoformat()]
            elif scenario == 'jumps':
                direction, requests = 0, [JUMPS[step]]
            else:
                direction = 1
                requests = [(current + timedelta(days=k)).isoformat() for k in (1, 2, 4, 3)]
            need(row['direction'] == direction and row['fromISO'] == current.isoformat() and row['requests'] == requests and row['toISO'] == requests[-1], 'Independent exact requested-date sequence')
            need(state_hash(state) == row['fromStateHash'], 'Previous complete pose carried into next request')
            before = state
            state = replay(state, row['word'])
            W.show(state, cells(identity, requests[-1]))
            need(state_hash(state) == row['toStateHash'], 'All 54 resulting frames match')
            need(replay(state, W.inverse(row['word'])) == before, 'Full inverse restores every identity and frame')
            cost = counts(row['word'])
            need(row['counts'] == cost, 'Exact HTM/QTM/xyz counts')
            targets = row['moveTargets']
            need(len(targets) == cost['total'] and all(t in (key(requests[0]), key(requests[-1])) for t in targets), 'Every committed move belongs to active or latest target')
            obsolete = sum(t != key(requests[-1]) for t in targets)
            expected_obsolete = 1 if scenario == 'interrupt-move' else 0
            need(row['obsoleteCommitted'] == obsolete == expected_obsolete, 'Superseded route stops at correct move boundary')
            if obsolete:
                need(targets[0] == key(requests[0]) and all(t == key(requests[-1]) for t in targets[1:]), 'Exactly one old turn, then only the latest requested target')
            final_counts = counts(' '.join(row['word'].split()[obsolete:]))
            need(row['finalPlanCounts'] == {'htm': final_counts['htm'], 'rotations': final_counts['global']}, 'Final plan accounting excludes the abandoned prefix honestly')
            need(row['route'] in ('optimized', 'fallback', 'baseline'), 'Known controller route status')
            need(type(row['elapsedMs']) in (int, float) and math.isfinite(row['elapsedMs']) and row['elapsedMs'] >= 0, 'Measured nonnegative elapsed time')
            need(row['firstMotionMs'] is None or (0 <= row['firstMotionMs'] <= row['elapsedMs']), 'Measured first-motion time within full request')
            need(len(row['planning']) == (2 if scenario == 'interrupt-planning' else 2 if scenario == 'interrupt-move' else 1), 'Bounded planning count, with stale or interrupted target replacement')
            for n, p in enumerate(row['planning']):
                plan_target = requests[0] if n == 0 else requests[-1]
                plan_reference = reduced(reference+' '+row['word'].split()[0]) if scenario == 'interrupt-move' and n == 1 else reference
                plan_source = replay(before, row['word'].split()[0]) if scenario == 'interrupt-move' and n == 1 else before
                target_word = goals[identity][tuple(key(plan_target))]
                try:
                    W.show(plan_source, cells(identity, plan_target))
                    fallback = ''
                except AssertionError:
                    fallback = reduced(W.inverse(plan_reference)+' '+target_word)
                need(p['target'] == key(plan_target), 'Actual planned target matches first or latest request')
                need(p['sourceReferenceTokens'] == len(plan_reference.split()), 'Exact actual full-pose source reference length')
                need(p['baselineCounts'] == counts(fallback), 'Correct counterfactual baseline from actual source')
                if 'elapsedMs' in p:
                    need(math.isfinite(p['elapsedMs']) and p['elapsedMs'] >= 0, 'Measured provider elapsed time')
            reference = reduced(reference+' '+row['word'])
            canonical_word = goals[identity][tuple(key(requests[-1]))]
            if state == replay(sources[identity], canonical_word) and len(canonical_word.split()) < len(reference.split()):
                reference = canonical_word
            obsolete_turns += obsolete
            rows.append(row)
            current = date.fromisoformat(requests[-1])
        need(len(rows) == (2*days if scenario == 'year' else len(JUMPS) if scenario == 'jumps' else groups), 'Complete series length')
        for direction in ((1, -1) if scenario == 'year' else (0,)):
            subset = [r for r in rows if scenario != 'year' or r['direction'] == direction]
            stat = next(s for s in document['statistics'] if (s['provider'], s['design'], s['scenario'], s['direction']) == (*sid, direction))
            need(stat['cases'] == len(subset), 'Summary case count')
            for field, source in [('htm', 'htm'), ('qtm', 'qtm'), ('rotations', 'global'), ('allMoves', 'total')]:
                need(stat[field] == metric([r['counts'][source] for r in subset]), 'Independently recomputed move statistics')
            need(stat['elapsedMs'] == metric([r['elapsedMs'] for r in subset]), 'Summary timing from captured measurements')
            need(stat['fallbackCases'] == sum(r['route'] == 'fallback' for r in subset), 'Fallback count')
            statistics.append(stat)
    need(len(seen_series) == len(providers)*3*4 and observed_indices == list(range(expected_cases)), 'Every provider/print/scenario and actual stream row covered')
    need(len(statistics) == len(document['statistics']) == len(providers)*3*5, 'No unverified summary rows')
    return {'status': 'PASS', 'cases': expected_cases, 'series': len(seen_series), 'providers': providers, 'all54FrameInverseRestorations': expected_cases, 'obsoleteSingleTurns': obsolete_turns, 'sourcePrintingUnchanged': True, 'optimality': 'UNKNOWN', 'universalMoveBound': 'UNKNOWN', 'browserTiming': 'NOT_MEASURED'}


if __name__ == '__main__':
    path = Path(sys.argv[1])
    print(json.dumps(verify(json.loads(path.read_bytes())), indent=2))
