"""Bounded rigid-piece search with word fragments and blank orientation freedom.

Hall constraints certify distinct visible bodies for every required four-piece
selection. This is not yet a legal-move or oriented-center certificate.
"""
import itertools
import json
import sys
import time
from pathlib import Path

from z3 import And, Int, Or, PbGe, Solver, sat

ROOT = Path(__file__).resolve().parent
MODEL = json.loads((ROOT / 'model.json').read_text())


def search(locales, width, seconds=60):
    words = [sorted({w for locale in locales for w in MODEL['languages'][locale][f'weekdays{width}']}),
             sorted({w for locale in locales for w in MODEL['languages'][locale]['months']})]
    choices = {}
    for row in range(2):
        for word in words[row]:
            choices[row, word] = [(word[:i], word[i:j], word[j:])
                for i in range(len(word) + 1) for j in range(i, len(word) + 1)
                if not (row == 0 and width == 2 and (i == 0 or j != len(word)))]
    tokens = {'corners': [(-1, '')], 'edges': [(-1, '')]}
    for (row, word), options in choices.items():
        for parts in options:
            for column, text in enumerate(parts):
                orbit = 'edges' if column == 1 else 'corners'
                token = (row * 3 + column, text)
                if text and token not in tokens[orbit]:
                    tokens[orbit].append(token)
    # Day unit images occupy a different upright edge slot from all word parts.
    tokens['edges'] += [(7, str(n)) for n in range(10)]
    solver = Solver(); solver.set(timeout=int(seconds * 1000), random_seed=331)
    print_vars, availability = {}, {}
    for orbit, bodies, faces in (('corners', 8, 3), ('edges', 12, 2)):
        variables = [[Int(f'{orbit}_{p}_{f}') for f in range(faces)] for p in range(bodies)]
        print_vars[orbit] = variables
        for row in variables:
            solver.add(*(And(v >= 0, v < len(tokens[orbit])) for v in row))
            solver.add(*(row[i] <= row[i + 1] for i in range(faces - 1)))
        base = len(tokens[orbit])
        keys = [sum(v * base ** (faces - i - 1) for i, v in enumerate(row)) for row in variables]
        solver.add(*(keys[i] <= keys[i + 1] for i in range(bodies - 1)))
        for token in range(base):
            availability[orbit, token] = [Or(*(v == token for v in row)) for row in variables]
    word_vars, word_availability = {}, {}
    for (row, word), options in choices.items():
        slots = [Int(f'word_{row}_{word}_{c}') for c in range(3)]
        word_vars[row, word] = slots
        encoded = []
        for parts in options:
            ids = []
            for c, text in enumerate(parts):
                orbit = 'edges' if c == 1 else 'corners'
                ids.append(tokens[orbit].index((row * 3 + c, text)) if text else 0)
            encoded.append(And(*(v == token for v, token in zip(slots, ids))))
        solver.add(Or(*encoded))
        for c in range(3):
            orbit = 'edges' if c == 1 else 'corners'
            word_availability[row, word, c] = [Or(*(v == slots[c] for v in body)) for body in print_vars[orbit]]

    def matching(lists):
        # Exact Hall criterion for a four-to-bodies bipartite matching.
        for count in range(1, 5):
            for indices in itertools.combinations(range(4), count):
                union = [Or(*(lists[i][p] for i in indices)) for p in range(len(lists[0]))]
                solver.add(PbGe([(v, 1) for v in union], count))

    pairs = sorted({(w, m) for locale in locales
                    for w in MODEL['languages'][locale][f'weekdays{width}']
                    for m in MODEL['languages'][locale]['months']})
    for w, m in pairs:
        matching([word_availability[0, w, 0], word_availability[0, w, 2],
                  word_availability[1, m, 0], word_availability[1, m, 2]])
        for digit in range(10):
            token = tokens['edges'].index((7, str(digit)))
            matching([word_availability[0, w, 1], availability['edges', 0],
                      availability['edges', token], word_availability[1, m, 1]])
    started = time.monotonic(); result = solver.check()
    output = {'schema': 'cubistry.date-3x3-piece-candidate', 'version': 1,
              'locales': locales, 'weekdayWidth': width, 'timeoutSeconds': seconds,
              'solver': 'z3-solver4.15.3.0', 'solverResult': str(result),
              'status': 'UNKNOWN', 'scope': 'Unverified rigid-piece candidate; not a legal-move proof',
              'seconds': time.monotonic() - started}
    if result == sat:
        solved = solver.model()
        output['pieces'] = {orbit: [[tokens[orbit][solved.eval(v).as_long()] for v in body]
                                   for body in variables] for orbit, variables in print_vars.items()}
        output['words'] = [{'row': row, 'word': word,
                            'parts': [tokens['edges' if c == 1 else 'corners'][solved.eval(v).as_long()][1]
                                      for c, v in enumerate(slots)]}
                           for (row, word), slots in word_vars.items()]
    return output


if __name__ == '__main__':
    locales = sys.argv[1].split('+'); width = int(sys.argv[2]); out = Path(sys.argv[3])
    result = search(locales, width, float(sys.argv[4]) if len(sys.argv) > 4 else 60)
    with out.open('x') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False); stream.write('\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('words', 'pieces')}))
