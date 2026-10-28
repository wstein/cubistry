"""Independent H/S/M counter witness checker, using integer Rodrigues turns.

No generator, JavaScript, solver, or project geometry imports are used.
"""
import hashlib
import itertools
import json
import re
import sys
from collections import deque
from pathlib import Path

POSITIONS = tuple(itertools.product((-1, 1), repeat=3))
AXES = tuple(tuple(sign if i == axis else 0 for i in range(3))
             for axis in range(3) for sign in (-1, 1))
FACES = {'R': (0, 1), 'L': (0, -1), 'U': (1, 1),
         'D': (1, -1), 'F': (2, 1), 'B': (2, -1)}
SLOTS = ((1, 1, 1), (-1, -1, 1), (1, -1, 1))


def need(condition, message):
    if not condition:
        raise AssertionError(message)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def rotate(vector, axis, quarters):
    direction = tuple(int(i == axis) for i in range(3))
    cosine, sine = (1, 0, -1, 0)[quarters % 4], (0, 1, 0, -1)[quarters % 4]
    perpendicular = cross(direction, vector)
    parallel = dot(direction, vector)
    return tuple(vector[i] * cosine + perpendicular[i] * sine
                 + direction[i] * parallel * (1 - cosine) for i in range(3))


def apply(state, word):
    need(type(word) is str and len(word.split()) <= 64, 'Bounded string move word')
    for token in word.split():
        match = re.fullmatch(r"([RLUDFB])(2|')?", token)
        need(match is not None, 'Legal face-turn notation')
        axis, side = FACES[match[1]]
        amount = 2 if match[2] == '2' else -1 if match[2] == "'" else 1
        quarters = -side * amount
        state = tuple((ident, cubie, rotate(p, axis, quarters),
                       rotate(n, axis, quarters), rotate(up, axis, quarters), ink)
                      if p[axis] == side else (ident, cubie, p, n, up, ink)
                      for ident, cubie, p, n, up, ink in state)
    return state


def inverse(word):
    return ' '.join(token if token.endswith('2') else token[:-1]
                    if token.endswith("'") else token + "'"
                    for token in reversed(word.split()))


def show(state, letter, value):
    for position, expected in zip(SLOTS, letter + f'{value:02d}'):
        seen = [s for s in state if s[2] == position and s[3] == (0, 0, 1)]
        need(len(seen) == 1, 'Exactly one visible physical sticker per target slot')
        need(seen[0][5] == expected, f'Exact fixed glyph for {letter}{value:02d}')
        need(seen[0][4] == (0, 1, 0), f'Upright glyph for {letter}{value:02d}')


def source_state(printing):
    need(type(printing) is list and len(printing) == 24, 'Exactly 24 stickers')
    need(all(type(s['id']) is int and type(s['cubie']) is int for s in printing),
         'Integer physical identities')
    need(sorted(s['id'] for s in printing) == list(range(24)), 'Unique sticker identities')
    observed, bodies = set(), {}
    for sticker in printing:
        for field in ('p', 'n', 'up'):
            vector = sticker[field]
            need(type(vector) is list and len(vector) == 3
                 and all(type(v) is int for v in vector), 'Integral 3D frame')
        p, n, up = (tuple(sticker[field]) for field in ('p', 'n', 'up'))
        need(p in POSITIONS and n in AXES and up in AXES
             and dot(p, n) == 1 and dot(n, up) == 0, 'Outward tangent print frame')
        need(type(sticker['image']) is str and len(sticker['image']) == 1
             and sticker['image'] in '0123456789HSM ', 'One immutable glyph per sticker')
        observed.add((p, n))
        bodies.setdefault(sticker['cubie'], []).append(p)
    need(observed == {(p, n) for p in POSITIONS for n in AXES if dot(p, n) == 1},
         'Complete 24-facelet lattice')
    need(sorted(bodies) == list(range(8)) and all(len(v) == 3 and len(set(v)) == 1
                                               for v in bodies.values()), 'Eight rigid corners')
    need(len({v[0] for v in bodies.values()}) == 8, 'Distinct physical corners')
    return tuple((s['id'], s['cubie'], tuple(s['p']), tuple(s['n']), tuple(s['up']), s['image'])
                 for s in printing)


