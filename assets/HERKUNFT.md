---
last-reviewed: 2026-08-31
owns: []
---

# Herkunft der Fremdmodelle

Jede Datei unter `public/creatures` steht hier mit Autor und Lizenz. Das ist
keine Höflichkeit: **CC-BY verlangt die Namensnennung**, und ohne diese Tabelle
wäre die Bedingung nicht erfüllt. `tools/quality.ts` prüft deshalb, dass jede
Modelldatei einen Eintrag hat und jeder Eintrag eine Datei — ein Modell ohne
Zeile ist ein **Blocker**, keine Warnung.

## Warum überhaupt CC-BY

ADR-0002 sagt CC0. Am 31.08.2026 hat Flo die Abweichung für Kreaturmodelle
freigegeben: Die Alpennischen des Rosters — Steinbock, Gams, Wildschwein,
Murmeltier, Schneehase, Baummarder, Feuersalamander — kommen in CC0-Paketen
schlicht nicht vor (G-123, G-124). Die Alternative wäre ein Generator gewesen,
und der ist auf beiden Rechnern nicht lauffähig (G-119).

**Für Props bleibt es bei CC0.** Die Ausnahme gilt nur für `public/creatures`.

## Modelle

| Datei | Rolle | Autor | Lizenz | Quelle |
|---|---|---|---|---|
| `spuerfuchs.glb` | Spürfuchs | Quaternius | CC0 | poly.pizza, Animated Animal Pack |
| `k7-wolf.glb` | K7-Wolf | Quaternius | CC0 | poly.pizza, Animated Animal Pack |
| `grathorn.glb` | Grathorn | Quaternius | CC0 | poly.pizza, Animated Animal Pack (Stag) |
| `nebelgams.glb` | Nebelgams | Quaternius | CC0 | poly.pizza, Animated Animal Pack (Deer) |
| `wurzelkeiler.glb` | Wurzelkeiler | Poly by Google | **CC BY 3.0** | poly.pizza, „Boar" |

Alle Dateien sind gegenüber dem Original verändert: Materialfarbe an den Vertex
gebacken, Leuchtdichte in die Palette der Welt gezogen, Dreiecke auf `zielTris`
reduziert, auf Widerristhöhe genormt (`tools/kreaturbau.py`). Bei CC BY ist das
ausdrücklich erlaubt und muss als Bearbeitung kenntlich sein — diese Zeile ist
die Kenntlichmachung.

## Was im Spiel stehen muss

Für CC BY reicht die Nennung in einer mitgelieferten Datei; ein Impressum im
Menü ist die sauberere Form. **Offen**, solange das Verzeichnis im Menü keinen
Abschnitt „Herkunft" hat.

## Nicht übernommen

| Modell | Autor | Lizenz | Warum nicht |
|---|---|---|---|
| `ibex` | Syl | CC BY 3.0 | Beine stehen in einer eingefrorenen Sprungpose schräg nach hinten weg — die Hörner stimmen, der Rest ist unbrauchbar (28.08.2026 gerendert und verworfen) |
