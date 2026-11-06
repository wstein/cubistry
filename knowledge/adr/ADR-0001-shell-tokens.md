---
id: ADR-0001
title: Shell design tokens and the dark accent on surfaces
type: adr
status: accepted
created: 2026-11-06
---
# ADR-0001: Shell design tokens and the dark accent on surfaces

## Context
The unified view needs one set of design tokens for light and dark themes (`src/shell/tokens.css`). The owner-approved
design proposal gives a palette. Checking it with the WCAG 2.x formula shows:

| Pair | Light | Dark |
|---|---|---|
| `--accent` on `--bg` | 7.12:1 | 5.07:1 |
| `--accent` on `--surface` | 7.77:1 | 4.48:1 |
| `--accent` on `--surface-2` | 6.69:1 | 3.94:1 |
| `--mark-ink` on `--bg` / `--surface` | 10.33:1 / 11.27:1 | 8.25:1 / 7.29:1 |

The dark `--accent` on `--surface` is below 4.5:1, the minimum for normal text. The palette also has no token for the logo
ink, which the header mark needs. `AGENTS.md` asks for berry on `.brand-mark` and primary buttons and warns against
saturated green or blue in the core shell without an ADR; the status colors `--s-sync` (teal) and `--s-moving` (blue) are
such colors.

## Decision
Accepted by the owner on 2026-11-06, including the status colors (teal, blue) and the dark theme.

- Keep the palette values unchanged and add `--mark-ink` (`#153b61` light, `#8fb4dd` dark) for the logo.
- `--accent` marks the primary action, the logo and small fills (cube-count badge, footer mark). In the dark theme it is used on `--surface` and `--surface-2`
  only for large text (20 px and up), fills and non-text parts (3:1). Small accent text sits on `--bg` (5.07:1).
  `--on-accent` on `--accent` is 7.91:1 light and 5.57:1 dark.
- The status colors `--s-ready`, `--s-moving`, `--s-sync`, `--s-paused`, `--s-done`, `--s-warn`, `--s-error` appear only in
  the status chip and in warning and error rows, always with a text label. They meet 4.5:1 on `--bg` and `--surface`.
- `tests/shell-tokens.test.mjs` fails when a listed pair drops below its minimum.

## Alternatives
- Lighten the dark `--surface` until `--accent` reaches 4.5:1. Changes the panel tone and the other pairs; not needed when
  accent text on surfaces is limited to large text.
- Darken the status colors. They already pass 4.5:1.

## Consequences
- Small accent text on dark panels is not allowed; the test does not detect misuse in component CSS.
- IBM Plex Sans and Mono are self-hosted as the complete, unmodified upstream WOFF2 files (OFL 1.1, `public/fonts/ibm-plex/`, source and checksums in `NOTICE.txt`); sticker print keeps Noto Sans.

## References
- [Architecture decisions](index.md)
- [Third-party notices](../../THIRD_PARTY_NOTICES.md)

## Supersedes / superseded by
None.
