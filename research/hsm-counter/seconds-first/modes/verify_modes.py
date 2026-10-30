"""Independent checker for the all-mode periods and recovery of the seconds-first print.

Only the reviewed independent seconds-first checker (``../verify.py``) and,
through it, the original integer Rodrigues engine (``../../verify.py``) are
reused. No generator, C, JavaScript, solver, or project geometry is imported.

Checks:

* the witness uses exactly the pinned seconds-first print;
* every one of the 18 own periods (H/S/M, 00-59/00-23/00-11, +1/-1) replays
  over all 24 sticker frames, closes, uses only shortest edges from the actual
  pose, and has no edge above five HTM; optionally (``--certify``) the complete
  shortest-edge graph is rebuilt and a Bellman-Ford potential proves the mean;
* every application mode follows the period the selection rule names, run
  forward or backward with inverted words, closes the full pose, shows every
  display of its range, and has no edge above five HTM;
* every saved recovery path starts on the stated display, uses only edges of at
  most five HTM (six only from a pose with no route of at most five to the next
  display), and ends on a node of the selected period; optionally
  (``--recovery-full``) the whole recovery table of a mode is recomputed.
"""
import argparse
import hashlib
import heapq
import importlib.util
import itertools
import json
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('independent_seconds_first', ROOT.parent / 'verify.py')
sf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sf)
need, turn, show, inverse = sf.need, sf.turn, sf.show, sf.inverse
LIMIT = 5
LETTERS, RANGES = 'SMH', (59, 23, 11)
EXPECTED = tuple((l, n, d) for l in LETTERS for n in RANGES for d in (1, -1))
BASE = ROOT.parent / 'witness.json'
BASE_SHA256 = 'f71d423734e3357b1f41e1ab43625d46a3e9edbf50d0bf74f0c89006309abbc3'
WITNESS_SCHEMA = 'cubistry.hsm-seconds-first-modes'
RECOVERY_SCHEMA = 'cubistry.hsm-seconds-first-recovery'


def mode_key(m):
    return m['letter'], m['maximum'], m['direction']


def with_cap(letter, cap, fn, *args):
    """Run a seconds-first checker function with a given per-letter HTM ceiling."""
    saved = dict(sf.CAP)
    sf.CAP[letter] = cap
    try:
        return fn(*args)
    finally:
        sf.CAP.clear()
        sf.CAP.update(saved)


def traverse(engine, source, mode, direction):
    """Run an own period forward, or backward with every word inverted."""
    letter, maximum = mode['letter'], mode['maximum']
    n = maximum + 1
    start = turn(source, mode['setup'])
    show(start, letter, 0)
    if direction == mode['direction']:
        words = [s['word'] for s in mode['steps']]
    else:
        words = [inverse(s['word']) for s in reversed(mode['steps'])]
    state, value, costs, wraps, nodes, seen = start, 0, [], [], [], {0}
    for word in words:
        target = (value + direction) % n
        nodes.append(engine.pose_tuple(state))
        cost = len(word.split())
        need(1 <= cost <= LIMIT, 'Every application edge is at most five HTM')
        previous, state = state, turn(state, word)
        show(state, letter, target)
        need(turn(state, inverse(word)) == previous, 'Every full physical edge inverse')
        costs.append(cost)
        if target == (0 if direction == 1 else maximum):
            wraps.append(cost)
        value = target
        seen.add(value)
    need(value == 0 and state == start, 'Exact 24-sticker closure of the application period')
    need(len(set(nodes)) == len(nodes), 'An application period visits each full pose once')
    need(seen == set(range(n)), 'Every display of the range is shown')
    return {'costs': costs, 'wraps': wraps, 'nodes': nodes}


def per_lap(mode):
    return Fraction(mode['periodHTM'], mode['periodEdges']) * (mode['maximum'] + 1)


def select(own, letter, maximum, direction):
    """The selection rule: the +1 period, unless the -1 period run the other way is strictly better."""
    primary, alternative = own[(letter, maximum, 1)], own[(letter, maximum, -1)]
    a, b = (per_lap(primary), primary['maximumHTM']), (per_lap(alternative), alternative['maximumHTM'])
    chosen = alternative if b < a else primary
    return chosen['direction']


