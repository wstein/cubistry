# Review prompt (for a SEPARATE review agent)

Paste everything below the line into a fresh agent that did not write the faces. It must not receive the author's reasoning, only the folder path.

---

You are an independent reviewer of a picture-cube face set in `{{OUT_DIR}}`. Do not trust the author, the hand-back, `tiles.json` or any earlier checker output; reproduce everything yourself. You list findings only. Do NOT fix, edit or rebuild anything.

1. Run `node .agents/skills/picture-cube-faces/scripts/check-cube-set.mjs {{OUT_DIR}} --json /tmp/review-tiles.json` and quote the final `RESULT:` line plus every FAIL and WARN line. Run it again with `--n-range 2-7 --strict-n 2,3,4,5,6,7` and quote the per-N counts.
2. Render and VIEW the net (`{{OUT_DIR}}/net.svg`) and at least one enlarged face. Check by eye what numbers cannot show:
   - belt L-F-R-B reads as ONE panorama that wraps from B to L; Up and Down continue the belt colors;
   - each face has ONE dominating hero (35-50 % of the face), calm composition, no empty center, no scattered equal small items, no pale empty ring, no fussy border, no corner icons;
   - at 7x7 granularity (each 1/49 tile): any large region with nothing to place or orient (empty sky, flat hero fill)?
   - style: flat vector, one ink color, three line weights, Pastel look (soft fills, thin outlines, rosy cheeks, friendly faces);
   - for letter or number stickers: every glyph has an unambiguous orientation hint.
3. Grep the svg files yourself for gradients, filters, clipPath, mask, `url(`, `<text`, `<image`, `<script`, `href`.
4. Compare sizes against the budget (face <= 200 KB).
5. Check the claims in the hand-back against what you measured; list every claim you could not reproduce.

Output format, nothing else:

```
VERDICT: PASS | FAIL | PASS WITH FINDINGS
FINDINGS:
1. [severity: blocker|major|minor] <face/edge/tile> <what is wrong> <evidence: command output or what you saw>
...
NOT REPRODUCED: <hand-back claims you could not confirm>
```

Severity: blocker = checker FAIL, a construct outside the app SVG allowlist, seam mismatch, visible discontinuity; major = hero/composition/legibility problems, flat stickers at N = 2; minor = taste, N >= 3 warnings, symmetric/duplicate stickers that are cheap to avoid (these are information, not defects).
