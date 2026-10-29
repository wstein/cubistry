"""Original vector print/cut export for the immutable selected cube prints.

No network access, puzzle solving, or runtime font service is used.
"""
import argparse
import hashlib
import json
import math
import shutil
import zipfile
import importlib.metadata
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.reportLabPen import ReportLabPen
from fontTools.svgLib.path import parse_path
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.colors import HexColor, CMYKColorSep
from reportlab.lib.units import mm

ROOT = Path(__file__).resolve().parent.parent
PAGE = (210, 297)
# Each face is viewed from outside, with its indicated top toward the viewer's top.
FACES = [
    ('U', (0, 1, 0), (0, 0, -1)), ('L', (-1, 0, 0), (0, 1, 0)),
    ('F', (0, 0, 1), (0, 1, 0)), ('R', (1, 0, 0), (0, 1, 0)),
    ('B', (0, 0, -1), (0, 1, 0)), ('D', (0, -1, 0), (0, 0, 1)),
]


def need(ok, message):
    if not ok:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def number(value):
    return f'{value:.6f}'.rstrip('0').rstrip('.')


def rounded_rect_path(x, y, width, height, radius):
    r = radius
    k = r * 0.5522847498307936
    return (f'M{number(x+r)} {number(y)}H{number(x+width-r)}'
            f'C{number(x+width-r+k)} {number(y)} {number(x+width)} {number(y+r-k)} {number(x+width)} {number(y+r)}'
            f'V{number(y+height-r)}C{number(x+width)} {number(y+height-r+k)} {number(x+width-r+k)} {number(y+height)} {number(x+width-r)} {number(y+height)}'
            f'H{number(x+r)}C{number(x+r-k)} {number(y+height)} {number(x)} {number(y+height-r+k)} {number(x)} {number(y+height-r)}'
            f'V{number(y+r)}C{number(x)} {number(y+r-k)} {number(x+r-k)} {number(y)} {number(x+r)} {number(y)}Z')


def rounded_path(x, y, size, radius):
    return rounded_rect_path(x, y, size, size, radius)


def safe_scale(bounds, size, radius, safe):
    if bounds is None:
        return 1
    half = 128-safe*256/size
    original_radius = radius*256/size
    inner_radius = max(0, original_radius-safe*256/size)
    inner_corner = 128-original_radius

    def contained(scale):
        for x in (bounds[0], bounds[2]):
            for y in (bounds[1], bounds[3]):
                a, b = abs(x-128)*scale, abs(y-128)*scale
                if a > half or b > half:
                    return False
                if inner_radius and max(0, a-inner_corner)**2+max(0, b-inner_corner)**2 > inner_radius**2:
                    return False
        return True
    if contained(1):
        return 1
    low, high = 0, 1
    for _ in range(48):
        mid = (low+high)/2
        if contained(mid):
            low = mid
        else:
            high = mid
    return low


@dataclass
class Shape:
    path: str
    fill: str = '#1d4771'
    stroke: str = 'none'
    width: float = 1
    cap: int = 0
    join: int = 0

    def svg(self):
        return (f'<path d="{self.path}" fill="{self.fill}" stroke="{self.stroke}" '
                f'stroke-width="{self.width}" stroke-linecap="{["butt","round","square"][self.cap]}" '
                f'stroke-linejoin="{["miter","round","bevel"][self.join]}"/>')


