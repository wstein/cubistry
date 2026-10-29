"""Independent Rodrigues checks of cyclic center-kernel shifts and a real V3 row."""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / 'portfolio-benchmark'))
import verify as V


def source():
    raw, model, _ = V.SOURCES['de-a']
    return V.W.source_state(json.loads((V.ROOT/raw).read_bytes())['printing'],
                            json.loads((V.ROOT/model).read_bytes()))


def shifts(word):
    t = word.split()
    V.need(t and all(x[0] in 'RLUDFB' for x in t), 'Only outer-face repair words')
    return [' '.join(t[i:]+t[:i]) for i in range(len(t))]


def family(repair, half=False):
    return shifts(repair) + (shifts(V.W.inverse(repair)) if half else [])


def shortest(prefix, repair, half=False):
    choices = [V.reduced(prefix+' '+s) for s in family(repair, half)]
    return min(enumerate(choices), key=lambda pair: (len(pair[1].split()), pair[0]))


def check_equal(start, candidate, expected):
    end = V.replay(start, candidate)
    V.need(end == expected, 'Exact all54 transformation equality')
    V.need(V.replay(end, V.W.inverse(candidate)) == start, 'Exact all54 inverse')


def main(path):
    base = source()
    repairs = json.loads((ROOT/'verification.json').read_text())['repairs']
    legacy = json.loads((ROOT.parent/'center-corrections.json').read_text())['witnesses']
    output, prefixes, boundary = [], 0, []
    for row, old in zip(repairs, legacy):
        end = V.replay(base, row['word'])
        V.need(V.replay(base, old['word']) == end, 'Legacy and shorter repairs have identical all54 action')
        for i, word in enumerate(family(row['word'], row['htm'] == 12)):
            check_equal(base, word, end)
            for prefix in ["R U2 B F' D", 'x y2', "F R B2 U L2 D'"]:
                start = V.replay(base, prefix)
                check_equal(start, word, V.replay(start, row['word']))
                prefixes += 1
            output.append({'repair': row['name'], 'offset': i % row['htm'], 'family': 'inverse-half' if i >= row['htm'] else 'direct', 'word': word,
                           'sameAll54Transformation': True, 'fullInverseRestored': True})
        for face in 'RLUDFB':
            for amount in ['', "'", '2']:
                prefix = face+amount
                offset, word = shortest(prefix, row['word'], row['htm'] == 12)
                check_equal(base, word, V.replay(base, prefix+' '+row['word']))
                saving = 1+len(row['word'].split())-len(word.split())
                if row['htm'] == 14:
                    V.need(saving >= 1, 'Every outer boundary merges with a quarter repair shift')
                boundary.append({'repair': row['name'], 'prefix': prefix, 'offset': offset,
                                 'savingHTM': saving, 'word': word})
    V.need(len(output) == 52 and prefixes == 156 and len(boundary) == 54, 'Complete finite cyclic and boundary domain')
    first = repairs[0]['word']
    invalid = [first+' R', ' '.join(first.split()[1:]), V.W.inverse(first),
               'x '+first+" x'", "F' "+' '.join(first.split()[1:])]
    target = V.replay(base, first)
    for word in invalid:
        try:
            check_equal(base, word, target)
        except AssertionError:
            pass
        else:
            raise AssertionError('Non-equivalent repair accepted')
    v2_path = V.ROOT/'captures/calendar-2024-v2.json'
    v2_raw = v2_path.read_bytes()
    v2 = json.loads(v2_raw)
    v2_series = next(s for s in v2['series'] if
                    (s['provider'], s['design'], s['scenario']) == ('portfolio', 'de-a', 'year'))
    v2_state = V.replay(base, v2_series['initialWord'])
    half_witness = None
    for index in v2_series['rowIndexes']:
        row = v2['cases'][index]
        V.need(V.state_hash(v2_state) == row['fromStateHash'], 'Actual V2 prefix continuity')
        if index == 2980:
            prefix = ' '.join(row['word'].split()[:-20])
            choice, word = shortest(prefix, repairs[1]['word'], True)
            old_end = V.replay(v2_state, row['word'])
            check_equal(v2_state, word, old_end)
            V.W.show(old_end, V.cells('de-a', row['toISO']))
            V.need(V.counts(word) == {'total': 33, 'htm': 31, 'qtm': 46, 'global': 2}, 'Inverse half improves actual V2 source to31HTM')
            half_witness = {'index': index, 'fromISO': row['fromISO'], 'toISO': row['toISO'],
                            'fromStateHash': row['fromStateHash'], 'toStateHash': row['toStateHash'],
                            'oldWord': row['word'], 'oldCounts': row['counts'],
                            'family': 'inverse-half' if choice >= 12 else 'direct',
                            'repairOffset': choice % 12, 'newWord': word, 'newCounts': V.counts(word),
                            'sameAll54Endpoint': True, 'fullInverseRestored': True}
            break
        v2_state = V.replay(v2_state, row['word'])
    V.need(half_witness is not None, 'V2 worst half-repair source found')
    raw = Path(path).read_bytes()
    capture = json.loads(raw)
    series = next(s for s in capture['series'] if
                  (s['provider'], s['design'], s['scenario']) == ('portfolio', 'de-a', 'year'))
    state = V.replay(base, series['initialWord'])
    reference = series['initialWord']
    original = json.loads((V.ROOT/'../witnesses/de-2.json').read_text())
    goals = {(t['weekday'], t['day'], t['month']): V.canonical(t) for t in original['targets']}
    witness = None
    for index in series['rowIndexes']:
        row = capture['cases'][index]
        V.need(V.state_hash(state) == row['fromStateHash'], 'Continuous V3 actual source')
        p = row['planning'][0]
        if 'sourceReferenceReplacement' in p:
            reference = p['sourceReferenceReplacement']
        V.need(V.replay(base, reference) == state and hashlib.sha256(reference.encode()).hexdigest() == p['sourceReferenceHash'], 'Exact retained source reference')
        if index == 2467:
            repair = repairs[2]['word']
            V.need(row['word'].split()[-14:] == repair.split(), 'Exact V3 worst repair suffix')
            prefix = ' '.join(row['word'].split()[:-14])
            offset, word = shortest(prefix, repair)
            end = V.replay(state, row['word'])
            check_equal(state, word, end)
            V.need(V.state_hash(end) == row['toStateHash'], 'Exact captured V3 endpoint')
            V.W.show(end, V.cells('de-a', row['toISO']))
            V.need(V.counts(word) == {'total': 36, 'htm': 34, 'qtm': 50, 'global': 2}, 'Expected worst route improvement')
            witness = {'index': index, 'design': row['design'], 'fromISO': row['fromISO'],
                       'toISO': row['toISO'], 'sourceWord': reference,
                       'sourceReferenceSHA256': hashlib.sha256(reference.encode()).hexdigest(),
                       'fromStateHash': row['fromStateHash'], 'toStateHash': row['toStateHash'],
                       'oldWord': row['word'], 'oldCounts': row['counts'],
                       'ordinaryPrefix': prefix, 'ordinaryPrefixCounts': V.counts(prefix),
                       'repairOffset': offset, 'newWord': word, 'newCounts': V.counts(word),
                       'sameAll54Endpoint': True, 'fullInverseRestored': True}
            break
        t = row['word'].split()
        pos = 0
        for event in row.get('referenceEvents', []):
            reference = V.reduced(reference+' '+' '.join(t[pos:event['beforeMove']]))
            V.need(V.replay(base, event['word']) == V.replay(state, ' '.join(t[:event['beforeMove']])), 'Pre-turn compaction exact physical frame')
            reference = event['word']; pos = event['beforeMove']
        reference = V.reduced(reference+' '+' '.join(t[pos:]))
        state = V.replay(state, row['word'])
        canonical = goals[tuple(V.key(row['toISO']))]
        if state == V.replay(base, canonical) and len(canonical.split()) < len(reference.split()):
            reference = canonical
        if 'endReferenceReplacement' in row:
            reference = row['endReferenceReplacement']
        V.need(V.replay(base, reference) == state, 'End reference exact full pose')
    V.need(witness is not None, 'Actual V3 worst source found')
    print(json.dumps({'status': 'SAT', 'scope': 'Fifty-two shifts:14+12+12inverse-half+14; no quarter inverse added',
                     'legacyAndShorterAll54EffectsIdentical': True, 'cyclicWitnesses': output,
                     'additionalPrefixChecks': prefixes, 'all18OuterBoundaryCasesPerRepair': boundary,
                     'negativeControlsRejected': len(invalid),
                     'captureSHA256': hashlib.sha256(raw).hexdigest(), 'actualV3Worst': witness, 'v2CaptureSHA256': hashlib.sha256(v2_raw).hexdigest(),
                     'actualV2HalfImprovement': half_witness,
                     'globalOptimality': 'UNKNOWN', 'universalTwentyOneBound': 'UNKNOWN'}, indent=2))

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) == 2 else ROOT.parent/'portfolio-benchmark/captures/calendar-2024-v3.json')
