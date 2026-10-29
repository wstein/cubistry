"""Independent seconds-first H/S/M checker and recurrent-optimality certifier.

Only the earlier independent integer Rodrigues engine (``../verify.py``) is
reused. No generator, C, JavaScript, solver, or project geometry is imported.
Every sticker frame is replayed through every saved route. Optionally the
complete shortest-edge counting graph is rebuilt and a Bellman-Ford potential
check proves that no recurrent schedule beats the saved period mean.
"""
import argparse
import hashlib
import importlib.util
import itertools
import json
import sys
from collections import deque
from fractions import Fraction
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
Z, Y = (0, 0, 1), (0, 1, 0)
EXPECTED_MODES = (('S', 59, 1), ('S', 59, -1), ('M', 59, 1), ('M', 59, -1),
                  ('H', 23, 1), ('H', 23, -1), ('H', 11, 1), ('H', 11, -1))
CAP = {'S': 6, 'M': 5, 'H': 6}
APP_PRINT = ROOT.parent / 'blank' / 'witness.json'
APP_PRINT_SHA256 = '13eea2a1ad88561775158a70633b80e25d06f883e42d44aafb4e6808699be47b'


def kind(sticker):
    """Glyph kind: blank, letter, tens digit, or units digit (by upright slot)."""
    image, slot = sticker[5], sticker[6]
    if image == '':
        return ('blank',)
    if image in 'HSM':
        need(slot == 1, 'Letters are upright only upper-right')
        return ('letter', image)
    need(slot in (2, 3), 'Digits are upright only lower-left or lower-right')
    if slot == 2:
        need(image in '012345', 'Tens glyph range')
    return ('tens' if slot == 2 else 'units', image)


def source_state(printing):
    need(type(printing) is list and len(printing) == 24, 'Exactly 24 immutable stickers')
    need(all(type(s['id']) is int and s['id'] == i and type(s['cubie']) is int
             for i, s in enumerate(printing)), 'Ordered unique physical identities')
    observed, groups, kinds = set(), {}, set()
    for s in printing:
        for field in ('p', 'n', 'up'):
            need(type(s[field]) is list and len(s[field]) == 3
                 and all(type(v) is int for v in s[field]), 'Integral physical frame')
        p, n, up = (tuple(s[k]) for k in ('p', 'n', 'up'))
        need(p in POSITIONS and n in AXES and up in AXES
             and dot(p, n) == 1 and dot(n, up) == 0, 'Outward tangent sticker frame')
        need(type(s['image']) is str and (s['image'] == '' or len(s['image']) == 1
                                         and s['image'] in '0123456789HSM'), 'Fixed glyph or real blank')
        need(type(s['slot']) is int and 0 <= s['slot'] < 4, 'Integral upright slot class')
        if s['image']:
            need((dot(p, up), dot(p, cross(up, n)))
                 == (FRONT[s['slot']][1], FRONT[s['slot']][0]), 'Exact nonblank upright slot class')
        else:
            need(s['slot'] == 0, 'Blank artwork is used only upper-left')
        observed.add((p, n))
        groups.setdefault(s['cubie'], []).append(s)
    need(observed == {(p, n) for p in POSITIONS for n in AXES if dot(p, n) == 1},
         'Complete 24-facelet lattice')
    need(sorted(groups) == list(range(8)) and all(len(g) == 3
         and len({tuple(s['p']) for s in g}) == 1 for g in groups.values()), 'Eight rigid corners')
    need(len({tuple(g[0]['p']) for g in groups.values()}) == 8, 'Eight distinct body positions')
    state = tuple((s['id'], s['cubie'], tuple(s['p']), tuple(s['n']), tuple(s['up']), s['image'], s['slot'])
                  for s in printing)
    for s in state:
        kinds.add(kind(s))
    required = {('blank',)} | {('letter', c) for c in 'HSM'} | {('tens', str(d)) for d in range(6)} \
        | {('units', str(d)) for d in range(10)}
    need(required <= kinds, 'Every blank, letter, tens, and units glyph is printed')
    return state


def strip(state):
    """Physics engine view of a sticker state (slot class is immutable metadata)."""
    return tuple(s[:6] for s in state)


def turn(state, word):
    slots = {s[0]: s[6] for s in state}
    return tuple((*s, slots[s[0]]) for s in apply(strip(state), word))