def mode_nodes(engine, letter, maximum):
    """Every legal settled full pose that shows a display of the range (same set as certify)."""
    cubies = engine.cubies
    tw = {c: [sf.twist(engine, c, k) for k in range(24)] for c in cubies}
    legal = sum(tw[c][0] for c in cubies) % 3
    at = {c: {} for c in cubies}
    for c in cubies:
        for k in range(24):
            at[c].setdefault(engine.pose_list[c][k][0][0], []).append(k)
    goal = {}
    for c in cubies:
        for local, s in enumerate(engine.members[c]):
            for slot in range(4):
                for k in range(24):
                    f = engine.pose_list[c][k][local]
                    if f[0] == sf.FRONT[slot] and f[1] == sf.Z and (s[5] == '' or f[2] == sf.Y):
                        goal[(s[0], slot)] = k
    nodes, layer, index = [], [], {}
    free = [p for p in sf.POSITIONS if p not in sf.FRONT]
    for v in range(maximum + 1):
        for option in engine.options(letter, v):
            fixed = {engine.local[sid][0]: goal[(sid, slot)] for slot, sid in enumerate(option)}
            rest = [c for c in cubies if c not in fixed]
            for perm in itertools.permutations(free):
                for choice in itertools.product(*(at[c][p] for c, p in zip(rest, perm))):
                    poses = dict(fixed)
                    poses.update(zip(rest, choice))
                    t = tuple(poses[c] for c in cubies)
                    if sum(tw[c][t[i]] for i, c in enumerate(cubies)) % 3 == legal and t not in index:
                        index[t] = len(nodes)
                        nodes.append(t)
                        layer.append(v)
    return nodes, layer, index


def recovery_table(engine, letter, maximum, direction, period_nodes):
    """Recompute the whole recovery table: lexicographic (edges above five, steps, HTM)."""
    n = maximum + 1
    nodes, layer, index = mode_nodes(engine, letter, maximum)
    opts = [engine.options(letter, v) for v in range(n)]
    st, dist = engine.slot_trans, engine.dist
    memo = {}

    def words(lim, keys, last):
        """Canonical words of 1..lim moves after which some key is at distance 0."""
        hit = memo.get((lim, keys, last))
        if hit is not None:
            return hit
        out = []
        for m in range(18):
            f, lf = m // 3, (-1 if last < 0 else last // 3)
            if f == lf or (lf >= 0 and f == lf ^ 1 and f < lf):
                continue
            nxt = []
            for k in keys:
                b = (st[0][m][k[0]], st[1][m][k[1]], st[2][m][k[2]], st[3][m][k[3]])
                if dist[((b[0] * 24 + b[1]) * 24 + b[2]) * 24 + b[3]] <= lim - 1:
                    nxt.append(b)
            if not nxt:
                continue
            nxt = tuple(sorted(set(nxt)))
            if any(dist[((b[0] * 24 + b[1]) * 24 + b[2]) * 24 + b[3]] == 0 for b in nxt):
                out.append((m,))
            if lim > 1:
                out.extend((m, *w) for w in words(lim - 1, nxt, m))
        memo[(lim, keys, last)] = out
        return out

    trans = [engine.pose_trans[c] for c in engine.cubies]
    succ, forced, edges = [], 0, 0
    for i, t in enumerate(nodes):
        nv = (layer[i] + direction) % n
        d, _ = engine.cost(t, opts[nv])
        keys = []
        for option in opts[nv]:
            k = engine.key(t, option)
            if k is not None:
                keys.append(k)
        lim = LIMIT if d <= LIMIT else d
        forced += d > LIMIT
        best = {}
        for w in words(lim, tuple(sorted(set(keys))), -1):
            if d > LIMIT and len(w) != d:
                continue
            e = t
            for m in w:
                e = tuple(trans[j][m][e[j]] for j in range(len(trans)))
            need(e in index, 'Every edge endpoint is a display node of the range')
            j = index[e]
            best[j] = min(best.get(j, 99), len(w))
        succ.append(tuple(best.items()))
        edges += len(best)
    pred = [[] for _ in nodes]
    for i, out in enumerate(succ):
        for j, w in out:
            pred[j].append((i, w))
    cost = [None] * len(nodes)
    heap = []
    for t in period_nodes:
        heap.append(((0, 0, 0), index[t]))
    heapq.heapify(heap)
    while heap:
        c, v = heapq.heappop(heap)
        if cost[v] is not None:
            continue
        cost[v] = c
        for s, w in pred[v]:
            if cost[s] is None:
                heapq.heappush(heap, ((c[0] + (w > LIMIT), c[1] + 1, c[2] + w), s))
    need(all(c is not None for c in cost), 'Every settled pose of the mode reaches the period')
    steps, sixes = {}, {}
    for c in cost:
        steps[str(c[1])] = steps.get(str(c[1]), 0) + 1
        sixes[str(c[0])] = sixes.get(str(c[0]), 0) + 1
    return {'graphNodes': len(nodes), 'edgesAtMostLimitOrForced': edges,
            'poseWithoutEdgeAtMostLimit': forced, 'unreachable': 0,
            'stepsHistogram': dict(sorted(steps.items(), key=lambda kv: int(kv[0]))),
            'edgesAboveLimitHistogram': dict(sorted(sixes.items(), key=lambda kv: int(kv[0]))),
            'maximumSteps': max(c[1] for c in cost),
            'meanSteps': f'{sum(c[1] for c in cost) / len(cost):.4f}',
            'maximumRecoveryHTM': max(c[2] for c in cost)}


