"""Export immutable Quality Cube SVG paths using the existing pinned OFL font."""
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import fontTools

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / 'public/fonts/noto-sans-latin-800.woff2'
OUT = ROOT / 'public/assets/quality'
OUT.mkdir(parents=True, exist_ok=True)
font = TTFont(FONT)
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
states = [('open', 'OFFEN', '#56616a'), ('running', 'LÄUFT', '#145a91'),
          ('ok', 'OK', '#187044'), ('error', 'FEHLER', '#b12c2c'),
          ('blocked', 'BLOCKIERT', '#855600')]
icons = {
    'open': '<circle cx="128" cy="130" r="43"/>',
    'running': '<path d="M166 108 A44 44 0 1 0 171 143 M166 81 V108 H139"/>',
    'ok': '<path d="M83 131 L114 161 L176 98"/>',
    'error': '<path d="M96 98 L160 162 M160 98 L96 162"/>',
    'blocked': '<circle cx="128" cy="130" r="43"/><path d="M98 160 L158 100"/>',
}
images, evidence = [], {}
def outline(text, size, baseline):
    scale = size / font['head'].unitsPerEm
    advance = sum(font['hmtx'][cmap[ord(c)]][0] for c in text) * scale
    x = (256 - advance) / 2
    pen, ink = SVGPathPen(glyphs), BoundsPen(glyphs)
    for char in text:
        glyph = glyphs[cmap[ord(char)]]
        transform = (scale, 0, 0, -scale, x, baseline)
        glyph.draw(TransformPen(pen, transform))
        glyph.draw(TransformPen(ink, transform))
        x += font['hmtx'][cmap[ord(char)]][0] * scale
    assert ink.bounds[0] >= 14 and ink.bounds[2] <= 242
    return pen.getCommands(), list(ink.bounds)
for category in ['BUILD', 'TEST', 'ANALYZE', 'REVIEW']:
    for state, word, color in states:
        asset = f'quality-{category.lower()}-{state}'
        heading, hb = outline(category, 28, 49)
        label, lb = outline(word, 30 if state != 'blocked' else 29, 228)
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
               '<rect width="256" height="256" fill="#fffaf0"/>'
               f'<path fill="#263746" d="{heading}"/>'
               f'<g fill="none" stroke="{color}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">{icons[state]}</g>'
               f'<path fill="{color}" d="{label}"/></svg>\n')
        (OUT / f'{asset}.svg').write_text(svg)
        images.append({'id': asset, 'kind': 'image', 'format': 'svg', 'url': f'/assets/quality/{asset}.svg', 'sha256': hashlib.sha256(svg.encode()).hexdigest()})
        evidence[asset] = {'category': category, 'stateWord': word, 'stateColor': color, 'categoryInkBounds': hb, 'stateInkBounds': lb}
(ROOT / 'src/apps/status/images.json').write_text(json.dumps(images, indent=2) + '\n')
(OUT / 'provenance.json').write_text(json.dumps({
    'generator': 'scripts/export-quality-art.py', 'fontToolsVersion': fontTools.__version__,
    'font': {'family': 'Noto Sans', 'weight': 800, 'package': '@fontsource/noto-sans@5.2.10',
             'path': str(FONT.relative_to(ROOT)), 'sha256': hashlib.sha256(FONT.read_bytes()).hexdigest(),
             'license': 'SIL-OFL-1.1', 'licensePath': 'public/fonts/OFL.txt'},
    'dimensions': [256, 256], 'safeArea': 14, 'stickers': evidence,
    'icons': 'Uniform vector strokes; running is a circular arrow, never a platform emoji.',
    'language': 'German physical state words are intentional user-specified print data.'
}, indent=2) + '\n')
