---
name: validate-artwork
description: Review SVG-first sticker graphics, wordmarks and typography for reproducible print output.
---
# Validate Artwork

Use when changing logos, sticker face art, calendar glyphs, typography, print plans or preview raster exports.

1. Verify canonical dimensions, viewBox, units, safe areas, scaling and sticker-to-face mapping.
2. Keep SVG as authoritative vector output. PNG is optional and must state pixel resolution/DPI and source SVG revision.
3. Check font family/version, licensing and redistribution rights; pin local assets when permitted and record hashes. For print reproducibility either embed appropriately licensed fonts or convert final text to vector paths while retaining editable sources.
4. Confirm all glyphs needed for selected languages, date/time formatting and wordmark; inspect kerning, legibility and collision at physical size.
5. Ensure face/sticker identity and orientation survive transforms. Do not infer physical feasibility from a rendered preview.
6. Flag external network references, unsupported SVG features, rasterized text, unlicensed assets or nondeterministic transforms.
7. Supply tested render/validation commands, a before/after visual review summary and a reproducible source-to-export trail.
