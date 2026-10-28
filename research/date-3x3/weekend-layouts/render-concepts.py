"""Original front schematics derived from checked witnesses; no commercial art."""
import base64
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FONT = ROOT / 'images/fonts'
CANDIDATES = [f'de-weekend-c{layout}-{width}' for layout in (1, 2) for width in (2, 3)]
DAYS = [(5, 7, 'Saturday · 07 Nov 2026'), (6, 8, 'Sunday · 08 Nov 2026')]
W, H = 1800, 1240
css = ''.join('@font-face{font-family:Calendar;src:url(data:font/woff2;base64,' +
              base64.b64encode((FONT / f'noto-sans-latin-{weight}.woff2').read_bytes()).decode() +
              f") format('woff2');font-weight:{weight};" + '}' for weight in (600, 800))
image = Image.new('RGB', (W, H), '#f5f3eb')
draw = ImageDraw.Draw(image)
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs><style>{css}</style></defs><rect width="100%" height="100%" fill="#f5f3eb"/>']
metadata = []

def text(x, y, value, size=22, color='#25343e', weight=600, center=False):
    font = ImageFont.truetype(str(FONT / f'noto-sans-latin-{weight}.ttf'), size)
    anchor = 'mm' if center else 'lm'
    draw.text((x, y), value, font=font, fill=color, anchor=anchor)
    svg.append(f'<text x="{x}" y="{y}" dominant-baseline="central" text-anchor="{"middle" if center else "start"}" font-family="Calendar" font-size="{size}" font-weight="{weight}" fill="{color}">{escape(value)}</text>')

def rect(x, y, width, height, fill, radius=0):
    draw.rounded_rectangle((x, y, x+width, y+height), radius=radius, fill=fill)
    svg.append(f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}" fill="{fill}"/>')

text(40, 45, 'German calendar · fixed red/bold weekends', 34)
text(40, 87, 'Four new physical-print proposals. Whole weekday and month labels; adjacent day digits.', 23)
for column, identity in enumerate(CANDIDATES):
    c = json.loads((ROOT / 'candidates' / f'{identity}.json').read_text())
    wraw = (ROOT / 'witnesses' / f'{identity}.json').read_bytes()
    witness = json.loads(wraw)
    check = json.loads((ROOT / 'witnesses' / f'{identity}.verification.json').read_text())
    assert check['status'] == 'SAT' and check['witnessSHA256'] == hashlib.sha256(wraw).hexdigest()
    layout, width = int(identity[-3]), int(identity[-1])
    x = 30 + column*445
    text(x, 142, f'C{layout} · {width}-letter weekday', 23)
    text(x, 178, 'Weekday / ' + ('day / month' if layout == 1 else 'month / day'), 19)
    for row, (weekday, day, caption) in enumerate(DAYS):
        y = 226 + row*490
        t = next(t for t in witness['targets'] if (t['weekday'], t['day'], t['month']) == (weekday, day, 11))
        rect(x, y, 366, 366, '#243d35', 5)
        for slot, label in enumerate(t['cells']):
            cx, cy = x + 9 + (slot % 3)*119, y + 9 + (slot // 3)*119
            rect(cx, cy, 110, 110, '#fffdf6', 2)
            if label:
                role = 'weekend' if slot == 0 else 'day' if label.isdigit() else 'month'
                style = c['artwork'][role]
                text(cx+55, cy+55, label, 72 if label.isdigit() else 48 if len(label)==2 else 36,
                     style['color'], style['weight'], center=True)
        text(x, y+402, caption, 20)
        text(x, y+436, 'One immutable print · 2,562 verified displays', 16)
        metadata.append({'candidate': identity, 'weekday': weekday, 'day': day, 'month': 11,
                         'cells': t['cells'], 'witnessSHA256': hashlib.sha256(wraw).hexdigest(),
                         'fixedWeekendStyle': c['artwork']['weekend']})
text(40, 1200, 'Concept front views, not cut plans. SVG is authoritative; PNG preview uses the same pinned Noto Sans fonts.', 18)
svg.append('</svg>')
(ROOT / 'images/four-german-weekend-proposals.svg').write_text(''.join(svg)+'\n')
image.save(ROOT / 'images/four-german-weekend-proposals.png', dpi=(144, 144))
(ROOT / 'images/concepts.json').write_text(json.dumps({'schema': 'cubistry.weekend-front-concepts',
    'version': 1, 'canvasPixels': [W,H], 'previewDPI':144, 'schematicNotPhysicalScale':True,
    'targets':metadata, 'fontPackage':'@fontsource/noto-sans@5.2.10',
    'fontLicense':'SIL-OFL-1.1', 'fonts':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in FONT.iterdir()},
    'exports':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'images').glob('four-german*')}
}, ensure_ascii=False, indent=2)+'\n')