def read_svg(path):
    root = ET.parse(path).getroot()
    result = []

    def walk(el, inherited):
        tag = el.tag.split('}')[-1]
        need(tag in ('svg', 'g', 'path', 'rect'), 'Only self-contained vector HSM assets are supported')
        attrs = {**inherited, **el.attrib}
        need('transform' not in attrs and 'href' not in attrs, 'Unsupported external/transformed SVG')
        if tag == 'path':
            result.append(Shape(attrs['d'], attrs.get('fill', 'black'), attrs.get('stroke', 'none'),
                                float(attrs.get('stroke-width', 1)),
                                ['butt', 'round', 'square'].index(attrs.get('stroke-linecap', 'butt')),
                                ['miter', 'round', 'bevel'].index(attrs.get('stroke-linejoin', 'miter'))))
        elif tag == 'rect':
            x, y = float(attrs.get('x', 0)), float(attrs.get('y', 0))
            w, h = float(attrs['width']), float(attrs['height'])
            if (x, y, w, h) == (0, 0, 256, 256):
                return  # The sheet supplies the original background plus bleed.
            r = float(attrs.get('rx', 0))
            # HSM orientation marks are rounded rectangles; support unequal sides.
            p = rounded_rect_path(x, y, w, h, r)
            result.append(Shape(p, attrs.get('fill', 'black')))
        for child in el:
            walk(child, {k: v for k, v in attrs.items() if k in ('fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin')})
    walk(root, {})
    return result


class Artwork:
    def __init__(self):
        self.fonts = {}
        self.cache = {}
        self.inputs = {}

    def calendar(self, sticker):
        text = sticker['image']
        if not text:
            return []
        art = sticker['art']
        weight = art['weight']
        if weight not in self.fonts:
            path = ROOT / f'public/fonts/noto-sans-latin-{weight}.woff2'
            self.fonts[weight] = TTFont(path)
            self.inputs[str(path.relative_to(ROOT))] = sha(path)
        font = self.fonts[weight]
        glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
        scale = art['size'] / font['head'].unitsPerEm
        advance = sum(font['hmtx'][cmap[ord(c)]][0] for c in text)
        x = (256-advance*scale)/2
        # The SVG central baseline uses the font's ascent/descent center.
        baseline = 133 + (font['hhea'].ascent + font['hhea'].descent)*scale/2
        pen = SVGPathPen(glyphs)
        for c in text:
            glyphs[cmap[ord(c)]].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
            x += font['hmtx'][cmap[ord(c)]][0]*scale
        return [Shape(pen.getCommands(), art['color'])]

    def shapes(self, design, sticker):
        image = sticker['image']
        key = (design['id'], image, sticker.get('slot', -1))
        if key not in self.cache:
            if design['size'] == 3:
                value = self.calendar(sticker)
            elif not image:
                value = []
            else:
                path = ROOT / (f'public/assets/digits/{image}.svg' if image.isdigit() else
                               f'public/assets/hsm/{"words/" if design["lettering"] == "words" else ""}{image}.svg')
                self.inputs[str(path.relative_to(ROOT))] = sha(path)
                value = read_svg(path)
            self.cache[key] = value
        return self.cache[key]


def ink_bounds(shapes):
    bounds = []
    for shape in shapes:
        pen = BoundsPen(None)
        parse_path(shape.path, pen)
        if pen.bounds:
            a, b, c, d = pen.bounds
            extra = (shape.width/2 * (10 if shape.join == 0 else math.sqrt(2) if shape.cap == 2 else 1)) if shape.stroke != 'none' else 0
            bounds.append((a-extra, b-extra, c+extra, d+extra))
    return (min(b[0] for b in bounds), min(b[1] for b in bounds),
            max(b[2] for b in bounds), max(b[3] for b in bounds)) if bounds else None


