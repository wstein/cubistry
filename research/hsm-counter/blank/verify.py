"""Independent real-blank H/S/M proof and exact canonical-period replayer.

Only the earlier independent Rodrigues engine is reused; no author geometry,
solver, or generator code is imported. Blank print-up is not a visible rule.
"""
import hashlib
import importlib.util
import itertools
import json
import sys
from collections import Counter, deque
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('independent_original_hsm', ROOT.parent / 'verify.py')
physics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(physics)
apply, inverse, need = physics.apply, physics.inverse, physics.need
dot, cross = physics.dot, physics.cross
POSITIONS, AXES = physics.POSITIONS, physics.AXES
FRONT = ((-1, 1, 1), (1, 1, 1), (-1, -1, 1), (1, -1, 1))
MOVES = tuple(face + suffix for face in physics.FACES for suffix in ('', '2', "'"))


def source_state(printing):
    need(type(printing) is list and len(printing) == 24, 'Exactly 24 immutable stickers')
    need(all(type(s['id']) is int and s['id'] == i and type(s['cubie']) is int
             for i, s in enumerate(printing)), 'Ordered unique physical identities')
    observed, groups = set(), {}
    for s in printing:
        for field in ('p', 'n', 'up'):
            need(type(s[field]) is list and len(s[field]) == 3
                 and all(type(v) is int for v in s[field]), 'Integral physical frame')
        p, n, up = (tuple(s[k]) for k in ('p', 'n', 'up'))
        need(p in POSITIONS and n in AXES and up in AXES
             and dot(p, n) == 1 and dot(n, up) == 0, 'Outward tangent sticker frame')
        need(type(s['image']) is str and (s['image'] == '' or len(s['image']) == 1
                                         and s['image'] in '0123456789HSM'), 'Fixed glyph or real blank')
        need(type(s['slot']) is int and 0 <= s['slot'] < 4, 'Integral source role')
        if s['image']:
            need((dot(p, up), dot(p, cross(up, n)))
                 == (FRONT[s['slot']][1], FRONT[s['slot']][0]), 'Exact nonblank upright slot class')
        observed.add((p, n))
        groups.setdefault(s['cubie'], []).append(s)
    need(observed == {(p, n) for p in POSITIONS for n in AXES if dot(p, n) == 1},
         'Complete 24-facelet lattice')
    need(sorted(groups) == list(range(8)) and all(len(g) == 3
         and len({tuple(s['p']) for s in g}) == 1 for g in groups.values()), 'Eight rigid corners')
    need(len({tuple(g[0]['p']) for g in groups.values()}) == 8, 'Eight distinct body positions')
    expected = [(2, '012'), (2, '345'), (3, '012'), (3, '345'),
                (3, '678'), (3, '909'), (1, 'HSM'), (0, ['', '', ''])]
    for cubie, (slot, images) in enumerate(expected):
        need([s['image'] for s in groups[cubie]] == list(images)
             and all(s['slot'] == slot for s in groups[cubie]), 'Exact revised constructive print')
    return tuple((s['id'], s['cubie'], tuple(s['p']), tuple(s['n']), tuple(s['up']), s['image'])
                 for s in printing)


def show(state, letter, value):
    expected = ['', letter, *f'{value:02d}']
    for p, image in zip(FRONT, expected):
        faces = [s for s in state if s[2] == p and s[3] == (0, 0, 1)]
        need(len(faces) == 1 and faces[0][5] == image, 'Exact real-blank/fixed-glyph display')
        if image:
            need(faces[0][4] == (0, 1, 0), 'Nonblank glyph upright')