def check_recovery(engine, source, rec, app, nodes, certificate):
    letter, maximum, direction = mode_key(rec)
    n = maximum + 1
    need((rec['sourceDirection'], rec['traversal']) == (app['sourceDirection'], app['traversal']),
         'Recovery uses the application period')
    period = set(nodes)
    need(rec['periodNodes'] == len(period), 'Honest period node count')
    hist = rec['stepsHistogram']
    need(sum(hist.values()) == rec['graphNodes'] and hist.get('0') == len(period) and rec['unreachable'] == 0,
         'Recovery histogram covers every settled pose; only period nodes need no step')
    need(rec['maximumSteps'] == max(int(k) for k in hist), 'Honest maximum step count')
    need(sum(rec['edgesAboveLimitHistogram'].values()) == rec['graphNodes'], 'Honest edge-above-limit histogram')
    need(set(rec['edgesAboveLimitHistogram']) <= {'0', '1'}, 'At most one edge above five on any recovery')
    need(rec['edgesAboveLimitHistogram'].get('1', 0) == rec['poseWithoutEdgeAtMostLimit'],
         'An edge above five is used only from a pose that has no edge of at most five')
    if certificate is not None:
        above = sum(v for c, v in certificate['costHistogram'].items() if int(c) > LIMIT)
        need(certificate['graphNodes'] == rec['graphNodes'] and above == rec['poseWithoutEdgeAtMostLimit'],
             'Forced-pose count equals the independent shortest-edge cost histogram')
    samples = rec['samples']
    need(type(samples) is list and len(samples) >= 2, 'Recovery samples present')
    need(samples[0]['steps'] == rec['maximumSteps'], 'First sample attains the maximum step count')
    worst_edge, lengths = 0, []
    for sample in samples:
        state = turn(source, sample['setupFromSolved'])
        value = sample['fromValue']
        need(type(value) is int and 0 <= value < n, 'Sample starts on a display of the range')
        show(state, letter, value)
        need(len(sample['words']) == sample['steps'] >= 1, 'Honest sample step count')
        for i, word in enumerate(sample['words']):
            need(engine.pose_tuple(state) not in period, 'Recovery stops at the first period node')
            target = (value + direction) % n
            cost = len(word.split())
            shortest = engine.shortest(state, letter, target)
            need(cost <= LIMIT or (cost == shortest and shortest > LIMIT),
                 'Recovery edge at most five HTM, or a shortest edge from a pose with no route of five')
            state = turn(state, word)
            show(state, letter, target)
            worst_edge = max(worst_edge, cost)
            value = target
        need(engine.pose_tuple(state) in period, 'Recovery ends on a node of the application period')
        lengths.append(sample['steps'])
    return {'letter': letter, 'maximum': maximum, 'direction': direction, 'samplesReplayed': len(samples),
            'sampleSteps': lengths, 'sampleWorstEdgeHTM': worst_edge,
            'maximumSteps': rec['maximumSteps'], 'poseWithoutEdgeAtMostLimit': rec['poseWithoutEdgeAtMostLimit']}