def placements(design, size, gap, bleed, radius, safe, copies=1, layout="compact"):
    n = design['size']
    face_size = n*size+(n-1)*gap
    face_gap = 12
    margin, top, bottom = 12, 20, 22
    columns = min(2, math.floor((PAGE[0]-margin*2+face_gap)/(face_size+face_gap)))
    rows = math.floor((PAGE[1]-top-bottom+face_gap)/(face_size+face_gap))
    need(columns >= 1 and rows >= 1, 'Sticker dimensions cannot fit one face on A4')
    records = []
    levels = [1, 0, -1] if n == 3 else [1, -1]
    for index, (face, normal, up) in enumerate(FACES):
        page, block = divmod(index, columns*rows)
        bx = margin+(block % columns)*(face_size+face_gap)
        by = top+(block//columns)*(face_size+face_gap)
        right = cross(up, normal)
        stickers = [s for s in design['printing'] if tuple(s['n']) == normal]
        need(len(stickers) == n*n, 'Exact physical face inventory')
        for s in stickers:
            row = levels.index(dot(s['p'], up))
            column = list(reversed(levels)).index(dot(s['p'], right))
            angle = round(math.degrees(math.atan2(dot(s['up'], right), dot(s['up'], up)))) % 360
            need(angle in (0, 90, 180, 270), 'Print up must be a quarter-turn face direction')
            records.append({'id': s['id'], 'cubie': s['cubie'], 'face': face, 'row': row, 'column': column,
                            'normal': list(normal), 'faceUp': list(up), 'sourcePosition': s['p'], 'sourceUp': s['up'],
                            'image': s['image'], 'rotationDeg': angle, 'page': page+1,
                            'xMm': bx+column*(size+gap), 'yMm': by+row*(size+gap),
                            'sizeMm': size, 'cornerRadiusMm': radius, 'bleedMm': bleed, 'safeMm': safe})
    need(len(records) == 6*n*n and len({s['id'] for s in records}) == len(records), 'Every source sticker appears exactly once, including blanks')
    records.sort(key=lambda s: (FACES.index(next(f for f in FACES if f[0] == s['face'])), s['row'], s['column']))
    pages_per_copy = max(s['page'] for s in records)
    result = []
    compact_columns = math.floor((PAGE[0]-20+gap)/(size+gap))
    compact_rows = math.floor((PAGE[1]-36+gap)/(size+gap))
    need(compact_columns >= 1 and compact_rows >= 1, 'Sticker cannot fit on A4')
    for copy in range(1, copies+1):
        for index, original in enumerate(records):
            item = {**original, 'copy': copy, 'uid': f'copy-{copy}-sticker-{original["id"]}'}
            if layout == 'compact':
                page, slot = divmod((copy-1)*len(records)+index, compact_columns*compact_rows)
                row, column = divmod(slot, compact_columns)
                item.update(page=page+1, sheetRow=row, sheetColumn=column,
                            xMm=10+column*(size+gap), yMm=18+row*(size+gap))
            else:
                item['page'] += (copy-1)*pages_per_copy
            result.append(item)
    return result


def pdf_path(canvas, data):
    pen = ReportLabPen(None)
    parse_path(data, pen)
    # The graphics path operations map directly to PDF vector path operations.
    p = canvas.beginPath()
    operators, points = pen.path.operators, iter(pen.path.points)
    for op in operators:
        if op == 0:
            p.moveTo(next(points), next(points))
        elif op == 1:
            p.lineTo(next(points), next(points))
        elif op == 2:
            p.curveTo(*[next(points) for _ in range(6)])
        elif op == 3:
            p.close()
        else:
            raise ValueError('Unsupported vector path operator')
    return p


def pdf_shape(canvas, shape):
    p = pdf_path(canvas, shape.path)
    if shape.fill != 'none':
        canvas.setFillColor(HexColor(shape.fill))
    if shape.stroke != 'none':
        canvas.setStrokeColor(HexColor(shape.stroke))
        canvas.setLineWidth(shape.width)
        canvas.setLineCap(shape.cap)
        canvas.setLineJoin(shape.join)
    canvas.drawPath(p, stroke=int(shape.stroke != 'none'), fill=int(shape.fill != 'none'))


def pdf_canvas(path, title):
    c = Canvas(str(path), pagesize=(PAGE[0]*mm, PAGE[1]*mm), pageCompression=1, invariant=1)
    c.setTitle(title)
    c.setAuthor('Cubistry')
    c.setCreator('Cubistry vector print export')
    return c


def labels(c, records, size):
    c.setFillColor(HexColor('#25343e'))
    c.setFont('Helvetica', 2.4)
    # Text here is guide-only; sticker text itself is always vector outlines.
    for s in records:
        c.saveState()
        c.translate(s['xMm']+size/2, s['yMm']+size/2)
        c.scale(1, -1)
        c.drawCentredString(0, 0, f'C{s["copy"]}:{s["id"]}')
        c.restoreState()


def write_design(design, output, size, gap, bleed, radius, safe, artwork, copies=1, layout="compact"):
    records = placements(design, size, gap, bleed, radius, safe, copies, layout)
    source = {s['id']: s for s in design['printing']}
    for s in records:
        shapes = artwork.shapes(design, source[s['id']])
        bounds = ink_bounds(shapes)
        scale = safe_scale(bounds, size, radius, safe)
        s['artScale'] = scale
        s['sourceInkBounds'] = list(bounds) if bounds else None
        s['cutPathMm'] = rounded_path(s['xMm'], s['yMm'], size, radius)
    output.mkdir(parents=True, exist_ok=False)
    pdf = pdf_canvas(output/'print.pdf', f'{design["id"]} artwork and kiss_cut')
    guide = pdf_canvas(output/'assembly.pdf', f'{design["id"]} assembly reference')
    pages = max(s['page'] for s in records)
    svg_files = []
    for page in range(1, pages+1):
        page_records = [s for s in records if s['page'] == page]
        header = '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">'
        art_svg, cuts_svg = [header], [header, '<g id="kiss_cut" data-spot-name="kiss_cut" data-cmyk="0,100,0,0" data-overprint="true">']
        for canvas in (pdf, guide):
            canvas.saveState()
            canvas.translate(0, PAGE[1]*mm)
            canvas.scale(mm, -mm)
        for s in page_records:
            x, y = s['xMm'], s['yMm']
            shapes = artwork.shapes(design, source[s['id']])
            art_svg.append(f'<g id="{s["uid"]}" data-copy="{s["copy"]}" data-source-id="{s["id"]}" data-face="{s["face"]}" data-row="{s["row"]}" data-column="{s["column"]}">')
            art_svg.append(f'<rect x="{number(x-bleed)}" y="{number(y-bleed)}" width="{number(size+2*bleed)}" height="{number(size+2*bleed)}" fill="#fffdf6"/>')
            transform = f'translate({number(x+size/2)} {number(y+size/2)}) rotate({s["rotationDeg"]}) scale({number(size/256*s["artScale"])}) translate(-128 -128)'
            art_svg.append(f'<g transform="{transform}">'+''.join(a.svg() for a in shapes)+'</g></g>')
            cuts_svg.append(f'<path id="cut-{s["uid"]}" data-copy="{s["copy"]}" data-source-id="{s["id"]}" d="{s["cutPathMm"]}" fill="none" stroke="#ff00ff" stroke-width="0.1"/>')
            pdf.setFillColor(HexColor('#fffdf6'))
            pdf.rect(x-bleed, y-bleed, size+2*bleed, size+2*bleed, stroke=0, fill=1)
            pdf.saveState()
            pdf.translate(x+size/2, y+size/2)
            pdf.rotate(s['rotationDeg'])
            pdf.scale(size/256*s['artScale'], size/256*s['artScale'])
            pdf.translate(-128, -128)
            for shape in shapes:
                pdf_shape(pdf, shape)
            pdf.restoreState()
        # Draw cuts last in a real named Separation color, with stroke overprint.
        pdf.saveState()
        pdf.setStrokeColor(CMYKColorSep(0, 1, 0, 0, spotName='kiss_cut'))
        pdf.setStrokeOverprint(True)
        pdf.setLineWidth(0.1)
        for s in page_records:
            pdf.drawPath(pdf_path(pdf, s['cutPathMm']), stroke=1, fill=0)
        pdf.restoreState()
        guide.setStrokeColor(HexColor('#243d35'))
        guide.setLineWidth(0.15)
        for s in page_records:
            guide.drawPath(pdf_path(guide, s['cutPathMm']), stroke=1, fill=0)
        labels(guide, page_records, size)
        # Guide labels, calibration and assembly key never occur on production art.
        guide.saveState()
        guide.scale(1, -1)
        guide.setFont('Helvetica-Bold', 4)
        guide.drawString(12, -10, f'{design["id"]} - source-pose assembly reference')
        guide.setFont('Helvetica', 2.8)
        guide.drawString(12, -(PAGE[1]-12), 'Print at 100%. Measure the 50 mm bar. IDs are not sticker artwork.')
        guide.restoreState()
        guide.line(12, PAGE[1]-18, 62, PAGE[1]-18)
        guide.line(12, PAGE[1]-19, 12, PAGE[1]-17)
        guide.line(62, PAGE[1]-19, 62, PAGE[1]-17)
        for canvas in (pdf, guide):
            canvas.restoreState()
            canvas.showPage()
        cuts_svg.append('</g>')
        for name, data in [('artwork', art_svg), ('cuts', cuts_svg)]:
            file = f'{name}-{page}.svg'
            (output/file).write_text(''.join(data)+'</svg>\n')
            svg_files.append(file)
    pdf.save()
    guide.setFillColor(HexColor('#25343e'))
    guide.setFont('Helvetica-Bold', 12)
    guide.drawString(12*mm, 284*mm, 'Assembly: begin with a solved cube')
    guide.setFont('Helvetica', 8)
    lines = [
        'Choose and retain Front (F) and Up (U). Do not turn faces while applying stickers.',
        'Every grid is viewed from outside. Match source IDs to the numbered sheet map.',
        'Keep each loose sticker in its printed orientation relative to that face top.',
        'U face top points toward B; D top toward F; all side face tops point toward U.',
        'C1, C2, ... identify complete copies. Blank stickers are required physical stickers.',
        'After application the cube is in its source pose. Use the setup words below.',
        "R/L/U/D/F/B turn that face clockwise from outside; apostrophe reverses it, 2 is a half turn.",
        'x/y/z rotate the whole cube in the R/U/F direction. Read left to right in the current view.',
    ]
    for i, line in enumerate(lines):
        guide.drawString(12*mm, (277-i*4)*mm, line)
    levels = [1, 0, -1] if design['size'] == 3 else [1, -1]
    cell, cell_gap = 12, 3
    face_width = design['size']*cell+(design['size']-1)*cell_gap
    for index, (face, normal, up) in enumerate(FACES):
        x = 14+(index % 2)*82
        y = 58+(index//2)*57
        guide.setFont('Helvetica-Bold', 9)
        guide.drawString(x*mm, (PAGE[1]-y+4)*mm, f'{face} - top UP')
        for item in [r for r in records if r['copy'] == 1 and r['face'] == face]:
            cx, cy = x+item['column']*(cell+cell_gap), y+item['row']*(cell+cell_gap)
            guide.rect(cx*mm, (PAGE[1]-cy-cell)*mm, cell*mm, cell*mm, stroke=1, fill=0)
            guide.setFont('Helvetica-Bold', 10)
            guide.drawCentredString((cx+cell/2)*mm, (PAGE[1]-cy-cell/2)*mm, str(item['id']))
            guide.setFont('Helvetica', 6)
            guide.drawCentredString((cx+cell/2)*mm, (PAGE[1]-cy-cell+1.5)*mm, item['image'] or 'blank')
    guide.setFont('Helvetica-Bold', 9)
    guide.drawString(12*mm, 53*mm, 'Setup examples (face and whole-cube notation)')
    import textwrap
    at = 48
    for name, word in design['setupExamples'].items():
        guide.setFont('Helvetica', 7)
        for line in textwrap.wrap(f'{name}: {word}', width=132):
            guide.drawString(12*mm, at*mm, line)
            at -= 3.2
    guide.showPage()
    guide.save()
    shutil.copyfile(ROOT/'LICENSE', output/'ARTWORK-LICENSE.txt')
    font = None
    extra_files = ['ARTWORK-LICENSE.txt']
    if design['size'] == 3 or design.get('lettering') == 'words':
        shutil.copyfile(ROOT/'public/fonts/OFL.txt', output/'OFL.txt')
        extra_files.append('OFL.txt')
        if design['size'] == 3:
            font = {'family': 'Noto Sans', 'weights': sorted(artwork.fonts), 'role': 'Calendar glyph outlines',
                    'package': '@fontsource/noto-sans@5.2.10', 'license': 'SIL-OFL-1.1', 'licenseFile': 'OFL.txt'}
        else:
            words = ROOT/'public/assets/hsm/words/provenance.json'
            source_font = json.loads(words.read_text())['font']
            need(sha(ROOT/source_font['path']) == source_font['sha256'], 'Pinned word-art source font changed')
            artwork.inputs[str(words.relative_to(ROOT))] = sha(words)
            artwork.inputs[source_font['path']] = source_font['sha256']
            shutil.copyfile(words, output/'WORD-ART-PROVENANCE.json')
            extra_files.append('WORD-ART-PROVENANCE.json')
            font = {'family': 'Noto Sans', 'weights': [600], 'role': 'Only hour/min/sec unit-word outlines; digits are original geometric artwork',
                    'package': source_font['package'], 'license': 'SIL-OFL-1.1', 'licenseFile': 'OFL.txt', 'sourceProvenance': 'WORD-ART-PROVENANCE.json'}
    notes = f'''Cubistry {design["id"]} print and cut export

This example contains {copies} complete cube sets, {len(records)} stickers in total.
Cut size: {size} x {size} mm; corner radius: {radius} mm.
Bleed: {bleed} mm; gap: {gap} mm; minimum ink safety inset: {safe} mm.
Paper: A4, 210 x 297 mm. Print at 100% / actual size, not fit-to-page.
Measure the 50 mm bar in assembly.pdf and your actual cube's sticker recess.
Example dimensions are not a guarantee for every nominally standard cube.

PRODUCTION: print.pdf includes artwork and a named kiss_cut Separation channel
(100% magenta, overprint enabled). Agree with the printer that this channel is
used for cutting, not visible ink. Each closed contour is one kiss-cut through
the sticker film and adhesive; the backing must remain intact.
This is generic vector PDF, not PDF/X certification or universal printer acceptance.
The separate artwork-N.svg and cuts-N.svg files are in millimeters. SVG's named
cut group is metadata; the actual PDF separation is the manufacturing channel.
Confirm film, adhesive, cut registration tolerance, minimum radius, color profile
and bleed requirements with the selected service before ordering.

ASSEMBLY: assembly.pdf and manifest.json are guides, not production artwork.
Do not send the assembly pages as sticker artwork. Begin with a solved cube,
choose Front/Up and avoid face turns while applying stickers. Preserve printed
orientation relative to each source face. Every blank sticker is required.
C1, C2, ... mark complete copies. Sticker IDs and face positions map every
physical image back to the immutable application source. Setup words in the
guide/manifest bring the completed source-pose print to readable examples.

The original geometric/arranged artwork is distributed with ARTWORK-LICENSE.txt.
Font-derived outlines, where used, additionally retain the included OFL.txt.
No external font service or raster sticker image is required by these exports.
'''
    (output/'README.txt').write_text(notes)
    extra_files.append('README.txt')
    manifest = {'schema': 'cubistry.print-sheet', 'version': 1, 'design': design['id'],
                'size': design['size'], 'stickersPerCube': 6*design['size']**2, 'copies': copies, 'layout': layout, 'stickerCount': len(records), 'pages': pages,
                'pageMm': PAGE, 'parameters': {'sizeMm': size, 'gapMm': gap, 'bleedMm': bleed, 'cornerRadiusMm': radius, 'safeMm': safe},
                'cut': {'spotColor': 'kiss_cut', 'cmyk': [0, 1, 0, 0], 'overprint': True, 'strokeMm': 0.1, 'method': 'kiss-cut; backing remains intact'},
                'source': {'path': design['source'], 'sha256': sha(ROOT/design['source'])},
                'setupExamples': design['setupExamples'],
                'artInputs': dict(sorted(artwork.inputs.items())),
                'generator': {'path': 'scripts/print-sticker-sheets.py', 'sha256': sha(Path(__file__)), 'artInputAdapter': sha(ROOT/'scripts/print/inputs.mjs'), 'tools': {n: importlib.metadata.version(n) for n in ['reportlab', 'fonttools', 'brotli']}},
                'font': font,
                'artworkLicense': {'spdx': 'AGPL-3.0-or-later', 'file': 'ARTWORK-LICENSE.txt'},
                'orientation': 'Outside view of each source face. Positive glyph rotation is clockwise on the sheet.',
                'providerStatus': 'Generic vector export. Confirm size, tolerance, radius, bleed and spot-color requirements with the chosen printer; not a PDF/X certification.',
                'stickers': records,
                'files': {name: sha(output/name) for name in ['print.pdf', 'assembly.pdf', *extra_files, *svg_files]}}
    (output/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    return manifest


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--design', choices=['de-a', 'en-3', 'hsm-symbols', 'hsm-words'])
    p.add_argument('--catalog', action='store_true', help='Build the six measured-size example presets')
    p.add_argument('--output', type=Path, required=True, help='A NEW directory; saved exports are never overwritten')
    p.add_argument('--size-mm', type=float, default=16)
    p.add_argument('--copies', type=int, default=2)
    p.add_argument('--layout', choices=['compact', 'faces'], default='compact')
    p.add_argument('--gap-mm', type=float, default=4)
    p.add_argument('--bleed-mm', type=float, default=2)
    p.add_argument('--radius-mm', type=float, default=1)
    p.add_argument('--safe-mm', type=float, default=1)
    args = p.parse_args()
    values = [args.size_mm, args.gap_mm, args.bleed_mm, args.radius_mm, args.safe_mm]
    need(all(math.isfinite(v) for v in values), 'Dimensions must be finite')
    need(8 <= args.size_mm <= 40, 'Sticker size must be between 8 and 40 mm')
    need(0 <= args.bleed_mm <= 5 and args.gap_mm >= max(2, 2*args.bleed_mm), 'Gap must be at least 2 mm and contain both neighboring bleed areas')
    need(0 <= args.radius_mm <= args.size_mm/2, 'Corner radius must fit the sticker')
    need(0 < args.safe_mm < args.size_mm/2, 'Safe margin must fit inside the sticker')
    need(1 <= args.copies <= 100, 'Copies must be between 1 and 100')
    need(bool(args.design) != args.catalog, 'Choose exactly one of --design or --catalog')
    need(not args.output.exists(), 'Output directory already exists')
    return args


def main():
    args = parse_args()
    designs = json.loads(subprocess.check_output(['node', str(ROOT/'scripts/print/inputs.mjs')], cwd=ROOT))
    if not args.catalog:
        result = write_design(designs[args.design], args.output, args.size_mm, args.gap_mm, args.bleed_mm, args.radius_mm, args.safe_mm, Artwork(), args.copies, args.layout)
        print(json.dumps({'design': args.design, 'stickers': result['stickerCount'], 'pages': result['pages'], 'output': str(args.output)}))
        return
    args.output.mkdir(parents=True, exist_ok=False)
    entries = []
    presets = [(d, s, 2) for d in ('de-a', 'en-3') for s in (15, 16)] + [(d, 20, 3) for d in ('hsm-symbols', 'hsm-words')]
    for design, size, copies in presets:
        identity = f'{design}-{size}mm-{copies}sets'
        directory = args.output/identity
        manifest = write_design(designs[design], directory, size, 4, 2, 1, 1, Artwork(), copies, 'compact')
        files = sorted(p for p in directory.iterdir() if p.is_file())
        with zipfile.ZipFile(directory/'bundle.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
            for file in files:
                item = zipfile.ZipInfo(file.name, date_time=(1980, 1, 1, 0, 0, 0))
                item.external_attr = 0o100644 << 16
                item.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(item, file.read_bytes())
        entries.append({'id': identity, 'design': design, 'sizeMm': size, 'copies': copies,
                        'stickerCount': manifest['stickerCount'], 'pages': manifest['pages'],
                        'directory': identity+'/',
                        'files': {p.name: sha(p) for p in sorted(directory.iterdir()) if p.is_file()}})
    catalog = {'schema': 'cubistry.print-catalog', 'version': 1,
               'dimensionStatus': 'Example dimensions only. Measure the sticker recess of your actual cube before ordering.',
               'entries': entries}
    (args.output/'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'presets': len(entries), 'output': str(args.output)}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, ImportError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
