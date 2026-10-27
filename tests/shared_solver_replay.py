"""Independent full-body/sticker replay for fresh shared-solver transitions.

Uses the existing standard-library checker, never JS/ReScript/provider code.
"""
import hashlib, importlib.util, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('physical', ROOT / 'research/counter/verify.py')
physical = importlib.util.module_from_spec(spec)
spec.loader.exec_module(physical)

def verify(evidence):
    data = (ROOT / 'public/counter-design.v2.json').read_bytes()
    physical.require(evidence['designSHA256'] == hashlib.sha256(data).hexdigest(), 'Design hash mismatch')
    design = json.loads(data)
    source_pin = json.loads((ROOT / 'puzlwerk-source.json').read_text())
    physical.require(evidence['providerCommit'] == source_pin['commit'], 'Provider pin mismatch')
    cases = evidence['cases']
    physical.require(0 < len(cases) <= 20, 'Bounded focused cases required')
    active = {}
    for case in cases:
        padded = case['padded']
        physical.require(type(padded) is bool, 'Explicit print format required')
        for key in ('from', 'to'):
            physical.require(physical.integral(case[key]) and 0 <= case[key] <= 99, 'Invalid counter value')
        printing = design['prints']['padded' if padded else 'unpadded']
        positions = {p['id']: tuple(p['position']) for p in printing['cubies']}
        source = tuple((s['id'], s['cubie'], positions[s['cubie']], tuple(s['normal']), tuple(s['up']), s['assetId']) for s in printing['stickers'])
        start = physical.apply(source, design['witnesses'][case['from']]['word'])
        chain = case.get('chain')
        if chain in active:
            previous_value, previous_state = active[chain]
            physical.require(case['from'] == previous_value, 'Broken transition chain')
            physical.require(start == previous_state, 'Chain silently normalized its actual source')
            start = previous_state
        word = case['word']
        physical.require(isinstance(word, str) and len(word.split()) <= 64, 'Invalid solver word')
        actual = physical.apply(start, word)
        expected = physical.apply(source, design['witnesses'][case['to']]['word'])
        physical.require(actual == expected, 'Full sticker identity/position/normal/up mismatch')
        display = tuple((*s[:5], ' ' if s[5] == 'blank' else s[5]) for s in actual)
        physical.show(display, case['to'], padded)
        bodies = case['cubies']
        physical.require(len(bodies) == 8 and {b['id'] for b in bodies} == set(positions), 'Missing/duplicate body identity')
        expected_by_id = {s[0]: s for s in expected}
        for body in bodies:
            local = [s for s in printing['stickers'] if s['cubie'] == body['id']]
            physical.require(tuple(body['position']) == expected_by_id[local[0]['id']][2], 'Body position mismatch')
            for sticker in local:
                axis = next(i for i, v in enumerate(sticker['normal']) if v)
                sign = sticker['normal'][axis]
                basis = tuple(sign * v for v in expected_by_id[sticker['id']][3])
                physical.require(tuple(body['orientation'][axis]) == basis, 'Body orientation mismatch')
        physical.require(physical.apply(actual, physical.inverse(word)) == start, 'Inverse lost identity/frame')
        if chain is not None:
            active[chain] = (case['to'], actual)
    return {'status': 'PASS', 'cases': len(cases), 'fullCubies': 8, 'stickerIdentities': 24, 'independentReplay': True}

if __name__ == '__main__':
    raw = sys.stdin.buffer.read(131073)
    physical.require(len(raw) <= 131072, 'Oversized replay evidence')
    print(json.dumps(verify(json.loads(raw))))
