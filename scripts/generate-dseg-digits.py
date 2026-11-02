#!/usr/bin/env python3
"""Generate DSEG7 and DSEG14 Classic Regular vector SVG digits with orientation dots."""
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "public/fonts/dseg"
DIGITS_DIR = ROOT / "public/assets/digits"

CONFIGS = [
    ("dseg7", FONTS_DIR / "DSEG7Classic-Regular.ttf", DIGITS_DIR / "dseg7"),
    ("dseg14", FONTS_DIR / "DSEG14Classic-Regular.ttf", DIGITS_DIR / "dseg14"),
]

# Scale & centering parameters for 256x256 square sticker face
# Font units: unitsPerEm=1000, cell width=618 (99..717), height=1000 (0..1000)
# Height 208 gives scale = 0.208, leaving 24px top and 24px bottom margins
SCALE = 0.208
X_OFFSET = 128.0 - 408.0 * SCALE  # 43.136
BASELINE = 232.0  # height 208: top at 24, baseline at 232
TRANSFORM_DIGIT = (SCALE, 0, 0, -SCALE, X_OFFSET, BASELINE)

# Dot is placed after the digit cell at advance = 816
DOT_X = X_OFFSET + 816.0 * SCALE
TRANSFORM_DOT = (SCALE, 0, 0, -SCALE, DOT_X, BASELINE)

manifest_data = {}

for variant, font_path, out_dir in CONFIGS:
    out_dir.mkdir(parents=True, exist_ok=True)
    font = TTFont(font_path)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()

    variant_dict = {}

    for d in range(10):
        ch = str(d)

        # 1. Clean digit
        pen = SVGPathPen(glyphs)
        glyphs[cmap[ord(ch)]].draw(TransformPen(pen, TRANSFORM_DIGIT))
        path_clean = pen.getCommands()
        svg_clean = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
            f'<rect width="256" height="256" fill="#fffdf6"/>'
            f'<path d="{path_clean}" fill="#1d4771"/>'
            f'</svg>\n'
        )
        clean_file = out_dir / f"{d}.svg"
        clean_bytes = svg_clean.encode("utf-8")
        clean_file.write_bytes(clean_bytes)
        clean_sha = hashlib.sha256(clean_bytes).hexdigest()
        variant_dict[ch] = {
            "url": f"/assets/digits/{variant}/{d}.svg",
            "sha256": clean_sha,
        }

        # 2. Digit with orientation dot
        pen_dot = SVGPathPen(glyphs)
        glyphs[cmap[ord(ch)]].draw(TransformPen(pen_dot, TRANSFORM_DIGIT))
        glyphs[cmap[ord(".")]].draw(TransformPen(pen_dot, TRANSFORM_DOT))
        path_dot = pen_dot.getCommands()
        svg_dot = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
            f'<rect width="256" height="256" fill="#fffdf6"/>'
            f'<path d="{path_dot}" fill="#1d4771"/>'
            f'</svg>\n'
        )
        dot_file = out_dir / f"{d}-dot.svg"
        dot_bytes = svg_dot.encode("utf-8")
        dot_file.write_bytes(dot_bytes)
        dot_sha = hashlib.sha256(dot_bytes).hexdigest()
        variant_dict[f"{ch}-dot"] = {
            "url": f"/assets/digits/{variant}/{d}-dot.svg",
            "sha256": dot_sha,
        }

    manifest_data[variant] = variant_dict
    print(f"Generated {len(variant_dict)} SVG digits for {variant}")

out_manifest = ROOT / "src/apps/ms-timer/dseg-manifests.json"
out_manifest.write_text(json.dumps(manifest_data, indent=2) + "\n")
print(f"Wrote manifest to {out_manifest}")