@lru_cache(maxsize=1)
def distance_engine():
    pose_maps, transitions, allposes = [], [], []
    for slot, position in enumerate(FRONT):
        poses = [(position, (0, 0, 1), (0, 1, 0))]
        lookup = {poses[0]: 0}
        for pose in poses:
            for move in MOVES:
                target = apply(((0, 0, *pose, '0'),), move)[0][2:5]
                if target not in lookup:
                    lookup[target] = len(poses)
                    poses.append(target)
        need(len(poses) == 24, 'Complete physical single-corner orbit')
        transitions.append([[lookup[apply(((0, 0, *pose, '0'),), move)[0][2:5]]
                             for pose in poses] for move in MOVES])
        # A corner position and the normal of one known physical face already
        # determine its rigid orientation. A fictitious up on blank art is free.
        pose_maps.append({pose[:2] if slot == 0 else pose: i for i, pose in enumerate(poses)})
        allposes.append(poses)
    roots = [(i, 0, 0, 0) for i, pose in enumerate(allposes[0]) if pose[0] == FRONT[0]]
    need(len(roots) == 3, 'All three blank-corner twists are valid goals')
    distances = {root: 0 for root in roots}
    queue = deque(roots)
    while queue:
        state = queue.popleft()
        for move in range(18):
            target = tuple(transitions[slot][move][state[slot]] for slot in range(4))
            if target not in distances:
                distances[target] = distances[state] + 1
                queue.append(target)
    need(len(distances) == 8 * 7 * 6 * 5 * 3 ** 4 == 136080,
         'Every ordered distinct-four-corner physical pose covered')
    fixed = {state: distance for state, distance in distances.items()
             if state[1] == 0 and allposes[0][state[0]][0] == FRONT[0]}
    need(len(fixed) == 3 * 6 * 5 * 3 ** 2 == 810, 'All correct-top source poses covered')
    histogram = dict(sorted(Counter(fixed.values()).items()))
    need(histogram == {0: 3, 1: 9, 2: 27, 3: 99, 4: 273, 5: 363, 6: 36},
         'Independent fixed-top distance histogram')
    need(max(distances.values()) == 6, 'Universal six-move bound with real blank')

    def shortest(state, letter, value):
        blank = min((s for s in state if s[5] == ''), key=lambda s: s[0])
        blank_pose = pose_maps[0][blank[2:4]]
        targets = letter + f'{value:02d}'
        choices = [[s for s in state if s[5] == glyph and s[2:5] in pose_maps[slot]]
                   for slot, glyph in enumerate(targets, 1)]
        costs = []
        for selection in itertools.product(*choices):
            if len({blank[1], *(s[1] for s in selection)}) != 4:
                continue
            key = (blank_pose, *(pose_maps[slot][s[2:5]] for slot, s in enumerate(selection, 1)))
            if key in distances:
                costs.append(distances[key])
        need(bool(costs), 'Some distinct physical target corner selection exists')
        return min(costs)

    return shortest, {'graphStates': len(distances), 'validBlankGoalTwists': len(roots),
                      'globalMaximumHTM': 6, 'correctTopSourceStates': len(fixed),
                      'correctTopDistanceHistogram': histogram,
                      'universalFiveMoveClaim': 'NOT established; distance-six sources exist',
                      'scope': 'All three unprinted-corner twists allowed; no blank-up constraint'}


