"""Reproduce fixed bottom-aligned unit lettering as self-contained vector paths."""
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import fontTools

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / 'public/fonts/noto-sans-latin-600.woff2'
OUT = ROOT / 'public/assets/hsm/words'
OUT.mkdir(parents=True, exist_ok=True)
font = TTFont(FONT)
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
font_size, baseline = 67.2, 232
scale = font_size / font['head'].unitsPerEm
images, bounds = [], {}
for letter, word in [('H', 'hour'), ('M', 'min'), ('S', 'sec')]:
    advance = sum(font['hmtx'][cmap[ord(c)]][0] for c in word)
    x = (256 - advance * scale) / 2
    pen = SVGPathPen(glyphs)
    ink = BoundsPen(glyphs)
    for char in word:
        glyph = glyphs[cmap[ord(char)]]
        transform = (scale, 0, 0, -scale, x, baseline)
        glyph.draw(TransformPen(pen, transform))
        glyph.draw(TransformPen(ink, transform))
        x += font['hmtx'][cmap[ord(char)]][0] * scale
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
           '<rect width="256" height="256" fill="#fffdf6"/>'
           f'<path fill="#1d4771" d="{pen.getCommands()}"/></svg>\n')
    (OUT / f'{letter}.svg').write_text(svg)
    bounds[letter] = {'text': word, 'inkBounds': list(ink.bounds)}
    images.append({'id': letter, 'kind': 'image', 'format': 'svg', 'url': f'/assets/hsm/words/{letter}.svg', 'sha256': hashlib.sha256(svg.encode()).hexdigest()})
(ROOT / 'src/apps/hsm/images-words.json').write_text(json.dumps(images, indent=2) + '\n')
(OUT / 'provenance.json').write_text(json.dumps({
    'schema': 'cubistry.hsm-unit-lettering', 'version': 1, 'variant': 'words',
    'description': 'Small hour/min/sec at the bottom; no large H/M/S in this variant.',
    'canvas': [256, 256], 'fontSize': font_size, 'baseline': baseline,
    'font': {'family': 'Noto Sans', 'weight': 600, 'package': '@fontsource/noto-sans@5.2.10',
             'path': str(FONT.relative_to(ROOT)), 'sha256': hashlib.sha256(FONT.read_bytes()).hexdigest(),
             'license': 'SIL-OFL-1.1', 'licensePath': 'public/fonts/OFL.txt'},
    'generator': 'scripts/export-hsm-word-art.py', 'fontToolsVersion': fontTools.__version__, 'stickers': bounds
}, indent=2) + '\n')
