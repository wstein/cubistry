# Calendar7 font styles

The app offers fourteen local styles. Noto Sans 600 remains the default. Font
selection changes the lettering in the month sheet and the cube together. It
keeps the month, printed sticker identities, pose, move history and camera.
Selection is in memory; `?font=<id>` can choose an initial style. Unknown IDs
select Noto. Paper Red remains the default color scheme.

| Style ID | Font | Weight | Native master |
| --- | --- | ---: | ---: |
| `noto` | Noto Sans | 600 | 6 |
| `nunito` | Nunito | 600 | 6 |
| `nunito-sans` | Nunito Sans | 600 | 9 |
| `quicksand` | Quicksand | 600 | 6 |
| `nova-oval` | Nova Oval | 400 | 9 |
| `nova-square` | Nova Square | 400 | 6 |
| `nova-mono` | Nova Mono | 400 | 9 |
| `comfortaa` | Comfortaa | 600 | 6 |
| `varela-round` | Varela Round | 400 | 9 |
| `crete-round` | Crete Round | 400 | 6 |
| `dseg14classic-regular` | DSEG14 Classic Regular | 400 | 6 |
| `dseg14classic-bold` | DSEG14 Classic Bold | 700 | 6 |
| `dseg14modern-regular` | DSEG14 Modern Regular | 400 | 6 |
| `dseg14modern-bold` | DSEG14 Modern Bold | 700 | 6 |

## Drawing contract

Each style uses one native master glyph for both 6 and 9. The partner is that
same glyph rotated 180 degrees about its center. The rule also applies inside
16, 19, 26 and 29; two different native outlines are never mixed. Ordinary 0
remains a normal font glyph. No rule profile, print, root word or state data is
changed by selecting a font.

Dates 1 through 31 use one constant font size within a style. The size is based
on a common maximum digit ink height of 82 pixels on the 192-pixel artwork;
there is no size adjustment based on digit count. TextMetrics determine the
centering without stretching glyphs. Split labels use the regular first date
and a 45% second date at the lower right, without a slash. Both ink extents and
outer margins are checked using rendered pixels. Month and weekday labels keep
letters, with a separate width fit for their existing label lengths.

The compact month sheet contains the same glyph artwork, proportionally
contained in its existing cells, plus accessible text. It retains the original
page-theme foreground and background colors: canvas and HTML use the same
computed CSS pair, preserving the 4.5:1 text contrast contract in both themes.
Automatic color-scheme changes and explicit page-theme changes redraw the
canvases; both listeners are released when the mode is disposed. The cube keeps
its selected printed color scheme, independent of the page theme, and applies its
existing stickerless face scale when needed. Its weekday bottom line remains
a property of the printed weekday tile. The body day-fill color is applied
only to stickerless faces, as before.

A font change redraws existing canvas textures and marks them for upload. It
does not rebuild cubies, create replacement textures, cancel an active turn or
reset playback. Original font files are loaded only when selected, checked
against SHA-256, and awaited before painting. A finite cache retains loaded
FontFace objects. Stale results and disposed mounts cannot paint. A failed
selection falls back to verified Noto; if that also fails, an accessible status
explains the failure and the text sheet remains available.

## Assets and limits

Original fonts remain unmodified OFL-1.1 software, including their copyright
and reserved-name notices. The [asset manifest](../public/fonts/calendar7/manifest.json)
records exact font and license hashes and pinned upstream sources. Each font's
OFL text accompanies it. Variable fonts use the selected weight; other axes
remain at the recorded upstream defaults (Nunito Sans: width 100, optical size
12 and YTLC 500). No synthetic bold is requested.

Derived artwork and the asset inventory carry the
[CC BY-SA notice](../public/fonts/calendar7/NOTICE.txt). Source code is
AGPL-3.0-or-later. This app change does not generate print sheets or establish
physical feasibility. Raster measurements describe the tested browser and
resolution; they do not certify vector identity or a new physical proof.
