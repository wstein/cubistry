"""Bounded token-inventory search; feasible capacities are NOT physical SAT.

Each word is partitioned into three immutable sticker fragments. The center-row
day uses blank/tens/units, reserving eleven edge images and four center images.
"""
import json
import time
from pathlib import Path

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import lil_matrix

ROOT = Path(__file__).resolve().parent
model = json.loads((ROOT / 'model.json').read_text())


def search(locales, width, time_limit=20):
    rows = [sorted({word for locale in locales for word in model['languages'][locale][f'weekdays{width}']}),
            sorted({word for locale in locales for word in model['languages'][locale]['months']})]
    options = []
    for row, words in enumerate(rows):
        for word in words:
            for i in range(len(word) + 1):
                for j in range(i, len(word) + 1):
                    parts = (word[:i], word[i:j], word[j:])
                    if row == 0 and width == 2 and (not parts[0] or parts[2]):
                        continue
                    options.append((row, word, parts))
    tokens = sorted({(row, slot, part) for row, _, parts in options for slot, part in enumerate(parts)})
    indices = {token: len(options) + n for n, token in enumerate(tokens)}
    constraints, lower, upper = [], [], []
    for row, words in enumerate(rows):
        for word in words:
            constraints.append({n: 1 for n, (r, w, _) in enumerate(options) if (r, w) == (row, word)})
            lower.append(1); upper.append(1)
    for n, (row, word, parts) in enumerate(options):
        for slot, part in enumerate(parts):
            constraints.append({n: 1, indices[row, slot, part]: -1})
            lower.append(-np.inf); upper.append(0)
    constraints.append({indices[t]: 1 for t in tokens if t[1] != 1})
    lower.append(-np.inf); upper.append(24)
    constraints.append({indices[t]: 1 for t in tokens if t[1] == 1})
    lower.append(-np.inf); upper.append(13)
    matrix = lil_matrix((len(constraints), len(options) + len(tokens)))
    for row, terms in enumerate(constraints):
        for column, value in terms.items():
            matrix[row, column] = value
    # Prefer fewer source images; mildly penalize asymmetric word partitions.
    objective = np.zeros(matrix.shape[1])
    for token in tokens:
        objective[indices[token]] = 100
    for n, (_, word, parts) in enumerate(options):
        objective[n] = abs(len(parts[0]) - len(parts[2]))
    started = time.monotonic()
    result = milp(objective, integrality=np.ones(len(objective)),
                  bounds=Bounds(0, 1),
                  constraints=LinearConstraint(matrix.tocsr(), lower, upper),
                  options={'time_limit': time_limit})
    selected = [] if result.x is None else [dict(row=row, word=word, parts=parts)
                for n, (row, word, parts) in enumerate(options) if result.x[n] > .5]
    used = {(o['row'], s, p) for o in selected for s, p in enumerate(o['parts'])}
    return {'locales': locales, 'weekdayWidth': width, 'solverStatus': result.message,
            'physicalFeasibility': 'UNKNOWN',
            'scope': 'Inventory-budget screening only; rigid cubie assignments and legal moves unverified',
            'cornerImages': sum(t[1] != 1 for t in used),
            'edgeImagesIncludingDay': 11 + sum(t[1] == 1 for t in used),
            'seconds': time.monotonic() - started, 'selected': selected}


if __name__ == '__main__':
    results = []
    for locales in (['DE', 'EN'], ['DE'], ['EN']):
        for width in (2, 3):
            row = search(locales, width)
            results.append(row)
            print(json.dumps({k: v for k, v in row.items() if k != 'selected'}), flush=True)
    (ROOT / 'fragment-search.json').write_text(json.dumps(results, indent=2, ensure_ascii=False) + '\n')
