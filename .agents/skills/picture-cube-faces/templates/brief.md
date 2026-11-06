# Brief: {{THEME}} picture-cube faces

Fill every placeholder before sending this to the building agent. Delete nothing from "Hard rules" or "Definition of Done".

## 1. Theme

- **Theme name:** {{THEME}}
- **Mood:** {{MOOD}} (three adjectives, e.g. calm, warm, curious)
- **Character cast:** {{CAST}} (original characters only: name, species, one personality trait, one signature color each)
- **Approved concept sheet:** {{CONCEPT_JSON}} (from `scripts/sketch-sheet.mjs`; the owner approved the composition)
- **Face size:** {{FACE_PX}} px per face (default 420: divisible by every cube size 2..7)

## 2. Belt story (L - F - R - B)

One continuous panorama that wraps from B back to L. Sky, ground and terrain colors are functions of the position around the belt.

| Face | Scene and time of day | Left edge color | Right edge color |
|---|---|---|---|
| L | {{L_SCENE}} | {{B_L_SEAM}} | {{L_F_SEAM}} |
| F | {{F_SCENE}} | {{L_F_SEAM}} | {{F_R_SEAM}} |
| R | {{R_SCENE}} | {{F_R_SEAM}} | {{R_B_SEAM}} |
| B | {{B_SCENE}} | {{R_B_SEAM}} | {{B_L_SEAM}} |

Up and Down: {{UP_DOWN_IDEA}} (their borders come from the belt faces' top and bottom rows).

## 3. Hero object per face

Exactly ONE dominating object per face (35-50 % of the face area), calm composition, no empty center.

| Face | Hero object | Spans several tiles at 7x7? | Texture anchors for the rest of the face |
|---|---|---|---|
| L | {{L_HERO}} | yes | {{L_ANCHORS}} |
| F | {{F_HERO}} | yes | {{F_ANCHORS}} |
| R | {{R_HERO}} | yes | {{R_ANCHORS}} |
| B | {{B_HERO}} | yes | {{B_ANCHORS}} |
| U | {{U_HERO}} | yes | {{U_ANCHORS}} |
| D | {{D_HERO}} | yes | {{D_ANCHORS}} |

## 4. Hard rules

- Style: flat vector, ONE ink color, three line weights, Pastel look (soft pastel fills, thin outlines, rosy cheeks, friendly faces). No gradients, filters, clipPath, mask, `url()`, `<text>`, `<image>`, `<script>`, `href`.
- The deliverable is **six whole faces** (U L F R B D, square svg, viewBox `0 0 S S`) plus `net.svg`. Do not ship tile files: the app slices the faces into NxN tiles at runtime for any N from 2 to 7.
- Granularity: every 1/49 tile (7x7) of every face needs something to place and to orient. Anchors per tile; no large empty skies without texture (stars, clouds, flat-band gradients, grass tufts); hero objects span several tiles.
- No scattered equal small items, no pale empty rings, no fussy borders, no corner icons, no letters or numbers unless the theme is a letter theme (then every glyph needs an unambiguous orientation hint).
- Seams: all 12 shared edges match; target mean difference below 3/255 (Up and Down borders about 0).
- Write code with the library in `.agents/skills/picture-cube-faces/src/` (`defineTheme`, `createBelt`); US English in all code and comments; no Python.
- Keep earlier builds in `v1/`, `v2/` (use `build(dir, { archive: true })`), rebuild in place.

## 5. Definition of Done

`node .agents/skills/picture-cube-faces/scripts/check-cube-set.mjs <dir>` prints `RESULT: PASS`, and:

- N = 2 is strictly clean (every tile: detail >= 8 %, rotation difference >= 3 %, no identical tiles).
- N = 3..7: the per-N counts are reported; the owner has not decided strictness yet, so list the counts in the hand-back (goal: zero).
- Seams, forbidden constructs and size budget (face <= 200 KB warn; report measured sizes) clean.
- You viewed the final sheet yourself after the LAST change.
- An independent review (`templates/review-prompt.md`) ran and its findings are addressed or listed.

## 6. Deliverables

- `{{OUT_DIR}}/{U,L,F,R,B,D}.svg`, `net.svg`, `tiles.json` (checker output), `build-report.json`
- the theme source (scene code) and the final sheet image
- `ratings.md` when variants exist (two variants per open question)

## 7. Hand-back

Use `templates/handback.md`.
