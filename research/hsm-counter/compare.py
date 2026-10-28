"""Replay every retained complete HSM candidate and compare one-pass cycles.

The independent physical engine supplies exact state replay and shortest target
distances. Search proposals without retained complete witnesses are not rows.
"""
import hashlib
import json
import sys
from pathlib import Path

from verify import apply, distance_engine, inverse, need, show, source_state

ROOT = Path(__file__).resolve().parent
MOVES = tuple(face + suffix for face in 'RLUDFB' for suffix in ('', '2', "'"))
LIMITS = (23, 11, 59)
CANDIDATES = ('initial', 'intermediate', 'final')


def reset_word(state, letter, shortest):
    """Find a shortest upright 00 display from this exact reached full pose."""
    word = []
    distance = shortest(state, letter, 0)
    while distance:
        for move in MOVES:
            target = apply(state, move)
            if shortest(target, letter, 0) == distance - 1:
                state = target
                word.append(move)
                distance -= 1
                break
        else:
            raise AssertionError('A shortest reset must have a descending edge')
    show(state, letter, 0)
    return ' '.join(word)


def compare(directory=ROOT / 'comparison' / 'candidates'):
    shortest, graph = distance_engine()
    candidates = []
    directory = Path(directory)
    need({path.stem for path in directory.glob('*.json')} == set(CANDIDATES),
         'Exactly all three retained complete candidates')
    for name in CANDIDATES:
        path = directory / (name + '.json')
        raw = path.read_bytes()
        witness = json.loads(raw)
        need(witness['schema'] == 'cubistry.hsm-counter'
             and type(witness['version']) is int and witness['version'] == 1
             and witness['puzzle'] == '2x2x2',
             'Exact versioned candidate model')
        source = source_state(witness['printing'])
        routes = witness['routes']
        need(len(routes) == 3 and sorted(r['letter'] for r in routes) == ['H', 'M', 'S'],
             'All H/S/M letter routes exactly once')
        rows = []
        for route in routes:
            letter = route['letter']
            words = [route['setup']] + route['increments']
            need(len(words) == 60, 'All sixty states present')
            state, states = source, []
            for value, word in enumerate(words):
                previous = state
                need(len(word.split()) == shortest(state, letter, value),
                     'Every saved forward word is shortest for its reached source')
                state = apply(state, word)
                show(state, letter, value)
                need(apply(state, inverse(word)) == previous, 'Full-frame inverse')
                states.append(state)
            cycles = {}
            for limit in LIMITS:
                reset = reset_word(states[limit], letter, shortest)
                saved = route.get(f'from{limit}To00')
                if saved is not None:
                    # Preserve the original path when it is available and valid.
                    show(apply(states[limit], saved), letter, 0)
                    need(len(saved.split()) == len(reset.split()), 'Saved reset is shortest')
                    reset = saved
                endpoint = apply(states[limit], reset)
                show(endpoint, letter, 0)
                # Reverse the complete cycle from its actual ending full pose.
                reverse_state = apply(endpoint, inverse(reset))
                need(reverse_state == states[limit], 'Full-state reset inverse')
                for value in range(limit - 1, -1, -1):
                    reverse_state = apply(reverse_state, inverse(words[value + 1]))
                    need(reverse_state == states[value], 'Full-state reverse-cycle replay')
                    show(reverse_state, letter, value)
                forward = sum(len(word.split()) for word in words[1:limit + 1])
                total = forward + len(reset.split())
                cycles[str(limit)] = {
                    'transitions': limit + 1, 'forwardHTM': forward,
                    'wrapWord': reset, 'wrapHTM': len(reset.split()),
                    'totalHTM': total, 'meanHTM': total / (limit + 1),
                    'sameFullPoseAfterWrap': endpoint == states[0],
                }
            rows.append({'letter': letter, 'setupHTM': len(route['setup'].split()),
                         'maximumIncrementHTM': max(len(w.split()) for w in words[1:]),
                         'cycles': cycles})
        aggregates = {}
        for limit in LIMITS:
            total = sum(row['cycles'][str(limit)]['totalHTM'] for row in rows)
            transitions = 3 * (limit + 1)
            aggregates[str(limit)] = {'letters': 3, 'transitions': transitions,
                                      'totalHTM': total, 'meanHTM': total / transitions}
        candidates.append({'candidate': path.stem,
                           'witnessSHA256': hashlib.sha256(raw).hexdigest(),
                           'searchTrials': witness['search']['trials'],
                           'rows': rows, 'aggregates': aggregates})
    need(bool(candidates), 'At least one retained candidate')
    return {'schema': 'cubistry.hsm-counter-comparison', 'version': 1,
            'metric': 'HTM; setup excluded; one visible 00-to-00 pass including wrap',
            'candidateScope': 'All three retained complete candidates; not all random search proposals',
            'cycleLimits': list(LIMITS), 'independentBFS': graph,
            'candidates': candidates,
            'limitations': 'Wrap can change hidden pose. Repeated cycles need replanning; '
                           'averages are not steady-state guarantees or global optima.'}


