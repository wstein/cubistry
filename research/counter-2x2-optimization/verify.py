"""Independent proof for fixed-title 00–99 counter print optimization.

The original Python sticker engine replays every move. The independent timer
verifier's exhaustive four-corner BFS supplies exact partial-display distances.
Neither checker imports JavaScript geometry or the optimizer distance table.
"""
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import sys
import time

HERE = Path(__file__).resolve().parent

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

P = load('counter_physics', HERE / 'baseline-verify.py')
T = load('independent_distances', HERE.parent / 'timer-2x2/optimization/verify.py')


def shortest(state, value, dist, lookup, encode):
    images = ['title-left', 'title-right', str(value // 10), str(value % 10)]
    candidates = []
    for slot, image in enumerate(images):
        front = P.FRONT[slot]
        candidates.append([s for s in state if s[5] == image
                           and (T.P.dot(s[2], s[4]), T.P.dot(s[2], T.P.cross(s[4], s[3]))) == (front[1], front[0])])
    best = 255
    for selected in itertools.product(*candidates):
        if len({s[1] for s in selected}) != 4:
            continue
        best = min(best, dist[encode([lookup[(s[3], s[4])] for s in selected])])
    P.require(best != 255, 'A reachable distinct-cubie matching is required')
    return best


def check(path, setup_path=None):
    started = time.monotonic()
    raw = Path(path).read_bytes()
    data = json.loads(raw)
    P.require(data['schema'] == 'cubistry.counter-2x2-move-optimization' and data['version'] == 1, 'Schema')
    baseline = json.loads((HERE / 'baseline-witness.json').read_text())
    P.check(HERE / 'baseline-witness.json')
    dist, lookup, encode = T.build_distances()
    histogram = {str(d): dist.count(d) for d in sorted(set(dist)) if d != 255}
    P.require(data['bfs']['states'] == 136080 and data['bfs']['histogram'] == histogram, 'Independent BFS census')
    P.require(len(data['runs']) == 1 and data['runs'][0]['ticks'] == 100, 'Exactly values 00 through 99')
    run = data['runs'][0]
    P.require(run['maximumValue'] == 99, 'Maximum value')
    P.require(len(run['printing']) == 24, '24 fixed stickers')
    for old, new in zip(baseline['printing'], run['printing']):
        P.require({k:v for k,v in old.items() if k!='image'} == {k:v for k,v in new.items() if k!='image'}, 'Fixed cubie and upright geometry')
        if old['slot'] < 2:
            P.require(old == new, 'Title fragments and their source frames remain fixed')
        else:
            P.require(type(new['image']) is str and len(new['image']) == 1 and new['image'] in '0123456789', 'Single permanent digit')
    source = tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in run['printing'])
    words = run['optimized']['words']
    P.require(len(words) == 100, 'Every value including setup')
    state = source
    states, lengths = [], []
    for value, word in enumerate(words):
        P.require(len(word.split()) == shortest(state,value,dist,lookup,encode), 'Exact shortest increment to any matching display')
        state = P.apply(state,word)
        P.show(state,value,True)
        states.append(state)
        if value:
            lengths.append(len(word.split()))
    setups = json.loads(Path(setup_path or HERE/'setups.json').read_text())
    P.require(setups['candidateSHA256'] == hashlib.sha256(raw).hexdigest(), 'SHA-bound initialization')
    setup = setups['runs'][0]
    P.require(setup['ticks'] == 100, 'Setup range')
    P.require(P.apply(source,setup['maximumWord']) == states[-1], 'Direct exact 99 setup')
    P.require(P.apply(source,setup['zeroWord']) == states[0], 'Direct exact 00 setup')
    P.require(setup['maximumHTM'] == len(setup['maximumWord'].split()), 'Setup move count')
    reverse_minima = []
    for value in range(99,0,-1):
        reverse_minima.append(shortest(state,value-1,dist,lookup,encode))
        state = P.apply(state,P.inverse(words[value]))
        P.show(state,value-1,True)
        P.require(state == states[value-1], 'Reverse restores all 24 sticker frames')
    P.require(P.apply(state,P.inverse(words[0])) == source, 'Initial setup inverse')
    P.require(run['optimized']['lengths'] == lengths and run['optimized']['total'] == sum(lengths) and run['optimized']['max'] == max(lengths), 'Optimized counts')
    baseline_state = tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in baseline['printing'])
    baseline_words = run['baselineDirect']['words']
    P.require(len(baseline_words) == 100, 'Baseline coverage')
    for value, word in enumerate(baseline_words):
        baseline_state = P.apply(baseline_state,word)
        P.show(baseline_state,value,True)
    base_lengths = [len(w.split()) for w in baseline_words[1:]]
    P.require(run['baselineDirect']['lengths'] == base_lengths and run['baselineDirect']['total'] == sum(base_lengths) and run['baselineDirect']['max'] == max(base_lengths), 'Direct baseline statistics')
    hub = [len(baseline['witnesses'][v-1]['word'].split())+len(baseline['witnesses'][v]['word'].split()) for v in range(1,100)]
    P.require(run['legacyHub']['lengths'] == hub and run['legacyHub']['total'] == sum(hub) and run['legacyHub']['max'] == max(hub), 'Legacy hub statistics')
    return dict(status='SAT',values=100,incrementEdgesVerified=99,decrementEdgesVerified=99,
                incrementShortestVerified=99,shortestToAnyPriorDisplayInReverse=sum(a==b for a,b in zip(reversed(lengths),reverse_minima)),
                reverseAlternativeMinimumTotal=sum(reverse_minima),maximumHTM=max(lengths),totalHTM=sum(lengths),
                bfsStates=136080,bfsHistogram=histogram,titleImagesFixed=True,
                titleContinuouslyReadableDuringMoves=False,globalPrintOptimality='UNKNOWN',
                candidateSHA256=hashlib.sha256(raw).hexdigest(),runtimeSeconds=round(time.monotonic()-started,3))


if __name__ == '__main__':
    print(json.dumps(check(sys.argv[1] if len(sys.argv)>1 else HERE/'optimized.json',
                           sys.argv[2] if len(sys.argv)>2 else None),indent=2))
