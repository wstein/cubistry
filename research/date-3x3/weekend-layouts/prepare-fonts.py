"""Convert pinned licensed WOFF2 sources to deterministic TTF for PNG previews."""
from pathlib import Path
from fontTools.ttLib import TTFont
root = Path(__file__).resolve().parent / 'images/fonts'
for weight in (600, 800):
    font = TTFont(root / f'noto-sans-latin-{weight}.woff2', recalcTimestamp=False)
    font.flavor = None
    font.save(root / f'noto-sans-latin-{weight}.ttf', reorderTables=True)