def render(report):
    lines = ['# Retained H/S/M candidate comparison', '',
             'All totals include the final wrap to 00 and exclude initial setup. '
             'HTM counts a half turn as one move. Each row is one actual full-pose '
             'replay, starting from the candidate’s saved 00 state.', '',
             'A 00–23–00 pass has 24 transitions; 00–11–00 has 12; '
             '00–59–00 has 60. Reverse replay has identical total cost.', '',
             'All three retained complete candidates are included. The initial '
             'candidate predates the 11→00 objective, the intermediate candidate '
             'used 512 combined-objective proposals, and the final candidate used '
             '4,096. Unretained random proposals are not separate verified layouts.', '',
             '| Candidate | Letter | Max increment | 00–23–00 total / mean | '
             '23→00 | 00–11–00 total / mean | 11→00 | 00–59–00 total / mean | 59→00 |',
             '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
    for candidate in report['candidates']:
        for row in candidate['rows']:
            fields = [candidate['candidate'], row['letter'], str(row['maximumIncrementHTM'])]
            for limit in LIMITS:
                cycle = row['cycles'][str(limit)]
                fields.extend([f"{cycle['totalHTM']} / {cycle['meanHTM']:.4f}", str(cycle['wrapHTM'])])
            lines.append('| ' + ' | '.join(fields) + ' |')
    lines += ['', '## Equal-weight summary across H, S, and M', '',
              'The total column sums three passes, one per letter. The mean '
              'divides by 72, 36, or 180 transitions respectively; it is not a '
              'single-letter cycle total.', '',
              '| Candidate | 3 × 00–23–00 total / mean | 3 × 00–11–00 total / mean | '
              '3 × 00–59–00 total / mean |', '| --- | ---: | ---: | ---: |']
    for candidate in report['candidates']:
        fields = [candidate['candidate']]
        for limit in LIMITS:
            aggregate = candidate['aggregates'][str(limit)]
            fields.append(f"{aggregate['totalHTM']} / {aggregate['meanHTM']:.4f}")
        lines.append('| ' + ' | '.join(fields) + ' |')
    lines += ['', 'These are single visible cycles. The wrap may leave a different '
              'hidden-corner pose from the initial 00; an application must replan '
              'subsequent cycles. No indefinitely repeatable cost or global layout '
              'optimality is asserted.', '',
              'Full reset words, exact unrounded means, source hashes, and hidden-pose '
              'flags are in [results.json](results.json). See '
              '[manifest.json](manifest.json) for provenance and reproduction.', '']
    return '\n'.join(lines)


if __name__ == '__main__':
    result = compare()
    if len(sys.argv) == 2 and sys.argv[1] == '--write':
        (ROOT / 'comparison' / 'results.json').write_text(json.dumps(result, indent=2) + '\n')
        (ROOT / 'comparison' / 'README.md').write_text(render(result))
    else:
        print(json.dumps(result, indent=2))
