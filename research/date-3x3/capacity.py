"""Necessary physical orbit and upright-slot bounds, not a SAT checker."""
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def analyze():
    raw = (ROOT / 'model.json').read_bytes()
    model = json.loads(raw)
    dates = []
    day = dt.date(2000, 1, 1)
    while day.year < 2400:
        dates.append((day.weekday(), day.day, day.month))
        day += dt.timedelta(days=1)
    patterns = sorted(set(dates))
    assert len(dates) == 146097 and len(patterns) == 7 * 366
    rows = []
    for language in ('DE', 'EN', 'DE+EN'):
        locales = ('DE', 'EN') if language == 'DE+EN' else (language,)
        for width in (2, 3):
            for layout in ('right', 'split', 'left'):
                inventory = [set() for _ in range(9)]
                for locale in locales:
                    lexicon = model['languages'][locale]
                    for weekday, number, month in patterns:
                        wd = lexicon[f'weekdays{width}'][weekday].ljust(3)
                        digits = f'{number:02d}'
                        middle = {'right': ' ' + digits,
                                  'split': digits[0] + ' ' + digits[1],
                                  'left': digits + ' '}[layout]
                        text = wd + middle + lexicon['months'][month - 1]
                        for slot, glyph in enumerate(text):
                            inventory[slot].add(glyph)
                corner_slots, edge_slots = (0, 2, 6, 8), (1, 3, 5, 7)
                corner_types = sum(len(inventory[s]) for s in corner_slots)
                edge_types = sum(len(inventory[s]) for s in edge_slots)
                center_types = len(inventory[4])
                # A singleton required blank corner is occupied on every display;
                # its other two stickers cannot serve the other three front corners.
                blank_cases = []
                if width == 2:
                    nonblank_types = corner_types - 1
                    blank_cases = [{'blankCopies': copies,
                                    'minimumStickerBudget': nonblank_types + copies + (2 if copies == 1 else 0)}
                                   for copies in range(1, 25)]
                    corner_lower = min(c['minimumStickerBudget'] for c in blank_cases)
                else:
                    corner_lower = corner_types
                contradictions = []
                if corner_lower > 24:
                    contradictions.append(f'corner lower bound {corner_lower} exceeds 24')
                if edge_types > 24:
                    contradictions.append(f'edge upright-slot types {edge_types} exceed 24')
                if center_types > 6:
                    contradictions.append(f'center glyphs {center_types} exceed 6')
                rows.append({'language': language, 'weekdayWidth': width, 'dayLayout': layout,
                             'slotInventories': [''.join(sorted(s)) for s in inventory],
                             'cornerTypeCount': corner_types, 'cornerLowerBound': corner_lower,
                             'edgeTypeCount': edge_types, 'centerTypeCount': center_types,
                             'blankCopyCases': blank_cases,
                             'status': 'UNSAT' if contradictions else 'UNKNOWN',
                             'contradictions': contradictions})
    return {'schema': 'cubistry.date-3x3-capacity', 'version': 1,
            'modelSHA256': hashlib.sha256(raw).hexdigest(), 'calendarDates': len(dates),
            'distinctWeekdayDayMonthPatterns': len(patterns),
            'scope': 'Necessary orbit/slot bounds only; no capacity-feasible row is called SAT',
            'rows': rows}


if __name__ == '__main__':
    print(json.dumps(analyze(), indent=2, ensure_ascii=False))
