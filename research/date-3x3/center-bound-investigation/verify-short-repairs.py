"""Replay shorter visible-center repairs using the historical Rodrigues checker.

No application geometry, planner, cubie solver, or search implementation imports.
"""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / 'portfolio-benchmark'))
import verify as V

HALF = "F U D F2 U' D' F U D F2 U' D'"
QUARTER = "F U D R2 L2 U' D' B' U D R2 L2 U' D'"
REPAIRS = [
    {'name': 'front-quarter-clockwise', 'word': QUARTER, 'htm': 14, 'up': (1, 0, 0)},
    {'name': 'front-half', 'word': HALF, 'htm': 12, 'up': (0, -1, 0)},
    {'name': 'front-quarter-counterclockwise', 'word': V.W.inverse(QUARTER), 'htm': 14, 'up': (-1, 0, 0)},
]

def center(s):
    return sum(bool(x) for x in s[2]) == 1


def source():
    raw, model, _ = V.SOURCES['de-a']
    return V.W.source_state(json.loads((V.ROOT/raw).read_bytes())['printing'],
                            json.loads((V.ROOT/model).read_bytes()))


def check_repair(state, row):
    end = V.replay(state, row['word'])
    V.need(V.counts(row['word']) == {'total': row['htm'], 'htm': row['htm'],
                                    'qtm': sum(2 if t.endswith('2') else 1 for t in row['word'].split()), 'global': 0}, 'Exact repair counts')
    V.need(all(a == b for a, b in zip(state, end) if not center(a)), 'Every noncenter identity and frame is restored')
    V.need(all(a[:4] == b[:4] and a[5] == b[5] for a, b in zip(state, end)), 'All identities, positions, normals and images remain unchanged')
    front = next(s for s in end if s[2] == (0, 0, 1) and s[3] == (0, 0, 1))
    V.need(front[4] == row['up'], 'Required visible center rotation')
    V.need(V.replay(end, V.W.inverse(row['word'])) == state, 'All54 inverse restoration')
    return end


def main():
    initial = source()
    repairs = []
    for row in REPAIRS:
        end = check_repair(initial, row)
        changed = [{'position': a[2], 'beforeUp': a[4], 'afterUp': b[4]}
                   for a, b in zip(initial, end) if a != b]
        repairs.append({**row, 'changedCenters': changed,
                        'allNoncenterFramesRestored': True, 'all54InverseRestored': True})
    # Exercise every source front orientation while retaining its actual hidden pose.
    orientation_checks = 0
    for prefix in ['', 'F', 'F2', "F'", 'R U B2 F L2 D']:
        start = V.replay(initial, prefix)
        for row in REPAIRS:
            actual = V.replay(start, row['word'])
            V.need(all(a == b for a, b in zip(start, actual) if not center(a)), 'Noncenter restoration after arbitrary prefix')
            V.need(V.replay(actual, V.W.inverse(row['word'])) == start, 'Prefix full inverse')
            orientation_checks += 1
    # Reject five altered witnesses; this is a validity check, not a shortest-path proof.
    controls = [
        {**REPAIRS[1], 'word': ' '.join(HALF.split()[:-1])},
        {**REPAIRS[1], 'up': (0, 1, 0)},
        {**REPAIRS[0], 'word': V.W.inverse(QUARTER)},
        {**REPAIRS[0], 'htm': 13},
        {**REPAIRS[0], 'word': QUARTER + ' R'},
    ]
    for row in controls:
        try:
            check_repair(initial, row)
        except (AssertionError, ValueError):
            pass
        else:
            raise AssertionError('Altered repair witness accepted')
    capture_path = V.ROOT/'captures/calendar-2024-v2.json'
    raw = capture_path.read_bytes()
    capture = json.loads(raw)
    series = next(s for s in capture['series'] if
                  (s['provider'], s['design'], s['scenario']) == ('portfolio', 'de-a', 'year'))
    state = V.replay(initial, series['initialWord'])
    worst = None
    for index in series['rowIndexes']:
        row = capture['cases'][index]
        V.need(V.state_hash(state) == row['fromStateHash'], 'Continuous actual source pose from original stream')
        if index == 2980:
            old = V.replay(state, row['word'])
            legacy = json.loads((ROOT.parent/'center-corrections.json').read_text())['witnesses'][1]['word']
            V.need(row['word'].split()[-20:] == legacy.split(), 'Exact saved legacy20 suffix')
            prefix = ' '.join(row['word'].split()[:-20])
            replacement = V.reduced(prefix + ' ' + HALF)
            end = V.replay(state, replacement)
            V.need(end == old and V.state_hash(old) == row['toStateHash'], 'Same exact old54frame endpoint')
            V.W.show(end, V.cells('de-a', row['toISO']))
            V.need(V.replay(end, V.W.inverse(replacement)) == state, 'Shorter worst route full inverse')
            worst = {'captureIndex': index, 'design': row['design'], 'fromISO': row['fromISO'],
                     'toISO': row['toISO'], 'fromStateHash': row['fromStateHash'],
                     'toStateHash': row['toStateHash'], 'oldWord': row['word'],
                     'oldCounts': row['counts'], 'ordinaryPrefix': prefix,
                     'ordinaryPrefixCounts': V.counts(prefix), 'legacyRepairHTM': 20,
                     'replacementRepairHTM': 12, 'newWord': replacement,
                     'newCounts': V.counts(replacement), 'sameFull54FrameEndpoint': True,
                     'frontVerified': True, 'all54InverseRestored': True,
                     'boundedSearchAttempts': row['planning'][0]['diagnostics']['attempts']}
            break
        state = V.replay(state, row['word'])
    V.need(worst is not None, 'Worst actual route found')
    result = {'status': 'SAT', 'claim': 'Legal shorter visible-center repair witnesses, not shortest paths',
              'primarySource': 'https://kociemba.org/twisted.htm',
              'capturePath': 'research/date-3x3/portfolio-benchmark/captures/calendar-2024-v2.json',
              'captureSHA256': hashlib.sha256(raw).hexdigest(), 'repairs': repairs,
              'prefixOrientationChecks': orientation_checks, 'negativeControlsRejected': len(controls),
              'worstRoute': worst, 'optimality': 'UNKNOWN', 'fullPictureTwentyOneBound': 'UNKNOWN'}
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
