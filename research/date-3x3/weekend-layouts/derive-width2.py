"""Bijection-only weekday relabeling; retain every rigid frame and legal move."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parent
mapping = dict(zip(['MON', 'DIE', 'MIT', 'DON', 'FRE', 'SAM', 'SON'],
                   ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO']))
for layout in (1, 2):
    source = root / 'witnesses' / f'de-weekend-c{layout}-3.json'
    raw = source.read_bytes()
    witness = json.loads(raw)
    witness['candidateId'] = f'de-weekend-c{layout}-2'
    witness['weekdayWidth'] = 2
    for sticker in witness['printing']:
        if sticker['slot'] == 0 and sticker['image']:
            sticker['image'] = mapping[sticker['image']]
    for target in witness['targets']:
        target['cells'][0] = mapping[target['cells'][0]]
    witness['derivedBy'] = {'script': 'derive-width2.py', 'sourceWitness': source.name,
                           'sourceSHA256': hashlib.sha256(raw).hexdigest(),
                           'weekdayImageBijection': mapping,
                           'geometryAndMoveWords': 'unchanged'}
    out = root / 'witnesses' / f'de-weekend-c{layout}-2.json'
    with out.open('x') as file:
        json.dump(witness, file, ensure_ascii=False, indent=2)
        file.write('\n')
