---
id: 20261027-countdown-cube
title: Countdown Cube – konfigurierbarer Event-Countdown
type: zettel
status: fleeting
created: 2026-10-27
tags: [chronocube, countdown, application, concept]
---

# Countdown Cube – konfigurierbarer Event-Countdown

## Claim
Das Cubistry-/Chronocube-Framework könnte einen **virtuellen Countdown-Würfel** für ein frei wählbares Ereignis bereitstellen: verbleibende **Tage (idealerweise vierstellig), Stunden und Minuten** als gut lesbare Information auf der Vorderseite. Das ist eine **Produktidee**, noch keine nachgewiesene 4×4×4-Sticker-/Solver-Konstruktion.

## Konzept
- Zielereignisse: Konzert, Jahreswechsel, Olympia oder ein beliebiges persönliches Event.
- Zielzeitpunkt über Konfiguration/URL festlegen, mit eindeutig bestimmter Zeitzone.
- Frei gewählter **Titel** (z. B. „Bis zum Konzert“), **nicht** fest in die physische Stickerbelegung oder Wordmark eincodiert; vermutlich als unabhängiges HTML-/UI-Overlay über/neben dem Würfel.
- Optionale Farbschemata aus URL-Konfiguration.
- Eigenständige, statisch hostbare Webanwendung, z. B. über GitHub Pages, mit clientseitiger Uhrzeitberechnung und renderbarem URL-Link.
- Auf dem Würfel **keine Sekundenanzeige**; Anzeigewechsel zur Minutengrenze. Die Zeitzone/DST und Verhalten nach dem Event müssen festgelegt werden.
- **4×4×4 als interessanter Kandidat**, aber nicht als bereits erwiesene Lösung; alternativ 5×5×5 oder eine andere Darstellung prüfen.

## Offene Machbarkeitsfragen
1. Ist die vollständige Vorderseitenanzeige aus vier Tagesziffern + Stunden + Minuten auf einer einzigen 4×4-Seite unter realen Cubie-/Sticker-/Orientierungsbeschränkungen überhaupt darstellbar? Ein 4×4 hat nur 16 Frontpositionen, daher zuerst eine konkrete Kapazitäts- und Legality-Analyse.
2. Kann **ein einziges festes Stickerlayout** den gewünschten Wertebereich und die notwendigen Übergänge darstellen, ohne andere Frontinformationen zu beschädigen?
3. Lässt sich ein großer Tagesbereich (0–9999 Tage als Wunsch, nicht zugesichert) mit gültigen Zügen und zufriedenstellender Lesbarkeit abdecken?
4. Sind Countdown-Teilübergänge im Voraus berechenbar/komponierbar? Die Unterschiede zwischen gleicher Frontanzeige und gleichem vollständigen Würfelzustand beachten; vgl. [Precomputed calendar transitions, Issue #15](https://github.com/wstein/cubistry/issues/15).
5. Ist der Ereignistitel außerhalb des physikalischen Würfels der beste Weg, damit er frei editierbar bleibt?
6. UTC-Zielzeitpunkt und Darstellungszeitzone: welche Defaults? Verhalten bei vergangenem Ziel und Synchronisierung nach Tab-Resume.
7. Robustheit von URL-Parametern (Länge, Encoding, Validierung, Teilen, sensible Veranstaltungstitel) und erlaubten Themes.

## Mögliche URL (illustrativ, noch kein Vertrag)
`?at=2027-01-01T00%3A00%3A00%2B01%3A00&title=Neujahr&theme=coral`

## Konsequenzen
- Countdown eignet sich als optionale **Framework-Demo**, ohne die Hauptfunktion Chronocube-Live-Kalenderuhr zu verwässern.
- Darstellungs-Text außerhalb der Stickerlogik strikt vom Würfelzustand trennen.
- Vor Implementierungsplanung zuerst ein fokussierter Solver-/Layout-Spike für 4×4; bei Fehlschlag größeren Würfel oder UI-Aufteilung evaluieren.
- Noch **kein Implementierungs-Issue**; Forschungs- oder Entwicklungsarbeit erst nach Priorisierung als GitHub-Issue planen.

## Connections
- [Knowledge-Konventionen](../CONVENTIONS.md)
- [Composable calendar transitions (Issue #15)](https://github.com/wstein/cubistry/issues/15)
- [Functional Pilot (Issue #12)](https://github.com/wstein/cubistry/issues/12)
