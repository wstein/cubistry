"""Independent fixed-letter bound and full-pose periodic certificate checker."""
import hashlib
import itertools
import json
import sys
from collections import deque
from pathlib import Path

from verify import (SLOTS, FACES, apply, distance_engine, inverse, need,
                    show, source_state)

ROOT = Path(__file__).resolve().parent


def fixed_letter_bound():
    """Rebuild the whole graph and restrict sources to an already upright letter."""
    moves = tuple(face + suffix for face in FACES for suffix in ('', '2', "'"))
    transitions = []
    for position in SLOTS:
        poses = [(position, (0, 0, 1), (0, 1, 0))]
        lookup = {poses[0]: 0}
        for pose in poses:
            for move in moves:
                target = apply(((0, 0, *pose, '0'),), move)[0][2:5]
                if target not in lookup:
                    lookup[target] = len(poses)
                    poses.append(target)
        need(len(poses) == 24, 'Complete rigid single-sticker orbit')
        transitions.append([[lookup[apply(((0, 0, *pose, '0'),), move)[0][2:5]]
                             for pose in poses] for move in moves])
    distances = {(0, 0, 0): 0}
    queue = deque([(0, 0, 0)])
    while queue:
        pose = queue.popleft()
        for move in range(18):
            target = tuple(transitions[slot][move][pose[slot]] for slot in range(3))
            if target not in distances:
                distances[target] = distances[pose] + 1
                queue.append(target)
    need(len(distances) == 8 * 7 * 6 * 3 ** 3,
         'Every ordered triple of distinct corners and twists is covered')
    fixed = {pose: distance for pose, distance in distances.items() if pose[0] == 0}
    need(len(fixed) == 7 * 6 * 3 ** 2, 'Every fixed-letter source triple covered')
    maximum = max(fixed.values())
    need(maximum <= 5, 'Universal same-letter settled-source bound')
    histogram = {}
    for distance in fixed.values():
        histogram[distance] = histogram.get(distance, 0) + 1
    return {'status': 'SAT', 'fullGraphStates': len(distances),
            'fixedLetterSourceStates': len(fixed), 'maximumHTM': maximum,
            'distanceHistogram': histogram,
            'scope': 'Any legal source with the required letter already upright in TR; '
                     'any matching upright BL/BR target using distinct corners; hidden pose free'}


def validate(path):
    raw = Path(path).read_bytes()
    data = json.loads(raw)
    need(data['schema'] == 'cubistry.hsm-periodic-counter'
         and type(data['version']) is int and data['version'] == 1, 'Exact certificate schema')
    original_raw = (ROOT / 'comparison/candidates/intermediate.json').read_bytes()
    original = json.loads(original_raw)
    need(data['printing'] == original['printing'], 'Exact previously proved intermediate print')
    source = source_state(data['printing'])
    # Do not trust generator slot annotations: physical orbit membership decides
    # whether a fixed sticker can occupy an upright target slot.
    shortest, _ = distance_engine()
    for letter in 'HSM':
        for value in range(60):
            shortest(source, letter, value)
    lemma = fixed_letter_bound()
    expected = set(itertools.product('HSM', (11, 23, 59), (1, -1)))
    modes = data['modes']
    need(type(modes) is list and len(modes) == 18, 'Exactly eighteen modes')
    observed = set()
    rows = []
    for mode in modes:
        letter, maximum, direction = (mode[key] for key in ('letter', 'maximum', 'direction'))
        need(type(maximum) is int and type(direction) is int, 'Integral range and direction')
        key = letter, maximum, direction
        need(key in expected and key not in observed, 'Each mode exactly once')
        observed.add(key)
        state = apply(source, mode['setup'])
        show(state, letter, 0)
        steps, start = mode['steps'], mode['periodStart']
        need(type(steps) is list and 0 < len(steps) <= 100000, 'Bounded nonempty trace')
        need(type(start) is int and 0 <= start < len(steps)
             and start % (maximum + 1) == 0 and len(steps) % (maximum + 1) == 0,
             'Nonempty period and preperiod at zero-display boundaries')
        value, total, costs = 0, 0, []
        period_pose = None
        for index, step in enumerate(steps):
            if index == start:
                period_pose = state
            target = (value + direction) % (maximum + 1)
            need(type(step['from']) is int and type(step['to']) is int
                 and (step['from'], step['to']) == (value, target), 'Exact modular number order')
            word = step['word']
            need(type(word) is str, 'String step word')
            cost = len(word.split())
            need(1 <= cost <= 5, 'Every counting or wrap edge is one through five HTM')
            need(cost == shortest(state, letter, target), 'Shortest matching display from actual pose')
            previous = state
            state = apply(state, word)
            show(state, letter, target)
            need(apply(state, inverse(word)) == previous, 'Full-frame edge inverse')
            costs.append(cost)
            total += cost
            value = target
        need(value == 0 and state == period_pose, 'Exact full 24-sticker period closure')
        need(type(mode['maximumHTM']) is int and mode['maximumHTM'] == max(costs),
             'Exact reported mode maximum')
        rows.append({'letter': letter, 'maximum': maximum, 'direction': direction,
                     'preperiodEdges': start, 'periodEdges': len(steps) - start,
                     'verifiedEdges': len(steps), 'maximumHTM': max(costs),
                     'periodHTM': sum(costs[start:]), 'totalTraceHTM': total,
                     'setupHTM': len(mode['setup'].split())})
    need(observed == expected, 'Complete mode coverage')
    maximum = max(row['maximumHTM'] for row in rows)
    need(type(data['maximumHTM']) is int and data['maximumHTM'] == maximum,
         'Exact overall maximum')
    return {'status': 'SAT', 'witnessSHA256': hashlib.sha256(raw).hexdigest(),
            'intermediateWitnessSHA256': hashlib.sha256(original_raw).hexdigest(),
            'universalFixedLetterLemma': lemma, 'modes': rows,
            'maximumCountingHTM': maximum,
            'induction': 'Every settled same-letter source can reach every required target '
                         'in at most five HTM. Replanning shortest paths preserves the premise '
                         'indefinitely; complete-state periodic examples are also replayed.',
            'limitations': 'Setup and arbitrary letter changes are outside the five-move '
                           'bound. Intermediate motion need not retain a readable display. '
                           'Global print and whole-route optimality remain UNKNOWN.'}


if __name__ == '__main__':
    print(json.dumps(validate(sys.argv[1]), indent=2))