def validate(path, recovery_path, certify_modes=(), recovery_full=()):
    raw = Path(path).read_bytes()
    witness = json.loads(raw)
    need(witness['schema'] == WITNESS_SCHEMA and type(witness['version']) is int and witness['version'] == 1,
         'Exact all-mode witness schema')
    base_raw = BASE.read_bytes()
    need(hashlib.sha256(base_raw).hexdigest() == BASE_SHA256, 'Pinned seconds-first witness')
    base = json.loads(base_raw)
    need(witness['printing'] == base['printing'] and witness['printCode'] == base['printCode'],
         'Exactly the seconds-first print, unchanged')
    need(witness['edgeLimitHTM'] == LIMIT and witness['universalArbitrarySourceHTM'] == 6, 'Stated limits')
    source = sf.source_state(witness['printing'])
    engine = sf.Engine(source)
    need(engine.graph_max == 7, 'Single-target four-corner graph diameter seven')
    modes = witness['modes']
    need([mode_key(m) for m in modes] == list(EXPECTED), 'Exactly the 18 own periods in order')
    own, rows, certificates = {}, [], {}
    for mode in modes:
        need(mode['htmCap'] in (5, 6) and mode['maximumHTM'] <= LIMIT, 'Own period within five HTM')
        row, _, _ = with_cap(mode['letter'], LIMIT, sf.replay_mode, engine, mode, source)
        row['htmCap'] = mode['htmCap']
        rows.append(row)
        own[mode_key(mode)] = mode
        if mode_key(mode) in certify_modes:
            certificates[mode_key(mode)] = with_cap(mode['letter'], mode['htmCap'], sf.certify, engine, mode)
    app_rows, app_nodes = [], {}
    apps = witness['appModes']
    need([mode_key(m) for m in apps] == list(EXPECTED), 'Exactly the 18 application modes in order')
    for app in apps:
        letter, maximum, direction = mode_key(app)
        chosen = select(own, letter, maximum, direction)
        need(app['sourceDirection'] == chosen, 'Selection rule')
        need(app['traversal'] == ('forward' if chosen == direction else 'inverse'), 'Honest traversal')
        src = own[(letter, maximum, chosen)]
        run = traverse(engine, source, src, direction)
        costs = run['costs']
        need(app['periodHTM'] == sum(costs) and app['periodEdges'] == len(costs)
             and app['maximumHTM'] == max(costs) and Fraction(app['perLapHTM']) == per_lap(src),
             'Honest application period metrics')
        app_nodes[(letter, maximum, direction)] = run['nodes']
        app_rows.append({'letter': letter, 'maximum': maximum, 'direction': direction,
                         'sourceDirection': chosen, 'traversal': app['traversal'],
                         'periodEdges': len(costs), 'laps': len(costs) // (maximum + 1),
                         'periodHTM': sum(costs), 'perLapHTM': str(per_lap(src)), 'maximumHTM': max(costs),
                         'wrapHTM': {'minimum': min(run['wraps']), 'maximum': max(run['wraps'])},
                         'setupHTM': len(src['setup'].split()),
                         'certifiedClass': 'shortest-edge recurrent schedules of this direction'
                         if chosen == direction else 'inverses of shortest-edge recurrent schedules of the '
                                                     'opposite direction'})
    rraw = Path(recovery_path).read_bytes()
    recovery = json.loads(rraw)
    need(recovery['schema'] == RECOVERY_SCHEMA and recovery['version'] == 1
         and recovery['printCode'] == witness['printCode'] and recovery['edgeLimitHTM'] == LIMIT,
         'Exact recovery schema')
    need([mode_key(m) for m in recovery['modes']] == list(EXPECTED), 'Recovery for all 18 application modes')
    rec_rows, full = [], []
    for rec, app in zip(recovery['modes'], apps):
        key = mode_key(rec)
        cert = certificates.get(key)
        rec_rows.append(check_recovery(engine, source, rec, app, app_nodes[key], cert))
        if key in recovery_full:
            table = recovery_table(engine, *key, app_nodes[key])
            claimed = {k: rec[k] for k in table}
            claimed['meanSteps'] = f"{rec['meanSteps']:.4f}"
            need(table == claimed, 'Independent full recovery table equals the generator report')
            full.append({'letter': key[0], 'maximum': key[1], 'direction': key[2], **table})
    return {'status': 'SAT', 'witnessSHA256': hashlib.sha256(raw).hexdigest(),
            'recoverySHA256': hashlib.sha256(rraw).hexdigest(), 'baseWitnessSHA256': BASE_SHA256,
            'printCode': witness['printCode'], 'edgeLimitHTM': LIMIT,
            'ownPeriods': rows, 'applicationModes': app_rows,
            'optimalityCertificates': [certificates[k] for k in EXPECTED if k in certificates],
            'recovery': rec_rows, 'recoveryRecomputed': full,
            'scope': 'Each application period is closed over all 24 sticker frames and may repeat '
                     'indefinitely; every edge is at most five HTM.'}


def parse_modes(text):
    if text == 'all':
        return EXPECTED
    return tuple((p.split(':')[0], int(p.split(':')[1]), int(p.split(':')[2])) for p in text.split(',') if p)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('witness', nargs='?', default=str(ROOT / 'witness.json'))
    parser.add_argument('recovery', nargs='?', default=str(ROOT / 'recovery.json'))
    parser.add_argument('--certify', default='', help='Comma-separated letter:maximum:direction, or "all"')
    parser.add_argument('--recovery-full', default='', help='Comma-separated letter:maximum:direction, or "all"')
    args = parser.parse_args()
    print(json.dumps(validate(args.witness, args.recovery, parse_modes(args.certify),
                              parse_modes(args.recovery_full)), indent=2))