def show(state, letter, value):
    expected = ['', letter, *f'{value:02d}']
    for p, image in zip(FRONT, expected):
        faces = [s for s in state if s[2] == p and s[3] == Z]
        need(len(faces) == 1 and faces[0][5] == image, 'Exact real-blank/fixed-glyph display')
        if image:
            need(faces[0][4] == Y, 'Nonblank glyph upright')


class Engine:
    """Independent four-sticker distance table plus a corner-pose replay model."""

    def __init__(self, source):
        self.source = source
        # Four slot classes: orbit of the upright target frame of each front cell.
        self.slot_maps, self.slot_trans = [], []
        for slot, position in enumerate(FRONT):
            poses = [(position, Z, Y)]
            lookup = {poses[0]: 0}
            for pose in poses:
                for move in MOVES:
                    target = apply(((0, 0, *pose, '0'),), move)[0][2:5]
                    if target not in lookup:
                        lookup[target] = len(poses)
                        poses.append(target)
            need(len(poses) == 24, 'Complete single-corner orbit')
            self.slot_trans.append(tuple(tuple(lookup[apply(((0, 0, *pose, '0'),), move)[0][2:5]]
                                               for pose in poses) for move in MOVES))
            # A rigid corner frame is fixed by position and normal; blank up is free.
            self.slot_maps.append(({pose: i for i, pose in enumerate(poses)},
                                   {pose[:2]: i for i, pose in enumerate(poses)}))
        dist = bytearray([255]) * 24 ** 4
        dist[0] = 0
        queue = deque([(0, 0, 0, 0)])
        tr = self.slot_trans
        while queue:
            a = queue.popleft()
            d = dist[((a[0] * 24 + a[1]) * 24 + a[2]) * 24 + a[3]]
            for m in range(18):
                b = (tr[0][m][a[0]], tr[1][m][a[1]], tr[2][m][a[2]], tr[3][m][a[3]])
                k = ((b[0] * 24 + b[1]) * 24 + b[2]) * 24 + b[3]
                if dist[k] == 255:
                    dist[k] = d + 1
                    queue.append(b)
        reached = sum(1 for v in dist if v != 255)
        need(reached == 8 * 7 * 6 * 5 * 3 ** 4 == 136080, 'Every ordered four-corner pose covered')
        self.dist = dist
        self.graph_max = max(v for v in dist if v != 255)
        # Corner bodies: 24 rigid poses each, as tuples of their three sticker frames.
        self.cubies = sorted({s[1] for s in source})
        self.members = {c: [s for s in source if s[1] == c] for c in self.cubies}
        self.pose_list, self.pose_index, self.pose_trans = {}, {}, {}
        for c in self.cubies:
            body = tuple(s[:6] for s in self.members[c])
            frames = [tuple(s[2:5] for s in body)]
            lookup = {frames[0]: 0}
            bodies = [body]
            for b in bodies:
                for move in MOVES:
                    nb = apply(b, move)
                    f = tuple(s[2:5] for s in nb)
                    if f not in lookup:
                        lookup[f] = len(frames)
                        frames.append(f)
                        bodies.append(nb)
            need(len(frames) == 24, 'Each rigid corner has 24 poses')
            self.pose_list[c], self.pose_index[c] = frames, lookup
            self.pose_trans[c] = tuple(tuple(lookup[tuple(s[2:5] for s in apply(bodies[k], move))]
                                             for k in range(24)) for move in MOVES)
        # Slot-orbit index of every sticker for every pose of its corner.
        self.slot_index = {}
        for c in self.cubies:
            for local, s in enumerate(self.members[c]):
                k_slot = s[6]
                full, partial = self.slot_maps[k_slot]
                row = []
                for frame in self.pose_list[c]:
                    f = frame[local]
                    row.append(partial.get(f[:2]) if s[5] == '' else full.get(f))
                self.slot_index[s[0]] = row
        self.local = {s[0]: (s[1], i) for c in self.cubies for i, s in enumerate(self.members[c])}

    def pose_tuple(self, state):
        frames = {c: [None] * 3 for c in self.cubies}
        for s in state:
            c, i = self.local[s[0]]
            frames[c][i] = s[2:5]
        return tuple(self.pose_index[c][tuple(frames[c])] for c in self.cubies)

    def options(self, letter, value):
        wanted = [('blank',), ('letter', letter), ('tens', str(value // 10)), ('units', str(value % 10))]
        lists = [[s for s in self.source if kind(s) == w] for w in wanted]
        result = []
        for chosen in itertools.product(*lists):
            if len({s[1] for s in chosen}) == 4:
                result.append(tuple(s[0] for s in chosen))
        need(bool(result), 'Some distinct physical corner selection exists')
        return result

    def key(self, poses, option):
        idx = []
        for sid in option:
            c, _ = self.local[sid]
            v = self.slot_index[sid][poses[c]]
            if v is None:
                return None
            idx.append(v)
        return tuple(idx)

    def cost(self, poses, opts):
        best, keys = 255, []
        for option in opts:
            k = self.key(poses, option)
            if k is None:
                continue
            d = self.dist[((k[0] * 24 + k[1]) * 24 + k[2]) * 24 + k[3]]
            keys.append((d, k))
            best = min(best, d)
        need(best < 255, 'Reachable display')
        return best, tuple(k for d, k in keys if d == best)

    def shortest(self, state, letter, value):
        return self.cost(self.pose_tuple(state), self.options(letter, value))[0]


def blank_twist_distances(engine):
    """Multi-root table: a fully blank upper-left corner may sit in any twist."""
    tr = engine.slot_trans
    full, partial = engine.slot_maps[0]
    roots = [i for (p, n), i in partial.items() if p == FRONT[0]]
    need(len(roots) == 3, 'Three twists of the upper-left corner')
    dist = {(r, 0, 0, 0): 0 for r in roots}
    queue = deque(dist)
    while queue:
        a = queue.popleft()
        for m in range(18):
            b = tuple(tr[s][m][a[s]] for s in range(4))
            if b not in dist:
                dist[b] = dist[a] + 1
                queue.append(b)
    need(len(dist) == 136080, 'Complete blank-twist four-corner graph')
    return dist, roots


def physical_floor(engine):
    """Print-independent minimum HTM of one display change, by edge type.

    Assumes the letter, the tens glyph, and the blank corner (any twist) must
    stay where they are, i.e. no duplicate S, no duplicate tens glyph, and all
    blank stickers on one fully blank corner. Only the units cell changes on a
    units-only edge; tens and units both change on a decade edge.
    """
    dist, roots = blank_twist_distances(engine)
    positions = [{i: pose[0] for i, pose in enumerate(sorted(engine.slot_maps[s][0], key=engine.slot_maps[s][0].get))}
                 for s in range(4)]
    units = {}
    for q3 in range(24):
        p3 = positions[3][q3]
        if q3 == 0 or p3 in FRONT[:3]:
            continue
        d = min(dist[(r, 0, 0, q3)] for r in roots)
        units[d] = units.get(d, 0) + 1
    decade = {}
    for q2, q3 in itertools.product(range(24), repeat=2):
        p2, p3 = positions[2][q2], positions[3][q3]
        if q2 == 0 or p2 == p3 or {p2, p3} & {FRONT[0], FRONT[1]}:
            continue
        d = min(dist[(r, 0, q2, q3)] for r in roots)
        decade[d] = decade.get(d, 0) + 1
    floor_units, floor_decade = min(units), min(decade)
    return {'unitsOnlyEdgeHistogram': dict(sorted(units.items())),
            'decadeEdgeHistogram': dict(sorted(decade.items())),
            'unitsOnlyEdgeMinimumHTM': floor_units, 'decadeEdgeMinimumHTM': floor_decade,
            'unitsCornerTwistedInPlaceHTM': min(dist[(r, 0, 0, q)] for r in roots for q in range(1, 24)
                                                if positions[3][q] == FRONT[3]),
            'sLapLowerBoundHTM': 54 * floor_units + 6 * floor_decade,
            'assumptions': 'single S sticker, single sticker per tens digit, every blank on one fully '
                           'blank corner; any route, shortest or not, recurrent or not'}


def replay_mode(engine, mode, source):
    letter, maximum, direction = (mode[k] for k in ('letter', 'maximum', 'direction'))
    need(type(maximum) is int and type(direction) is int, 'Integral range and direction')
    state = turn(source, mode['setup'])
    show(state, letter, 0)
    frames = mode['periodStartFrames']
    need(type(frames) is list and len(frames) == 24
         and [f['id'] for f in frames] == list(range(24)), 'Explicit 24-sticker period start pose')
    need(all((tuple(f['p']), tuple(f['n']), tuple(f['up'])) == s[2:5] for f, s in zip(frames, state)),
         'Saved period start pose equals the replayed setup pose for every sticker frame')
    steps, start = mode['steps'], mode['periodStart']
    need(type(steps) is list and 0 < len(steps) <= 100000 and start == 0
         and len(steps) % (maximum + 1) == 0, 'Nonempty full-lap period from the setup pose')
    period_pose, value, costs, wraps, poses = state, 0, [], [], []
    seen = {(letter, 0)}
    for step in steps:
        target = (value + direction) % (maximum + 1)
        need(type(step['from']) is int and type(step['to']) is int
             and (step['from'], step['to']) == (value, target), 'Exact modular order')
        cost = len(step['word'].split())
        need(cost >= 1 and cost == engine.shortest(state, letter, target),
             'Shortest legal edge from the actual full source pose')
        previous = state
        poses.append(engine.pose_tuple(state))
        state = turn(state, step['word'])
        show(state, letter, target)
        need(turn(state, inverse(step['word'])) == previous, 'Every full physical edge inverse')
        costs.append(cost)
        if target == (0 if direction == 1 else maximum):
            wraps.append(cost)
        value = target
        seen.add((letter, value))
    need(value == 0 and state == period_pose, 'Exact 24-sticker full-period closure')
    need(max(costs) <= CAP[letter], 'Letter-specific HTM ceiling')
    need(mode['maximumHTM'] == max(costs) and mode['periodHTM'] == sum(costs)
         and mode['periodEdges'] == len(costs), 'Honest period metrics')
    mean = Fraction(sum(costs), len(costs))
    need(Fraction(mode['optimalMeanHTM']) == mean, 'Honest exact period mean')
    laps = len(costs) // (maximum + 1)
    row = {'letter': letter, 'maximum': maximum, 'direction': direction, 'periodEdges': len(costs),
           'laps': laps, 'periodHTM': sum(costs), 'meanHTM': str(mean),
           'perLapHTM': str(mean * (maximum + 1)), 'maximumHTM': max(costs),
           'wrapHTM': {'minimum': min(wraps), 'maximum': max(wraps), 'perLapMean': str(Fraction(sum(wraps), laps))},
           'setupHTM': len(mode['setup'].split())}
    return row, seen, period_pose


def replay_inverse(engine, mode, start_state):
    """Run the saved +1 period backwards: the -1 inverse traversal."""
    letter, maximum = mode['letter'], mode['maximum']
    state, value, costs, nonshortest = start_state, 0, [], 0
    for step in reversed(mode['steps']):
        target = (value - 1) % (maximum + 1)
        need((step['from'], step['to']) == (target, value), 'Inverse traversal order')
        word = inverse(step['word'])
        cost = len(word.split())
        nonshortest += cost != engine.shortest(state, letter, target)
        state = turn(state, word)
        show(state, letter, target)
        costs.append(cost)
        value = target
    need(value == 0 and state == start_state, 'Inverse traversal closes the full pose')
    return {'periodHTM': sum(costs), 'maximumHTM': max(costs),
            'meanHTM': str(Fraction(sum(costs), len(costs))), 'edgesNotShortestForDown': nonshortest,
            'wrap00To59HTM': [c for c, s in zip(costs, reversed(mode['steps'])) if s['to'] == 0]}


def twist(engine, c, pose):
    """Corner twist: ccw steps from the U/D-facing face to the corner's home U/D sticker."""
    frames = engine.pose_list[c][pose]
    home = engine.pose_list[c][0]
    ref = next(i for i, f in enumerate(home) if f[1][1] != 0)
    position = frames[0][0]
    ud = next(i for i, f in enumerate(frames) if f[1][1] != 0)
    order = [ud]
    while len(order) < 3:
        a = frames[order[-1]][1]
        order.append(next(i for i in range(3) if i not in order
                          and dot(cross(a, frames[i][1]), position) > 0))
    return order.index(ref)


def universal(engine, letters='HSM', limit=6):
    """Prove that every display is reachable within ``limit`` HTM from every legal pose.

    A counterexample is a legal assignment of rigid poses to the corners such that
    every physical sticker selection for the display is farther than ``limit``.
    Backtracking starts from the selections of one option that are already too far
    (read directly from the exhaustive four-corner table) and prunes as soon as any
    fully placed option is within the limit. Unplaced, irrelevant corners can fill
    the remaining positions and absorb any twist, so a pruned-free leaf with such a
    corner is a genuine counterexample; with all eight corners relevant, the leaf
    must also have the legal twist sum.
    """
    cubies = engine.cubies
    tw = {c: [twist(engine, c, k) for k in range(24)] for c in cubies}
    legal = sum(tw[c][0] for c in cubies) % 3
    where = {c: [engine.pose_list[c][k][0][0] for k in range(24)] for c in cubies}
    reverse = {sid: {v: k for k, v in enumerate(row)} for sid, row in engine.slot_index.items()}
    dist = engine.dist
    far = [k for k in range(24 ** 4) if limit < dist[k] < 255]
    checked = 0

    def keyof(option, poses):
        k = 0
        for sid in option:
            k = k * 24 + engine.slot_index[sid][poses[engine.local[sid][0]]]
        return k

    for letter in letters:
        for value in range(60):
            opts = engine.options(letter, value)
            corners = [[engine.local[sid][0] for sid in o] for o in opts]
            relevant = sorted({c for cs in corners for c in cs},
                              key=lambda c: (c not in corners[0], -sum(c in cs for cs in corners), c))
            first = corners[0]

            def search(poses, depth):
                nonlocal checked
                checked += 1
                if depth == len(relevant):
                    if len(relevant) < len(cubies):
                        return dict(poses)
                    if sum(tw[c][poses[c]] for c in cubies) % 3 == legal:
                        return dict(poses)
                    return None
                c = relevant[depth]
                used = {where[d][poses[d]] for d in poses}
                for k in range(24):
                    if where[c][k] in used:
                        continue
                    poses[c] = k
                    ok = True
                    for o, cs in zip(opts, corners):
                        if c in cs and all(d in poses for d in cs) and dist[keyof(o, poses)] <= limit:
                            ok = False
                            break
                    if ok:
                        found = search(poses, depth + 1)
                        if found:
                            return found
                    del poses[c]
                return None

            for k in far:
                digits = (k // 13824, k // 576 % 24, k // 24 % 24, k % 24)
                poses = {}
                for sid, idx in zip(opts[0], digits):
                    poses[engine.local[sid][0]] = reverse[sid][idx]
                if len({where[c][poses[c]] for c in poses}) < 4:
                    continue
                if any(all(d in poses for d in cs) and dist[keyof(o, poses)] <= limit
                       for o, cs in zip(opts, corners)):
                    continue
                found = search(poses, 4)
                if found:
                    need(all(dist[keyof(o, found)] > limit for o in opts), 'Counterexample is genuine')
                    return {'boundHTM': limit, 'holds': False, 'letter': letter, 'value': value,
                            'counterexamplePoses': [found.get(c) for c in cubies]}
    return {'boundHTM': limit, 'holds': True, 'displays': 60 * len(letters),
            'searchNodes': checked,
            'meaning': 'Every display is within this many HTM of every legal full pose'}


def certify(engine, mode):
    """Rebuild the complete shortest-edge graph and verify Bellman-Ford potentials."""
    letter, maximum, direction = mode['letter'], mode['maximum'], mode['direction']
    n = maximum + 1
    mean = Fraction(mode['optimalMeanHTM'])
    A, L = mean.numerator, mean.denominator
    cubies = engine.cubies
    tw = {c: [twist(engine, c, k) for k in range(24)] for c in cubies}
    # Exhaustive invariant proof: every move changes total twist by 0 mod 3.
    for m in range(18):
        delta_by_position = {}
        for c in cubies:
            for k in range(24):
                nk = engine.pose_trans[c][m][k]
                d = (tw[c][nk] - tw[c][k]) % 3
                p = engine.pose_list[c][k][0][0]
                need(delta_by_position.setdefault(p, d) == d, 'Twist change depends only on position')
        need(sum(delta_by_position.values()) % 3 == 0, 'Every face turn preserves total twist')
    legal = sum(tw[c][0] for c in cubies) % 3
    at = {c: {} for c in cubies}
    for c in cubies:
        for k in range(24):
            at[c].setdefault(engine.pose_list[c][k][0][0], []).append(k)
    opts = [engine.options(letter, v) for v in range(n)]
    goal = {}
    for c in cubies:
        for local, s in enumerate(engine.members[c]):
            for slot in range(4):
                for k in range(24):
                    f = engine.pose_list[c][k][local]
                    if f[0] == FRONT[slot] and f[1] == Z and (s[5] == '' or f[2] == Y):
                        goal[(s[0], slot)] = k
    nodes, layer, index = [], [], {}
    for v in range(n):
        for option in opts[v]:
            fixed = {}
            for slot, sid in enumerate(option):
                fixed[engine.local[sid][0]] = goal[(sid, slot)]
            rest = [c for c in cubies if c not in fixed]
            free = [p for p in POSITIONS if p not in FRONT]
            for perm in itertools.permutations(free):
                for choice in itertools.product(*(at[c][p] for c, p in zip(rest, perm))):
                    poses = dict(fixed)
                    poses.update(zip(rest, choice))
                    t = tuple(poses[c] for c in cubies)
                    if sum(tw[c][t[i]] for i, c in enumerate(cubies)) % 3 != legal:
                        continue
                    if t not in index:
                        index[t] = len(nodes)
                        nodes.append(t)
                        layer.append(v)
    memo = {}
    st = engine.slot_trans
    dist = engine.dist

    def words(rem, keys):
        if rem == 0:
            return [()]
        hit = memo.get((rem, keys))
        if hit is not None:
            return hit
        out = []
        for m in range(18):
            nxt = []
            for k in keys:
                b = (st[0][m][k[0]], st[1][m][k[1]], st[2][m][k[2]], st[3][m][k[3]])
                if dist[((b[0] * 24 + b[1]) * 24 + b[2]) * 24 + b[3]] == rem - 1:
                    nxt.append(b)
            if nxt:
                out.extend((m, *w) for w in words(rem - 1, tuple(sorted(set(nxt)))))
        memo[(rem, keys)] = out
        return out

    trans = [engine.pose_trans[c] for c in cubies]
    cost, succ, edges = [], [], 0
    for i, t in enumerate(nodes):
        nv = (layer[i] + direction) % n
        d, keys = engine.cost(t, opts[nv])
        cost.append(d)
        ends = set()
        for w in words(d, tuple(sorted(set(keys)))):
            e = t
            for m in w:
                e = tuple(trans[j][m][e[j]] for j in range(len(cubies)))
            ends.add(e)
        targets = []
        for e in ends:
            need(e in index, 'Every shortest-edge endpoint is an enumerated display node')
            targets.append(index[e])
        succ.append(targets)
        edges += len(targets)
    need(len(nodes) == mode['graphNodes'] and edges == mode['graphEdges'],
         'Independent graph size equals the generator report')
    cap = CAP[letter]
    alive = [c <= cap for c in cost]
    changed = True
    while changed:
        changed = False
        for i in range(len(nodes)):
            if alive[i] and not any(alive[j] for j in succ[i]):
                alive[i] = False
                changed = True
    order = sorted(range(len(nodes)), key=lambda i: layer[i], reverse=direction == 1)
    pot, parent = [0] * len(nodes), [-1] * len(nodes)
    for passes in range(1, 20001):
        updated = False
        for i in order:
            if not alive[i]:
                continue
            w = L * cost[i] - A
            for j in succ[i]:
                if alive[j] and w + pot[j] < pot[i]:
                    pot[i] = w + pot[j]
                    parent[i] = j
                    updated = True
        if not updated:
            break
        if passes % 16 == 0:
            # A cycle among improving successors has negative weight: a cheaper schedule.
            color = [0] * len(nodes)
            for s0 in range(len(nodes)):
                path, x = [], s0
                while x >= 0 and color[x] == 0:
                    color[x] = 1
                    path.append(x)
                    x = parent[x]
                need(not (x >= 0 and color[x] == 1), 'A recurrent schedule with a lower mean exists')
                for y in path:
                    color[y] = 2
    else:
        raise AssertionError('Potentials did not converge: a cheaper recurrent cycle may exist')
    for i in range(len(nodes)):
        if alive[i]:
            for j in succ[i]:
                if alive[j]:
                    need(L * cost[i] - A + pot[j] - pot[i] >= 0, 'Exact dual feasibility of every edge')
    floor = [255] * n
    for i, c in enumerate(cost):
        if alive[i]:
            floor[layer[i]] = min(floor[layer[i]], c)
    hist = {}
    for c in cost:
        hist[c] = hist.get(c, 0) + 1
    return {'letter': letter, 'maximum': maximum, 'direction': direction, 'graphNodes': len(nodes),
            'graphEdges': edges, 'aliveNodes': sum(alive), 'htmCap': cap,
            'costHistogram': dict(sorted(hist.items())), 'bellmanFordPasses': passes,
            'certifiedMinimumMeanHTM': str(mean),
            'perEdgeBestPoseFloorPerLapHTM': sum(floor),
            'meaning': 'No recurrent schedule of shortest edges within the cap has a lower mean'}


def describe(sticker):
    if sticker['image'] == '':
        return 'blank'
    role = {1: 'letter', 2: 'tens', 3: 'units'}[sticker['slot']]
    return f"{role} {sticker['image']}"


def print_difference(printing):
    """Sticker identities whose artwork or orientation differ from the app's pinned print."""
    raw = APP_PRINT.read_bytes()
    need(hashlib.sha256(raw).hexdigest() == APP_PRINT_SHA256, 'App print pinned by hsm-source.json')
    old = json.loads(raw)['printing']
    changed = []
    for a, b in zip(old, printing):
        need((a['id'], a['cubie'], a['p'], a['n']) == (b['id'], b['cubie'], b['p'], b['n']),
             'Same physical facelet identities')
        same_art = (a['image'], a['slot']) == (b['image'], b['slot'])
        same_up = a['up'] == b['up'] or a['image'] == b['image'] == ''
        if not (same_art and same_up):
            changed.append({'id': b['id'], 'cubie': b['cubie'], 'p': b['p'], 'n': b['n'],
                            'app': describe(a), 'new': describe(b),
                            'appUp': a['up'], 'newUp': b['up']})
    return {'appPrintSHA256': APP_PRINT_SHA256, 'changedStickers': len(changed),
            'unchangedStickers': 24 - len(changed), 'changes': changed}


def validate(path, certify_modes=()):
    raw = Path(path).read_bytes()
    witness = json.loads(raw)
    need(witness['schema'] == 'cubistry.hsm-seconds-first'
         and type(witness['version']) is int and witness['version'] == 1, 'Exact witness schema')
    source = source_state(witness['printing'])
    engine = Engine(source)
    need(engine.graph_max == 7, 'Single-target four-corner graph diameter seven')
    bound = universal(engine)
    need(bound['holds'], 'Every display within six HTM of every legal pose')
    for letter in 'HSM':
        for value in range(60):
            need(engine.shortest(source, letter, value) <= 6, 'All 180 exact displays reachable')
    modes = witness['modes']
    need(type(modes) is list and [(m['letter'], m['maximum'], m['direction']) for m in modes]
         == list(EXPECTED_MODES), 'Exactly the eight seconds-first modes in order')
    floor = physical_floor(engine)
    rows, displays, inverse_row, certificates = [], set(), None, []
    for mode in modes:
        row, seen, start = replay_mode(engine, mode, source)
        rows.append(row)
        displays |= seen
        if (mode['letter'], mode['direction']) == ('S', 1):
            inverse_row = replay_inverse(engine, mode, start)
        if (mode['letter'], mode['maximum'], mode['direction']) in certify_modes:
            certificates.append(certify(engine, mode))
    need({(l, v) for l, v in displays if l in 'SM'} == set(itertools.product('SM', range(60))),
         'All S and M displays physically witnessed')
    need({(l, v) for l, v in displays if l == 'H'} == {('H', v) for v in range(24)},
         'All H 00-23 displays physically witnessed')
    return {'status': 'SAT', 'witnessSHA256': hashlib.sha256(raw).hexdigest(),
            'label': witness.get('label'), 'printCode': witness.get('printCode'),
            'realBlankTopLeftVerified': True, 'universalBound': bound,
            'modes': rows, 'sUpInverseTraversal': inverse_row,
            'optimalityCertificates': certificates, 'physicalFloor': floor,
            'versusAppPrint': print_difference(witness['printing']),
            'scope': 'Each period is closed over all 24 sticker frames and may repeat indefinitely; '
                     'every edge is a shortest path from its actual source pose.',
            'globalPrintOptimality': 'UNKNOWN'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('witness', nargs='?', default=str(ROOT / 'witness.json'))
    parser.add_argument('--certify', default='', help='Comma-separated letter:maximum:direction modes, or "all"')
    args = parser.parse_args()
    if args.certify == 'all':
        chosen = EXPECTED_MODES
    else:
        chosen = tuple((p.split(':')[0], int(p.split(':')[1]), int(p.split(':')[2]))
                       for p in args.certify.split(',') if p)
    print(json.dumps(validate(args.witness, chosen), indent=2))
