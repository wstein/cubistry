"""Independent physical replay and exhaustive shortest-distance verification.

Uses the prior Python physical replayer, never the JavaScript geometry or table.
The distance graph is rebuilt from signed normals and tangent vectors.
"""
import hashlib
from functools import cache
import importlib.util
import itertools
import json
from pathlib import Path
import sys
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('physical', HERE.parent / 'verify.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)


@cache
def build_distances():
    axes = sorted({tuple(sign if i == axis else 0 for i in range(3))
                   for axis in range(3) for sign in (-1, 1)})
    frames = [(n, u) for n in axes for u in axes if P.dot(n, u) == 0]
    lookup = {f: i for i, f in enumerate(frames)}
    words = [f + suffix for f in P.MOVES for suffix in ('', '2', "'")]
    transitions = [[[0] * 24 for _ in words] for _ in range(4)]
    for slot, front in enumerate(P.FRONT):
        for r, (n, u) in enumerate(frames):
            right = P.cross(u, n)
            pos = tuple(front[0] * right[i] + front[1] * u[i] + n[i] for i in range(3))
            for move, word in enumerate(words):
                axis, layer, direction = P.MOVES[word[0]]
                turns = (2 if word.endswith('2') else -1 if word.endswith("'") else 1) * direction % 4
                new = (P.rotate_times(n, axis, turns), P.rotate_times(u, axis, turns)) if pos[axis] == layer else (n, u)
                transitions[slot][move][r] = lookup[new]
    def encode(a):
        return ((a[0] * 24 + a[1]) * 24 + a[2]) * 24 + a[3]
    goal = lookup[((0, 0, 1), (0, 1, 0))]
    origin = encode([goal] * 4)
    dist = bytearray([255]) * 24**4
    dist[origin] = 0
    queue = [origin]
    for k in queue:
        a, b, c, d = k // 13824, k // 576 % 24, k // 24 % 24, k % 24
        for move in range(18):
            nxt = ((transitions[0][move][a] * 24 + transitions[1][move][b]) * 24
                   + transitions[2][move][c]) * 24 + transitions[3][move][d]
            if dist[nxt] == 255:
                dist[nxt] = dist[k] + 1
                queue.append(nxt)
    P.require(len(queue) == 8 * 7 * 6 * 5 * 3**4, 'All four-corner poses must be covered')
    return dist, lookup, encode


def shortest(state, tick, dist, lookup, encode):
    digits = f'{tick // 6:02d}{tick % 6 * 10:02d}'
    candidates = []
    for slot, digit in enumerate(digits):
        front = P.FRONT[slot]
        candidates.append([s for s in state if s[5] == digit
                           and (P.dot(s[2], s[4]), P.dot(s[2], P.cross(s[4], s[3]))) == (front[1], front[0])])
    best = 255
    for selected in itertools.product(*candidates):
        if len({s[1] for s in selected}) != 4:
            continue
        best = min(best, dist[encode([lookup[(s[3], s[4])] for s in selected])])
    P.require(best != 255, 'Display must have a reachable matching')
    return best


def check(path, setup_path=None):
    started = time.monotonic()
    data = json.loads(Path(path).read_text())
    P.require(data['schema'] == 'cubistry.timer-2x2-move-optimization' and data['version'] == 1, 'Schema')
    original = json.loads((HERE.parent / 'witness.json').read_text())
    # Existing verifier validates all source geometry and the prior certificate.
    P.check(HERE.parent / 'witness.json')
    dist, lookup, encode = build_distances()
    histogram = {str(d): dist.count(d) for d in sorted(set(dist)) if d != 255}
    P.require(data['bfs']['states'] == 136080 and data['bfs']['histogram'] == histogram, 'Independent BFS census')
    setups = json.loads(Path(setup_path or HERE / 'setups.json').read_text())
    P.require(setups['candidateSHA256'] == hashlib.sha256(Path(path).read_bytes()).hexdigest(), 'Setup certificate binds exact candidate')
    results = []
    P.require([r['ticks'] for r in data['runs']] == [120, 360], 'Both requested ranges')
    for run in data['runs']:
        ticks = run['ticks']
        P.require(run['maxSeconds'] == (ticks - 1) * 10, 'Range metadata')
        P.require(len(run['printing']) == 24, '24 stickers')
        for old, new in zip(original['printing'], run['printing']):
            P.require({k: v for k, v in old.items() if k != 'image'} == {k: v for k, v in new.items() if k != 'image'}, 'Unchanged physical print geometry')
            P.require(type(new['image']) is str and len(new['image']) == 1 and new['image'] in '0123456789', 'Digit identity')
        baseline_print = [dict(s) for s in original['printing']]
        if ticks == 120:
            for sticker in baseline_print:
                if sticker['slot'] == 0:
                    sticker['image'] = str(int(sticker['image']) % 2)
        baseline_state = tuple((s['id'], s['cubie'], tuple(s['p']), tuple(s['n']), tuple(s['up']), s['image']) for s in baseline_print)
        baseline_words = run['baselineDirect']['words']
        P.require(len(baseline_words) == ticks, 'Baseline coverage')
        for tick, word in enumerate(baseline_words):
            baseline_state = P.apply(baseline_state, word)
            P.show(baseline_state, tick // 6, tick % 6 * 10)
        baseline_lengths = [len(w.split()) for w in baseline_words[1:]]
        P.require(run['baselineDirect']['lengths'] == baseline_lengths, 'Baseline edge counts')
        P.require(run['baselineDirect']['max'] == max(baseline_lengths) and run['baselineDirect']['total'] == sum(baseline_lengths), 'Baseline summary')
        hub_lengths = [len(original['witnesses'][tick-1]['word'].split()) + len(original['witnesses'][tick]['word'].split()) for tick in range(1, ticks)]
        P.require(run['legacyHub']['lengths'] == hub_lengths and run['legacyHub']['total'] == sum(hub_lengths) and run['legacyHub']['max'] == max(hub_lengths), 'Legacy baseline summary')
        source = tuple((s['id'], s['cubie'], tuple(s['p']), tuple(s['n']), tuple(s['up']), s['image']) for s in run['printing'])
        words = run['optimized']['words']
        P.require(len(words) == ticks, 'Every display and initial setup')
        states, lengths = [], []
        state = source
        for tick, word in enumerate(words):
            minimum = shortest(state, tick, dist, lookup, encode)
            length = len(word.split())
            P.require(length == minimum, 'Increment or setup is a shortest route to any matching display')
            state = P.apply(state, word)
            P.show(state, tick // 6, tick % 6 * 10)
            states.append(state)
            if tick:
                lengths.append(length)
        setup = next(s for s in setups['runs'] if s['ticks'] == ticks)
        P.require(P.apply(source, setup['maximumWord']) == states[-1], 'Direct maximum setup must reach exact canonical endpoint')
        P.require(P.apply(source, setup['zeroWord']) == states[0], 'Direct zero setup')
        P.require(setup['maximumHTM'] == len(setup['maximumWord'].split()), 'Maximum setup count')
        reverse_shortest = []
        for tick in range(ticks - 1, 0, -1):
            reverse_shortest.append(shortest(state, tick - 1, dist, lookup, encode))
            state = P.apply(state, P.inverse(words[tick]))
            P.require(state == states[tick - 1], 'Decrement restores the exact previous full state')
            P.show(state, (tick - 1) // 6, (tick - 1) % 6 * 10)
        P.require(P.apply(state, P.inverse(words[0])) == source, 'Setup inverse restores print source')
        P.require(run['optimized']['lengths'] == lengths, 'Per-transition counts')
        P.require(run['optimized']['max'] == max(lengths) and run['optimized']['total'] == sum(lengths), 'Summary counts')
        results.append(dict(ticks=ticks,incrementTransitions=ticks-1,decrementTransitions=ticks-1,
                            incrementShortestVerified=ticks-1,setupHTM=len(words[0].split()),
                            maxHTM=max(lengths),totalHTM=sum(lengths),
                            decrementShortestToAnyDisplay=sum(a == b for a, b in zip(reversed(lengths), reverse_shortest)),
                            decrementAlternativeMinimumTotalHTM=sum(reverse_shortest)))
    return dict(status='SAT',shortestTransitionClaim='All increment edges are exact shortest paths from their actual starting state to any matching next display. Reverse words restore the canonical prior state; they need not be shortest to any prior display.',
                globalPrintOptimality='UNKNOWN',bfsStates=136080,bfsHistogram=histogram,runs=results,
                candidateSHA256=hashlib.sha256(Path(path).read_bytes()).hexdigest(),runtimeSeconds=round(time.monotonic()-started,3))


if __name__ == '__main__':
    print(json.dumps(check(sys.argv[1] if len(sys.argv)>1 else HERE / 'optimized.json', sys.argv[2] if len(sys.argv)>2 else None), indent=2))
