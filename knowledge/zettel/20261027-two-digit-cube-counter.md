---
id: 20261027-two-digit-cube-counter
title: Two-digit Cube Counter – kleiner universeller Zähler
type: zettel
status: fleeting
created: 2026-10-27
tags: [cubistry, counter, countdown, 2x2, application]
---

# Two-digit Cube Counter – kleiner universeller Zähler

## Claim
Ein virtueller **2×2×2-Würfel** ist der bevorzugte Kandidat für einen flexibel steuerbaren **zweistelligen Counter von 00 bis 99**: hochzählen, herunterzählen und beliebige Sprünge um mehrere Einheiten. Ein 3×3 ist zunächst **kein gesetzter Ersatz**. Die physikalische Darstellbarkeit eines festen Stickerdrucks für alle 100 Werte muss noch nachgewiesen werden.

## Anwendungen
- Pausentimer für Schulungen, Meetings und Onlineveranstaltungen (z. B. 10 oder 15 Minuten rückwärts).
- Zählen beliebiger Stückzahlen wie Besucher oder ausgegebener Kaffee.
- Zwei Modi auf demselben Framework: **Countdown** mit Uhr als Zeitquelle und **manueller Counter** ohne Bezug zu Minuten.

## Interaktion und Darstellung
- Konfigurierbarer initialer Wert (00–99); Anzeige auf der Vorderseite des Würfels.
- **Increment/Decrement** um 1 und um frei wählbare Schrittweiten; mindestens **+10 / −10** als Beispiele; optional direkte Werteingabe bzw. Sprung zu Zielwert.
- Bedienung als UI über Buttons, Tastatur und/oder URL-Konfiguration (genaue Schnittstelle offen).
- Individuell definierbare Beschriftung, ggf. **zweizeilig**, oberhalb **oder** unterhalb des Würfels; als separates UI-Element, nicht zwingend in die Stickerbelegung eingebacken.
- Countdowns bis 99 Minuten, ohne Sekunden auf dem Würfel; Anzeige bei Minutengrenzen aktualisieren.
- Grenzen und Überlauf explizit konfigurieren/definieren: 00 bei Countdown, 99 beim Hochzählen, clamp vs. wrap; Pausieren, Fortsetzen und Zurücksetzen.
- Für beliebige Zählwerte außerhalb 00–99 wäre später ein anderes Modell erforderlich; die Erweiterung ist offen und **keine Entscheidung für 3×3**.

## Forschungsfrage: Solver und Tabellen
Für den klassischen 2×2×2 existieren effiziente Solver und vorab berechnete Tabellen, die wir nach Lizenz- und Modellprüfung bevorzugt wiederverwenden. Das könnte spontane Zählschritte **ohne spezielle Offline-Vorberechnung sämtlicher Counter-Übergänge** erlauben.

**Nicht automatisch bewiesen:** Tabellen für klassische 2×2-Solution-to-solved / Zustandsheuristiken garantieren weder ein geeignetes **festes Counter-Stickerlayout** noch optimale Folgen zu einer Ziel-*Anzeige* mit vielen zulässigen vollständigen Würfelzuständen. Ebenso sind optimale Folgen von Zustand A zu einer Anzeige B nicht notwendigerweise dieselben wie von A zu einem bestimmten kanonischen Zielwürfel B. Der Spike soll die Unterscheidung explizit testen.

## Offene Nachweise
1. Kann eine 2×2-Front mit **vier sichtbaren Facelets** den zweistelligen Dezimalwert 00–99 bei einem **festen** Druck und legalen Würfelstellungen abbilden? Ziffernglyphen, Orientierungen, Doppelbelegung und Ablesbarkeit konkret modellieren.
2. Wenn nicht: welche minimal veränderte Darstellung (Overlay, Labels außerhalb, alternative Zeichenkodierung) erhält die 2×2-Idee, ohne falsche technische Versprechen?
3. Für alle 100 Werte: legale erreichbare Zielzustände und Folgen für +1, −1, ±10 und beliebige Zielwerte (0–99), auch nach mehrfachen Sprüngen.
4. Lässt sich ein vorhandener 2×2-Solver/Lookup-Table mit unveränderter Zugnotation, Orientierungsmodell und vertretbarer Browsergröße verwenden? Optimale Lösung vs. best-known sauber unterscheiden.
5. Bei Countdown: zeitgesteuerter Zustandswechsel und korrekte Anzeige auch nach Hintergrundtab, Neustart und Uhrsprung.

## Connections
- [Countdown Cube – Event-Countdown (PR #16)](https://github.com/wstein/cubistry/pull/16)
- [Composable calendar transitions, Spike #15](https://github.com/wstein/cubistry/issues/15)
- [Knowledge conventions](../CONVENTIONS.md)

## Status
Produktidee, kein Beschluss zur 2×2-Machbarkeit und noch kein Implementierungsauftrag.
