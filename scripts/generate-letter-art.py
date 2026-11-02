#!/usr/bin/env python3
"""Generate letter and word stickers (H, M, S, Hour, Min, Sec, 1/10) across font packs."""
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
FONTS = {
    'noto-sans': ROOT / 'public/fonts/noto-sans/NotoSans-SemiBold.ttf',
    'quicksand': ROOT / 'public/fonts/quicksand/Quicksand-SemiBold.ttf',
    'outfit': ROOT / 'public/fonts/outfit/Outfit-SemiBold.ttf',
    'dseg14': ROOT / 'public/fonts/dseg/DSEG14Classic-Regular.ttf',
}

manifest = {}

for family, font_path in FONTS.items():
    font = TTFont(font_path)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font['hmtx']
    head = font['head']
    em = head.unitsPerEm

    family_dict = {'symbols': {}, 'words-pascal': {}, 'words': {}}

    # 1. Single symbols: H, M, S (centered, ~150px tall, orientation underline at bottom)
    symbol_dir = ROOT / f'public/assets/letters/{family}/symbols'
    symbol_dir.mkdir(parents=True, exist_ok=True)
    target_h = 150.0
    for char in ['H', 'M', 'S']:
        glyph = glyphs[cmap[ord(char)]]
        bp = BoundsPen(glyphs)
        glyph.draw(bp)
        xmin, ymin, xmax, ymax = bp.bounds
        glyph_h = ymax - ymin
        scale = target_h / glyph_h
        center_x = (xmin + xmax) / 2
        tx = 128.0 - center_x * scale
        center_y = (ymin + ymax) / 2
        ty = 120.0 + center_y * scale
        
        pen = SVGPathPen(glyphs)
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, tx, ty)))
        
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
            '<rect width="256" height="256" fill="#fffdf6"/>'
            f'<path fill="#1d4771" d="{pen.getCommands()}"/>'
            '<rect x="112" y="232" width="32" height="4" rx="2" fill="#1d4771"/>'
            '</svg>\n'
        )
        out_file = symbol_dir / f'{char}.svg'
        out_file.write_text(svg)
        sha = hashlib.sha256(svg.encode()).hexdigest()
        family_dict['symbols'][char] = {
            'id': char,
            'kind': 'image',
            'format': 'svg',
            'url': f'/assets/letters/{family}/symbols/{char}.svg',
            'sha256': sha,
        }

    # 2. Pascal words: Hour, Min, Sec, 1/10
    pascal_dir = ROOT / f'public/assets/letters/{family}/words-pascal'
    pascal_dir.mkdir(parents=True, exist_ok=True)
    font_size = 79.36
    scale = font_size / em
    baseline = 232.0
    for key, text in [('H', 'Hour'), ('M', 'Min'), ('S', 'Sec'), ('T', '1/10')]:
        advance = sum(hmtx[cmap[ord(c)]][0] for c in text)
        x = (256.0 - advance * scale) / 2.0
        pen = SVGPathPen(glyphs)
        for c in text:
            g = glyphs[cmap[ord(c)]]
            g.draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
            x += hmtx[cmap[ord(c)]][0] * scale
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
            '<rect width="256" height="256" fill="#fffdf6"/>'
            f'<path fill="#1d4771" d="{pen.getCommands()}"/>'
            '</svg>\n'
        )
        out_file = pascal_dir / f'{key}.svg'
        out_file.write_text(svg)
        sha = hashlib.sha256(svg.encode()).hexdigest()
        family_dict['words-pascal'][key] = {
            'id': key,
            'kind': 'image',
            'format': 'svg',
            'url': f'/assets/letters/{family}/words-pascal/{key}.svg',
            'sha256': sha,
        }

    # 3. Lowercase words: hour, min, sec, 1/10
    words_dir = ROOT / f'public/assets/letters/{family}/words'
    words_dir.mkdir(parents=True, exist_ok=True)
    for key, text in [('H', 'hour'), ('M', 'min'), ('S', 'sec'), ('T', '1/10')]:
        advance = sum(hmtx[cmap[ord(c)]][0] for c in text)
        x = (256.0 - advance * scale) / 2.0
        pen = SVGPathPen(glyphs)
        for c in text:
            g = glyphs[cmap[ord(c)]]
            g.draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
            x += hmtx[cmap[ord(c)]][0] * scale
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
            '<rect width="256" height="256" fill="#fffdf6"/>'
            f'<path fill="#1d4771" d="{pen.getCommands()}"/>'
            '</svg>\n'
        )
        out_file = words_dir / f'{key}.svg'
        out_file.write_text(svg)
        sha = hashlib.sha256(svg.encode()).hexdigest()
        family_dict['words'][key] = {
            'id': key,
            'kind': 'image',
            'format': 'svg',
            'url': f'/assets/letters/{family}/words/{key}.svg',
            'sha256': sha,
        }

    manifest[family] = family_dict

(ROOT / 'src/apps/hsm/letter-manifests.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Letter assets and manifests updated successfully.')