def validate(path, search_counterexample=True):
    raw = Path(path).read_bytes()
    witness = json.loads(raw)
    need(witness['schema'] == 'cubistry.hsm-blank-counter'
         and type(witness['version']) is int and witness['version'] == 1, 'Exact new witness schema')
    source = source_state(witness['printing'])
    shortest, graph = distance_engine()
    for letter in 'HSM':
        for value in range(60):
            need(shortest(source, letter, value) <= 6, 'All 180 exact displays reachable')
    modes = witness['modes']
    expected = set(itertools.product('HSM', (11, 23, 59), (1, -1)))
    need(type(modes) is list and len(modes) == 18, 'Exactly eighteen canonical modes')
    observed, displays, rows, counterexample = set(), set(), [], None
    for mode in modes:
        letter, maximum, direction = (mode[k] for k in ('letter', 'maximum', 'direction'))
        need(type(maximum) is int and type(direction) is int, 'Integral range and direction')
        key = letter, maximum, direction
        need(key in expected and key not in observed, 'Each exact mode once')
        observed.add(key)
        state = apply(source, mode['setup'])
        show(state, letter, 0)
        value, start, steps = 0, mode['periodStart'], mode['steps']
        need(type(steps) is list and 0 < len(steps) <= 100000
             and type(start) is int and 0 <= start < len(steps)
             and start % (maximum + 1) == 0 and len(steps) % (maximum + 1) == 0,
             'Nonempty full-cycle preperiod and period')
        period_pose, costs, prefix = None, [], []
        displays.add((letter, 0))
        for index, step in enumerate(steps):
            if index == start:
                period_pose = state
            if search_counterexample and counterexample is None:
                for target in range(60):
                    if shortest(state, letter, target) == 6:
                        counterexample = {'sourceLetter': letter, 'sourceValue': value,
                                          'targetValue': target, 'minimumHTM': 6,
                                          'mode': {'maximum': maximum, 'direction': direction},
                                          'beforeStep': index, 'legalSourceWord': ' '.join([mode['setup'], *prefix]).strip(),
                                          'sourceState': state,
                                          'meaning': 'A valid real-blank settled source needs six moves '
                                                     'to this exact arbitrary target for this print.'}
                        break
            target = (value + direction) % (maximum + 1)
            need(type(step['from']) is int and type(step['to']) is int
                 and (step['from'], step['to']) == (value, target), 'Exact modular order')
            cost = len(step['word'].split())
            need(1 <= cost <= 6 and cost == shortest(state, letter, target),
                 'Shortest real-blank legal edge within universal six-move bound')
            previous = state
            state = apply(state, step['word'])
            show(state, letter, target)
            need(apply(state, inverse(step['word'])) == previous, 'Every full physical edge inverse')
            costs.append(cost)
            prefix.append(step['word'])
            value = target
            displays.add((letter, value))
        need(value == 0 and state == period_pose, 'Exact 24-sticker full-period closure')
        need(type(mode['maximumHTM']) is int and mode['maximumHTM'] == max(costs), 'Honest mode maximum')
        rows.append({'letter': letter, 'maximum': maximum, 'direction': direction,
                     'policy': mode.get('policy'), 'preperiodEdges': start,
                     'periodEdges': len(steps) - start, 'verifiedEdges': len(steps),
                     'maximumHTM': max(costs), 'periodHTM': sum(costs[start:]),
                     'setupHTM': len(mode['setup'].split())})
    need(observed == expected and displays == set(itertools.product('HSM', range(60))),
         'All eighteen modes and all180 exact four-cell displays physically witnessed')
    maximum = max(row['maximumHTM'] for row in rows)
    need(type(witness['maximumHTM']) is int and witness['maximumHTM'] == maximum,
         'Exact saved-period overall maximum')
    if counterexample:
        reproduced = apply(source, counterexample['legalSourceWord'])
        need(reproduced == counterexample['sourceState'], 'Counterexample has an actual legal source word')
        show(reproduced, counterexample['sourceLetter'], counterexample['sourceValue'])
        need(shortest(reproduced, counterexample['sourceLetter'], counterexample['targetValue']) == 6,
             'Counterexample independent shortest distance remains six')
        goal_state, remaining, target_word = reproduced, 6, []
        while remaining:
            for move in MOVES:
                candidate = apply(goal_state, move)
                if shortest(candidate, counterexample['sourceLetter'], counterexample['targetValue']) == remaining - 1:
                    goal_state = candidate
                    target_word.append(move)
                    remaining -= 1
                    break
            else:
                raise AssertionError('Six-move counterexample route must have a descending edge')
        show(goal_state, counterexample['sourceLetter'], counterexample['targetValue'])
        counterexample['legalSixMoveTargetWord'] = ' '.join(target_word)
        need(apply(goal_state, inverse(counterexample['legalSixMoveTargetWord'])) == reproduced,
             'Six-move target word inverse restores the actual counterexample source')
    return {'status': 'SAT', 'witnessSHA256': hashlib.sha256(raw).hexdigest(),
            'realBlankTopLeftVerified': True, 'distinctDisplays': len(displays),
            'independentFourCornerGraph': graph, 'canonicalModes': rows,
            'canonicalMaximumHTM': maximum, 'sixMoveArbitraryJumpExample': counterexample,
            'scope': 'Canonical full-pose periods may repeat indefinitely at their recorded maximum; '
                     'this does not make five moves a universal arbitrary-source guarantee.',
            'globalPrintOptimality': 'UNKNOWN'}


if __name__ == '__main__':
    print(json.dumps(validate(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'witness.json'), indent=2))
