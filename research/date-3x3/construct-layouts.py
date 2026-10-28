"""Original constructive candidates for the user's revised language-specific rows."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL = json.loads((ROOT / 'model.json').read_text())
B = (-1, '')


def token(slot, text):
    return (slot, text)


def pairs(slot, texts):
    return [[token(slot, texts[i]), token(slot, texts[i + 1])] for i in range(0, len(texts), 2)]


def construct(locale, width):
    lexicon = MODEL['languages'][locale]
    words = lexicon[f'weekdays{width}']
    month_parts = {w: list(w) for w in lexicon['months']}
    if locale == 'DE' and width == 2:
        weekday_parts = {w: [w[0], w[1], ''] for w in words}
        corners = [[token(0, 'M'), token(0, 'D'), B],
                   [token(0, 'F'), token(0, 'S'), B],
                   [token(6, x) for x in 'JFM'], [token(6, x) for x in ('A', 'S', 'O')],
                   [token(6, 'N'), token(6, 'D'), token(8, 'R')],
                   [token(8, x) for x in 'NBI'], [token(8, x) for x in 'LGP'],
                   [token(8, x) for x in 'TVZ']]
        edges = pairs(1, list('OIRA')) + pairs(7, list('AEÄPUKOO'))
        edges += pairs(5, list('0123456789')) + [[B, B]]
    elif locale == 'DE':
        weekday_parts = dict(zip(words, [['M', 'ON', ''], ['DIE', '', ''],
                             ['M', 'IT', ''], ['D', 'ON', ''], ['FRE', '', ''],
                             ['S', 'AM', ''], ['S', 'ON', '']]))
        for word in ('NOV', 'FEB'):
            month_parts[word] = ['', word, '']
        corners = [[token(0, x) for x in ('M', 'DIE', 'D')],
                   [token(0, x) for x in ('FRE', 'S', 'FRE')]]
        corners += [[token(6, a), token(6, b), B] for a, b in ('JM', 'AS', 'OD')]
        corners += [[token(8, x) for x in group] for group in ('NRI', 'LGP', 'TZN')]
        edges = [[token(1, 'ON'), token(1, 'IT')], [token(1, 'AM'), B]]
        edges += pairs(7, ['A', 'E', 'Ä', 'P', 'U', 'K', 'NOV', 'FEB'])
        edges += pairs(5, list('0123456789')) + [[B, B]]
    else:
        if width == 2:
            weekday_parts = dict(zip(words, [['M', 'O', ''], ['T', 'U', ''],
                                 ['WE', '', ''], ['T', 'H', ''], ['FR', '', ''],
                                 ['S', 'A', ''], ['S', 'U', '']]))
            prefixes, middles = ['M', 'T', 'WE', 'FR', 'S', 'FR'], ['O', 'U', 'H', 'A']
        else:
            weekday_parts = dict(zip(words, [['MON', '', ''], ['T', 'UE', ''],
                                 ['WED', '', ''], ['T', 'HU', ''], ['FRI', '', ''],
                                 ['S', 'AT', ''], ['S', 'UN', '']]))
            prefixes, middles = ['MON', 'T', 'WED', 'FRI', 'S', 'FRI'], ['UE', 'HU', 'AT', 'UN']
        corners = [[token(0, x) for x in prefixes[:3]], [token(0, x) for x in prefixes[3:]]]
        corners += [[token(6, '0'), token(6, '1'), B],
                    [token(6, '2'), token(6, '3'), B],
                    [token(8, '0'), token(8, '1'), B]]
        corners += [[token(8, x) for x in group] for group in ('234', '567', '890')]
        edges = [[token(1, middles[0]), B], [token(1, middles[1]), B],
                 [token(1, middles[2]), token(1, middles[3])]]
        edges += pairs(3, list('JF M A S O N D'.replace(' ', '')))
        edges += pairs(5, list('NBRYLGPTVC'))
    assert len(corners) == 8 and len(edges) == 12
    return {'schema': 'cubistry.date-3x3-constructive', 'version': 1,
            'id': f'{locale.lower()}-{width}', 'locale': locale, 'weekdayWidth': width,
            'status': 'UNKNOWN', 'scope': 'Original candidate; independent legal-move replay pending',
            'rows': ['weekday', 'day', 'month'] if locale == 'DE' else ['weekday', 'month', 'day'],
            'dayCells': ['blank', 'tens', 'units'] if locale == 'DE' else ['tens', 'blank', 'units'],
            'pieces': {'corners': corners, 'edges': edges},
            'centerImages': list('0123') + ['', ''] if locale == 'DE' else list('AEPUCO'),
            'weekdayParts': weekday_parts, 'monthParts': month_parts,
            'blankOrientation': 'Unprinted; physical up direction is unconstrained'}


if __name__ == '__main__':
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'constructive'
    folder.mkdir(exist_ok=True)
    for locale in ('DE', 'EN'):
        for width in (2, 3):
            data = construct(locale, width)
            path = folder / f'{data["id"]}.json'
            with path.open('x') as stream:
                json.dump(data, stream, indent=2, ensure_ascii=False); stream.write('\n')