def distance_engine():
    """Exhaustive independent three-sticker graph, with hidden corners free."""
    moves = tuple(face + suffix for face in FACES for suffix in ('', '2', "'"))
    pose_maps, transitions = [], []
    for slot in SLOTS:
        seed = (slot, (0, 0, 1), (0, 1, 0))
        poses, lookup = [seed], {seed: 0}
        for pose in poses:
            for move in moves:
                state = apply(((0, 0, *pose, '0'),), move)
                result = state[0][2:5]
                if result not in lookup:
                    lookup[result] = len(poses)
                    poses.append(result)
        need(len(poses) == 24, 'Exactly 24 rigid poses per sticker slot class')
        transitions.append([[lookup[apply(((0, 0, *pose, '0'),), move)[0][2:5]]
                             for pose in poses] for move in moves])
        pose_maps.append(lookup)
    distances = {(0, 0, 0): 0}
    queue = deque([(0, 0, 0)])
    while queue:
        poses = queue.popleft()
        for move in range(18):
            target = tuple(transitions[s][move][poses[s]] for s in range(3))
            if target not in distances:
                distances[target] = distances[poses] + 1
                queue.append(target)

    def shortest(state, letter, value):
        targets = letter + f'{value:02d}'
        candidates = [[s for s in state if s[5] == glyph and s[2:5] in pose_maps[slot]]
                      for slot, glyph in enumerate(targets)]
        lengths = []
        for chosen in itertools.product(*candidates):
            if len({s[1] for s in chosen}) != 3:
                continue
            key = tuple(pose_maps[slot][s[2:5]] for slot, s in enumerate(chosen))
            if key in distances:
                lengths.append(distances[key])
        need(bool(lengths), 'A reachable target sticker selection exists')
        return min(lengths)

    histogram = {}
    for distance in distances.values():
        histogram[distance] = histogram.get(distance, 0) + 1
    return shortest, {'states': len(distances), 'histogram': histogram}


def validate(path):
    raw = Path(path).read_bytes()
    data = json.loads(raw)
    need(data['schema'] == 'cubistry.hsm-counter' and type(data['version']) is int
         and data['version'] == 1, 'Versioned H/S/M counter schema')
    need(data['puzzle'] == '2x2x2', 'Exact 2x2x2 puzzle')
    source = source_state(data['printing'])
    shortest, bfs = distance_engine()
    routes = data['routes']
    need(type(routes) is list and len(routes) == 3
         and sorted(r['letter'] for r in routes) == ['H', 'M', 'S'], 'All three letter routes')
    rows = []
    for route in routes:
        letter = route['letter']
        words = [route['setup']] + route['increments']
        need(len(words) == 60, 'Exact 00 through 59 coverage')
        state, states = source, []
        for value, word in enumerate(words):
            old = state
            need(len(word.split()) == shortest(old, letter, value),
                 'Source-to-display shortest HTM edge')
            state = apply(state, word)
            show(state, letter, value)
            need(apply(state, inverse(word)) == old, 'Full-state edge inverse')
            states.append(state)
        for value in range(58, -1, -1):
            state = apply(state, inverse(words[value + 1]))
            need(state == states[value], 'Exact full-state decrement replay')
            show(state, letter, value)
        need(apply(state, inverse(words[0])) == source, 'Exact setup inverse')
        reset = apply(states[23], route['from23To00'])
        show(reset, letter, 0)
        need(apply(reset, inverse(route['from23To00'])) == states[23], 'Reset inverse')
        reset_length = len(route['from23To00'].split())
        need(reset_length == shortest(states[23], letter, 0), 'Shortest 23 to 00 edge')
        need(reset_length < 10, '23 to 00 strictly below ten HTM')
        reset11 = apply(states[11], route['from11To00'])
        show(reset11, letter, 0)
        need(apply(reset11, inverse(route['from11To00'])) == states[11], '11 reset inverse')
        reset11_length = len(route['from11To00'].split())
        need(reset11_length == shortest(states[11], letter, 0), 'Shortest 11 to 00 edge')
        need(reset11_length < 10, '11 to 00 strictly below ten HTM')
        lengths = [len(w.split()) for w in words[1:]]
        rows.append({'letter': letter, 'states': 60, 'forwardEdges': 59,
                     'reverseEdges': 59, 'totalHTM': sum(lengths),
                     'maximumHTM': max(lengths), 'meanHTM': sum(lengths) / 59,
                     'reset23HTM': reset_length, 'reset11HTM': reset11_length,
                     'setupHTM': len(words[0].split())})
    total = sum(row['totalHTM'] for row in rows)
    maximum = max(row['maximumHTM'] for row in rows)
    jump = max(row['reset23HTM'] for row in rows)
    jump11 = max(row['reset11HTM'] for row in rows)
    need(data['metrics'] == {'maximumIncrementHTM': maximum, 'totalIncrementHTM': total,
                            'meanIncrementHTM': total / 177, 'maximum23To00HTM': jump,
                            'maximum11To00HTM': jump11},
         'Reported metrics exactly match independent replay')
    need(data['bfs']['states'] == bfs['states']
         and data['bfs']['histogram'] == {str(k): v for k, v in bfs['histogram'].items()},
         'Reported graph size and histogram match independent BFS')
    return {'status': 'SAT', 'physicalStates': 180, 'routes': rows,
            'independentBFS': bfs, 'shortestForwardEdges': 177, 'shortestResetEdges': 6,
            'candidateSHA256': hashlib.sha256(raw).hexdigest(),
            'scope': 'Fixed upright print; TR letter, BL tens, BR units; TL unconstrained',
            'globalLayoutOptimality': 'UNKNOWN'}


if __name__ == '__main__':
    print(json.dumps(validate(sys.argv[1]), indent=2))
